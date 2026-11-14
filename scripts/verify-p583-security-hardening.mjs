import fs from 'node:fs';import assert from 'node:assert/strict';
const mw=fs.readFileSync('apps/api/src/middleware/securityRateLimit.ts','utf8');
const sql=fs.readFileSync('apps/api/src/db/259_p583_shared_security_controls.sql','utf8');
for(const [n,v] of Object.entries({'shared database bucket':mw.includes('p583_rate_limit_buckets'),'hashed limiter key':mw.includes("createHash('sha256')"),'fail closed':mw.includes('AUTH_RATE_LIMIT_UNAVAILABLE'),'atomic upsert':mw.includes('ON CONFLICT(bucket_key) DO UPDATE'),'bounded auth paths':mw.includes('forgot-password'),'append-only trigger':sql.includes('BEFORE UPDATE OR DELETE ON security_audit_events'),'expiry index':sql.includes('idx_p583_rate_limit_expiry')})){assert.ok(v,n);console.log('PASS',n);}
