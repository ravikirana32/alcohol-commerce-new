# Next engineering steps after P210

1. Run `npm ci`, full `tsc` typecheck, production build and Vitest suite in a network-enabled CI runner; fix all diagnostics.
2. Execute PostgreSQL clean-install and previous-release upgrade tests; verify migration checksums and rollback/recovery strategy.
3. Add API integration tests for retail/bar checkout, repeated product lines, concurrent terminals, peg stock, idempotency replay and tenant isolation.
4. Complete supervisor-authorised voids, line-level returns, payment-provider refund integration and settlement reconciliation.
5. Add shift tender-by-tender declared counts, cash drawer/device integration, close approval and variance workflow.
6. Run security penetration testing and qualified Karnataka excise/legal review before any live outlet activation.
