-- P202: index the server-side outlet licence gate.
CREATE INDEX IF NOT EXISTS idx_outlet_licence_access_check
  ON outlet_licences(organisation_id, outlet_id, status, valid_from, valid_until);
