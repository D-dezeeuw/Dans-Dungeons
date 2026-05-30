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
  }
};
