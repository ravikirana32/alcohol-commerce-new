import fs from 'node:fs';
const root=new URL('../',import.meta.url).pathname;
const migration=fs.readFileSync(root+'apps/api/src/db/248_p572_stock_snapshot_serialization.sql','utf8');
const ops=fs.readFileSync(root+'apps/api/src/routes/operations.ts','utf8');
const checks=[
 ['P572 migration defines transaction advisory lock',migration.includes('pg_advisory_xact_lock')],
 ['P572 stock movement trigger takes outlet lock',migration.includes('BEFORE INSERT ON stock_movements')],
 ['P572 movement timestamp is recorded after lock wait',migration.includes('NEW.created_at := clock_timestamp()')],
 ['P572 scope lock includes organisation and outlet',migration.includes("NEW.organisation_id::text || ':' || NEW.outlet_id::text")],
 ['P572 opening snapshot acquires matching lock',ops.includes("pg_advisory_xact_lock(hashtextextended($1::text || ':' || $2::text,0))")],
 ['P572 opening snapshot uses wall-clock capture timestamp',ops.includes('reason,captured_at)')&&ops.includes('VALUES($1,$2,$3,$4,clock_timestamp())')],
 ['P572 opening snapshot captures balances in transaction',ops.includes('INSERT INTO stock_opening_balance_lines')],
 ['P572 snapshot remains immutable',ops.includes('OPENING_BASELINE_ALREADY_EXISTS')]
];
for(const [label,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${label}`);
if(checks.some(x=>!x[1])) process.exit(1);
console.log(`${checks.length}/${checks.length} P572 static checks passed`);
