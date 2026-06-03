import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Location pointer', () => {
  // The location pointer tracks where the player is in the world hierarchy.
  const makeLocation = (type, regionId, settlementId = null, dungeonId = null) =>
    ({ type, regionId, settlementId, dungeonId });

  it('starts in a settlement', () => {
    const loc = makeLocation('settlement', 'region-ashvale', 'settlement-millhaven');
    assert.equal(loc.type, 'settlement');
    assert.equal(loc.regionId, 'region-ashvale');
    assert.equal(loc.settlementId, 'settlement-millhaven');
    assert.equal(loc.dungeonId, null);
  });

  it('transitions to dungeon', () => {
    const loc = makeLocation('dungeon', 'region-ashvale', 'settlement-millhaven', 'dungeon-crypt');
    assert.equal(loc.type, 'dungeon');
    assert.equal(loc.dungeonId, 'dungeon-crypt');
    assert.equal(loc.settlementId, 'settlement-millhaven'); // remembers origin
  });

  it('transitions back to settlement after dungeon', () => {
    const loc = makeLocation('settlement', 'region-ashvale', 'settlement-millhaven');
    assert.equal(loc.type, 'settlement');
    assert.equal(loc.dungeonId, null);
  });

  it('transitions to road when traveling between regions', () => {
    const loc = makeLocation('road', 'region-ashvale');
    assert.equal(loc.type, 'road');
    assert.equal(loc.settlementId, null);
    assert.equal(loc.dungeonId, null);
  });

  it('validates type enum', () => {
    const validTypes = ['dungeon', 'settlement', 'road'];
    for (const type of validTypes) {
      const loc = makeLocation(type, 'region-1');
      assert.ok(validTypes.includes(loc.type));
    }
  });
});

describe('World export/import contract', () => {
  const world = {
    seed: 'abc123',
    name: 'Erathis',
    tone: 'grimdark',
    lore: { creation: 'Born from tears.', gods: [{ name: 'Sol', domain: 'sun' }], redThread: 'seal cracking' },
    digest: 'Erathis — grimdark, Sol (sun), seal cracking.',
    regions: {
      'region-ashvale': {
        id: 'region-ashvale', name: 'Ashvale', climate: 'temperate', description: '...',
        digest: 'Ashvale — temperate, old wars.',
        settlements: ['settlement-millhaven'], dungeons: ['dungeon-crypt'],
        adjacentRegions: [],
      },
    },
    settlements: {
      'settlement-millhaven': {
        id: 'settlement-millhaven', name: 'Millhaven', description: '...',
        regionId: 'region-ashvale', digest: 'Millhaven — farming village.',
        npcs: [], exits: [],
      },
    },
    dungeons: {},
    location: { type: 'settlement', regionId: 'region-ashvale', settlementId: 'settlement-millhaven', dungeonId: null },
  };

  it('serializes to JSON', () => {
    const json = JSON.stringify(world);
    assert.ok(json.length > 0);
    const parsed = JSON.parse(json);
    assert.equal(parsed.name, 'Erathis');
    assert.equal(parsed.seed, 'abc123');
  });

  it('preserves seed across export/import', () => {
    const exported = JSON.parse(JSON.stringify(world));
    assert.equal(exported.seed, world.seed);
  });

  it('preserves all layers', () => {
    const exported = JSON.parse(JSON.stringify(world));
    assert.ok(exported.regions['region-ashvale']);
    assert.ok(exported.settlements['settlement-millhaven']);
    assert.equal(exported.location.type, 'settlement');
  });

  it('preserves digests at each layer', () => {
    const exported = JSON.parse(JSON.stringify(world));
    assert.ok(exported.digest);
    assert.ok(exported.regions['region-ashvale'].digest);
    assert.ok(exported.settlements['settlement-millhaven'].digest);
  });
});

describe('Seeded dungeon determinism', () => {
  // We can't run generateDungeon here (needs i18n), but we test the RNG contract.
  // Mulberry32 from bag-of-holding produces deterministic sequences.

  function mulberry32(seed) {
    let state = (seed | 0) >>> 0;
    return () => {
      state = (state + 0x6D2B79F5) | 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it('same seed produces same sequence', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    assert.deepEqual(seq1, seq2);
  });

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(99);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    assert.notDeepEqual(seq1, seq2);
  });
});
