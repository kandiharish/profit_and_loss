# Premium Profit & Loss Dashboard — Production Frontend Implementation Prompt

## ROLE

Act as a **Senior Product Designer + Staff/Principal Frontend Engineer** building a production-grade **Profit & Loss (P&L) financial reporting dashboard** for a real-estate/property-management platform.

The goal is NOT to create a flashy demo.

The goal is to create a **premium, classic, trustworthy, executive-level financial reporting experience** while strictly following the existing dashboard design system and preserving the existing business functionality.

The final product should feel like:

**Institutional Finance × Modern Premium SaaS × Excellent UX**

Think:
- Bloomberg-level financial seriousness
- Stripe-level polish
- Linear-level interaction quality
- Classic accounting/reporting discipline

Avoid:
- flashy AI-dashboard aesthetics
- crypto-dashboard styling
- excessive gradients
- excessive glassmorphism
- unnecessary 3D effects
- excessive animations
- giant rounded cards
- neon colors
- decorative elements that don't improve usability

The product should look expensive because it is **precise, clean, responsive, consistent, and thoughtfully animated**.

---

# 1. PRIMARY OBJECTIVE

There is already a Profit & Loss page/application.

Do NOT replace the existing functionality with a completely new implementation.

Instead:

1. Inspect the existing P&L page.
2. Understand the existing components.
3. Understand the existing API.
4. Understand the existing data model.
5. Reuse existing dashboard components and utilities.
6. Apply the existing design-system rules.
7. Improve the visual hierarchy.
8. Add purposeful premium interactions.
9. Fix the P&L loading/error flow where necessary.
10. Preserve existing business logic and API contracts unless a real bug requires modification.

The final page should feel like a mature production product rather than a prototype.

---

# 2. EXISTING DESIGN SYSTEM IS THE SOURCE OF TRUTH

The existing dashboard formatting standard must be treated as the primary design specification.

Where the repository already contains a component, utility, token, or pattern for something, **reuse it instead of creating another version**.

Do not invent a competing design system.

---

# 3. PAGE SHELL

Use the existing dashboard shell.

The main dashboard content should follow the existing layout:

`relative min-w-0 flex-1 px-10 py-6`

Maintain consistent page spacing.

Do not create arbitrary page-specific padding.

Panels must use the existing `.panel` component/class.

Panel characteristics:

- 16px border radius
- existing card surface token
- existing border token
- existing layered shadow
- proper light/dark theme behavior

The overall page should feel spacious but information-dense enough for financial reporting.

---

# 4. DESIGN TOKENS

Never hard-code surface, text, border, or theme colors.

Use the existing design tokens:

- `--color-page`
- `--color-card`
- `--color-ink`
- `--color-muted`
- `--color-line`
- `--color-input`
- `--neo-accent`
- `--positive`
- `--negative`

Use the existing theme system.

The page must work correctly in:

- Light theme
- Dark theme

Do not build something that only looks good in light mode.

All chart colors must also respect the existing theme readability system.

Use the existing:

`readableColor(hex, theme)`

where appropriate.

---

# 5. NAVIGATION

The existing dashboard tab bar must remain sticky.

The existing Primary / Secondary / Tertiary navigation strip must remain sticky.

The P&L filter card must **NOT** be sticky.

Do not create a new sticky-filter implementation.

Use the existing:

- `StickyTabBar`
- `StickySubTabBar`

and respect their dynamic height behavior.

Do not hard-code sticky offsets if the existing implementation already measures them dynamically.

---

# 6. P&L HEADER

Create a clean executive-level header.

Example:

## Profit & Loss

All properties · Sep 1, 2026 – Sep 8, 2026

Optional metadata:

`Updated just now`

The header should have:

- strong title hierarchy
- restrained typography
- muted secondary information
- generous whitespace
- clear relationship between title and selected reporting period

Do NOT use a giant hero section.

Do NOT waste vertical space.

The user should immediately understand:

**What report am I looking at?**

**What period am I looking at?**

**What property scope am I looking at?**

---

# 7. FILTER PANEL

The filter panel must remain a standard `.panel`.

The existing functionality includes:

- From date
- To date
- Property
- Compare to
- Quick date presets

Quick presets may include:

- This month
- Last month
- This quarter
- YTD
- Last year
- Since 2018

Comparison options may include:

- Prior year
- Prior period
- No comparison

Include:

- Load Data
- Reset

---

# 8. FILTER BEHAVIOR

Dates must use actual calendar inputs.

Do not create date dropdowns.

The End / Reporting Date should default to yesterday.

Yesterday must remain selectable even if backend data is lagging.

Load Data should be explicit.

Reset should restore the default filter state.

Reset must NOT simply clear the form.

Selections should survive a tab switch within the dashboard.

Selections should clear when leaving the dashboard if that is the established application behavior.

---

# 9. FILTER MICRO-INTERACTIONS

Use subtle premium interactions.

### Input focus

On focus:

- slightly strengthen border
- subtle accent focus ring
- no aggressive glow

### Dropdown

Opening:

- fade in
- approximately 4px vertical movement

Closing:

- short fade-out

### Presets

Selected preset should have:

- clear active state
- subtle transition
- no oversized pill animation

### Buttons

Hover:

- subtle surface/border change

Press:

- tiny scale or positional response if appropriate

Keep standard transitions around:

**150–180ms**

---

# 10. LOAD DATA EXPERIENCE

When the user clicks `Load Data`:

1. Prevent duplicate submissions where appropriate.
2. Show a compact loading state.
3. Preserve the page layout.
4. Fetch real data.
5. Transition to the new data.
6. Update the last-updated indicator.
7. Restore controls.
8. Show a professional error state if the request fails.

Do NOT use a giant full-page spinner.

Do NOT make the entire page disappear while loading.

---

# 11. SKELETON LOADING

Use skeleton states instead of generic:

`Loading...`

Skeletons should exist for:

- KPI cards
- charts
- tables

Skeleton design must use existing neutral surface tokens.

When data loads:

`skeleton → actual content`

Use a subtle opacity/transform transition.

Avoid layout shift.

The page should retain its approximate structure while loading.

---

# 12. ERROR STATE

The current P&L page may return an HTTP 500 error such as:

`Could not load the P&L`

`Request failed (500)`

Treat this as a real backend/API issue.

Do NOT hide the error.

Do NOT replace the data with fake/mock values.

Do NOT hard-code P&L numbers.

Do NOT silently swallow the backend exception.

The UI should display a professional error state such as:

### Could not load the P&L

Unable to retrieve the report right now. Please try again.

[Retry]

Use the application's established error component if one exists.

Never expose raw stack traces or internal backend implementation details to normal users.

---

# 13. HTTP 500 DEBUGGING

Investigate the complete request path:

Frontend

↓

API request

↓

Request parameters

↓

Backend validation

↓

Database query

↓

Aggregation/calculation

↓

Response serialization

Determine the actual root cause.

Possible causes may include:

- invalid parameters
- date handling
- missing property ID
- comparison-period calculation
- database query failure
- aggregation issue
- serialization issue
- unexpected null values

Fix the actual root cause.

Do not mask the problem on the frontend.

If the API contract is correct, preserve it.

---

# 14. EXECUTIVE KPI SECTION

If supported by the existing P&L data, provide a high-level financial summary.

Recommended metrics:

- Revenue / Total Income
- Expenses
- Net Profit
- Profit Margin
- Comparison/change

Example:

Revenue

`₹9,18,250`

`↑ 9.2% vs prior period`

Expenses

`-₹6,25,000`

`↓ 3.1%`

Net Profit

`₹2,93,250`

`↑ 14.8%`

These are examples only.

Do not hard-code them.

Use actual application data.

---

# 15. KPI CARD DESIGN

KPI cards should be:

- compact
- aligned
- clean
- highly readable
- information-dense
- visually consistent

Financial values are the primary visual element.

The supporting percentage/trend should be secondary.

Use semantic colors only where useful:

- trend arrow
- percentage
- tiny indicator
- relevant financial visualization

Do NOT make an entire card bright green or red.

Keep the majority of the card neutral.

This creates a more mature financial-product aesthetic.

---

# 16. KPI ANIMATION

When the financial value changes after a successful data refresh:

Optionally animate the number.

Example:

`₹8,42,500`

→

`₹9,18,250`

Animation:

- approximately 300–500ms
- smooth
- no bounce
- no elastic effects

The animation must stop being used when:

`prefers-reduced-motion: reduce`

is enabled.

---

# 17. P&L REPORT STRUCTURE

Organize the report according to the actual application data.

Where supported, use financial sections such as:

## Revenue / Income

- Rental income
- Other income
- applicable income categories
- Total income

## Expenses

- Maintenance
- Utilities
- Management fees
- applicable operating expenses
- Other expenses
- Total expenses

## Profit

- Net operating income / net profit
- Profit margin
- comparison against selected comparison period

IMPORTANT:

Do not invent financial categories that don't exist in the application's actual data model.

The existing API/data model is the source of truth.

---

# 18. FINANCIAL TABLE

Use the existing table system.

Requirements:

- sticky table header
- sticky totals footer where applicable
- sticky behavior should be applied to cells
- numeric columns right aligned
- numbers use tabular figures
- text columns left aligned
- blank values display as `—`

Use a clear hierarchy.

Example:

Revenue                              ₹12,45,000

    Rental Income                    ₹10,80,000

    Other Income                       ₹85,000


Expenses                              -₹6,25,000

    Maintenance                       -₹2,10,000

    Utilities                         -₹1,20,000


──────────────────────────────────────────────

Net Profit                            ₹6,20,000

Totals should be visually stronger but not oversized.

---

# 19. FINANCIAL NUMBER FORMATTING

Follow the existing formatting rules.

Dollar:

Value:

`$1,234.56`

Axis:

`$1,650`

Percent:

Value:

`85.00%`

Axis:

`23.5%`

Number:

Value:

`1,235`

Axis:

`1,650`

Never abbreviate axis labels as:

`12k`

`$12k`

Avoid repeated identical axis labels.

Use enough axis width to display complete values.

---

# 20. CHART LIBRARY

Use the chart library already established in the repository.

Do NOT add a fourth chart library.

Prefer the existing Recharts infrastructure for new charts where applicable.

Reuse existing chart components and utilities.

---

# 21. P&L CHARTS

Where supported by the existing data, consider:

### Profit Trend

Display:

- Revenue
- Expenses
- Profit
- Comparison series

### Expense Breakdown

Display the expense composition.

Use the existing donut/pie component where the visualization represents positive composition.

Do NOT place text labels directly on donut wedges.

Use the existing interactive legend.

If a visualization needs to represent negative values, do not force negative values into a donut.

Use a visualization capable of representing positive and negative values correctly.

---

# 22. CHART AXIS

Never rely on chart-library defaults.

Use the existing:

`fitDomain`

and:

`fittedAxis`

The axis should fit closely to the actual data.

Target:

- 1% below the lowest plotted value
- 1% above the highest plotted value

Negative data must work correctly.

Never clamp negative financial values to zero.

Bars and filled areas should remain zero-based where appropriate.

Flat series require their dedicated tight range behavior.

---

# 23. ZERO VS NO DATA

This is a financial correctness requirement.

In chart rendering:

`0` means no data according to the existing dashboard convention.

Map zero values to:

`null`

for chart rendering.

If a series has no non-zero values:

- remove it from the chart
- remove it from the legend

Do NOT visually represent missing data as an actual zero.

CSV exports must preserve raw zero values.

---

# 24. CHART HEIGHTS

Default line chart:

`300px`

Compact chart:

`240px`

Fullscreen:

Use the existing fullscreen height implementation.

Do not create arbitrary chart heights.

---

# 25. CHART TOOLBAR

Every chart card should use the existing standard chart toolbar.

Exact order:

`Download CSV`

`Download PNG`

`Zoom out`

`Zoom in`

`Fullscreen`

`Reset view`

Reuse the existing `ChartToolbar`.

Do not create a second custom chart toolbar.

---

# 26. CHART TOOLTIP

Use the established premium glass tooltip style.

Characteristics:

- existing surface token
- approximately 84% surface opacity where applicable
- backdrop blur
- existing border
- 12px radius

Rows should be:

**largest value first**

Maximum visible rows:

**12**

If more than 12:

- tooltip supports wheel scrolling
- display range information
- example: `13–24 of 45`
- do not create a scroll trap

Clicking a line:

- focuses that series
- dims other series
- preserves comparison context

Clicking the chart:

- pins the tooltip
- keeps it inside the chart
- supports a real scrollbar

Escape or second click:

- releases the pinned tooltip

---

# 27. CHART LEGENDS

Legends must be interactive.

Single click:

Hide/show series.

Double click:

Isolate one series.

Double click again:

Restore all series.

A double click must not also trigger the single-click behavior.

Where required, use approximately 250ms click disambiguation.

Dead/no-data series must never appear in the legend.

---

# 28. CHART COLORS

Use the existing identity palette.

An entity must keep the same color everywhere:

- filter pill
- chart
- legend
- tooltip
- donut
- tile

Do NOT assign colors simply based on array position.

All colors must pass through the existing theme readability system.

Use the same resolved color for:

- line
- legend swatch
- tooltip indicator
- donut wedge

---

# 29. PREMIUM PAGE ENTRANCE

Add a subtle page entrance animation.

Recommended:

`opacity: 0 → 1`

combined with:

`translateY(6px) → translateY(0)`

Use a subtle stagger.

Suggested:

- header
- filter panel
- KPI cards
- charts
- tables

Stagger approximately:

`40–60ms`

The total animation should finish quickly.

The animation should communicate hierarchy, not show off.

---

# 30. PREMIUM CARD HOVER

KPI cards and interactive panels may use a very subtle hover treatment.

On hover:

- `translateY(-2px)`
- slightly stronger existing shadow
- subtle border emphasis

Do NOT:
- scale cards dramatically
- add glowing borders
- change the entire card color

The effect should be barely noticeable but make the UI feel polished.

---

# 31. CHART ENTRY ANIMATION

For line charts:

- animate the line progressively from left to right
- approximately 500–700ms

For bars:

- animate from the baseline upward
- approximately 400–500ms

Do not replay chart animation on every mouse movement.

Replay only when:

- chart first loads
- new data arrives
- major filter/query changes

Respect reduced motion.

---

# 32. FINANCIAL SECTION EXPANSION

If the P&L structure supports expandable sections, implement:

Revenue

`▼ Revenue                         ₹12,45,000`

    Rental Income                  ₹10,80,000

    Parking                           ₹85,000

    Other Income                      ₹80,000


Expenses

`▼ Operating Expenses              -₹6,25,000`

    Maintenance                    -₹2,10,000

    Utilities                      -₹1,20,000

    Management Fees                -₹1,50,000

Clicking the section should expand/collapse smoothly.

Use:

- height transition
- opacity transition
- approximately 150–180ms

Do not create unnecessary accordion complexity if the existing page does not benefit from it.

---

# 33. DATA REFRESH INDICATOR

Provide a small financial-reporting status indicator.

After successful load:

`Updated just now`

After time passes:

`Updated 12 seconds ago`

Keep this:

- small
- muted
- unobtrusive

Its purpose is to communicate data freshness.

---

# 34. EXPORT FEEDBACK

After a successful CSV or PNG export:

Show subtle confirmation.

Example:

`✓ CSV downloaded`

or:

`✓ PNG exported`

Do not use huge animated notifications.

Keep feedback concise.

---

# 35. TABLE MICRO-INTERACTIONS

On table row hover:

- subtle surface highlight
- smooth transition
- no movement

Numbers should never jump.

Columns must remain perfectly aligned.

This is a financial interface.

Precision beats decoration.

---

# 36. FULLSCREEN CHART EXPERIENCE

When fullscreen is activated:

- chart should expand smoothly
- surrounding UI should fade/recede
- toolbar remains accessible
- chart should use available viewport height
- Escape should restore the previous view

Keep the transition short.

The fullscreen experience should feel like a professional analytics workspace.

---

# 37. MOTION PRINCIPLES

Motion must communicate:

- loading
- hierarchy
- state changes
- filtering
- comparison
- expansion
- success
- focus

Motion must NOT exist simply because "animation looks cool."

Default transitions:

**150–180ms**

Longer chart-entry animation is acceptable where it communicates data rendering.

---

# 38. REDUCED MOTION

Respect:

`prefers-reduced-motion`

When enabled:

- remove large movement
- remove chart drawing animations
- remove count-up effects
- minimize transitions

Accessibility takes priority over visual effects.

---

# 39. RESPONSIVE DESIGN

The dashboard must work on:

- desktop
- laptop
- supported tablet sizes

Do not allow:

- clipped financial values
- overlapping filters
- broken chart legends
- clipped axis labels
- unnecessary horizontal scrolling
- broken tables

At narrower widths:

- allow filters to wrap
- reorganize controls
- preserve financial hierarchy
- keep important values visible

---

# 40. ACCESSIBILITY

Ensure:

- keyboard navigation
- visible focus states
- semantic buttons
- accessible labels
- sufficient contrast
- chart controls are accessible where possible
- no interaction depends exclusively on hover
- reduced-motion support

Never communicate financial state through color alone.

For example, instead of only:

GREEN

use:

`↑ 12.4%`

and optionally a semantic icon.

---

# 41. CSV EXPORT

Use the existing CSV utility.

The CSV header must be the union of all row keys in first-appearance order.

Do NOT use:

`Object.keys(rows[0])`

because chart rows may be sparse.

Cells with no value must remain empty.

CSV exports must contain:

- full date range
- every series
- full underlying data

Do not export only the currently zoomed chart window.

---

# 42. PERFORMANCE

Keep the interface fast.

Avoid:

- unnecessary re-renders
- expensive animations
- massive DOM trees
- unnecessary dependencies
- duplicate API requests
- repeated chart recalculations
- expensive effects on every mouse movement

Do not sacrifice performance for visual polish.

A premium dashboard must feel fast.

---

# 43. ENGINEERING RULES

Before making changes:

1. Inspect the current P&L implementation.
2. Inspect existing dashboard components.
3. Inspect existing panel components.
4. Inspect existing filter components.
5. Inspect existing KPI/card components.
6. Inspect existing chart components.
7. Inspect existing tooltip implementation.
8. Inspect existing legend behavior.
9. Inspect existing ChartToolbar.
10. Inspect existing table components.
11. Inspect existing theme utilities.
12. Inspect existing animation utilities.
13. Inspect the P&L API endpoint.
14. Inspect the P&L response shape.
15. Identify the source of the HTTP 500.

Then implement.

---

# 44. DO NOT DUPLICATE EXISTING SYSTEMS

If the repository already has:

- a Panel component
- a Button component
- an Input component
- a DatePicker
- a Select
- a KPI component
- a Table
- a ChartToolbar
- a Tooltip
- a Theme utility
- a Toast
- a Loading/Skeleton component

reuse it.

Do not create:

`PremiumPanel`

`PremiumButton`

`CustomTooltip2`

`NewChartToolbar`

just for this page.

Extend existing components only when necessary.

---

# 45. DO NOT CHANGE BUSINESS LOGIC FOR DESIGN

Do not alter:

- financial calculations
- accounting logic
- API semantics
- existing business rules
- property selection behavior
- comparison-period meaning

just to make the UI easier to implement.

UI should adapt to the existing domain model.

---

# 46. PREMIUM VISUAL DIRECTION

The final design should have:

### Typography

- clear hierarchy
- strong financial numbers
- restrained headings
- muted metadata

### Surfaces

- clean cards
- subtle borders
- controlled shadows
- no excessive depth

### Color

- neutral foundation
- single brand accent
- semantic financial colors

### Layout

- strong alignment
- generous whitespace
- clear grouping
- consistent spacing

### Motion

- subtle
- fast
- purposeful

### Data

- precise
- readable
- trustworthy

---

# 47. WHAT NOT TO DO

DO NOT add:

- neon gradients
- animated gradient backgrounds
- particles
- floating 3D cards
- excessive blur
- huge shadows
- excessive glow
- bouncing KPIs
- rotating charts
- decorative graphs that don't represent real data
- giant illustrations
- unnecessary badges
- excessive pill-shaped UI
- confetti
- flashy page transitions
- fake data

Do not make the dashboard look like a gaming UI.

This is financial software.

---

# 48. UX PRIORITY

Always prioritize in this order:

1. Financial correctness
2. Readability
3. Information hierarchy
4. Existing design-system consistency
5. Performance
6. Accessibility
7. Interaction quality
8. Premium visual polish
9. Decorative animation

Never reverse this priority.

---

# 49. IDEAL PAGE STRUCTURE

The final page should conceptually follow:

```text
Profit & Loss                            Updated just now
All properties · Sep 1 – Sep 8

┌───────────────────────────────────────────────────────┐
│ Filters                                               │
│                                                       │
│ From       To         Property       Compare          │
│ [date]     [date]     [All]         [Prior year]     │
│                                                       │
│ This month  Last month  This quarter  YTD             │
│ Last year   Since 2018                         Load   │
└───────────────────────────────────────────────────────┘


┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Revenue       │ │ Expenses      │ │ Net Profit    │
│ ₹9,18,250     │ │ -₹6,25,000    │ │ ₹2,93,250     │
│ ↑ 9.2%        │ │ ↓ 3.1%        │ │ ↑ 14.8%       │
└───────────────┘ └───────────────┘ └───────────────┘


┌──────────────────────────────────┐ ┌────────────────────┐
│ Profit Trend                     │ │ Expense Breakdown  │
│                                  │ │                    │
│ Revenue ────────────────         │ │ Maintenance        │
│ Expenses ───────────────         │ │ Utilities          │
│ Profit ─────────────────         │ │ Management         │
│                                  │ │                    │
│ CSV PNG Zoom Fullscreen Reset    │ │ Interactive legend │
└──────────────────────────────────┘ └────────────────────┘


┌───────────────────────────────────────────────────────┐
│ Profit & Loss Statement                               │
│                                                       │
│ Revenue                                  ₹12,45,000   │
│   Rental Income                           ₹10,80,000   │
│   Other Income                               ₹85,000   │
│                                                       │
│ Expenses                                  -₹6,25,000  │
│   Maintenance                             -₹2,10,000  │
│   Utilities                               -₹1,20,000  │
│                                                       │
│ ───────────────────────────────────────────────────── │
│ Net Profit                                 ₹6,20,000  │
└───────────────────────────────────────────────────────┘