# P528 Status

**Version:** 0.528.0-dev  
**Release:** PARTIAL — developer preview, not production approved

| Area | Status | Evidence |
|---|---|---|
| Organisation/outlet live status and operating mode | Implemented | Authoritative check route |
| Current verified licence and explicit capability | Implemented with jurisdiction mapping caveat | Outlet licence query |
| Active organisation-owned products | Implemented | Product query |
| Current outlet price comparison | Implemented; requires submitted unitPriceMinor | Outlet price history query |
| Retail stock availability | Implemented as a pre-check only | stock_balances query |
| Bar measure-aware stock validation | Not implemented; fails closed | Explicit failing check |
| Payment allocation sum | Implemented as payload consistency only | Payload check |
| Immutable authoritative evidence and audit | Implemented | Migration 227 |
| Unsupported event types | Fail closed | Only retail sale and bar checkout accepted by this path |
| Ledger posting | Disabled | No posting worker or ledger mutation |
| Runtime/security/E2E verification | Not run | Requires PostgreSQL and installed dependencies |

Static verification: P528 14/14; TypeScript syntax 236 files / 0 diagnostics; SQL migration static validation 227 ordered files.
