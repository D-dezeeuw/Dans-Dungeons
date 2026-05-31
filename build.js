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
  minify:      true,
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

// Inline style.css into index.html between the <!-- BUILD:CSS --> markers
const css     = fs.readFileSync('src/ui/style.css', 'utf8');
const html    = fs.readFileSync('index.html', 'utf8');
const inlined = html.replace(
  /<!-- BUILD:CSS -->[\s\S]*?<!-- \/BUILD:CSS -->/,
  `<!-- BUILD:CSS --><style>${css}</style><!-- /BUILD:CSS -->`
);
fs.writeFileSync('index.html', inlined);

console.log(`\nBuilt ${outfile}  [${version}]`);
console.log(`Bundle: ${(fs.statSync(outfile).size / 1024).toFixed(1)} KB`);
console.log(`CSS inlined: ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB`);
console.log(`SW cache key: app-${version}`);
