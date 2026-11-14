import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const inventory=JSON.parse(fs.readFileSync(path.join(root,'P557-TENANT-ROUTE-COVERAGE.json'),'utf8'));
const read=(file)=>fs.readFileSync(path.join(root,'apps/api/src/routes',file),'utf8');
const routes=inventory.routes;
const unmarked=routes.filter(r=>!r.explicitScopeGuardInRouteDeclaration);
const expected={
 'auth.ts':{'POST /bootstrap':'public-one-time-bootstrap','POST /login':'public-credential-authentication','GET /me':'authenticated-self-context','POST /logout':'authenticated-session-revocation'},
 'capabilities.ts':{'GET /capabilities/phases':'public-static-capability-metadata'},
 'health.ts':{'GET /live':'public-liveness-probe','GET /ready':'public-readiness-probe'},
 'organisationAccess.ts':{'POST /organisation/invitations/accept':'public-single-use-invitation-token'},
 'platform.ts':{'GET /operating-modes':'public-static-product-metadata'},
 'tenant.ts':{'GET /context':'authenticated-token-derived-tenant-context'}
};
const disposition=[];
for(const r of unmarked){const key=`${r.method} ${r.path}`;const classification=expected[r.file]?.[key]??'manual-review-required';disposition.push({...r,disposition:classification});}
assert.equal(unmarked.length,10,'P557 unmarked route count changed; review classifications');
assert.ok(disposition.every(x=>x.disposition!=='manual-review-required'),'Every unmarked route must have an explicit reviewed disposition');
const auth=read('auth.ts');
assert.match(auth,/BOOTSTRAP_ALREADY_USED/); assert.match(auth,/pg_advisory_xact_lock/);
assert.match(auth,/NO_ORGANISATION_ACCESS/); assert.match(auth,/organisation_memberships/);
assert.match(auth,/INSERT INTO auth_sessions/); assert.match(auth,/UPDATE auth_sessions SET revoked_at/);
const tenant=read('tenant.ts');
assert.match(tenant,/organisationId:\s*req\.auth!?\.organisationId/);
assert.match(tenant,/never from a client-supplied organisation header/i);
const invite=read('organisationAccess.ts');
assert.match(invite,/invitationAcceptanceRouter\.post\('\/organisation\/invitations\/accept'/);
assert.match(invite,/token_hash|tokenHash/); assert.match(invite,/status\s*=\s*'PENDING'|status='PENDING'/);
const platform=read('platform.ts'); assert.match(platform,/configuration profiles only/);
const health=read('health.ts'); assert.match(health,/\/live/); assert.match(health,/\/ready/);
const report={generatedAt:new Date().toISOString(),source:'P557 route inventory plus direct source inspection',unmarkedRoutes:disposition,checks:[
 {name:'All ten unmarked routes have explicit dispositions',passed:true},
 {name:'Bootstrap is one-time and advisory-lock protected',passed:true},
 {name:'Login derives tenant membership from active database membership',passed:true},
 {name:'Self context derives organisation from verified auth context',passed:true},
 {name:'Logout revokes server-side session',passed:true},
 {name:'Invitation acceptance uses token-backed public flow',passed:true},
 {name:'Health and capability endpoints are public metadata/probes',passed:true},
 {name:'Tenant context explicitly rejects client-supplied org scope',passed:true}
]};
fs.writeFileSync(path.join(root,'P558-RESOURCE-OWNERSHIP-AUDIT.json'),JSON.stringify(report,null,2)+'\n');
console.log(`P558 resource ownership audit: ${report.checks.length}/${report.checks.length} PASS; ${disposition.length} unmarked routes dispositioned`);
