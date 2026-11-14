# P202 Release Notes — Licence and tenant security

## Scope
Enforce active outlet, operating profile and current verified licence permissions before retail and bar operational mutations.

## Changes
- Added shared checkOutletOperationalAccess service
- Enforced RETAIL_SALE and BAR_SERVICE capabilities on retail sale, bottle opening and peg adjustments
- Corrected outlet creation to persist outlet_code, operating_mode and state_code
- Added audit record for platform licence review
- Disabled split legacy bar ticket/payment and standalone peg-sale paths

## Risks / limitations
- The capability strings RETAIL_SALE and BAR_SERVICE must be mapped to official outlet licence conditions by qualified Karnataka excise/legal reviewers

## Validation
Archive integrity and source syntax checks are reported separately. No database execution or production certification is implied.
