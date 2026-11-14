# P541 Release Notes — 0.541.0-dev

P541 adds append-only security audit evidence, an audit query endpoint, recovery evidence metadata and baseline authentication endpoint rate limiting. Enterprise integration lifecycle actions are now audited. The rate limiter is process-local and recovery evidence is only a registry; production deployments still require shared rate limiting, real backup/restore validation, broad audit coverage and independent security testing.
