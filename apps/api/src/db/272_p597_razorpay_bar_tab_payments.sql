CREATE TABLE IF NOT EXISTS p597_razorpay_bar_tab_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  provider_method TEXT,
  status TEXT NOT NULL DEFAULT 'CREATING'
    CHECK (status IN ('CREATING','CREATED','PAID','FAILED','REVIEW_REQUIRED')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organisation_id, ticket_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_p597_active_razorpay_order_per_ticket
  ON p597_razorpay_bar_tab_orders (organisation_id, ticket_id)
  WHERE status IN ('CREATING','CREATED','REVIEW_REQUIRED');

CREATE INDEX IF NOT EXISTS idx_p597_razorpay_order_lookup
  ON p597_razorpay_bar_tab_orders (organisation_id, ticket_id, created_at DESC);
