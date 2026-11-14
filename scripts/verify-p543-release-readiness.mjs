import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'P543-RELEASE-GATE.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const allowed = new Set(['PASS', 'OPEN', 'NOT_RUN', 'BLOCKED']);
const checks = [
  ['Manifest identifies P543', manifest.phase === 'P543'],
  ['Manifest version is 0.543.0-dev', manifest.release === '0.543.0-dev'],
  ['Production approval remains false', manifest.production_approved === false],
  ['Live payment capture remains disabled', manifest.live_payments_enabled === false],
  ['Offline alcohol posting remains disabled', manifest.offline_alcohol_posting_enabled === false],
  ['Outbound provider dispatch remains disabled', manifest.outbound_provider_dispatch_enabled === false],
  ['At least ten release gates are defined', Array.isArray(manifest.gates) && manifest.gates.length >= 10],
  ['Every gate has an ID, owner, status and evidence requirement', manifest.gates.every(g => g.id && g.name && g.owner && g.evidence && allowed.has(g.status))],
  ['Gate IDs are unique', new Set(manifest.gates.map(g => g.id)).size === manifest.gates.length],
  ['GO requires every gate to PASS', manifest.decision_rule.includes('every gate is PASS')],
  ['NO_GO is recorded while gates remain unresolved', manifest.decision === 'NO_GO' && manifest.gates.some(g => g.status !== 'PASS')],
  ['Deployment, rollback and decision documents exist', ['P543-RELEASE-CHECKLIST.md','P543-DEPLOYMENT-RUNBOOK.md','P543-ROLLBACK-PLAN.md','P543-GO-LIVE-DECISION.md'].every(f => fs.existsSync(path.join(root, f)))],
  ['P543 test report explicitly distinguishes static and runtime evidence', fs.existsSync(path.join(root, 'P543-TEST-REPORT.md')) && fs.readFileSync(path.join(root, 'P543-TEST-REPORT.md'), 'utf8').includes('NOT RUN')]
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
const passedGates = manifest.gates.filter(g => g.status === 'PASS').length;
const unresolved = manifest.gates.length - passedGates;
console.log(`P543 static release-gate integrity: ${checks.length - failed}/${checks.length} PASS`);
console.log(`Release evidence: ${passedGates}/${manifest.gates.length} gates PASS; ${unresolved} unresolved`);
console.log(`GO/NO-GO: ${manifest.decision}`);
if (failed) process.exit(1);
if (manifest.decision !== 'GO' || unresolved > 0) process.exitCode = 2;
