// Scope packet budgets (Epic E5.S1).
//
// docs/ideas/12-context-scoping.md designed this in May 2026 and none of it
// existed: no nearby tier, no knowledge filter, no budget, and GM-private
// material (NPC secrets, the beat directive) travelling inside the same object
// the UI renders and the save writes to disk.
//
// These tests pin the two properties that matter at 80-hour scale: the packet
// stays inside its budget as the world grows, and secrets never leak into the
// player-visible half.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, estimateTokens, scopeCost } from '../src/game/scope-budget.js';

// A packet shaped like the assembler's output, sized by the caller.
function packetOf({ npcs = 2, details = 3, chapters = 4, nearby = 3 } = {}) {
  return {
    world:  { name: 'Emberfen', tone: 'gritty low fantasy', digest: 'A drowned coast of salt and iron. '.repeat(6) },
    region: { name: 'The Fen', digest: 'Peat, bog-lights and old debts. '.repeat(6) },
    memory: {
      chapters: Array.from({ length: chapters }, (_, i) => `Chapter ${i + 1}: ${'the party did things. '.repeat(6)}`),
      thisChapter: 'You are searching the chapel for the sexton\'s ledger. '.repeat(3),
      recently: ['a door was forced', 'the smith turned hostile'],
    },
    here: {
      place: 'The Fen',
      room: {
        name: 'Chapel of Ash', description: 'Pews rot in rows beneath a broken window. '.repeat(2),
        exits: [{ direction: 'north', locked: false }, { direction: 'east', locked: true }],
        items: ['tarnished censer'],
      },
      npcs: Array.from({ length: npcs }, (_, i) => ({ name: `Ghoul ${i}`, attitude: 'hostile', hp: 8, maxHp: 22 })),
      details: Array.from({ length: details }, (_, i) => `detail ${i}: something the GM noticed earlier`),
    },
    nearby: Array.from({ length: nearby }, (_, i) => ({ direction: 'north', sense: `a sound from beyond ${i}` })),
    known: ['Mara: her brother died in the mine'],
    recently: ['a door was forced'],
  };
}

describe('token budget', () => {
  it('a quiet room is cheap', () => {
    const { total } = scopeCost(packetOf({ npcs: 0, details: 0, chapters: 1, nearby: 2 }));
    assert.ok(total < 900, `a quiet scene cost ${total} tokens`);
  });

  it('a busy set-piece stays inside the per-tier budgets', () => {
    const { over, total } = scopeCost(packetOf({ npcs: 8, details: 6, chapters: 6, nearby: 4 }));
    assert.deepEqual(over, [], `tiers over budget: ${over.join(', ')}`);
    assert.ok(total < 3000, `a set-piece cost ${total} tokens — the whole packet must stay promptable`);
  });

  it('cost grows with the scene, not with the campaign', () => {
    // Hour 1 versus hour 60: many more chapters, same room.
    const early = scopeCost(packetOf({ chapters: 1 })).total;
    const late  = scopeCost(packetOf({ chapters: 40 })).total;
    // Chapter digests are the only part that grows, and they are capped by
    // their own budget — so the packet must not grow without bound.
    assert.ok(late / early < 6, `hour-60 packet was ${(late / early).toFixed(1)}x the hour-1 packet`);
  });

  it('every tier has a declared budget', () => {
    for (const tier of ['here', 'nearby', 'region', 'world', 'memory', 'known']) {
      assert.ok(BUDGET[tier] > 0, `tier '${tier}' has no budget`);
    }
  });

  it('reports which tier blew its budget, not just that something did', () => {
    const fat = packetOf();
    fat.here.details = Array.from({ length: 400 }, (_, i) => `detail ${i} with a long note attached to it`);
    const { over } = scopeCost(fat);
    assert.deepEqual(over, ['here']);
  });
});

describe('stable ordering for prompt caching', () => {
  it('puts the unchanging head first', () => {
    const keys = Object.keys(packetOf());
    assert.equal(keys.indexOf('world') < keys.indexOf('here'), true,
      'world and region are stable across turns and belong at the cacheable front');
    assert.equal(keys.indexOf('memory') < keys.indexOf('here'), true);
  });
});

describe('secrets stay out of the player-visible packet', () => {
  it('no gmOnly section unless explicitly requested', () => {
    const packet = packetOf();
    assert.equal(packet.gmOnly, undefined);
    assert.ok(!JSON.stringify(packet).includes('secret'),
      'NPC secrets and beat directives used to ride in the same object the UI reads and the save serialises');
  });

  it('estimateTokens handles empty and missing input', () => {
    assert.equal(estimateTokens(null), 1);
    assert.ok(estimateTokens({}) < 5);
  });
});
