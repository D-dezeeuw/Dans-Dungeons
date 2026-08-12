// Setting packs (doc 19, Part I) — the rules that keep content from breaking logic.
//
// A pack is data, and data has no type checker. The failures it can ship are
// all of the same shape: fine at genesis, fatal at hour four. An enemy pool
// naming a creature with no stat block crashes the dungeon that rolls it; a
// dungeon theme with no dressing renders a room with no detail; an i18n key
// with a typo is not an override, it is a silent no-op that leaves the pack
// looking applied. This suite is the gate for all of that.
//
// The other half is the classic pack, which must be a no-op provably rather
// than by inspection — mounting it has to produce byte-identical worlds to not
// having packs at all. The vendored library is imported by relative path (the
// bare specifier is an esbuild alias the test runner cannot resolve), which is
// how the identity assertion can run against the real blueprint factory.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SETTING_PACKS, DEFAULT_PACK_ID, packIds, resolvePack, isKnownPack, packCard,
  pickPack, lintPack, flattenKeys, renderVoiceFields, VOICE_TOKEN_BUDGET,
} from '../src/settings/packs.js';
import { PACK as classic } from '../src/settings/pack-classic.js';
import { CUSTOM_MONSTERS, OVERWORLD_ENEMY_IDS, DEFAULT_ENEMY_IDS } from '../src/game/creatures.js';
import { estimateTokens } from '../src/game/scope-budget.js';
import {
  buildBlueprint, deriveBlueprint, generateDungeon, DUNGEON_OVERLAYS, CLIMATE_BANDS,
} from '../vendor/bag-of-holding-client/index.js';
import { SRD, elevate } from '../vendor/bag-of-holding/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/${code}.json`), 'utf8'));
const BASE_KEYS = new Set(flattenKeys(bundle('en')));

// Every creature the engine can actually run a fight with — src/game/bestiary.js
// composes the same set, but it imports the `bag-of-holding` bare specifier, so
// tests reach the engine the way tests/spells.test.js does.
const KNOWN_IDS = new Set(Object.keys({ ...SRD.monsters, ...CUSTOM_MONSTERS }));
// Creatures the game reaches WITHOUT consulting a dungeon overlay: road
// encounters and the pool a themeless dungeon falls back to.
const REACHABLE = [...new Set([...OVERWORLD_ENEMY_IDS, ...DEFAULT_ENEMY_IDS])];

describe('every shipped pack passes the lint', () => {
  for (const [id, pack] of Object.entries(SETTING_PACKS)) {
    it(`${id} is sound`, () => {
      const problems = lintPack(pack, {
        knownCreatureIds: KNOWN_IDS,
        baseKeys: BASE_KEYS,
        climateBands: CLIMATE_BANDS,
        reachableCreatureIds: REACHABLE,
      });
      assert.deepEqual(problems, [], problems.join('\n'));
    });

    it(`${id} declares itself honestly`, () => {
      assert.equal(pack.id, id === 'classic' ? 'classic' : id, 'registry key and pack id must agree');
      assert.ok(Object.isFrozen(pack), 'a pack is immutable content');
      assert.ok(packCard(pack, 'en').name, 'needs a name for the wizard card');
    });
  }
});

describe('the lint actually catches what it claims to', () => {
  const base = { id: 'test', packVersion: 1, card: { en: { name: 'T', blurb: 'b' } } };
  const lint = (over) => lintPack({ ...base, ...over }, {
    knownCreatureIds: KNOWN_IDS, baseKeys: BASE_KEYS, climateBands: CLIMATE_BANDS,
    reachableCreatureIds: REACHABLE,
  }).join(' | ');

  it('rejects an enemy with no stat block', () => {
    assert.match(lint({ overlays: { den: { atmosphere: 'x', enemies: ['goblin', 'skeleton', 'chrome-samurai'] } } }),
      /unknown creature 'chrome-samurai'/);
  });

  it('rejects a theme with no overlay, climate or dressing', () => {
    const out = lint({ tables: { dungeonThemes: ['server-crypt'] } });
    assert.match(out, /no overlay/);
    assert.match(out, /no climate bands/);
    assert.match(out, /no room dressing/);
  });

  it('rejects an unknown climate band', () => {
    assert.match(lint({ themeClimates: { den: ['neon'] } }), /unknown climate band 'neon'/);
  });

  it('rejects a typo\'d i18n key, but allows tables packs mint ids in', () => {
    assert.match(lint({ i18n: { en: { world: { hosueStyles: ['x'] } } } }), /does not exist in the base bundle/);
    // `world.dressing.<theme>` is a table packs mint their own ids in, so an
    // id the base bundle never heard of is an addition, not a typo.
    assert.equal(lint({ i18n: { en: { world: { dressing: { 'server-crypt': ['a'] } } } } }), '');
  });

  it('rejects a translation with no original', () => {
    assert.match(lint({ i18n: { en: {}, nl: { world: { houseStyles: ['x'] } } } }), /has no English original/);
  });

  it('rejects half a naming culture', () => {
    assert.match(lint({ syllables: { continentPrefixes: ['Ka', 'Vo', 'Se', 'Tu'] } }),
      /syllables.continentSuffixes needs at least four/);
  });

  it('rejects a voice block that would tax every turn', () => {
    const fat = {
      address: ['choom'],
      register: 'x'.repeat(1200),
      examples: { narrator: ['a'], npc: ['b'] },
    };
    assert.match(lint({ voice: fat }), /over the 120 budget/);
    assert.match(lint({ voice: { address: [], register: 'terse' } }), /at least one address term/);
    assert.match(lint({ voice: { address: ['x'], examples: { npc: ['a', 'b', 'c', 'd'] } } }), /more than 3 lines/);
  });

  it('rejects one creature id claimed by two themes', () => {
    // Display names are keyed by creature id globally, so the second theme
    // would silently show the first theme's name for the same stat block.
    const out = lint({ overlays: {
      a: { atmosphere: 'x', enemies: ['goblin', 'skeleton', 'ghoul'] },
      b: { atmosphere: 'y', enemies: ['skeleton', 'zombie', 'wight'] },
    } });
    assert.match(out, /'skeleton' is in both 'a' and 'b' — one id, one name/);
  });

  it('rejects climate work that quietly does not apply', () => {
    const withThemes = {
      tables: { dungeonThemes: ['den'] },
      overlays: { den: { atmosphere: 'x', enemies: ['goblin', 'skeleton', 'ghoul'] } },
      i18n: { en: { world: { dressing: { den: ['a detail long enough'] } } } },
    };
    // A climate entry for a theme that is not rolled reads as coverage and is not.
    assert.match(lint({ ...withThemes, themeClimates: { den: ['arid'], ghost: ['mire'] } }),
      /themeClimates names 'ghost', which is not in dungeonThemes/);
    // A band nothing claims falls back to every theme — the pack's careful
    // climate work stops applying exactly there.
    assert.match(lint({ ...withThemes, themeClimates: { den: ['arid'] } }),
      /no theme claims the 'mire' band/);
    assert.match(lint({ ...withThemes, themeClimates: { den: ['arid'] }, bandSettlements: { neon: ['x'] } }),
      /bandSettlements names unknown climate band 'neon'/);
  });

  it('rejects a creature rename that leaves the travel pools in fantasy clothes', () => {
    const out = lint({ i18n: { en: { world: { enemyNames: { skeleton: 'Chassis' } } } } });
    assert.match(out, /unskinned/, 'a pack that renames one creature must account for the ones it cannot see');
  });

  it('refuses functions and rules material', () => {
    assert.match(lint({ nameFor: () => 'x' }), /is a function/);
    assert.match(lint({ monsters: {} }), /re-skin, they do not re-rule/);
  });
});

describe('classic is a no-op, provably', () => {
  it('changes no blueprint the library would have rolled', () => {
    for (const seed of [1, 12345, 987654321, 2147483646]) {
      const plain  = buildBlueprint(seed);
      const packed = buildBlueprint(seed, { tables: classic.tables });
      assert.deepEqual(packed, plain, `seed ${seed} must roll identically under the classic pack`);
    }
  });

  it('changes no scoped blueprint either', () => {
    const tables = classic.tables;
    const world = buildBlueprint(4242);
    for (const scope of ['continent', 'province', 'region']) {
      assert.deepEqual(
        deriveBlueprint(world, 777, scope, { tables }),
        deriveBlueprint(world, 777, scope),
        `${scope} slices must be untouched by the classic pack`,
      );
    }
  });

  it('changes no dungeon the generator would have built', () => {
    const bp = buildBlueprint(31337);
    const content = {
      houseStyles: ['old hold'], roomPools: {}, treasures: ['a crown'], keys: ['a key'],
      loot: ['a coin'], domainTreasures: {}, domainKeys: {},
      enemyName: (id) => id, enemyIntro: (id) => `${id} stirs`,
    };
    const build = (overlays) => generateDungeon(555, {
      blueprint: bp, overlays, defaultEnemyIds: ['goblin', 'skeleton'],
      statBlockFor: (id) => ({ hp: 7, maxHp: 7, ac: 12, toHit: 3, damageDie: '1d6', damageBonus: 1, cr: 0.25, name: id }),
      crOf: () => 0.25, content,
    });
    assert.deepEqual(build(classic.overlays ?? DUNGEON_OVERLAYS), build(DUNGEON_OVERLAYS));
  });

  it('inherits at every seam', () => {
    for (const field of ['tables', 'themeClimates', 'syllables', 'overlays', 'i18n', 'voice', 'promptLine', 'classSkins']) {
      assert.equal(classic[field], null, `classic.${field} must inherit, not restate`);
    }
    assert.ok(classic.imageStyle.includes('sepia'), 'the sketch style moved here verbatim');
  });
});

describe('a pack\'s tables reach the factory as a partial override', () => {
  // The merge itself lives in the library (it owns DEFAULT_TABLES); what this
  // repo has to pin is that a pack can state ONE table and the rest still comes
  // from the defaults — the shape every pack after classic relies on.
  it('replaces what it names and inherits the rest', () => {
    const bp = buildBlueprint(5, { tables: { dungeonThemes: ['server-crypt'] } });
    assert.equal(bp.dungeonTheme, 'server-crypt');
    assert.ok(typeof bp.tone === 'string' && bp.tone.length > 0, 'untouched tables still resolve');
    assert.ok(Array.isArray(bp.buildingTypes) && bp.buildingTypes.length > 0);
  });

  it('a null tables field is the same as no pack at all', () => {
    assert.deepEqual(buildBlueprint(77, { tables: null }), buildBlueprint(77));
  });
});

describe('seeded selection: the theme is drawn first', () => {
  const ids = ['alpha', 'beta', 'gamma', 'delta'];

  it('is deterministic for a seed', () => {
    for (const seed of [1, 2, 99, 123456, 2147483647]) {
      assert.equal(pickPack(seed, ids), pickPack(seed, ids));
    }
  });

  it('does not depend on registry insertion order', () => {
    const shuffled = ['gamma', 'delta', 'alpha', 'beta'];
    for (const seed of [7, 5150, 900001]) {
      assert.equal(pickPack(seed, ids), pickPack(seed, shuffled),
        'sorting the list is what stops adding a pack reshuffling old seeds');
    }
  });

  it('spreads across the registry rather than favouring one pack', () => {
    const counts = {};
    for (let seed = 1; seed <= 400; seed++) {
      const id = pickPack(seed, ids);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    assert.deepEqual(Object.keys(counts).sort(), [...ids].sort(), 'every pack must be reachable');
    for (const [id, n] of Object.entries(counts)) {
      assert.ok(n > 400 / ids.length / 3, `${id} drawn only ${n}/400 times — the mix is lopsided`);
    }
  });

  it('degrades safely', () => {
    assert.equal(pickPack(1, []), DEFAULT_PACK_ID);
    assert.ok(ids.includes(pickPack(undefined, ids)));
    assert.ok(ids.includes(pickPack('not a number', ids)));
  });
});

describe('the registry', () => {
  it('resolves unknown ids to classic instead of throwing', () => {
    assert.equal(resolvePack('no-such-pack').id, 'classic');
    assert.equal(resolvePack(undefined).id, 'classic');
    assert.equal(isKnownPack('no-such-pack'), false);
    assert.equal(isKnownPack(DEFAULT_PACK_ID), true);
  });

  it('lists ids sorted, and always includes the default', () => {
    assert.deepEqual(packIds(), [...packIds()].sort());
    assert.ok(packIds().includes(DEFAULT_PACK_ID));
  });

  it('cards fall back to English for a locale a pack has not been translated into', () => {
    assert.equal(packCard(classic, 'de').name, classic.card.en.name);
  });
});

describe('the voice block is measured the way it is rendered', () => {
  it('costs what the lint says it costs', () => {
    const voice = { address: ['choom'], register: 'clipped street cant', forbid: ['thee'], examples: { npc: ['You buying?'] } };
    const rendered = renderVoiceFields(voice);
    assert.match(rendered, /choom/);
    assert.match(rendered, /You buying\?/);
    assert.ok(estimateTokens(rendered) < VOICE_TOKEN_BUDGET);
  });

  it('renders nothing for a pack with no voice', () => {
    assert.equal(renderVoiceFields(null), '');
  });
});

describe('the vault boss wears the same wardrobe as everything else', () => {
  // The finale is the one fight a player is guaranteed to read closely, and it
  // was the one creature the locale table could not rename: bossBlockFor built
  // its name from the SRD block, and the dungeon generator applies a block's
  // `name` OVER the content provider's. Four rooms of "Sump Rat" and then
  // "Elite Giant Rat" is exactly the genre leak a pack exists to prevent.
  it('a skinned name survives the elite template', () => {
    const raised = elevate({ ...SRD.monsters.zombie, id: 'zombie', name: 'Ward Leftover' }, 'elite');
    assert.equal(raised.name, 'Elite Ward Leftover');
  });

  it('the unskinned path is unchanged', () => {
    assert.equal(elevate({ ...SRD.monsters.zombie, id: 'zombie' }, 'elite').name, 'Elite Zombie');
  });
});
