// SRD 5.2 backgrounds. Each grants three ability bumps (player picks
// +2 / +1 / 0 across the listed scores, or +1 to all three — both
// distributions are valid per the SRD), two skill proficiencies, one
// tool proficiency, and an Origin Feat. Selection-time variance
// (Magic Initiate's spell-list pick, the ability-bump distribution)
// lives in the actor record, not here.

export default {
  'acolyte': {
    id: 'acolyte',
    name: 'Acolyte',
    abilityScores: ['int', 'wis', 'cha'],
    skillProficiencies: ['insight', 'religion'],
    toolProficiency: 'calligrapher-supplies',
    originFeat: { id: 'magic-initiate', variant: 'cleric' }
  },
  'criminal': {
    id: 'criminal',
    name: 'Criminal',
    abilityScores: ['dex', 'con', 'int'],
    skillProficiencies: ['sleight-of-hand', 'stealth'],
    toolProficiency: 'thieves-tools',
    originFeat: { id: 'alert' }
  },
  'sage': {
    id: 'sage',
    name: 'Sage',
    abilityScores: ['con', 'int', 'wis'],
    skillProficiencies: ['arcana', 'history'],
    toolProficiency: 'calligrapher-supplies',
    originFeat: { id: 'magic-initiate', variant: 'wizard' }
  },
  'soldier': {
    id: 'soldier',
    name: 'Soldier',
    abilityScores: ['str', 'dex', 'con'],
    skillProficiencies: ['athletics', 'intimidation'],
    toolProficiency: 'gaming-set',
    originFeat: { id: 'savage-attacker' }
  },
  'artisan': {
    id: 'artisan',
    name: 'Artisan',
    abilityScores: ['str', 'dex', 'int'],
    skillProficiencies: ['investigation', 'persuasion'],
    toolProficiency: 'smiths-tools',
    originFeat: { id: 'alert' }
  },
  'charlatan': {
    id: 'charlatan',
    name: 'Charlatan',
    abilityScores: ['dex', 'con', 'cha'],
    skillProficiencies: ['deception', 'sleight-of-hand'],
    toolProficiency: 'forgery-kit',
    originFeat: { id: 'magic-initiate', variant: 'wizard' }
  },
  'entertainer': {
    id: 'entertainer',
    name: 'Entertainer',
    abilityScores: ['str', 'dex', 'cha'],
    skillProficiencies: ['acrobatics', 'performance'],
    toolProficiency: 'musical-instrument',
    originFeat: { id: 'magic-initiate', variant: 'druid' }
  },
  'farmer': {
    id: 'farmer',
    name: 'Farmer',
    abilityScores: ['str', 'con', 'wis'],
    skillProficiencies: ['animal-handling', 'nature'],
    toolProficiency: 'carpenters-tools',
    originFeat: { id: 'savage-attacker' }
  },
  'guard': {
    id: 'guard',
    name: 'Guard',
    abilityScores: ['str', 'int', 'wis'],
    skillProficiencies: ['athletics', 'perception'],
    toolProficiency: 'gaming-set',
    originFeat: { id: 'alert' }
  },
  'guide': {
    id: 'guide',
    name: 'Guide',
    abilityScores: ['dex', 'con', 'wis'],
    skillProficiencies: ['stealth', 'survival'],
    toolProficiency: 'cartographers-tools',
    originFeat: { id: 'magic-initiate', variant: 'druid' }
  },
  'hermit': {
    id: 'hermit',
    name: 'Hermit',
    abilityScores: ['con', 'wis', 'cha'],
    skillProficiencies: ['medicine', 'religion'],
    toolProficiency: 'herbalism-kit',
    originFeat: { id: 'magic-initiate', variant: 'cleric' }
  },
  'merchant': {
    id: 'merchant',
    name: 'Merchant',
    abilityScores: ['con', 'int', 'cha'],
    skillProficiencies: ['animal-handling', 'persuasion'],
    toolProficiency: 'navigators-tools',
    originFeat: { id: 'alert' }
  },
  'noble': {
    id: 'noble',
    name: 'Noble',
    abilityScores: ['str', 'int', 'cha'],
    skillProficiencies: ['history', 'persuasion'],
    toolProficiency: 'gaming-set',
    originFeat: { id: 'magic-initiate', variant: 'wizard' }
  },
  'sailor': {
    id: 'sailor',
    name: 'Sailor',
    abilityScores: ['str', 'dex', 'wis'],
    skillProficiencies: ['acrobatics', 'perception'],
    toolProficiency: 'navigators-tools',
    originFeat: { id: 'alert' }
  },
  'scribe': {
    id: 'scribe',
    name: 'Scribe',
    abilityScores: ['dex', 'int', 'wis'],
    skillProficiencies: ['investigation', 'perception'],
    toolProficiency: 'calligrapher-supplies',
    originFeat: { id: 'magic-initiate', variant: 'wizard' }
  },
  'wayfarer': {
    id: 'wayfarer',
    name: 'Wayfarer',
    abilityScores: ['dex', 'wis', 'cha'],
    skillProficiencies: ['insight', 'stealth'],
    toolProficiency: 'thieves-tools',
    originFeat: { id: 'magic-initiate', variant: 'cleric' }
  }
};
