from datetime import date

from fastapi import APIRouter, Query

from .. import queries
from ..bq import run
from ..bs_builder import build

router = APIRouter(prefix="/api/bs", tags=["balance-sheet"])


@router.get("/statement")
def statement(
    as_of: date = Query(..., description="Position date. Everything from the "
                                         "start of the ledger up to this day."),
    department: str | None = Query(None),
    company: str | None = Query(None,
                                description="Legal entity (company_name)"),
):
    """The balance sheet as at a date.

    Deliberately takes `as_of` and no start date: a balance sheet is a
    position, not a period. Accepting a start date would quietly turn it into
    a movement statement that still looked like a balance sheet.
    """
    sql, params = queries.balance_sheet(as_of, department, company)
    rows = run(sql, params)

    sql2, params2 = queries.retained_earnings(as_of, department, company)
    earn = run(sql2, params2)
    net_income = float(earn[0].get("net_income") or 0) if earn else 0.0
    unclassified = float(earn[0].get("unclassified") or 0) if earn else 0.0

    data = build(rows, net_income, unclassified)
    return {"as_of": as_of.isoformat(), "department": department,
            "company": company, **data}
