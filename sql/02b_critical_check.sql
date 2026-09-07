-- ===========================================================================
-- CRITICAL CHECK -- run this before anything else.
--
-- Every one of the 20 sample GL rows you sent has an account_name that is a
-- BANK account (1000-xx WSFS Bank-...), and the actual expense sits in the
-- `split_account` column instead:
--
--     account_name  = "1000-02 WSFS Bank-Gamije Assoc"   <- Bank (Asset)
--     split_account = "7650 Bank Charges"                <- the expense
--     credit = 8
--
-- Two possible explanations:
--
--   (1) The sample is just storage-ordered, and 1000-xx accounts sort first.
--       The table does contain every account. -> Everything works.
--
--   (2) The extract is a BANK REGISTER, not a full general ledger -- only
--       cash accounts, with the other side of each entry collapsed into
--       `split_account`. -> Classifying on account_name yields ZERO P&L
--       rows, and the entire approach has to change.
--
-- This query settles it. It is the difference between a working P&L and an
-- empty one.
-- ===========================================================================

SELECT
  coa.account_type,
  COUNT(*)                                       AS gl_rows,
  COUNT(DISTINCT gl.account_id)                  AS distinct_accounts,
  ROUND(SUM(COALESCE(CAST(gl.credit AS NUMERIC), 0)
          - COALESCE(CAST(gl.debit  AS NUMERIC), 0)), 2) AS amount
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger` gl
JOIN `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts` coa
  ON gl.account_id = coa.id
GROUP BY coa.account_type
ORDER BY gl_rows DESC;

-- WHAT TO LOOK FOR:
--   Income / Cost of Goods Sold / Expense / Other Income / Other Expense
--   must ALL appear with a meaningful row count.
--
--   If ONLY "Bank" (and a few other balance-sheet types) come back, we have
--   case (2) and I need to rebuild the mapping around `split_account`.


-- ---------------------------------------------------------------------------
-- The double-entry test. You did not report this one and it is the single
-- most important number in the whole project.
--
--   should_be_zero must be 0 (or within a cent).
--
-- If it is NOT zero, the extract is one-sided -- which is exactly what a
-- bank-register export looks like -- and no P&L built on it can be trusted.
-- ---------------------------------------------------------------------------
SELECT
  ROUND(SUM(COALESCE(CAST(debit  AS NUMERIC), 0)), 2) AS total_debits,
  ROUND(SUM(COALESCE(CAST(credit AS NUMERIC), 0)), 2) AS total_credits,
  ROUND(SUM(COALESCE(CAST(debit  AS NUMERIC), 0))
      - SUM(COALESCE(CAST(credit AS NUMERIC), 0)), 2) AS should_be_zero,
  COUNT(*) AS rows_checked
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`;


-- ---------------------------------------------------------------------------
-- Does account_id ever disagree with account_name? If this returns rows,
-- one of the two is unreliable and we need to know which.
-- EXPECT: zero rows.
-- ---------------------------------------------------------------------------
SELECT
  gl.account_id,
  gl.account_name AS gl_name,
  coa.name        AS coa_name,
  COUNT(*)        AS rows
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger` gl
JOIN `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts` coa
  ON gl.account_id = coa.id
WHERE LOWER(TRIM(gl.account_name)) != LOWER(TRIM(coa.name))
GROUP BY 1, 2, 3
ORDER BY rows DESC;


-- ---------------------------------------------------------------------------
-- What is `department`? It looks like the property / LLC -- i.e. your entity
-- dimension. Confirm the list.
-- ---------------------------------------------------------------------------
SELECT
  department_id,
  department,
  COUNT(*) AS gl_rows,
  MIN(date) AS first_txn,
  MAX(date) AS last_txn
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`
GROUP BY department_id, department
ORDER BY gl_rows DESC;


-- ---------------------------------------------------------------------------
-- Full date range of the ledger.
-- ---------------------------------------------------------------------------
SELECT MIN(date) AS first_txn, MAX(date) AS last_txn, COUNT(*) AS rows
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`;
