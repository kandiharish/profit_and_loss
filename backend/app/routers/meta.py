"""Diagnostics. Hit these first after wiring credentials."""

from fastapi import APIRouter

from .. import queries
from ..bq import run
from ..config import settings

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/health")
def health():
    return {"status": "ok", "project": settings.bq_project,
            "dataset": settings.bq_dataset}


@router.get("/departments")
def departments():
    sql, params = queries.departments()
    return {"departments": run(sql, params)}


@router.get("/date-range")
def date_range():
    sql, params = queries.date_bounds()
    rows = run(sql, params)
    return rows[0] if rows else {}


@router.get("/unmatched")
def unmatched():
    """GL account names with no match in the chart of accounts.
    MUST be empty -- anything here is money missing from the P&L."""
    sql, params = queries.unmatched()
    rows = run(sql, params)
    return {
        "clean": not rows,
        "unmatched_accounts": rows,
        "verdict": ("Every GL account maps to the chart of accounts."
                    if not rows else
                    f"{len(rows)} account name(s) failed to map. Their "
                    "amounts are missing from the P&L."),
    }


@router.get("/ledger-balance")
def ledger_balance():
    """
    SUM(amount) across EVERY account -- P&L and balance sheet together --
    must be exactly 0, because debits equal credits.

    This is the strongest single test available: it catches rows lost or
    duplicated by the join, which no other check will surface.
    """
    sql, params = queries.ledger_balance()
    row = run(sql, params)[0]
    diff = float(row.get("should_be_zero") or 0)
    balanced = abs(diff) < 0.01
    return {
        "balanced": balanced,
        **row,
        "verdict": ("Ledger balances. The join neither lost nor duplicated rows."
                    if balanced else
                    "OUT OF BALANCE. The join is dropping or duplicating rows; "
                    "do not trust the P&L until this is resolved."),
    }
