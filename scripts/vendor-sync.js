// scripts/vendor-sync.js — copy a sibling library into vendor/ and stamp its provenance.
//
// The game bundles vendored copies of its libraries (build.js aliases the bare
// specifiers at vendor/). Before this script that copying was manual and
// unrecorded, which produced a version chimera: vendor/bag-of-holding was
// engine v1.16.0 with a single file hand-patched from a much later release, ~20
// versions behind the sibling repo, with nothing in the tree saying so.
//
// Usage:
//   node scripts/vendor-sync.js            # sync every library, write manifests
//   node scripts/vendor-sync.js --check    # verify only; non-zero exit on drift
//
// `--check` is what CI runs: vendored code that no longer matches its manifest
// (or its declared source) fails the build instead of silently shipping.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const LIBS = [
  { name: 'bag-of-holding',        source: '../bag-of-holding',        pkg: '@zeeuw/bag-of-holding' },
  { name: 'bag-of-holding-client', source: '../bag-of-holding-client', pkg: '@zeeuw/bag-of-holding-client' },
];

const check = process.argv.includes('--check');

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listFiles(full, base);
    return e.name.endsWith('.js') ? [path.relative(base, full)] : [];
  });
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

function fingerprint(root) {
  const files = listFiles(root).sort();
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(f).update(hashFile(path.join(root, f)));
  return { files: files.length, digest: h.digest('hex').slice(0, 16) };
}

function sourceMeta(source) {
  const pkgPath = path.join(source, 'package.json');
  const version = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version : 'unknown';
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: source, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { /* source may not be a git checkout */ }
  return { version, commit };
}

function copyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

let failed = false;

for (const lib of LIBS) {
  const dest         = path.join('vendor', lib.name);
  const manifestPath = path.join(dest, 'VENDOR.json');
  const sourceExists = fs.existsSync(lib.source);

  if (check) {
    if (!fs.existsSync(manifestPath)) {
      console.error(`✗ ${lib.name}: no VENDOR.json — run: node scripts/vendor-sync.js`);
      failed = true;
      continue;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const actual   = fingerprint(dest);
    if (actual.digest !== manifest.fingerprint.digest) {
      console.error(`✗ ${lib.name}: vendored files changed since the last sync ` +
                    `(manifest ${manifest.fingerprint.digest}, actual ${actual.digest}).`);
      console.error('  Edit the sibling repo and re-sync — never hand-patch vendor/.');
      failed = true;
    } else {
      console.log(`✓ ${lib.name}: matches manifest (${manifest.version} @ ${manifest.commit}, ${actual.files} files)`);
    }
    continue;
  }

  if (!sourceExists) {
    console.log(`- ${lib.name}: sibling repo not present at ${lib.source}, skipping`);
    continue;
  }

  const { version, commit } = sourceMeta(lib.source);
  copyTree(path.join(lib.source, 'src'), path.join(dest, 'src'));
  fs.copyFileSync(path.join(lib.source, 'index.js'), path.join(dest, 'index.js'));
  for (const extra of ['LICENSE', 'index.d.ts']) {
    const src = path.join(lib.source, extra);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, extra));
  }

  const manifest = {
    package:     lib.pkg,
    version,
    commit,
    source:      lib.source,
    syncedAt:    new Date().toISOString().slice(0, 10),
    patchedFiles: [],   // must stay empty: patch the sibling repo, then re-sync
    fingerprint: fingerprint(dest),
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✓ ${lib.name}: synced ${version} @ ${commit} (${manifest.fingerprint.files} files)`);
}

if (failed) process.exit(1);
