# P539 Developer Runbook

1. Start PostgreSQL and API using the existing P538 runbook and project environment configuration.
2. Start the web app using `npm run dev` from `apps/web`.
3. Sign in with a user whose organisation membership includes `finance:view`.
4. Open Reports, select From and To dates, and apply filters.
5. Review gross sales, daily sales trend and top products; export the trend to CSV.
6. Reconcile values against the underlying retail sales and paid bar tickets before operational use.

The report figures are gross operational POS values. They are not statutory returns, audited financial statements or automatically reconciled accounting revenue.
