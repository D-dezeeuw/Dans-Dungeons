// build.js — bundles src/main.js + vendor into vendor/app.bundle.js
// Run: node build.js   (or npm run build)

import esbuild from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const version = execSync('git rev-parse --short HEAD').toString().trim();
const outfile = 'vendor/app.bundle.js';

await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle:      true,
  format:      'iife',
  outfile,
  // Map bare specifiers to local vendor files
  alias: {
    'spektrum':       './vendor/spektrum.js',
    'bag-of-holding': './vendor/bag-of-holding/index.js',
  },
  // Inline the version as a global constant
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  logLevel: 'info',
});

// Write version file
fs.writeFileSync('vendor/app.version', version);

// Stamp the version into sw.js so the cache key updates automatically
const swPath = 'sw.js';
const sw = fs.readFileSync(swPath, 'utf8');
const updated = sw.replace(/const VERSION\s*=\s*'app-[^']+';/, `const VERSION  = 'app-${version}';`);
fs.writeFileSync(swPath, updated);

console.log(`\nBuilt ${outfile}  [${version}]`);
console.log(`Size: ${(fs.statSync(outfile).size / 1024).toFixed(1)} KB`);
console.log(`SW cache key: app-${version}`);
