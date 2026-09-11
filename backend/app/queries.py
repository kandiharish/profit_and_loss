"""
SQL builders. One shared classification CTE feeds every endpoint, so the
accounting logic is defined exactly once.

SOURCE: a single consolidated ledger --
`nodal-plexus-492111-e9.lyson_sons.consolidated_general_ledger`.
It spans BOTH legal entities (Lyons & Sons and Warehouse LLC) and carries
`account_type` inline, so there is no chart_of_accounts table and no join.
That removes the join entirely -- the old failure mode where the join could
lose or duplicate rows no longer exists, because there is nothing to join.

Column mapping from the old two-table source, aliased in the `gl` CTE so the
rest of this module and every downstream consumer are unchanged:

    transaction_date       -> date
    distribution_account   -> account_name   (the leaf account; 601 distinct)
    account_type           -> read directly, no lookup

`account_fully_qualified_name` is NOT the key: it is the parent:child path
(438 distinct) and is NULL on every untyped row. `distribution_account` is
the leaf name and matches the old `account_name` values exactly.

Rules in force (set by the data owner):
  * Classify on account_name only. split_account is context, never a key.
  * account_id is NOT used: it is not populated consistently.
  * The table's own `amount` and `balance` columns are NOT used -- amounts
    come from debit/credit only, matching the old rule against net_amount.
  * amount = credit - debit  (debit negative, credit positive)
"""

from datetime import date

from .bq import param
from .config import settings

GL = settings.gl_table_ref

# The five P&L sections, in statement order.
#
# The third element is the literal `Section` value carried on every row of
# Conso_GL_Dump_latest -- that, not QuickBooks' account_type, decides where
# a row lands (account_type still decides WHETHER it is on the statement).
# The internal keys (revenue/cogs/opex/...) are deliberately UNCHANGED so
# variance colouring, the KPI strip and the charts keep working untouched.
SECTIONS = [
    ("revenue", "Operating Revenue", "Operating Revenue", 1),
    ("cogs", "Cost of Goods Sold", "Cost of Goods Sold", 2),
    ("opex", "Operating Expenses", "Operating Expenses", 3),
    ("other_income", "Other Income", "Other Income", 4),
    ("other_expense", "Other Expenses", "Other Expenses", 5),
]

# QuickBooks' own P&L account types. These gate MEMBERSHIP -- a row is on the
# statement only if QuickBooks typed it as a P&L account. The mapping decides
# WHERE a row sits, never WHETHER it is on the statement.
#
# Without this gate the mapping also drags in 981 rows belonging to accounts
# that were DELETED in QuickBooks (account_type NULL) but still carry a
# Section. Those were excluded before and must stay excluded: including them
# moved Net Income by -271,056.19.
_PNL_TYPES = ("Income", "Cost of Goods Sold", "Expense",
              "Other Income", "Other Expense")
_PNL_TYPES_SQL = ", ".join(f"'{t}'" for t in _PNL_TYPES)

_SECTIONCASE_SEP = "\n    "
_SECTION_CASE = _SECTIONCASE_SEP.join(
    f"WHEN '{section}' THEN '{key}'" for key, _, section, _ in SECTIONS
)
_ORDER_CASE = _SECTIONCASE_SEP.join(
    f"WHEN '{section}' THEN {order}" for _, _, section, order in SECTIONS
)

# The five Balance Sheet sections, in statement order.
#
# `sign` flips a section for display. Amounts are credit - debit, so
# debit-normal assets arrive negative; a balance sheet reads them positive.
# Liabilities and equity are credit-normal and pass through unchanged. The
# flip is presentation ONLY -- nothing downstream re-derives from it.
BS_SECTIONS = [
    ("current_assets", "Current Assets", "Current Assets", 1, -1),
    ("non_current_assets", "Non-Current Assets", "Non-Current Assets", 2, -1),
    ("current_liabilities", "Current Liabilities", "Current Liabilities", 3, 1),
    ("non_current_liabilities", "Non-Current Liabilities",
     "Non-Current Liabilities", 4, 1),
    ("equity", "Equity", "Equity", 5, 1),
]

_BS_SECTION_CASE = _SECTIONCASE_SEP.join(
    f"WHEN '{section}' THEN '{key}'" for key, _, section, _, _ in BS_SECTIONS
)
_BS_ORDER_CASE = _SECTIONCASE_SEP.join(
    f"WHEN '{section}' THEN {order}" for _, _, section, order, _ in BS_SECTIONS
)

# Ledger groups clubbed together on the statement.
#
# Each entry is (section, source ledger names, canonical id, canonical name).
# The section is part of the key on purpose: "Rental Income - Non-Operating"
# exists under BOTH Operating Revenue (Ledger_ID 4600) and Other Income
# (8100). Only the Operating Revenue one is folded into Third Party -- the
# Other Income one is a different ledger that happens to share a name, and
# merging it would move 834,788.00 across a section boundary.
#
# Ledger_ID is rewritten alongside the name, not just the name. The statement
# groups on (section, ledger_id, ledger_name), so leaving three different ids
# behind one merged name would split it back into three rows.
LEDGER_MERGES = [
    (
        "Operating Revenue",
        ("Handling & Services Revenue",
         "Inbound Handling Revenue",
         "Outbound Handling Revenue"),
        "4100",
        "Handling & Services Revenue",
    ),
    (
        "Operating Revenue",
        ("Rental Income - Non-Operating",
         "Rental Income - Third Party"),
        "4600",
        "Rental Income - Third Party",
    ),
]


def _merge_case(column: str) -> str:
    """CASE that rewrites Ledger_ID / Ledger_Name for the clubbed groups."""
    out = ["CASE"]
    for section, sources, new_id, new_name in LEDGER_MERGES:
        names = ", ".join(f"'{n}'" for n in sources)
        value = new_id if column == "Ledger_ID" else new_name
        out.append(f"      WHEN Section = '{section}'")
        out.append(f"       AND Ledger_Name IN ({names})")
        out.append(f"      THEN '{value}'")
    out.append(f"      ELSE {column} END")
    return chr(10).join(out)


_MERGED_ID = _merge_case("Ledger_ID")
_MERGED_NAME = _merge_case("Ledger_Name")

# Strip the leading GL code from an account name for display:
#   "6100-01 Rent - Lyons"  -> "Rent - Lyons"
#   "7650 Bank Charges"     -> "Bank Charges"
#
# The guard matters. REGEXP_CONTAINS requires that a non-space character
# survives the strip, so an account whose name is nothing but a code is left
# alone rather than blanked. The raw account_name is still carried through --
# display is cosmetic, and drill-down keys off the real name.
#
# Known limitation: an account legitimately named starting with a number
# (e.g. "600 Jersey Ave") would have that number stripped. None exist in the
# current chart of accounts. If one is ever added, set STRIP_GL_CODES=false.
_DISPLAY_NAME = r"""
    CASE
      WHEN @strip_codes
       AND REGEXP_CONTAINS(gl.account_name, r'^[0-9]+(-[0-9]+)*\s+\S')
      THEN REGEXP_REPLACE(gl.account_name, r'^[0-9]+(-[0-9]+)*\s+', '')
      ELSE gl.account_name
    END AS display_name"""

CLASSIFIED = f"""
WITH gl AS (
  SELECT
    transaction_date AS date,
    -- The leaf account name: what a drill-down shows, and the raw key.
    -- account_fully_qualified_name is the parent:child path and is not used.
    distribution_account AS account_name,
    company_name,
    department,
    transaction_type,
    document_number,
    description,
    split_account,
    COALESCE(customer_name, vendor_name, employee_name, name) AS counterparty,
    account_type,
    -- Statement structure, already joined onto every row by the dump.
    Statement AS statement_label,
    Section AS section_label,
    -- Clubbed per LEDGER_MERGES; identity for everything else.
    {_MERGED_ID} AS ledger_id,
    {_MERGED_NAME} AS ledger_name,
    -- FLOAT64 -> NUMERIC before arithmetic: floats accumulate rounding error
    -- across thousands of rows, which is unacceptable on a P&L.
    COALESCE(SAFE_CAST(credit AS NUMERIC), 0)
      - COALESCE(SAFE_CAST(debit AS NUMERIC), 0) AS amount
  FROM `{GL}`
),
classified AS (
  SELECT
    gl.*,
    {_DISPLAY_NAME},
    -- Two authorities, deliberately separated:
    --   account_type -> WHETHER a row belongs on the P&L
    --   Section      -> WHERE it sits once it does
    --
    -- The IS NULL test is load-bearing. `x NOT IN (...)` evaluates to NULL,
    -- not TRUE, when x is NULL, so a bare NOT IN silently readmits all 981
    -- rows belonging to accounts DELETED in QuickBooks -- which still carry
    -- a Section -- and moves Net Income by -271,056.19.
    CASE WHEN gl.account_type IS NULL
           OR gl.account_type NOT IN ({_PNL_TYPES_SQL}) THEN NULL
         ELSE CASE gl.section_label
         {_SECTION_CASE}
         ELSE NULL END
    END AS pnl_section,
    CASE WHEN gl.account_type IS NULL
           OR gl.account_type NOT IN ({_PNL_TYPES_SQL}) THEN 99
         ELSE CASE gl.section_label
         {_ORDER_CASE}
         ELSE 99 END
    END AS section_order,
    -- No statement structure on the row at all.
    gl.section_label IS NULL AS is_unmatched
  FROM gl
)"""


def _period_filter(department: str | None, company: str | None = None) -> str:
    clause = "WHERE section_order <= 5 AND date BETWEEN @start_date AND @end_date"
    if company:
        clause += " AND company_name = @company"
    if department:
        clause += " AND department = @department"
    return clause


def _base_params(start: date, end: date, department: str | None,
                 strip_codes: bool, company: str | None = None) -> list:
    params = [
        param("start_date", "DATE", start),
        param("end_date", "DATE", end),
        param("strip_codes", "BOOL", strip_codes),
    ]
    if company:
        params.append(param("company", "STRING", company))
    if department:
        params.append(param("department", "STRING", department))
    return params


def statement(start: date, end: date, department: str | None = None,
              strip_codes: bool = True, company: str | None = None):
    """Ledger-level P&L: one row per (section, ledger), which is what the
    statement grid shows when a section is expanded.

    Individual accounts are NOT returned here -- they live one level down,
    behind `drilldown`, keyed off the ledger name.
    """
    # The zero-suppression filter lives in an OUTER query rather than a
    # HAVING clause. Inside HAVING, BigQuery resolves `amount` to the SELECT
    # alias -- which is already aggregated -- so `HAVING SUM(amount) != 0`
    # fails with "aggregations of aggregations", while `HAVING amount != 0`
    # silently means something different from what it reads like. A subquery
    # is unambiguous and cannot be "fixed" into breakage later.
    sql = f"""{CLASSIFIED}
SELECT * FROM (
  SELECT
    section_order,
    pnl_section,
    ledger_id,
    ledger_name,
    ROUND(SUM(amount), 2) AS amount,
    COUNT(*) AS txn_count,
    COUNT(DISTINCT account_name) AS account_count
  FROM classified
  {_period_filter(department, company)}
  GROUP BY section_order, pnl_section, ledger_id, ledger_name
)
WHERE amount != 0
-- Within a section, biggest first.
--
-- ABS() rather than a plain DESC, because the two halves of the statement
-- carry opposite signs: revenue is positive, expenses negative (amount =
-- credit - debit). Sorting on the raw value would put the SMALLEST expense
-- at the top of every expense section. Magnitude gives one rule that reads
-- correctly on both -- largest revenue first, largest expense first.
--
-- It also keeps contra lines honest: "Sales Discounts & Rebates" is a small
-- negative inside Operating Revenue and sorts to the bottom on size, which
-- is where it belongs, rather than jumping to the top for being negative.
--
-- ledger_name breaks ties so the order is deterministic; two ledgers with
-- the same magnitude must not swap places between refreshes.
ORDER BY section_order, ABS(amount) DESC, ledger_name
"""
    return sql, _base_params(start, end, department, strip_codes, company)


def trend(start: date, end: date, department: str | None = None,
          company: str | None = None):
    """Monthly section totals."""
    sql = f"""{CLASSIFIED}
SELECT
  DATE_TRUNC(date, MONTH) AS period,
  pnl_section,
  ROUND(SUM(amount), 2) AS amount
FROM classified
{_period_filter(department, company)}
GROUP BY period, pnl_section
ORDER BY period, pnl_section
"""
    return sql, _base_params(start, end, department, True, company)


def drilldown(start: date, end: date, ledger_name: str,
              department: str | None = None, limit: int = 500,
              company: str | None = None):
    """Transaction lines behind one ledger group.

    Keys off `ledger_name`, because a ledger is what the statement now shows.
    `account` is carried on every line so it stays visible WHICH underlying
    account each transaction hit -- that detail is not lost by grouping, it
    just moves down a level.
    """
    clause = (_period_filter(department, company)
              + " AND ledger_name = @ledger_name")
    sql = f"""{CLASSIFIED}
SELECT
  date,
  display_name AS account,
  account_name,
  transaction_type,
  document_number,
  counterparty,
  description,
  split_account,
  department,
  amount
FROM classified
{clause}
ORDER BY date DESC
LIMIT @row_limit
"""
    params = _base_params(start, end, department, True, company) + [
        param("ledger_name", "STRING", ledger_name),
        param("row_limit", "INT64", limit),
    ]
    return sql, params


def departments():
    """
    Property / LLC list for the filter dropdown.

    `department` is the RAW value and remains the filter key. Amounts are
    never merged across two different raw departments -- these are separate
    legal entities and their figures must stay separate.

    `department_display` strips a leading numeric prefix for readability:

        "1650 Sherman"                       -> "Sherman"
        "1650 Sherman Avenue Associates LLC" -> "Sherman Avenue Associates LLC"

    COLLISION GUARD: "1650 Sherman" and "850 Sherman" are different entities
    that both strip to "Sherman". Two properties under one identical label
    would be unreadable, so when a stripped label is claimed by more than one
    raw department, the numeric prefix is appended in parentheses:

        "1650 Sherman" -> "Sherman (1650)"
        "850 Sherman"  -> "Sherman (850)"

    `disambiguated` flags those rows. Amounts are never merged either way --
    the raw `department` remains the filter key throughout.
    """
    sql = f"""
WITH d AS (
  SELECT department, COUNT(*) AS gl_rows
  FROM `{GL}`
  WHERE department IS NOT NULL AND TRIM(department) != ''
  GROUP BY department
),
s AS (
  SELECT
    department,
    gl_rows,
    REGEXP_EXTRACT(department, r'^([0-9]+)\\s+\\S') AS prefix,
    CASE
      WHEN REGEXP_CONTAINS(department, r'^[0-9]+\\s+\\S')
      THEN TRIM(REGEXP_REPLACE(department, r'^[0-9]+\\s+', ''))
      ELSE department
    END AS stripped
  FROM d
),
c AS (
  SELECT
    department,
    gl_rows,
    prefix,
    stripped,
    COUNT(*) OVER (PARTITION BY LOWER(TRIM(stripped))) AS label_uses
  FROM s
)
SELECT
  department,
  CASE
    WHEN label_uses > 1 AND prefix IS NOT NULL
      THEN CONCAT(stripped, ' (', prefix, ')')
    ELSE stripped
  END AS department_display,
  gl_rows,
  label_uses > 1 AS disambiguated
FROM c
ORDER BY department_display
"""
    return sql, []


def companies():
    """The legal entities in the ledger, for the Company filter.

    company_name is the raw value AND the label -- unlike department it
    carries no numeric prefix to strip and no collision to guard against.
    """
    sql = f"""
SELECT
  company_name,
  COUNT(*) AS gl_rows,
  MIN(transaction_date) AS min_date,
  MAX(transaction_date) AS max_date
FROM `{GL}`
WHERE company_name IS NOT NULL AND TRIM(company_name) != ''
GROUP BY company_name
ORDER BY company_name
"""
    return sql, []


def by_property_totals(start: date, end: date):
    """
    Section totals for EVERY property in one query.

    Previously the by-property view ran one statement query per department --
    21 sequential BigQuery round-trips, ~118 seconds, which exceeded the
    frontend proxy's timeout. One GROUP BY does the same work in a single
    query. Rows with no department are excluded here because they belong to
    no property; they remain in the consolidated statement.
    """
    sql = f"""{CLASSIFIED}
SELECT
  department,
  pnl_section,
  ROUND(SUM(amount), 2) AS amount
FROM classified
WHERE section_order <= 5
  AND date BETWEEN @start_date AND @end_date
  AND department IS NOT NULL
  AND TRIM(department) != ''
GROUP BY department, pnl_section
"""
    return sql, [
        param("start_date", "DATE", start),
        param("end_date", "DATE", end),
        param("strip_codes", "BOOL", True),
    ]


def date_bounds():
    sql = f"""
SELECT MIN(transaction_date) AS min_date,
       MAX(transaction_date) AS max_date,
       COUNT(*) AS row_count
FROM `{GL}`
"""
    return sql, []


def unmatched():
    """Ledger rows carrying no Section at all.

    Balance-sheet accounts are NOT listed here -- they are classified fine
    and drop out of the P&L on their Section, which is correct. Anything that
    does appear has no statement structure on it whatsoever, so it belongs to
    no statement and its amount is silently absent. That is the condition
    worth alerting on.
    """
    sql = f"""{CLASSIFIED}
SELECT
  company_name,
  account_name,
  -- `rows` is a reserved keyword in BigQuery; do not use it as an alias.
  COUNT(*) AS row_count,
  ROUND(SUM(amount), 2) AS amount
FROM classified
WHERE is_unmatched
GROUP BY company_name, account_name
-- ABS(amount) references the SELECT alias, which is already aggregated.
-- ABS(SUM(amount)) here would be an aggregation of an aggregation.
ORDER BY ABS(amount) DESC
LIMIT 200
"""
    return sql, [param("strip_codes", "BOOL", True)]


def ledger_balance():
    """SUM(amount) across EVERY account -- P&L and balance sheet together --
    must be exactly 0, because debits equal credits. Still the strongest
    available check: it verifies the source table is internally consistent
    and that no filter has quietly dropped rows."""
    sql = f"""{CLASSIFIED}
SELECT ROUND(SUM(amount), 2) AS should_be_zero, COUNT(*) AS row_count
FROM classified
"""
    return sql, [param("strip_codes", "BOOL", True)]


# ---------------------------------------------------------------------------
# Balance sheet
# ---------------------------------------------------------------------------

def balance_sheet(as_of: date, department: str | None = None,
                  company: str | None = None):
    """Ledger-level balance sheet as at a date.

    A balance sheet is a POSITION, not a period: every row from the start of
    the ledger up to `as_of` counts, so there is no start date. Passing one
    would silently produce a movement statement that happens to look like a
    balance sheet.
    """
    clause = "WHERE bs_order <= 5 AND date <= @as_of"
    if company:
        clause += " AND company_name = @company"
    if department:
        clause += " AND department = @department"
    sql = f"""{CLASSIFIED},
bs AS (
  SELECT
    classified.*,
    CASE section_label
    {_BS_SECTION_CASE}
    ELSE NULL END AS bs_section,
    CASE section_label
    {_BS_ORDER_CASE}
    ELSE 99 END AS bs_order
  FROM classified
  WHERE statement_label = 'Balance Sheet'
)
SELECT * FROM (
  SELECT
    bs_order,
    bs_section,
    ledger_id,
    ledger_name,
    ROUND(SUM(amount), 2) AS amount,
    COUNT(*) AS txn_count,
    COUNT(DISTINCT account_name) AS account_count
  FROM bs
  {clause}
  GROUP BY bs_order, bs_section, ledger_id, ledger_name
)
WHERE amount != 0
ORDER BY bs_order, ledger_id, ledger_name
"""
    params = [param("as_of", "DATE", as_of), param("strip_codes", "BOOL", True)]
    if company:
        params.append(param("company", "STRING", company))
    if department:
        params.append(param("department", "STRING", department))
    return sql, params


def retained_earnings(as_of: date, department: str | None = None,
                      company: str | None = None):
    """The two earnings lines that make the balance sheet balance.

    `net_income` is the P&L on exactly the same basis as the P&L tab, so the
    two screens agree to the cent.

    `unclassified` is the remainder: rows the ledger marks Profit & Loss but
    that the P&L gates out because their account was deleted in QuickBooks.
    They still have balance-sheet counterparts, so omitting them would leave
    the sheet out of balance by that amount. Shown as its own line rather
    than folded into net income, so neither figure is quietly wrong.
    """
    clause = "WHERE date <= @as_of"
    if company:
        clause += " AND company_name = @company"
    if department:
        clause += " AND department = @department"
    sql = f"""{CLASSIFIED}
SELECT
  ROUND(SUM(IF(section_order <= 5, amount, 0)), 2) AS net_income,
  ROUND(SUM(IF(statement_label = 'Profit & Loss' AND section_order > 5,
               amount, 0)), 2) AS unclassified
FROM classified
{clause}
"""
    params = [param("as_of", "DATE", as_of), param("strip_codes", "BOOL", True)]
    if company:
        params.append(param("company", "STRING", company))
    if department:
        params.append(param("department", "STRING", department))
    return sql, params


# ---------------------------------------------------------------------------
# Ledger entries
# ---------------------------------------------------------------------------

def _entries_filter(start: date, end: date, department: str | None,
                    statement: str | None, search: str | None,
                    company: str | None = None,
                    ledger_name: str | None = None,
                    pnl_only: bool = False):
    """WHERE clause + params shared by the entries list and its summary, so
    the count can never describe a different filter than the rows.

    `pnl_only` applies the SAME `section_order <= 5` gate the P&L statement
    uses. Without it, drilling into a ledger would also return rows from
    accounts deleted in QuickBooks, and the total under the list would not
    equal the figure on the statement it was reached from -- which is the
    one thing a drill-down has to get right.
    """
    clause = "WHERE date BETWEEN @start_date AND @end_date"
    params = [
        param("start_date", "DATE", start),
        param("end_date", "DATE", end),
        param("strip_codes", "BOOL", True),
    ]
    if company:
        clause += " AND company_name = @company"
        params.append(param("company", "STRING", company))
    if department:
        clause += " AND department = @department"
        params.append(param("department", "STRING", department))
    if statement:
        clause += " AND statement_label = @statement"
        params.append(param("statement", "STRING", statement))
    if ledger_name:
        clause += " AND ledger_name = @ledger_name"
        params.append(param("ledger_name", "STRING", ledger_name))
    if pnl_only:
        clause += " AND section_order <= 5"
    if search:
        # One parameter matched against the columns someone would actually
        # search by. LOWER on both sides keeps it case-insensitive.
        clause += """
  AND (LOWER(account_name) LIKE @search
    OR LOWER(COALESCE(ledger_name, '')) LIKE @search
    OR LOWER(COALESCE(counterparty, '')) LIKE @search
    OR LOWER(COALESCE(description, '')) LIKE @search
    OR LOWER(COALESCE(document_number, '')) LIKE @search)"""
        params.append(param("search", "STRING", f"%{search.lower()}%"))
    return clause, params


def ledger_entries(start: date, end: date, department: str | None = None,
                   statement: str | None = None, search: str | None = None,
                   limit: int = 200, offset: int = 0,
                   company: str | None = None,
                   ledger_name: str | None = None,
                   pnl_only: bool = False):
    """Raw GL lines, newest first, with their statement placement attached."""
    clause, params = _entries_filter(start, end, department, statement,
                                    search, company, ledger_name, pnl_only)
    sql = f"""{CLASSIFIED}
SELECT
  date,
  company_name,
  display_name AS account,
  account_name,
  statement_label,
  section_label,
  ledger_name,
  transaction_type,
  document_number,
  counterparty,
  description,
  split_account,
  department,
  amount
FROM classified
{clause}
ORDER BY date DESC, account_name
LIMIT @row_limit OFFSET @row_offset
"""
    params = params + [
        param("row_limit", "INT64", limit),
        param("row_offset", "INT64", offset),
    ]
    return sql, params


def ledger_entries_summary(start: date, end: date,
                           department: str | None = None,
                           statement: str | None = None,
                           search: str | None = None,
                           company: str | None = None,
                           ledger_name: str | None = None,
                           pnl_only: bool = False):
    """Row count and net amount across the WHOLE filter, so the table can say
    what the full result set looks like and not just the page on screen."""
    clause, params = _entries_filter(start, end, department, statement,
                                    search, company, ledger_name, pnl_only)
    sql = f"""{CLASSIFIED}
SELECT COUNT(*) AS row_count, ROUND(SUM(amount), 2) AS net_amount
FROM classified
{clause}
"""
    return sql, params
