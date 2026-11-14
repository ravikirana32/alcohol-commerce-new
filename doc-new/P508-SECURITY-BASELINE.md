# P508 Security Baseline
Status: engineering controls and verification scaffolding; independent security assessment not performed.

## Required controls
- Helmet/security headers; no server banner disclosure.
- Strong unique secrets; rotate bootstrap secret after initial admin creation.
- TLS termination for any non-local environment.
- Least-privilege database role for API; separate migration owner.
- Tenant ID derived from authenticated claims, never trusted from request body/query.
- Object-level authorization on every read/write.
- Rate limiting and brute-force protections on authentication and bootstrap.
- Audit security-sensitive changes and retain logs under documented policy.
- Dependency/SBOM and secret scanning in CI.
- Backups encrypted and restore tested.
- Never enable live payments/offline/consumer discovery without explicit acceptance tests and compliance review.

## Manual gates
Run independent SAST/DAST/dependency scanning and penetration test. Resolve all critical/high findings. Obtain security sign-off before pilot.
