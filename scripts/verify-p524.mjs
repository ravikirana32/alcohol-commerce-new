import fs from 'node:fs';
const app=fs.readFileSync('apps/web/src/App.tsx','utf8');
const ui=fs.readFileSync('apps/web/src/components/OfflineDeviceWorkspace.tsx','utf8');
const css=fs.readFileSync('apps/web/src/styles.css','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['device workspace mounted',app.includes('<OfflineDeviceWorkspace/>')],
 ['offline navigation available',app.includes("label: 'Offline & Devices'")],
 ['IndexedDB persistence',ui.includes('indexedDB.open(DB,1)')],
 ['diagnostic event is non-financial',ui.includes("kind:'DEVICE_DIAGNOSTIC'")],
 ['network state listeners',ui.includes("addEventListener('online'")&&ui.includes("addEventListener('offline'")],
 ['barcode input capture',ui.includes('acceptScan')&&ui.includes('scanRef')],
 ['print dialog hand-off',ui.includes('window.print()')],
 ['explicit no-sale-sync guardrail',ui.includes('does not synchronise or authorise sales')],
 ['responsive device layout',css.includes('.device-grid')&&css.includes('@media(max-width:700px)')],
 ['release version bumped',pkg.version==='0.529.0-dev']
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length;console.log(`P524 static acceptance: ${checks.length-failed}/${checks.length}`);if(failed)process.exit(1);
