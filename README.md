# Profit & Loss

Next.js (Node.js) frontend, FastAPI backend, BigQuery as the only storage.
Read-only — the app never writes to `warehouse_llc`.

    nodal-plexus-492111-e9.warehouse_llc
      general_ledger      -> all amounts
      chart_of_accounts   -> account_type, used for classification

## Accounting rules encoded here

These were set by the data owner and are load-bearing. Changing any of them
changes the numbers.

| Rule | Where |
|---|---|
| `amount = credit - debit` (debit negative, credit positive) | `queries.py` → `CLASSIFIED` |
| Classify on `account_name` only; `split_account` is context, never a key | `queries.py` |
| Map `general_ledger.account_name` → `chart_of_accounts.name`. **Do not use `account_id`** — not consistently populated | `queries.py` → `coa` CTE |
| **Do not use `net_amount`** — wrong for some rows. Not selected anywhere | `queries.py` |
| No sub-type column on the statement | `PnlTable.tsx` |
| Account names display without the GL code | `queries.py` → `_DISPLAY_NAME` |

Because expenses are negative, every subtotal is a straight **addition**:

    Gross Profit         = Revenue + COGS
    Net Operating Income = Gross Profit + Operating Expenses
    Net Income           = the sum of all five sections

No subtraction, no sign flip. Keep it that way.

## Classification

QuickBooks' own `account_type` drives it. Verified complete against the
chart of accounts — all 56 P&L accounts land in a section, the other 159 are
balance-sheet and excluded, nothing falls through.

| account_type | section | accounts |
|---|---|---|
| Income | Revenue | 18 |
| Cost of Goods Sold | Cost of Goods Sold | 1 |
| Expense | Operating Expenses | 23 |
| Other Income | Other Income | 10 |
| Other Expense | Other Expense | 4 |

`account_sub_type` is deliberately unused. 18 accounts tagged `Travel` under
`Expense` is careless categorisation in QuickBooks, not real travel spend —
it is not safe to group by.

## GL code stripping

    "6100-01 Rent - Lyons"  ->  "Rent - Lyons"
    "7650 Bank Charges"     ->  "Bank Charges"

Done in SQL (`_DISPLAY_NAME`), with the raw `account_name` carried alongside
as the drill-down key — display is cosmetic and must never become an
identifier. The regex only strips when a non-space character survives, so an
account named nothing but a code is left alone.

**Known limitation:** an account legitimately named starting with a number
(e.g. `600 Jersey Ave`) would lose that number. None exist in the current
chart of accounts. The `strip_codes` query parameter turns it off.

## Reporting period

The tool reports from **January 2018** onward (`DATA_PERIOD_START` in
`FilterBar.tsx`; the API accepts ranges up to 20 years). This opens the
window so prior-year comparison has history to reach into.

That is the *reporting* window, not a claim about what is loaded. The header
shows the ledger's actual min/max date from `/api/meta/date-range`, and
selecting a period that starts before the loaded data shows a note rather
than silently returning zeros.

## Setup

### 1. Credentials

    gcloud auth application-default login
    gcloud config set project nodal-plexus-492111-e9

No keys in this repo. Read-only IAM is sufficient:
`roles/bigquery.jobUser` on the project, `roles/bigquery.dataViewer` on the
dataset.

### 2. Backend

    cd backend
    python -m venv .venv
    .venv\Scripts\Activate.ps1
    pip install -r requirements.txt
    copy .env.example .env
    uvicorn app.main:app --reload --port 8000

### 3. Verify before trusting a number

    http://127.0.0.1:8000/api/meta/ledger-balance
    http://127.0.0.1:8000/api/meta/unmatched

`ledger-balance` sums `amount` across **every** account — P&L and balance
sheet together — which must be exactly **0**, because debits equal credits.
It is the strongest test available: it catches rows lost or duplicated by
the join, which nothing else will surface.

`unmatched` must be empty. Anything listed is money missing from the P&L.

Then tie a closed period to the same period's P&L in QuickBooks. It must
match to the cent.

### 4. Frontend

    cd frontend
    npm install
    npm run dev

http://localhost:3000 — `/api/*` proxies to FastAPI, so no CORS setup in dev.

> **Do not run `npm run build` while `npm run dev` is running.** They share
> the `.next` directory, and the production build replaces the dev CSS chunk
> with production-named files. The dev server then 404s on
> `/_next/static/css/app/layout.css` and the page renders with **no styling
> at all** — which looks like the UI was redesigned, but no source changed.
>
> Recovery: stop node, `Remove-Item -Recurse -Force .next`, `npm run dev`.
>
> To verify a production build, stop the dev server first.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/pnl/statement` | The P&L. `start_date`, `end_date`, `department`, `compare_to` |
| `GET /api/pnl/trend` | Monthly section totals |
| `GET /api/pnl/drilldown` | Transaction lines behind one account |
| `GET /api/pnl/by-property` | Net income per property, worst first |
| `GET /api/meta/ledger-balance` | Integrity check |
| `GET /api/meta/unmatched` | Accounts that failed to map |
| `GET /api/meta/departments` | Property list |

## By property

`department` is the individual LLC / property. A consolidated P&L hides
which property is losing money, so the statement takes a `department`
filter and `/api/pnl/by-property` ranks them worst-first.

Transactions with no department are left unallocated by design — they stay
in the consolidated total and simply do not appear under any property. This
means per-property figures do not sum to the consolidated total, which is
correct rather than a defect.

### Property display names

`department` (raw) is always the filter key; `department_display` is what
the UI shows. A leading numeric prefix is stripped:

    "1650 Sherman Avenue Associates LLC"  ->  "Sherman Avenue Associates LLC"
    "600 Jersey Ave"                      ->  "Jersey Ave"

**Collision guard.** `1650 Sherman` and `850 Sherman` are different legal
entities that both strip to `Sherman`. When a stripped label is claimed by
more than one raw department, the numeric prefix is appended in parentheses
so the two stay tellable apart (`disambiguated: true`):

    "1650 Sherman"  ->  "Sherman (1650)"
    "850 Sherman"   ->  "Sherman (850)"

Amounts are never merged across raw departments regardless of display —
the raw value is the filter key throughout.

## Not built

Auth/SSO, Excel export, budget vs actual, saved views. All additive.
