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
  }
};
