// tests/i18n-parity.test.js — the locale bundles, checked for CONTENT parity.
//
// A key-set comparison passed for the repo's whole history while Dutch players
// met 39 creatures introduced in English, because the missing keys were in a
// table read through `tRaw` — the key `world.enemyIntros` existed in both
// bundles, so key equality said "parity" and the entries inside it disagreed.
// These assertions go one level deeper: the tables the game indexes into have
// to agree entry for entry, and a string that is byte-identical in both locales
// has to be one that is legitimately the same in both.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/${code}.json`), 'utf8'));
const en = load('en');
const nl = load('nl');
const LOCALES = { en, nl };

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const flat = { en: flatten(en), nl: flatten(nl) };

// Tables the game indexes by id at runtime. A gap here is not a missing label,
// it is a creature that speaks the wrong language mid-encounter.
const KEYED_TABLES = [
  'world.enemyIntros',
  'world.enemyNames',
];

// Themed content indexed by dungeon theme. Every theme the generator can roll
// needs a pool in both locales, or a Dutch campaign in that theme silently
// falls back to the generic one while an English campaign gets the authored set.
const THEMED_TABLES = ['world.dressing'];

// Model prompts are not player-facing copy and follow their own convention:
// the instruction is written in English and the OUTPUT language is declared
// explicitly (`Write in {{language}}`, "The player writes in Dutch"). Whether
// each prompt keeps its contract is `tests/prompt-contract.test.js`'s job, not
// this file's — checking them here would only produce a growing exemption list
// that says nothing.
const PROMPT_PREFIX = 'ai.';

// Strings that are legitimately identical across locales: proper nouns, format
// scaffolding, and terms Dutch borrows unchanged. Anything NOT on this list that
// matches byte for byte is an untranslated string.
const SHARED_VERBATIM = new Set([
  'chrome.title',            // the game's name
  'setup.gameName',
  'tier.deluxeActive',       // "Deluxe" is the product tier's name
  'timeline.start',          // "Start" is the same word in Dutch
  'skills.arcana.label',     // "Arcana" is the skill's proper name
  'spells.cantrip',          // "Cantrip" is used untranslated by Dutch players
  'spells.slotsLeft',        // "Slots: {{…}}" — the loanword Dutch tables use
  'progress.xpGained',       // pure format string
  'meta.status',
  'meta.helpList',
  'settlement.banner',
  'settlement.buyChip',
  'settlement.invLine',
  'charCreate.banner1',
  'map.regionLine',
  'map.settlementLine',
  'map.rumouredLine',
  'story.factionLine',
  // Creature names Dutch uses unchanged. Each is a deliberate call, not an
  // oversight: a Dutch player says "goblin", not "aardmannetje".
  'world.enemyNames.ghoul',
  'world.enemyNames.goblin',
  'world.enemyNames.kobold',
  'world.enemyNames.wolf',
  'world.enemyNames.worg',
]);

describe('locale bundles have the same keys', () => {
  it('nothing in English is missing from Dutch', () => {
    const missing = Object.keys(flat.en).filter(k => !(k in flat.nl));
    assert.deepEqual(missing, [], `nl.json is missing ${missing.length} keys`);
  });

  it('nothing in Dutch is missing from English', () => {
    const missing = Object.keys(flat.nl).filter(k => !(k in flat.en));
    assert.deepEqual(missing, [], `en.json is missing ${missing.length} keys`);
  });
});

describe('keyed content tables agree entry for entry', () => {
  for (const table of KEYED_TABLES) {
    it(`${table} covers the same ids in both locales`, () => {
      const enTable = table.split('.').reduce((o, k) => o?.[k], en) ?? {};
      const nlTable = table.split('.').reduce((o, k) => o?.[k], nl) ?? {};
      assert.deepEqual(
        Object.keys(enTable).sort(), Object.keys(nlTable).sort(),
        `${table} disagrees — this is the gap a key-set check cannot see`,
      );
    });

    it(`${table} has no empty entries`, () => {
      for (const [code, bundle] of Object.entries(LOCALES)) {
        const t = table.split('.').reduce((o, k) => o?.[k], bundle) ?? {};
        for (const [id, value] of Object.entries(t)) {
          assert.ok(typeof value === 'string' && value.trim().length > 0,
            `${code}.json ${table}.${id} is empty`);
        }
      }
    });
  }

  for (const table of THEMED_TABLES) {
    it(`${table} covers the same themes in both locales`, () => {
      const pick = (b) => table.split('.').reduce((o, k) => o?.[k], b) ?? {};
      assert.deepEqual(Object.keys(pick(en)).sort(), Object.keys(pick(nl)).sort());
    });

    it(`${table} entries are non-empty arrays of real sentences`, () => {
      for (const [code, bundle] of Object.entries(LOCALES)) {
        const t = table.split('.').reduce((o, k) => o?.[k], bundle) ?? {};
        for (const [theme, pool] of Object.entries(t)) {
          assert.ok(Array.isArray(pool) && pool.length >= 2,
            `${code}.json ${table}.${theme} needs at least two details or every room draws the same one`);
          for (const line of pool) {
            assert.ok(typeof line === 'string' && line.trim().length > 10,
              `${code}.json ${table}.${theme} has an empty or stub entry`);
          }
        }
      }
    });
  }

  it('every creature with an intro has a display name', () => {
    for (const [code, bundle] of Object.entries(LOCALES)) {
      const intros = Object.keys(bundle.world?.enemyIntros ?? {});
      const names  = bundle.world?.enemyNames ?? {};
      const noName = intros.filter(id => !names[id]);
      assert.deepEqual(noName, [], `${code}.json: creatures with an intro but no name: ${noName.join(', ')}`);
    }
  });
});

describe('no string is silently untranslated', () => {
  it('identical strings are only the ones declared shared', () => {
    const identical = Object.keys(flat.en).filter(k =>
      typeof flat.en[k] === 'string' &&
      flat.en[k] === flat.nl[k] &&
      flat.en[k].trim().length > 3 &&
      !k.startsWith(PROMPT_PREFIX) &&
      !SHARED_VERBATIM.has(k),
    );
    assert.deepEqual(identical, [],
      `these read identically in both locales — translate them, or add them to SHARED_VERBATIM with a reason`);
  });

  it('the shared list has not gone stale', () => {
    // A key that no longer exists, or no longer matches, should leave the list
    // rather than sit there excusing nothing.
    for (const key of SHARED_VERBATIM) {
      assert.ok(key in flat.en, `SHARED_VERBATIM names '${key}', which no longer exists`);
    }
  });
});

describe('interpolation placeholders match across locales', () => {
  it('every {{param}} in English appears in the Dutch string', () => {
    const params = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]).sort();
    const mismatched = [];
    for (const [key, value] of Object.entries(flat.en)) {
      if (typeof value !== 'string' || typeof flat.nl[key] !== 'string') continue;
      const a = params(value), b = params(flat.nl[key]);
      if (a.join() !== b.join()) mismatched.push(`${key}: en(${a.join()}) vs nl(${b.join()})`);
    }
    assert.deepEqual(mismatched, [],
      'a placeholder the Dutch string drops renders as nothing at all for a Dutch player');
  });
});

describe('the mistranslations the lore audit found', () => {
  it("Arcana knows the planes of existence, not the plains", () => {
    // "de vlakten" is fields; the planes are "de bestaansvlakken".
    assert.ok(!/de vlakten/i.test(nl.skills.arcana.desc), 'Arcana still says "de vlakten" (open fields)');
    assert.match(nl.skills.arcana.desc, /bestaansvlakken/);
  });
});

describe('room dressing covers every theme the generator can roll', () => {
  it('each of the overlay themes has an authored pool', async () => {
    const { DUNGEON_OVERLAYS } = await import('../vendor/bag-of-holding-client/index.js');
    const themes = Object.keys(DUNGEON_OVERLAYS);
    for (const [code, bundle] of Object.entries(LOCALES)) {
      const missing = themes.filter(t => !bundle.world?.dressing?.[t]);
      assert.deepEqual(missing, [],
        `${code}.json has no dressing for: ${missing.join(', ')} — those dungeons fall back to the generic pool`);
    }
  });

  it('there is a generic pool for the rooms that skip the theme', () => {
    for (const [code, bundle] of Object.entries(LOCALES)) {
      const generic = bundle.world?.dressingGeneric;
      assert.ok(Array.isArray(generic) && generic.length >= 2, `${code}.json has no usable dressingGeneric`);
    }
  });

  it('no detail is duplicated inside a theme', () => {
    for (const [code, bundle] of Object.entries(LOCALES)) {
      for (const [theme, pool] of Object.entries(bundle.world?.dressing ?? {})) {
        assert.equal(new Set(pool).size, pool.length, `${code}.json ${theme} repeats a detail`);
      }
    }
  });
});
