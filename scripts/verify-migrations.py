#!/usr/bin/env python3
"""Static migration checks; does not connect to PostgreSQL or execute SQL."""
from pathlib import Path
import re, sys
base=Path(__file__).resolve().parents[1]/'apps/api/src/db'
files=sorted(p for p in base.glob('*.sql') if re.match(r'^\d+_.*\.sql$',p.name))
nums=[int(p.name.split('_',1)[0]) for p in files]
errors=[]
if len(files)!=len(set(p.name for p in files)): errors.append('duplicate migration filename')
if nums!=sorted(nums): errors.append('migration filenames are not lexically ordered')
reg=next((i for i,p in enumerate(files) if p.name=='150_z_phase_delivery_register.sql'),None)
for target in ('151_p151_p175_phase_delivery_register.sql','176_p176_p200_delivery_register.sql'):
    idx=next((i for i,p in enumerate(files) if p.name==target),None)
    if idx is None: errors.append(f'missing expected phase register migration: {target}')
    elif reg is None or reg>=idx: errors.append(f'phase delivery register is not created before {target}')
for p in files:
    s=p.read_text(errors='replace')
    if not s.strip(): errors.append(f'empty migration: {p.name}')
    if '\x00' in s: errors.append(f'NUL byte in migration: {p.name}')
if errors:
    print('MIGRATION STATIC CHECK FAILED'); print('\n'.join('- '+e for e in errors)); sys.exit(1)
print(f'MIGRATION STATIC CHECK PASSED: {len(files)} ordered SQL files; early phase register precedes P151/P176 seed migrations')
print('NOTE: static-only; PostgreSQL clean-install/upgrade execution is still required.')
