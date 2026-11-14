import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const versionFiles = ['package.json', 'apps/api/package.json', 'apps/web/package.json'];
const versions = Object.fromEntries(versionFiles.map((file) => [file, readJson(file).version]));
versions.VERSION = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();
const uniqueVersions = [...new Set(Object.values(versions))];

const appSource = fs.readFileSync(path.join(root, 'apps/api/src/app.ts'), 'utf8');
const routeImports = [...appSource.matchAll(/from ['"]\.\/routes\/([^'"]+)\.js['"]/g)].map((match) => match[1]);
const missingRouteFiles = routeImports.filter((name) => !fs.existsSync(path.join(root, `apps/api/src/routes/${name}.ts`)));
const unmountedRouters = routeImports.filter((name) => !new RegExp(`\\b${name}Router\\b`).test(appSource));

const servicesDir = path.join(root, 'apps/api/src/services');
const serviceFiles = fs.readdirSync(servicesDir).filter((name) => name.endsWith('.ts'));
const apiFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.ts')) apiFiles.push(full);
  }
}
walk(path.join(root, 'apps/api/src'));
const apiText = apiFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const unreferencedServices = serviceFiles.filter((name) => {
  const stem = name.slice(0, -3);
  return !apiText.includes(stem) || (apiText.match(new RegExp(stem, 'g')) ?? []).length < 2;
});

const migrationDir = path.join(root, 'apps/api/src/db');
const migrations = fs.readdirSync(migrationDir).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
const byPrefix = new Map();
for (const name of migrations) {
  const prefix = name.match(/^(\d+)_/)[1];
  byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), name]);
}
const duplicateMigrationPrefixes = [...byPrefix.entries()].filter(([, names]) => names.length > 1);

const report = {
  versions,
  versionConsistent: uniqueVersions.length === 1,
  routeImports,
  missingRouteFiles,
  unmountedRouters,
  serviceModuleCount: serviceFiles.length,
  unreferencedServiceModules: unreferencedServices,
  migrationCount: migrations.length,
  duplicateMigrationPrefixes,
  runtimeHardening: {
    requestCorrelationMiddleware: appSource.includes('normaliseCorrelationId'),
    gracefulShutdown: fs.readFileSync(path.join(root, 'apps/api/src/server.ts'), 'utf8').includes('server.close'),
    environmentValidation: fs.readFileSync(path.join(root, 'apps/api/src/server.ts'), 'utf8').includes('validateEnvironmentConfig')
  },
  releaseStatus: 'NOT_PRODUCTION_READY'
};
console.log(JSON.stringify(report, null, 2));
if (!report.versionConsistent || missingRouteFiles.length || unmountedRouters.length) process.exit(1);
