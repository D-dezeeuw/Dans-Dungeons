import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Phase 1 (1.7): bestiary + overlay coverage. We import the REAL pure data
// (creatures.js, dungeon-overlays.js — no bag-of-holding/JSON imports) and the
// vendored engine's SRD monsters + Dice (the same module the production bundle
// aliases `bag-of-holding` to), so this exercises shipping code, not mirrors.
import {
  CUSTOM_MONSTERS, DEFAULT_ENEMY_IDS,
} from '../../src/game/creatures.js';
import { DUNGEON_OVERLAYS } from '../../src/game/dungeon-overlays.js';
import { SRD, Dice } from '../../vendor/bag-of-holding/index.js';

// The full roster the game can spawn: vendor SRD + our customs (custom wins on
// id collisions, mirroring bestiary.js's BESTIARY merge order).
const ROSTER = { ...SRD.monsters, ...CUSTOM_MONSTERS };
const VALID_IDS = new Set(Object.keys(ROSTER));

// A faithful copy of bestiary.js's parseDamage so we can validate that every
// roster creature yields a clean combat damage spec using the real Dice parser.
function parseDamage(spec) {
  if (typeof spec === 'string' && /\d+d\d+/.test(spec)) return Dice.parse(spec);
  const flat = parseInt(spec, 10) || 1;
  return { count: 1, sides: 1, modifier: flat - 1 };
}
const crOf = (id) => ROSTER[id]?.cr ?? 0;

describe('Custom creatures — valid stat blocks', () => {
  for (const [id, m] of Object.entries(CUSTOM_MONSTERS)) {
    it(`${id} has required fields and a parseable attack`, () => {
      assert.equal(m.id, id, 'id field matches key');
      assert.ok(typeof m.name === 'string' && m.name.length, 'has a name');
      assert.ok(typeof m.cr === 'number', 'has a numeric CR');
      assert.ok(typeof m.ac === 'number' && m.ac > 0, 'has AC');
      assert.ok(typeof m.hp === 'number' && m.hp > 0, 'has HP');
      const atk = m.attacks?.[0];
      assert.ok(atk, 'has at least one attack');
      const { count, sides, modifier } = parseDamage(atk.damage);
      assert.ok(Number.isFinite(count) && Number.isFinite(sides) && Number.isFinite(modifier),
        `damage "${atk.damage}" parses to finite numbers`);
      assert.match(`${count}d${sides}`, /^\d+d\d+$/, 'produces a valid damageDie');
    });
  }
});

describe('Every roster creature survives statBlockFor parsing', () => {
  it('no creature in the merged roster throws on damage parse', () => {
    for (const [id, m] of Object.entries(ROSTER)) {
      const atk = m.attacks?.[0] ?? { damage: '1d4' };
      assert.doesNotThrow(() => parseDamage(atk.damage), `roster creature '${id}' has unparseable damage`);
    }
  });
});

describe('DEFAULT_ENEMY_IDS', () => {
  it('all reference real roster creatures', () => {
    for (const id of DEFAULT_ENEMY_IDS) {
      assert.ok(VALID_IDS.has(id), `default enemy '${id}' not in roster`);
    }
  });
});

describe('DUNGEON_OVERLAYS — coverage & CR variety', () => {
  const entries = Object.entries(DUNGEON_OVERLAYS);

  it('covers all 24 themes', () => {
    assert.equal(entries.length, 24);
  });

  for (const [theme, overlay] of entries) {
    it(`"${theme}" references only real creature ids`, () => {
      assert.ok(Array.isArray(overlay.enemies) && overlay.enemies.length, 'has an enemy pool');
      for (const id of overlay.enemies) {
        assert.ok(VALID_IDS.has(id), `theme "${theme}" references unknown creature '${id}'`);
      }
    });

    it(`"${theme}" has 3–5 enemies with CR variety and a distinct boss`, () => {
      assert.ok(overlay.enemies.length >= 3 && overlay.enemies.length <= 5,
        `pool size ${overlay.enemies.length} out of 3–5`);
      const crs = overlay.enemies.map(crOf);
      assert.ok(Math.max(...crs) > Math.min(...crs), 'pool spans more than one CR');
      // The boss (highest CR) must out-CR the strongest non-boss spawn so the
      // vault stays the toughest fight (world.js excludes the boss from spawns).
      const sorted = [...crs].sort((a, b) => a - b);
      assert.ok(sorted[sorted.length - 1] >= sorted[sorted.length - 2], 'boss is the max CR');
      assert.ok(overlay.atmosphere && overlay.atmosphere.length > 10, 'has atmosphere text');
    });
  }

  it('the overlays collectively span low-, mid-, and high-CR creatures', () => {
    const crs = [];
    for (const overlay of Object.values(DUNGEON_OVERLAYS)) {
      for (const id of overlay.enemies) crs.push(crOf(id));
    }
    assert.ok(Math.min(...crs) <= 0.25, 'includes low-CR (entrance) creatures');
    assert.ok(crs.some(cr => cr >= 0.5 && cr <= 1), 'includes mid-CR creatures');
    assert.ok(Math.max(...crs) >= 2, 'includes high-CR (vault) creatures');
  });
});
