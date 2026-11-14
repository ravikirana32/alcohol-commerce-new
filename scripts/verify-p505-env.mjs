import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['apps/api/src/db/pool.ts','apps/api/src/db/migrate.ts','docker-compose.yml','apps/api/Dockerfile','apps/web/Dockerfile'];
let failed = false;
for (const item of required) { try { await fs.access(path.join(root,item)); console.log(`PASS required file: ${item}`); } catch { failed = true; console.error(`FAIL missing file: ${item}`); } }
const env = await fs.readFile(path.join(root,'.env.docker.example'),'utf8');
for (const key of ['POSTGRES_PASSWORD','JWT_SECRET','BOOTSTRAP_SECRET']) { const ok = env.includes(key); console.log(`${ok?'PASS':'FAIL'} env template includes ${key}`); failed ||= !ok; }
console.log(`P505 environment preflight: ${failed?'FAIL':'PASS'}`); process.exitCode = failed ? 1 : 0;
