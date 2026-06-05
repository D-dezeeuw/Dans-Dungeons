import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Phase 0 (0.6): verify the blueprint's pre-seeded choices flow through to the
// constraint suffixes each AI generator appends to its system prompt. We import
// the REAL pure formatters (blueprint-context.js has no bag-of-holding / JSON
// imports, so it loads in the node test runner) rather than mirroring them.
import {
  blueprintContext,
  worldSeedConstraints,
  beatsHints,
  factionsHints,
  regionHints,
  settlementHints,
} from '../../vendor/bag-of-holding-client/src/worldgen/blueprint.js';

// A representative blueprint (same shape buildWorldBlueprint() returns).
const BP = {
  seed: 12345,
  tone: 'grimdark',
  worldArchetype: 'post-collapse empire',
  threatType: 'undead plague',
  beatArc: ['omen', 'discovery', 'betrayal', 'sacrifice', 'pyrrhic victory'],
  factionSlots: [
    { type: 'crown', desc: 'ruling monarchy or imperial authority' },
    { type: 'cult', desc: 'secret worshippers of a dark or forbidden power' },
    { type: 'guild', desc: 'trade or craft organization with economic leverage' },
  ],
  climate: 'frozen tundra',
  settlementType: 'mining camp',
  dungeonTheme: 'undead crypt',
  godDomains: [
    { domain: 'death', exemplars: ['Kelemvor', 'Myrkul'] },
    { domain: 'war', exemplars: ['Tempus'] },
  ],
  buildingTypes: ['tavern', 'blacksmith', 'temple', 'barracks'],
  locationTypes: ['crossroads', 'ancient ruin', 'standing stones'],
};

describe('blueprintContext (world-seed constraint block)', () => {
  const ctx = blueprintContext(BP);

  it('includes the core archetype choices', () => {
    assert.match(ctx, /Tone: grimdark/);
    assert.match(ctx, /World archetype: post-collapse empire/);
    assert.match(ctx, /Primary threat: undead plague/);
    assert.match(ctx, /Climate: frozen tundra/);
    assert.match(ctx, /Dungeon theme: undead crypt/);
  });

  it('lists god domains with an exemplar', () => {
    assert.match(ctx, /God domains to draw from: death \(e\.g\. Kelemvor\), war \(e\.g\. Tempus\)/);
  });

  it('lists faction archetypes with descriptions', () => {
    assert.match(ctx, /Faction archetypes:.*crown.*cult.*guild/s);
  });

  it('lists the beat arc, settlement type, buildings, and landmarks', () => {
    assert.match(ctx, /Story arc beats: omen → discovery → betrayal → sacrifice → pyrrhic victory/);
    assert.match(ctx, /Settlement type: mining camp/);
    assert.match(ctx, /Key buildings: tavern, blacksmith, temple, barracks/);
    assert.match(ctx, /Nearby landmarks: crossroads, ancient ruin, standing stones/);
  });

  it('returns an empty string when no blueprint is given', () => {
    assert.equal(blueprintContext(null), '');
    assert.equal(blueprintContext(undefined), '');
  });
});

describe('worldSeedConstraints', () => {
  it('wraps the full context with a leading instruction', () => {
    const s = worldSeedConstraints(BP);
    assert.match(s, /Use these creative constraints:/);
    assert.match(s, /Tone: grimdark/);
  });
  it('is empty without a blueprint', () => {
    assert.equal(worldSeedConstraints(null), '');
  });
});

describe('beatsHints', () => {
  it('embeds the arc and faction types', () => {
    const s = beatsHints(BP);
    assert.match(s, /Use this story arc structure: omen → discovery → betrayal/);
    assert.match(s, /Tie beats to these faction types: crown, cult, guild/);
  });
  it('is empty without a blueprint', () => {
    assert.equal(beatsHints(undefined), '');
  });
});

describe('factionsHints', () => {
  it('asks for exactly N factions matching the slot archetypes', () => {
    const s = factionsHints(BP);
    assert.match(s, /Create exactly 3 factions/);
    assert.match(s, /1\. A "crown" faction/);
    assert.match(s, /2\. A "cult" faction/);
    assert.match(s, /3\. A "guild" faction/);
    assert.match(s, /red thread and primary threat/);
  });
  it('is empty without a blueprint', () => {
    assert.equal(factionsHints(null), '');
  });
});

describe('regionHints', () => {
  it('embeds climate, dungeon theme, and landmarks', () => {
    const s = regionHints(BP);
    assert.match(s, /climate is: frozen tundra/);
    assert.match(s, /themed as: undead crypt/);
    assert.match(s, /Nearby landmarks include: crossroads, ancient ruin, standing stones/);
  });
  it('is empty without a blueprint', () => {
    assert.equal(regionHints(null), '');
  });
});

describe('settlementHints', () => {
  it('embeds settlement type, buildings, and a faction affiliation', () => {
    const s = settlementHints(BP);
    assert.match(s, /This settlement is a: mining camp/);
    assert.match(s, /Key buildings in this settlement: tavern, blacksmith, temple, barracks/);
    assert.match(s, /affiliated with one of these factions: crown, cult, guild/);
  });
  it('is empty without a blueprint', () => {
    assert.equal(settlementHints(null), '');
  });
});
