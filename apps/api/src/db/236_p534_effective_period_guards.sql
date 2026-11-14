-- P534: serialize effective-period activation/approval to prevent ambiguous
-- tax packs or outlet price books. Half-open periods [from, until) are used.
CREATE OR REPLACE FUNCTION p534_guard_tax_pack_effective_overlap() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACTIVE' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('p534-tax-pack:' || NEW.jurisdiction_code::text, 0));
    IF EXISTS (
      SELECT 1 FROM tax_rule_packs p
       WHERE p.jurisdiction_code = NEW.jurisdiction_code
         AND p.status = 'ACTIVE' AND p.id <> NEW.id
         AND NEW.effective_from <= COALESCE(p.effective_until, '9999-12-31'::date)
         AND p.effective_from <= COALESCE(NEW.effective_until, '9999-12-31'::date)
    ) THEN
      RAISE EXCEPTION 'P534 tax rule pack effective period overlaps an active pack' USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS p534_tax_pack_effective_overlap ON tax_rule_packs;
CREATE TRIGGER p534_tax_pack_effective_overlap
  BEFORE INSERT OR UPDATE OF status, effective_from, effective_until ON tax_rule_packs
  FOR EACH ROW EXECUTE FUNCTION p534_guard_tax_pack_effective_overlap();

CREATE OR REPLACE FUNCTION p534_guard_outlet_price_effective_overlap() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'APPROVED' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'p534-price:' || NEW.organisation_id::text || ':' || NEW.outlet_id::text || ':' ||
      NEW.product_id::text || ':' || NEW.channel || ':' || NEW.measure_type, 0));
    IF EXISTS (
      SELECT 1 FROM outlet_tax_prices p
       WHERE p.organisation_id = NEW.organisation_id
         AND p.outlet_id = NEW.outlet_id AND p.product_id = NEW.product_id
         AND p.channel = NEW.channel AND p.measure_type = NEW.measure_type
         AND p.status = 'APPROVED' AND p.id <> NEW.id
         AND NEW.effective_from < COALESCE(p.effective_until, 'infinity'::timestamptz)
         AND p.effective_from < COALESCE(NEW.effective_until, 'infinity'::timestamptz)
    ) THEN
      RAISE EXCEPTION 'P534 outlet price effective period overlaps an approved price' USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS p534_outlet_price_effective_overlap ON outlet_tax_prices;
CREATE TRIGGER p534_outlet_price_effective_overlap
  BEFORE INSERT OR UPDATE OF status, effective_from, effective_until ON outlet_tax_prices
  FOR EACH ROW EXECUTE FUNCTION p534_guard_outlet_price_effective_overlap();
