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
    'spektrum':              './vendor/spektrum.js',
    'bag-of-holding':        './vendor/bag-of-holding/index.js',
    'bag-of-holding-client': './vendor/bag-of-holding-client/index.js',
  },
  // Inline the version as a global constant.
  //
  // DEMO_KEY / DEMO_BASE_URL power the optional "try it without a key" tier
  // (src/ai/demo-key.js). They come from the environment and default to null,
  // so a normal build — and everything CI publishes — ships NO credential.
  // Never hardcode a key here: a browser bundle cannot keep a secret.
  //
  // TENANT_URL is not a credential and is the one of the three that may safely
  // ship: it names the hosted deployment this build offers by default, so a
  // player pasting a tenant key is not asked which server it belongs to. The
  // URL alone opens nothing — every unknown token there is a 404. Unset, a
  // tenant player is simply asked for their host's address.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    DEMO_KEY:        JSON.stringify(process.env.DD_DEMO_KEY      ?? null),
    DEMO_BASE_URL:   JSON.stringify(process.env.DD_DEMO_BASE_URL ?? null),
    TENANT_URL:      JSON.stringify(process.env.DD_TENANT_URL    ?? null),
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
// Stylesheet is loaded at the bottom of <body> (non-blocking, no inline handler needed).
// The BUILD:CSS-DEFERRED section carries only the noscript fallback.
const deferred = `<noscript><link rel="stylesheet" href="src/ui/style.css"></noscript>`;

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
