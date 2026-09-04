"""Why is the ledger out of balance? Source data, or the join?"""

from google.cloud import bigquery

client = bigquery.Client(project="spherical-entry-506811-j2")
DS = "spherical-entry-506811-j2.qbo_api"


def q(sql):
    return list(client.query(sql).result())


def money(x):
    return f"{float(x or 0):>16,.2f}"


print("=" * 74)
print("1. IS THE SOURCE ITSELF BALANCED?  (no join at all)")
print("=" * 74)
r = q(f"""
SELECT
  COUNT(*) AS row_count,
  ROUND(SUM(COALESCE(SAFE_CAST(debit  AS NUMERIC), 0)), 2) AS total_debits,
  ROUND(SUM(COALESCE(SAFE_CAST(credit AS NUMERIC), 0)), 2) AS total_credits,
  ROUND(SUM(COALESCE(SAFE_CAST(debit  AS NUMERIC), 0))
      - SUM(COALESCE(SAFE_CAST(credit AS NUMERIC), 0)), 2) AS should_be_zero
FROM `{DS}.general_ledger`
""")[0]
print(f"  rows          {r['row_count']:>16,}")
print(f"  total debits  {money(r['total_debits'])}")
print(f"  total credits {money(r['total_credits'])}")
print(f"  difference    {money(r['should_be_zero'])}   <-- must be 0.00")
source_ok = abs(float(r["should_be_zero"] or 0)) < 0.01
print(f"\n  SOURCE {'BALANCES' if source_ok else 'DOES NOT BALANCE'}")

print("\n" + "=" * 74)
print("2. DOES THE JOIN CHANGE THE ROW COUNT?  (fan-out check)")
print("=" * 74)
r2 = q(f"""
SELECT
  (SELECT COUNT(*) FROM `{DS}.general_ledger`) AS raw_rows,
  (SELECT COUNT(*)
     FROM `{DS}.general_ledger` gl
     LEFT JOIN `{DS}.chart_of_accounts` coa
       ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
  ) AS joined_rows
""")[0]
print(f"  raw rows      {r2['raw_rows']:>16,}")
print(f"  joined rows   {r2['joined_rows']:>16,}")
fanout = r2["joined_rows"] - r2["raw_rows"]
print(f"  difference    {fanout:>16,}   <-- must be 0")

print("\n" + "=" * 74)
print("3. DUPLICATE ACCOUNT NAMES IN THE CHART OF ACCOUNTS?")
print("=" * 74)
dups = q(f"""
SELECT LOWER(TRIM(name)) AS name_key, COUNT(*) AS n,
       STRING_AGG(DISTINCT account_type, ' | ') AS types
FROM `{DS}.chart_of_accounts`
GROUP BY name_key
HAVING COUNT(*) > 1
ORDER BY n DESC
""")
if not dups:
    print("  none")
else:
    for d in dups:
        print(f"  {d['name_key']:<45} x{d['n']}   {d['types']}")

print("\n" + "=" * 74)
print("4. BALANCE BY YEAR  (which years are out?)")
print("=" * 74)
years = q(f"""
SELECT
  EXTRACT(YEAR FROM date) AS yr,
  COUNT(*) AS row_count,
  ROUND(SUM(COALESCE(SAFE_CAST(debit  AS NUMERIC), 0))
      - SUM(COALESCE(SAFE_CAST(credit AS NUMERIC), 0)), 2) AS diff
FROM `{DS}.general_ledger`
GROUP BY yr
ORDER BY yr
""")
print(f"  {'year':<8}{'rows':>10}{'debits - credits':>20}")
for y in years:
    flag = "" if abs(float(y["diff"] or 0)) < 0.01 else "   <-- OUT"
    print(f"  {y['yr']:<8}{y['row_count']:>10,}{money(y['diff'])}{flag}")

print("\n" + "=" * 74)
print("5. THE UNMATCHED ACCOUNT")
print("=" * 74)
um = q(f"""
SELECT gl.account_name, gl.account_id, COUNT(*) AS row_count,
       ROUND(SUM(COALESCE(SAFE_CAST(gl.debit AS NUMERIC), 0)), 2) AS dr,
       ROUND(SUM(COALESCE(SAFE_CAST(gl.credit AS NUMERIC), 0)), 2) AS cr
FROM `{DS}.general_ledger` gl
LEFT JOIN `{DS}.chart_of_accounts` coa
  ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
WHERE coa.name IS NULL
GROUP BY 1, 2
ORDER BY row_count DESC
""")
for u in um:
    print(f"  {u['account_name']!r}  id={u['account_id']}  rows={u['row_count']}"
          f"  dr={money(u['dr'])} cr={money(u['cr'])}")

print("\n" + "=" * 74)
print("6. ROWS WITH NO DATE  (would fall outside every period filter)")
print("=" * 74)
nd = q(f"""
SELECT COUNT(*) AS n,
       ROUND(SUM(COALESCE(SAFE_CAST(debit AS NUMERIC), 0))
           - SUM(COALESCE(SAFE_CAST(credit AS NUMERIC), 0)), 2) AS diff
FROM `{DS}.general_ledger`
WHERE date IS NULL
""")[0]
print(f"  rows with NULL date: {nd['n']:,}   net {money(nd['diff'])}")
