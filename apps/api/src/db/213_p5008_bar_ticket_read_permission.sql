-- P500.8: enable authorised bar owners/managers/cashiers to inspect ticket history.
INSERT INTO role_permissions(role_code,permission_code)
SELECT role_code,'bar:read'
FROM (VALUES ('RETAIL_OWNER'),('RETAIL_MANAGER'),('BAR_OWNER'),('BARTENDER')) AS roles(role_code)
ON CONFLICT DO NOTHING;
