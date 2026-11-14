-- P517: bar table sessions and kitchen/bar preparation tickets.
CREATE TABLE IF NOT EXISTS bar_table_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
 table_label TEXT NOT NULL CHECK (length(trim(table_label)) BETWEEN 1 AND 40),
 covers INTEGER NOT NULL DEFAULT 1 CHECK (covers BETWEEN 1 AND 100),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
 opened_by UUID REFERENCES users(id),
 closed_by UUID REFERENCES users(id),
 opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 closed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (id, organisation_id, outlet_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bar_table_session_open_label
 ON bar_table_sessions(organisation_id,outlet_id,lower(table_label)) WHERE status='OPEN';
CREATE INDEX IF NOT EXISTS idx_bar_table_sessions_outlet_status
 ON bar_table_sessions(organisation_id,outlet_id,status,opened_at DESC);
ALTER TABLE bar_tickets ADD COLUMN IF NOT EXISTS table_session_id UUID;
DO $$ BEGIN
 ALTER TABLE bar_tickets ADD CONSTRAINT fk_bar_ticket_table_session_scope
 FOREIGN KEY (table_session_id,organisation_id,outlet_id)
 REFERENCES bar_table_sessions(id,organisation_id,outlet_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_bar_tickets_table_session
 ON bar_tickets(organisation_id,outlet_id,table_session_id);
CREATE TABLE IF NOT EXISTS bar_kot_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
 table_session_id UUID,
 ticket_id UUID NOT NULL REFERENCES bar_tickets(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACCEPTED','PREPARING','READY','SERVED','CANCELLED')),
 notes TEXT,
 created_by UUID REFERENCES users(id),
 accepted_by UUID REFERENCES users(id),
 preparing_by UUID REFERENCES users(id),
 ready_by UUID REFERENCES users(id),
 served_by UUID REFERENCES users(id),
 cancelled_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(ticket_id),
 FOREIGN KEY (table_session_id,organisation_id,outlet_id)
   REFERENCES bar_table_sessions(id,organisation_id,outlet_id)
);
CREATE INDEX IF NOT EXISTS idx_bar_kot_queue
 ON bar_kot_orders(organisation_id,outlet_id,status,created_at);
CREATE TABLE IF NOT EXISTS bar_kot_lines (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 kot_order_id UUID NOT NULL REFERENCES bar_kot_orders(id) ON DELETE CASCADE,
 ticket_line_id UUID NOT NULL REFERENCES bar_ticket_lines(id) ON DELETE RESTRICT,
 product_id UUID NOT NULL REFERENCES products(id),
 quantity NUMERIC(12,3) NOT NULL CHECK(quantity > 0),
 instructions TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(kot_order_id,ticket_line_id)
);
CREATE INDEX IF NOT EXISTS idx_bar_kot_lines_order ON bar_kot_lines(kot_order_id);
