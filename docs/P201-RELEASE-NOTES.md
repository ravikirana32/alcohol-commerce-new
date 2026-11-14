# P201 Release Notes — Migration and database repair

## Scope
Repair the P151/P176 migration ordering defect and add a regression check for migration order.

## Changes
- Added 150_z_phase_delivery_register.sql so the register exists before P151/P176 seed migrations
- Added a supporting phase-register index migration
- Added a migration ordering regression test in the final P205 package

## Risks / limitations
- Clean-install and upgrade migrations still require execution against PostgreSQL

## Validation
Archive integrity and source syntax checks are reported separately. No database execution or production certification is implied.
