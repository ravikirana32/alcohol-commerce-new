CREATE TABLE IF NOT EXISTS bar_tickets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), ticket_number TEXT NOT NULL, table_label TEXT,
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','SENT','PART_PAID','PAID','VOIDED')),
 subtotal NUMERIC(14,2) NOT NULL DEFAULT 0, tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
 discount_total NUMERIC(14,2) NOT NULL DEFAULT 0, grand_total NUMERIC(14,2) NOT NULL DEFAULT 0,
 opened_by UUID REFERENCES users(id), opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), closed_at TIMESTAMPTZ,
 UNIQUE(outlet_id,ticket_number)
);
CREATE TABLE IF NOT EXISTS bar_ticket_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), line_type TEXT NOT NULL CHECK(line_type IN ('PEG','BOTTLE','PACKAGED')),
 quantity NUMERIC(12,3) NOT NULL CHECK(quantity > 0), volume_ml INTEGER, unit_price NUMERIC(14,2) NOT NULL,
 tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0, line_total NUMERIC(14,2) NOT NULL,
 open_bottle_id UUID REFERENCES open_bottles(id)
);
CREATE TABLE IF NOT EXISTS bar_payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 ticket_id UUID NOT NULL REFERENCES bar_tickets(id), method TEXT NOT NULL CHECK(method IN ('CASH','UPI','CARD','WALLET','OTHER')),
 amount NUMERIC(14,2) NOT NULL CHECK(amount > 0), reference TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
