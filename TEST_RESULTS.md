# Test results

Project `nodal-plexus-492111-e9`, dataset `warehouse_llc`.

**The ledger changed since the last run** — it now holds **16,234 rows,
2018-01-01 → 2026-09-01** (previously 772 rows, 2026 only). The historical
load has landed.

---

## ⚠️ ONE FAILING CHECK — the 2026 data does not balance

    SUM(amount) across every account = 1,250,062.25     (must be 0.00)

This is **the source extract, not the app**. Proof:

| Diagnostic | Result |
|---|---|
| Raw `SUM(debit) − SUM(credit)`, no join at all | **−1,250,062.25** — source is already out |
| Rows before join → after join | 16,234 → 16,234 — no fan-out |
| Duplicate names in chart of accounts | none |
| Rows with NULL date | 0 |
| Unmatched accounts | 1 (`"Not Specified"`, 2 rows, **0.00** — harmless) |

### It is confined entirely to 2026

Balance per year, and unbalanced transactions per year:

| Year | Txns | Unbalanced | Debits − Credits |
|---|---:|---:|---:|
| 2018 | 641 | 0 | 0.00 |
| 2019 | 667 | 0 | 0.00 |
| 2020 | 728 | 0 | 0.00 |
| 2021 | 726 | 0 | 0.00 |
| 2022 | 738 | 0 | 0.00 |
| 2023 | 913 | 0 | 0.00 |
| 2024 | 866 | 0 | 0.00 |
| 2025 | 669 | 0 | 0.00 |
| **2026** | **351** | **166 (47.3%)** | **−1,250,062.25** |

**2018–2025 is flawless** — 5,948 transactions, every single one balanced,
every year summing to exactly zero. That is what a complete extract looks
like.

**2026 has 166 half-written transactions.** They are multi-leg entries
missing legs, spread across every month Jan–Aug (September, with only 5
rows, balances). Examples:

    txn 11368  2026-01-22  Expense  3 legs   gap  -319,134.98
    txn 11633  2026-01-22  Bill     3 legs   gap  +319,134.98
    txn 11450  2026-03-13  Expense  3 legs   gap  -220,592.09

Note the first two are equal and opposite — legs appear to have been
attributed to the wrong transaction, not merely dropped.

Six 2026 rows carry neither a debit nor a credit.

### What this means

- **2018–2025 P&L figures are trustworthy.**
- **2026 figures are not.** Revenue, expenses and net income for 2026 are
  wrong by an unknown split of that 1.25 M.
- 2026 *balanced* when it held 772 rows. It now holds 1,033 and does not.
  The 2026 slice of the reload is what broke it — **re-extract 2026**;
  2018–2025 needs nothing.

Reproduce with `backend/diagnose_balance.py`, `diagnose_2026.py`,
`diagnose_txn.py`.

---

## Requested change: expense variance sign — done

Operating Expenses rising from (1,974,357.92) to (3,694,294.11) displayed
as **−87.1%**. It now displays **+87.1%**.

Amounts are stored credit-positive, so expenses are negative numbers and a
raw variance on them reads backwards. For expense lines the variance is now
negated — stated in expense terms, where "up" means "we spent more":

    raw     = (now - then) / |then|
    expense = -raw

Negating rather than comparing magnitudes also stays correct when an account
flips sign: an expense of 100 that ends as a net credit of 50 is a 150%
decrease, which `-raw` gives and `|now|-|then|` would not.

Applied to **cogs, opex, other_expense** — sections and their accounts.
**Not** applied to Gross Profit, Net Operating Income or Net Income: those
are profit measures and keep the plain signed reading.

Underlying amounts are untouched; this is display only.

Confirmed against real data across every year:

| Year | Opex | Prior | Was | Now |
|---|---:|---:|---:|---:|
| **2019** | (3,694,294.11) | (1,974,357.92) | −87.1% | **+87.1%** |
| 2020 | (2,609,482.77) | (3,694,294.11) | +29.4% | **−29.4%** |
| 2023 | (3,106,850.09) | (1,773,395.82) | −75.2% | **+75.2%** |
| 2026 | (1,414,993.15) | (2,822,437.93) | +49.9% | **−49.9%** |

### Colour also follows favourability now

Previously the delta was coloured by whether the number was positive. After
the sign flip that would have painted an 87% rise in expenses the same
colour as an 87% rise in revenue. Rising expenses and falling income now
render as unfavourable, falling expenses and rising income as favourable.
Say the word if you would rather keep colour purely on the sign.

## Requested change: MTD / QTD — done

| Preset | Before | After |
|---|---|---|
| This month | 01-09 → 30-09 (calendar month) | **01-09 → today** |
| This quarter | 01-07 → 30-09 (calendar quarter) | **01-07 → today** |
| Last month | 01-08 → 31-08 | **unchanged** ✅ |

Verified under **10 timezones, UTC−11 → UTC+14**, clock pinned to
3 Sep 2026 (`frontend/test_dates.mjs`):

    MTD 2026-09-01..2026-09-03   QTD 2026-07-01..2026-09-03
    last month 2026-08-01..2026-08-31

Includes `Asia/Kathmandu` (+05:45), where 45-minute offsets break naive
date handling.

## Prior-year comparison now works

This was finding D, previously returning 0.00 for want of history. With
2018–2025 loaded:

    2025 net income   7,011,404.28
    2026 net income   4,450,415.63

## Suite status

| Suite | Result |
|---|---|
| `test_offline.py` | **49/49 pass** |
| `test_dates.mjs` | **10/10 timezones pass** |
| `test_variance.mjs` | **30/30 pass** |
| `test_live.py` | **34/35 pass** — the one failure is the 2026 ledger balance |
| `test_frontend_proxy.py` | **12/12 pass** |
| `npx tsc --noEmit` | clean |
| `npm run build` | exit 0 |

`test_variance.mjs` imports `lib/variance.ts` directly (Node 24 strips types
natively), so there is no mirrored copy of the logic to drift out of sync.

Everything still verified against independent SQL: Revenue, COGS, Operating
Expenses, Other Income/Expense, Gross Profit, Net Income all match, plus new
checks that the years 2018–2026 sum to the full-range total (catching
boundary-day errors) and that a 2018–2026 range is a true superset of 2026.

The app is faithful to what BigQuery contains. That is a different claim from
the numbers being right, and right now for 2026 they are not.

## Property display — unchanged, still verified

21 properties now (the historical load added one), 21 distinct labels.
`Sherman (1650)` and `Sherman (850)` remain separate entities with separate
amounts, both matching direct SQL.

Per-property total 4,721,212.55 vs consolidated 4,450,415.63; the
(270,796.92) gap is unallocated transactions, per finding B.

## Two stale assertions corrected

Neither was a product bug — both were tests encoding assumptions that the
data load invalidated:

1. `"2018 range returns the same total as 2026"` was only true while 2026
   was the sole year loaded. Replaced with a durable superset check plus
   year-by-year additivity.
2. The proxy test hardcoded the consolidated total `2,841,216.45`. It now
   fetches it, so it cannot go stale silently.

## Still outstanding

- **Re-extract 2026** — the one blocking item; in progress. Rerun
  `test_live.py` once it lands and the ledger-balance assertion should pass.
- **Depreciation** — parked at your request; no changes made.
- **P&L validation** — you have confirmed 2018–2025 ties to QuickBooks
  year by year. No further comparison needed for those years. 2026 remains
  unverifiable until re-extracted.
