-- P534: distinguish BAR price books by the actual sale measure.
-- Existing BAR rows are conservatively classified as BOTTLE; operators must
-- review/reapprove them before using the new measure-aware checkout path.
ALTER TABLE outlet_tax_prices ADD COLUMN IF NOT EXISTS measure_type TEXT;
UPDATE outlet_tax_prices SET measure_type = CASE WHEN channel = 'BAR' THEN 'BOTTLE' ELSE 'UNIT' END WHERE measure_type IS NULL;
ALTER TABLE outlet_tax_prices ALTER COLUMN measure_type SET NOT NULL;
ALTER TABLE outlet_tax_prices ALTER COLUMN measure_type SET DEFAULT 'UNIT';
ALTER TABLE outlet_tax_prices DROP CONSTRAINT IF EXISTS outlet_tax_prices_measure_channel_check;
ALTER TABLE outlet_tax_prices ADD CONSTRAINT outlet_tax_prices_measure_channel_check
  CHECK ((channel = 'RETAIL' AND measure_type = 'UNIT') OR
         (channel = 'BAR' AND measure_type IN ('PEG','BOTTLE','PACKAGED')));
CREATE INDEX IF NOT EXISTS idx_outlet_tax_prices_measure_current
  ON outlet_tax_prices(organisation_id,outlet_id,product_id,channel,measure_type,status,effective_from);
