from datetime import date

from fastapi import APIRouter, HTTPException, Query

from .. import queries
from ..bq import run

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


@router.get("/entries")
def entries(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(None),
    company: str | None = Query(None,
                                description="Legal entity (company_name)"),
    statement: str | None = Query(
        None, description="'Profit & Loss' or 'Balance Sheet'"),
    search: str | None = Query(
        None, description="Matches account, ledger, name, description or doc no."),
    ledger_name: str | None = Query(
        None, description="Restrict to one ledger group, e.g. "
                          "'Handling & Services Revenue'"),
    pnl_only: bool = Query(
        False, description="Apply the P&L's own section gate, so the total "
                           "ties to the statement figure this was opened from."),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """Raw GL lines with their statement placement attached.

    The summary is computed over the whole filter, not the page, so the
    footer describes the result set rather than the 200 rows on screen.
    """
    if end_date < start_date:
        raise HTTPException(400, "end_date must be on or after start_date")

    sql, params = queries.ledger_entries(start_date, end_date, department,
                                         statement, search, limit, offset,
                                         company, ledger_name, pnl_only)
    rows = run(sql, params)

    sql2, params2 = queries.ledger_entries_summary(start_date, end_date,
                                                   department, statement,
                                                   search, company,
                                                   ledger_name, pnl_only)
    summary = run(sql2, params2)
    total = int(summary[0].get("row_count") or 0) if summary else 0
    net = float(summary[0].get("net_amount") or 0) if summary else 0.0

    return {
        "entries": rows,
        "total": total,
        "net_amount": net,
        "limit": limit,
        "offset": offset,
        "has_more": offset + len(rows) < total,
    }
