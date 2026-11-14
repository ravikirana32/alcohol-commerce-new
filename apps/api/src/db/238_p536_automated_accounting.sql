-- P536: idempotent source-to-ledger posting, account mappings and period controls.
CREATE TABLE IF NOT EXISTS p536_accounting_mappings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 event_type varchar(24) NOT NULL CHECK(event_type IN ('SALES','REFUND','SETTLEMENT','COGS','PURCHASE')),
 debit_account_id uuid NOT NULL, credit_account_id uuid NOT NULL,
 tax_account_id uuid, fee_account_id uuid, inventory_account_id uuid,
 is_active boolean NOT NULL DEFAULT true, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organisation_id,event_type),
 FOREIGN KEY(debit_account_id,organisation_id) REFERENCES finance_accounts(id,organisation_id),
 FOREIGN KEY(credit_account_id,organisation_id) REFERENCES finance_accounts(id,organisation_id),
 FOREIGN KEY(tax_account_id,organisation_id) REFERENCES finance_accounts(id,organisation_id),
 FOREIGN KEY(fee_account_id,organisation_id) REFERENCES finance_accounts(id,organisation_id),
 FOREIGN KEY(inventory_account_id,organisation_id) REFERENCES finance_accounts(id,organisation_id)
);
CREATE TABLE IF NOT EXISTS p536_source_postings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 source_type varchar(24) NOT NULL, source_id uuid NOT NULL, outlet_id uuid REFERENCES outlets(id),
 event_fingerprint char(64) NOT NULL, journal_id uuid REFERENCES finance_journals(id),
 status varchar(16) NOT NULL DEFAULT 'POSTED' CHECK(status IN ('POSTED','REJECTED')),
 event_payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
 UNIQUE(organisation_id,source_type,source_id), UNIQUE(organisation_id,event_fingerprint)
);
CREATE TABLE IF NOT EXISTS p536_accounting_periods (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 period_name varchar(80) NOT NULL, starts_on date NOT NULL, ends_on date NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED','LOCKED')),
 closed_by uuid REFERENCES users(id), closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(starts_on<=ends_on), UNIQUE(organisation_id,starts_on,ends_on)
);
CREATE INDEX IF NOT EXISTS idx_p536_period_lookup ON p536_accounting_periods(organisation_id,starts_on,ends_on,status);
CREATE TABLE IF NOT EXISTS p536_reversal_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 journal_id uuid NOT NULL REFERENCES finance_journals(id), reason text NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 requested_by uuid REFERENCES users(id), reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz,
 reversal_journal_id uuid REFERENCES finance_journals(id), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organisation_id,journal_id), CHECK(status='PENDING' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
-- Posted journals are immutable. Corrections must use a separately approved reversal journal.
CREATE OR REPLACE FUNCTION p536_prevent_posted_journal_mutation() RETURNS trigger AS $$
DECLARE jid uuid;
BEGIN
 jid := CASE WHEN TG_TABLE_NAME='finance_journals' THEN COALESCE(OLD.id,NEW.id) ELSE COALESCE(OLD.journal_id,NEW.journal_id) END;
 IF EXISTS(SELECT 1 FROM finance_journals WHERE id=jid AND status='POSTED') THEN
   RAISE EXCEPTION 'Posted journal is immutable; use an approved reversal';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_p536_immutable_journal ON finance_journals;
CREATE TRIGGER trg_p536_immutable_journal BEFORE UPDATE OR DELETE ON finance_journals
FOR EACH ROW EXECUTE FUNCTION p536_prevent_posted_journal_mutation();
DROP TRIGGER IF EXISTS trg_p536_immutable_journal_line ON finance_journal_lines;
CREATE TRIGGER trg_p536_immutable_journal_line BEFORE UPDATE OR DELETE ON finance_journal_lines
FOR EACH ROW EXECUTE FUNCTION p536_prevent_posted_journal_mutation();
INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('RETAIL_OWNER','finance:period:close'),('BAR_OWNER','finance:period:close') ON CONFLICT DO NOTHING;
