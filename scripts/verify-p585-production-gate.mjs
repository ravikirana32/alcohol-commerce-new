
import fs from 'node:fs';
import assert from 'node:assert/strict';
const m=JSON.parse(fs.readFileSync('P585-PRODUCTION-RELEASE-GATES.json','utf8'));
const gate=fs.readFileSync('apps/api/src/services/finalReleaseEvidence.ts','utf8');
const allowed=new Set(['PASS','OPEN','NOT_RUN','BLOCKED']);
assert.equal(m.phase,'P585');assert.equal(m.production_approved,false);assert.equal(m.decision,'NO_GO');
assert.equal(m.live_payments_enabled,false);assert.equal(m.offline_alcohol_posting_enabled,false);assert.equal(m.outbound_provider_dispatch_enabled,false);
assert.ok(m.gates.length>=13);assert.equal(new Set(m.gates.map(g=>g.id)).size,m.gates.length);
for(const g of m.gates)assert.ok(g.name&&g.owner&&g.evidence&&allowed.has(g.status));
for(const k of ['buildPassed','typecheckPassed','databaseMigrationsPassed','apiE2ePassed','browserE2ePassed','securityApproved','legalApproved','providerCertificationsPassed','restoreDrillPassed','pilotAccepted','supportReady','rollbackTested'])assert.ok(gate.includes(k),`release gate ${k}`);
assert.ok(gate.includes("blockers.length===0?'APPROVE':'HOLD'"));
assert.ok(m.gates.some(g=>g.status!=='PASS'));
console.log(`P585 release gate manifest: ${m.gates.length} mandatory gates; ${m.gates.filter(g=>g.status==='PASS').length} passed, ${m.gates.filter(g=>g.status!=='PASS').length} unresolved.`);
console.log('PASS production approval remains false');console.log('PASS live payment/offline alcohol/provider dispatch disabled');console.log('PASS existing final release policy requires every critical evidence field');
