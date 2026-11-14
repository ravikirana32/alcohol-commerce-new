# P552 Release Notes

Version 0.552.0-dev, cumulative baseline P551.

- Added SQL migration parser support for dynamic role lists expressed through `SELECT role_code ... FROM (VALUES ...)`.
- Regenerated role/permission matrix: 13 roles, 100 permission codes.
- Recovered previously omitted `bar:quarantine:manage` grant from migration 215.
- Added 227-route backend authorization inventory: 216 guarded, 11 explicitly exempt, 0 unclassified.
- Added P552 route permission matrix JSON and verification/generation npm scripts.
- No permission grants were added to SQL migrations; no runtime role privileges were broadened.
- Runtime and production acceptance remain open; release is developer preview only.
