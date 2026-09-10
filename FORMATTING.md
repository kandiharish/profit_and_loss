# Dashboard formatting standard

Every visual and behavioural rule this tool has settled on, in one place.

**Why it exists.** These decisions were made one at a time, over many rounds of
"that looks wrong". Each is written here with the reason, so the next tool can
adopt the whole set at once instead of rediscovering them, and so anyone can
tell a deliberate choice from an accident.

**How to use it.** Read it before building a new dashboard, page or chart in
this repo. For a *new* tool, hand this file to whoever (or whatever) is
building the UI and treat it as the spec. Where a rule names a file, that file
is the implementation — copy it rather than reimplementing from the prose.

**When a rule changes**, change it here in the same commit as the code. A rule
that disagrees with the code is worse than no rule.

---

## 1. Foundations

### 1.1 Token sheet

One scoped token sheet: `frontend/app/cwc/neo.css`, scoped under `.cwc-neo`.
Every page opts in with `<div className="cwc-neo cwc-surfaces …">`. Both themes
are fully tokenised; `[data-theme="light"]` flips the whole scope.

Never hard-code a surface, text or border colour. Use:

| Token | Role |
|---|---|
| `--color-page` | page background |
| `--color-card` | panel / card surface |
| `--color-ink` | primary text |
| `--color-muted` | secondary text, axis labels |
| `--color-line` | borders, gridlines |
| `--color-input` | input and control fill |
| `--neo-accent` | the single brand accent (teal-cyan) |
| `--positive` / `--negative` | semantic up/down |

Dark surfaces carry **zero chroma** on purpose. They previously sat at hue 258
with slight chroma and read as blue-black rather than black.

### 1.2 Page shell

- Sidebar, then `<div className="relative min-w-0 flex-1 px-10 py-6">`.
- `px-10 py-6` is uniform across every dashboard page. The pinned bars depend
  on it (§2.1), so do not vary it per page.
- Panels use `.panel`: 16px radius, `--color-card` on `--color-line`, with a
  layered shadow that is lighter in the light theme.

### 1.3 Theme

Two themes, both first-class. Anything that only works in one is a bug — see
§3.3. Read the current theme with `useThemeContext()`.

---

## 2. Layout and freezing

### 2.1 What is pinned, and what is not

**Pinned:** the dashboard tab strip (`StickyTabBar`) and, under it, the
Primary / Secondary / Tertiary strip (`StickySubTabBar`). About 40px each.
`frontend/components/ui/sticky_tabbar.tsx`.

**Not pinned:** the filter card. Ever.

The filter card used to be pinned. On ICARUS and ICARUS Country it is an
app × country picker ten rows tall, so it held the top third of the viewport
permanently and the charts were read through the slot underneath. Filters are
set once per question; the row that tells you where you are is what you need
while scrolling.

Both bars pull out to the page's own `px-10` with negative margins, so charts
scroll *under* an opaque blurred band rather than through the side gutters.

The sub-strip's offset is **measured, not assumed**: `StickyTabBar` publishes
its height as `--tabbar-h` on `<html>` via a `ResizeObserver`. A hard-coded
offset breaks when a nine-tab strip wraps to two rows.

### 2.2 Docks

Search dock and Data Refresh are `fixed` at the top-right, `z-40`, `md:` and
up only. Pinned bars sit at `z-30`, sidebar at `z-30`, modals at `z-[90]`.

---

## 3. Colour

### 3.1 Palettes

| Palette | Where | Source |
|---|---|---|
| Nine-stop series ramp | CWC channels, portfolio bar, tiles | `--series-1..9`, mirrored as hex in `dashboards/cwc/tokens.ts` |
| App identity colours | every app-coloured chart | `api/routers/cwc.py: APP_COLORS` |
| Traffic channel colours | channel-coloured charts | `api/routers/cwc.py: TRAFFIC_CHANNEL_COLORS` |
| Measure roles | spend / CAC / ARPU lines | `--chart-1..5` |

An app or channel keeps **one colour everywhere** — its filter pill, its line,
its legend swatch, its pie wedge and its tile all agree. Colour assigned by
position in a sorted list is a bug: the same channel then changes colour
between charts.

### 3.2 Shades within a group

`_generate_shades` (`api/routers/icarus.py`) walks a base colour out to
`[base, lighter, darker, lighter², darker², …]`, capped at 0.75.

**A base at either extreme ramps one way instead.** Lightening white returns
white, so alternating gave several series the identical colour: ORGC is
channel 99, `#FFFFFF`, and the App Channel tabs group by channel, so seven
apps' ORGC lines came out as four identical whites plus three greys.

### 3.3 Readability across themes

The API ships **one palette for both themes**, so the frontend corrects it at
render: `readableColor(hex, theme)` in `frontend/lib/theme.ts`. Apply it
wherever a colour enters a chart — lines, legend swatches, tooltip dots and
wedges must all agree.

- **Neutrals invert.** `#FFFFFF` → `#000000` in light mode, and a grey ramp
  inverts with it so the series stay as distinct as they were. There is no hue
  to lose.
- **Hued colours are walked toward the readable side** and keep their identity:
  a pale blue darkens into a readable blue rather than turning grey.
- Thresholds: too light above 0.82 HSL lightness, too dark below 0.18.

### 3.4 App order

One sequence everywhere, `APP_ORDER` in `api/legacy/app_entity_map.py`:

```
AT, IQ, CT, CT-JP, CT-Non-JP, EN, MB, FS, JF, CL, CV, RT, RL, PD, CN, DT, VG
```

`CT` sits with `CT-JP` / `CT-Non-JP` because it is the same entity un-split.
`DT` and `VG` close the list, VG last.

Every app list the API serves is in this order — filters, dropdowns, the admin
App Access picker. A list built from data rather than the registry passes
through `sort_apps()`. `frontend/lib/theme.ts` carries a matching copy for the
charts that order entities client-side; keep the two in step.

---

## 4. Charts

### 4.1 Which library

Three are in use. Do not add a fourth, and prefer the first for anything new.

| Library | Used by |
|---|---|
| Recharts | ICARUS, ICARUS Country, Cohort Analyser, LMC, All : Net Revenue, CWC |
| ECharts | CWC small multiples, home |
| Plotly | Daedalus, Retention, Vol/Val |

Each defaults differently — §4.2 is the reason this matters.

### 4.2 Y-axis — sit on the data

> **The axis runs from 1% below the lowest plotted value to 1% above the
> highest** — of each bound, not of the span. Primary and secondary axis alike.

One percent lifts the extreme points off the frame edge, where their stroke
would otherwise be half-clipped, without opening the chart wider than its own
data. A pad proportional to the *span* does exactly that and is what made tight
charts unreadable.

A flat series (every point identical) is the one case that needs its own band,
since a zero-height domain draws nothing. Its band is ±0.05%, deliberately
much tighter than the pad — a flat series has no span to be proportional to,
and 1% of 7,000 would open a ±70 axis under a line that never moves.

`fitDomain` in `frontend/components/dashboards/cwc/chart_kit.tsx`, spread onto
the axis with `fittedAxis(domain)`.

- Never leave a library's default in place. Recharts defaults to `[0, "auto"]`,
  which pins the axis at zero and squashes any series living above it. ECharts
  needs `scale: true`. Plotly auto-fits already.
- **Negative data needs no special case.** The pad is applied away from zero on
  each side. Never clamp a lower bound up to zero: a series running −13…−0.5
  becomes the domain `[0, −0.17]`, min above max, and the chart renders upside
  down with every line clipped away.
- **`includeZero` is the one exception**, and it is not cosmetic: a trace
  filled to the baseline (`fill="tozeroy"`) is a lie if the baseline is not
  zero.
- **Bars and filled areas stay zero-based.** A lifted floor misstates their own
  proportions.
- Ticks are round values laid *inside* the fitted range (`niceTicks`), not
  Recharts' own — an explicit domain otherwise prints two ticks with the same
  label on a tight range.
- The Tukey outlier clamp (`robustDomain`) is **opt-in and used by T7D CAC
  alone**, where one incomplete trailing day blows the scale up.

### 4.3 Zeros are gaps

A zero means "no data", not "the metric was zero" — drawing it as zero shows a
crash to the axis. `nz()` / `gap()` map `0` to `null`, and a series with no
non-zero value anywhere is dropped from the chart and its legend entirely
(`liveKeys`).

Note the asymmetry: CSV exports keep the raw `0`, so a chart's line can stop
where its export still reports zeros.

### 4.4 Number formats

| Format | Tooltip / value | Axis tick |
|---|---|---|
| dollar | `$1,234.56` | `$1,650` — decimals from the tick step |
| percent | `85.00%` | `23.5%` — decimals from the tick step |
| number | `1,235` | `1,650` — decimals from the tick step |

**Never abbreviate an axis tick.** `$12k` / `12k` collapses every tick onto the
same string on any axis whose range is narrow relative to its magnitude: a
Subscriptions axis around 7,000 read `7k 7k 7k 7k 7k 7k`, and Rebills between
1,645 and 1,820 read `2k 2k 2k 2k`. An axis whose labels are all identical
tells you nothing about where a point sits.

Decimals come from the tick step (`tickDecimals`), so an ordinary range still
prints whole numbers and only a tight one grows decimals. Percent values travel
as fractions and are multiplied at the edge, which consumes two of the step's
decimals.

Allow ~68px of axis width for full numbers; a clipped tick label is worse than
a slightly narrower plot.

### 4.5 Heights

300px is the default line-chart height; 240 for compact panels. Fullscreen
swaps the pixel height for `100%` (`chartHeight()`), which is what lets a chart
fill the screen.

### 4.6 Donuts and pies

**One component: `frontend/components/charts/donut_chart.tsx`.** Ring on the
left at full card height, legend on the right with a percentage per row, hover
dims the other wedges and swaps the centre figure to that slice's value.

Never write labels onto the wedges. It is legible for five slices and
unreadable for twenty — names collide, overflow the plot, and steal the space
the ring needs. Move them into a legend that can scroll.

Legend behaviour: **click hides** a slice and the rest renormalise to 100%,
**double-click isolates** one, double-clicking the isolated slice restores
everything.

---

## 5. Tooltips

- Glass surface: `--color-surface` at ~84% with `backdrop-blur`, on
  `--color-line`, 12px radius.
- Rows sorted **biggest value first** — with a dozen series the ranking is the
  read.
- Capped at **12 rows**. Past that the tooltip is taller than the chart and
  gets clipped by the panel.
- **The wheel scrolls the tooltip** when it overflows, a row at a time, showing
  `13–24 of 45`. The wheel is taken *only* while the tooltip actually
  overflows, and handed back to the page at either end, so a chart is never a
  scroll trap. Register the listener by hand with `{ passive: false }` — React
  attaches wheel handlers passively and a passive listener cannot
  `preventDefault()`.
- **Click a line to focus it**: the tooltip narrows to that series and the
  others dim rather than disappearing, so the comparison survives.
- **Click the chart to pin**: a copy inside the chart box, every row, with a
  real scrollbar. Escape or a second click releases it.

---

## 6. Legends

Interactive everywhere: **click to hide, double-click to show only that one**,
double-click again to restore. A double-click must not also fire the single
click — delay the first by ~250ms so the second can cancel it.

Dead series never appear (§4.3).

---

## 7. Toolbar and exports

Every chart card carries the same toolbar, in this order:

`Download CSV · Download PNG · Zoom out · Zoom in · Fullscreen · Reset view`

`ChartToolbar` in `dashboards/cwc/chart_kit.tsx`. Zoom is an index window over
the points (`useChartWindow`), 0.7× per step.

### CSV rules

`toCsv` in `frontend/lib/csv.ts`. **The header is the union of every row's
keys, in first-appearance order — never `Object.keys(rows[0])`.** Chart rows
are sparse by design, so the first row carries only the series that had data on
the earliest date: eleven AFIDs on screen exported as a two-column file, and
silently, because the surviving columns still looked valid.

Cells with no value stay empty rather than becoming `0`, so "no data" stays
distinct from "zero".

Exports carry the **full date range and every series**, not the zoomed window
or only the visible lines.

---

## 8. Filters

- App order per §3.4.
- Filter card is a `.panel`, and does **not** stick (§2.1).
- Dates are calendar inputs, never dropdowns of dates.
- Every End / Reporting Date defaults to **yesterday**, and the picker must
  allow yesterday even when the data lags.
- Explicit **Load Data**; **Reset** returns the defaults, it does not empty the
  form.
- Selections survive a tab switch within a dashboard and clear on leaving it.

---

## 9. Tables

Sticky `<thead>` and, where there is a totals row, a sticky `<tfoot>` — pinned
on the **cells**, not the row: Safari still does not honour `position: sticky`
on `thead`/`tr`.

Numbers right-aligned and tabular (`.num`); text columns left-aligned. Blank
cells show `—`.

---

## 10. Motion

Lenis smooth scrolling, mounted per page, disabled under
`prefers-reduced-motion`. Decorative animations pause while scrolling via
`data-scrolling` on `<html>`.

Transitions are short: 150–180ms for hover and opacity.

---

## 11. Checklist for a new chart

1. Panel wrapper (`.panel`), title, toolbar in the standard order.
2. Colours from the identity palette, through `readableColor`.
3. Y-axis via `fitDomain` + `fittedAxis`. Bars and filled areas zero-based.
4. Zeros mapped to `null`; dead series dropped.
5. Tooltip capped at 12 with wheel-scroll; rows biggest first.
6. Legend click-to-hide, double-click-to-isolate.
7. CSV through `toCsv`; check a sparse-row case.
8. Look at it in **both themes** before calling it done.

---

## 12. Open, not settled

Do not read these as decided:

- **Vol/Val's "Profit Distribution"** is a polar bar chart, not a pie — bar
  length is profit from a baseline ring, and losses draw inward as negative
  bars. It is deliberately not a donut, because a donut cannot show a negative
  share.
- **CWC's "Jump to" section nav** lost its pinning when the filter card was
  unpinned. It may deserve a thin bar of its own.
- **Chart-level PDF export** does not exist here (parity items IC-17 / NR-7 /
  SH-6).
