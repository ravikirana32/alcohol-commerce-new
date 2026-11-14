#!/usr/bin/env python3
"""Static PostgreSQL migration preflight. Does not execute SQL."""
from pathlib import Path
import re, sys
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'apps/api/src/db'
files=sorted(p for p in D.glob('*.sql') if re.match(r'^\d+_.*\.sql$',p.name))
errors=[]; warnings=[]; seen={}
for p in files:
    prefix=p.name.split('_',1)[0]
    seen.setdefault(prefix,[]).append(p.name)
for prefix,names in seen.items():
    if len(names)>1: warnings.append(f'duplicate numeric prefix {prefix}: {", ".join(names)}')
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
