-- P36: Advanced pricing & promotions
-- Review FK assumptions and execute in staging before production.
CREATE TABLE IF NOT EXISTS price_books (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), outlet_id UUID REFERENCES outlets(id), name TEXT NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'INR', active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS price_book_entries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), price_book_id UUID NOT NULL REFERENCES price_books(id), product_id UUID NOT NULL, unit_code TEXT NOT NULL, price NUMERIC(14,2) NOT NULL CHECK (price >= 0), valid_from TIMESTAMPTZ NOT NULL, valid_to TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS promotion_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id), promotion_ref UUID NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewer_id UUID REFERENCES users(id), reason TEXT);
