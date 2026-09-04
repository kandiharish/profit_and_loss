"""
Live end-to-end test against the real BigQuery data.

Cross-checks the API's P&L against INDEPENDENT raw SQL run directly on
BigQuery, so a bug in the API's own query logic cannot mask itself.

Run:  .venv\\Scripts\\python.exe test_live.py
"""

import json
import urllib.request

from google.cloud import bigquery

API = "http://127.0.0.1:8000"
DS = "spherical-entry-506811-j2.qbo_api"
START, END = "2026-01-01", "2026-12-31"

client = bigquery.Client(project="spherical-entry-506811-j2")
FAILURES = []


def get(path):
    with urllib.request.urlopen(f"{API}{path}", timeout=120) as r:
        return json.loads(r.read())


def check(label, actual, expected, tol=0.01):
    if isinstance(actual, float) or isinstance(expected, float):
        ok = abs((actual or 0) - (expected or 0)) <= tol
    else:
        ok = actual == expected
    print(f"{'PASS' if ok else 'FAIL'}  {label}")
    if not ok:
        print(f"        api={actual!r}  bigquery={expected!r}")
        FAILURES.append(label)


def money(x):
    return f"{x:>15,.2f}"


# ---------------------------------------------------------------------------
# Independent SQL -- deliberately written from scratch, not reusing the app's
# query builder, so the two can genuinely disagree.
# ---------------------------------------------------------------------------
RAW = f"""
SELECT
  coa.account_type,
  ROUND(SUM(COALESCE(SAFE_CAST(gl.credit AS NUMERIC), 0)
          - COALESCE(SAFE_CAST(gl.debit  AS NUMERIC), 0)), 2) AS amount
FROM `{DS}.general_ledger` gl
LEFT JOIN `{DS}.chart_of_accounts` coa
  ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
WHERE gl.date BETWEEN DATE '{START}' AND DATE '{END}'
GROUP BY coa.account_type
"""

# ---------------------------------------------------------------------------
# 0. INTEGRITY FIRST.
#
# Every other figure is meaningless if the ledger does not balance, so this
# is asserted before anything else. A suite that reports "all pass" on
# unbalanced source data is worse than no suite at all.
# ---------------------------------------------------------------------------
print("=" * 70)
print("LEDGER INTEGRITY")
print("=" * 70)

bal = get("/api/meta/ledger-balance")
print(f"  rows                 {bal['row_count']:>16,}")
print(f"  SUM(amount)          {money(bal['should_be_zero'])}   <-- must be 0.00")
check("Ledger balances (debits == credits)", bal["balanced"], True)

um = get("/api/meta/unmatched")
print(f"  unmatched accounts   {len(um['unmatched_accounts']):>16}")
for u in um["unmatched_accounts"]:
    print(f"      {u['account_name']!r}  rows={u['row_count']}  "
          f"amount={u['amount']:,.2f}")
check("No unmatched account carries a non-zero amount",
      [u for u in um["unmatched_accounts"] if abs(u["amount"] or 0) > 0.01], [])

print("\n" + "=" * 70)
print("INDEPENDENT BIGQUERY TOTALS BY ACCOUNT TYPE")
print("=" * 70)
raw = {r["account_type"]: float(r["amount"]) for r in client.query(RAW).result()}
for k in sorted(raw, key=lambda x: (x is None, x)):
    print(f"  {str(k):<28}{money(raw[k])}")

bq_revenue = raw.get("Income", 0.0)
bq_cogs = raw.get("Cost of Goods Sold", 0.0)
bq_opex = raw.get("Expense", 0.0)
bq_oi = raw.get("Other Income", 0.0)
bq_oe = raw.get("Other Expense", 0.0)
bq_gross = round(bq_revenue + bq_cogs, 2)
bq_opinc = round(bq_gross + bq_opex, 2)
bq_net = round(bq_opinc + bq_oi + bq_oe, 2)

print("\n  Derived from the above:")
print(f"    Gross Profit        {money(bq_gross)}")
print(f"    Net Operating Inc.  {money(bq_opinc)}")
print(f"    Net Income          {money(bq_net)}")

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("API vs BIGQUERY")
print("=" * 70)

resp = get(f"/api/pnl/statement?start_date={START}&end_date={END}")
cur = resp["current"]
sec = {s["key"]: s["total"] for s in cur["sections"]}
sub = {s["key"]: s["amount"] for s in cur["subtotals"]}

check("Revenue", sec["revenue"], bq_revenue)
check("Cost of Goods Sold", sec["cogs"], bq_cogs)
check("Operating Expenses", sec["opex"], bq_opex)
check("Other Income", sec["other_income"], bq_oi)
check("Other Expense", sec["other_expense"], bq_oe)
check("Gross Profit", sub["gross_profit"], bq_gross)
check("Net Operating Income", sub["operating_income"], bq_opinc)
check("Net Income", sub["net_income"], bq_net)

# Internal consistency: Net Income must equal the sum of the five sections.
check("Net Income == sum(sections)", sub["net_income"], round(sum(sec.values()), 2))

print("\n  P&L as returned by the API:")
for s in cur["sections"]:
    print(f"    {s['label']:<24}{money(s['total'])}   ({len(s['accounts'])} accounts)")
for s in cur["subtotals"]:
    print(f"    {s['label']:<24}{money(s['amount'])}")

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("GL CODES AND SUB-TYPE MUST NOT APPEAR")
print("=" * 70)

import re
CODE = re.compile(r"^[0-9]+(-[0-9]+)*\s")

leaked_codes, all_names = [], []
for s in cur["sections"]:
    for a in s["accounts"]:
        all_names.append(a["display_name"])
        if CODE.match(a["display_name"]):
            leaked_codes.append(a["display_name"])

check("No GL code in any display_name", leaked_codes, [])

blob = json.dumps(resp)
check("No 'sub_type' key in statement response", "sub_type" in blob, False)
check("No 'account_sub_type' key in response", "account_sub_type" in blob, False)

print(f"\n  Sample of {len(all_names)} account names as displayed:")
for n in all_names[:12]:
    print(f"    - {n}")

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("DATE FILTER")
print("=" * 70)

h1 = get(f"/api/pnl/statement?start_date={START}&end_date=2026-06-30")
h2 = get("/api/pnl/statement?start_date=2026-07-01&end_date=2026-12-31")
h1_net = [s["amount"] for s in h1["current"]["subtotals"] if s["key"] == "net_income"][0]
h2_net = [s["amount"] for s in h2["current"]["subtotals"] if s["key"] == "net_income"][0]

print(f"  Jan-Jun net income {money(h1_net)}")
print(f"  Jul-Dec net income {money(h2_net)}")
check("Halves sum to full year", round(h1_net + h2_net, 2), sub["net_income"])

empty = get("/api/pnl/statement?start_date=1990-01-01&end_date=1990-12-31")
empty_net = [s["amount"] for s in empty["current"]["subtotals"]
             if s["key"] == "net_income"][0]
check("Empty period returns zero, not an error", empty_net, 0.0)

# --- D: the period must reach back to January 2018 ----------------------
# This previously failed with 400 "Range too wide" -- the API capped ranges
# at 5 years, so 2018->2026 was rejected outright.
long_range = get("/api/pnl/statement?start_date=2018-01-01&end_date=2026-12-31")
lr_net = [s["amount"] for s in long_range["current"]["subtotals"]
          if s["key"] == "net_income"][0]
lr_rev = [s["total"] for s in long_range["current"]["sections"]
          if s["key"] == "revenue"][0]
check("2018-01-01 -> 2026-12-31 accepted (not 400)", True, True)

# Superset property: 2018-2026 must contain at least as much revenue as 2026
# alone. (The earlier assertion here required them to be EQUAL, which was
# only true while 2026 was the sole year loaded. Now that 2018-2025 exists
# that expectation is stale -- this is the durable version.)
cur_rev = [s["total"] for s in cur["sections"] if s["key"] == "revenue"][0]
check("2018-2026 revenue >= 2026 revenue (superset holds)",
      lr_rev >= cur_rev - 0.01, True)

# Additivity: the sum of each year must equal the whole range. This catches
# a date filter that drops or double-counts a boundary day.
year_sum = 0.0
print("\n  Revenue by year:")
for yr in range(2018, 2027):
    y = get(f"/api/pnl/statement?start_date={yr}-01-01&end_date={yr}-12-31")
    yrev = [s["total"] for s in y["current"]["sections"]
            if s["key"] == "revenue"][0]
    year_sum += yrev
    print(f"    {yr}  {money(yrev)}")
check("Years 2018..2026 sum to the full-range revenue",
      round(year_sum, 2), round(lr_rev, 2), tol=0.05)

# And with a prior-year comparison on top, which doubles the span queried.
lr_cmp = get("/api/pnl/statement?start_date=2018-01-01&end_date=2026-12-31"
             "&compare_to=prior_year")
check("2018 range with prior_year comparison accepted",
      lr_cmp["comparison"] is not None, True)

bounds = get("/api/meta/date-range")
print(f"  Ledger actually loaded: {bounds['min_date']} to {bounds['max_date']} "
      f"({bounds['row_count']} rows)")

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("PROPERTY FILTER")
print("=" * 70)

dept_rows = get("/api/meta/departments")["departments"]
depts = [d["department"] for d in dept_rows]
print(f"  {len(depts)} properties")

# --- Display names ------------------------------------------------------
print("\n  Raw department -> displayed label:")
for d in dept_rows:
    flag = "  <- disambiguated" if d["disambiguated"] else ""
    print(f"    {d['department']:<40} {d['department_display']}{flag}")

by_raw = {d["department"]: d["department_display"] for d in dept_rows}

check("'1650 Sherman' displays as 'Sherman (1650)'",
      by_raw.get("1650 Sherman"), "Sherman (1650)")
check("'850 Sherman' displays as 'Sherman (850)'",
      by_raw.get("850 Sherman"), "Sherman (850)")
check("'1650 Sherman Avenue Associates LLC' displays stripped",
      by_raw.get("1650 Sherman Avenue Associates LLC"),
      "Sherman Avenue Associates LLC")
check("'600 Jersey Ave' displays as 'Jersey Ave'",
      by_raw.get("600 Jersey Ave"), "Jersey Ave")

labels = list(by_raw.values())
check("Every property has a unique label", len(set(labels)), len(labels))

CODE_PREFIX = re.compile(r"^[0-9]+\s")
still_prefixed = [l for l in labels if CODE_PREFIX.match(l)]
check("No label still begins with a numeric prefix", still_prefixed, [])

# The amounts of the two Sherman entities must remain completely separate.
sherman = {}
for raw in ("1650 Sherman", "850 Sherman"):
    r = get(f"/api/pnl/statement?start_date={START}&end_date={END}"
            f"&department={urllib.parse.quote(raw)}")
    sherman[raw] = [s["amount"] for s in r["current"]["subtotals"]
                    if s["key"] == "net_income"][0]
print(f"\n  Sherman (1650) net income {money(sherman['1650 Sherman'])}")
print(f"  Sherman (850)  net income {money(sherman['850 Sherman'])}")
check("The two Sherman entities have separate amounts",
      sherman["1650 Sherman"] != sherman["850 Sherman"], True)

RAW_SHERMAN = f"""
SELECT gl.department,
       ROUND(SUM(COALESCE(SAFE_CAST(gl.credit AS NUMERIC), 0)
               - COALESCE(SAFE_CAST(gl.debit AS NUMERIC), 0)), 2) AS amount
FROM `{DS}.general_ledger` gl
JOIN `{DS}.chart_of_accounts` coa
  ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
WHERE gl.date BETWEEN DATE '{START}' AND DATE '{END}'
  AND gl.department IN ('1650 Sherman', '850 Sherman')
  AND coa.account_type IN ('Income','Cost of Goods Sold','Expense',
                           'Other Income','Other Expense')
GROUP BY gl.department
"""
raw_sh = {r["department"]: float(r["amount"] or 0)
          for r in client.query(RAW_SHERMAN).result()}
for raw in ("1650 Sherman", "850 Sherman"):
    check(f"'{raw}' matches direct SQL", sherman[raw], raw_sh.get(raw, 0.0))

target = "600 Jersey Ave"
filtered = get(f"/api/pnl/statement?start_date={START}&end_date={END}&department={urllib.parse.quote(target)}")
f_net = [s["amount"] for s in filtered["current"]["subtotals"]
         if s["key"] == "net_income"][0]

RAW_DEPT = f"""
SELECT ROUND(SUM(COALESCE(SAFE_CAST(gl.credit AS NUMERIC), 0)
                - COALESCE(SAFE_CAST(gl.debit AS NUMERIC), 0)), 2) AS amount
FROM `{DS}.general_ledger` gl
JOIN `{DS}.chart_of_accounts` coa
  ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
WHERE gl.date BETWEEN DATE '{START}' AND DATE '{END}'
  AND gl.department = @dept
  AND coa.account_type IN ('Income','Cost of Goods Sold','Expense',
                           'Other Income','Other Expense')
"""
job = client.query(RAW_DEPT, job_config=bigquery.QueryJobConfig(
    query_parameters=[bigquery.ScalarQueryParameter("dept", "STRING", target)]))
bq_dept_net = float(list(job.result())[0]["amount"] or 0)
check(f"Property '{target}' net income", f_net, bq_dept_net)

# Do the per-property totals reconcile to the consolidated total?
RAW_NULL_DEPT = f"""
SELECT COUNT(*) AS n
FROM `{DS}.general_ledger` gl
JOIN `{DS}.chart_of_accounts` coa
  ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
WHERE gl.date BETWEEN DATE '{START}' AND DATE '{END}'
  AND (gl.department IS NULL OR TRIM(gl.department) = '')
  AND coa.account_type IN ('Income','Cost of Goods Sold','Expense',
                           'Other Income','Other Expense')
"""
orphans = int(list(client.query(RAW_NULL_DEPT).result())[0]["n"])
print(f"  P&L rows with NO department: {orphans}")

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("COMPARISON")
print("=" * 70)

comp = get(f"/api/pnl/statement?start_date={START}&end_date={END}&compare_to=prior_year")
check("Comparison block present", comp["comparison"] is not None, True)
if comp["comparison"]:
    print(f"  basis  : {comp['comparison']['basis']}")
    c_net = [s["amount"] for s in comp["comparison"]["subtotals"]
             if s["key"] == "net_income"][0]
    print(f"  2025 net income {money(c_net)}")
    print(f"  2026 net income {money(sub['net_income'])}")
    # Now that 2018-2025 is loaded, prior-year comparison must return real
    # figures rather than the 0.00 it showed when only 2026 existed.
    check("Prior-year comparison returns non-zero (history now loaded)",
          abs(c_net) > 0.01, True)

pp = get(f"/api/pnl/statement?start_date=2026-07-01&end_date=2026-12-31&compare_to=prior_period")
check("prior_period comparison present", pp["comparison"] is not None, True)

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("DRILL-DOWN")
print("=" * 70)

biggest = None
for s in cur["sections"]:
    for a in s["accounts"]:
        if biggest is None or abs(a["amount"]) > abs(biggest["amount"]):
            biggest = a

print(f"  Account : {biggest['display_name']}")
print(f"  Raw key : {biggest['account_name']}")
print(f"  Total   : {money(biggest['amount'])}  over {biggest['txn_count']} txns")

dd = get(f"/api/pnl/drilldown?start_date={START}&end_date={END}"
         f"&account_name={urllib.parse.quote(biggest['account_name'])}")
lines = dd["lines"]
check("Drill-down returns lines", len(lines) > 0, True)
check("Drill-down line count matches txn_count", len(lines), biggest["txn_count"])
check("Drill-down sums to the statement figure",
      round(sum(l["amount"] for l in lines), 2), biggest["amount"])

blob_dd = json.dumps(dd)
check("No 'sub_type' in drill-down", "sub_type" in blob_dd, False)

print("\n  First 3 lines:")
for l in lines[:3]:
    print(f"    {l['date']}  {str(l['transaction_type'] or ''):<12} "
          f"{str(l['counterparty'] or '')[:28]:<28} {money(l['amount'])}")

# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
if FAILURES:
    print(f"{len(FAILURES)} FAILURE(S):")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("ALL LIVE TESTS PASSED")
