CREATE TABLE IF NOT EXISTS supplier_invoices (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 supplier_id UUID REFERENCES suppliers(id), outlet_id UUID REFERENCES outlets(id), invoice_number TEXT NOT NULL,
 invoice_date DATE NOT NULL, due_date DATE, total_amount NUMERIC(14,2) NOT NULL CHECK(total_amount>=0),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PART_PAID','PAID','DISPUTED','VOID')),
 UNIQUE(organisation_id,invoice_number)
);
CREATE TABLE IF NOT EXISTS expenses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id),
 category TEXT NOT NULL, description TEXT NOT NULL, amount NUMERIC(14,2) NOT NULL CHECK(amount>0),
 expense_date DATE NOT NULL DEFAULT CURRENT_DATE, payment_method TEXT, reference TEXT, created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ledger_entries (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id),
 entry_date DATE NOT NULL DEFAULT CURRENT_DATE, account_code TEXT NOT NULL, debit NUMERIC(14,2) NOT NULL DEFAULT 0,
 credit NUMERIC(14,2) NOT NULL DEFAULT 0, source_type TEXT NOT NULL, source_id UUID, memo TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
 CHECK(debit>=0 AND credit>=0 AND NOT(debit>0 AND credit>0))
);
CREATE TABLE IF NOT EXISTS accounting_exports (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), export_type TEXT NOT NULL,
 period_start DATE NOT NULL, period_end DATE NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED', file_uri TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
