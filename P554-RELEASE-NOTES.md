# P554 Release Notes

- Added exhaustive role × permission authorization middleware test harness.
- Added explicit 401 unauthenticated and 403 permission-denied assertions.
- Added static verifier and npm scripts.
- No database migrations or production permission grants changed.
- Runtime tests were not executed in the build environment; production remains NO-GO.
