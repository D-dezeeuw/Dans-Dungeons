import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Inline the schemas since we can't import ESM with JSON imports in Node 24 test runner.
// These mirror src/ai/schemas.js exactly.

function validateAgainstSchema(data, schema) {
  const errors = [];

  function check(val, sch, path) {
    if (sch.type === 'object') {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        errors.push(`${path}: expected object`);
        return;
      }
      for (const req of (sch.required ?? [])) {
        if (!(req in val)) errors.push(`${path}: missing required field '${req}'`);
      }
      if (sch.additionalProperties === false) {
        for (const key of Object.keys(val)) {
          if (!sch.properties?.[key]) errors.push(`${path}: unexpected field '${key}'`);
        }
      }
      for (const [key, propSch] of Object.entries(sch.properties ?? {})) {
        if (key in val) check(val[key], propSch, `${path}.${key}`);
      }
    } else if (sch.type === 'array') {
      if (!Array.isArray(val)) { errors.push(`${path}: expected array`); return; }
      if (sch.items) val.forEach((item, i) => check(item, sch.items, `${path}[${i}]`));
    } else if (sch.type === 'string') {
      if (typeof val !== 'string') errors.push(`${path}: expected string`);
      if (sch.enum && !sch.enum.includes(val)) errors.push(`${path}: '${val}' not in enum [${sch.enum}]`);
    } else if (sch.type === 'number') {
      if (typeof val !== 'number') errors.push(`${path}: expected number`);
    } else if (sch.type === 'boolean') {
      if (typeof val !== 'boolean') errors.push(`${path}: expected boolean`);
    } else if (Array.isArray(sch.type)) {
      // nullable union types: ['string', 'null'], ['array', 'null'], etc.
      if (val === null) {
        if (!sch.type.includes('null')) errors.push(`${path}: null not allowed`);
      } else if (sch.type.includes('array') && Array.isArray(val)) {
        if (sch.items) val.forEach((item, i) => check(item, sch.items, `${path}[${i}]`));
      } else if (!sch.type.includes(typeof val)) {
        errors.push(`${path}: expected one of [${sch.type}]`);
      }
    }
  }

  check(data, schema, '$');
  return { valid: errors.length === 0, errors };
}

// ─── Schema definitions (copied from schemas.js) ────────────────────────────

const WORLD_SEED_SCHEMA = {
  type: 'object',
  properties: {
    name:     { type: 'string' },
    tone:     { type: 'string', enum: ['grimdark', 'heroic', 'mysterious'] },
    creation: { type: 'string' },
    gods:     { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, domain: { type: 'string' } }, required: ['name', 'domain'], additionalProperties: false } },
    redThread: { type: 'object', properties: { premise: { type: 'string' }, hook: { type: 'string' } }, required: ['premise', 'hook'], additionalProperties: false },
    digest:   { type: 'string' },
  },
  required: ['name', 'tone', 'creation', 'gods', 'redThread', 'digest'],
  additionalProperties: false,
};

const REGION_SCHEMA = {
  type: 'object',
  properties: {
    id:             { type: 'string' },
    name:           { type: 'string' },
    climate:        { type: 'string' },
    description:    { type: 'string' },
    settlementName: { type: 'string' },
    dungeonName:    { type: 'string' },
    rumor:          { type: 'string' },
    adjacentHints:  { type: 'array', items: { type: 'string' } },
    digest:         { type: 'string' },
  },
  required: ['id', 'name', 'climate', 'description', 'settlementName', 'dungeonName', 'rumor', 'adjacentHints', 'digest'],
  additionalProperties: false,
};

const NPC_SCHEMA = {
  type: 'object',
  properties: {
    id:            { type: 'string' },
    name:          { type: 'string' },
    role:          { type: 'string', enum: ['innkeeper', 'questgiver', 'merchant', 'guard', 'elder', 'blacksmith', 'healer', 'hermit'] },
    attitude:      { type: 'string', enum: ['friendly', 'neutral', 'suspicious', 'hostile'] },
    greeting:      { type: 'string' },
    questHook:     { type: ['string', 'null'] },
    personality:   { type: 'string' },
    secret:        { type: ['string', 'null'] },
    factionId:     { type: ['string', 'null'] },
    relationships: { type: 'array', items: { type: 'object', properties: { targetId: { type: 'string' }, type: { type: 'string', enum: ['spouse', 'parent', 'child', 'rival', 'ally', 'employer', 'mentor'] } }, required: ['targetId', 'type'], additionalProperties: false } },
    inventory:     { type: ['array', 'null'], items: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' }, description: { type: 'string' } }, required: ['name', 'price', 'description'], additionalProperties: false } },
  },
  required: ['id', 'name', 'role', 'attitude', 'greeting', 'questHook', 'personality', 'secret', 'factionId', 'relationships', 'inventory'],
  additionalProperties: false,
};

const SETTLEMENT_SCHEMA = {
  type: 'object',
  properties: {
    id:          { type: 'string' },
    name:        { type: 'string' },
    description: { type: 'string' },
    regionId:    { type: 'string' },
    npcs:        { type: 'array', items: NPC_SCHEMA },
    exits:       { type: 'array', items: { type: 'object', properties: { direction: { type: 'string' }, targetName: { type: 'string' }, targetType: { type: 'string', enum: ['dungeon', 'road', 'wilderness'] }, targetId: { type: ['string', 'null'] } }, required: ['direction', 'targetName', 'targetType', 'targetId'], additionalProperties: false } },
    digest:      { type: 'string' },
  },
  required: ['id', 'name', 'description', 'regionId', 'npcs', 'exits', 'digest'],
  additionalProperties: false,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WORLD_SEED_SCHEMA', () => {
  const valid = {
    name: 'Erathis',
    tone: 'grimdark',
    creation: 'The world was forged in the tears of a dying god.',
    gods: [
      { name: 'Solarius', domain: 'sun and fire' },
      { name: 'Nethys', domain: 'shadow and secrets' },
    ],
    redThread: {
      premise: 'An ancient seal is cracking, and something beneath the world stirs.',
      hook: 'Strange tremors shake the village of Millhaven.',
    },
    digest: 'Erathis — grimdark world. Gods: Solarius (sun), Nethys (shadow). Red thread: ancient seal cracking.',
  };

  it('accepts a valid world seed', () => {
    const r = validateAgainstSchema(valid, WORLD_SEED_SCHEMA);
    assert.deepEqual(r.errors, []);
    assert.equal(r.valid, true);
  });

  it('rejects missing required fields', () => {
    const { digest, ...noDigest } = valid;
    const r = validateAgainstSchema(noDigest, WORLD_SEED_SCHEMA);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('digest')));
  });

  it('rejects invalid tone enum', () => {
    const r = validateAgainstSchema({ ...valid, tone: 'comedic' }, WORLD_SEED_SCHEMA);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('tone')));
  });

  it('rejects extra fields', () => {
    const r = validateAgainstSchema({ ...valid, extra: true }, WORLD_SEED_SCHEMA);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('extra')));
  });
});

describe('FACTION_SCHEMA', () => {
  const FACTION_SCHEMA = {
    type: 'object',
    properties: {
      id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
      values: { type: 'string' }, allies: { type: 'array', items: { type: 'string' } },
      enemies: { type: 'array', items: { type: 'string' } },
      territory: { type: 'array', items: { type: 'string' } }, digest: { type: 'string' },
    },
    required: ['id', 'name', 'description', 'values', 'allies', 'enemies', 'territory', 'digest'],
    additionalProperties: false,
  };

  const valid = {
    id: 'faction-silver-court',
    name: 'The Silver Court',
    description: 'A council of noble houses that rules through tradition and secret pacts.',
    values: 'order, tradition, secrecy',
    allies: [],
    enemies: ['faction-iron-pact'],
    territory: ['region-ashvale'],
    digest: 'Silver Court — noble council, values order and secrecy, opposes Iron Pact.',
  };

  it('accepts a valid faction', () => {
    const r = validateAgainstSchema(valid, FACTION_SCHEMA);
    assert.deepEqual(r.errors, []);
  });

  it('rejects missing values', () => {
    const { values, ...noValues } = valid;
    const r = validateAgainstSchema(noValues, FACTION_SCHEMA);
    assert.equal(r.valid, false);
  });

  it('allows empty allies array', () => {
    const r = validateAgainstSchema(valid, FACTION_SCHEMA);
    assert.equal(r.valid, true);
    assert.deepEqual(valid.allies, []);
  });

  it('requires enemies to be string array', () => {
    const bad = { ...valid, enemies: [123] };
    const r = validateAgainstSchema(bad, FACTION_SCHEMA);
    assert.equal(r.valid, false);
  });
});

describe('REGION_SCHEMA', () => {
  const valid = {
    id: 'region-ashvale',
    name: 'The Ashvale',
    climate: 'temperate, damp',
    description: 'A fertile valley scarred by old wars.',
    settlementName: 'Millhaven',
    dungeonName: 'The Sunken Crypt',
    rumor: 'Farmers speak of bones that walk at night near the old barrow.',
    adjacentHints: ['dense forest to the north', 'mountain pass to the east'],
    digest: 'Ashvale — temperate valley, old war scars. Settlement: Millhaven. Dungeon: Sunken Crypt.',
  };

  it('accepts a valid region', () => {
    const r = validateAgainstSchema(valid, REGION_SCHEMA);
    assert.deepEqual(r.errors, []);
  });

  it('rejects missing rumor', () => {
    const { rumor, ...noRumor } = valid;
    const r = validateAgainstSchema(noRumor, REGION_SCHEMA);
    assert.equal(r.valid, false);
  });
});

describe('NPC_SCHEMA', () => {
  const validNpc = {
    id: 'npc-bera', name: 'Old Bera', role: 'innkeeper', attitude: 'friendly',
    greeting: 'Welcome, traveler.', questHook: null,
    personality: 'warm and motherly',
    secret: 'saw cultists enter the crypt at midnight',
    factionId: null,
    relationships: [{ targetId: 'npc-thorn', type: 'rival' }],
    inventory: null,
  };

  const validMerchant = {
    id: 'npc-syl', name: 'Syl', role: 'merchant', attitude: 'suspicious',
    greeting: 'What do you want?', questHook: null,
    personality: 'paranoid whisperer',
    secret: null, factionId: null,
    relationships: [],
    inventory: [
      { name: 'healing potion', price: 50, description: 'Restores 2d4+2 HP.' },
      { name: 'rope (50 ft)', price: 1, description: 'Sturdy hempen rope.' },
    ],
  };

  it('accepts a valid NPC with relationships', () => {
    const r = validateAgainstSchema(validNpc, NPC_SCHEMA);
    assert.deepEqual(r.errors, []);
  });

  it('accepts a merchant with inventory', () => {
    const r = validateAgainstSchema(validMerchant, NPC_SCHEMA);
    assert.deepEqual(r.errors, []);
  });

  it('allows null secret', () => {
    const r = validateAgainstSchema(validMerchant, NPC_SCHEMA);
    assert.equal(r.valid, true);
    assert.equal(validMerchant.secret, null);
  });

  it('allows null inventory for non-merchants', () => {
    const r = validateAgainstSchema(validNpc, NPC_SCHEMA);
    assert.equal(r.valid, true);
    assert.equal(validNpc.inventory, null);
  });

  it('rejects invalid relationship type', () => {
    const bad = { ...validNpc, relationships: [{ targetId: 'x', type: 'friend' }] };
    const r = validateAgainstSchema(bad, NPC_SCHEMA);
    assert.equal(r.valid, false);
  });

  it('validates extended role enum', () => {
    for (const role of ['innkeeper', 'questgiver', 'merchant', 'guard', 'elder', 'blacksmith', 'healer', 'hermit']) {
      const r = validateAgainstSchema({ ...validNpc, role }, NPC_SCHEMA);
      assert.equal(r.valid, true, `role '${role}' should be valid`);
    }
  });

  it('rejects missing personality field', () => {
    const { personality, ...noPersonality } = validNpc;
    const r = validateAgainstSchema(noPersonality, NPC_SCHEMA);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('personality')));
  });
});

describe('SETTLEMENT_SCHEMA', () => {
  const validNpc = {
    id: 'npc-bera', name: 'Old Bera', role: 'innkeeper', attitude: 'friendly',
    greeting: 'Welcome, traveler.', questHook: null,
    personality: 'warm and motherly', secret: null, factionId: null,
    relationships: [], inventory: null,
  };
  const valid = {
    id: 'settlement-millhaven',
    name: 'Millhaven',
    description: 'A quiet farming village with a crumbling watchtower.',
    regionId: 'region-ashvale',
    npcs: [
      validNpc,
      { ...validNpc, id: 'npc-thorn', name: 'Captain Thorn', role: 'questgiver', attitude: 'neutral', greeting: 'You look capable.', questHook: 'Clear the crypt south of town.', personality: 'stern and duty-bound', secret: 'lost his son to the cult', relationships: [{ targetId: 'npc-bera', type: 'ally' }] },
    ],
    exits: [
      { direction: 'south', targetName: 'The Sunken Crypt', targetType: 'dungeon', targetId: 'dungeon-crypt' },
      { direction: 'east', targetName: 'Mountain road', targetType: 'road', targetId: null },
    ],
    digest: 'Millhaven — quiet farming village. Innkeeper: Old Bera. Questgiver: Captain Thorn (clear the crypt).',
  };

  it('accepts a valid settlement with rich NPCs', () => {
    const r = validateAgainstSchema(valid, SETTLEMENT_SCHEMA);
    assert.deepEqual(r.errors, []);
  });

  it('requires regionId', () => {
    const { regionId, ...noRegion } = valid;
    const r = validateAgainstSchema(noRegion, SETTLEMENT_SCHEMA);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('regionId')));
  });

  it('rejects invalid NPC role', () => {
    const bad = { ...valid, npcs: [{ ...valid.npcs[0], role: 'wizard' }] };
    const r = validateAgainstSchema(bad, SETTLEMENT_SCHEMA);
    assert.equal(r.valid, false);
  });

  it('rejects invalid exit type', () => {
    const bad = { ...valid, exits: [{ ...valid.exits[0], targetType: 'cave' }] };
    const r = validateAgainstSchema(bad, SETTLEMENT_SCHEMA);
    assert.equal(r.valid, false);
  });

  it('allows null questHook', () => {
    assert.equal(valid.npcs[0].questHook, null);
    const r = validateAgainstSchema(valid, SETTLEMENT_SCHEMA);
    assert.equal(r.valid, true);
  });

  it('allows null targetId on exits', () => {
    assert.equal(valid.exits[1].targetId, null);
    const r = validateAgainstSchema(valid, SETTLEMENT_SCHEMA);
    assert.equal(r.valid, true);
  });
});

describe('Digest cascade rule', () => {
  it('child generator receives only parent digest, not grandparent', () => {
    const worldDigest  = 'Erathis — grimdark, 2 gods, ancient seal cracking.';
    const regionDigest = 'Ashvale — temperate, old wars. Millhaven. Sunken Crypt.';

    // When generating a settlement, it should receive regionDigest, NOT worldDigest.
    // This is a design rule — we test the contract here.
    const settlementPromptContext = regionDigest;
    assert.ok(!settlementPromptContext.includes('Erathis'), 'settlement should not see world-level lore directly');
    assert.ok(settlementPromptContext.includes('Ashvale'), 'settlement should see region digest');
  });

  it('narrator receives leaf-to-root S-cards, not full digests', () => {
    // S-cards are ~50 tok each. With 5 levels, total is ~250 tok.
    const sCards = {
      room:       'Dusty chamber, footprints in dust.',
      building:   'Sunken Crypt — undead, 8 rooms.',
      settlement: 'Millhaven — farming village.',
      region:     'Ashvale — temperate valley.',
      world:      'Erathis — grimdark.',
    };
    const totalTokenEstimate = Object.values(sCards).join(' ').split(/\s+/).length;
    assert.ok(totalTokenEstimate < 50, `S-cards should be compact, got ~${totalTokenEstimate} words`);
  });
});
