// The Quiet Stair — supporting items (8, keyed mundane-and-magical mix).
//
// This batch exercises the 1.9 magic-item lifecycle (src/magic-items.js)
// end to end, on purpose: one charged item (attune → spendCharge →
// rechargeItem at dawn), one cursed item — THE FIRST CURSED ITEM IN THE
// PACKAGE, the data that finally drives the unattune refusal branch —
// one consumable, both attunement-prerequisite kinds (spellcaster,
// abilityMin), a forced-destruction save target, and two mundane plot
// items so treasure isn't all sparkle.
//
// All names invented (docs/legal.md). Merged via
// `createEngine({ extraItems: QUIET_STAIR_ITEMS })`.

export const QUIET_STAIR_ITEMS = Object.freeze({
  'hush-lantern': {
    id: 'hush-lantern', name: 'Hush Lantern',
    type: 'wondrous', rarity: 'uncommon', attunement: true,
    // The charged one: dim grey light nothing can hear you inside of.
    charges: { max: 6, recovers: '1d4+2', rechargesOn: 'dawn' }
  },
  'oathkeepers-signet': {
    id: 'oathkeepers-signet', name: "Oathkeeper's Signet",
    type: 'ring', rarity: 'uncommon', attunement: true,
    // The cursed one: it will not let go of a sworn hand. First data to
    // reach the magic-items cursed branch (unattune refuses without
    // removeCurseApplied).
    cursed: true
  },
  'draught-of-the-clear-bell': {
    id: 'draught-of-the-clear-bell', name: 'Draught of the Clear Bell',
    type: 'consumable', rarity: 'common',
    // The consumable: rings faintly going down; cures nothing it can't hear.
    heals: '2d4+2'
  },
  'bell-shard-amulet': {
    id: 'bell-shard-amulet', name: 'Bell-Shard Amulet',
    type: 'wondrous', rarity: 'uncommon',
    attunement: true,
    requiresAttunement: { spellcaster: true }
  },
  'cloak-of-settled-dust': {
    id: 'cloak-of-settled-dust', name: 'Cloak of Settled Dust',
    type: 'wondrous', rarity: 'uncommon',
    attunement: true,
    requiresAttunement: { abilityMin: { dex: 13 } }
  },
  'blade-of-the-last-watch': {
    id: 'blade-of-the-last-watch', name: 'Blade of the Last Watch',
    type: 'weapon', rarity: 'rare', attunement: true,
    damage: '1d8+1', damageType: 'slashing', properties: ['versatile'],
    // Forced-destruction resilience (itemSavingThrow).
    savingThrow: { bonus: 5 }
  },
  'brass-stair-key': {
    id: 'brass-stair-key', name: 'Brass Stair Key',
    type: 'gear', weight: 0.5
    // The mundane keyed plot item — it opens exactly one door, and the
    // whole second beat is about who hands it over.
  },
  'sextons-ledger': {
    id: 'sextons-ledger', name: "Sexton's Ledger",
    type: 'gear', weight: 3
    // Mundane clue item; also the identifyItem demo target — knowing
    // what a book IS and knowing what it says are different reads.
  }
});

export default QUIET_STAIR_ITEMS;
