"""
Flat account rows -> a structured P&L.

Sign convention: amount = credit - debit, so revenue is positive and
expenses are negative. Every subtotal is therefore a straight ADDITION --
Gross Profit = Revenue + COGS, Net Income = the sum of everything. There is
no subtraction and no sign flip anywhere. Keep it that way.
"""

from .queries import SECTIONS

_LABELS = {key: label for key, label, _, _ in SECTIONS}
_ORDER = [key for key, _, _, _ in SECTIONS]


def subtotals_from(totals: dict[str, float]) -> dict[str, float]:
    """
    The three subtotal lines, derived from section totals.

    Expenses are already negative under this convention, so every line is an
    ADDITION. Defined once here so the statement and the per-property view
    cannot drift apart.
    """
    gross_profit = round(totals["revenue"] + totals["cogs"], 2)
    operating_income = round(gross_profit + totals["opex"], 2)
    net_income = round(
        operating_income + totals["other_income"] + totals["other_expense"], 2
    )
    return {
        "gross_profit": gross_profit,
        "operating_income": operating_income,
        "net_income": net_income,
    }


def kpis_from(totals: dict[str, float]) -> dict:
    s = subtotals_from(totals)
    revenue = totals["revenue"]

    def margin(n: float) -> float | None:
        return round(n / revenue * 100, 1) if revenue else None

    return {
        "revenue": revenue,
        "gross_profit": s["gross_profit"],
        "gross_margin_pct": margin(s["gross_profit"]),
        # Expenses are negative here; the tile reads better as a magnitude.
        "operating_expenses": abs(totals["opex"]),
        "net_income": s["net_income"],
        "net_margin_pct": margin(s["net_income"]),
    }


def empty_totals() -> dict[str, float]:
    return {k: 0.0 for k in _ORDER}


def build(rows: list[dict]) -> dict:
    by_section: dict[str, list[dict]] = {k: [] for k in _ORDER}

    for r in rows:
        key = r.get("pnl_section")
        if key in by_section:
            by_section[key].append(
                {
                    # Raw name -- the drill-down key. Never displayed.
                    "account_name": r["account_name"],
                    # Display name -- GL code stripped.
                    "display_name": r.get("display_name") or r["account_name"],
                    "amount": float(r.get("amount") or 0),
                    "txn_count": r.get("txn_count") or 0,
                }
            )

    totals = {k: round(sum(a["amount"] for a in v), 2)
              for k, v in by_section.items()}

    s = subtotals_from(totals)
    gross_profit = s["gross_profit"]
    operating_income = s["operating_income"]
    net_income = s["net_income"]

    sections = [
        {
            "key": k,
            "label": _LABELS[k],
            "total": totals[k],
            "accounts": by_section[k],
        }
        for k in _ORDER
    ]

    subtotals = [
        {"key": "gross_profit", "label": "Gross Profit",
         "after": "cogs", "amount": gross_profit},
        {"key": "operating_income", "label": "Net Operating Income",
         "after": "opex", "amount": operating_income},
        {"key": "net_income", "label": "Net Income",
         "after": "other_expense", "amount": net_income},
    ]

    return {
        "sections": sections,
        "subtotals": subtotals,
        "kpis": kpis_from(totals),
    }
