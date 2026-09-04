"""
Is each individual transaction balanced?

In complete double-entry, every transaction's debits equal its credits.
`transaction_type_id` holds a per-transaction id in this extract (values
like 11429, 11632), so grouping by it tests entry completeness directly.
"""

from google.cloud import bigquery

c = bigquery.Client(project="nodal-plexus-492111-e9")
GL = "`nodal-plexus-492111-e9.warehouse_llc.general_ledger`"
DIFF = ("ROUND(SUM(COALESCE(SAFE_CAST(debit AS NUMERIC),0))"
        " - SUM(COALESCE(SAFE_CAST(credit AS NUMERIC),0)), 2)")

print("=" * 74)
print("UNBALANCED TRANSACTIONS PER YEAR")
print("=" * 74)
print(f"  {'year':<7}{'txns':>9}{'unbalanced':>13}{'%':>8}{'net gap':>18}")
for r in c.query(f"""
WITH t AS (
  SELECT EXTRACT(YEAR FROM date) AS yr,
         transaction_type_id AS txn,
         {DIFF} AS diff
  FROM {GL}
  GROUP BY yr, txn
)
SELECT yr,
       COUNT(*) AS txns,
       COUNTIF(ABS(diff) > 0.01) AS unbalanced,
       ROUND(SUM(diff), 2) AS net_gap
FROM t GROUP BY yr ORDER BY yr
""").result():
    pct = (r["unbalanced"] / r["txns"] * 100) if r["txns"] else 0
    flag = "" if r["unbalanced"] == 0 else "  <--"
    print(f"  {r['yr']:<7}{r['txns']:>9,}{r['unbalanced']:>13,}{pct:>7.1f}%"
          f"{float(r['net_gap'] or 0):>18,.2f}{flag}")

print("\n" + "=" * 74)
print("SAMPLE OF UNBALANCED 2026 TRANSACTIONS")
print("=" * 74)
for r in c.query(f"""
WITH t AS (
  SELECT transaction_type_id AS txn,
         ANY_VALUE(transaction_type) AS type,
         ANY_VALUE(document_number) AS doc,
         ANY_VALUE(date) AS dt,
         COUNT(*) AS legs,
         {DIFF} AS diff
  FROM {GL}
  WHERE EXTRACT(YEAR FROM date) = 2026
  GROUP BY txn
)
SELECT * FROM t WHERE ABS(diff) > 0.01
ORDER BY ABS(diff) DESC LIMIT 12
""").result():
    print(f"  txn {r['txn']}  {r['dt']}  {str(r['type'])[:10]:<10} "
          f"legs={r['legs']:<3} gap {float(r['diff'] or 0):>15,.2f}")

print("\n" + "=" * 74)
print("HOW MANY LEGS DO 2026 TRANSACTIONS HAVE?")
print("=" * 74)
print("  A single-leg transaction cannot balance -- it is half an entry.")
for r in c.query(f"""
WITH t AS (
  SELECT transaction_type_id AS txn, COUNT(*) AS legs
  FROM {GL} WHERE EXTRACT(YEAR FROM date) = 2026 GROUP BY txn
)
SELECT legs, COUNT(*) AS txns FROM t GROUP BY legs ORDER BY legs LIMIT 12
""").result():
    print(f"  {r['legs']} leg(s): {r['txns']:,} transactions")

print("\n  For comparison, 2024:")
for r in c.query(f"""
WITH t AS (
  SELECT transaction_type_id AS txn, COUNT(*) AS legs
  FROM {GL} WHERE EXTRACT(YEAR FROM date) = 2024 GROUP BY txn
)
SELECT legs, COUNT(*) AS txns FROM t GROUP BY legs ORDER BY legs LIMIT 12
""").result():
    print(f"  {r['legs']} leg(s): {r['txns']:,} transactions")
