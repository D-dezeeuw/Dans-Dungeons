// Bestiary III — 10 capstone monsters, CR 16–20, for tier-4 play.
// Legendary Resistance pools throughout, Mythic Actions (the second-phase
// pool whose consumer lands with this batch), and Innate Spellcasting at
// spell levels 6+ — every listed id a real SRD spell.
//
// Same pack rules as Bestiary I/II (docs/legal.md): invented names,
// mounted via `createEngine({ extraMonsters: BESTIARY_III })`, the SRD
// registry untouched. Tier discipline: every block has truesight or a
// 120 ft sense, multiattacks, trains 3+ saves, and carries Legendary
// Resistance 3; six carry a mythic phase; every lair-holder's lair is a
// place the campaign can visit.

export const BESTIARY_III = Object.freeze({
  'the-shrouded-emperor': {
    id: 'the-shrouded-emperor', name: 'The Shrouded Emperor',
    cr: 16, ac: 19, hp: 246,
    size: 'large', speed: 30,
    abilityScores: { str: 20, dex: 15, con: 22, int: 18, wis: 19, cha: 24 },
    attacks: [
      { name: 'Sceptre of the Long Dusk', attackBonus: 13, damage: '3d10+7', damageType: 'necrotic' },
      { name: 'Imperial Edict', attackBonus: 13, damage: '6d10', damageType: 'psychic' }
    ],
    multiattack: { attacks: [
      { name: 'Sceptre of the Long Dusk', attackRef: 0 }, { name: 'Sceptre of the Long Dusk', attackRef: 0 }, { name: 'Imperial Edict', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'sceptre', name: 'Sceptre of the Long Dusk', cost: 1, attackRef: 'Sceptre of the Long Dusk' },
        { id: 'decree', name: 'Decree (a foe kneels on a failed save)', cost: 2 },
        { id: 'veil', name: 'Draw the Veil (invisible until it attacks)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['minor-illusion'],
      '3day': ['counterspell', 'true-seeing'],
      '1day': ['mass-suggestion', 'power-word-stun']
    },
    senses: { truesight: 60, darkvision: 120 },
    saves: { con: 11, wis: 9, cha: 12 },
    damageResistances: ['necrotic', 'cold'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'poisoned'],
    traits: ['Undead Nature', 'The Empire Never Fell; It Went Indoors']
  },
  'matriarch-of-the-glass-desert': {
    id: 'matriarch-of-the-glass-desert', name: 'Matriarch of the Glass Desert',
    cr: 16, ac: 18, hp: 264,
    size: 'gargantuan', speed: 40,
    abilityScores: { str: 24, dex: 11, con: 23, int: 12, wis: 17, cha: 16 },
    attacks: [
      { name: 'Vitrifying Bite', attackBonus: 13, damage: '3d12+7', damageType: 'piercing' },
      { name: 'Sandglass Tail', attackBonus: 13, damage: '3d8+7', damageType: 'bludgeoning' },
      { name: 'Glassing Breath', attackBonus: 13, damage: '12d8', damageType: 'fire' }
    ],
    multiattack: { attacks: [
      { name: 'Vitrifying Bite', attackRef: 0 }, { name: 'Sandglass Tail', attackRef: 1 }, { name: 'Sandglass Tail', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'tail', name: 'Sandglass Tail', cost: 1, attackRef: 'Sandglass Tail' },
        { id: 'burrow', name: 'Sink Beneath the Glass', cost: 1 },
        { id: 'shatter', name: 'Shatter the Ground (shards, 20 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'mirage', name: 'The Desert Lies (mirages of the party)' },
        { id: 'glare', name: 'The Glass Glares (blinding, whole basin)' }
      ]
    },
    senses: { tremorsense: 120, darkvision: 120 },
    saves: { str: 12, con: 11, wis: 8 },
    damageImmunities: ['fire'],
    traits: ['The Dunes Are Her Cast-Off Skins']
  },
  'the-drowned-cathedral': {
    id: 'the-drowned-cathedral', name: 'The Drowned Cathedral',
    cr: 17, ac: 19, hp: 280,
    size: 'gargantuan', speed: 20,
    abilityScores: { str: 25, dex: 8, con: 24, int: 14, wis: 20, cha: 19 },
    attacks: [
      { name: 'Falling Spire', attackBonus: 14, damage: '4d10+7', damageType: 'bludgeoning' },
      { name: 'Congregation of the Deep', attackBonus: 14, damage: '6d8', damageType: 'necrotic' },
      { name: 'The Great Organ', attackBonus: 14, damage: '8d8', damageType: 'thunder' }
    ],
    multiattack: { attacks: [
      { name: 'Falling Spire', attackRef: 0 }, { name: 'Falling Spire', attackRef: 0 }, { name: 'The Great Organ', attackRef: 2 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'spire', name: 'Falling Spire', cost: 1, attackRef: 'Falling Spire' },
        { id: 'flood-pew', name: 'The Nave Floods Another Foot', cost: 1 },
        { id: 'hymn', name: 'Drowned Hymn (wisdom save or walk toward it)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    mythicActions: {
      trigger: 'firstDeath',
      uses: 3,
      options: [
        { id: 'second-tide', name: 'The Second Tide (it stands again, sanctified in salt)', cost: 1 },
        { id: 'bell-of-the-abyss', name: 'Bell of the Abyss (thunder, whole lair)', cost: 2 },
        { id: 'undertow-choir', name: 'Undertow Choir (foes dragged 20 ft)', cost: 2 }
      ]
    },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'rise', name: 'The Water Rises' },
        { id: 'stained-light', name: 'The Windows Glow With Drowned Light' }
      ]
    },
    senses: { blindsight: 120, tremorsense: 120 },
    saves: { str: 13, con: 12, wis: 11 },
    damageResistances: ['bludgeoning', 'piercing'],
    damageImmunities: ['cold'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'prone'],
    traits: ['A Building That Learned to Want']
  },
  'sovereign-of-the-wild-hunt': {
    id: 'sovereign-of-the-wild-hunt', name: 'Sovereign of the Wild Hunt',
    cr: 17, ac: 20, hp: 250,
    size: 'large', speed: 50,
    abilityScores: { str: 22, dex: 20, con: 21, int: 15, wis: 19, cha: 22 },
    attacks: [
      { name: 'Horn-Tipped Lance', attackBonus: 13, damage: '3d12+6', damageType: 'piercing' },
      { name: 'The Baying Dark', attackBonus: 13, damage: '5d10', damageType: 'psychic' }
    ],
    multiattack: { attacks: [
      { name: 'Horn-Tipped Lance', attackRef: 0 }, { name: 'Horn-Tipped Lance', attackRef: 0 }, { name: 'The Baying Dark', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'lance', name: 'Horn-Tipped Lance', cost: 1, attackRef: 'Horn-Tipped Lance' },
        { id: 'ride-past', name: 'Ride Past (move full speed, no opportunity attacks)', cost: 1 },
        { id: 'sound-horn', name: 'Sound the Horn (the hunt closes in)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['minor-illusion'],
      '3day': ['misty-step', 'true-seeing'],
      '1day': ['plane-shift', 'chain-lightning']
    },
    senses: { truesight: 120 },
    saves: { dex: 11, con: 11, wis: 10, cha: 12 },
    damageResistances: ['cold', 'necrotic'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened'],
    traits: ['Fey Nature', 'What It Hunts, It Was Once']
  },
  'the-rust-leviathan': {
    id: 'the-rust-leviathan', name: 'The Rust Leviathan',
    cr: 18, ac: 20, hp: 300,
    size: 'gargantuan', speed: 30,
    abilityScores: { str: 26, dex: 8, con: 25, int: 6, wis: 14, cha: 8 },
    attacks: [
      { name: 'Foundry Jaw', attackBonus: 14, damage: '4d12+8', damageType: 'piercing' },
      { name: 'Anchor-Chain Flail', attackBonus: 14, damage: '3d10+8', damageType: 'bludgeoning' },
      { name: 'Corrosive Gout', attackBonus: 14, damage: '10d10', damageType: 'acid' }
    ],
    multiattack: { attacks: [
      { name: 'Foundry Jaw', attackRef: 0 }, { name: 'Anchor-Chain Flail', attackRef: 1 }, { name: 'Anchor-Chain Flail', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'chain', name: 'Anchor-Chain Flail', cost: 1, attackRef: 'Anchor-Chain Flail' },
        { id: 'list', name: 'It Lists (the deck tilts; foes slide)', cost: 1 },
        { id: 'vent', name: 'Vent Corrosion (acid cloud, 20 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    mythicActions: {
      trigger: 'firstDeath',
      uses: 3,
      options: [
        { id: 'shed-hull', name: 'Shed the Hull (the true body surfaces)', cost: 1 },
        { id: 'magnetize', name: 'Magnetize (metal-bearing foes dragged in)', cost: 2 },
        { id: 'scuttle', name: 'Scuttle the Field (the floor gives way)', cost: 2 }
      ]
    },
    senses: { blindsight: 60, tremorsense: 120 },
    saves: { str: 14, con: 13, wis: 8 },
    damageImmunities: ['acid', 'poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    traits: ['Construct Nature', 'Every Shipwreck Fed It']
  },
  'grandmother-midnight': {
    id: 'grandmother-midnight', name: 'Grandmother Midnight',
    cr: 18, ac: 19, hp: 262,
    size: 'medium', speed: 30,
    flySpeed: 40,
    abilityScores: { str: 16, dex: 19, con: 21, int: 22, wis: 21, cha: 25 },
    attacks: [
      { name: 'Needle of the Last Stitch', attackBonus: 13, damage: '3d8+6', damageType: 'piercing' },
      { name: 'Unravel', attackBonus: 13, damage: '7d8', damageType: 'necrotic' }
    ],
    multiattack: { attacks: [
      { name: 'Needle of the Last Stitch', attackRef: 0 }, { name: 'Needle of the Last Stitch', attackRef: 0 }, { name: 'Unravel', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'needle', name: 'Needle of the Last Stitch', cost: 1, attackRef: 'Needle of the Last Stitch' },
        { id: 'snip', name: 'Snip a Thread (cancel a reaction)', cost: 1 },
        { id: 'hem-the-dark', name: 'Hem the Dark (darkness knits shut, 30 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    mythicActions: {
      trigger: 'firstDeath',
      uses: 3,
      options: [
        { id: 'reknit', name: 'Re-Knit Herself (the seams close)', cost: 1 },
        { id: 'nine-needles', name: 'Nine Needles (all foes stitched to the floor)', cost: 2 },
        { id: 'borrowed-years', name: 'Borrowed Years (a foe ages a decade)', cost: 2 }
      ]
    },
    innateSpellcasting: {
      atWill: ['minor-illusion', 'mage-hand'],
      '3day': ['counterspell', 'true-seeing'],
      '1day': ['finger-of-death', 'mind-blank']
    },
    senses: { truesight: 120 },
    saves: { int: 12, wis: 11, cha: 13 },
    damageResistances: ['necrotic', 'psychic'],
    conditionImmunities: ['charmed', 'frightened'],
    traits: ['Fey Nature', 'She Hemmed the First Night to Fit']
  },
  'the-ash-tyrant-reborn': {
    id: 'the-ash-tyrant-reborn', name: 'The Ash Tyrant Reborn',
    cr: 19, ac: 21, hp: 310,
    size: 'gargantuan', speed: 40,
    flySpeed: 80,
    abilityScores: { str: 27, dex: 12, con: 25, int: 16, wis: 15, cha: 21 },
    attacks: [
      { name: 'Bite', attackBonus: 15, damage: '3d10+8', damageType: 'piercing' },
      { name: 'Claw', attackBonus: 15, damage: '2d8+8', damageType: 'slashing' },
      { name: 'Cinderstorm Breath', attackBonus: 15, damage: '15d6', damageType: 'fire' }
    ],
    multiattack: { attacks: [
      { name: 'Bite', attackRef: 0 }, { name: 'Claw', attackRef: 1 }, { name: 'Claw', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'snap', name: 'Bite', cost: 1, attackRef: 'Bite' },
        { id: 'wing-storm', name: 'Wing Storm (ash blinds, 20 ft)', cost: 2 },
        { id: 'immolate', name: 'Immolate the Ground', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    mythicActions: {
      trigger: 'firstDeath',
      uses: 3,
      options: [
        { id: 'rekindle', name: 'Rekindle (it rises from its own ash)', cost: 1 },
        { id: 'pyroclasm', name: 'Pyroclasm (fire, whole lair)', cost: 2 },
        { id: 'ash-wraiths', name: 'Ash Wraiths (its old deaths fight beside it)', cost: 2 }
      ]
    },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'vents', name: 'The Caldera Vents' },
        { id: 'collapse', name: 'The Crust Collapses (a foe drops into ash)' }
      ]
    },
    senses: { blindsight: 60, darkvision: 120 },
    saves: { dex: 7, con: 13, wis: 8, cha: 11 },
    damageImmunities: ['fire'],
    conditionImmunities: ['frightened'],
    traits: ['It Has Burned Out Twice Before; It Remembers Both']
  },
  'the-anathema-of-hours': {
    id: 'the-anathema-of-hours', name: 'The Anathema of Hours',
    cr: 19, ac: 20, hp: 285,
    size: 'huge', speed: 40,
    abilityScores: { str: 21, dex: 22, con: 23, int: 24, wis: 20, cha: 20 },
    attacks: [
      { name: 'Pendulum Scythe', attackBonus: 14, damage: '3d12+6', damageType: 'slashing' },
      { name: 'Entropy Pulse', attackBonus: 14, damage: '8d8', damageType: 'force' }
    ],
    multiattack: { attacks: [
      { name: 'Pendulum Scythe', attackRef: 0 }, { name: 'Pendulum Scythe', attackRef: 0 }, { name: 'Entropy Pulse', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'scythe', name: 'Pendulum Scythe', cost: 1, attackRef: 'Pendulum Scythe' },
        { id: 'skip', name: 'Skip a Second (teleport 30 ft)', cost: 1 },
        { id: 'age-steel', name: 'Age Steel (a weapon rusts a century)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    innateSpellcasting: {
      atWill: ['minor-illusion'],
      '3day': ['counterspell', 'reverse-gravity'],
      '1day': ['time-stop', 'foresight']
    },
    senses: { truesight: 120 },
    saves: { dex: 12, int: 13, wis: 11 },
    damageResistances: ['force', 'necrotic'],
    conditionImmunities: ['charmed', 'exhaustion'],
    traits: ['Aberrant Nature', 'It Experiences the Fight in Whichever Order It Prefers']
  },
  'the-worm-that-waits-below': {
    id: 'the-worm-that-waits-below', name: 'The Worm That Waits Below',
    cr: 20, ac: 20, hp: 340,
    size: 'gargantuan', speed: 50,
    abilityScores: { str: 28, dex: 7, con: 26, int: 4, wis: 13, cha: 6 },
    attacks: [
      { name: 'World-Swallowing Bite', attackBonus: 15, damage: '4d12+9', damageType: 'piercing' },
      { name: 'Seismic Coil', attackBonus: 15, damage: '4d10+9', damageType: 'bludgeoning' },
      { name: 'Abyssal Gullet', attackBonus: 15, damage: '10d10', damageType: 'acid' }
    ],
    multiattack: { attacks: [
      { name: 'World-Swallowing Bite', attackRef: 0 }, { name: 'Seismic Coil', attackRef: 1 }, { name: 'Seismic Coil', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'coil', name: 'Seismic Coil', cost: 1, attackRef: 'Seismic Coil' },
        { id: 'dive', name: 'Dive (burrow; the floor closes behind it)', cost: 1 },
        { id: 'quake', name: 'Quake (everyone standing saves or falls)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    mythicActions: {
      trigger: 'firstDeath',
      uses: 3,
      options: [
        { id: 'molt', name: 'Molt (the wounded skin sloughs; a fresh one beneath)', cost: 1 },
        { id: 'swallow-light', name: 'Swallow the Light (the cavern goes black)', cost: 2 },
        { id: 'birth-brood', name: 'Birth the Brood (pit wyrmlings erupt)', cost: 2 }
      ]
    },
    senses: { blindsight: 30, tremorsense: 120 },
    saves: { str: 15, con: 14, wis: 7 },
    damageImmunities: ['acid'],
    conditionImmunities: ['prone'],
    traits: ['Older Than the Map of Anywhere']
  },
  'the-silence-crowned': {
    id: 'the-silence-crowned', name: 'The Silence Crowned',
    cr: 20, ac: 21, hp: 320,
    size: 'large', speed: 40,
    flySpeed: 60,
    abilityScores: { str: 22, dex: 18, con: 24, int: 21, wis: 24, cha: 26 },
    attacks: [
      { name: 'Crown of Hushed Blades', attackBonus: 15, damage: '3d10+7', damageType: 'slashing' },
      { name: 'The Unsaid Word', attackBonus: 15, damage: '9d8', damageType: 'psychic' }
    ],
    multiattack: { attacks: [
      { name: 'Crown of Hushed Blades', attackRef: 0 }, { name: 'Crown of Hushed Blades', attackRef: 0 }, { name: 'The Unsaid Word', attackRef: 1 }
    ] },
    legendaryActions: {
      uses: 3,
      options: [
        { id: 'blades', name: 'Crown of Hushed Blades', cost: 1, attackRef: 'Crown of Hushed Blades' },
        { id: 'hush', name: 'Hush (one foe casts nothing this round)', cost: 2 },
        { id: 'still-air', name: 'Still the Air (thunder and speech die, 30 ft)', cost: 2 }
      ]
    },
    legendaryResistance: { uses: 3 },
    mythicActions: {
      trigger: 'firstDeath',
      uses: 3,
      options: [
        { id: 'coronation', name: 'The Coronation (silence takes the crown itself)', cost: 1 },
        { id: 'unspeak', name: 'Unspeak a Foe (a name is briefly not)', cost: 2 },
        { id: 'the-long-quiet', name: 'The Long Quiet (all sound ends, whole lair)', cost: 2 }
      ]
    },
    innateSpellcasting: {
      atWill: ['minor-illusion'],
      '3day': ['counterspell', 'antimagic-field'],
      '1day': ['power-word-kill', 'gate']
    },
    lairActions: {
      triggersOnInitiative: 20,
      options: [
        { id: 'deafen', name: 'The Court Goes Deaf' },
        { id: 'weightless-words', name: 'Words Fall Out of the Air, Visible and Dead' }
      ]
    },
    senses: { truesight: 120 },
    saves: { con: 13, int: 11, wis: 13, cha: 14 },
    damageResistances: ['psychic', 'thunder'],
    conditionImmunities: ['charmed', 'deafened', 'frightened'],
    traits: ['Where the Quiet Stair Ends, It Began']
  }
});

export default BESTIARY_III;
