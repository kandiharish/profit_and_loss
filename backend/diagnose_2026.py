"""Pinpoint where the 2026 imbalance sits. 2018-2025 all balance exactly."""

from google.cloud import bigquery

c = bigquery.Client(project="spherical-entry-506811-j2")
GL = "`spherical-entry-506811-j2.qbo_api.general_ledger`"

DIFF = ("ROUND(SUM(COALESCE(SAFE_CAST(debit AS NUMERIC),0))"
        " - SUM(COALESCE(SAFE_CAST(credit AS NUMERIC),0)), 2)")


def m(x):
    return f"{float(x or 0):>16,.2f}"


def section(title, sql, label_key, width=44):
    print("\n" + "=" * 74)
    print(title)
    print("=" * 74)
    for r in c.query(sql).result():
        flag = "" if abs(float(r["diff"] or 0)) < 0.01 else "   <-- OUT"
        print(f"  {str(r[label_key])[:width]:<{width + 2}} "
              f"rows {r['n']:>6,}  {m(r['diff'])}{flag}")


section(
    "2026 IMBALANCE BY MONTH",
    f"""SELECT FORMAT_DATE('%Y-%m', date) AS mo, COUNT(*) AS n, {DIFF} AS diff
        FROM {GL} WHERE EXTRACT(YEAR FROM date) = 2026
        GROUP BY mo ORDER BY mo""",
    "mo", 10,
)

section(
    "2026 IMBALANCE BY TRANSACTION TYPE (only unbalanced)",
    f"""SELECT transaction_type, COUNT(*) AS n, {DIFF} AS diff
        FROM {GL} WHERE EXTRACT(YEAR FROM date) = 2026
        GROUP BY transaction_type
        HAVING ABS({DIFF}) > 0.01
        ORDER BY ABS({DIFF}) DESC LIMIT 15""",
    "transaction_type", 32,
)

section(
    "2026 IMBALANCE BY ACCOUNT (top 15)",
    f"""SELECT account_name, COUNT(*) AS n, {DIFF} AS diff
        FROM {GL} WHERE EXTRACT(YEAR FROM date) = 2026
        GROUP BY account_name
        HAVING ABS({DIFF}) > 0.01
        ORDER BY ABS({DIFF}) DESC LIMIT 15""",
    "account_name", 44,
)

# Rows where BOTH debit and credit are empty carry no amount at all -- a
# common symptom of a partially-written extract.
print("\n" + "=" * 74)
print("2026 ROWS WITH NEITHER DEBIT NOR CREDIT")
print("=" * 74)
r = list(c.query(f"""
SELECT COUNT(*) AS n
FROM {GL}
WHERE EXTRACT(YEAR FROM date) = 2026
  AND COALESCE(SAFE_CAST(debit AS NUMERIC), 0) = 0
  AND COALESCE(SAFE_CAST(credit AS NUMERIC), 0) = 0
""").result())[0]
print(f"  {r['n']:,} rows")

# Is 2026 simply still being written? Compare row counts per month.
print("\n" + "=" * 74)
print("SANITY: ROWS PER YEAR")
print("=" * 74)
for r in c.query(f"""
SELECT EXTRACT(YEAR FROM date) AS yr, COUNT(*) AS n,
       MIN(date) AS first_txn, MAX(date) AS last_txn
FROM {GL} GROUP BY yr ORDER BY yr
""").result():
    print(f"  {r['yr']}  rows {r['n']:>6,}   {r['first_txn']} .. {r['last_txn']}")
