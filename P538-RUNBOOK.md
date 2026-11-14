# P538 Developer Runbook

1. Apply migrations using the existing API migration runner: `npm run db:migrate` from `apps/api` after configuring PostgreSQL using `.env.example`.
2. Start the API with `npm run dev` from `apps/api`.
3. Authenticate as an organisation user granted `device:manage` to enroll a device with a PEM SPKI public key.
4. Request a challenge for the returned device ID; sign the returned nonce using the corresponding private key and the advertised supported algorithm.
5. Submit challenge ID, nonce, base64 signature and algorithm to the attestation endpoint.
6. Confirm status becomes TRUSTED; revoke a device when lost or compromised.

Do not use this foundation as hardware attestation or secure-time proof. Do not enable offline alcohol posting based on TRUSTED status alone. Runtime execution and key-management procedures must be validated before deployment.
