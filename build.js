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

// Inline critical.css and load style.css non-blocking
const critical = fs.readFileSync('src/ui/critical.css', 'utf8');
const deferred = `<link rel="stylesheet" href="src/ui/style.css" media="print" onload="this.media='all';document.documentElement.classList.add('styles-loaded')">` +
                 `<noscript><link rel="stylesheet" href="src/ui/style.css"></noscript>`;

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(
  /<!-- BUILD:CSS-CRITICAL -->[\s\S]*?<!-- \/BUILD:CSS-CRITICAL -->/,
  `<!-- BUILD:CSS-CRITICAL --><style>${critical}</style><!-- /BUILD:CSS-CRITICAL -->`
);
html = html.replace(
  /<!-- BUILD:CSS-DEFERRED -->[\s\S]*?<!-- \/BUILD:CSS-DEFERRED -->/,
  `<!-- BUILD:CSS-DEFERRED -->${deferred}<!-- /BUILD:CSS-DEFERRED -->`
);
fs.writeFileSync('index.html', html);

console.log(`\nBuilt ${outfile}  [${version}]`);
console.log(`Bundle:   ${(fs.statSync(outfile).size / 1024).toFixed(1)} KB`);
console.log(`Critical: ${(Buffer.byteLength(critical) / 1024).toFixed(1)} KB inlined`);
console.log(`Full CSS: loaded non-blocking after first paint`);
console.log(`SW cache key: app-${version}`);
