"""
Offline tests -- no BigQuery required.

Covers the two things that are pure logic and therefore testable without
credentials: the P&L subtotal arithmetic, and the GL-code stripping rule.
Run:  .venv\\Scripts\\python.exe test_offline.py
"""

import re
import sys

from app.pnl_builder import build

FAILURES = []


def check(label, actual, expected):
    ok = actual == expected
    print(f"{'PASS' if ok else 'FAIL'}  {label}: got {actual!r}, expected {expected!r}")
    if not ok:
        FAILURES.append(label)


# ---------------------------------------------------------------------------
# 1. P&L arithmetic.
#
# Convention: amount = credit - debit, so revenue is POSITIVE and expenses
# are NEGATIVE, and every subtotal is a straight addition.
# ---------------------------------------------------------------------------
print("\n--- P&L subtotal arithmetic ---")

rows = [
    {"pnl_section": "revenue", "account_name": "6100-01 Rent - Lyons",
     "display_name": "Rent - Lyons", "amount": 80000.0, "txn_count": 12},
    {"pnl_section": "revenue", "account_name": "6700-08 Misc Income",
     "display_name": "Misc Income", "amount": 20000.0, "txn_count": 4},
    {"pnl_section": "cogs", "account_name": "5000 Materials",
     "display_name": "Materials", "amount": -20000.0, "txn_count": 6},
    {"pnl_section": "opex", "account_name": "7650 Bank Charges",
     "display_name": "Bank Charges", "amount": -50000.0, "txn_count": 30},
    {"pnl_section": "other_income", "account_name": "8000 Interest",
     "display_name": "Interest", "amount": 5000.0, "txn_count": 2},
    {"pnl_section": "other_expense", "account_name": "9000 Depreciation",
     "display_name": "Depreciation", "amount": -3000.0, "txn_count": 1},
]

r = build(rows)
sec = {s["key"]: s["total"] for s in r["sections"]}
sub = {s["key"]: s["amount"] for s in r["subtotals"]}

check("Revenue total", sec["revenue"], 100000.0)
check("COGS total", sec["cogs"], -20000.0)
check("Operating Expenses total", sec["opex"], -50000.0)
check("Other Income total", sec["other_income"], 5000.0)
check("Other Expense total", sec["other_expense"], -3000.0)

# Gross Profit = Revenue + COGS  (COGS already negative)
check("Gross Profit = Revenue + COGS", sub["gross_profit"], 80000.0)
# Net Operating Income = Gross Profit + Opex
check("Net Operating Income", sub["operating_income"], 30000.0)
# Net Income = the sum of all five sections
check("Net Income", sub["net_income"], 32000.0)
check("Net Income equals sum of sections", sub["net_income"], round(sum(sec.values()), 2))

k = r["kpis"]
check("Gross margin %", k["gross_margin_pct"], 80.0)
check("Net margin %", k["net_margin_pct"], 32.0)
check("Operating Expenses KPI shown as magnitude", k["operating_expenses"], 50000.0)

# Loss case -- net income must go negative, not flip sign somewhere.
loss = build([
    {"pnl_section": "revenue", "account_name": "a", "display_name": "a",
     "amount": 10000.0, "txn_count": 1},
    {"pnl_section": "opex", "account_name": "b", "display_name": "b",
     "amount": -25000.0, "txn_count": 1},
])
check("Loss case Net Income",
      [s["amount"] for s in loss["subtotals"] if s["key"] == "net_income"][0],
      -15000.0)

# Zero revenue must not divide by zero.
empty = build([])
check("Zero-revenue margin is None", empty["kpis"]["net_margin_pct"], None)
check("Zero-revenue net income", empty["kpis"]["net_income"], 0.0)


# ---------------------------------------------------------------------------
# 2. GL-code stripping.
#
# Mirrors the SQL regex in queries.py._DISPLAY_NAME and the client-side
# stripCode() in page.tsx. All three must agree.
# ---------------------------------------------------------------------------
print("\n--- GL code stripping ---")

STRIP = re.compile(r"^[0-9]+(-[0-9]+)*\s+(?=\S)")


def strip_code(name: str) -> str:
    return STRIP.sub("", name)


cases = [
    ("6100-01 Rent - Lyons", "Rent - Lyons"),
    ("7650 Bank Charges", "Bank Charges"),
    ("1000-02 WSFS Bank-Gamije Assoc", "WSFS Bank-Gamije Assoc"),
    ("6700-08 Misc Income", "Misc Income"),
    ("1005 WSFS Difference Offset", "WSFS Difference Offset"),
    ("3700-08 Due To 1650 Sherman Ave Assoc", "Due To 1650 Sherman Ave Assoc"),
    ("1000 Cash in Bank", "Cash in Bank"),
    # No code -- left untouched.
    ("Rent - Lyons", "Rent - Lyons"),
    # Nothing but a code -- must NOT be blanked.
    ("7650", "7650"),
    ("6100-01", "6100-01"),
    # Trailing-space-only remainder must not produce an empty string.
    ("7650   ", "7650   "),
]

for raw, expected in cases:
    check(f"strip({raw!r})", strip_code(raw), expected)


# ---------------------------------------------------------------------------
# 3. Property display names.
#
# Mirrors the SQL in queries.departments(): strip a leading numeric prefix,
# EXCEPT where two different raw departments would strip to the same label --
# then both keep their full name, because two different legal entities shown
# under one identical label is worse than showing the prefix.
#
# Exercised against the real 20 departments returned by BigQuery.
# ---------------------------------------------------------------------------
print("\n--- Property display names ---")

DEPT_PREFIX = re.compile(r"^[0-9]+\s+(?=\S)")

REAL_DEPARTMENTS = [
    "1370 Imperial Exchange LLC",
    "1370 Imperial Way LLC",
    "1650 Sherman",
    "1650 Sherman Avenue Associates LLC",
    "455 N 37th Street",
    "52 Locke Ave Exchange",
    "52 Locke Avenue Associates",
    "600 Jersey Ave",
    "701 N 36th",
    "8290 Gamije Associates, LLC",
    "8290 National Highway Associates LLC",
    "850 Sherman",
    "850 Sherman  Ave Associates LLC",
    "8501 River Rd",
    "905 Lenola Associates",
    "Diversified Trade Enterprises",
    "Gamije Associates LLC",
    "JMJ Realty, LLC",
    "JMJ Warehouse Associates LLC",
    "JMJ Warehouse Exchange LLC",
]


PREFIX_CAPTURE = re.compile(r"^([0-9]+)\s+(?=\S)")


def department_display(names: list[str]) -> dict[str, str]:
    """Mirrors queries.departments(). On collision, append the prefix in
    parentheses rather than keeping the whole original name."""
    stripped = {n: DEPT_PREFIX.sub("", n).strip() for n in names}
    uses: dict[str, int] = {}
    for s in stripped.values():
        uses[s.lower()] = uses.get(s.lower(), 0) + 1

    out = {}
    for raw, s in stripped.items():
        m = PREFIX_CAPTURE.match(raw)
        if uses[s.lower()] > 1 and m:
            out[raw] = f"{s} ({m.group(1)})"
        else:
            out[raw] = s
    return out


display = department_display(REAL_DEPARTMENTS)

# The two the user named explicitly.
check("'1650 Sherman Avenue Associates LLC' -> stripped",
      display["1650 Sherman Avenue Associates LLC"],
      "Sherman Avenue Associates LLC")

# COLLISION: both "1650 Sherman" and "850 Sherman" strip to "Sherman".
# Different entities, so the prefix is appended to tell them apart.
check("'1650 Sherman' -> Sherman (1650)",
      display["1650 Sherman"], "Sherman (1650)")
check("'850 Sherman' -> Sherman (850)",
      display["850 Sherman"], "Sherman (850)")

# Everything else strips cleanly.
check("'600 Jersey Ave'", display["600 Jersey Ave"], "Jersey Ave")
check("'905 Lenola Associates'", display["905 Lenola Associates"],
      "Lenola Associates")
check("'8501 River Rd'", display["8501 River Rd"], "River Rd")
check("'455 N 37th Street'", display["455 N 37th Street"], "N 37th Street")
check("'701 N 36th'", display["701 N 36th"], "N 36th")
check("'52 Locke Ave Exchange'", display["52 Locke Ave Exchange"],
      "Locke Ave Exchange")
check("'52 Locke Avenue Associates'", display["52 Locke Avenue Associates"],
      "Locke Avenue Associates")
check("'1370 Imperial Exchange LLC'", display["1370 Imperial Exchange LLC"],
      "Imperial Exchange LLC")
check("'1370 Imperial Way LLC'", display["1370 Imperial Way LLC"],
      "Imperial Way LLC")
check("'8290 National Highway Associates LLC'",
      display["8290 National Highway Associates LLC"],
      "National Highway Associates LLC")
check("'850 Sherman  Ave Associates LLC' (double space preserved)",
      display["850 Sherman  Ave Associates LLC"], "Sherman  Ave Associates LLC")

# "8290 Gamije Associates, LLC" -> "Gamije Associates, LLC" must NOT be
# treated as the same entity as "Gamije Associates LLC" (no comma).
check("'8290 Gamije Associates, LLC'", display["8290 Gamije Associates, LLC"],
      "Gamije Associates, LLC")
check("'Gamije Associates LLC' unchanged (no prefix)",
      display["Gamije Associates LLC"], "Gamije Associates LLC")

# No prefix -> untouched.
for n in ("Diversified Trade Enterprises", "JMJ Realty, LLC",
          "JMJ Warehouse Associates LLC", "JMJ Warehouse Exchange LLC"):
    check(f"'{n}' unchanged", display[n], n)

# Critical invariant: 20 distinct entities must yield 20 distinct labels.
check("All display labels remain unique",
      len(set(display.values())), len(REAL_DEPARTMENTS))

# And the mapping must stay 1:1 -- no two raw departments may share a label,
# which is what would silently merge two entities in a reader's mind.
check("No two entities share a label",
      len(display.values()) - len(set(display.values())), 0)


print("\n" + "=" * 60)
if FAILURES:
    print(f"{len(FAILURES)} FAILURE(S): {FAILURES}")
    sys.exit(1)
print("ALL OFFLINE TESTS PASSED")
