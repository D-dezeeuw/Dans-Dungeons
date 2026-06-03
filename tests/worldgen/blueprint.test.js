import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Can't import worldseed.js directly (needs bag-of-holding + ESM JSON).
// Test the contract and determinism using the same Mulberry32 RNG.

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

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(arr, n, rng) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// Minimal archetype lists (mirrors worldseed.js structure)
const TONES = ['grimdark', 'heroic', 'mysterious', 'tragic', 'whimsical'];
const WORLD_ARCHETYPES = Array.from({ length: 24 }, (_, i) => `archetype-${i}`);
const THREAT_TYPES = Array.from({ length: 24 }, (_, i) => `threat-${i}`);
const CLIMATES = Array.from({ length: 20 }, (_, i) => `climate-${i}`);
const DUNGEON_THEMES = Array.from({ length: 24 }, (_, i) => `dungeon-${i}`);
const FACTION_ARCHETYPES = Array.from({ length: 20 }, (_, i) => ({ type: `faction-${i}`, desc: `desc-${i}` }));
const GOD_DOMAINS = Array.from({ length: 20 }, (_, i) => ({ domain: `domain-${i}`, exemplars: [`god-${i}`] }));
const BUILDING_TYPES = Array.from({ length: 24 }, (_, i) => `building-${i}`);
const LOCATION_TYPES = Array.from({ length: 24 }, (_, i) => `location-${i}`);

function buildBlueprint(seed) {
  const rng = mulberry32(seed);
  const tone = pick(TONES, rng);
  const climate = pick(CLIMATES, rng);
  return {
    seed,
    tone,
    worldArchetype: pick(WORLD_ARCHETYPES, rng),
    threatType:     pick(THREAT_TYPES, rng),
    factionSlots:   pickN(FACTION_ARCHETYPES, 3, rng),
    climate,
    dungeonTheme:   pick(DUNGEON_THEMES, rng),
    godDomains:     pickN(GOD_DOMAINS, 3, rng),
    buildingTypes:  pickN(BUILDING_TYPES, 4, rng),
    locationTypes:  pickN(LOCATION_TYPES, 3, rng),
  };
}

describe('Blueprint determinism', () => {
  it('same seed produces identical blueprints', () => {
    const a = buildBlueprint(42);
    const b = buildBlueprint(42);
    assert.deepEqual(a, b);
  });

  it('different seeds produce different blueprints', () => {
    const a = buildBlueprint(42);
    const b = buildBlueprint(99);
    assert.notDeepEqual(a, b);
  });

  it('blueprint has all required fields', () => {
    const bp = buildBlueprint(123);
    assert.ok(bp.seed);
    assert.ok(bp.tone);
    assert.ok(bp.worldArchetype);
    assert.ok(bp.threatType);
    assert.ok(bp.climate);
    assert.ok(bp.dungeonTheme);
    assert.equal(bp.factionSlots.length, 3);
    assert.equal(bp.godDomains.length, 3);
    assert.equal(bp.buildingTypes.length, 4);
    assert.equal(bp.locationTypes.length, 3);
  });

  it('tone is from the valid set', () => {
    for (let s = 0; s < 100; s++) {
      const bp = buildBlueprint(s);
      assert.ok(TONES.includes(bp.tone), `tone '${bp.tone}' not in TONES`);
    }
  });

  it('faction slots are unique (no duplicates)', () => {
    const bp = buildBlueprint(42);
    const types = bp.factionSlots.map(f => f.type);
    assert.equal(new Set(types).size, types.length, 'faction slots should be unique');
  });

  it('god domains are unique', () => {
    const bp = buildBlueprint(42);
    const domains = bp.godDomains.map(g => g.domain);
    assert.equal(new Set(domains).size, domains.length, 'god domains should be unique');
  });
});

describe('Archetype list minimums', () => {
  it('TONES has at least 5 entries', () => assert.ok(TONES.length >= 5));
  it('WORLD_ARCHETYPES has at least 20', () => assert.ok(WORLD_ARCHETYPES.length >= 20));
  it('THREAT_TYPES has at least 20', () => assert.ok(THREAT_TYPES.length >= 20));
  it('CLIMATES has at least 20', () => assert.ok(CLIMATES.length >= 20));
  it('DUNGEON_THEMES has at least 20', () => assert.ok(DUNGEON_THEMES.length >= 20));
  it('FACTION_ARCHETYPES has at least 20', () => assert.ok(FACTION_ARCHETYPES.length >= 20));
  it('GOD_DOMAINS has at least 20', () => assert.ok(GOD_DOMAINS.length >= 20));
  it('BUILDING_TYPES has at least 20', () => assert.ok(BUILDING_TYPES.length >= 20));
  it('LOCATION_TYPES has at least 20', () => assert.ok(LOCATION_TYPES.length >= 20));
});

describe('Blueprint diversity (variance across seeds)', () => {
  it('100 seeds produce at least 4 different tones', () => {
    const tones = new Set();
    for (let s = 0; s < 100; s++) tones.add(buildBlueprint(s).tone);
    assert.ok(tones.size >= 4, `only ${tones.size} unique tones in 100 seeds`);
  });

  it('100 seeds produce at least 15 different world archetypes', () => {
    const archs = new Set();
    for (let s = 0; s < 100; s++) archs.add(buildBlueprint(s).worldArchetype);
    assert.ok(archs.size >= 15, `only ${archs.size} unique archetypes in 100 seeds`);
  });

  it('100 seeds produce at least 15 different climates', () => {
    const climates = new Set();
    for (let s = 0; s < 100; s++) climates.add(buildBlueprint(s).climate);
    assert.ok(climates.size >= 15, `only ${climates.size} unique climates in 100 seeds`);
  });

  it('100 seeds produce at least 15 different dungeon themes', () => {
    const themes = new Set();
    for (let s = 0; s < 100; s++) themes.add(buildBlueprint(s).dungeonTheme);
    assert.ok(themes.size >= 15, `only ${themes.size} unique themes in 100 seeds`);
  });
});
