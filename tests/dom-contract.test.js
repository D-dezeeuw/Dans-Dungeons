// DOM contract — every element id the UI reaches for must exist in index.html.
//
// This guards a defect that survived the repo's entire history: chips.js and
// input.js looked up #action-chips / #character-chips / #skill-chips, which were
// never in the markup. Every renderer null-guards, so the whole click-to-play
// layer silently no-opped — the shop printed "Wares for sale:" and then nothing,
// and Retry/Flee/Restart chips were invisible. No test loaded index.html, so
// nothing caught it.
//
// Zero-dep: index.html is parsed with regexes rather than a DOM library, which
// is enough to assert "an element with this id is declared".

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const declaredIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

function uiSourceFiles(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return uiSourceFiles(full);
    return e.name.endsWith('.js') ? [full] : [];
  });
}

// Ids the app creates at runtime rather than declaring in markup.
const RUNTIME_CREATED = new Set(['ab-tooltip']);

describe('index.html declares every id the UI looks up', () => {
  const files = uiSourceFiles();

  it('finds source files to scan', () => {
    assert.ok(files.length > 10, 'expected to scan the src tree');
  });

  for (const file of files) {
    const src  = fs.readFileSync(file, 'utf8');
    const rel  = path.relative(ROOT, file);
    const ids  = [...src.matchAll(/getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g)].map(m => m[1]);
    // Skip interpolated ids (`ab-${dir}`) — the literal parts are asserted by
    // the explicit checks below rather than guessed at here.
    const want = [...new Set(ids)].filter(id => !id.includes('${') && !RUNTIME_CREATED.has(id));
    if (!want.length) continue;

    it(`${rel} — ${want.length} id(s) exist in the markup`, () => {
      const missing = want.filter(id => !declaredIds.has(id));
      assert.deepEqual(missing, [],
        `${rel} looks up element id(s) that index.html never declares: ${missing.join(', ')}. ` +
        'A null-guarded renderer will silently do nothing — add the element or delete the lookup.');
    });
  }
});

describe('the click-to-play layer is wired', () => {
  // Named explicitly so a future markup refactor cannot quietly drop them again.
  // The compass ids are built by interpolation in actionbar.js, so they are
  // listed here rather than discovered by the scan above.
  for (const id of ['action-chips', 'character-chips', 'skill-chips',
                    'ab-north', 'ab-south', 'ab-east', 'ab-west']) {
    it(`#${id} exists`, () => {
      assert.ok(declaredIds.has(id), `#${id} is missing — chip rendering would silently no-op`);
    });
  }

  it('every id is declared at most once', () => {
    const seen = new Map();
    for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
      seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
    }
    const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    assert.deepEqual(dupes, [], `duplicate element ids: ${dupes.join(', ')}`);
  });
});

describe('Spektrum bindings reference real markup', () => {
  it('data-each blocks declare their alias with data-as', () => {
    const eaches = [...html.matchAll(/data-each="([^"]+)"([^>]*)>/g)];
    for (const [, expr, rest] of eaches) {
      assert.match(rest, /data-as="/, `data-each="${expr}" has no data-as alias`);
    }
  });
});
