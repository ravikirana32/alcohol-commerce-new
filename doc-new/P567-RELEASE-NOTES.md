# P567 Release Notes

- Adopted the P566 append-once stock movement helper across key retail, bar, offline, transfer, stocktake, batch and goods receipt posting paths.
- Uses source-line keys for multi-line documents and separate transfer direction keys.
- Preserves stock balance mutation in caller transaction; helper remains append-only.
- Explicitly leaves manual receipt, manual adjustment and open-bottle paths for follow-up because they lack a stable request identity.
- Goods receipt still needs request-level idempotency for retries that create a new receipt document.
