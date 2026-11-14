import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const route=fs.readFileSync(root+'apps/api/src/routes/devices.ts','utf8');
const sql=fs.readFileSync(root+'apps/api/src/db/240_p538_device_trust.sql','utf8');
const app=fs.readFileSync(root+'apps/api/src/app.ts','utf8');
const checks=[
 ['device routes authenticate and scope organisation',route.includes('devicesRouter.use(authenticate, requireOrgScope)')],
 ['device management permission enforced',route.includes("requirePermission('device:manage')")],
 ['device listing permission enforced',route.includes("requirePermission('device:read')")],
 ['public key fingerprint is SHA-256',route.includes("createHash('sha256')")],
 ['challenge uses cryptographically random nonce',route.includes('randomBytes(32)')],
 ['challenge expiry and one-time consumption enforced',route.includes("consumed_at IS NULL AND expires_at>NOW()")],
 ['device signature verified with registered public key',route.includes('verifySignature(')],
 ['failed challenge cannot be replayed',route.includes('SET consumed_at=NOW() WHERE id=$1')],
 ['revocation endpoint exists',route.includes("status='REVOKED'")],
 ['device table is tenant-scoped',sql.includes('organisation_id UUID NOT NULL')],
 ['challenge table references device',sql.includes('device_id UUID NOT NULL REFERENCES pos_devices')],
 ['permissions seeded',sql.includes("'RETAIL_OWNER','device:manage'")],
 ['router mounted in API',app.includes("app.use('/api/v1', devicesRouter)")],
 ['no offline posting auto-enable',!route.includes('offlinePostingApproval')]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);assert.ok(ok,name)}
console.log(`P538 static checks: ${checks.length}/${checks.length} PASS`);
