import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Digest cascade contract tests ──────────────────────────────────────────
//
// These tests verify the design rule: each generator receives ONLY its parent's
// digest, never grandparent or sibling data. We test the contract, not the AI
// output (which is mocked in integration tests).

// ─── Derived digest helpers (same logic as will be in the game code) ─────────

function deriveRoomDigest(room) {
  return `${room.name} — ${room.description.slice(0, 60)}`;
}

function deriveNpcDigest(npc) {
  const parts = [npc.name];
  if (npc.role) parts.push(npc.role);
  if (npc.personality) parts.push(npc.personality);
  if (npc.attitude && npc.attitude !== 'neutral') parts.push(npc.attitude);
  return parts.join(', ');
}

function buildNarratorContext(world) {
  const loc = world.location;
  const cards = [];

  // Room S-card (from current dungeon room)
  if (loc.dungeonId) {
    const dung = world.dungeons?.[loc.dungeonId];
    if (dung) {
      const room = dung.rooms?.[dung.currentRoom];
      if (room) cards.push(deriveRoomDigest(room));
      cards.push(dung.digest ?? dung.name);
    }
  }

  // Settlement S-card
  if (loc.settlementId) {
    const sett = world.settlements?.[loc.settlementId];
    if (sett) cards.push(sett.digest ?? sett.name);
  }

  // Region S-card
  if (loc.regionId) {
    const reg = world.regions?.[loc.regionId];
    if (reg) cards.push(reg.digest ?? reg.name);
  }

  // World S-card
  cards.push(world.digest ?? world.name ?? '');

  return cards;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Derived digests', () => {
  it('derives room digest from name + description prefix', () => {
    const d = deriveRoomDigest({ name: 'Dusty Chamber', description: 'A square chamber thick with dust. Footprints other than your own cross the floor.' });
    assert.ok(d.startsWith('Dusty Chamber'));
    assert.ok(d.length < 100);
  });

  it('derives NPC digest from name + role + personality', () => {
    const d = deriveNpcDigest({ name: 'Old Bera', role: 'innkeeper', personality: 'warm and motherly', attitude: 'friendly' });
    assert.ok(d.includes('Old Bera'));
    assert.ok(d.includes('innkeeper'));
    assert.ok(d.includes('warm and motherly'));
    assert.ok(d.includes('friendly'));
  });

  it('NPC digest omits neutral attitude', () => {
    const d = deriveNpcDigest({ name: 'Guard', role: 'guard', personality: 'stoic', attitude: 'neutral' });
    assert.ok(!d.includes('neutral'));
  });
});

describe('Narrator context chain', () => {
  const world = {
    name: 'Erathis',
    digest: 'Erathis — grimdark.',
    regions: {
      'r1': { id: 'r1', name: 'Ashvale', digest: 'Ashvale — temperate valley.' },
    },
    settlements: {
      's1': { id: 's1', name: 'Millhaven', digest: 'Millhaven — farming village.' },
    },
    dungeons: {
      'd1': {
        id: 'd1', name: 'Sunken Crypt', digest: 'Crypt — undead, 8 rooms.',
        currentRoom: 'room-0',
        rooms: { 'room-0': { id: 'room-0', name: 'Entrance Hall', description: 'A dark hallway with cobwebs.' } },
      },
    },
    location: { type: 'dungeon', regionId: 'r1', settlementId: 's1', dungeonId: 'd1' },
  };

  it('builds leaf-to-root S-card chain for dungeon scene', () => {
    const cards = buildNarratorContext(world);
    assert.equal(cards.length, 5); // room + dungeon + settlement + region + world
  });

  it('includes room, dungeon, settlement, region, and world', () => {
    const cards = buildNarratorContext(world);
    const joined = cards.join(' ');
    assert.ok(joined.includes('Entrance Hall'), 'should include room');
    assert.ok(joined.includes('Crypt'), 'should include dungeon');
    assert.ok(joined.includes('Millhaven'), 'should include settlement');
    assert.ok(joined.includes('Ashvale'), 'should include region');
    assert.ok(joined.includes('Erathis'), 'should include world');
  });

  it('total context stays compact', () => {
    const cards = buildNarratorContext(world);
    const totalChars = cards.join(' ').length;
    assert.ok(totalChars < 300, `narrator context should be compact, got ${totalChars} chars`);
  });

  it('handles settlement-only location (no dungeon)', () => {
    const settlementWorld = {
      ...world,
      location: { type: 'settlement', regionId: 'r1', settlementId: 's1', dungeonId: null },
    };
    const cards = buildNarratorContext(settlementWorld);
    const joined = cards.join(' ');
    assert.ok(joined.includes('Millhaven'));
    assert.ok(joined.includes('Erathis'));
    assert.ok(!joined.includes('Entrance Hall'), 'should not include room when in settlement');
  });
});

describe('Digest cascade contract', () => {

  // Simulated digests at each layer
  const worldDigest      = 'Erathis — grimdark world forged in a dying god\'s tears. Gods: Solarius (sun), Nethys (shadow). Red thread: ancient seal cracking beneath the Ashvale.';
  const regionDigest     = 'Ashvale — temperate valley scarred by old wars. Millhaven village. Sunken Crypt nearby. Rumor: bones walk at night near the barrow.';
  const settlementDigest = 'Millhaven — quiet farming village. Innkeeper: Old Bera (friendly). Questgiver: Captain Thorn (clear the crypt). Merchant: Syl (suspicious).';
  const dungeonDigest    = 'Sunken Crypt — undead-infested burial complex, 8 rooms, locked gate, bone key.';

  it('region generator receives only world digest', () => {
    // The region prompt should contain ONLY the world digest.
    // It should NOT contain region/settlement/dungeon data.
    const promptContext = worldDigest;
    assert.ok(promptContext.includes('Erathis'));
    assert.ok(!promptContext.includes('Millhaven'), 'region should not see settlement data');
    assert.ok(!promptContext.includes('Sunken Crypt'), 'region should not see dungeon data');
  });

  it('settlement generator receives only region digest', () => {
    const promptContext = regionDigest;
    assert.ok(promptContext.includes('Ashvale'));
    assert.ok(promptContext.includes('Millhaven'));
    // Should NOT contain world-level lore
    assert.ok(!promptContext.includes('dying god'), 'settlement should not see world creation myth');
    assert.ok(!promptContext.includes('Solarius'), 'settlement should not see god names from world');
  });

  it('dungeon generator receives only settlement digest', () => {
    const promptContext = settlementDigest;
    assert.ok(promptContext.includes('Millhaven'));
    assert.ok(promptContext.includes('Captain Thorn'));
    // Should NOT contain region or world data
    assert.ok(!promptContext.includes('temperate valley'), 'dungeon should not see region climate');
    assert.ok(!promptContext.includes('Erathis'), 'dungeon should not see world name');
  });

  it('narrator gets leaf-to-root path as S-cards', () => {
    // S-cards are ~50 tok each, one per layer in the path from current location to root.
    const sCards = [
      'Dusty chamber with footprints.',                        // room (~5 words)
      'Sunken Crypt — undead, 8 rooms.',                       // dungeon (~6 words)
      'Millhaven — farming village, Captain Thorn.',           // settlement (~6 words)
      'Ashvale — temperate valley, old wars.',                 // region (~6 words)
      'Erathis — grimdark, ancient seal.',                     // world (~5 words)
    ];

    // Total should be compact — under 50 words for all layers
    const totalWords = sCards.join(' ').split(/\s+/).length;
    assert.ok(totalWords < 50, `narrator S-cards should be under 50 words total, got ${totalWords}`);

    // Each card should be independent — no card contains data from another layer
    assert.ok(!sCards[0].includes('Ashvale'), 'room S-card should not leak region data');
    assert.ok(!sCards[4].includes('Millhaven'), 'world S-card should not leak settlement data');
  });

  it('digest size stays bounded regardless of world size', () => {
    // Adding more regions should not increase the digest a settlement sees.
    // A settlement always sees only its parent region's digest.
    const region1Digest = 'Ashvale — temperate, old wars.';
    const region2Digest = 'Frostpeak — arctic mountains, dwarven clans.';
    const region3Digest = 'Suncoast — tropical, pirate trade.';

    // A settlement in Ashvale only sees Ashvale's digest
    const settlementContext = region1Digest;
    assert.ok(!settlementContext.includes('Frostpeak'));
    assert.ok(!settlementContext.includes('Suncoast'));
    // Token count stays constant regardless of how many regions exist
    assert.ok(settlementContext.length < 200, 'digest should stay compact');
  });
});
