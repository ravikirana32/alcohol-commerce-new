import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, requireOrgScope, requirePermission('finance:view'));

const dateRange = z.object({
  from: z.string().date(),
  to: z.string().date(),
  outletId: z.string().uuid().optional()
}).refine(v => v.from <= v.to, { message: 'from must be on or before to' });

function parseRange(query: unknown) {
  return dateRange.safeParse({
    from: (query as any)?.from,
    to: (query as any)?.to,
    outletId: (query as any)?.outletId || undefined
  });
}
const num = (v: unknown) => Number(v ?? 0);

// Cross-domain operational overview. Amounts are gross recorded POS totals;
// they are not a substitute for posted accounting revenue or statutory reports.
analyticsRouter.get('/reports/overview', async (req, res) => {
  const parsed = parseRange(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REPORT_RANGE', details: parsed.error.flatten() } });
  const org = req.auth!.organisationId!;
  const { from, to, outletId } = parsed.data;
  const values = [org, from, to, outletId ?? null];
  const [retail, bar, stock, procurement] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS transaction_count,
      COALESCE(SUM(grand_total),0)::numeric(14,2) AS gross_sales,
      COALESCE(SUM(tax_total),0)::numeric(14,2) AS tax_total
      FROM retail_sales WHERE organisation_id=$1 AND status='COMPLETED'
      AND sold_at >= $2::date AND sold_at < ($3::date + INTERVAL '1 day')
      AND ($4::uuid IS NULL OR outlet_id=$4)`, values),
    pool.query(`SELECT COUNT(*)::int AS transaction_count,
      COALESCE(SUM(grand_total),0)::numeric(14,2) AS gross_sales,
      COALESCE(SUM(tax_total),0)::numeric(14,2) AS tax_total
      FROM bar_tickets WHERE organisation_id=$1 AND status='PAID'
      AND closed_at >= $2::date AND closed_at < ($3::date + INTERVAL '1 day')
      AND ($4::uuid IS NULL OR outlet_id=$4)`, values),
    pool.query(`SELECT movement_type, COUNT(*)::int AS movement_count,
      COALESCE(SUM(quantity_units),0)::numeric(14,3) AS quantity_units
      FROM stock_movements WHERE organisation_id=$1
      AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day')
      AND ($4::uuid IS NULL OR outlet_id=$4)
      GROUP BY movement_type ORDER BY movement_type`, values),
    pool.query(`SELECT status, COUNT(*)::int AS order_count,
      COALESCE(SUM(total),0)::numeric(14,2) AS ordered_value
      FROM purchase_orders WHERE organisation_id=$1
      AND COALESCE(ordered_at, expected_at, NOW()) >= $2::date
      AND COALESCE(ordered_at, expected_at, NOW()) < ($3::date + INTERVAL '1 day')
      AND ($4::uuid IS NULL OR outlet_id=$4)
      GROUP BY status ORDER BY status`, values)
  ]);
  const r = retail.rows[0], b = bar.rows[0];
  return res.json({ data: {
    range: { from, to, outletId: outletId ?? null },
    sales: {
      retail: { transactions: num(r.transaction_count), gross: num(r.gross_sales), tax: num(r.tax_total) },
      bar: { transactions: num(b.transaction_count), gross: num(b.gross_sales), tax: num(b.tax_total) },
      combinedGross: Math.round((num(r.gross_sales) + num(b.gross_sales)) * 100) / 100,
      combinedTransactions: num(r.transaction_count) + num(b.transaction_count)
    },
    inventoryMovements: stock.rows.map((x: any) => ({ ...x, quantity_units: num(x.quantity_units) })),
    procurement: procurement.rows.map((x: any) => ({ ...x, ordered_value: num(x.ordered_value) }))
  }, meta: { salesBasis: 'completed retail sales plus paid bar tickets; gross POS totals, not accounting revenue' } });
});

analyticsRouter.get('/reports/sales-trend', async (req, res) => {
  const parsed = parseRange(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REPORT_RANGE', details: parsed.error.flatten() } });
  const { from, to, outletId } = parsed.data;
  const org = req.auth!.organisationId!;
  const r = await pool.query(`SELECT day, SUM(retail_count)::int retail_transactions,
    SUM(bar_count)::int bar_transactions, SUM(retail_gross)::numeric(14,2) retail_gross,
    SUM(bar_gross)::numeric(14,2) bar_gross
    FROM (
      SELECT sold_at::date day, COUNT(*) retail_count, 0 bar_count,
        SUM(grand_total) retail_gross, 0::numeric bar_gross
      FROM retail_sales WHERE organisation_id=$1 AND status='COMPLETED'
        AND sold_at >= $2::date AND sold_at < ($3::date + INTERVAL '1 day')
        AND ($4::uuid IS NULL OR outlet_id=$4)
      GROUP BY sold_at::date
      UNION ALL
      SELECT closed_at::date day, 0 retail_count, COUNT(*) bar_count,
        0::numeric retail_gross, SUM(grand_total) bar_gross
      FROM bar_tickets WHERE organisation_id=$1 AND status='PAID' AND closed_at IS NOT NULL
        AND closed_at >= $2::date AND closed_at < ($3::date + INTERVAL '1 day')
        AND ($4::uuid IS NULL OR outlet_id=$4)
      GROUP BY closed_at::date
    ) daily GROUP BY day ORDER BY day`, [org, from, to, outletId ?? null]);
  return res.json({ data: r.rows.map((x: any) => ({
    date: x.day, retailTransactions: num(x.retail_transactions), barTransactions: num(x.bar_transactions),
    retailGross: num(x.retail_gross), barGross: num(x.bar_gross),
    totalGross: Math.round((num(x.retail_gross) + num(x.bar_gross)) * 100) / 100
  })) });
});

analyticsRouter.get('/reports/top-products', async (req, res) => {
  const parsed = parseRange(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REPORT_RANGE', details: parsed.error.flatten() } });
  const { from, to, outletId } = parsed.data;
  const org = req.auth!.organisationId!;
  const r = await pool.query(`SELECT p.id product_id, p.sku, p.name,
    SUM(q.units)::numeric(14,3) units_sold, SUM(q.gross)::numeric(14,2) gross_sales
    FROM products p JOIN (
      SELECT l.product_id, l.quantity_units units, l.line_total gross
      FROM retail_sale_lines l JOIN retail_sales s ON s.id=l.sale_id
      WHERE s.organisation_id=$1 AND s.status='COMPLETED'
        AND s.sold_at >= $2::date AND s.sold_at < ($3::date + INTERVAL '1 day')
        AND ($4::uuid IS NULL OR s.outlet_id=$4)
      UNION ALL
      SELECT l.product_id, l.quantity units, l.line_total gross
      FROM bar_ticket_lines l JOIN bar_tickets t ON t.id=l.ticket_id
      WHERE t.organisation_id=$1 AND t.status='PAID' AND t.closed_at IS NOT NULL
        AND t.closed_at >= $2::date AND t.closed_at < ($3::date + INTERVAL '1 day')
        AND ($4::uuid IS NULL OR t.outlet_id=$4)
    ) q ON q.product_id=p.id
    WHERE p.organisation_id=$1 GROUP BY p.id,p.sku,p.name
    ORDER BY gross_sales DESC LIMIT 50`, [org, from, to, outletId ?? null]);
  return res.json({ data: r.rows.map((x: any) => ({ ...x, units_sold: num(x.units_sold), gross_sales: num(x.gross_sales) })) });
});

analyticsRouter.get('/reports/inventory-movements', async (req, res) => {
  const parsed = parseRange(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REPORT_RANGE', details: parsed.error.flatten() } });
  const { from, to, outletId } = parsed.data;
  const r = await pool.query(`SELECT sm.movement_type, sm.outlet_id, o.name outlet_name,
    sm.product_id, p.sku, p.name product_name,
    COUNT(*)::int movement_count, SUM(sm.quantity_units)::numeric(14,3) quantity_units
    FROM stock_movements sm JOIN products p ON p.id=sm.product_id
    JOIN outlets o ON o.id=sm.outlet_id AND o.organisation_id=sm.organisation_id
    WHERE sm.organisation_id=$1 AND sm.created_at >= $2::date
      AND sm.created_at < ($3::date + INTERVAL '1 day')
      AND ($4::uuid IS NULL OR sm.outlet_id=$4)
    GROUP BY sm.movement_type,sm.outlet_id,o.name,sm.product_id,p.sku,p.name
    ORDER BY sm.movement_type,p.name`, [req.auth!.organisationId, from, to, outletId ?? null]);
  return res.json({ data: r.rows.map((x: any) => ({ ...x, quantity_units: num(x.quantity_units) })) });
});

analyticsRouter.get('/reports/finance/profit-and-loss', async (req, res) => {
  const parsed = parseRange(req.query);
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_REPORT_RANGE', details: parsed.error.flatten() } });
  const { from, to, outletId } = parsed.data;
  const r = await pool.query(`SELECT a.id account_id,a.code,a.name,a.account_type,
    SUM(l.debit)::numeric(14,2) debit,SUM(l.credit)::numeric(14,2) credit
    FROM finance_accounts a JOIN finance_journal_lines l
      ON l.account_id=a.id AND l.organisation_id=a.organisation_id
    JOIN finance_journals j ON j.id=l.journal_id AND j.organisation_id=l.organisation_id
    WHERE a.organisation_id=$1 AND j.status='POSTED'
      AND j.journal_date BETWEEN $2::date AND $3::date
      AND a.account_type IN ('INCOME','EXPENSE')
      AND ($4::uuid IS NULL OR j.outlet_id=$4)
    GROUP BY a.id,a.code,a.name,a.account_type ORDER BY a.account_type,a.code`,
    [req.auth!.organisationId, from, to, outletId ?? null]);
  const rows = r.rows.map((x: any) => {
    const debit=num(x.debit), credit=num(x.credit);
    return { ...x, debit, credit, amount: x.account_type==='INCOME' ? credit-debit : debit-credit };
  });
  const income=rows.filter((x:any)=>x.account_type==='INCOME').reduce((n:number,x:any)=>n+x.amount,0);
  const expenses=rows.filter((x:any)=>x.account_type==='EXPENSE').reduce((n:number,x:any)=>n+x.amount,0);
  return res.json({ data: { from,to,accounts:rows, totalIncome:income, totalExpenses:expenses,
    netProfit:Math.round((income-expenses)*100)/100,
    caveat:'Based only on posted journals. It is incomplete until source-system auto-posting, tax mappings and accountant review are completed.' } });
});
