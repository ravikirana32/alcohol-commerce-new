import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const version = read('VERSION').trim();
assert.match(version, /^0\.\d+\.0-dev$/);
for (const file of ['package.json', 'apps/api/package.json', 'apps/web/package.json']) {
  assert.equal(JSON.parse(read(file)).version, version, `${file} version drift`);
}
assert.match(read('apps/api/src/config/version.ts'), new RegExp(`APP_VERSION = '${version.replaceAll('.', '\\.')}';`));
assert.match(read('apps/web/src/config/version.ts'), new RegExp(`APP_VERSION = '${version.replaceAll('.', '\\.')}';`));
const api = read('apps/api/src/app.ts');
const ui = read('apps/web/src/App.tsx');
assert.match(api, /app\.get\('\/',[\s\S]*APP_VERSION/);
assert.match(api, /app\.get\('\/api\/meta'/);
assert.match(api, /INVALID_JSON/);
assert.ok(api.indexOf('res.locals.requestId = requestId') < api.indexOf('app.use(express.json'), 'request ID middleware must run before JSON parsing');
assert.match(api, /PAYLOAD_TOO_LARGE/);
assert.match(api, /requestId: res\.locals\.requestId/);
assert.match(api, /WEB_ORIGIN\?\.split\(','\)\.map/);
assert.match(ui, /APP_VERSION/);
assert.doesNotMatch(ui, /v0\.501\.0-dev/);
assert.doesNotMatch(api, /0\.504\.0-dev/);
console.log('P513 static integration checks: PASS');
console.log(`Version: ${version}`);
console.log('Verified: synchronized packages, API metadata, UI version, structured request errors.');
