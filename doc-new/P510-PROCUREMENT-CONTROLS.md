# P510 Procurement Controls
This phase adds additive database foundations for goods receipt notes (GRN) and three-way invoice matching.

The schema stores received/accepted/rejected quantities, PO line references, unit cost, receipt posting actor/time, and invoice-match variance/reviewer data. It does not yet expose a complete procurement UI/API or automatically post stock movements. Do not mark inventory received until a transaction-safe posting service is implemented and tested.

Manual acceptance needed: apply migration on a disposable PostgreSQL DB; test duplicate receipt number, accepted+rejected quantity equality, PO over-receipt policy, supplier invoice variance, and tenant isolation.
