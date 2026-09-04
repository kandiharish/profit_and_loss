from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from .. import queries
from ..bq import run
from ..pnl_builder import build, empty_totals, kpis_from

router = APIRouter(prefix="/api/pnl", tags=["pnl"])


def _check(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(400, "end_date must be on or after start_date")
    # Widened from 5 to 20 years so a range starting January 2018 is accepted
    # alongside its prior-year comparison. The real cost guard is
    # maximum_bytes_billed in bq.py, not this bound.
    if (end - start).days > 366 * 20:
        raise HTTPException(400, "Range too wide; request 20 years or less.")


def _comparison_range(start: date, end: date, basis: str) -> tuple[date, date]:
    if basis == "prior_year":
        try:
            return start.replace(year=start.year - 1), end.replace(year=end.year - 1)
        except ValueError:
            # 29 Feb in a non-leap prior year.
            return start - timedelta(days=365), end - timedelta(days=365)
    span = end - start
    return start - span - timedelta(days=1), start - timedelta(days=1)


@router.get("/statement")
def statement(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(None, description="Property / LLC filter"),
    compare_to: str | None = Query(None, pattern="^(prior_period|prior_year)$"),
):
    _check(start_date, end_date)

    sql, params = queries.statement(start_date, end_date, department)
    current = build(run(sql, params))

    comparison = None
    if compare_to:
        c_start, c_end = _comparison_range(start_date, end_date, compare_to)
        c_sql, c_params = queries.statement(c_start, c_end, department)
        comparison = {
            "basis": compare_to,
            "period": {"start": c_start, "end": c_end},
            **build(run(c_sql, c_params)),
        }

    return {
        "period": {"start": start_date, "end": end_date},
        "department": department,
        "current": current,
        "comparison": comparison,
    }


@router.get("/trend")
def trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department: str | None = Query(None),
):
    _check(start_date, end_date)
    sql, params = queries.trend(start_date, end_date, department)
    return {"points": run(sql, params)}


@router.get("/drilldown")
def drilldown(
    start_date: date = Query(...),
    end_date: date = Query(...),
    account_name: str = Query(..., min_length=1,
                              description="RAW account name, including GL code"),
    department: str | None = Query(None),
    limit: int = Query(500, ge=1, le=5000),
):
    _check(start_date, end_date)
    sql, params = queries.drilldown(start_date, end_date, account_name,
                                    department, limit)
    return {"account_name": account_name, "lines": run(sql, params)}


@router.get("/by-property")
def by_property(
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    """Net income per property. A consolidated total hides which LLC is
    losing money; this is usually the view the partners want."""
    _check(start_date, end_date)

    # Two queries total: one for the section totals of every property, one
    # for the display labels. Not one statement query per property.
    totals_sql, totals_params = queries.by_property_totals(start_date, end_date)
    dept_sql, dept_params = queries.departments()

    labels = {d["department"]: d["department_display"]
              for d in run(dept_sql, dept_params)}

    per_dept: dict[str, dict[str, float]] = {}
    for r in run(totals_sql, totals_params):
        dept = r["department"]
        section = r["pnl_section"]
        if section is None:
            continue
        per_dept.setdefault(dept, empty_totals())[section] = float(r["amount"] or 0)

    rows = [
        {
            "department": dept,                          # raw key
            "department_display": labels.get(dept, dept),
            **kpis_from(totals),
        }
        for dept, totals in per_dept.items()
    ]
    rows.sort(key=lambda r: r["net_income"])
    return {"properties": rows}
