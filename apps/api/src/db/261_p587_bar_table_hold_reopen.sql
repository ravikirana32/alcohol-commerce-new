-- P587: hold and resume an active table tab without making its table available.
ALTER TABLE bar_table_sessions
  DROP CONSTRAINT IF EXISTS bar_table_sessions_status_check;

ALTER TABLE bar_table_sessions
  ADD CONSTRAINT bar_table_sessions_status_check
  CHECK (status IN ('OPEN','HELD','CLOSED'));

ALTER TABLE bar_table_sessions
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES users(id);

DROP INDEX IF EXISTS uq_bar_table_session_open_label;
CREATE UNIQUE INDEX uq_bar_table_session_open_label
  ON bar_table_sessions(organisation_id,outlet_id,lower(table_label))
  WHERE status IN ('OPEN','HELD');
