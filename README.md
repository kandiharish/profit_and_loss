# Profit & Loss

Next.js (Node.js) frontend, FastAPI backend, BigQuery as the only storage.
Read-only — the app never writes to the source.

    nodal-plexus-492111-e9.lyson_sons
      Conso_GL_Dump_latest   -> the entire source

One table, no joins anywhere. It is the consolidated ledger with
`Conso_GL_Mapping` already folded onto every row, so it carries the amounts
AND the statement structure together:

    Statement, Section, Ledger_ID, Ledger_Name,
    Sub_Ledger_ID, Sub_Ledger_Name, Elimination_Flag

197,526 rows spanning **both** legal entities — `Lyons & Sons` (181,525) and
`Warehouse LLC` (16,001) — told apart by `company_name`.

Column mapping is done once, in the `gl` CTE, so the rest of the codebase
is unchanged:

    transaction_date       -> date
    distribution_account   -> account_name
    Section / Ledger_Name  -> the two levels of the statement

`distribution_account` is the leaf account name shown inside a drill-down.
`account_fully_qualified_name` is the `parent:child` path and is deliberately
**not** used — it is NULL on every untyped row.

## Accounting rules encoded here

These were set by the data owner and are load-bearing. Changing any of them
changes the numbers.

| Rule | Where |
|---|---|
| `amount = credit - debit` (debit negative, credit positive) | `queries.py` → `CLASSIFIED` |
| Classify on `account_name` only; `split_account` is context, never a key | `queries.py` |
| `account_type` gates P&L membership; `Section` places the row. **Do not use `account_id`** | `queries.py` → `classified` CTE |
| **Do not use the table's `amount` / `balance` columns** — amounts come from `debit`/`credit` only | `queries.py` |
| Sections and ledgers come from `Section` / `Ledger_Name` on the row | `queries.py` → `gl` CTE |
| Group on **(section, ledger)** — `Ledger_Name` alone is not unique | `queries.py`, `PnlTable.tsx` |
| No sub-type column on the statement | `PnlTable.tsx` |
| Account names display without the GL code | `queries.py` → `_DISPLAY_NAME` |

Because expenses are negative, every subtotal is a straight **addition**:

    Gross Profit         = Revenue + COGS
    Net Operating Income = Gross Profit + Operating Expenses
    Net Income           = the sum of all five sections

No subtraction, no sign flip. Keep it that way.

## Classification

The statement has two levels, both read straight off the row:

| Column | Becomes |
|---|---|
| `Section` | the statement section — the top-level row |
| `Ledger_Name` | the ledger group — the row shown when a section expands |
| `Ledger_ID` | the grouping key alongside the name |

### Row order

Within a section, ledgers are ordered **biggest first**:

    ORDER BY section_order, ABS(amount) DESC, ledger_name

`ABS()` rather than a plain `DESC`, because the two halves of the statement
carry opposite signs — revenue positive, expenses negative. Sorting on the
raw value would put the *smallest* expense at the top of every expense
section. Magnitude gives one rule that reads correctly on both: largest
revenue first, largest expense first.

It also keeps contra lines honest. `Sales Discounts & Rebates` is a small
negative inside Operating Revenue and sorts to the bottom on size, which is
where it belongs, rather than jumping to the top for being negative.

`ledger_name` breaks ties, so two ledgers of equal magnitude cannot swap
places between refreshes.

The comparison column is unaffected: `PnlTable` looks a prior-year figure up
by **(section, ledger)**, never by row position, so the two periods sort
independently and still pair correctly.

`Ledger_ID` is retained as part of the grouping key (it is canonicalised by
the merges) but no longer drives display order. It is **not unique**: `4600`
covers both `Rental Income - Third Party` and `Rental Income -
Non-Operating`.

`Section` disagrees with QuickBooks' `account_type` in places, deliberately:
1,644 `Expense` rows sit under **Other Expenses** (interest, income tax,
non-recurring), 8 under **Cost of Goods Sold**, 5 `Other Expense` rows under
**Operating Expenses**. That reclassification is the point of the mapping —
it is the accountant's view, not QuickBooks' default.

| Section | ledgers |
|---|---|
| Operating Revenue | 8 (11 before clubbing) |
| Cost of Goods Sold | 8 |
| Operating Expenses | 18 |
| Other Income | 7 |
| Other Expenses | 5 |

The internal section keys (`revenue`, `cogs`, `opex`, `other_income`,
`other_expense`) are unchanged, so variance colouring, the KPI strip and the
charts were never touched. Only labels and membership changed.

### Clubbed ledgers

Some ledgers are presented merged. `LEDGER_MERGES` in `queries.py` is the
single place this is defined:

| Section | Merged away | Into |
|---|---|---|
| Operating Revenue | `Inbound Handling Revenue`, `Outbound Handling Revenue` | **Handling & Services Revenue** (4100) |
| Operating Revenue | `Rental Income - Non-Operating` | **Rental Income - Third Party** (4600) |

Two things make this safe rather than cosmetic:

**The section is part of the key.** `Rental Income - Non-Operating` exists
under Operating Revenue (4600) *and* Other Income (8100). Only the Operating
Revenue one is folded in; the Other Income ledger of the same name keeps its
834,788.00 where it is. Merging on name alone would drag money across a
section boundary.

**`Ledger_ID` is rewritten with the name.** The statement groups on
(section, ledger_id, ledger_name), so leaving three different ids behind one
merged label would split it straight back into three rows.

Because the merge lives in the shared `classified` CTE, the statement, the
drill-down and the prior-year comparison all agree automatically — drilling
into `Handling & Services Revenue` returns all 20 underlying accounts.
Section totals and Net Income are untouched by a merge; only the number of
rows changes.

**`Ledger_Name` is not unique either.** `Rental Income - Non-Operating`
exists under both `Operating Revenue` (Ledger_ID 4600) and `Other Income`
(8100). Every grouping and every prior-year lookup is keyed on
**(section, ledger)** together — matching on the ledger name alone would
pair a row with the wrong comparative.

### Two authorities, deliberately split

    account_type  ->  WHETHER a row is on the P&L
    Section       ->  WHERE it sits once it is

`Section` never adds a row to the statement. 12,309 ledger rows carry no
`account_type` — all QuickBooks `(deleted)` accounts — and 981 of them still
carry a `Section`. Letting `Section` place those would put
**-271,056.19** of deleted-account activity back onto the P&L and move Net
Income by the same amount. They were excluded before and stay excluded.

The gate is in the `classified` CTE and its `IS NULL` test is load-bearing:

    WHEN gl.account_type IS NULL
      OR gl.account_type NOT IN (...) THEN NULL

`x NOT IN (...)` evaluates to **NULL, not TRUE**, when `x` is NULL, so a bare
`NOT IN` silently lets every deleted account back on. Net Income over the
full ledger must read **70,864,868.73**; if it reads 70,593,812.54 this gate
has been broken.

`account_sub_type` remains deliberately unused.

## GL code stripping

    "6100-01 Rent - Lyons"  ->  "Rent - Lyons"
    "7650 Bank Charges"     ->  "Bank Charges"

Done in SQL (`_DISPLAY_NAME`), with the raw `account_name` carried alongside
as the drill-down key — display is cosmetic and must never become an
identifier. The regex only strips when a non-space character survives, so an
account named nothing but a code is left alone.

**Known limitation:** an account legitimately named starting with a number
(e.g. `600 Jersey Ave`) would lose that number. None exist among the 601
accounts in this ledger. The `strip_codes` query parameter turns it off.

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
It is the strongest test available: it catches rows lost or duplicated
anywhere in the pipeline, which nothing else will surface.

`unmatched` lists accounts carrying no `Section` at all. It
holds 2 entries, both netting **0.00** — a NULL name and `Not Specified`.
It does not list deleted accounts: those are gated out on `account_type`.
Anything else appearing there is an account the mapping has never seen: it
belongs to no statement and its money is silently absent, so give it a
`Section` upstream. Balance-sheet accounts do **not** appear here — they are
classified fine and drop out of the P&L on their `Section`, which is correct.

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
| `GET /api/pnl/statement` | The P&L. `start_date`, `end_date`, `department`, `company`, `compare_to` |
| `GET /api/pnl/trend` | Monthly section totals |
| `GET /api/pnl/drilldown` | Transaction lines behind one ledger (`ledger_name`) |
| `GET /api/pnl/by-property` | Net income per property, worst first |
| `GET /api/meta/ledger-balance` | Integrity check |
| `GET /api/meta/unmatched` | Accounts carrying no `Section` |
| `GET /api/meta/departments` | Property list |
| `GET /api/meta/companies` | Legal entity list, for the Company filter |
| `GET /api/bs/statement` | Balance sheet as at `as_of`. `department`, `company` |
| `GET /api/ledger/entries` | Raw GL lines. `search`, `statement`, `ledger_name`, `pnl_only`, `limit`, `offset` |

## Report toolbar

The client reads QuickBooks all day, so the toolbar follows QuickBooks
Online rather than anything invented here:

    Report period | From | To | Company | Property | Compare to

**Dates are MM/DD/YYYY.** `<input type="date">` renders in the *browser's*
locale and the format cannot be set — the same page showed DD-MM-YYYY here
and MM/DD/YYYY in the US. `DateField` is therefore a text box formatted by
`toUsDate`/`fromUsDate`, with the native picker still reachable behind the
calendar button via `showPicker()`. `fromUsDate` round-trips through a real
`Date` and rejects impossible input, so `02/31/2026` fails rather than
silently rolling into March.

**Report period** is the QBO list, in QBO's order and wording, from
`lib/reportPeriods.ts`. Two constants drive every fiscal variant —
`FISCAL_YEAR_START_MONTH` (1, QuickBooks' default) and `WEEK_START_DAY` (0,
Sunday). Change those and the whole list follows. Picking a named period
loads immediately, as QuickBooks does; typing dates by hand flips the
dropdown to **Custom dates** and waits for Load Data, so a half-typed year
never fires a BigQuery job. `matchPeriod()` re-derives the label from the
dates, so the dropdown never claims a period the dates do not say.

**Compare to** uses QuickBooks' wording — *Select Period*, *Previous
period*, *Previous year* — over the unchanged `prior_period` / `prior_year`
API values.

Deliberately absent: the **Cash/Accrual** switch. This ledger is accrual;
offering a toggle that changed nothing would be worse than not offering it.

## Company

`company_name` is the legal entity — `Lyons & Sons` or `Warehouse LLC`. The
filter applies to the P&L, the balance sheet and the ledger entries, and is
the raw value throughout (unlike `department` it carries no numeric prefix
to strip and no collision to guard).

The parts reconcile to the whole: 60,770,085.83 + 10,094,782.90 =
70,864,868.73, and the balance sheet balances to 0.00 per company as well as
consolidated.

## Balance sheet

`/api/bs/statement` takes **`as_of`** and no start date. A balance sheet is a
position, not a period; accepting a start date would quietly turn it into a
movement statement that still looked like a balance sheet. The UI passes the
**To** filter and ignores **From** on that tab.

Same two levels as the P&L — Section, expanding to ledgers — over
`Statement = 'Balance Sheet'` (Ledger_ID 1000s assets, 2000s liabilities,
3000s equity).

**Sign.** Amounts are credit − debit, so debit-normal assets arrive negative.
`BS_SECTIONS` carries a display sign that flips asset sections once,
server-side, in `bs_builder.py`. Nothing downstream re-derives it.

**Why it balances.** These ledgers have never been closed out, so the P&L
has to be folded into equity as undistributed earnings. Two computed lines
do that:

| Line | What it is |
|---|---|
| `Net Income` | the P&L on exactly the same basis as the P&L tab — the two screens agree to the cent |
| `Unclassified (deleted accounts)` | rows the ledger marks Profit & Loss but the P&L gates out |

Splitting them is deliberate. Folding the second into the first would make
the sheet balance while quietly disagreeing with the P&L screen; dropping it
would leave the sheet out by that amount. At the full-ledger date those read
70,864,868.73 and −271,056.19.

The footer states `Assets − (Liabilities + Equity)`, which must be **0.00**.
Verified 0.00 at 2019-12-31, 2022-06-30, 2024-12-31 and 2026-09-10.

## Drill-down

Clicking a ledger on the P&L opens `/entries` — a real route, not a panel,
so it can be middle-clicked into a new tab, deep-linked and left with the
browser Back button. The whole filter travels in the URL:

    /entries?ledger=Handling+%26+Services+Revenue&start=…&end=…
            &company=…&department=…&section=Operating+Revenue&expected=…

**`pnl_only=true` is what makes the total trustworthy.** It applies the same
`section_order <= 5` gate the statement uses. Without it the list would also
return rows from accounts deleted in QuickBooks, and the total under the
entries would not equal the figure that was clicked.

`expected` carries the statement figure across so the page can state the
tie-out rather than leave it assumed — and say so loudly if the two ever
disagree. Verified across every Operating Revenue ledger; e.g. Handling &
Services Revenue is **49,982,134.44 across 4,783 entries**, equal to the
statement to the cent.

`EntriesTable` is shared with the Ledger Entries tab so the two views cannot
drift; the drill-down hides the Ledger column, since every row on it is the
same ledger.

## Ledger entries

`/api/ledger/entries` is the raw GL behind both statements, newest first,
with `Statement` / `Section` / `Ledger_Name` attached to every line.

`search` matches account, ledger, counterparty, description and document
number from one parameter. The row count and net in the footer are computed
over the **whole filter**, not the page on screen — `_entries_filter()`
builds the WHERE clause once and both queries use it, so the count can never
describe a different filter than the rows.

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
