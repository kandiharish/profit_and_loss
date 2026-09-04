"""Verify the Next.js frontend proxies to FastAPI and returns identical data."""

import json
import urllib.request

FAILURES = []


def get(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.loads(r.read())


Q = "start_date=2026-01-01&end_date=2026-12-31"
direct = get(f"http://127.0.0.1:8000/api/pnl/statement?{Q}")
proxied = get(f"http://localhost:3000/api/pnl/statement?{Q}")

print("=" * 66)
print("FRONTEND PROXY (localhost:3000 -> 127.0.0.1:8000)")
print("=" * 66)

same = direct == proxied
print(f"{'PASS' if same else 'FAIL'}  Proxied response identical to direct")
if not same:
    FAILURES.append("proxy mismatch")

cur = proxied["current"]
print("\n  P&L rendered by the frontend's data source:")
for s in cur["sections"]:
    print(f"    {s['label']:<24}{s['total']:>16,.2f}")
for s in cur["subtotals"]:
    print(f"    {s['label']:<24}{s['amount']:>16,.2f}")

print("\n  KPI tiles:")
for k, v in cur["kpis"].items():
    print(f"    {k:<24}{v}")

# Every account name the UI will render, checked for a leaked GL code.
import re
CODE = re.compile(r"^[0-9]+(-[0-9]+)*\s")
names = [a["display_name"] for s in cur["sections"] for a in s["accounts"]]
leaked = [n for n in names if CODE.match(n)]
print(f"\n{'PASS' if not leaked else 'FAIL'}  No GL codes in {len(names)} rendered names")
if leaked:
    FAILURES.append(f"leaked codes: {leaked}")

# The drill-down key must still carry the code -- it is the join key.
raw_have_codes = sum(
    1 for s in cur["sections"] for a in s["accounts"]
    if CODE.match(a["account_name"])
)
print(f"      ({raw_have_codes} raw account_name keys retain their code, as intended)")

blob = json.dumps(proxied)
for token in ("sub_type", "account_sub_type", "subtype"):
    hit = token in blob
    print(f"{'PASS' if not hit else 'FAIL'}  '{token}' absent from payload")
    if hit:
        FAILURES.append(token)

print("\n  Full list of account names as displayed:")
for n in names:
    print(f"    - {n}")

# --- Property dropdown, through the proxy -------------------------------
print("\n" + "=" * 66)
print("PROPERTY DROPDOWN (labels the UI renders)")
print("=" * 66)

depts = get("http://localhost:3000/api/meta/departments")["departments"]
by_raw = {d["department"]: d["department_display"] for d in depts}

for want_raw, want_label in [
    ("1650 Sherman", "Sherman (1650)"),
    ("850 Sherman", "Sherman (850)"),
    ("1650 Sherman Avenue Associates LLC", "Sherman Avenue Associates LLC"),
]:
    got = by_raw.get(want_raw)
    ok = got == want_label
    print(f"{'PASS' if ok else 'FAIL'}  {want_raw!r} -> {got!r}")
    if not ok:
        FAILURES.append(want_raw)

labels = [d["department_display"] for d in depts]
uniq = len(set(labels)) == len(labels)
print(f"{'PASS' if uniq else 'FAIL'}  {len(labels)} properties, {len(set(labels))} distinct labels")
if not uniq:
    FAILURES.append("duplicate property labels")

# --- by-property carries display names ----------------------------------
print("\n" + "=" * 66)
print("BY-PROPERTY (net income per entity, worst first)")
print("=" * 66)

bp = get("http://localhost:3000/api/pnl/by-property?"
         "start_date=2026-01-01&end_date=2026-12-31")["properties"]

has_display = all("department_display" in p for p in bp)
print(f"{'PASS' if has_display else 'FAIL'}  Every row carries a display name")
if not has_display:
    FAILURES.append("by-property missing display name")

print()
total = 0.0
for p in bp:
    print(f"    {p['department_display'][:38]:<40}{p['net_income']:>15,.2f}")
    total += p["net_income"]

# Fetch the consolidated figure rather than hardcoding it -- the ledger
# contents change as history is loaded, and a baked-in number goes stale
# silently.
consolidated = [
    s["amount"]
    for s in get("http://localhost:3000/api/pnl/statement?"
                 "start_date=2026-01-01&end_date=2026-12-31")["current"]["subtotals"]
    if s["key"] == "net_income"
][0]

print(f"    {'-' * 55}")
print(f"    {'Sum of properties':<40}{total:>15,.2f}")
print(f"    {'Consolidated':<40}{consolidated:>15,.2f}")
print(f"    {'Unallocated (no property)':<40}{consolidated - total:>15,.2f}")

sh = {p["department_display"]: p["net_income"] for p in bp}
for lbl in ("Sherman (1650)", "Sherman (850)"):
    ok = lbl in sh
    print(f"\n{'PASS' if ok else 'FAIL'}  '{lbl}' present as its own row"
          + (f"  net {sh[lbl]:,.2f}" if ok else ""))
    if not ok:
        FAILURES.append(lbl)

print("\n" + "=" * 66)
if FAILURES:
    print("FAILURES:", FAILURES)
    raise SystemExit(1)
print("FRONTEND PROXY TESTS PASSED")
