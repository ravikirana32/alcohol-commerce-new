# P545 Rollback / Recovery

- Stop rollout by leaving the previous known-good application deployment in service where possible.
- Capture `docker compose ps`, `docker compose logs --no-color --tail=300`, rendered Compose configuration and the full `artifacts/p545-runtime/` directory.
- Do not run `docker compose down -v`, delete `postgres_data`, or restore over the only database copy.
- If application containers fail but schema is backward-compatible, redeploy the previous immutable image/tag and verify health and core journeys.
- If a migration changed schema incompatibly, use the approved database restore procedure against a verified backup in a controlled maintenance window; reconcile transactions created after backup separately.
- Re-run smoke tests and finance/inventory reconciliation before reopening transactions. Record incident, data-loss window, approver and evidence.
