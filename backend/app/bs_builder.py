"""
Flat (section, ledger) rows -> a balance sheet.

Sign convention. Ledger amounts are credit - debit, so debit-normal assets
arrive NEGATIVE. A balance sheet reads assets positive, so each section
carries a display sign (see BS_SECTIONS). The flip happens once, here, and
nothing downstream re-derives from it.

Why the sheet balances. Assets = Liabilities + Equity holds only once the
P&L is folded into equity as undistributed earnings, because these ledgers
have never been closed out. Two lines do that:

  Net Income        -- the P&L on exactly the same basis as the P&L tab
  Unclassified      -- rows the ledger marks Profit & Loss but the P&L gates
                       out (account deleted in QuickBooks)

Splitting them is deliberate. Folding the second into the first would make
the sheet balance while quietly disagreeing with the P&L screen; dropping it
would leave the sheet out of balance by that amount.
"""

from .queries import BS_SECTIONS

_LABELS = {key: label for key, label, _, _, _ in BS_SECTIONS}
_ORDER = [key for key, _, _, _, _ in BS_SECTIONS]
_SIGNS = {key: sign for key, _, _, _, sign in BS_SECTIONS}

ASSET_KEYS = ("current_assets", "non_current_assets")
LIABILITY_KEYS = ("current_liabilities", "non_current_liabilities")


def build(rows: list[dict], net_income: float, unclassified: float) -> dict:
    by_section: dict[str, list[dict]] = {k: [] for k in _ORDER}

    for r in rows:
        key = r.get("bs_section")
        if key in by_section:
            name = r.get("ledger_name") or "Unmapped"
            by_section[key].append(
                {
                    "ledger_name": name,
                    "display_name": name,
                    "amount": round(float(r.get("amount") or 0) * _SIGNS[key], 2),
                    "txn_count": r.get("txn_count") or 0,
                    "account_count": r.get("account_count") or 0,
                }
            )

    # Undistributed earnings sit inside equity. Equity is credit-normal, so
    # these pass through with the same sign as the ledgers around them.
    derived = []
    if round(net_income, 2):
        derived.append({
            "ledger_name": "Net Income",
            "display_name": "Net Income",
            "amount": round(net_income, 2),
            "txn_count": 0,
            "account_count": 0,
            "derived": True,
        })
    if round(unclassified, 2):
        derived.append({
            "ledger_name": "Unclassified (deleted accounts)",
            "display_name": "Unclassified (deleted accounts)",
            "amount": round(unclassified, 2),
            "txn_count": 0,
            "account_count": 0,
            "derived": True,
        })
    by_section["equity"] = by_section["equity"] + derived

    totals = {k: round(sum(a["amount"] for a in v), 2)
              for k, v in by_section.items()}

    total_assets = round(sum(totals[k] for k in ASSET_KEYS), 2)
    total_liabilities = round(sum(totals[k] for k in LIABILITY_KEYS), 2)
    total_equity = totals["equity"]
    liabilities_and_equity = round(total_liabilities + total_equity, 2)
    # Must be 0. Anything else means rows were dropped or double counted.
    difference = round(total_assets - liabilities_and_equity, 2)

    sections = [
        {
            "key": k,
            "label": _LABELS[k],
            "total": totals[k],
            "ledgers": by_section[k],
        }
        for k in _ORDER
    ]

    subtotals = [
        {"key": "total_assets", "label": "Total Assets",
         "after": "non_current_assets", "amount": total_assets},
        {"key": "total_liabilities", "label": "Total Liabilities",
         "after": "non_current_liabilities", "amount": total_liabilities},
        {"key": "liabilities_and_equity",
         "label": "Total Liabilities & Equity",
         "after": "equity", "amount": liabilities_and_equity},
    ]

    return {
        "sections": sections,
        "subtotals": subtotals,
        "checks": {
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "total_equity": total_equity,
            "liabilities_and_equity": liabilities_and_equity,
            "difference": difference,
            "balanced": abs(difference) < 0.01,
        },
    }
