-- ===========================================================================
-- CLASSIFICATION & MAPPING
--
-- Source of amounts : qbo_api.general_ledger        (a full general ledger)
-- Source of types   : qbo_api.chart_of_accounts
--
-- RULES IN FORCE (confirmed by the data owner):
--
--   * Classify on account_name ONLY. `split_account` shows the other side
--     of each entry and is carried for drill-down context only -- it must
--     never drive classification.
--   * Map general_ledger.account_name -> chart_of_accounts.name.
--     Do NOT join on account_id: it is not populated consistently across
--     all GL rows. It is carried below as a reference column only.
--   * Do NOT use the `net_amount` column: it is wrong for some entries.
--     It is deliberately NOT selected here so it cannot be used by accident
--     downstream. Amounts are computed from debit/credit only.
--   * Debits and credits have been verified to balance.
--
-- SIGN CONVENTION:  amount = credit - debit      (debit negative, credit positive)
--
--     Revenue  (credit-normal) -> POSITIVE
--     COGS     (debit-normal)  -> NEGATIVE
--     Expenses (debit-normal)  -> NEGATIVE
--
--   so Net Income = SUM(amount) across all P&L rows, with no sign flipping
--   anywhere downstream. Expenses therefore DISPLAY as negative; flip that
--   at the presentation layer only if finance wants them shown positive.
--
-- The name join is safe here -- verified: no duplicate account names in the
-- chart of accounts (no fan-out), every GL account name resolves (no
-- misses), and GL row count equals joined row count.
--
-- This is a SELECT. It creates nothing and modifies nothing.
-- ===========================================================================

WITH gl AS (
  SELECT
    row_hash,
    date,
    transaction_type,
    document_number,
    description,

    -- Account (name is the mapping key)
    account_name,
    account_id,          -- reference only; NOT used for mapping

    -- Entity / property dimension
    department_id,
    department,

    -- Counterparty. QBO spreads this across several columns; the typed ones
    -- are more reliable than the generic `name`.
    COALESCE(customer_name, vendor_name, employee_name, name) AS counterparty,
    customer_name,
    vendor_name,

    -- Context for drill-down. NOT used for classification.
    split_account,
    class_name,
    product_service,

    -- MONEY. Cast FLOAT64 -> NUMERIC before any arithmetic: floating point
    -- accumulates rounding error across thousands of rows, and on a
    -- financial statement that is not acceptable. NUMERIC is exact.
    COALESCE(SAFE_CAST(credit AS NUMERIC), 0) AS credit_amt,
    COALESCE(SAFE_CAST(debit  AS NUMERIC), 0) AS debit_amt,
    COALESCE(SAFE_CAST(credit AS NUMERIC), 0)
      - COALESCE(SAFE_CAST(debit AS NUMERIC), 0) AS amount,

    -- Normalised join key.
    LOWER(TRIM(account_name)) AS name_key

  FROM `spherical-entry-506811-j2.qbo_api.general_ledger`
),

coa AS (
  SELECT
    LOWER(TRIM(name))    AS name_key,
    name                 AS coa_name,
    fully_qualified_name,
    account_type,
    account_sub_type,
    classification,
    active
  FROM `spherical-entry-506811-j2.qbo_api.chart_of_accounts`
  WHERE name IS NOT NULL
),

mapped AS (
  SELECT
    gl.* EXCEPT (name_key),
    coa.coa_name,
    coa.fully_qualified_name,
    coa.account_type,
    coa.account_sub_type,
    coa.classification,
    coa.active AS account_active,
    coa.name_key IS NULL AS is_unmatched
  FROM gl
  LEFT JOIN coa USING (name_key)
)

SELECT
  *,

  -- P&L section, driven by QuickBooks' own account_type.
  -- These five values are the complete set of P&L types in this chart of
  -- accounts (56 accounts: Income 18, Cost of Goods Sold 1, Expense 23,
  -- Other Income 10, Other Expense 4). The remaining 159 accounts are
  -- balance-sheet and are deliberately excluded.
  CASE account_type
    WHEN 'Income'             THEN 'revenue'
    WHEN 'Cost of Goods Sold' THEN 'cogs'
    WHEN 'Expense'            THEN 'opex'
    WHEN 'Other Income'       THEN 'other_income'
    WHEN 'Other Expense'      THEN 'other_expense'
    ELSE NULL
  END AS pnl_section,

  CASE account_type
    WHEN 'Income'             THEN 1
    WHEN 'Cost of Goods Sold' THEN 2
    WHEN 'Expense'            THEN 3
    WHEN 'Other Income'       THEN 4
    WHEN 'Other Expense'      THEN 5
    ELSE 99
  END AS section_order,

  account_type IN (
    'Income', 'Cost of Goods Sold', 'Expense', 'Other Income', 'Other Expense'
  ) AS is_pnl,

  -- Period helpers
  DATE_TRUNC(date, MONTH)   AS period_month,
  DATE_TRUNC(date, QUARTER) AS period_quarter,
  EXTRACT(YEAR FROM date)   AS period_year

FROM mapped;
