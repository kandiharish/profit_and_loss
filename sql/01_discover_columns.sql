-- ===========================================================================
-- STEP 1 -- What columns actually exist?
-- Read-only. Metadata only. Paste the results back.
-- ===========================================================================

SELECT
  table_name,
  ordinal_position AS pos,
  column_name,
  data_type
FROM `spherical-entry-506811-j2.qbo_api.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name IN ('general_ledger', 'chart_of_accounts')
ORDER BY table_name, ordinal_position;


-- ---------------------------------------------------------------------------
-- Sample rows -- run these too, they tell me more than the schema does.
-- ---------------------------------------------------------------------------

SELECT * FROM `spherical-entry-506811-j2.qbo_api.general_ledger`    LIMIT 20;

SELECT * FROM `spherical-entry-506811-j2.qbo_api.chart_of_accounts` LIMIT 20;
