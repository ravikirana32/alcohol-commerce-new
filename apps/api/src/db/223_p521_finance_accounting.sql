-- P521: double-entry accounting foundation, scoped to organisation and outlet.
CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  code varchar(32) NOT NULL,
  name varchar(120) NOT NULL,
  account_type varchar(20) NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  parent_id uuid NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, code),
  UNIQUE (id, organisation_id),
  FOREIGN KEY (parent_id, organisation_id) REFERENCES finance_accounts(id, organisation_id)
);
CREATE TABLE IF NOT EXISTS finance_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  outlet_id uuid NULL REFERENCES outlets(id),
  journal_number varchar(48) NOT NULL,
  journal_date date NOT NULL DEFAULT CURRENT_DATE,
  source_type varchar(32) NOT NULL,
  source_id uuid NULL,
  description varchar(500) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('DRAFT','POSTED','VOID')),
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organisation_id, journal_number)
);
CREATE TABLE IF NOT EXISTS finance_journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL REFERENCES finance_journals(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  account_id uuid NOT NULL,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo varchar(300),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  FOREIGN KEY (account_id, organisation_id) REFERENCES finance_accounts(id, organisation_id)
);
CREATE INDEX IF NOT EXISTS idx_finance_journals_org_date ON finance_journals(organisation_id,journal_date);
CREATE INDEX IF NOT EXISTS idx_finance_journal_lines_account ON finance_journal_lines(organisation_id,account_id);
CREATE OR REPLACE FUNCTION enforce_finance_journal_balance() RETURNS trigger AS $$
DECLARE jid uuid; total_debit numeric(14,2); total_credit numeric(14,2);
BEGIN
  jid := COALESCE(NEW.journal_id, OLD.journal_id);
  IF EXISTS (SELECT 1 FROM finance_journals WHERE id=jid AND status='POSTED') THEN
    SELECT COALESCE(SUM(debit),0),COALESCE(SUM(credit),0) INTO total_debit,total_credit
    FROM finance_journal_lines WHERE journal_id=jid;
    IF total_debit <> total_credit OR total_debit = 0 THEN
      RAISE EXCEPTION 'Posted finance journal must balance and contain non-zero lines';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_finance_journal_balance ON finance_journal_lines;
CREATE CONSTRAINT TRIGGER trg_finance_journal_balance
AFTER INSERT OR UPDATE OR DELETE ON finance_journal_lines
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_finance_journal_balance();

INSERT INTO role_permissions(role_code,permission_code) VALUES
 ('RETAIL_OWNER','finance:view'),('RETAIL_OWNER','finance:manage'),
 ('RETAIL_MANAGER','finance:view'),('BAR_OWNER','finance:view'),('BAR_OWNER','finance:manage'),
 ('BAR_MANAGER','finance:view') ON CONFLICT DO NOTHING;
