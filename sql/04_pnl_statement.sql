-- ===========================================================================
-- PROFIT & LOSS STATEMENT
--
-- Self-contained: paste and run. Nothing needs to be created first.
--
-- Sign convention: amount = credit - debit
--   Revenue  -> POSITIVE
--   COGS     -> NEGATIVE
--   Expenses -> NEGATIVE
--
-- Because expenses are already negative, every subtotal is a straight
-- ADDITION. Gross Profit = Revenue + COGS. Net Income = the sum of
-- everything. There is no subtraction and no sign flip anywhere, which is
-- precisely why this convention is worth keeping consistent.
--
-- TO SET THE PERIOD: edit the two dates in the `pnl` CTE below.
-- ===========================================================================

WITH classified AS (

  WITH gl AS (
    SELECT
      date,
      account_name,
      department,
      COALESCE(SAFE_CAST(credit AS NUMERIC), 0)
        - COALESCE(SAFE_CAST(debit AS NUMERIC), 0) AS amount,
      LOWER(TRIM(account_name)) AS name_key
    FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`
  ),
  coa AS (
    SELECT
      LOWER(TRIM(name)) AS name_key,
      account_type
    FROM `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts`
    WHERE name IS NOT NULL
  )
  SELECT
    gl.date,
    gl.account_name,
    -- Display name: GL code stripped. "6100-01 Rent - Lyons" -> "Rent - Lyons".
    -- The guard keeps an account whose name is nothing but a code intact.
    CASE
      WHEN REGEXP_CONTAINS(gl.account_name, r'^[0-9]+(-[0-9]+)*\s+\S')
      THEN REGEXP_REPLACE(gl.account_name, r'^[0-9]+(-[0-9]+)*\s+', '')
      ELSE gl.account_name
    END AS display_name,
    gl.department,
    gl.amount,
    coa.account_type,
    CASE coa.account_type
      WHEN 'Income'             THEN 'revenue'
      WHEN 'Cost of Goods Sold' THEN 'cogs'
      WHEN 'Expense'            THEN 'opex'
      WHEN 'Other Income'       THEN 'other_income'
      WHEN 'Other Expense'      THEN 'other_expense'
      ELSE NULL
    END AS pnl_section,
    CASE coa.account_type
      WHEN 'Income'             THEN 1
      WHEN 'Cost of Goods Sold' THEN 2
      WHEN 'Expense'            THEN 3
      WHEN 'Other Income'       THEN 4
      WHEN 'Other Expense'      THEN 5
      ELSE 99
    END AS section_order
  FROM gl
  LEFT JOIN coa USING (name_key)

),

-- ---------------------------------------------------------------------------
-- PERIOD FILTER -- edit these dates.
-- ---------------------------------------------------------------------------
pnl AS (
  SELECT *
  FROM classified
  WHERE section_order <= 5                     -- P&L accounts only
    AND date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
    -- AND department = 'JMJ Realty, LLC'      -- uncomment for one property
),

account_lines AS (
  SELECT
    section_order,
    pnl_section,
    ANY_VALUE(display_name) AS display_name,
    ROUND(SUM(amount), 2) AS amount
  FROM pnl
  GROUP BY section_order, pnl_section, account_name
),

sec AS (
  SELECT pnl_section, SUM(amount) AS amount
  FROM account_lines
  GROUP BY pnl_section
),

t AS (
  SELECT
    SUM(IF(pnl_section = 'revenue',       amount, 0)) AS revenue,
    SUM(IF(pnl_section = 'cogs',          amount, 0)) AS cogs,
    SUM(IF(pnl_section = 'opex',          amount, 0)) AS opex,
    SUM(IF(pnl_section = 'other_income',  amount, 0)) AS other_income,
    SUM(IF(pnl_section = 'other_expense', amount, 0)) AS other_expense
  FROM sec
),

statement AS (

  -- Individual accounts
  SELECT
    CAST(section_order AS FLOAT64) AS sort_key,
    'account'                      AS line_type,
    pnl_section                    AS section,
    display_name                   AS line,
    amount
  FROM account_lines

  -- Section totals
  UNION ALL
  SELECT 1.5, 'total', 'revenue',       'Total Revenue',            revenue       FROM t
  UNION ALL
  SELECT 2.5, 'total', 'cogs',          'Total Cost of Goods Sold', cogs          FROM t
  UNION ALL
  SELECT 2.6, 'subtotal', 'gross_profit', 'GROSS PROFIT',           revenue + cogs FROM t
  UNION ALL
  SELECT 3.5, 'total', 'opex',          'Total Operating Expenses', opex          FROM t
  UNION ALL
  SELECT 3.6, 'subtotal', 'operating_income', 'NET OPERATING INCOME',
         revenue + cogs + opex FROM t
  UNION ALL
  SELECT 4.5, 'total', 'other_income',  'Total Other Income',       other_income  FROM t
  UNION ALL
  SELECT 5.5, 'total', 'other_expense', 'Total Other Expense',      other_expense FROM t
  UNION ALL
  SELECT 9.0, 'subtotal', 'net_income', 'NET INCOME',
         revenue + cogs + opex + other_income + other_expense FROM t
)

SELECT
  line_type,
  section,
  line,
  amount
FROM statement
ORDER BY
  sort_key,
  CASE line_type WHEN 'account' THEN 0 ELSE 1 END,
  line;
