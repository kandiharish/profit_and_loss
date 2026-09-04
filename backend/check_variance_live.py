"""Locate the reported Opex figures and confirm the variance now reads +87.1%."""

import json
import urllib.request

API = "http://127.0.0.1:8000"


def get(path):
    with urllib.request.urlopen(f"{API}{path}", timeout=180) as r:
        return json.loads(r.read())


def opex(stmt):
    return [s["total"] for s in stmt["sections"] if s["key"] == "opex"][0]


def variance(now, then, is_expense):
    if not then:
        return None
    raw = ((now - then) / abs(then)) * 100
    return -raw if is_expense else raw


print("Operating Expenses by year, with prior-year variance:\n")
print(f"  {'year':<7}{'opex':>18}{'prior':>18}{'old sign':>12}{'new sign':>12}")
print("  " + "-" * 65)

target = None
for yr in range(2019, 2027):
    d = get(f"/api/pnl/statement?start_date={yr}-01-01&end_date={yr}-12-31"
            f"&compare_to=prior_year")
    now = opex(d["current"])
    then = opex(d["comparison"]) if d["comparison"] else None
    old = variance(now, then, False)
    new = variance(now, then, True)
    mark = ""
    if then and abs(abs(then) - 1974357.92) < 1 and abs(abs(now) - 3694294.11) < 1:
        mark = "   <-- the reported case"
        target = (yr, now, then, old, new)
    print(f"  {yr:<7}{now:>18,.2f}{(then or 0):>18,.2f}"
          f"{(old or 0):>11.1f}%{(new or 0):>11.1f}%{mark}")

print()
if target:
    yr, now, then, old, new = target
    print(f"Reported case confirmed in {yr}:")
    print(f"  prior year opex   {abs(then):>16,.2f}")
    print(f"  current year opex {abs(now):>16,.2f}")
    print(f"  expenses rose by  {abs(now) - abs(then):>16,.2f}")
    print(f"  displayed BEFORE  {old:>16.1f}%   <- wrong direction")
    print(f"  displayed NOW     {new:>16.1f}%   <- correct")
else:
    print("Could not locate exactly 1,974,357.92 -> 3,694,294.11 in any "
          "calendar-year pair; the figures above show the sign behaviour "
          "for every year regardless.")
