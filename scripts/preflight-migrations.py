#!/usr/bin/env python3
"""Static PostgreSQL migration preflight. Does not execute SQL."""
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'apps/api/src/db'
files=sorted(p for p in D.glob('*.sql') if re.match(r'^\d+_.*\.sql$',p.name))
errors=[]; warnings=[]; seen={}
reviewed_duplicate_prefixes={
    '150':{'150_p150_enterprise_platform_excellence.sql','150_z_phase_delivery_register.sql'},
    '151':{'151_p151_complete_implementation_gap_closure.sql','151_p151_p175_phase_delivery_register.sql'},
    '176':{'176_p176_complete_backend_implementation.sql','176_p176_p200_delivery_register.sql'},
    '223':{'223_p521_finance_accounting.sql','223_p523_trade_portals.sql'},
}
for p in files:
    prefix=p.name.split('_',1)[0]
    seen.setdefault(prefix,[]).append(p.name)
for prefix,names in seen.items():
    if len(names)>1:
        actual=set(names)
        expected=reviewed_duplicate_prefixes.get(prefix)
        if actual==expected:
            print(f'INFO: reviewed duplicate prefix {prefix} uses deterministic lexical order: {", ".join(sorted(names))}')
        else:
            errors.append(f'unreviewed duplicate numeric prefix {prefix}: {", ".join(names)}')
for prefix,names in reviewed_duplicate_prefixes.items():
    if prefix in seen and len(seen[prefix])==1:
        errors.append(f'reviewed duplicate prefix {prefix} changed unexpectedly: {", ".join(seen[prefix])}')
# Existing migration runner sorts filenames lexically; report sequence as actually applied.
for a,b in zip(files,files[1:]):
    if a.name > b.name: errors.append(f'non-deterministic order: {a.name} before {b.name}')
for p in files:
    sql=p.read_text(encoding='utf-8')
    if not sql.strip(): errors.append(f'empty migration: {p.name}')
    if '\x00' in sql: errors.append(f'NUL byte in migration: {p.name}')
    if re.search(r'\bDROP\s+DATABASE\b',sql,re.I): errors.append(f'destructive DROP DATABASE in {p.name}')
print(f'Migrations discovered: {len(files)}')
for w in warnings: print('WARN:',w)
for e in errors: print('ERROR:',e)
print('NOTE: static inspection only; PostgreSQL execution, dependency checks and rollback validation are still required.')
if errors: sys.exit(1)
