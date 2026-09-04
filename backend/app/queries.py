"""
SQL builders. One shared classification CTE feeds every endpoint, so the
accounting logic is defined exactly once.

Rules in force (set by the data owner):
  * Classify on account_name only. split_account is context, never a key.
  * Map general_ledger.account_name -> chart_of_accounts.name.
    account_id is NOT used: it is not populated consistently.
  * net_amount is NOT used: it is wrong for some rows. Amounts come from
    debit/credit only.
  * amount = credit - debit  (debit negative, credit positive)
"""

from datetime import date

from .bq import param
from .config import settings

DS = settings.dataset_ref

# Account types that make up the P&L, in statement order.
SECTIONS = [
    ("revenue", "Revenue", "Income", 1),
    ("cogs", "Cost of Goods Sold", "Cost of Goods Sold", 2),
    ("opex", "Operating Expenses", "Expense", 3),
    ("other_income", "Other Income", "Other Income", 4),
    ("other_expense", "Other Expense", "Other Expense", 5),
]

_SECTION_CASE = "\n    ".join(
    f"WHEN '{qbo_type}' THEN '{key}'" for key, _, qbo_type, _ in SECTIONS
)
_ORDER_CASE = "\n    ".join(
    f"WHEN '{qbo_type}' THEN {order}" for _, _, qbo_type, order in SECTIONS
)

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
    date,
    account_name,
    department,
    transaction_type,
    document_number,
    description,
    split_account,
    COALESCE(customer_name, vendor_name, employee_name, name) AS counterparty,
    -- FLOAT64 -> NUMERIC before arithmetic: floats accumulate rounding error
    -- across thousands of rows, which is unacceptable on a P&L.
    COALESCE(SAFE_CAST(credit AS NUMERIC), 0)
      - COALESCE(SAFE_CAST(debit AS NUMERIC), 0) AS amount,
    LOWER(TRIM(account_name)) AS name_key
  FROM `{DS}.general_ledger`
),
coa AS (
  SELECT
    LOWER(TRIM(name)) AS name_key,
    account_type,
    -- Explicit marker: lets us tell "no matching account" apart from
    -- "matched, but account_type happens to be NULL".
    TRUE AS matched
  FROM `{DS}.chart_of_accounts`
  WHERE name IS NOT NULL
),
classified AS (
  SELECT
    gl.* EXCEPT (name_key),
    coa.account_type,
    {_DISPLAY_NAME},
    CASE coa.account_type
    {_SECTION_CASE}
    ELSE NULL END AS pnl_section,
    CASE coa.account_type
    {_ORDER_CASE}
    ELSE 99 END AS section_order,
    coa.matched IS NULL AS is_unmatched
  FROM gl
  -- Explicit ON rather than USING: USING merges the key column, which makes
  -- qualified references to it unreliable downstream.
  LEFT JOIN coa ON gl.name_key = coa.name_key
)"""


def _period_filter(department: str | None) -> str:
    clause = "WHERE section_order <= 5 AND date BETWEEN @start_date AND @end_date"
    if department:
        clause += " AND department = @department"
    return clause


def _base_params(start: date, end: date, department: str | None,
                 strip_codes: bool) -> list:
    params = [
        param("start_date", "DATE", start),
        param("end_date", "DATE", end),
        param("strip_codes", "BOOL", strip_codes),
    ]
    if department:
        params.append(param("department", "STRING", department))
    return params


def statement(start: date, end: date, department: str | None = None,
              strip_codes: bool = True):
    """Account-level P&L. Returns both the raw account_name (for drill-down)
    and the display_name (code stripped)."""
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
    account_name,
    ANY_VALUE(display_name) AS display_name,
    ROUND(SUM(amount), 2) AS amount,
    COUNT(*) AS txn_count
  FROM classified
  {_period_filter(department)}
  GROUP BY section_order, pnl_section, account_name
)
WHERE amount != 0
ORDER BY section_order, display_name
"""
    return sql, _base_params(start, end, department, strip_codes)


def trend(start: date, end: date, department: str | None = None):
    """Monthly section totals."""
    sql = f"""{CLASSIFIED}
SELECT
  DATE_TRUNC(date, MONTH) AS period,
  pnl_section,
  ROUND(SUM(amount), 2) AS amount
FROM classified
{_period_filter(department)}
GROUP BY period, pnl_section
ORDER BY period, pnl_section
"""
    return sql, _base_params(start, end, department, True)


def drilldown(start: date, end: date, account_name: str,
              department: str | None = None, limit: int = 500):
    """Transaction lines behind one account. Keys off the RAW account_name."""
    clause = _period_filter(department) + " AND account_name = @account_name"
    sql = f"""{CLASSIFIED}
SELECT
  date,
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
    params = _base_params(start, end, department, True) + [
        param("account_name", "STRING", account_name),
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
  FROM `{DS}.general_ledger`
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
SELECT MIN(date) AS min_date, MAX(date) AS max_date, COUNT(*) AS row_count
FROM `{DS}.general_ledger`
"""
    return sql, []


def unmatched():
    """GL account names that find no match in the chart of accounts.
    Must be empty -- anything here is money missing from the P&L."""
    sql = f"""{CLASSIFIED}
SELECT
  account_name,
  -- `rows` is a reserved keyword in BigQuery; do not use it as an alias.
  COUNT(*) AS row_count,
  ROUND(SUM(amount), 2) AS amount
FROM classified
WHERE is_unmatched
GROUP BY account_name
-- ABS(amount) references the SELECT alias, which is already aggregated.
-- ABS(SUM(amount)) here would be an aggregation of an aggregation.
ORDER BY ABS(amount) DESC
LIMIT 200
"""
    return sql, [param("strip_codes", "BOOL", True)]


def ledger_balance():
    """SUM(amount) across EVERY account -- P&L and balance sheet together --
    must be exactly 0, because debits equal credits. A non-zero result means
    the join lost or duplicated rows."""
    sql = f"""{CLASSIFIED}
SELECT ROUND(SUM(amount), 2) AS should_be_zero, COUNT(*) AS row_count
FROM classified
"""
    return sql, [param("strip_codes", "BOOL", True)]
