// === Starter party (since 2.0.0) ===
//
// Four ready-to-play L3 characters baked into the package so the
// solo CLI / browser sandbox boots with content out of the box.
// Records use the same CharacterRecord shape a host would persist
// — `engine.deriveSheet(record)` produces a full sheet.
//
// Distinct first names chosen to make the in-game log readable; no
// proper nouns tied to any published setting. Backgrounds, classes,
// species, and starting kit are all SRD 5.2 defaults — the only
// thing the host has to ship is its UI.

/** @type {ReadonlyArray<import('../../index.d.ts').CharacterRecord>} */
export const STARTER_PARTY = Object.freeze([
  Object.freeze({
    id: 'thora',
    name: 'Thora',
    speciesId: 'dwarf',
    backgroundId: 'soldier',
    classId: 'fighter',
    subclassId: 'champion',
    level: 3,
    abilityScores: { str: 16, dex: 12, con: 15, int: 10, wis: 12, cha: 8 },
    equipment: {
      armorId: 'chain-mail',
      shieldId: 'shield',
      weaponIds: ['longsword', 'javelin']
    },
    proficiencies: {
      skills: ['athletics', 'intimidation'],
      saves: ['str', 'con']
    },
    feats: [{ id: 'savage-attacker' }]
  }),
  Object.freeze({
    id: 'sable',
    name: 'Sable',
    speciesId: 'halfling',
    backgroundId: 'criminal',
    classId: 'rogue',
    subclassId: 'thief',
    level: 3,
    abilityScores: { str: 8, dex: 17, con: 13, int: 12, wis: 14, cha: 10 },
    equipment: {
      armorId: 'leather-armor',
      weaponIds: ['shortsword', 'shortbow', 'dagger']
    },
    proficiencies: {
      skills: ['acrobatics', 'sleight-of-hand', 'stealth', 'perception'],
      expertise: ['stealth', 'sleight-of-hand'],
      tools: ['thieves-tools'],
      saves: ['dex', 'int']
    },
    feats: [{ id: 'alert' }]
  }),
  Object.freeze({
    id: 'oran',
    name: 'Oran',
    speciesId: 'human',
    backgroundId: 'acolyte',
    classId: 'cleric',
    subclassId: 'life-domain',
    level: 3,
    abilityScores: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    equipment: {
      armorId: 'chain-shirt',
      shieldId: 'shield',
      weaponIds: ['mace'],
      otherItemIds: ['holy-symbol']
    },
    proficiencies: {
      skills: ['insight', 'religion', 'medicine', 'persuasion'],
      saves: ['wis', 'cha']
    },
    feats: [{ id: 'magic-initiate', variant: 'cleric' }]
  }),
  Object.freeze({
    id: 'merrick',
    name: 'Merrick',
    speciesId: 'elf',
    backgroundId: 'sage',
    classId: 'wizard',
    subclassId: 'evoker',
    level: 3,
    abilityScores: { str: 8, dex: 14, con: 12, int: 17, wis: 13, cha: 10 },
    equipment: {
      weaponIds: ['quarterstaff', 'dagger'],
      otherItemIds: ['arcane-focus-orb']
    },
    proficiencies: {
      skills: ['arcana', 'history', 'investigation', 'perception'],
      saves: ['int', 'wis']
    },
    feats: [{ id: 'magic-initiate', variant: 'wizard' }]
  })
]);
