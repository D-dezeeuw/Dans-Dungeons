// Bestiary II — 30 boss-tier opponents, CR 6–15, with Legendary Actions,
// Lair Actions and Innate Spellcasting wired through the 1.10 monster
// mechanics. The first AUTHORED data those systems run against (until now
// only the tier templates synthesized it).
//
// Same pack rules as Bestiary I (docs/legal.md, swept by tests/legal.test.js):
// every name invented, mounted via `createEngine({ extraMonsters:
// BESTIARY_II })`, the SRD registry untouched. Innate spell lists reference
// REAL SRD spell ids so `castInnate` resolves against the shipped grimoire.
//
// Tier discipline, stated and tested: every block multiattacks; every block
// trains saves; CR 10+ carries Legendary Resistance; lair actions appear
// only on bosses with a HOME (a lair is a place, not a stat).

export const BESTIARY_II = Object.freeze({
  // ── CR 6 ──────────────────────────────────────────────────────────────
  'ashen-host-marshal': {
    id: 'ashen-host-marshal', name: 'Ashen Host Marshal',
    cr: 6, ac: 18, hp: 110,
    size: 'medium', speed: 30,
    abilityScores: { str: 18, dex: 13, con: 16, int: 12, wis: 13, cha: 15 },
    attacks: [
      { name: 'Cinder Blade', attackBonus: 8, damage: '2d8+4', damageType: 'slashing' },
      { name: 'Command Shout', attackBonus: 8, damage: '2d6', damageType: 'thunder' }
    ],
    multiattack: { attacks: [{ name: 'Cinder Blade', attackRef: 0 }, { name: 'Cinder Blade', attackRef: 0 }] },
    legendaryActions: {
      uses: 2,
      options: [
        { id: 'blade', name: 'Cinder Blade', cost: 1, attackRef: 'Cinder Blade' },
        { id: 'redeploy', name: 'Redeploy (an ally moves half speed)', cost: 1 },
        { id: 'rally-cry', name: 'Rally Cry (allies shed frightened)', cost: 2 }
      ]
    },
    senses: { darkvision: 60 },
    saves: { str: 7, con: 6, cha: 5 },
    damageResistances: ['fire'],
    traits: ['Never Wastes a Soldier']
  },
  'weald-strangler': {
    id: 'weald-strangler', name: 'Weald Strangler',
    cr: 6, ac: 15, hp: 126,
    size: 'huge', speed: 20,
    abilityScores: { str: 20, dex: 8, con: 18, int: 6, wis: 13, cha: 6 },
    attacks: [{ name: 'Constricting Bough', attackBonus: 8, damage: '2d10+5', damageType: 'bludgeoning' }],
    multiattack: { attacks: [{ name: 'Constricting Bough', attackRef: 0 }, { name: 'Constricting Bough', attackRef: 0 }] },
    senses: { blindsight: 60 },
    saves: { con: 7 },
    damageResistances: ['bludgeoning', 'piercing'],
    damageVulnerabilities: ['fire'],
    conditionImmunities: ['blinded', 'deafened'],
    traits: ['Plant Nature', 'The Canopy Closes Overhead']
  },
  'salt-priest-of-the-deep': {
    id: 'salt-priest-of-the-deep', name: 'Salt Priest of the Deep',
    cr: 6, ac: 14, hp: 99,
    size: 'medium', speed: 30,
    abilityScores: { str: 12, dex: 14, con: 15, int: 14, wis: 18, cha: 15 },
    attacks: [{ name: 'Brine Staff', attackBonus: 7, damage: '2d6+4', damageType: 'cold' }],
    multiattack: { attacks: [{ name: 'Brine Staff', attackRef: 0 }, { name: 'Brine Staff', attackRef: 0 }] },
    innateSpellcasting: {
      atWill: ['ray-of-frost', 'guidance'],
      '3day': ['hold-person', 'darkness'],
      '1day': ['fireball']
    },
    senses: { darkvision: 120 },
    saves: { wis: 7, con: 5 },
    damageResistances: ['cold'],
    traits: ['The Tide Answers Prayers']
  },
  'gravemarch-ogre': {
    id: 'gravemarch-ogre', name: 'Gravemarch Ogre',
    cr: 6, ac: 14, hp: 130,
    size: 'large', speed: 35,
    abilityScores: { str: 21, dex: 8, con: 18, int: 5, wis: 8, cha: 7 },
    attacks: [{ name: 'Headstone Club', attackBonus: 8, damage: '3d8+5', damageType: 'bludgeoning' }],
    multiattack: { attacks: [{ name: 'Headstone Club', attackRef: 0 }, { name: 'Headstone Club', attackRef: 0 }] },
    senses: { darkvision: 60 },
    saves: { str: 8, con: 7 },
    conditionImmunities: ['frightened'],
    traits: ['Carries Its Own Tombstone']
  },

  // ── CR 7 ──────────────────────────────────────────────────────────────
  'mirror-pool-hag': {
    id: 'mirror-pool-hag', name: 'Mirror-Pool Hag',
    cr: 7, ac: 16, hp: 112,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 14, con: 16, int: 16, wis: 15, cha: 18 },
    attacks: [{ name: 'Glass Talons', attackBonus: 7, damage: '2d8+4', damageType: 'slashing' }],
    multiattack: { attacks: [{ name: 'Glass Talons', attackRef: 0 }, { name: 'Glass Talons', attackRef: 0 }] },
    innateSpellcasting: {
      atWill: ['minor-illusion', 'prestidigitation'],
      '3day': ['invisibility', 'hold-person'],
      '1day': ['counterspell']
    },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'ripple', name: 'The Pool Ripples (reflections act first)' },
        { id: 'drown-light', name: 'Drown the Light (lair goes dim)' }
      ]
    },
    senses: { darkvision: 120 },
    saves: { wis: 5, cha: 7 },
    traits: ['Your Reflection Owes Her a Debt']
  },
  'chained-colossus-arm': {
    id: 'chained-colossus-arm', name: 'Chained Colossus Arm',
    cr: 7, ac: 17, hp: 136,
    size: 'huge', speed: 20,
    abilityScores: { str: 22, dex: 8, con: 19, int: 3, wis: 10, cha: 5 },
    attacks: [{ name: 'Fist of Masonry', attackBonus: 9, damage: '3d10+6', damageType: 'bludgeoning' }],
    multiattack: { attacks: [{ name: 'Fist of Masonry', attackRef: 0 }, { name: 'Fist of Masonry', attackRef: 0 }] },
    senses: { tremorsense: 60 },
    saves: { str: 9, con: 7 },
    damageImmunities: ['poison', 'psychic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Construct Nature', 'The Rest of It Is Still Buried']
  },
  'red-veil-assassin': {
    id: 'red-veil-assassin', name: 'Red-Veil Assassin',
    cr: 7, ac: 17, hp: 97,
    size: 'medium', speed: 35,
    abilityScores: { str: 12, dex: 20, con: 14, int: 14, wis: 13, cha: 11 },
    attacks: [
      { name: 'Veil Dagger', attackBonus: 8, damage: '2d4+5', damageType: 'piercing' },
      { name: 'Garrote Wire', attackBonus: 8, damage: '2d6+5', damageType: 'slashing' }
    ],
    multiattack: { attacks: [
      { name: 'Veil Dagger', attackRef: 0 }, { name: 'Veil Dagger', attackRef: 0 }, { name: 'Garrote Wire', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 2,
      options: [
        { id: 'fade', name: 'Fade (move without opportunity attacks)', cost: 1 },
        { id: 'dagger', name: 'Veil Dagger', cost: 1, attackRef: 'Veil Dagger' },
        { id: 'smoke', name: 'Smoke Veil (heavily obscured, 10 ft)', cost: 2 }
      ]
    },
    senses: { darkvision: 60 },
    saves: { dex: 8, int: 5 },
    skills: { stealth: 9 },
    traits: ['Kills on Contract, Never for Free']
  },
  'bloom-of-the-rot-court': {
    id: 'bloom-of-the-rot-court', name: 'Bloom of the Rot Court',
    cr: 7, ac: 15, hp: 120,
    size: 'large', speed: 25,
    abilityScores: { str: 17, dex: 12, con: 18, int: 11, wis: 15, cha: 16 },
    attacks: [
      { name: 'Petal Scythe', attackBonus: 7, damage: '2d10+4', damageType: 'slashing' },
      { name: 'Rot Breath', attackBonus: 7, damage: '4d6', damageType: 'poison' }
    ],
    multiattack: { attacks: [{ name: 'Petal Scythe', attackRef: 0 }, { name: 'Rot Breath', attackRef: 1 }] },
    senses: { blindsight: 60 },
    saves: { con: 7, cha: 6 },
    damageResistances: ['poison'],
    conditionImmunities: ['poisoned'],
    traits: ['Fey Nature', 'Everything It Touches Ripens Too Fast']
  },

  // ── CR 8 ──────────────────────────────────────────────────────────────
  'harrow-king-of-crows': {
    id: 'harrow-king-of-crows', name: 'Harrow King of Crows',
    cr: 8, ac: 16, hp: 127,
    size: 'medium', speed: 30,
    flySpeed: 60,
    abilityScores: { str: 14, dex: 18, con: 16, int: 15, wis: 16, cha: 18 },
    attacks: [
      { name: 'Beak Sceptre', attackBonus: 8, damage: '2d8+4', damageType: 'piercing' },
      { name: 'Murder of Wings', attackBonus: 8, damage: '3d6', damageType: 'slashing' }
    ],
    multiattack: { attacks: [{ name: 'Beak Sceptre', attackRef: 0 }, { name: 'Murder of Wings', attackRef: 1 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'peck', name: 'Beak Sceptre', cost: 1, attackRef: 'Beak Sceptre' },
        { id: 'scatter', name: 'Scatter Into Crows (teleport 30 ft)', cost: 1 },
        { id: 'omen', name: 'Ill Omen (a foe rerolls its next success)', cost: 2 }
      ]
    },
    senses: { darkvision: 120 },
    saves: { dex: 7, wis: 6, cha: 7 },
    traits: ['Fey Nature', 'Counts Every Death in the Valley']
  },
  'furnace-saint': {
    id: 'furnace-saint', name: 'Furnace Saint',
    cr: 8, ac: 17, hp: 136,
    size: 'large', speed: 30,
    abilityScores: { str: 19, dex: 10, con: 19, int: 10, wis: 16, cha: 14 },
    attacks: [
      { name: 'Molten Halo', attackBonus: 8, damage: '2d10+4', damageType: 'fire' },
      { name: 'Brand of Penance', attackBonus: 8, damage: '3d8', damageType: 'radiant' }
    ],
    multiattack: { attacks: [{ name: 'Molten Halo', attackRef: 0 }, { name: 'Brand of Penance', attackRef: 1 }] },
    senses: { darkvision: 60 },
    saves: { con: 7, wis: 6 },
    damageImmunities: ['fire'],
    conditionImmunities: ['frightened'],
    traits: ['Celestial Nature', 'Burns Sins It Alone Has Tallied']
  },
  'undertow-matron': {
    id: 'undertow-matron', name: 'Undertow Matron',
    cr: 8, ac: 15, hp: 142,
    size: 'huge', speed: 20,
    abilityScores: { str: 20, dex: 12, con: 18, int: 12, wis: 14, cha: 13 },
    attacks: [
      { name: 'Dragging Tendril', attackBonus: 8, damage: '2d8+5', damageType: 'bludgeoning' },
      { name: 'Crushing Embrace', attackBonus: 8, damage: '3d10+5', damageType: 'bludgeoning' }
    ],
    multiattack: { attacks: [
      { name: 'Dragging Tendril', attackRef: 0 }, { name: 'Dragging Tendril', attackRef: 0 }, { name: 'Crushing Embrace', attackRef: 1 }
    ] },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'surge', name: 'The Water Rises a Foot' },
        { id: 'pull', name: 'Undertow (everyone in the water slides 10 ft toward her)' }
      ]
    },
    senses: { darkvision: 120 },
    saves: { str: 8, con: 7 },
    damageResistances: ['cold'],
    traits: ['Mothers the Drowned']
  },
  'pale-knight-errant': {
    id: 'pale-knight-errant', name: 'Pale Knight Errant',
    cr: 8, ac: 18, hp: 120,
    size: 'medium', speed: 30,
    abilityScores: { str: 18, dex: 12, con: 17, int: 11, wis: 13, cha: 16 },
    attacks: [{ name: 'Mourning Blade', attackBonus: 8, damage: '2d10+4', damageType: 'necrotic' }],
    multiattack: { attacks: [{ name: 'Mourning Blade', attackRef: 0 }, { name: 'Mourning Blade', attackRef: 0 }] },
    senses: { darkvision: 60 },
    saves: { str: 7, cha: 6 },
    damageResistances: ['necrotic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'Still Keeping a Promise Nobody Remembers']
  },

  // ── CR 9 ──────────────────────────────────────────────────────────────
  'storm-caller-of-the-heights': {
    id: 'storm-caller-of-the-heights', name: 'Storm Caller of the Heights',
    cr: 9, ac: 16, hp: 138,
    size: 'medium', speed: 30,
    flySpeed: 40,
    abilityScores: { str: 13, dex: 16, con: 16, int: 14, wis: 18, cha: 16 },
    attacks: [
      { name: 'Skystaff Arc', attackBonus: 8, damage: '2d8+4', damageType: 'lightning' },
      { name: 'Thunderhead Burst', attackBonus: 8, damage: '4d8', damageType: 'thunder' }
    ],
    multiattack: { attacks: [{ name: 'Skystaff Arc', attackRef: 0 }, { name: 'Thunderhead Burst', attackRef: 1 }] },
    innateSpellcasting: {
      atWill: ['ray-of-frost'],
      '3day': ['misty-step', 'darkness'],
      '1day': ['fireball', 'counterspell']
    },
    senses: { darkvision: 60 },
    saves: { wis: 8, con: 7 },
    damageResistances: ['lightning', 'thunder'],
    traits: ['The Weather Arrives With Them']
  },
  'ossuary-tyrant': {
    id: 'ossuary-tyrant', name: 'Ossuary Tyrant',
    cr: 9, ac: 17, hp: 150,
    size: 'large', speed: 30,
    abilityScores: { str: 20, dex: 10, con: 19, int: 13, wis: 14, cha: 17 },
    attacks: [
      { name: 'Femur Greatmace', attackBonus: 9, damage: '3d8+5', damageType: 'bludgeoning' },
      { name: 'Marrow Lance', attackBonus: 9, damage: '2d10', damageType: 'necrotic' }
    ],
    multiattack: { attacks: [{ name: 'Femur Greatmace', attackRef: 0 }, { name: 'Marrow Lance', attackRef: 1 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'mace', name: 'Femur Greatmace', cost: 1, attackRef: 'Femur Greatmace' },
        { id: 'raise', name: 'Raise a Rattle Shambler From the Floor', cost: 2 },
        { id: 'knit', name: 'Knit Bone (regain 10 HP)', cost: 2 }
      ]
    },
    senses: { darkvision: 120 },
    saves: { con: 8, wis: 6, cha: 7 },
    damageResistances: ['necrotic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'The Catacomb Is Its Court']
  },
  'verdant-apex-stag': {
    id: 'verdant-apex-stag', name: 'Verdant Apex Stag',
    cr: 9, ac: 16, hp: 145,
    size: 'huge', speed: 50,
    abilityScores: { str: 21, dex: 14, con: 18, int: 9, wis: 17, cha: 15 },
    attacks: [
      { name: 'Crown of Antlers', attackBonus: 9, damage: '3d10+5', damageType: 'piercing' },
      { name: 'Trampling Charge', attackBonus: 9, damage: '2d12+5', damageType: 'bludgeoning' }
    ],
    multiattack: { attacks: [{ name: 'Crown of Antlers', attackRef: 0 }, { name: 'Trampling Charge', attackRef: 1 }] },
    senses: { darkvision: 60 },
    saves: { str: 9, wis: 7 },
    traits: ['Fey Nature', 'The Forest Turns With Its Seasons']
  },

  // ── CR 10 ─────────────────────────────────────────────────────────────
  'the-collector-of-names': {
    id: 'the-collector-of-names', name: 'The Collector of Names',
    cr: 10, ac: 17, hp: 143,
    size: 'medium', speed: 30,
    abilityScores: { str: 12, dex: 16, con: 16, int: 19, wis: 15, cha: 19 },
    attacks: [
      { name: 'Inkwell Rapier', attackBonus: 9, damage: '2d8+5', damageType: 'piercing' },
      { name: 'Erasure', attackBonus: 9, damage: '4d8', damageType: 'psychic' }
    ],
    multiattack: { attacks: [{ name: 'Inkwell Rapier', attackRef: 0 }, { name: 'Erasure', attackRef: 1 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'jot', name: 'Jot (learn one fact about a foe)', cost: 1 },
        { id: 'rapier', name: 'Inkwell Rapier', cost: 1, attackRef: 'Inkwell Rapier' },
        { id: 'redact', name: 'Redact (a foe forgets its bonus action)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 2 },
    innateSpellcasting: {
      atWill: ['mage-hand', 'minor-illusion'],
      '3day': ['invisibility', 'counterspell'],
      '1day': ['mass-suggestion']
    },
    senses: { darkvision: 60 },
    saves: { int: 8, cha: 8 },
    conditionImmunities: ['charmed'],
    traits: ['Knows Yours Already']
  },
  'leviathan-calf': {
    id: 'leviathan-calf', name: 'Leviathan Calf',
    cr: 10, ac: 16, hp: 174,
    size: 'huge', speed: 20,
    abilityScores: { str: 23, dex: 10, con: 20, int: 4, wis: 12, cha: 6 },
    attacks: [
      { name: 'Hull-Breaker Bite', attackBonus: 10, damage: '3d12+6', damageType: 'piercing' },
      { name: 'Tail Swell', attackBonus: 10, damage: '2d10+6', damageType: 'bludgeoning' }
    ],
    multiattack: { attacks: [{ name: 'Hull-Breaker Bite', attackRef: 0 }, { name: 'Tail Swell', attackRef: 1 }] },
    legendaryResistance: { uses: 2 },
    senses: { blindsight: 60, darkvision: 120 },
    saves: { str: 10, con: 9 },
    damageResistances: ['cold'],
    traits: ['Its Parent Is Still Out There']
  },
  'sepulchre-choirmaster': {
    id: 'sepulchre-choirmaster', name: 'Sepulchre Choirmaster',
    cr: 10, ac: 15, hp: 152,
    size: 'medium', speed: 30,
    abilityScores: { str: 14, dex: 14, con: 17, int: 15, wis: 16, cha: 20 },
    attacks: [
      { name: 'Conducting Rod', attackBonus: 9, damage: '2d8+5', damageType: 'necrotic' },
      { name: 'Dirge Crescendo', attackBonus: 9, damage: '4d10', damageType: 'thunder' }
    ],
    multiattack: { attacks: [{ name: 'Conducting Rod', attackRef: 0 }, { name: 'Dirge Crescendo', attackRef: 1 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'downbeat', name: 'Downbeat (the gallows choir attacks)', cost: 1 },
        { id: 'rod', name: 'Conducting Rod', cost: 1, attackRef: 'Conducting Rod' },
        { id: 'silence-bar', name: 'A Bar of Silence (one foe casts nothing)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 2 },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'swell', name: 'The Choir Swells (necrotic hum, whole lair)' },
        { id: 'toll', name: 'The Great Bell Tolls (thunder, 30 ft)' }
      ]
    },
    senses: { darkvision: 120 },
    saves: { wis: 7, cha: 9 },
    damageResistances: ['necrotic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'Every Voice It Buried Still Sings']
  },

  // ── CR 11 ─────────────────────────────────────────────────────────────
  'warden-of-the-sunken-gate': {
    id: 'warden-of-the-sunken-gate', name: 'Warden of the Sunken Gate',
    cr: 11, ac: 18, hp: 168,
    size: 'large', speed: 30,
    abilityScores: { str: 21, dex: 11, con: 20, int: 10, wis: 16, cha: 12 },
    attacks: [
      { name: 'Gatekeeper Maul', attackBonus: 10, damage: '3d10+5', damageType: 'bludgeoning' },
      { name: 'Riptide Chain', attackBonus: 10, damage: '2d8+5', damageType: 'slashing' }
    ],
    multiattack: { attacks: [
      { name: 'Gatekeeper Maul', attackRef: 0 }, { name: 'Gatekeeper Maul', attackRef: 0 }, { name: 'Riptide Chain', attackRef: 1 }
    ] },
    legendaryResistance: { uses: 2 },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'flood', name: 'The Gate Vents (difficult terrain, 20 ft)' },
        { id: 'seal', name: 'The Seals Flare (radiant pulse at the arch)' }
      ]
    },
    senses: { darkvision: 120, tremorsense: 30 },
    saves: { str: 9, con: 9, wis: 7 },
    damageImmunities: ['poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Construct Nature', 'What It Guards Must Not Wake']
  },
  'queen-of-the-hollow-hive': {
    id: 'queen-of-the-hollow-hive', name: 'Queen of the Hollow Hive',
    cr: 11, ac: 17, hp: 161,
    size: 'large', speed: 30,
    flySpeed: 50,
    abilityScores: { str: 18, dex: 17, con: 19, int: 13, wis: 15, cha: 16 },
    attacks: [
      { name: 'Regnal Sting', attackBonus: 9, damage: '2d10+4', damageType: 'piercing' },
      { name: 'Chitin Scythe', attackBonus: 9, damage: '2d8+4', damageType: 'slashing' }
    ],
    multiattack: { attacks: [
      { name: 'Chitin Scythe', attackRef: 1 }, { name: 'Chitin Scythe', attackRef: 1 }, { name: 'Regnal Sting', attackRef: 0 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'sting', name: 'Regnal Sting', cost: 1, attackRef: 'Regnal Sting' },
        { id: 'summon-drones', name: 'The Hive Answers (drones swarm a foe)', cost: 2 },
        { id: 'royal-jelly', name: 'Royal Jelly (regain 15 HP)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 2 },
    senses: { blindsight: 60, darkvision: 60 },
    saves: { con: 8, dex: 7 },
    damageResistances: ['poison'],
    traits: ['The Hive Is Her Body Too']
  },
  'famine-shepherd': {
    id: 'famine-shepherd', name: 'Famine Shepherd',
    cr: 11, ac: 16, hp: 178,
    size: 'huge', speed: 30,
    abilityScores: { str: 20, dex: 10, con: 21, int: 12, wis: 17, cha: 14 },
    attacks: [
      { name: 'Withering Crook', attackBonus: 10, damage: '3d8+5', damageType: 'necrotic' },
      { name: 'Hunger Pang', attackBonus: 10, damage: '4d6', damageType: 'psychic' }
    ],
    multiattack: { attacks: [{ name: 'Withering Crook', attackRef: 0 }, { name: 'Hunger Pang', attackRef: 1 }] },
    legendaryResistance: { uses: 2 },
    senses: { darkvision: 120 },
    saves: { con: 9, wis: 7 },
    damageResistances: ['necrotic'],
    conditionImmunities: ['exhaustion'],
    traits: ['Fiendish Nature', 'The Harvest Fails Where It Walks']
  },

  // ── CR 12 ─────────────────────────────────────────────────────────────
  'grand-automaton-reliquary': {
    id: 'grand-automaton-reliquary', name: 'Grand Automaton Reliquary',
    cr: 12, ac: 19, hp: 190,
    size: 'huge', speed: 25,
    abilityScores: { str: 23, dex: 8, con: 21, int: 8, wis: 15, cha: 3 },
    attacks: [
      { name: 'Reliquary Fist', attackBonus: 11, damage: '3d10+6', damageType: 'bludgeoning' },
      { name: 'Saint-Light Beam', attackBonus: 11, damage: '4d10', damageType: 'radiant' }
    ],
    multiattack: { attacks: [
      { name: 'Reliquary Fist', attackRef: 0 }, { name: 'Reliquary Fist', attackRef: 0 }, { name: 'Saint-Light Beam', attackRef: 1 }
    ] },
    legendaryResistance: { uses: 3 },
    senses: { darkvision: 120 },
    saves: { str: 10, con: 9 },
    damageImmunities: ['poison', 'psychic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    traits: ['Construct Nature', 'A Cathedral That Walks']
  },
  'duchess-of-the-last-frost': {
    id: 'duchess-of-the-last-frost', name: 'Duchess of the Last Frost',
    cr: 12, ac: 17, hp: 172,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 16, con: 18, int: 16, wis: 15, cha: 20 },
    attacks: [
      { name: 'Rime Sabre', attackBonus: 10, damage: '2d10+5', damageType: 'cold' },
      { name: 'Season-Ending Word', attackBonus: 10, damage: '5d8', damageType: 'cold' }
    ],
    multiattack: { attacks: [{ name: 'Rime Sabre', attackRef: 0 }, { name: 'Rime Sabre', attackRef: 0 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'sabre', name: 'Rime Sabre', cost: 1, attackRef: 'Rime Sabre' },
        { id: 'hoarfrost', name: 'Hoarfrost Step (teleport between shadows of ice)', cost: 1 },
        { id: 'deep-winter', name: 'Deep Winter (cold burst, 20 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['ray-of-frost', 'minor-illusion'],
      '3day': ['misty-step', 'hold-person'],
      '1day': ['cone-of-cold']
    },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'freeze-floor', name: 'The Floor Glazes (ice, whole court)' },
        { id: 'candles-die', name: 'Every Candle Dies' }
      ]
    },
    senses: { darkvision: 60 },
    saves: { con: 8, wis: 6, cha: 9 },
    damageImmunities: ['cold'],
    traits: ['Fey Nature', 'Her Court Is Always the Last Week of Winter']
  },
  'pyre-wyrm': {
    id: 'pyre-wyrm', name: 'Pyre Wyrm',
    cr: 12, ac: 18, hp: 184,
    size: 'huge', speed: 40,
    flySpeed: 80,
    abilityScores: { str: 22, dex: 12, con: 21, int: 12, wis: 13, cha: 17 },
    attacks: [
      { name: 'Bite', attackBonus: 11, damage: '2d10+6', damageType: 'piercing' },
      { name: 'Claw', attackBonus: 11, damage: '2d6+6', damageType: 'slashing' },
      { name: 'Pyre Breath', attackBonus: 11, damage: '10d6', damageType: 'fire' }
    ],
    multiattack: { attacks: [
      { name: 'Bite', attackRef: 0 }, { name: 'Claw', attackRef: 1 }, { name: 'Claw', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'tail', name: 'Tail Lash', cost: 1, attackRef: 'Claw' },
        { id: 'wing-gust', name: 'Wing Gust (foes pushed 10 ft, prone on a fail)', cost: 2 },
        { id: 'ember-rain', name: 'Ember Rain (fire, 15 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    senses: { blindsight: 30, darkvision: 120 },
    saves: { dex: 5, con: 9, wis: 5, cha: 7 },
    damageImmunities: ['fire'],
    traits: ['Sleeps in Its Own Ashes']
  },

  // ── CR 13 ─────────────────────────────────────────────────────────────
  'the-unnumbered-legion': {
    id: 'the-unnumbered-legion', name: 'The Unnumbered Legion',
    cr: 13, ac: 17, hp: 200,
    size: 'gargantuan', speed: 30,
    abilityScores: { str: 21, dex: 14, con: 20, int: 11, wis: 14, cha: 16 },
    attacks: [
      { name: 'A Hundred Spears', attackBonus: 10, damage: '4d8+5', damageType: 'piercing' },
      { name: 'The Wheeling Ranks', attackBonus: 10, damage: '3d10+5', damageType: 'slashing' }
    ],
    multiattack: { attacks: [
      { name: 'A Hundred Spears', attackRef: 0 }, { name: 'A Hundred Spears', attackRef: 0 }, { name: 'The Wheeling Ranks', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'volley', name: 'A Hundred Spears', cost: 1, attackRef: 'A Hundred Spears' },
        { id: 'reform', name: 'Reform Ranks (regain 15 HP)', cost: 2 },
        { id: 'encircle', name: 'Encircle (one foe is surrounded)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    senses: { darkvision: 60 },
    saves: { str: 10, con: 10, wis: 7 },
    damageResistances: ['bludgeoning', 'piercing', 'slashing'],
    conditionImmunities: ['charmed', 'frightened', 'grappled', 'prone'],
    traits: ['Undead Nature', 'A Swarm That Marches in Step']
  },
  'abyssal-cartographer': {
    id: 'abyssal-cartographer', name: 'Abyssal Cartographer',
    cr: 13, ac: 17, hp: 187,
    size: 'medium', speed: 30,
    flySpeed: 40,
    abilityScores: { str: 15, dex: 18, con: 18, int: 21, wis: 17, cha: 18 },
    attacks: [
      { name: 'Meridian Blade', attackBonus: 11, damage: '2d12+6', damageType: 'force' },
      { name: 'Unmapping Gaze', attackBonus: 11, damage: '5d8', damageType: 'psychic' }
    ],
    multiattack: { attacks: [{ name: 'Meridian Blade', attackRef: 0 }, { name: 'Unmapping Gaze', attackRef: 1 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'blade', name: 'Meridian Blade', cost: 1, attackRef: 'Meridian Blade' },
        { id: 'redraw', name: 'Redraw the Room (two foes swap places)', cost: 2 },
        { id: 'blank-spot', name: 'Blank Spot (it was never where you struck)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['mage-hand', 'minor-illusion'],
      '3day': ['misty-step', 'counterspell'],
      '1day': ['mass-suggestion']
    },
    senses: { darkvision: 120 },
    saves: { int: 10, wis: 8, cha: 9 },
    damageResistances: ['psychic'],
    conditionImmunities: ['charmed'],
    traits: ['Fiendish Nature', 'Maps Places That Refuse to Exist']
  },

  // ── CR 14 ─────────────────────────────────────────────────────────────
  'mother-of-the-silt-throne': {
    id: 'mother-of-the-silt-throne', name: 'Mother of the Silt Throne',
    cr: 14, ac: 18, hp: 218,
    size: 'huge', speed: 30,
    abilityScores: { str: 23, dex: 11, con: 22, int: 15, wis: 18, cha: 19 },
    attacks: [
      { name: 'Deluge Arm', attackBonus: 12, damage: '3d10+6', damageType: 'bludgeoning' },
      { name: 'Silt Tide', attackBonus: 12, damage: '5d10', damageType: 'necrotic' }
    ],
    multiattack: { attacks: [
      { name: 'Deluge Arm', attackRef: 0 }, { name: 'Deluge Arm', attackRef: 0 }, { name: 'Silt Tide', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'arm', name: 'Deluge Arm', cost: 1, attackRef: 'Deluge Arm' },
        { id: 'sink', name: 'The Floor Softens (a foe starts to sink)', cost: 2 },
        { id: 'tide-wall', name: 'Wall of Silt (half cover, 30 ft line)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'bury', name: 'The Throne Room Buries Its Dead' },
        { id: 'whisper', name: 'The Silt Whispers (psychic murmur, whole lair)' }
      ]
    },
    senses: { blindsight: 60, tremorsense: 120 },
    saves: { str: 11, con: 11, wis: 9 },
    damageResistances: ['bludgeoning'],
    conditionImmunities: ['prone'],
    traits: ['Everything Sinks to Her Eventually']
  },
  'the-hollow-magistrate': {
    id: 'the-hollow-magistrate', name: 'The Hollow Magistrate',
    cr: 14, ac: 18, hp: 195,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 15, con: 19, int: 18, wis: 20, cha: 21 },
    attacks: [
      { name: 'Gavel of Absence', attackBonus: 11, damage: '3d8+6', damageType: 'force' },
      { name: 'Sentence of Silence', attackBonus: 11, damage: '6d8', damageType: 'psychic' }
    ],
    multiattack: { attacks: [{ name: 'Gavel of Absence', attackRef: 0 }, { name: 'Sentence of Silence', attackRef: 1 }] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'gavel', name: 'Gavel of Absence', cost: 1, attackRef: 'Gavel of Absence' },
        { id: 'objection', name: 'Objection (cancel a reaction)', cost: 1 },
        { id: 'contempt', name: 'Contempt (one foe is frightened on a failed save)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['minor-illusion'],
      '3day': ['hold-person', 'counterspell'],
      '1day': ['mass-suggestion']
    },
    senses: { darkvision: 120 },
    saves: { int: 9, wis: 10, cha: 10 },
    damageResistances: ['psychic'],
    conditionImmunities: ['charmed', 'frightened'],
    traits: ['The Verdict Was Written Before You Spoke']
  },

  // ── CR 15 ─────────────────────────────────────────────────────────────
  'wyrm-of-the-shattered-light': {
    id: 'wyrm-of-the-shattered-light', name: 'Wyrm of the Shattered Light',
    cr: 15, ac: 19, hp: 229,
    size: 'gargantuan', speed: 40,
    flySpeed: 80,
    abilityScores: { str: 24, dex: 12, con: 23, int: 14, wis: 15, cha: 19 },
    attacks: [
      { name: 'Bite', attackBonus: 12, damage: '2d12+7', damageType: 'piercing' },
      { name: 'Claw', attackBonus: 12, damage: '2d8+7', damageType: 'slashing' },
      { name: 'Prismatic Breath', attackBonus: 12, damage: '12d6', damageType: 'radiant' }
    ],
    multiattack: { attacks: [
      { name: 'Bite', attackRef: 0 }, { name: 'Claw', attackRef: 1 }, { name: 'Claw', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'snap', name: 'Bite', cost: 1, attackRef: 'Bite' },
        { id: 'refract', name: 'Refract (its image splits; attacks may miss)', cost: 2 },
        { id: 'shardfall', name: 'Shardfall (radiant shards, 20 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'glare', name: 'The Glass Cavern Glares (blinding refraction)' },
        { id: 'resonate', name: 'The Shards Resonate (thunder hum, whole lair)' }
      ]
    },
    senses: { blindsight: 60, darkvision: 120 },
    saves: { dex: 6, con: 11, wis: 7, cha: 9 },
    damageImmunities: ['radiant'],
    traits: ['Light Refuses to Leave It']
  },
  'the-first-forgotten-king': {
    id: 'the-first-forgotten-king', name: 'The First Forgotten King',
    cr: 15, ac: 18, hp: 240,
    size: 'large', speed: 30,
    abilityScores: { str: 22, dex: 14, con: 21, int: 17, wis: 18, cha: 22 },
    attacks: [
      { name: 'Crownless Blade', attackBonus: 12, damage: '3d10+6', damageType: 'necrotic' },
      { name: 'Decree of Ruin', attackBonus: 12, damage: '6d10', damageType: 'necrotic' }
    ],
    multiattack: { attacks: [
      { name: 'Crownless Blade', attackRef: 0 }, { name: 'Crownless Blade', attackRef: 0 }, { name: 'Decree of Ruin', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'blade', name: 'Crownless Blade', cost: 1, attackRef: 'Crownless Blade' },
        { id: 'summon-guard', name: 'The Old Guard Answers (a pale knight rises)', cost: 2 },
        { id: 'un-name', name: 'Un-Name (a foe loses one prepared trick)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['minor-illusion'],
      '3day': ['darkness', 'counterspell'],
      '1day': ['mass-suggestion', 'cone-of-cold']
    },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'kneel', name: 'The Court Compels (foes urged to kneel)' },
        { id: 'dim', name: 'The Throne Dims Every Flame' }
      ]
    },
    senses: { darkvision: 120 },
    saves: { con: 10, wis: 9, cha: 11 },
    damageResistances: ['necrotic', 'cold'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'Every Throne Since Has Been a Copy']
  }
});

export default BESTIARY_II;
