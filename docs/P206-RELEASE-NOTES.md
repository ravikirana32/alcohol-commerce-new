# P206 — Runtime and build stabilisation

## Scope
Establish supported Node/npm versions, syntax-check tooling and operational query indexes.

## Delivered
- Declared Node.js >=20.18 and npm >=10.8 at root and workspaces.
- Added a TypeScript syntax-transpilation command.
- Added indexes for outlet-scoped retail/bar history queries.

## Validation evidence
- TypeScript syntax transpilation was later checked across the P210 source snapshot: 29 TS/TSX files, zero syntax diagnostics.
- Dependency installation was attempted but timed out; no full typecheck or build is claimed.

## Limitations
No lockfile could be generated in the available network window. Full dependency install, `npm ci`, TypeScript typecheck and production build remain required.

**Release classification:** developer preview only. Do not use for live alcohol transactions until the release gates in `docs/SECURITY-AND-RELEASE-GATES.md` are completed.
