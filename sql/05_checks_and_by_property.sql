-- ===========================================================================
-- POST-MAPPING CHECKS + P&L BY PROPERTY
-- All read-only.
-- ===========================================================================

WITH classified AS (
  WITH gl AS (
    SELECT
      date, account_name, department,
      COALESCE(SAFE_CAST(credit AS NUMERIC), 0)
        - COALESCE(SAFE_CAST(debit AS NUMERIC), 0) AS amount,
      LOWER(TRIM(account_name)) AS name_key
    FROM `spherical-entry-506811-j2.qbo_api.general_ledger`
  ),
  coa AS (
    SELECT LOWER(TRIM(name)) AS name_key, account_type
    FROM `spherical-entry-506811-j2.qbo_api.chart_of_accounts`
    WHERE name IS NOT NULL
  )
  SELECT
    gl.*,
    coa.account_type,
    coa.name_key IS NULL AS is_unmatched,
    coa.account_type IN ('Income','Cost of Goods Sold','Expense',
                         'Other Income','Other Expense') AS is_pnl
  FROM gl
  LEFT JOIN coa USING (name_key)
)

-- ---------------------------------------------------------------------------
-- 5a. Did every GL row classify? EXPECT: one row, is_unmatched = false.
--     Any unmatched row is money silently missing from the P&L.
-- ---------------------------------------------------------------------------
SELECT
  is_unmatched,
  COUNT(*)                     AS rows,
  COUNT(DISTINCT account_name) AS distinct_accounts,
  ROUND(SUM(amount), 2)        AS total_amount
FROM classified
GROUP BY is_unmatched;


-- ---------------------------------------------------------------------------
-- 5b. Rows per account type. Confirms Income / Expense / COGS really are
--     present, and shows how the ledger splits P&L vs balance sheet.
-- ---------------------------------------------------------------------------
-- SELECT
--   account_type,
--   COUNT(*)              AS rows,
--   ROUND(SUM(amount), 2) AS amount
-- FROM classified
-- GROUP BY account_type
-- ORDER BY rows DESC;


-- ---------------------------------------------------------------------------
-- 5c. Whole-ledger sanity: SUM(amount) across EVERY account -- P&L and
--     balance sheet together -- must be 0, because debits equal credits.
--     A non-zero result means rows were lost or duplicated in the join.
-- ---------------------------------------------------------------------------
-- SELECT ROUND(SUM(amount), 2) AS should_be_zero FROM classified;


-- ---------------------------------------------------------------------------
-- 5d. P&L BY PROPERTY. `department` is the individual LLC / property, so
--     this is almost certainly the view the partners actually want --
--     a consolidated total hides which property is losing money.
-- ---------------------------------------------------------------------------
-- SELECT
--   department,
--   ROUND(SUM(IF(account_type = 'Income',             amount, 0)), 2) AS revenue,
--   ROUND(SUM(IF(account_type = 'Cost of Goods Sold', amount, 0)), 2) AS cogs,
--   ROUND(SUM(IF(account_type = 'Expense',            amount, 0)), 2) AS opex,
--   ROUND(SUM(IF(account_type = 'Other Income',       amount, 0)), 2) AS other_income,
--   ROUND(SUM(IF(account_type = 'Other Expense',      amount, 0)), 2) AS other_expense,
--   ROUND(SUM(amount), 2)                                            AS net_income
-- FROM classified
-- WHERE is_pnl
--   AND date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
-- GROUP BY department
-- ORDER BY net_income;


-- ---------------------------------------------------------------------------
-- 5e. Monthly trend -- feeds the chart later.
-- ---------------------------------------------------------------------------
-- SELECT
--   DATE_TRUNC(date, MONTH) AS month,
--   ROUND(SUM(IF(account_type = 'Income', amount, 0)), 2) AS revenue,
--   ROUND(SUM(amount), 2)                                 AS net_income
-- FROM classified
-- WHERE is_pnl
-- GROUP BY month
-- ORDER BY month;
