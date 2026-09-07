"""
Verification script: compares the live Vercel API against raw BigQuery SQL.
"""
import json
import urllib.request
from google.oauth2 import service_account
from google.cloud import bigquery

API = "https://profitandloss-two.vercel.app"
DS = "nodal-plexus-492111-e9.warehouse_llc"
START, END = "2026-01-01", "2026-12-31"

key_path = r"c:\Profit_And_Loss-main\backend\nodal-plexus-492111-e9-f592a6f55953.json"
with open(key_path) as f:
    info = json.load(f)

creds = service_account.Credentials.from_service_account_info(
    info,
    scopes=["https://www.googleapis.com/auth/bigquery", "https://www.googleapis.com/auth/cloud-platform"],
)
client = bigquery.Client(project="nodal-plexus-492111-e9", credentials=creds)

def get(path):
    req = urllib.request.Request(f"{API}{path}", headers={"User-Agent": "TestRunner"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())

print("=" * 65)
print("1. SYSTEM & METADATA VERIFICATION")
print("=" * 65)

health = get("/api/meta/health")
print(f"Health check:      Project: {health.get('project')} | Dataset: {health.get('dataset')}")

date_info = get("/api/meta/date-range")
print(f"Total GL Rows:     {date_info.get('row_count'):,} rows")
print(f"Date Coverage:     {date_info.get('min_date')} to {date_info.get('max_date')}")

unmatched = get("/api/meta/unmatched")
print(f"Unmatched ACCTs:   {'PASS (Clean - 0 unmatched)' if unmatched.get('clean') else 'FAIL'}")

bal = get("/api/meta/ledger-balance")
print(f"Ledger Balance:    {'PASS (Balanced to zero)' if bal.get('balanced') else 'FAIL'}")
print(f"Debit-Credit Diff: ${float(bal.get('should_be_zero') or 0):,.2f}")

print("\n" + "=" * 65)
print("2. FINANCIAL VALUES AUDIT (2026 FULL YEAR)")
print("=" * 65)

# Fetch from live Vercel API
api_pnl = get(f"/api/pnl/statement?start_date={START}&end_date={END}")["current"]
kpis = api_pnl["kpis"]

# Query raw BigQuery independently
sql = f"""
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
raw_bq = {row["account_type"]: float(row["amount"]) for row in client.query(sql).result()}

checks = [
    ("Revenue / Income", kpis["revenue"], raw_bq.get("Income", 0.0)),
    ("Cost of Goods Sold", abs(api_pnl["sections"][1]["total"]), abs(raw_bq.get("Cost of Goods Sold", 0.0))),
    ("Operating Expenses", kpis["operating_expenses"], abs(raw_bq.get("Expense", 0.0))),
    ("Other Income", api_pnl["sections"][3]["total"], raw_bq.get("Other Income", 0.0)),
    ("Net Income", kpis["net_income"], (raw_bq.get("Income", 0.0) + raw_bq.get("Other Income", 0.0) + raw_bq.get("Expense", 0.0) + raw_bq.get("Cost of Goods Sold", 0.0))),
]

print(f"{'Line Item':<22} | {'Live Vercel Site':>18} | {'Raw BigQuery SQL':>18} | Status")
print("-" * 65)
for label, api_val, bq_val in checks:
    diff = abs((api_val or 0) - (bq_val or 0))
    match = diff < 0.02
    status = "PASS" if match else "FAIL"
    print(f"{label:<22} | ${api_val:>16,.2f} | ${bq_val:>16,.2f} | {status}")

print("=" * 65)
