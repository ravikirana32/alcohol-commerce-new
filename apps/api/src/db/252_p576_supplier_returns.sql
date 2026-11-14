-- Extend movement taxonomy with explicit supplier returns.
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_movement_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_movement_type_check
 CHECK(movement_type IN ('RECEIPT','SALE','TRANSFER_IN','TRANSFER_OUT','WASTAGE','ADJUSTMENT','RETURN','SUPPLIER_RETURN'));
-- P576: supplier return authorization and stock evidence.
CREATE TABLE IF NOT EXISTS supplier_returns (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), supplier_id UUID NOT NULL REFERENCES suppliers(id),
 return_number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','POSTED','REJECTED')),
 reason TEXT NOT NULL, created_by UUID NOT NULL REFERENCES users(id), reviewed_by UUID REFERENCES users(id),
 reviewed_at TIMESTAMPTZ, posted_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(organisation_id,return_number)
);
CREATE TABLE IF NOT EXISTS supplier_return_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), return_id UUID NOT NULL REFERENCES supplier_returns(id),
 product_id UUID NOT NULL REFERENCES products(id), quantity_units NUMERIC(14,3) NOT NULL CHECK(quantity_units>0),
 unit_cost NUMERIC(14,4) NOT NULL CHECK(unit_cost>=0), reason TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supplier_return_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organisation_id UUID NOT NULL REFERENCES organisations(id),
 outlet_id UUID NOT NULL REFERENCES outlets(id), supplier_return_id UUID NOT NULL REFERENCES supplier_returns(id),
 return_line_id UUID NOT NULL REFERENCES supplier_return_lines(id), stock_movement_id UUID NOT NULL REFERENCES stock_movements(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(return_line_id)
);
