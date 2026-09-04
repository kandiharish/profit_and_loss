-- ===========================================================================
-- STEP 2 -- Prove the name-based join is safe BEFORE trusting any number.
--
-- Joining a ledger to a chart of accounts on NAME (rather than on an id) has
-- two failure modes, both silent:
--
--   (a) MISSES  -- a GL account name that matches nothing in the CoA. Those
--       rows get NULL account_type and drop out of the P&L entirely.
--       Money disappears with no error.
--
--   (b) FAN-OUT -- two CoA rows share the same name, so one GL row joins to
--       both and its amount is counted twice. Money is invented.
--
-- QuickBooks makes (b) likely: sub-accounts share short names across
-- different parents ("Electric" under both Utilities and Vehicles). QBO's
-- `name` is usually the SHORT name while the GL prints the FULLY QUALIFIED
-- name ("Utilities:Electric"), which also causes (a) at scale.
--
-- Run all four. Adjust the column names if Step 1 says they differ.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 2a. Duplicate names in the chart of accounts -> fan-out risk.
--     EXPECT: zero rows. Any row here means amounts will double.
-- ---------------------------------------------------------------------------
SELECT
  LOWER(TRIM(name)) AS name_key,
  COUNT(*)          AS coa_rows,
  STRING_AGG(DISTINCT account_type, ' | ') AS types
FROM `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts`
GROUP BY name_key
HAVING COUNT(*) > 1
ORDER BY coa_rows DESC;


-- ---------------------------------------------------------------------------
-- 2b. GL account names that find NO match in the chart of accounts.
--     EXPECT: zero rows. Anything here is money falling out of the P&L.
--     If this returns lots of names containing ":", the CoA holds short
--     names and we need the fully-qualified fallback in step 3.
-- ---------------------------------------------------------------------------
SELECT
  gl.account_name,
  COUNT(*) AS gl_rows
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger` gl
LEFT JOIN `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts` coa
  ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
WHERE coa.name IS NULL
  AND gl.account_name IS NOT NULL
GROUP BY gl.account_name
ORDER BY gl_rows DESC;


-- ---------------------------------------------------------------------------
-- 2c. Does the row count survive the join?
--     joined_rows MUST equal gl_rows. Greater = fan-out (2a).
-- ---------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`) AS gl_rows,
  (SELECT COUNT(*)
     FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger` gl
     LEFT JOIN `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts` coa
       ON LOWER(TRIM(gl.account_name)) = LOWER(TRIM(coa.name))
  ) AS joined_rows;


-- ---------------------------------------------------------------------------
-- 2d. Double-entry integrity: total debits must equal total credits.
--     If this is not ~0, the extract is incomplete and NOTHING built on it
--     can be trusted. This is the most important query in the file.
-- ---------------------------------------------------------------------------
SELECT
  SUM(COALESCE(SAFE_CAST(CAST(debit  AS STRING) AS NUMERIC), 0)) AS total_debits,
  SUM(COALESCE(SAFE_CAST(CAST(credit AS STRING) AS NUMERIC), 0)) AS total_credits,
  SUM(COALESCE(SAFE_CAST(CAST(debit  AS STRING) AS NUMERIC), 0))
    - SUM(COALESCE(SAFE_CAST(CAST(credit AS STRING) AS NUMERIC), 0)) AS should_be_zero,
  COUNT(*) AS rows_checked
FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`;


-- ---------------------------------------------------------------------------
-- 2e. What account types exist? Confirms the P&L classification is complete.
-- ---------------------------------------------------------------------------
SELECT
  account_type,
  account_sub_type,
  COUNT(*) AS accounts
FROM `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts`
GROUP BY account_type, account_sub_type
ORDER BY account_type, account_sub_type;
