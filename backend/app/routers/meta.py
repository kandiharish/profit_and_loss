"""Diagnostics. Hit these first after wiring credentials."""

from fastapi import APIRouter

from .. import queries
from ..bq import run
from ..config import settings

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/health")
def health():
    return {"status": "ok", "project": settings.bq_project,
            "dataset": settings.bq_dataset,
            "gl_table": settings.bq_gl_table,
            # The fully-resolved reference the queries actually use. Cheapest
            # way to confirm a deployment is pointed where you think it is.
            "table_ref": settings.gl_table_ref}


@router.get("/departments")
def departments():
    sql, params = queries.departments()
    return {"departments": run(sql, params)}


@router.get("/companies")
def companies():
    """Legal entities in the ledger, for the Company filter."""
    sql, params = queries.companies()
    return {"companies": run(sql, params)}


@router.get("/date-range")
def date_range():
    sql, params = queries.date_bounds()
    rows = run(sql, params)
    return rows[0] if rows else {}


@router.get("/unmatched")
def unmatched():
    """Ledger rows carrying no account_type, and so excluded from the P&L.

    The consolidated ledger has no chart_of_accounts to miss; a row lands
    here only when account_type is NULL on the ledger itself, which in this
    source means the account was deleted in QuickBooks. Their amounts are
    left out of the statement, so this endpoint is how that stays visible.
    """
    sql, params = queries.unmatched()
    rows = run(sql, params)
    return {
        "clean": not rows,
        "unmatched_accounts": rows,
        "verdict": ("Every ledger row carries an account_type."
                    if not rows else
                    f"{len(rows)} account(s) carry no account_type (deleted "
                    "in QuickBooks). Their amounts are excluded from the P&L."),
    }


@router.get("/ledger-balance")
def ledger_balance():
    """
    SUM(amount) across EVERY account -- P&L and balance sheet together --
    must be exactly 0, because debits equal credits.

    This is the strongest single test available: it verifies the source
    table is internally consistent and that nothing has quietly dropped or
    duplicated rows, which no other check will surface.
    """
    sql, params = queries.ledger_balance()
    row = run(sql, params)[0]
    diff = float(row.get("should_be_zero") or 0)
    balanced = abs(diff) < 0.01
    return {
        "balanced": balanced,
        **row,
        "verdict": ("Ledger balances. Debits equal credits across every "
                    "account; no rows lost or duplicated."
                    if balanced else
                    "OUT OF BALANCE. Rows are being dropped or duplicated; "
                    "do not trust the P&L until this is resolved."),
    }
