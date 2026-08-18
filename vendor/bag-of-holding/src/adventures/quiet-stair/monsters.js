// The Quiet Stair — supporting bestiary (15 invented creatures, CR 0–4).
//
// Every name here is invented (docs/legal.md hygiene, same rule as the
// void-thrall plugin fixture): no Product Identity, no published-module
// creatures. Mechanically these are the first AUTHORED stat blocks in the
// package to carry the 1.10 deep fields — every entry has `senses`, five
// declare `multiattack`, four declare trained `saves` — so the consumers in
// src/monsters.js (multiattackSequence, saveBonus, senses) finally run
// against data a person wrote rather than template-derived variants.
//
// Deliberately absent: legendaryActions, lairActions, innateSpells. Those
// are boss-tier mechanics the SRD reserves for far higher CR; the roadmap
// assigns them to Bestiary II/III. A CR 4 abbot with legendary resistance
// would be inventing balance this tier never tested.
//
// Merged at engine construction — `createEngine({ extraMonsters:
// QUIET_STAIR_MONSTERS })` — never into the SRD registry, which stays
// SRD-only by contract.

export const QUIET_STAIR_MONSTERS = Object.freeze({
  'grave-tick': {
    id: 'grave-tick', name: 'Grave Tick',
    cr: 0, ac: 11, hp: 3,
    size: 'tiny', speed: 20,
    abilityScores: { str: 4, dex: 12, con: 10, int: 1, wis: 8, cha: 2 },
    attacks: [{ name: 'Proboscis', attackBonus: 3, damage: '1d4-1', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    traits: ['Swells When Fed']
  },
  'hush-rat': {
    id: 'hush-rat', name: 'Hush Rat',
    cr: 0.125, ac: 12, hp: 5,
    size: 'tiny', speed: 30,
    abilityScores: { str: 5, dex: 15, con: 10, int: 2, wis: 11, cha: 4 },
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '1d4+2', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    skills: { stealth: 6 },
    traits: ['Felted Fur (its movement makes no sound)']
  },
  'pallid-creeper': {
    id: 'pallid-creeper', name: 'Pallid Creeper',
    cr: 0.25, ac: 13, hp: 13,
    size: 'small', speed: 30,
    abilityScores: { str: 12, dex: 16, con: 12, int: 2, wis: 12, cha: 3 },
    attacks: [{ name: 'Barbed Limb', attackBonus: 5, damage: '1d6+3', damageType: 'slashing' }],
    senses: { blindsight: 30 },
    traits: ['Eyeless', 'Spider Climb']
  },
  'candle-wisp': {
    id: 'candle-wisp', name: 'Candle Wisp',
    cr: 0.25, ac: 13, hp: 10,
    size: 'tiny', speed: 0,
    flySpeed: 40,
    abilityScores: { str: 1, dex: 17, con: 10, int: 4, wis: 12, cha: 10 },
    attacks: [{ name: 'Cold Touch', attackBonus: 5, damage: '1d6', damageType: 'cold' }],
    senses: { darkvision: 120 },
    traits: ['Snuffs Small Flames Within 5 ft']
  },
  'mourner-husk': {
    id: 'mourner-husk', name: 'Mourner Husk',
    cr: 0.25, ac: 9, hp: 16,
    size: 'medium', speed: 20,
    abilityScores: { str: 13, dex: 8, con: 14, int: 4, wis: 6, cha: 5 },
    attacks: [{ name: 'Grasping Hand', attackBonus: 3, damage: '1d6+1', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    conditionImmunities: ['charmed', 'exhaustion'],
    traits: ['Undead Nature', 'Weeps Dust']
  },
  'stair-warden': {
    id: 'stair-warden', name: 'Stair Warden',
    cr: 0.5, ac: 15, hp: 22,
    size: 'small', speed: 20,
    abilityScores: { str: 15, dex: 8, con: 15, int: 3, wis: 10, cha: 1 },
    attacks: [{ name: 'Step-Stone Slam', attackBonus: 4, damage: '1d8+2', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    saves: { con: 4 },
    conditionImmunities: ['poisoned'],
    traits: ['Construct Nature', 'Immovable While on a Stair']
  },
  'bell-toller': {
    id: 'bell-toller', name: 'Bell Toller',
    cr: 0.5, ac: 12, hp: 19,
    size: 'medium', speed: 25,
    abilityScores: { str: 12, dex: 12, con: 13, int: 6, wis: 9, cha: 6 },
    attacks: [{ name: 'Cracked Handbell', attackBonus: 3, damage: '1d8+1', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    conditionImmunities: ['charmed'],
    traits: ['Undead Nature', 'Its Ring Carries Through Stone']
  },
  'silt-shade': {
    id: 'silt-shade', name: 'Silt Shade',
    cr: 0.5, ac: 13, hp: 16,
    size: 'medium', speed: 30,
    abilityScores: { str: 6, dex: 16, con: 12, int: 6, wis: 10, cha: 8 },
    attacks: [{ name: 'Smothering Drift', attackBonus: 5, damage: '2d4+3', damageType: 'necrotic' }],
    senses: { darkvision: 60 },
    skills: { stealth: 5 },
    traits: ['Undead Nature', 'Amorphous (moves through 1-inch gaps)']
  },
  'echo-leech': {
    id: 'echo-leech', name: 'Echo Leech',
    cr: 1, ac: 12, hp: 27,
    size: 'small', speed: 20,
    abilityScores: { str: 10, dex: 14, con: 15, int: 3, wis: 13, cha: 5 },
    attacks: [{ name: 'Resonant Touch', attackBonus: 4, damage: '2d6+2', damageType: 'thunder' }],
    // Blindsight only, on purpose: it perceives nothing but vibration —
    // total silence renders it blind, which is the tactical puzzle.
    senses: { blindsight: 60 },
    traits: ['Feeds on Sound (a struck target cannot speak until the end of its next turn)']
  },
  'cellar-lurker': {
    id: 'cellar-lurker', name: 'Cellar Lurker',
    cr: 1, ac: 14, hp: 30,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 14, con: 14, int: 7, wis: 11, cha: 6 },
    attacks: [{ name: 'Claw', attackBonus: 4, damage: '1d8+2', damageType: 'slashing' }],
    multiattack: { attacks: [
      { name: 'Claw', attackRef: 0 },
      { name: 'Claw', attackRef: 0 }
    ] },
    senses: { darkvision: 60 },
    traits: ['Stooped Gait', 'Hoards What It Finds']
  },
  'vault-spinner': {
    id: 'vault-spinner', name: 'Vault Spinner',
    cr: 1, ac: 14, hp: 26,
    size: 'large', speed: 30,
    abilityScores: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    attacks: [
      { name: 'Bite', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' },
      { name: 'Web Lash', attackBonus: 5, damage: '1d6+3', damageType: 'bludgeoning' }
    ],
    multiattack: { attacks: [
      { name: 'Bite', attackRef: 0 },
      { name: 'Web Lash', attackRef: 1 }
    ] },
    senses: { darkvision: 60 },
    traits: ['Webs Archways Shut', 'Spider Climb']
  },
  'drowned-porter': {
    id: 'drowned-porter', name: 'Drowned Porter',
    cr: 2, ac: 12, hp: 45,
    size: 'medium', speed: 20,
    abilityScores: { str: 17, dex: 8, con: 16, int: 5, wis: 7, cha: 5 },
    attacks: [{ name: 'Waterlogged Slam', attackBonus: 5, damage: '1d10+3', damageType: 'bludgeoning' }],
    multiattack: { attacks: [
      { name: 'Waterlogged Slam', attackRef: 0 },
      { name: 'Waterlogged Slam', attackRef: 0 }
    ] },
    senses: { darkvision: 60 },
    saves: { wis: 1 },
    conditionImmunities: ['exhaustion'],
    traits: ['Undead Nature', 'Still Carrying Its Load']
  },
  'chime-wraith': {
    id: 'chime-wraith', name: 'Chime Wraith',
    cr: 2, ac: 13, hp: 36,
    size: 'medium', speed: 0,
    flySpeed: 50,
    abilityScores: { str: 4, dex: 16, con: 12, int: 10, wis: 13, cha: 15 },
    attacks: [{ name: 'Tolling Grasp', attackBonus: 5, damage: '3d6+3', damageType: 'thunder' }],
    senses: { darkvision: 60 },
    damageImmunities: ['thunder', 'poison'],
    conditionImmunities: ['grappled', 'prone'],
    traits: ['Incorporeal Movement', 'Answers the Bell']
  },
  'hollow-knight': {
    id: 'hollow-knight', name: 'Hollow Knight',
    cr: 3, ac: 17, hp: 52,
    size: 'medium', speed: 25,
    abilityScores: { str: 16, dex: 10, con: 15, int: 8, wis: 12, cha: 10 },
    attacks: [{ name: 'Vigil Blade', attackBonus: 5, damage: '1d8+3', damageType: 'slashing' }],
    multiattack: { attacks: [
      { name: 'Vigil Blade', attackRef: 0 },
      { name: 'Vigil Blade', attackRef: 0 }
    ] },
    senses: { darkvision: 60 },
    saves: { str: 5, con: 4 },
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    traits: ['Construct Nature', 'Never Broke Its Oath']
  },
  'still-abbot': {
    id: 'still-abbot', name: 'The Still Abbot',
    cr: 4, ac: 15, hp: 75,
    size: 'medium', speed: 30,
    abilityScores: { str: 12, dex: 14, con: 16, int: 15, wis: 17, cha: 18 },
    attacks: [
      { name: 'Silencing Touch', attackBonus: 6, damage: '2d8+4', damageType: 'necrotic' },
      { name: 'Borrowed Toll', attackBonus: 6, damage: '2d10+4', damageType: 'thunder' }
    ],
    multiattack: { attacks: [
      { name: 'Silencing Touch', attackRef: 0 },
      { name: 'Silencing Touch', attackRef: 0 },
      { name: 'Borrowed Toll', attackRef: 1 }
    ] },
    senses: { darkvision: 120 },
    saves: { wis: 5, cha: 6 },
    conditionImmunities: ['charmed', 'frightened', 'deafened'],
    traits: ['Robed in Dust', 'Eats Sound', 'Wants a Voice of Its Own']
  }
});

export default QUIET_STAIR_MONSTERS;
