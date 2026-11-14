-- P503: manager/compliance disposition metadata for returned peg liquid quarantine.
ALTER TABLE bar_refund_peg_restorations
  ADD COLUMN IF NOT EXISTS disposition_reason TEXT,
  ADD COLUMN IF NOT EXISTS compliance_reference TEXT,
  ADD COLUMN IF NOT EXISTS disposition_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS disposition_at TIMESTAMPTZ;

INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code,'bar:quarantine:manage'
FROM (VALUES ('RETAIL_OWNER'),('RETAIL_MANAGER'),('BAR_OWNER')) AS roles(role_code)
ON CONFLICT DO NOTHING;

INSERT INTO platform_phase_delivery_register(phase_code,phase_title,delivery_scope,delivery_state,evidence_reference)
VALUES ('P503','Quarantine disposition and release verification','Controlled peg-return disposition, compliance reference and auditable workflow','developer-preview','docs/P503-IMPLEMENTATION.md')
ON CONFLICT(phase_code) DO UPDATE SET phase_title=EXCLUDED.phase_title,delivery_scope=EXCLUDED.delivery_scope,delivery_state=EXCLUDED.delivery_state,evidence_reference=EXCLUDED.evidence_reference,updated_at=NOW();

CREATE OR REPLACE FUNCTION prevent_finalized_peg_quarantine_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Peg quarantine ledger rows cannot be deleted';
  END IF;
  IF OLD.disposition <> 'QUARANTINE_PENDING' THEN
    RAISE EXCEPTION 'Finalized peg quarantine disposition is immutable';
  END IF;
  IF NEW.refund_id IS DISTINCT FROM OLD.refund_id
     OR NEW.ticket_line_id IS DISTINCT FROM OLD.ticket_line_id
     OR NEW.open_bottle_id IS DISTINCT FROM OLD.open_bottle_id
     OR NEW.volume_ml IS DISTINCT FROM OLD.volume_ml
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Peg quarantine source evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_peg_quarantine_immutable ON bar_refund_peg_restorations;
CREATE TRIGGER trg_peg_quarantine_immutable
BEFORE UPDATE OR DELETE ON bar_refund_peg_restorations
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_peg_quarantine_mutation();
