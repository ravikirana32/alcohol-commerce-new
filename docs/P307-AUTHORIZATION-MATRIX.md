# P307 Authorization matrix (review artifact)

| Capability | Platform admin | Org admin | Outlet manager | Cashier |
|---|---:|---:|---:|---:|
| Platform licence review | Yes | No | No | No |
| Manage organisation users | Scoped | Own org | No | No |
| Manage outlet catalogue/prices | Support only | Own org | Assigned outlet | No |
| Retail checkout | No implicit access | If assigned | If assigned | If assigned |
| Bar checkout | No implicit access | If assigned + verified licence | If assigned + verified licence | If assigned + verified licence |
| Refund/void approval | Audited | Policy scoped | Threshold scoped | Initiate only |

This is a proposed review matrix, not proof every route currently enforces it. Verify each endpoint and tenant boundary before production.
