-- ===========================================================================
-- STEP 1 -- What columns actually exist?
-- Read-only. Metadata only. Paste the results back.
-- ===========================================================================

SELECT
  table_name,
  ordinal_position AS pos,
  column_name,
  data_type
FROM `nodal-plexus-492111-e9.warehouse_llc.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name IN ('general_ledger', 'chart_of_accounts')
ORDER BY table_name, ordinal_position;


-- ---------------------------------------------------------------------------
-- Sample rows -- run these too, they tell me more than the schema does.
-- ---------------------------------------------------------------------------

SELECT * FROM `nodal-plexus-492111-e9.warehouse_llc.general_ledger`    LIMIT 20;

SELECT * FROM `nodal-plexus-492111-e9.warehouse_llc.chart_of_accounts` LIMIT 20;
