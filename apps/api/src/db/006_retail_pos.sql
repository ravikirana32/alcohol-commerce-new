CREATE TABLE IF NOT EXISTS retail_sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id), receipt_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'COMPLETED'
 CHECK(status IN ('COMPLETED','VOIDED','REFUNDED')), subtotal NUMERIC(14,2) NOT NULL, tax_total NUMERIC(14,2) NOT NULL DEFAULT 0,
 discount_total NUMERIC(14,2) NOT NULL DEFAULT 0, grand_total NUMERIC(14,2) NOT NULL,
 payment_status TEXT NOT NULL DEFAULT 'PAID' CHECK(payment_status IN ('PENDING','PAID','PARTIAL','REFUNDED')),
 idempotency_key TEXT NOT NULL, cashier_id UUID REFERENCES users(id), sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(outlet_id,idempotency_key), UNIQUE(outlet_id,receipt_number)
);
CREATE TABLE IF NOT EXISTS retail_sale_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL REFERENCES retail_sales(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id), quantity_units NUMERIC(14,3) NOT NULL CHECK(quantity_units > 0),
 unit_price NUMERIC(14,2) NOT NULL, tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0, line_total NUMERIC(14,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS sale_payments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 sale_id UUID NOT NULL REFERENCES retail_sales(id), method TEXT NOT NULL CHECK(method IN ('CASH','UPI','CARD','WALLET','OTHER')),
 amount NUMERIC(14,2) NOT NULL CHECK(amount > 0), reference TEXT, status TEXT NOT NULL DEFAULT 'CAPTURED',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
