// The Treasury — 40 invented magic items across all six rarity bands,
// demonstrating every 1.9 mechanic on purpose: charged items on every
// recharge schedule the engine knows (dawn, dusk, longRest, shortRest),
// all three attunement-prerequisite kinds (classId / spellcaster /
// abilityMin), cursed items whose only exit is the Remove Curse path,
// items with their own saving throws against forced destruction, and —
// new as DATA, not engine surface — sentient items carrying ego scores,
// a purpose and a conflict DC for the host to drive through `Checks`
// (the engine owns bookkeeping, never the argument with your sword).
//
// Same rules as every content pack (docs/legal.md; swept by
// tests/legal.test.js): every name invented, no Product Identity, and
// the pack MOUNTS via `createEngine({ extraItems: TREASURY })` — the SRD
// registry stays SRD-only.

export const TREASURY = Object.freeze({
  // ── Common (8) ────────────────────────────────────────────────────────
  'candle-of-the-honest-hour': {
    id: 'candle-of-the-honest-hour', name: 'Candle of the Honest Hour',
    type: 'consumable', rarity: 'common',
    // Burns for one hour; lies gutter it.
  },
  'ever-dry-cloak': {
    id: 'ever-dry-cloak', name: 'Ever-Dry Cloak',
    type: 'wondrous', rarity: 'common', weight: 1,
  },
  'sparrow-whistle': {
    id: 'sparrow-whistle', name: 'Sparrow Whistle',
    type: 'wondrous', rarity: 'common', weight: 0.1,
  },
  'inkwell-of-small-confessions': {
    id: 'inkwell-of-small-confessions', name: 'Inkwell of Small Confessions',
    type: 'wondrous', rarity: 'common', weight: 0.5,
  },
  'loaf-that-remembers': {
    id: 'loaf-that-remembers', name: 'Loaf That Remembers',
    type: 'consumable', rarity: 'common', heals: '1d4',
  },
  'boots-of-the-quiet-floorboard': {
    id: 'boots-of-the-quiet-floorboard', name: 'Boots of the Quiet Floorboard',
    type: 'wondrous', rarity: 'common', weight: 2,
  },
  'patchwork-map-of-yesterday': {
    id: 'patchwork-map-of-yesterday', name: 'Patchwork Map of Yesterday',
    type: 'gear', rarity: 'common', weight: 0.5,
  },
  'tin-soldier-sentry': {
    id: 'tin-soldier-sentry', name: 'Tin Soldier Sentry',
    type: 'wondrous', rarity: 'common', weight: 1,
    charges: { max: 1, recovers: 1, rechargesOn: 'dawn' },
  },

  // ── Uncommon (10) ─────────────────────────────────────────────────────
  'lodestar-compass': {
    id: 'lodestar-compass', name: 'Lodestar Compass',
    type: 'wondrous', rarity: 'uncommon', attunement: true, weight: 0.5,
  },
  'wand-of-gathered-sparks': {
    id: 'wand-of-gathered-sparks', name: 'Wand of Gathered Sparks',
    type: 'wondrous', rarity: 'uncommon', attunement: true,
    requiresAttunement: { spellcaster: true },
    charges: { max: 7, recovers: '1d6+1', rechargesOn: 'dawn' },
  },
  'shield-of-the-stubborn-door': {
    id: 'shield-of-the-stubborn-door', name: 'Shield of the Stubborn Door',
    type: 'armor', rarity: 'uncommon', acBonus: 1, weight: 6,
    savingThrow: { bonus: 3 },
  },
  'gloves-of-the-third-hand': {
    id: 'gloves-of-the-third-hand', name: 'Gloves of the Third Hand',
    type: 'wondrous', rarity: 'uncommon', attunement: true, weight: 0.5,
  },
  'drum-of-marching-rest': {
    id: 'drum-of-marching-rest', name: 'Drum of Marching Rest',
    type: 'wondrous', rarity: 'uncommon', weight: 3,
    charges: { max: 3, recovers: '1d3', rechargesOn: 'longRest' },
  },
  'ring-of-borrowed-breath': {
    id: 'ring-of-borrowed-breath', name: 'Ring of Borrowed Breath',
    type: 'ring', rarity: 'uncommon', attunement: true,
    charges: { max: 4, recovers: '1d4', rechargesOn: 'dusk' },
  },
  'quiver-of-the-patient-arrow': {
    id: 'quiver-of-the-patient-arrow', name: 'Quiver of the Patient Arrow',
    type: 'wondrous', rarity: 'uncommon', weight: 2,
  },
  'coin-of-two-tomorrows': {
    id: 'coin-of-two-tomorrows', name: 'Coin of Two Tomorrows',
    type: 'wondrous', rarity: 'uncommon', weight: 0.1,
    charges: { max: 1, recovers: 1, rechargesOn: 'shortRest' },
  },
  'grinning-key': {
    id: 'grinning-key', name: 'Grinning Key',
    type: 'wondrous', rarity: 'uncommon', cursed: true,
    // Opens any mundane lock — and locks one thing of its own choosing
    // behind you. It does not say which.
  },
  'salve-of-the-second-skin': {
    id: 'salve-of-the-second-skin', name: 'Salve of the Second Skin',
    type: 'consumable', rarity: 'uncommon', heals: '2d4+2',
  },

  // ── Rare (9) ──────────────────────────────────────────────────────────
  'blade-of-the-counted-debt': {
    id: 'blade-of-the-counted-debt', name: 'Blade of the Counted Debt',
    type: 'weapon', rarity: 'rare', attunement: true,
    damage: '1d8+1', damageType: 'slashing', properties: ['versatile'],
    savingThrow: { bonus: 5 },
  },
  'staff-of-the-orchard-warden': {
    id: 'staff-of-the-orchard-warden', name: 'Staff of the Orchard Warden',
    type: 'weapon', rarity: 'rare', attunement: true,
    requiresAttunement: { classId: 'druid' },
    damage: '1d6', damageType: 'bludgeoning',
    charges: { max: 10, recovers: '1d6+4', rechargesOn: 'dawn' },
  },
  'mantle-of-the-unstruck-bell': {
    id: 'mantle-of-the-unstruck-bell', name: 'Mantle of the Unstruck Bell',
    type: 'wondrous', rarity: 'rare', attunement: true,
    requiresAttunement: { abilityMin: { con: 13 } },
  },
  'gauntlets-of-the-drowned-fleet': {
    id: 'gauntlets-of-the-drowned-fleet', name: 'Gauntlets of the Drowned Fleet',
    type: 'wondrous', rarity: 'rare', attunement: true,
    requiresAttunement: { abilityMin: { str: 15 } },
  },
  'harp-of-the-open-gate': {
    id: 'harp-of-the-open-gate', name: 'Harp of the Open Gate',
    type: 'wondrous', rarity: 'rare', attunement: true,
    requiresAttunement: { classId: 'bard' },
    charges: { max: 5, recovers: '1d4+1', rechargesOn: 'dawn' },
  },
  'cloak-of-the-borrowed-face': {
    id: 'cloak-of-the-borrowed-face', name: 'Cloak of the Borrowed Face',
    type: 'wondrous', rarity: 'rare', attunement: true, cursed: true,
    // The face it lends is always someone's. Someone notices.
  },
  'arrow-of-the-name-spoken-once': {
    id: 'arrow-of-the-name-spoken-once', name: 'Arrow of the Name Spoken Once',
    type: 'consumable', rarity: 'rare', damage: '3d6', damageType: 'piercing',
  },
  'lantern-of-doors-unchosen': {
    id: 'lantern-of-doors-unchosen', name: 'Lantern of Doors Unchosen',
    type: 'wondrous', rarity: 'rare', attunement: true,
    requiresAttunement: { spellcaster: true },
    charges: { max: 3, recovers: '1d3', rechargesOn: 'dusk' },
  },
  'breastplate-of-the-final-stand': {
    id: 'breastplate-of-the-final-stand', name: 'Breastplate of the Final Stand',
    type: 'armor', rarity: 'rare', ac: 14, addsDex: true, maxDex: 2,
    armorCategory: 'medium', savingThrow: { bonus: 4 }, weight: 20,
  },

  // ── Very rare (6) ─────────────────────────────────────────────────────
  'crown-of-the-listening-court': {
    id: 'crown-of-the-listening-court', name: 'Crown of the Listening Court',
    type: 'wondrous', rarity: 'veryRare', attunement: true,
    requiresAttunement: { abilityMin: { cha: 15 } },
  },
  'blade-that-argues': {
    id: 'blade-that-argues', name: 'Blade That Argues',
    type: 'weapon', rarity: 'veryRare', attunement: true,
    damage: '2d6', damageType: 'slashing', properties: ['finesse'],
    savingThrow: { bonus: 6 },
    // The first sentient entry: ego as data, conflict as a host-run
    // Charisma contest against `sentient.conflictDc`.
    sentient: {
      intelligence: 14, wisdom: 12, charisma: 16,
      purpose: 'to be wielded only in causes it judges just',
      conflictDc: 14,
    },
  },
  'robe-of-the-riverbed-sky': {
    id: 'robe-of-the-riverbed-sky', name: 'Robe of the Riverbed Sky',
    type: 'wondrous', rarity: 'veryRare', attunement: true,
    requiresAttunement: { spellcaster: true },
    charges: { max: 8, recovers: '1d8', rechargesOn: 'dawn' },
  },
  'horn-of-the-hollow-hill': {
    id: 'horn-of-the-hollow-hill', name: 'Horn of the Hollow Hill',
    type: 'wondrous', rarity: 'veryRare',
    charges: { max: 2, recovers: '1d2', rechargesOn: 'dawn' },
    savingThrow: { bonus: 5 },
  },
  'girdle-of-the-oxback-road': {
    id: 'girdle-of-the-oxback-road', name: 'Girdle of the Oxback Road',
    type: 'wondrous', rarity: 'veryRare', attunement: true,
    requiresAttunement: { abilityMin: { str: 13 } },
  },
  'mask-of-the-mourning-moon': {
    id: 'mask-of-the-mourning-moon', name: 'Mask of the Mourning Moon',
    type: 'wondrous', rarity: 'veryRare', attunement: true, cursed: true,
    // It grieves whoever you loved best, before they are gone.
  },

  // ── Legendary (4) ─────────────────────────────────────────────────────
  'sword-of-the-sworn-dawn': {
    id: 'sword-of-the-sworn-dawn', name: 'Sword of the Sworn Dawn',
    type: 'weapon', rarity: 'legendary', attunement: true,
    requiresAttunement: { classId: 'paladin' },
    damage: '2d6+2', damageType: 'radiant',
    savingThrow: { bonus: 7 },
    sentient: {
      intelligence: 12, wisdom: 16, charisma: 18,
      purpose: 'to see one broken oath mended before it will rest',
      conflictDc: 16,
    },
  },
  'aegis-of-the-last-city': {
    id: 'aegis-of-the-last-city', name: 'Aegis of the Last City',
    type: 'armor', rarity: 'legendary', attunement: true,
    ac: 18, armorCategory: 'heavy', strRequirement: 15,
    stealthDisadvantage: true, savingThrow: { bonus: 8 }, weight: 55,
  },
  'orrery-of-the-turning-year': {
    id: 'orrery-of-the-turning-year', name: 'Orrery of the Turning Year',
    type: 'wondrous', rarity: 'legendary', attunement: true,
    requiresAttunement: { spellcaster: true },
    charges: { max: 12, recovers: '2d6', rechargesOn: 'dawn' },
    savingThrow: { bonus: 7 },
  },
  'ring-of-the-unspent-hour': {
    id: 'ring-of-the-unspent-hour', name: 'Ring of the Unspent Hour',
    type: 'ring', rarity: 'legendary', attunement: true,
    charges: { max: 1, recovers: 1, rechargesOn: 'dawn' },
  },

  // ── Artifact (3) ──────────────────────────────────────────────────────
  'anvil-of-first-making': {
    id: 'anvil-of-first-making', name: 'Anvil of First Making',
    type: 'wondrous', rarity: 'artifact', weight: 200,
    savingThrow: { bonus: 10 },
  },
  'the-unwritten-testament': {
    id: 'the-unwritten-testament', name: 'The Unwritten Testament',
    type: 'wondrous', rarity: 'artifact', attunement: true, cursed: true,
    savingThrow: { bonus: 9 },
    sentient: {
      intelligence: 18, wisdom: 14, charisma: 20,
      purpose: 'to be finished — it does not much care by whom',
      conflictDc: 18,
    },
  },
  'crown-of-the-drowned-king': {
    id: 'crown-of-the-drowned-king', name: 'Crown of the Drowned King',
    type: 'wondrous', rarity: 'artifact', attunement: true,
    requiresAttunement: { abilityMin: { wis: 15 } },
    charges: { max: 9, recovers: '1d8+1', rechargesOn: 'dusk' },
    savingThrow: { bonus: 9 },
  },
});
