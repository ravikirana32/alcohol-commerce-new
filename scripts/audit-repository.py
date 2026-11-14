from pathlib import Path
import json, re
root=Path(__file__).resolve().parents[1]
files=[p for p in root.rglob('*') if p.is_file() and 'node_modules' not in p.parts]
migrations=sorted(p.name for p in (root/'apps/api/src/db').glob('*.sql'))
report={
 'file_count':len(files),
 'migration_count':len(migrations),
 'migration_files':migrations,
 'placeholder_markers':[],
 'missing_package_manifests':[]
}
for p in files:
    if p.suffix in {'.ts','.tsx','.js','.jsx','.md'}:
        try: txt=p.read_text(errors='ignore')
        except Exception: continue
        for marker in ('TODO_IMPLEMENT','FIXME_CRITICAL','PLACEHOLDER_ONLY'):
            if marker in txt: report['placeholder_markers'].append({'file':str(p.relative_to(root)),'marker':marker})
for p in (root/'apps').glob('*/'):
    if not (p/'package.json').exists(): report['missing_package_manifests'].append(str(p.relative_to(root)))
out=root/'docs/REPOSITORY-AUDIT-REPORT.json'
out.write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
