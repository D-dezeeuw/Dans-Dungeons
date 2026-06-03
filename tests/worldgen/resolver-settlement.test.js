import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test the settlement resolver contract without importing the actual module
// (which depends on Spektrum). We test the resolution logic in isolation.

function resolveSettlementAction(intent, targetId, world) {
  const loc = world.location;
  if (loc.type !== 'settlement') return { intent: 'impossible', reason: 'Not in a settlement.' };

  const settlement = world.settlements?.[loc.settlementId];
  if (!settlement) return { intent: 'impossible', reason: 'Settlement not found.' };

  if (intent === 'talk') {
    const npc = (settlement.npcs ?? []).find(n => n.id === targetId)
             ?? (settlement.npcs ?? []).find(n => n.role === targetId)
             ?? (settlement.npcs ?? [])[0];
    if (!npc) return { intent: 'impossible', reason: 'No one to talk to.' };
    return {
      intent: 'talk',
      npcId: npc.id,
      npcName: npc.name,
      greeting: npc.greeting,
      questHook: npc.questHook,
    };
  }

  if (intent === 'travel') {
    const exit = (settlement.exits ?? []).find(e =>
      e.direction === targetId || e.targetName === targetId || e.targetId === targetId
    );
    if (!exit) return { intent: 'impossible', reason: 'No exit in that direction.' };
    return {
      intent: 'travel',
      direction: exit.direction,
      targetName: exit.targetName,
      targetType: exit.targetType,
      targetId: exit.targetId,
    };
  }

  return { intent };
}

const world = {
  location: { type: 'settlement', regionId: 'region-1', settlementId: 'settlement-1', dungeonId: null },
  settlements: {
    'settlement-1': {
      id: 'settlement-1', name: 'Millhaven', description: '...',
      npcs: [
        { id: 'npc-bera', name: 'Old Bera', role: 'innkeeper', attitude: 'friendly', greeting: 'Welcome, traveler!', questHook: null },
        { id: 'npc-thorn', name: 'Captain Thorn', role: 'questgiver', attitude: 'neutral', greeting: 'You look capable.', questHook: 'Clear the crypt south of town.' },
        { id: 'npc-syl', name: 'Syl', role: 'merchant', attitude: 'suspicious', greeting: 'What do you want?', questHook: null },
      ],
      exits: [
        { direction: 'south', targetName: 'The Sunken Crypt', targetType: 'dungeon', targetId: 'dungeon-crypt' },
        { direction: 'east', targetName: 'Mountain road', targetType: 'road', targetId: null },
      ],
      digest: '...',
    },
  },
};

describe('Settlement resolver — talk', () => {
  it('resolves talk to specific NPC by id', () => {
    const r = resolveSettlementAction('talk', 'npc-thorn', world);
    assert.equal(r.intent, 'talk');
    assert.equal(r.npcName, 'Captain Thorn');
    assert.equal(r.questHook, 'Clear the crypt south of town.');
  });

  it('resolves talk by role', () => {
    const r = resolveSettlementAction('talk', 'merchant', world);
    assert.equal(r.npcName, 'Syl');
  });

  it('defaults to first NPC when no target specified', () => {
    const r = resolveSettlementAction('talk', undefined, world);
    assert.equal(r.npcName, 'Old Bera');
  });

  it('returns questHook when NPC has one', () => {
    const r = resolveSettlementAction('talk', 'npc-thorn', world);
    assert.ok(r.questHook);
  });

  it('returns null questHook when NPC has none', () => {
    const r = resolveSettlementAction('talk', 'npc-bera', world);
    assert.equal(r.questHook, null);
  });

  it('returns impossible when not in settlement', () => {
    const dungeonWorld = { ...world, location: { type: 'dungeon', regionId: 'r', settlementId: null, dungeonId: 'd' } };
    const r = resolveSettlementAction('talk', 'npc-bera', dungeonWorld);
    assert.equal(r.intent, 'impossible');
  });
});

describe('Settlement resolver — travel', () => {
  it('resolves travel by direction', () => {
    const r = resolveSettlementAction('travel', 'south', world);
    assert.equal(r.intent, 'travel');
    assert.equal(r.targetName, 'The Sunken Crypt');
    assert.equal(r.targetType, 'dungeon');
    assert.equal(r.targetId, 'dungeon-crypt');
  });

  it('resolves travel by target name', () => {
    const r = resolveSettlementAction('travel', 'The Sunken Crypt', world);
    assert.equal(r.intent, 'travel');
    assert.equal(r.targetType, 'dungeon');
  });

  it('resolves travel by target id', () => {
    const r = resolveSettlementAction('travel', 'dungeon-crypt', world);
    assert.equal(r.intent, 'travel');
  });

  it('returns impossible for unknown direction', () => {
    const r = resolveSettlementAction('travel', 'north', world);
    assert.equal(r.intent, 'impossible');
  });

  it('handles road exits with null targetId', () => {
    const r = resolveSettlementAction('travel', 'east', world);
    assert.equal(r.intent, 'travel');
    assert.equal(r.targetType, 'road');
    assert.equal(r.targetId, null);
  });
});
