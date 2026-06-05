// SRD 5.2 monster stat blocks — a representative sample for hosts
// that don't AI-generate creatures. Each entry carries the fields a
// host needs to wire a stat block into the encounter system: AC, HP,
// abilities, speed, attacks (with damage spec), and CR.
//
// This isn't the full SRD bestiary — it's the set a starter campaign
// reaches for. Plugins add more via `createEngine({ extraMonsters })`
// (which falls back to the default `Object.freeze`-merge path on the
// engine factory; no special wiring needed past Phase A).

export default {
  goblin: {
    id: 'goblin', name: 'Goblin',
    cr: 0.25, ac: 15, hp: 7,
    size: 'small', speed: 30,
    abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    attacks: [{ name: 'Scimitar', attackBonus: 4, damage: '1d6+2', damageType: 'slashing' }],
    skills: { stealth: 6 }
  },
  orc: {
    id: 'orc', name: 'Orc',
    cr: 0.5, ac: 13, hp: 15,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    attacks: [{ name: 'Greataxe', attackBonus: 5, damage: '1d12+3', damageType: 'slashing' }]
  },
  bandit: {
    id: 'bandit', name: 'Bandit',
    cr: 0.125, ac: 12, hp: 11,
    size: 'medium', speed: 30,
    abilityScores: { str: 11, dex: 12, con: 12, int: 10, wis: 10, cha: 10 },
    attacks: [
      { name: 'Scimitar', attackBonus: 3, damage: '1d6+1', damageType: 'slashing' },
      { name: 'Crossbow, Light', attackBonus: 3, damage: '1d8+1', damageType: 'piercing' }
    ]
  },
  wolf: {
    id: 'wolf', name: 'Wolf',
    cr: 0.25, ac: 13, hp: 11,
    size: 'medium', speed: 40,
    abilityScores: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '2d4+2', damageType: 'piercing' }],
    traits: ['Pack Tactics', 'Keen Hearing and Smell']
  },
  zombie: {
    id: 'zombie', name: 'Zombie',
    cr: 0.25, ac: 8, hp: 22,
    size: 'medium', speed: 20,
    abilityScores: { str: 13, dex: 6, con: 16, int: 3, wis: 6, cha: 5 },
    attacks: [{ name: 'Slam', attackBonus: 3, damage: '1d6+1', damageType: 'bludgeoning' }],
    traits: ['Undead Fortitude']
  },
  skeleton: {
    id: 'skeleton', name: 'Skeleton',
    cr: 0.25, ac: 13, hp: 13,
    size: 'medium', speed: 30,
    abilityScores: { str: 10, dex: 14, con: 15, int: 6, wis: 8, cha: 5 },
    attacks: [
      { name: 'Shortsword', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Shortbow', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' }
    ]
  },
  ogre: {
    id: 'ogre', name: 'Ogre',
    cr: 2, ac: 11, hp: 59,
    size: 'large', speed: 40,
    abilityScores: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 },
    attacks: [{ name: 'Greatclub', attackBonus: 6, damage: '2d8+4', damageType: 'bludgeoning' }]
  },
  troll: {
    id: 'troll', name: 'Troll',
    cr: 5, ac: 15, hp: 84,
    size: 'large', speed: 30,
    abilityScores: { str: 18, dex: 13, con: 20, int: 7, wis: 9, cha: 7 },
    attacks: [{ name: 'Bite', attackBonus: 7, damage: '1d6+4', damageType: 'piercing' }],
    traits: ['Regeneration', 'Keen Smell']
  },
  'young-dragon-red': {
    id: 'young-dragon-red', name: 'Young Red Dragon',
    cr: 10, ac: 18, hp: 178,
    size: 'large', speed: 40,
    abilityScores: { str: 23, dex: 10, con: 21, int: 14, wis: 11, cha: 19 },
    attacks: [{ name: 'Bite', attackBonus: 10, damage: '2d10+6', damageType: 'piercing' }],
    traits: ['Fire Breath (Recharge 5–6)', 'Fire Immunity']
  },

  // === CR 0 ===
  rat: {
    id: 'rat', name: 'Rat',
    cr: 0, ac: 10, hp: 1,
    size: 'tiny', speed: 30,
    abilityScores: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
    attacks: [{ name: 'Bite', attackBonus: 0, damage: '1', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    traits: ['Keen Smell']
  },
  bat: {
    id: 'bat', name: 'Bat',
    cr: 0, ac: 12, hp: 1,
    size: 'tiny', speed: 5,
    abilityScores: { str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4 },
    attacks: [{ name: 'Bite', attackBonus: 0, damage: '1', damageType: 'piercing' }],
    senses: { blindsight: 60 },
    traits: ['Echolocation', 'Keen Hearing']
  },
  spider: {
    id: 'spider', name: 'Spider',
    cr: 0, ac: 12, hp: 1,
    size: 'tiny', speed: 20,
    abilityScores: { str: 2, dex: 14, con: 8, int: 1, wis: 10, cha: 2 },
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '1', damageType: 'piercing' }],
    senses: { darkvision: 30 },
    traits: ['Spider Climb', 'Web Walker']
  },
  frog: {
    id: 'frog', name: 'Frog',
    cr: 0, ac: 11, hp: 1,
    size: 'tiny', speed: 20,
    abilityScores: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
    senses: { darkvision: 30 },
    traits: ['Amphibious', 'Standing Leap']
  },

  // === CR 1/8 ===
  kobold: {
    id: 'kobold', name: 'Kobold',
    cr: 0.125, ac: 12, hp: 5,
    size: 'small', speed: 30,
    abilityScores: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    attacks: [
      { name: 'Dagger', attackBonus: 4, damage: '1d4+2', damageType: 'piercing' },
      { name: 'Sling', attackBonus: 4, damage: '1d4+2', damageType: 'bludgeoning' }
    ],
    senses: { darkvision: 60 },
    languages: ['Common', 'Draconic'],
    traits: ['Pack Tactics', 'Sunlight Sensitivity']
  },
  acolyte: {
    id: 'acolyte', name: 'Acolyte',
    cr: 0.125, ac: 10, hp: 9,
    size: 'medium', speed: 30,
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 11 },
    attacks: [{ name: 'Club', attackBonus: 2, damage: '1d4', damageType: 'bludgeoning' }],
    languages: ['Common'],
    traits: ['Spellcasting (Wis)']
  },
  cultist: {
    id: 'cultist', name: 'Cultist',
    cr: 0.125, ac: 12, hp: 9,
    size: 'medium', speed: 30,
    abilityScores: { str: 11, dex: 12, con: 10, int: 10, wis: 11, cha: 10 },
    attacks: [{ name: 'Scimitar', attackBonus: 3, damage: '1d6+1', damageType: 'slashing' }],
    languages: ['Common'],
    traits: ['Dark Devotion']
  },

  // === CR 1/4 ===
  'constrictor-snake': {
    id: 'constrictor-snake', name: 'Constrictor Snake',
    cr: 0.25, ac: 12, hp: 13,
    size: 'large', speed: 30,
    abilityScores: { str: 15, dex: 14, con: 12, int: 1, wis: 10, cha: 3 },
    attacks: [
      { name: 'Bite', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Constrict', attackBonus: 4, damage: '1d8+2', damageType: 'bludgeoning' }
    ],
    senses: { blindsight: 10 }
  },
  mastiff: {
    id: 'mastiff', name: 'Mastiff',
    cr: 0.125, ac: 12, hp: 5,
    size: 'medium', speed: 40,
    abilityScores: { str: 13, dex: 14, con: 12, int: 3, wis: 12, cha: 7 },
    attacks: [{ name: 'Bite', attackBonus: 3, damage: '1d6+1', damageType: 'piercing' }],
    traits: ['Keen Hearing and Smell']
  },
  'tribal-warrior': {
    id: 'tribal-warrior', name: 'Tribal Warrior',
    cr: 0.125, ac: 12, hp: 11,
    size: 'medium', speed: 30,
    abilityScores: { str: 13, dex: 11, con: 12, int: 8, wis: 11, cha: 8 },
    attacks: [{ name: 'Spear', attackBonus: 3, damage: '1d6+1', damageType: 'piercing' }],
    languages: ['Common'],
    traits: ['Pack Tactics']
  },

  // === CR 1/2 ===
  hobgoblin: {
    id: 'hobgoblin', name: 'Hobgoblin',
    cr: 0.5, ac: 18, hp: 11,
    size: 'medium', speed: 30,
    abilityScores: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 },
    attacks: [
      { name: 'Longsword', attackBonus: 3, damage: '1d8+1', damageType: 'slashing' },
      { name: 'Longbow', attackBonus: 3, damage: '1d8+1', damageType: 'piercing' }
    ],
    senses: { darkvision: 60 },
    languages: ['Common', 'Goblin'],
    traits: ['Martial Advantage']
  },
  hyena: {
    id: 'hyena', name: 'Hyena',
    cr: 0, ac: 11, hp: 5,
    size: 'medium', speed: 50,
    abilityScores: { str: 11, dex: 13, con: 12, int: 2, wis: 12, cha: 5 },
    attacks: [{ name: 'Bite', attackBonus: 2, damage: '1d6', damageType: 'piercing' }],
    traits: ['Pack Tactics']
  },
  gnoll: {
    id: 'gnoll', name: 'Gnoll',
    cr: 0.5, ac: 15, hp: 22,
    size: 'medium', speed: 30,
    abilityScores: { str: 14, dex: 12, con: 11, int: 6, wis: 10, cha: 7 },
    attacks: [
      { name: 'Spear', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Longbow', attackBonus: 3, damage: '1d8+1', damageType: 'piercing' }
    ],
    senses: { darkvision: 60 },
    languages: ['Gnoll'],
    traits: ['Rampage']
  },
  worg: {
    id: 'worg', name: 'Worg',
    cr: 0.5, ac: 13, hp: 26,
    size: 'large', speed: 50,
    abilityScores: { str: 16, dex: 13, con: 13, int: 7, wis: 11, cha: 8 },
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '2d6+3', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    languages: ['Goblin', 'Worg'],
    traits: ['Keen Hearing and Smell']
  },
  'black-bear': {
    id: 'black-bear', name: 'Black Bear',
    cr: 0.5, ac: 11, hp: 19,
    size: 'medium', speed: 40,
    abilityScores: { str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7 },
    attacks: [
      { name: 'Bite', attackBonus: 3, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Claws', attackBonus: 3, damage: '2d4+2', damageType: 'slashing' }
    ],
    traits: ['Keen Smell']
  },
  'brown-bear': {
    id: 'brown-bear', name: 'Brown Bear',
    cr: 1, ac: 11, hp: 34,
    size: 'large', speed: 40,
    abilityScores: { str: 19, dex: 10, con: 16, int: 2, wis: 13, cha: 7 },
    attacks: [
      { name: 'Bite', attackBonus: 5, damage: '1d8+4', damageType: 'piercing' },
      { name: 'Claws', attackBonus: 5, damage: '2d6+4', damageType: 'slashing' }
    ],
    traits: ['Keen Smell']
  },
  crocodile: {
    id: 'crocodile', name: 'Crocodile',
    cr: 0.5, ac: 12, hp: 19,
    size: 'large', speed: 20,
    abilityScores: { str: 15, dex: 10, con: 13, int: 2, wis: 10, cha: 5 },
    attacks: [{ name: 'Bite', attackBonus: 4, damage: '1d10+2', damageType: 'piercing' }],
    traits: ['Hold Breath']
  },
  lizardfolk: {
    id: 'lizardfolk', name: 'Lizardfolk',
    cr: 0.5, ac: 15, hp: 22,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 10, con: 13, int: 7, wis: 12, cha: 7 },
    attacks: [
      { name: 'Bite', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Spear', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' }
    ],
    languages: ['Draconic'],
    traits: ['Hold Breath']
  },
  scout: {
    id: 'scout', name: 'Scout',
    cr: 0.5, ac: 13, hp: 16,
    size: 'medium', speed: 30,
    abilityScores: { str: 11, dex: 14, con: 12, int: 11, wis: 13, cha: 11 },
    attacks: [
      { name: 'Shortsword', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Longbow', attackBonus: 4, damage: '1d8+2', damageType: 'piercing' }
    ],
    languages: ['Common'],
    traits: ['Keen Hearing and Sight']
  },

  // === CR 1 ===
  'dire-wolf': {
    id: 'dire-wolf', name: 'Dire Wolf',
    cr: 1, ac: 14, hp: 37,
    size: 'large', speed: 50,
    abilityScores: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '2d6+3', damageType: 'piercing' }],
    traits: ['Keen Hearing and Smell', 'Pack Tactics']
  },
  ghoul: {
    id: 'ghoul', name: 'Ghoul',
    cr: 1, ac: 12, hp: 22,
    size: 'medium', speed: 30,
    abilityScores: { str: 13, dex: 15, con: 10, int: 7, wis: 10, cha: 6 },
    attacks: [
      { name: 'Bite', attackBonus: 2, damage: '2d6+2', damageType: 'piercing' },
      { name: 'Claws', attackBonus: 4, damage: '2d4+2', damageType: 'slashing' }
    ],
    senses: { darkvision: 60 },
    damageImmunities: ['poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'poisoned'],
    languages: ['Common']
  },
  imp: {
    id: 'imp', name: 'Imp',
    cr: 1, ac: 13, hp: 10,
    size: 'tiny', speed: 20,
    abilityScores: { str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
    attacks: [{ name: 'Sting', attackBonus: 5, damage: '1d4+3', damageType: 'piercing' }],
    senses: { darkvision: 120 },
    damageResistances: ['cold'],
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['poisoned'],
    languages: ['Infernal', 'Common'],
    traits: ['Shapechanger', 'Devil’s Sight', 'Magic Resistance']
  },
  spy: {
    id: 'spy', name: 'Spy',
    cr: 1, ac: 12, hp: 27,
    size: 'medium', speed: 30,
    abilityScores: { str: 10, dex: 15, con: 10, int: 12, wis: 14, cha: 16 },
    attacks: [
      { name: 'Shortsword', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' },
      { name: 'Hand Crossbow', attackBonus: 4, damage: '1d6+2', damageType: 'piercing' }
    ],
    languages: ['Common'],
    traits: ['Cunning Action', 'Sneak Attack']
  },
  specter: {
    id: 'specter', name: 'Specter',
    cr: 1, ac: 12, hp: 22,
    size: 'medium', speed: 50,
    abilityScores: { str: 1, dex: 14, con: 11, int: 10, wis: 10, cha: 11 },
    attacks: [{ name: 'Life Drain', attackBonus: 4, damage: '3d6', damageType: 'necrotic' }],
    senses: { darkvision: 60 },
    damageResistances: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
    damageImmunities: ['necrotic', 'poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
    traits: ['Incorporeal Movement', 'Sunlight Sensitivity']
  },

  // === CR 2 ===
  'bandit-captain': {
    id: 'bandit-captain', name: 'Bandit Captain',
    cr: 2, ac: 15, hp: 65,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 16, con: 14, int: 14, wis: 11, cha: 14 },
    attacks: [
      { name: 'Scimitar', attackBonus: 5, damage: '1d6+3', damageType: 'slashing' },
      { name: 'Dagger', attackBonus: 5, damage: '1d4+3', damageType: 'piercing' }
    ],
    languages: ['Common']
  },
  'cult-fanatic': {
    id: 'cult-fanatic', name: 'Cult Fanatic',
    cr: 2, ac: 13, hp: 33,
    size: 'medium', speed: 30,
    abilityScores: { str: 11, dex: 14, con: 12, int: 10, wis: 13, cha: 14 },
    attacks: [{ name: 'Dagger', attackBonus: 4, damage: '1d4+2', damageType: 'piercing' }],
    languages: ['Common'],
    traits: ['Dark Devotion', 'Spellcasting (Wis)']
  },
  'giant-spider': {
    id: 'giant-spider', name: 'Giant Spider',
    cr: 1, ac: 14, hp: 26,
    size: 'large', speed: 30,
    abilityScores: { str: 14, dex: 16, con: 12, int: 2, wis: 11, cha: 4 },
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' }],
    senses: { blindsight: 10, darkvision: 60 },
    traits: ['Spider Climb', 'Web Sense', 'Web Walker']
  },
  knight: {
    id: 'knight', name: 'Knight',
    cr: 3, ac: 18, hp: 52,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 },
    attacks: [
      { name: 'Greatsword', attackBonus: 5, damage: '2d6+3', damageType: 'slashing' },
      { name: 'Heavy Crossbow', attackBonus: 2, damage: '1d10', damageType: 'piercing' }
    ],
    languages: ['Common'],
    traits: ['Brave']
  },
  owlbear: {
    id: 'owlbear', name: 'Owlbear',
    cr: 3, ac: 13, hp: 59,
    size: 'large', speed: 40,
    abilityScores: { str: 20, dex: 12, con: 17, int: 3, wis: 12, cha: 7 },
    attacks: [
      { name: 'Beak', attackBonus: 7, damage: '1d10+5', damageType: 'piercing' },
      { name: 'Claws', attackBonus: 7, damage: '2d8+5', damageType: 'slashing' }
    ],
    senses: { darkvision: 60 },
    traits: ['Keen Sight and Smell']
  },
  ankheg: {
    id: 'ankheg', name: 'Ankheg',
    cr: 2, ac: 14, hp: 39,
    size: 'large', speed: 30,
    abilityScores: { str: 17, dex: 11, con: 13, int: 1, wis: 13, cha: 6 },
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '2d6+3', damageType: 'slashing' }],
    senses: { darkvision: 60, tremorsense: 60 },
    traits: ['Acid Spray (Recharge 6)']
  },
  centaur: {
    id: 'centaur', name: 'Centaur',
    cr: 2, ac: 12, hp: 45,
    size: 'large', speed: 50,
    abilityScores: { str: 18, dex: 14, con: 14, int: 9, wis: 13, cha: 11 },
    attacks: [
      { name: 'Pike', attackBonus: 6, damage: '1d10+4', damageType: 'piercing' },
      { name: 'Hooves', attackBonus: 6, damage: '2d6+4', damageType: 'bludgeoning' }
    ],
    languages: ['Elvish', 'Sylvan'],
    traits: ['Charge']
  },

  // === CR 3 ===
  'hell-hound': {
    id: 'hell-hound', name: 'Hell Hound',
    cr: 3, ac: 15, hp: 45,
    size: 'medium', speed: 50,
    abilityScores: { str: 17, dex: 12, con: 14, int: 6, wis: 13, cha: 6 },
    attacks: [{ name: 'Bite', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' }],
    senses: { darkvision: 60 },
    damageImmunities: ['fire'],
    languages: ['Infernal'],
    traits: ['Keen Hearing and Smell', 'Pack Tactics', 'Fire Breath (Recharge 5–6)']
  },
  manticore: {
    id: 'manticore', name: 'Manticore',
    cr: 3, ac: 14, hp: 68,
    size: 'large', speed: 30,
    abilityScores: { str: 17, dex: 16, con: 17, int: 7, wis: 12, cha: 8 },
    attacks: [
      { name: 'Bite', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' },
      { name: 'Claws', attackBonus: 5, damage: '2d4+3', damageType: 'slashing' },
      { name: 'Tail Spike', attackBonus: 5, damage: '1d8+3', damageType: 'piercing' }
    ],
    senses: { darkvision: 60 },
    languages: ['Common']
  },
  veteran: {
    id: 'veteran', name: 'Veteran',
    cr: 3, ac: 17, hp: 58,
    size: 'medium', speed: 30,
    abilityScores: { str: 16, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
    attacks: [
      { name: 'Longsword', attackBonus: 5, damage: '1d8+3', damageType: 'slashing' },
      { name: 'Shortsword', attackBonus: 5, damage: '1d6+3', damageType: 'piercing' },
      { name: 'Heavy Crossbow', attackBonus: 3, damage: '1d10', damageType: 'piercing' }
    ],
    languages: ['Common']
  },
  werewolf: {
    id: 'werewolf', name: 'Werewolf',
    cr: 3, ac: 11, hp: 58,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 13, con: 14, int: 10, wis: 11, cha: 10 },
    attacks: [
      { name: 'Bite', attackBonus: 4, damage: '1d8+2', damageType: 'piercing' },
      { name: 'Claws', attackBonus: 4, damage: '2d4+2', damageType: 'slashing' }
    ],
    senses: { darkvision: 60 },
    damageImmunities: ['nonmagical bludgeoning, piercing, and slashing not from silvered weapons'],
    languages: ['Common (cannot speak in wolf form)'],
    traits: ['Shapechanger', 'Keen Hearing and Smell']
  },
  mummy: {
    id: 'mummy', name: 'Mummy',
    cr: 3, ac: 11, hp: 58,
    size: 'medium', speed: 20,
    abilityScores: { str: 16, dex: 8, con: 15, int: 6, wis: 10, cha: 12 },
    attacks: [
      { name: 'Rotting Fist', attackBonus: 5, damage: '2d6+3', damageType: 'bludgeoning' }
    ],
    senses: { darkvision: 60 },
    damageVulnerabilities: ['fire'],
    damageResistances: ['nonmagical bludgeoning, piercing, and slashing'],
    damageImmunities: ['necrotic', 'poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
    languages: ['the languages it knew in life'],
    traits: ['Dreadful Glare', 'Multiattack']
  },

  // === CR 4 ===
  banshee: {
    id: 'banshee', name: 'Banshee',
    cr: 4, ac: 12, hp: 58,
    size: 'medium', speed: 40,
    abilityScores: { str: 1, dex: 14, con: 10, int: 12, wis: 11, cha: 17 },
    attacks: [{ name: 'Corrupting Touch', attackBonus: 4, damage: '3d6', damageType: 'necrotic' }],
    senses: { darkvision: 60 },
    damageResistances: ['acid', 'fire', 'lightning', 'thunder', 'nonmagical bludgeoning, piercing, and slashing'],
    damageImmunities: ['cold', 'necrotic', 'poison'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained'],
    languages: ['Common', 'Elvish'],
    traits: ['Detect Life', 'Incorporeal Movement', 'Wail (1/Day)']
  },
  ettin: {
    id: 'ettin', name: 'Ettin',
    cr: 4, ac: 12, hp: 85,
    size: 'large', speed: 40,
    abilityScores: { str: 21, dex: 8, con: 17, int: 6, wis: 10, cha: 8 },
    attacks: [
      { name: 'Battleaxe', attackBonus: 7, damage: '2d8+5', damageType: 'slashing' },
      { name: 'Morningstar', attackBonus: 7, damage: '2d8+5', damageType: 'piercing' }
    ],
    senses: { darkvision: 60 },
    languages: ['Giant', 'Orc'],
    traits: ['Two Heads', 'Wakeful']
  },
  wight: {
    id: 'wight', name: 'Wight',
    cr: 3, ac: 14, hp: 45,
    size: 'medium', speed: 30,
    abilityScores: { str: 15, dex: 14, con: 16, int: 10, wis: 13, cha: 15 },
    attacks: [
      { name: 'Life Drain', attackBonus: 4, damage: '1d6+2', damageType: 'necrotic' },
      { name: 'Longsword', attackBonus: 4, damage: '1d8+2', damageType: 'slashing' }
    ],
    senses: { darkvision: 60 },
    damageResistances: ['necrotic', 'nonmagical bludgeoning, piercing, and slashing not from silvered weapons'],
    damageImmunities: ['poison'],
    conditionImmunities: ['exhaustion', 'poisoned'],
    languages: ['the languages it knew in life'],
    traits: ['Sunlight Sensitivity']
  },

  // === CR 5 ===
  'air-elemental': {
    id: 'air-elemental', name: 'Air Elemental',
    cr: 5, ac: 15, hp: 90,
    size: 'large', speed: 90,
    abilityScores: { str: 14, dex: 20, con: 14, int: 6, wis: 10, cha: 6 },
    attacks: [{ name: 'Slam', attackBonus: 8, damage: '2d8+5', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    damageResistances: ['lightning', 'thunder', 'nonmagical bludgeoning, piercing, and slashing'],
    damageImmunities: ['poison'],
    conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
    languages: ['Auran'],
    traits: ['Air Form', 'Whirlwind']
  },
  'fire-elemental': {
    id: 'fire-elemental', name: 'Fire Elemental',
    cr: 5, ac: 13, hp: 102,
    size: 'large', speed: 50,
    abilityScores: { str: 10, dex: 17, con: 16, int: 6, wis: 10, cha: 7 },
    attacks: [{ name: 'Touch', attackBonus: 6, damage: '2d6+3', damageType: 'fire' }],
    senses: { darkvision: 60 },
    damageResistances: ['nonmagical bludgeoning, piercing, and slashing'],
    damageImmunities: ['fire', 'poison'],
    conditionImmunities: ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'],
    languages: ['Ignan'],
    traits: ['Fire Form', 'Illumination', 'Water Susceptibility']
  },
  'hill-giant': {
    id: 'hill-giant', name: 'Hill Giant',
    cr: 5, ac: 13, hp: 105,
    size: 'huge', speed: 40,
    abilityScores: { str: 21, dex: 8, con: 19, int: 5, wis: 9, cha: 6 },
    attacks: [
      { name: 'Greatclub', attackBonus: 8, damage: '3d8+5', damageType: 'bludgeoning' },
      { name: 'Rock', attackBonus: 8, damage: '3d10+5', damageType: 'bludgeoning' }
    ],
    languages: ['Giant']
  },
  'flesh-golem': {
    id: 'flesh-golem', name: 'Flesh Golem',
    cr: 5, ac: 9, hp: 93,
    size: 'medium', speed: 30,
    abilityScores: { str: 19, dex: 9, con: 18, int: 6, wis: 10, cha: 5 },
    attacks: [{ name: 'Slam', attackBonus: 7, damage: '2d8+4', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    damageImmunities: ['lightning', 'poison', 'nonmagical bludgeoning, piercing, and slashing not from adamantine weapons'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    languages: ['understands creator’s languages but can’t speak'],
    traits: ['Aversion of Fire', 'Berserk', 'Lightning Absorption', 'Magic Resistance']
  },
  mage: {
    id: 'mage', name: 'Mage',
    cr: 6, ac: 12, hp: 40,
    size: 'medium', speed: 30,
    abilityScores: { str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11 },
    attacks: [{ name: 'Dagger', attackBonus: 5, damage: '1d4+2', damageType: 'piercing' }],
    languages: ['any four languages'],
    traits: ['Spellcasting (Int)']
  },

  // === CR 6 ===
  chimera: {
    id: 'chimera', name: 'Chimera',
    cr: 6, ac: 14, hp: 114,
    size: 'large', speed: 30,
    abilityScores: { str: 19, dex: 11, con: 19, int: 3, wis: 14, cha: 10 },
    attacks: [
      { name: 'Bite', attackBonus: 7, damage: '2d6+4', damageType: 'piercing' },
      { name: 'Horns', attackBonus: 7, damage: '1d12+4', damageType: 'bludgeoning' },
      { name: 'Claws', attackBonus: 7, damage: '2d6+4', damageType: 'slashing' }
    ],
    senses: { darkvision: 60 },
    languages: ['Draconic'],
    traits: ['Fire Breath (Recharge 5–6)']
  },
  wyvern: {
    id: 'wyvern', name: 'Wyvern',
    cr: 6, ac: 13, hp: 110,
    size: 'large', speed: 20,
    abilityScores: { str: 19, dex: 10, con: 16, int: 5, wis: 12, cha: 6 },
    attacks: [
      { name: 'Bite', attackBonus: 7, damage: '2d6+4', damageType: 'piercing' },
      { name: 'Stinger', attackBonus: 7, damage: '2d6+4', damageType: 'piercing' }
    ],
    senses: { darkvision: 60 }
  },

  // === CR 8 ===
  assassin: {
    id: 'assassin', name: 'Assassin',
    cr: 8, ac: 15, hp: 78,
    size: 'medium', speed: 30,
    abilityScores: { str: 11, dex: 16, con: 14, int: 13, wis: 11, cha: 10 },
    attacks: [
      { name: 'Shortsword', attackBonus: 6, damage: '1d6+3', damageType: 'piercing' },
      { name: 'Light Crossbow', attackBonus: 6, damage: '1d8+3', damageType: 'piercing' }
    ],
    damageResistances: ['poison'],
    languages: ['Common', 'Thieves’ cant'],
    traits: ['Assassinate', 'Evasion', 'Sneak Attack']
  },
  'frost-giant': {
    id: 'frost-giant', name: 'Frost Giant',
    cr: 8, ac: 15, hp: 138,
    size: 'huge', speed: 40,
    abilityScores: { str: 23, dex: 9, con: 21, int: 9, wis: 10, cha: 12 },
    attacks: [
      { name: 'Greataxe', attackBonus: 9, damage: '3d12+6', damageType: 'slashing' },
      { name: 'Rock', attackBonus: 9, damage: '4d10+6', damageType: 'bludgeoning' }
    ],
    damageImmunities: ['cold'],
    languages: ['Giant']
  },

  // === CR 9 ===
  'fire-giant': {
    id: 'fire-giant', name: 'Fire Giant',
    cr: 9, ac: 18, hp: 162,
    size: 'huge', speed: 30,
    abilityScores: { str: 25, dex: 9, con: 23, int: 10, wis: 14, cha: 13 },
    attacks: [
      { name: 'Greatsword', attackBonus: 11, damage: '6d6+7', damageType: 'slashing' },
      { name: 'Rock', attackBonus: 11, damage: '4d10+7', damageType: 'bludgeoning' }
    ],
    damageImmunities: ['fire'],
    languages: ['Giant']
  },
  'cloud-giant': {
    id: 'cloud-giant', name: 'Cloud Giant',
    cr: 9, ac: 14, hp: 200,
    size: 'huge', speed: 40,
    abilityScores: { str: 27, dex: 10, con: 22, int: 12, wis: 16, cha: 16 },
    attacks: [
      { name: 'Morningstar', attackBonus: 12, damage: '3d8+8', damageType: 'piercing' },
      { name: 'Rock', attackBonus: 12, damage: '4d10+8', damageType: 'bludgeoning' }
    ],
    senses: { },
    languages: ['Common', 'Giant'],
    traits: ['Keen Smell', 'Innate Spellcasting']
  },

  // === CR 10-11 ===
  'stone-golem': {
    id: 'stone-golem', name: 'Stone Golem',
    cr: 10, ac: 17, hp: 178,
    size: 'large', speed: 30,
    abilityScores: { str: 22, dex: 9, con: 20, int: 3, wis: 11, cha: 1 },
    attacks: [{ name: 'Slam', attackBonus: 10, damage: '3d8+6', damageType: 'bludgeoning' }],
    senses: { darkvision: 120 },
    damageImmunities: ['poison', 'psychic', 'nonmagical bludgeoning, piercing, and slashing not from adamantine weapons'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'],
    languages: ['understands creator’s languages but can’t speak'],
    traits: ['Immutable Form', 'Magic Resistance', 'Slow']
  },
  djinni: {
    id: 'djinni', name: 'Djinni',
    cr: 11, ac: 17, hp: 161,
    size: 'large', speed: 30,
    abilityScores: { str: 21, dex: 15, con: 22, int: 15, wis: 16, cha: 20 },
    attacks: [{ name: 'Scimitar', attackBonus: 9, damage: '2d6+5', damageType: 'slashing' }],
    senses: { darkvision: 120 },
    damageImmunities: ['lightning', 'thunder'],
    languages: ['Auran'],
    traits: ['Elemental Demise', 'Innate Spellcasting']
  },
  efreeti: {
    id: 'efreeti', name: 'Efreeti',
    cr: 11, ac: 17, hp: 200,
    size: 'large', speed: 40,
    abilityScores: { str: 22, dex: 12, con: 24, int: 16, wis: 15, cha: 16 },
    attacks: [
      { name: 'Scimitar', attackBonus: 10, damage: '2d6+6', damageType: 'slashing' },
      { name: 'Hurl Flame', attackBonus: 7, damage: '5d6', damageType: 'fire' }
    ],
    senses: { darkvision: 120 },
    damageImmunities: ['fire'],
    languages: ['Ignan'],
    traits: ['Elemental Demise', 'Innate Spellcasting']
  },
  vampire: {
    id: 'vampire', name: 'Vampire',
    cr: 13, ac: 16, hp: 144,
    size: 'medium', speed: 30,
    abilityScores: { str: 18, dex: 18, con: 18, int: 17, wis: 15, cha: 18 },
    attacks: [
      { name: 'Unarmed Strike', attackBonus: 9, damage: '1d8+4', damageType: 'bludgeoning' },
      { name: 'Bite', attackBonus: 9, damage: '1d6+4', damageType: 'piercing' }
    ],
    senses: { darkvision: 120 },
    damageResistances: ['necrotic', 'nonmagical bludgeoning, piercing, and slashing'],
    languages: ['the languages it knew in life'],
    traits: ['Regeneration', 'Shapechanger', 'Spider Climb', 'Misty Escape']
  },

  // === CR 12-15 ===
  archmage: {
    id: 'archmage', name: 'Archmage',
    cr: 12, ac: 12, hp: 99,
    size: 'medium', speed: 30,
    abilityScores: { str: 10, dex: 14, con: 12, int: 20, wis: 15, cha: 16 },
    attacks: [{ name: 'Dagger', attackBonus: 6, damage: '1d4+2', damageType: 'piercing' }],
    damageResistances: ['damage from spells; nonmagical bludgeoning, piercing, and slashing (from stoneskin)'],
    languages: ['any six languages'],
    traits: ['Magic Resistance', 'Spellcasting (Int)']
  },
  'purple-worm': {
    id: 'purple-worm', name: 'Purple Worm',
    cr: 15, ac: 18, hp: 247,
    size: 'gargantuan', speed: 50,
    abilityScores: { str: 28, dex: 7, con: 22, int: 1, wis: 8, cha: 4 },
    attacks: [
      { name: 'Bite', attackBonus: 9, damage: '3d8+9', damageType: 'piercing' },
      { name: 'Tail Stinger', attackBonus: 9, damage: '3d6+9', damageType: 'piercing' }
    ],
    senses: { blindsight: 30, tremorsense: 60 },
    traits: ['Tunneler']
  },
  'mummy-lord': {
    id: 'mummy-lord', name: 'Mummy Lord',
    cr: 15, ac: 17, hp: 97,
    size: 'medium', speed: 20,
    abilityScores: { str: 18, dex: 10, con: 17, int: 11, wis: 18, cha: 16 },
    attacks: [{ name: 'Rotting Fist', attackBonus: 9, damage: '3d6+4', damageType: 'bludgeoning' }],
    senses: { darkvision: 60 },
    damageVulnerabilities: ['fire'],
    damageImmunities: ['necrotic', 'poison', 'nonmagical bludgeoning, piercing, and slashing'],
    conditionImmunities: ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'],
    languages: ['the languages it knew in life'],
    traits: ['Magic Resistance', 'Rejuvenation', 'Spellcasting (Wis)']
  }
};
