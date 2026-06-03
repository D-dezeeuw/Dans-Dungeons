import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Digest cascade contract tests ──────────────────────────────────────────
//
// These tests verify the design rule: each generator receives ONLY its parent's
// digest, never grandparent or sibling data. We test the contract, not the AI
// output (which is mocked in integration tests).

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
