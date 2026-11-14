# Security and release gates

- Never expose a tenant-scoped endpoint without authenticated organisation/outlet scope and permission checks.
- Use a non-superuser PostgreSQL application role; never rely on RLS while connecting as a superuser or BYPASSRLS role.
- Set tenant context transaction-locally and execute protected queries on the same transaction connection.
- Do not enable offline sync, consumer discovery, or AI until their specific gates are passed.
- Alcohol licensing and excise rules must be validated by local counsel / qualified compliance professionals for each state and outlet licence.
- Production release requires independent penetration testing, restore drill, concurrency tests, observability, incident ownership and signed business acceptance.
