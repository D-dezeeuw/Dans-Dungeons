// Bestiary I — 50 invented creatures, CR 0–5, across the common ecology
// niches: humanoid warbands, beasts, undead, fey, elementals, oozes,
// constructs, plants/fungi, and low dragons. The first batch that
// meaningfully populates a homebrew sandbox.
//
// Same rules as every content pack (docs/legal.md; swept by
// tests/legal.test.js): every name invented, no Product Identity, and the
// pack MOUNTS via `createEngine({ extraMonsters: BESTIARY_I })` — the SRD
// registry stays SRD-only. Every block carries the 1.10 surface where the
// tier supports it: all have `senses`, a third declare `multiattack`,
// warband leaders and tier-top blocks declare trained `saves`, undead and
// constructs carry `conditionImmunities`. No legendary/lair/innate here —
// those are Bestiary II/III mechanics; CR 0–5 opponents don't get them.
//
// This batch also closes the dungeon-overlay debt: `fungal-zombie`,
// `stone-sentinel`, `myconid-sovereign`, `young-drake` and `lesser-demon`
// are the ids downstream creature pools referenced for months while the
// registry had nothing — they live here now, under those exact ids.

export const BESTIARY_I = Object.freeze({
  // ── Humanoid warbands (10) ────────────────────────────────────────────
  'ditch-runner': {
    id: 'ditch-runner', name: 'Ditch Runner',
    cr: 0.125, ac: 12, hp: 7,
    size: 'small', speed: 35,
    abilityScores: { str: 8, dex: 15, con: 10, int: 10, wis: 9, cha: 11 },
    attacks: [{ name: 'Sling', attackBonus: 4, damage: '1d4+2', damageType: 'bludgeoning' }],
    senses: { darkvision: 30 },
    skills: { stealth: 4 },
    traits: ['Knows Every Culvert']
  },
  'toll-blade': {
    id: 'toll-blade', name: 'Toll Blade',
    cr: 0.25, ac: 14, hp: 13,
    size: 'medium', speed: 30,
    abilityScores: { str: 13, dex: 12, con: 12, int: 9, wis: 10, cha: 8 },
    attacks: [{ name: 'Shortsword', attackBonus: 3, damage: '1d6+1', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    traits: ['Demands the Toll First']
  },
  'fen-poacher': {
    id: 'fen-poacher', name: 'Fen Poacher',
    cr: 0.25, ac: 13, hp: 11,
    size: 'medium', speed: 30,
    abilityScores: { str: 11, dex: 14, con: 11, int: 10, wis: 13, cha: 9 },
    attacks: [{ name: 'Shortbow', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    skills: { stealth: 4, survival: 3 },
    traits: ['Snare-Layer']
  },
  'ash-zealot': {
    id: 'ash-zealot', name: 'Ash Zealot',
    cr: 0.5, ac: 12, hp: 16,
    size: 'medium', speed: 30,
    abilityScores: { str: 12, dex: 10, con: 13, int: 9, wis: 14, cha: 12 },
    attacks: [{ name: 'Censer Flail', attackBonus: 3, damage: '1d8+1', damageType: 'bludgeoning' }],
    senses: { darkvision: 30 },
    traits: ['Fights Harder Below Half HP']
  },
  'dune-lancer': {
    id: 'dune-lancer', name: 'Dune Lancer',
    cr: 0.5, ac: 14, hp: 19,
    size: 'medium', speed: 30,
    abilityScores: { str: 14, dex: 13, con: 12, int: 10, wis: 11, cha: 10 },
    attacks: [{ name: 'Lance', attackBonus: 4, damage: '1d12+2', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    traits: ['Mounted Charge']
  },
  'warband-drummer': {
    id: 'warband-drummer', name: 'Warband Drummer',
    cr: 1, ac: 13, hp: 27,
    size: 'medium', speed: 30,
    abilityScores: { str: 12, dex: 12, con: 14, int: 10, wis: 12, cha: 15 },
    attacks: [{ name: 'Drum-Maul', attackBonus: 3, damage: '1d10+1', damageType: 'bludgeoning' }],
    senses: { darkvision: 30 },
    traits: ['The Beat Rallies (allies within 30 ft resist being frightened)']
  },
  'grave-sapper': {
    id: 'grave-sapper', name: 'Grave Sapper',
    cr: 1, ac: 14, hp: 30,
    size: 'medium', speed: 25,
    abilityScores: { str: 15, dex: 10, con: 15, int: 12, wis: 10, cha: 8 },
    attacks: [
      { name: 'Pick', attackBonus: 4, damage: '1d8+2', damageType: 'piercing' },
      { name: 'Blasting Pot', attackBonus: 4, damage: '2d6', damageType: 'fire' }
    ],
    multiattack: { attacks: [{ name: 'Pick', attackRef: 0 }, { name: 'Pick', attackRef: 0 }] },
    senses: { darkvision: 60 },
    traits: ['Digs Under Walls']
  },
  'oath-sworn-reaver': {
    id: 'oath-sworn-reaver', name: 'Oath-Sworn Reaver',
    cr: 2, ac: 15, hp: 44,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 12, con: 14, int: 9, wis: 10, cha: 11 },
    attacks: [{ name: 'Greataxe', attackBonus: 5, damage: '1d12+3', damageType: 'slashing' }],
    multiattack: { attacks: [{ name: 'Greataxe', attackRef: 0 }, { name: 'Greataxe', attackRef: 0 }] },
    senses: { darkvision: 30 },
    saves: { str: 5 },
    traits: ['Never Retreats While the Banner Stands']
  },
  'silver-tongue-captain': {
    id: 'silver-tongue-captain', name: 'Silver-Tongue Captain',
    cr: 3, ac: 16, hp: 58,
    size: 'medium', speed: 30,
    abilityScores: { str: 14, dex: 14, con: 14, int: 13, wis: 12, cha: 16 },
    attacks: [{ name: 'Rapier', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' }],
    multiattack: { attacks: [{ name: 'Rapier', attackRef: 0 }, { name: 'Rapier', attackRef: 0 }] },
    senses: { darkvision: 30 },
    saves: { cha: 5, wis: 3 },
    traits: ['Parley First', 'Directs Allied Strikes']
  },
  'iron-tithe-champion': {
    id: 'iron-tithe-champion', name: 'Iron-Tithe Champion',
    cr: 5, ac: 18, hp: 93,
    size: 'medium', speed: 30,
    abilityScores: { str: 18, dex: 11, con: 16, int: 10, wis: 12, cha: 13 },
    attacks: [{ name: 'Tithe-Hammer', attackBonus: 7, damage: '2d6+4', damageType: 'bludgeoning' }],
    multiattack: { attacks: [{ name: 'Tithe-Hammer', attackRef: 0 }, { name: 'Tithe-Hammer', attackRef: 0 }] },
    senses: { darkvision: 30 },
    saves: { str: 7, con: 6 },
    traits: ['Collects What Is Owed', 'Shield Wall Anchor']
  },

  // ── Beasts (8) ────────────────────────────────────────────────────────
  'moor-hare': {
    id: 'moor-hare', name: 'Moor Hare',
    cr: 0, ac: 13, hp: 2,
    size: 'tiny', speed: 50,
    abilityScores: { str: 2, dex: 16, con: 9, int: 2, wis: 12, cha: 5 },
    attacks: [{ name: 'Kick', attackBonus: 1, damage: '1d1', damageType: 'bludgeoning' }],
    senses: { darkvision: 30 },
    traits: ['Bolts at First Sound']
  },
  'carrion-gull': {
    id: 'carrion-gull', name: 'Carrion Gull',
    cr: 0, ac: 12, hp: 3,
    size: 'tiny', speed: 10,
    flySpeed: 50,
    abilityScores: { str: 4, dex: 15, con: 10, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: 'Beak', attackBonus: 4, damage: '1d4+2', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    traits: ['Follows Battles']
  },
  'bristle-boar': {
    id: 'bristle-boar', name: 'Bristle Boar',
    cr: 0.5, ac: 12, hp: 22,
    size: 'medium', speed: 40,
    abilityScores: { str: 15, dex: 11, con: 14, int: 2, wis: 9, cha: 5 },
    attacks: [{ name: 'Tusk', attackBonus: 4, damage: '1d8+2', damageType: 'slashing' }],
    senses: { darkvision: 30 },
    traits: ['Charge', 'Relentless Below Half HP']
  },
  'mire-strider': {
    id: 'mire-strider', name: 'Mire Strider',
    cr: 1, ac: 13, hp: 26,
    size: 'large', speed: 40,
    abilityScores: { str: 16, dex: 13, con: 13, int: 2, wis: 11, cha: 5 },
    attacks: [{ name: 'Stamp', attackBonus: 5, damage: '2d6+3', damageType: 'bludgeoning' }],
    senses: { darkvision: 30 },
    traits: ['Never Sinks in Bog']
  },
  'howl-lynx': {
    id: 'howl-lynx', name: 'Howl Lynx',
    cr: 1, ac: 14, hp: 32,
    size: 'medium', speed: 45,
    abilityScores: { str: 14, dex: 16, con: 13, int: 3, wis: 13, cha: 7 },
    attacks: [
      { name: 'Claw', attackBonus: 5, damage: '1d6+3', damageType: 'slashing' },
      { name: 'Bite', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' }
    ],
    multiattack: { attacks: [{ name: 'Claw', attackRef: 0 }, { name: 'Bite', attackRef: 1 }] },
    senses: { darkvision: 60 },
    skills: { stealth: 5 },
    traits: ['Its Cry Carries for Miles']
  },
  'razor-crane': {
    id: 'razor-crane', name: 'Razor Crane',
    cr: 2, ac: 14, hp: 39,
    size: 'large', speed: 20,
    flySpeed: 60,
    abilityScores: { str: 14, dex: 16, con: 13, int: 4, wis: 14, cha: 6 },
    attacks: [{ name: 'Scissor Beak', attackBonus: 5, damage: '2d8+3', damageType: 'slashing' }],
    senses: { darkvision: 30 },
    traits: ['Dive Strike']
  },
  'dusk-ox': {
    id: 'dusk-ox', name: 'Dusk Ox',
    cr: 3, ac: 14, hp: 68,
    size: 'large', speed: 40,
    abilityScores: { str: 19, dex: 10, con: 17, int: 2, wis: 11, cha: 5 },
    attacks: [{ name: 'Horn Sweep', attackBonus: 6, damage: '2d10+4', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    saves: { str: 6 },
    traits: ['Trample', 'Herd Fury']
  },
  'pit-wyrmling': {
    id: 'pit-wyrmling', name: 'Pit Wyrmling',
    cr: 4, ac: 16, hp: 66,
    size: 'medium', speed: 30,
    abilityScores: { str: 17, dex: 12, con: 16, int: 8, wis: 11, cha: 12 },
    attacks: [
      { name: 'Bite', attackBonus: 6, damage: '1d10+3', damageType: 'piercing' },
      { name: 'Cinder Spit', attackBonus: 6, damage: '3d6', damageType: 'fire' }
    ],
    multiattack: { attacks: [{ name: 'Bite', attackRef: 0 }, { name: 'Cinder Spit', attackRef: 1 }] },
    senses: { darkvision: 60 },
    saves: { con: 5 },
    damageResistances: ['fire'],
    traits: ['Burrows in Ash']
  },

  // ── Undead (8) ────────────────────────────────────────────────────────
  'rattle-shambler': {
    id: 'rattle-shambler', name: 'Rattle Shambler',
    cr: 0.25, ac: 11, hp: 15,
    size: 'medium', speed: 20,
    abilityScores: { str: 13, dex: 8, con: 14, int: 3, wis: 6, cha: 5 },
    attacks: [{ name: 'Bone Club', attackBonus: 3, damage: '1d6+1', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    conditionImmunities: ['charmed', 'exhaustion', 'poisoned'],
    traits: ['Undead Nature', 'You Hear It Coming']
  },
  'lantern-ghast': {
    id: 'lantern-ghast', name: 'Lantern Ghast',
    cr: 0.5, ac: 13, hp: 22,
    size: 'medium', speed: 30,
    abilityScores: { str: 13, dex: 14, con: 12, int: 8, wis: 10, cha: 7 },
    attacks: [{ name: 'Grave-Cold Claw', attackBonus: 4, damage: '1d8+2', damageType: 'necrotic' }],
    senses: { darkvision: 60 },
    conditionImmunities: ['charmed', 'poisoned'],
    traits: ['Undead Nature', 'Carries a Light That Was Never Lit']
  },
  'fungal-zombie': {
    // One of the five dungeon-overlay ids that resolved to nothing until
    // this batch. Kept under its exact downstream id.
    id: 'fungal-zombie', name: 'Fungal Zombie',
    cr: 0.5, ac: 9, hp: 26,
    size: 'medium', speed: 20,
    abilityScores: { str: 14, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    attacks: [{ name: 'Sporing Slam', attackBonus: 4, damage: '1d8+2', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    conditionImmunities: ['charmed', 'exhaustion', 'poisoned'],
    traits: ['Undead Nature', 'Spore Burst on Death (poison, 5 ft)']
  },
  'sorrow-wisp': {
    id: 'sorrow-wisp', name: 'Sorrow Wisp',
    cr: 1, ac: 13, hp: 22,
    size: 'tiny', speed: 0,
    flySpeed: 40,
    abilityScores: { str: 1, dex: 16, con: 11, int: 6, wis: 12, cha: 14 },
    attacks: [{ name: 'Draining Touch', attackBonus: 5, damage: '2d6+3', damageType: 'necrotic' }],
    senses: { darkvision: 120 },
    damageImmunities: ['poison'],
    conditionImmunities: ['grappled', 'prone', 'poisoned'],
    traits: ['Undead Nature', 'Incorporeal Movement', 'Weeps in a Voice You Know']
  },
  'barrow-hound': {
    id: 'barrow-hound', name: 'Barrow Hound',
    cr: 2, ac: 14, hp: 42,
    size: 'medium', speed: 40,
    abilityScores: { str: 16, dex: 14, con: 15, int: 4, wis: 12, cha: 6 },
    attacks: [{ name: 'Grave Bite', attackBonus: 5, damage: '2d6+3', damageType: 'piercing' }],
    multiattack: { attacks: [{ name: 'Grave Bite', attackRef: 0 }, { name: 'Grave Bite', attackRef: 0 }] },
    senses: { darkvision: 60 },
    conditionImmunities: ['charmed', 'exhaustion', 'poisoned'],
    traits: ['Undead Nature', 'Howls at the Living']
  },
  'pale-usher': {
    id: 'pale-usher', name: 'Pale Usher',
    cr: 3, ac: 13, hp: 58,
    size: 'medium', speed: 30,
    abilityScores: { str: 12, dex: 14, con: 14, int: 13, wis: 15, cha: 16 },
    attacks: [{ name: 'Beckoning Hand', attackBonus: 5, damage: '3d6+2', damageType: 'necrotic' }],
    senses: { darkvision: 120 },
    saves: { wis: 4, cha: 5 },
    damageResistances: ['necrotic'],
    conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'Opens Doors That Should Stay Shut']
  },
  'gallows-choir': {
    id: 'gallows-choir', name: 'Gallows Choir',
    cr: 4, ac: 12, hp: 75,
    size: 'large', speed: 25,
    abilityScores: { str: 15, dex: 10, con: 17, int: 7, wis: 12, cha: 15 },
    attacks: [
      { name: 'Many Hands', attackBonus: 6, damage: '2d8+2', damageType: 'bludgeoning' },
      { name: 'Verdict Wail', attackBonus: 6, damage: '3d8', damageType: 'psychic' }
    ],
    multiattack: { attacks: [{ name: 'Many Hands', attackRef: 0 }, { name: 'Verdict Wail', attackRef: 1 }] },
    senses: { darkvision: 60 },
    saves: { con: 6 },
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'Thirteen Voices, One Sentence']
  },
  'tomb-regent': {
    id: 'tomb-regent', name: 'Tomb Regent',
    cr: 5, ac: 16, hp: 88,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 12, con: 16, int: 14, wis: 14, cha: 17 },
    attacks: [{ name: 'Sceptre of Dust', attackBonus: 7, damage: '2d8+4', damageType: 'necrotic' }],
    multiattack: { attacks: [{ name: 'Sceptre of Dust', attackRef: 0 }, { name: 'Sceptre of Dust', attackRef: 0 }] },
    senses: { darkvision: 120 },
    saves: { wis: 5, cha: 6 },
    damageResistances: ['necrotic', 'cold'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'Still Holding Court']
  },

  // ── Fey (6) ───────────────────────────────────────────────────────────
  'thistle-imp': {
    id: 'thistle-imp', name: 'Thistle Imp',
    cr: 0.25, ac: 13, hp: 10,
    size: 'tiny', speed: 30,
    abilityScores: { str: 6, dex: 16, con: 10, int: 11, wis: 12, cha: 13 },
    attacks: [{ name: 'Thorn Dart', attackBonus: 5, damage: '1d4+3', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    skills: { stealth: 5 },
    traits: ['Hides in Hedgerows', 'Petty Bargains']
  },
  'dew-dancer': {
    id: 'dew-dancer', name: 'Dew Dancer',
    cr: 0.5, ac: 14, hp: 18,
    size: 'small', speed: 40,
    abilityScores: { str: 8, dex: 18, con: 10, int: 12, wis: 13, cha: 16 },
    attacks: [{ name: 'Silver Switch', attackBonus: 6, damage: '1d6+4', damageType: 'slashing' }],
    senses: { darkvision: 60 },
    traits: ['Steps Between Raindrops']
  },
  'hollow-piper': {
    id: 'hollow-piper', name: 'Hollow Piper',
    cr: 1, ac: 13, hp: 27,
    size: 'small', speed: 30,
    abilityScores: { str: 9, dex: 15, con: 12, int: 13, wis: 12, cha: 17 },
    attacks: [{ name: 'Keening Note', attackBonus: 5, damage: '2d6+3', damageType: 'thunder' }],
    senses: { darkvision: 60 },
    saves: { cha: 5 },
    traits: ['Its Tune Lingers in the Ear']
  },
  'briar-shepherd': {
    id: 'briar-shepherd', name: 'Briar Shepherd',
    cr: 2, ac: 14, hp: 45,
    size: 'medium', speed: 30,
    abilityScores: { str: 14, dex: 13, con: 15, int: 12, wis: 16, cha: 13 },
    attacks: [{ name: 'Crook of Thorns', attackBonus: 5, damage: '2d8+3', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    traits: ['The Hedge Obeys', 'Herds Lost Travelers']
  },
  'mirror-courtier': {
    id: 'mirror-courtier', name: 'Mirror Courtier',
    cr: 3, ac: 15, hp: 55,
    size: 'medium', speed: 30,
    abilityScores: { str: 10, dex: 17, con: 13, int: 15, wis: 13, cha: 18 },
    attacks: [
      { name: 'Glass Rapier', attackBonus: 6, damage: '1d8+3', damageType: 'piercing' },
      { name: 'Cutting Reflection', attackBonus: 6, damage: '2d8', damageType: 'psychic' }
    ],
    multiattack: { attacks: [{ name: 'Glass Rapier', attackRef: 0 }, { name: 'Cutting Reflection', attackRef: 1 }] },
    senses: { darkvision: 60 },
    saves: { cha: 6 },
    traits: ['Wears Your Face Better Than You Do']
  },
  'winter-warden': {
    id: 'winter-warden', name: 'Winter Warden',
    cr: 5, ac: 16, hp: 90,
    size: 'large', speed: 30,
    abilityScores: { str: 18, dex: 12, con: 16, int: 12, wis: 16, cha: 15 },
    attacks: [{ name: 'Icebound Glaive', attackBonus: 7, damage: '2d10+4', damageType: 'cold' }],
    multiattack: { attacks: [{ name: 'Icebound Glaive', attackRef: 0 }, { name: 'Icebound Glaive', attackRef: 0 }] },
    senses: { darkvision: 60 },
    saves: { con: 6, wis: 6 },
    damageImmunities: ['cold'],
    traits: ['The First Frost Follows It']
  },

  // ── Elementals (5) ────────────────────────────────────────────────────
  'ember-mote': {
    id: 'ember-mote', name: 'Ember Mote',
    cr: 0.25, ac: 13, hp: 9,
    size: 'tiny', speed: 0,
    flySpeed: 40,
    abilityScores: { str: 3, dex: 16, con: 10, int: 4, wis: 10, cha: 6 },
    attacks: [{ name: 'Spark', attackBonus: 5, damage: '1d6+3', damageType: 'fire' }],
    senses: { darkvision: 60 },
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['poisoned'],
    traits: ['Kindles What It Touches']
  },
  'silt-churn': {
    id: 'silt-churn', name: 'Silt Churn',
    cr: 1, ac: 13, hp: 33,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 12, con: 15, int: 4, wis: 10, cha: 5 },
    attacks: [{ name: 'Mud Fist', attackBonus: 4, damage: '2d6+2', damageType: 'bludgeoning' }],
    senses: { darkvision: 60, tremorsense: 30 },
    damageImmunities: ['poison'],
    conditionImmunities: ['poisoned', 'prone'],
    traits: ['Flows Through Cracks']
  },
  'gale-shrike': {
    id: 'gale-shrike', name: 'Gale Shrike',
    cr: 2, ac: 15, hp: 40,
    size: 'medium', speed: 0,
    flySpeed: 70,
    abilityScores: { str: 12, dex: 19, con: 12, int: 6, wis: 12, cha: 7 },
    attacks: [{ name: 'Shear Wind', attackBonus: 6, damage: '2d8+4', damageType: 'slashing' }],
    multiattack: { attacks: [{ name: 'Shear Wind', attackRef: 0 }, { name: 'Shear Wind', attackRef: 0 }] },
    senses: { darkvision: 60 },
    damageImmunities: ['poison'],
    conditionImmunities: ['grappled', 'poisoned', 'prone'],
    traits: ['Cannot Enter Still Air']
  },
  'brine-column': {
    id: 'brine-column', name: 'Brine Column',
    cr: 3, ac: 14, hp: 66,
    size: 'large', speed: 30,
    abilityScores: { str: 17, dex: 14, con: 15, int: 5, wis: 10, cha: 8 },
    attacks: [{ name: 'Crashing Arm', attackBonus: 6, damage: '2d8+3', damageType: 'bludgeoning' }],
    multiattack: { attacks: [{ name: 'Crashing Arm', attackRef: 0 }, { name: 'Crashing Arm', attackRef: 0 }] },
    senses: { darkvision: 60 },
    saves: { con: 4 },
    damageImmunities: ['poison'],
    conditionImmunities: ['poisoned', 'prone'],
    traits: ['Tastes of Every Drowned Thing']
  },
  'quake-tortoise': {
    id: 'quake-tortoise', name: 'Quake Tortoise',
    cr: 5, ac: 18, hp: 105,
    size: 'huge', speed: 20,
    abilityScores: { str: 20, dex: 8, con: 18, int: 4, wis: 12, cha: 6 },
    attacks: [{ name: 'Mountain Jaw', attackBonus: 8, damage: '3d8+5', damageType: 'bludgeoning' }],
    senses: { darkvision: 60, tremorsense: 60 },
    saves: { str: 8, con: 7 },
    damageImmunities: ['poison'],
    conditionImmunities: ['poisoned'],
    traits: ['Each Step Is a Tremor']
  },

  // ── Oozes (4) ─────────────────────────────────────────────────────────
  'candle-slick': {
    id: 'candle-slick', name: 'Candle Slick',
    cr: 0.125, ac: 8, hp: 12,
    size: 'small', speed: 15,
    abilityScores: { str: 10, dex: 6, con: 13, int: 1, wis: 6, cha: 1 },
    attacks: [{ name: 'Scalding Touch', attackBonus: 2, damage: '1d6', damageType: 'fire' }],
    senses: { blindsight: 30 },
    conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
    traits: ['Ooze Nature', 'Pools Under Doors']
  },
  'verdigris-creep': {
    id: 'verdigris-creep', name: 'Verdigris Creep',
    cr: 0.5, ac: 9, hp: 27,
    size: 'medium', speed: 20,
    abilityScores: { str: 13, dex: 8, con: 15, int: 1, wis: 6, cha: 1 },
    attacks: [{ name: 'Corroding Pseudopod', attackBonus: 3, damage: '1d8+1', damageType: 'acid' }],
    senses: { blindsight: 60 },
    damageImmunities: ['acid'],
    conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
    traits: ['Ooze Nature', 'Eats Metal First']
  },
  'gloom-gelatin': {
    id: 'gloom-gelatin', name: 'Gloom Gelatin',
    cr: 2, ac: 7, hp: 58,
    size: 'large', speed: 15,
    abilityScores: { str: 15, dex: 4, con: 18, int: 1, wis: 6, cha: 1 },
    attacks: [{ name: 'Engulfing Mass', attackBonus: 4, damage: '2d8+2', damageType: 'acid' }],
    senses: { blindsight: 60 },
    damageImmunities: ['acid', 'cold'],
    conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
    traits: ['Ooze Nature', 'Swallows Light Whole']
  },
  'howling-amalgam': {
    id: 'howling-amalgam', name: 'Howling Amalgam',
    cr: 4, ac: 9, hp: 85,
    size: 'large', speed: 25,
    abilityScores: { str: 17, dex: 8, con: 19, int: 2, wis: 7, cha: 3 },
    attacks: [
      { name: 'Grasping Mass', attackBonus: 6, damage: '2d10+3', damageType: 'bludgeoning' },
      { name: 'Dissolving Grip', attackBonus: 6, damage: '2d6', damageType: 'acid' }
    ],
    multiattack: { attacks: [{ name: 'Grasping Mass', attackRef: 0 }, { name: 'Dissolving Grip', attackRef: 1 }] },
    senses: { blindsight: 60 },
    saves: { con: 6 },
    damageImmunities: ['acid'],
    conditionImmunities: ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'],
    traits: ['Ooze Nature', 'Voices of Everything It Ate']
  },

  // ── Constructs (4) ────────────────────────────────────────────────────
  'ledger-golem': {
    id: 'ledger-golem', name: 'Ledger Golem',
    cr: 1, ac: 15, hp: 31,
    size: 'medium', speed: 25,
    abilityScores: { str: 15, dex: 9, con: 14, int: 6, wis: 10, cha: 1 },
    attacks: [{ name: 'Filing Spike', attackBonus: 4, damage: '1d10+2', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    damageImmunities: ['poison', 'psychic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Construct Nature', 'Audits Intruders']
  },
  'stone-sentinel': {
    // Dungeon-overlay debt id — see the file header.
    id: 'stone-sentinel', name: 'Stone Sentinel',
    cr: 2, ac: 17, hp: 52,
    size: 'large', speed: 20,
    abilityScores: { str: 18, dex: 8, con: 17, int: 3, wis: 11, cha: 1 },
    attacks: [{ name: 'Granite Fist', attackBonus: 6, damage: '2d8+4', damageType: 'bludgeoning' }],
    multiattack: { attacks: [{ name: 'Granite Fist', attackRef: 0 }, { name: 'Granite Fist', attackRef: 0 }] },
    senses: { darkvision: 120 },
    saves: { con: 5 },
    damageImmunities: ['poison', 'psychic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    traits: ['Construct Nature', 'False Appearance (a statue until it is not)']
  },
  'clockwork-hart': {
    id: 'clockwork-hart', name: 'Clockwork Hart',
    cr: 3, ac: 16, hp: 60,
    size: 'large', speed: 50,
    abilityScores: { str: 16, dex: 15, con: 15, int: 4, wis: 12, cha: 6 },
    attacks: [{ name: 'Brass Antlers', attackBonus: 6, damage: '2d10+3', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    damageImmunities: ['poison', 'psychic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Construct Nature', 'Runs Its Route on the Hour']
  },
  'reliquary-warden': {
    id: 'reliquary-warden', name: 'Reliquary Warden',
    cr: 5, ac: 18, hp: 95,
    size: 'large', speed: 25,
    abilityScores: { str: 19, dex: 10, con: 18, int: 6, wis: 14, cha: 1 },
    attacks: [{ name: 'Warding Halberd', attackBonus: 7, damage: '2d10+4', damageType: 'slashing' }],
    multiattack: { attacks: [{ name: 'Warding Halberd', attackRef: 0 }, { name: 'Warding Halberd', attackRef: 0 }] },
    senses: { darkvision: 120 },
    saves: { str: 7, con: 7 },
    damageImmunities: ['poison', 'psychic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    traits: ['Construct Nature', 'Guards One Door Forever']
  },

  // ── Plants & fungi (3) ────────────────────────────────────────────────
  'creeping-arbor': {
    id: 'creeping-arbor', name: 'Creeping Arbor',
    cr: 0.5, ac: 12, hp: 25,
    size: 'medium', speed: 10,
    abilityScores: { str: 15, dex: 6, con: 14, int: 1, wis: 8, cha: 3 },
    attacks: [{ name: 'Root Lash', attackBonus: 4, damage: '1d10+2', damageType: 'bludgeoning' }],
    senses: { blindsight: 30 },
    conditionImmunities: ['blinded', 'deafened'],
    traits: ['Plant Nature', 'Looks Like Any Other Tree']
  },
  'spore-lord-cap': {
    id: 'spore-lord-cap', name: 'Spore-Lord Cap',
    cr: 1, ac: 11, hp: 33,
    size: 'medium', speed: 15,
    abilityScores: { str: 12, dex: 8, con: 16, int: 8, wis: 13, cha: 8 },
    attacks: [{ name: 'Choking Cloud', attackBonus: 3, damage: '2d6+1', damageType: 'poison' }],
    senses: { blindsight: 60 },
    damageResistances: ['poison'],
    traits: ['Plant Nature', 'The Colony Remembers']
  },
  'myconid-sovereign': {
    // Dungeon-overlay debt id — see the file header. 'Myconid' is an
    // SRD-listed creature family name; the block itself is invented.
    id: 'myconid-sovereign', name: 'Myconid Sovereign',
    cr: 2, ac: 13, hp: 48,
    size: 'large', speed: 20,
    abilityScores: { str: 14, dex: 10, con: 16, int: 13, wis: 15, cha: 10 },
    attacks: [
      { name: 'Fist', attackBonus: 4, damage: '2d6+2', damageType: 'bludgeoning' },
      { name: 'Pacifying Spores', attackBonus: 4, damage: '2d4', damageType: 'poison' }
    ],
    multiattack: { attacks: [{ name: 'Fist', attackRef: 0 }, { name: 'Pacifying Spores', attackRef: 1 }] },
    senses: { blindsight: 60 },
    saves: { wis: 4 },
    damageResistances: ['poison'],
    traits: ['Plant Nature', 'Speaks Through Rapport Spores']
  },

  // ── Fiends & low dragons (2) ──────────────────────────────────────────
  'lesser-demon': {
    // Dungeon-overlay debt id — see the file header. Generic descriptor,
    // invented block.
    id: 'lesser-demon', name: 'Lesser Demon',
    cr: 1, ac: 13, hp: 33,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 13, con: 14, int: 6, wis: 9, cha: 8 },
    attacks: [
      { name: 'Claw', attackBonus: 4, damage: '1d8+2', damageType: 'slashing' },
      { name: 'Bite', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' }
    ],
    multiattack: { attacks: [{ name: 'Claw', attackRef: 0 }, { name: 'Bite', attackRef: 1 }] },
    senses: { darkvision: 120 },
    damageResistances: ['fire'],
    conditionImmunities: ['poisoned'],
    traits: ['Fiendish Nature', 'Smells Fear']
  },
  'young-drake': {
    // Dungeon-overlay debt id — see the file header.
    id: 'young-drake', name: 'Young Drake',
    cr: 4, ac: 17, hp: 76,
    size: 'large', speed: 40,
    flySpeed: 60,
    abilityScores: { str: 18, dex: 12, con: 17, int: 10, wis: 12, cha: 13 },
    attacks: [
      { name: 'Bite', attackBonus: 6, damage: '2d10+4', damageType: 'piercing' },
      { name: 'Tail Slap', attackBonus: 6, damage: '2d6+4', damageType: 'bludgeoning' },
      { name: 'Scorching Breath', attackBonus: 6, damage: '4d6', damageType: 'fire' }
    ],
    multiattack: { attacks: [{ name: 'Bite', attackRef: 0 }, { name: 'Tail Slap', attackRef: 1 }] },
    senses: { darkvision: 120, blindsight: 10 },
    saves: { dex: 3, con: 5, wis: 3 },
    damageResistances: ['fire'],
    traits: ['Hoards Shiny Trifles', 'Breath Recharges on a Quiet Round']
  }
});

export default BESTIARY_I;
