import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let ts;
try { ts = require('typescript'); }
catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js'); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ['node_modules','dist','coverage','.git'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) files.push(file);
  }
}
walk(path.join(root, 'apps'));
let errors = 0;
for (const file of files) {
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
  });
  for (const diagnostic of (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error)) {
    errors += 1;
    console.error(file, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  }
}
console.log(`TypeScript syntax transpilation: ${files.length} files, ${errors} diagnostics`);
process.exitCode = errors ? 1 : 0;
