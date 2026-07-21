#!/usr/bin/env node
// prepublishOnly gate: a dist/ without the WebR/shinylive runtime is a JS shell
// that renders a dead viewer. The runtime is produced by the Dockerfile
// r-builder stage (or scripts/build-shinylive-export.R on an R-provisioned
// host) and folded into dist/ by `npm run build:pkg`.
import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];

for (const f of ['dist/index.system.js', 'dist/shinylive/shinylive-sw.js', 'dist/shinylive/app.json']) {
  if (!existsSync(join(root, f))) failures.push(`missing ${f}`);
}

const pkgDir = join(root, 'dist', 'r-packages');
if (!existsSync(pkgDir) || !readdirSync(pkgDir).some((f) => f.endsWith('.tar.gz'))) {
  failures.push('missing dist/r-packages/*.tar.gz (shim packages)');
}

if (failures.length) {
  console.error('[verify-pkg-dist] refusing to publish a runtime-less package:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('[verify-pkg-dist] stage shinylive-export/ + r-packages/ (Dockerfile rv-runtime stage), then run `npm run build:pkg`.');
  process.exit(1);
}
console.log('[verify-pkg-dist] dist contains the shinylive runtime — OK');
