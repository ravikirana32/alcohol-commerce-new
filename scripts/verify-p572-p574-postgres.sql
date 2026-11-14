-- Execute after applying migrations 248-250 against a disposable/test PostgreSQL database.
\set ON_ERROR_STOP on
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_stock_movement_scope_serialization' AND NOT tgisinternal) THEN
   RAISE EXCEPTION 'P572 stock movement serialization trigger missing';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_stock_adjustment_direction_required' AND NOT tgisinternal) THEN
   RAISE EXCEPTION 'P571 signed adjustment trigger missing';
 END IF;
 IF to_regclass('public.stock_variance_correction_requests') IS NULL THEN
   RAISE EXCEPTION 'P574 correction request table missing';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stock_reconciliation_runs' AND column_name='ledger_cutoff_at') THEN
   RAISE EXCEPTION 'P573 ledger cutoff column missing';
 END IF;
END $$;
SELECT 'P572-P574 PostgreSQL catalog checks passed' AS result;
