#!/usr/bin/env python3
from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]
files=[p for p in r.rglob('*') if p.is_file() and '.git' not in p.parts and 'node_modules' not in p.parts]
print(json.dumps({'file_count':len(files),'typescript_files':sum(p.suffix in {'.ts','.tsx'} for p in files),'sql_migrations':sum(p.suffix=='.sql' for p in files)},indent=2))
