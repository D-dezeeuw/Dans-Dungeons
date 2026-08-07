// SRD 5.2 Origin Feats — the three referenced by the four shipped
// backgrounds. General / Fighting Style / Epic Boon feats are out of
// scope for v0; see docs/spec.md.

export default {
  'magic-initiate': {
    id: 'magic-initiate',
    name: 'Magic Initiate',
    category: 'origin',
    // The feat picks a spell list. `variant` is set on selection.
    variants: ['cleric', 'druid', 'wizard'],
    grants: {
      cantripsKnown: 2,
      level1Spell: 1,           // free cast once per Long Rest
      spellcastingAbility: 'choose:int|wis|cha'
    },
    repeatable: true            // different list each time
  },
  'alert': {
    id: 'alert',
    name: 'Alert',
    category: 'origin',
    grants: {
      initiativeProficiency: true,
      initiativeSwap: true      // swap with a willing ally after rolling
    }
  },
  'savage-attacker': {
    id: 'savage-attacker',
    name: 'Savage Attacker',
    category: 'origin',
    grants: {
      // Once per turn on a weapon hit, roll damage dice twice and keep
      // either roll. The loop reads this flag and rolls accordingly.
      rerollWeaponDamageOncePerTurn: true
    }
  },
  // Epic Boon feats per SRD 5.2 § Feats — Epic Boon. Available at
  // L19 and reflect the campaign's final ascent.
  'boon-of-combat-prowess': {
    id: 'boon-of-combat-prowess', name: 'Boon of Combat Prowess',
    category: 'epic-boon',
    grants: { missedAttackRerollOncePerTurn: true }
  },
  'boon-of-dimensional-travel': {
    id: 'boon-of-dimensional-travel', name: 'Boon of Dimensional Travel',
    category: 'epic-boon',
    grants: { freeTeleport30FtOncePerTurn: true }
  },
  'boon-of-energy-resistance': {
    id: 'boon-of-energy-resistance', name: 'Boon of Energy Resistance',
    category: 'epic-boon',
    grants: { pickThreeEnergyResistances: true }
  },
  'boon-of-fate': {
    id: 'boon-of-fate', name: 'Boon of Fate',
    category: 'epic-boon',
    grants: { d10ToCreatureRollOncePerTurn: true }
  },
  'boon-of-fortitude': {
    id: 'boon-of-fortitude', name: 'Boon of Fortitude',
    category: 'epic-boon',
    grants: { hpMaxBonus: 40, regen5OnTurnStart: true }
  },
  'boon-of-irresistible-offense': {
    id: 'boon-of-irresistible-offense', name: 'Boon of Irresistible Offense',
    category: 'epic-boon',
    grants: { trueStrikeWeaponDamageOncePerTurn: true }
  },
  'boon-of-recovery': {
    id: 'boon-of-recovery', name: 'Boon of Recovery',
    category: 'epic-boon',
    grants: { selfHealAsBonusActionOncePerLongRest: true }
  },
  'boon-of-skill': {
    id: 'boon-of-skill', name: 'Boon of Skill',
    category: 'epic-boon',
    grants: { allSkillsProficient: true }
  },
  'boon-of-spell-recall': {
    id: 'boon-of-spell-recall', name: 'Boon of Spell Recall',
    category: 'epic-boon',
    grants: { castWithoutSlotOnConSaveOncePerTurn: true }
  },
  'boon-of-the-night-spirit': {
    id: 'boon-of-the-night-spirit', name: 'Boon of the Night Spirit',
    category: 'epic-boon',
    grants: { dimLightResistance: true, dimLightInvisibility: true }
  },
  'boon-of-truesight': {
    id: 'boon-of-truesight', name: 'Boon of Truesight',
    category: 'epic-boon',
    grants: { truesightFt: 60 }
  },
  // Fighting Style feats per SRD 5.2 § Feats — Fighting Style. Granted
  // by Fighter / Paladin / Ranger at the levels listed in each class.
  'archery': {
    id: 'archery', name: 'Archery',
    category: 'fighting-style',
    grants: { rangedAttackBonus: 2 }
  },
  'defense': {
    id: 'defense', name: 'Defense',
    category: 'fighting-style',
    grants: { acBonusWhileArmored: 1 }
  },
  'dueling': {
    id: 'dueling', name: 'Dueling',
    category: 'fighting-style',
    grants: { oneHandedNoOffhandDamageBonus: 2 }
  },
  'great-weapon-fighting': {
    id: 'great-weapon-fighting', name: 'Great Weapon Fighting',
    category: 'fighting-style',
    grants: { rerollTwoHandedDamageOneOrTwo: true }
  },
  'protection': {
    id: 'protection', name: 'Protection',
    category: 'fighting-style',
    grants: { reactionImposeDisadvantageWithShield: true, range: 5 }
  },
  'two-weapon-fighting': {
    id: 'two-weapon-fighting', name: 'Two-Weapon Fighting',
    category: 'fighting-style',
    grants: { addAbilityModToOffhandDamage: true }
  },
  // General feats per SRD 5.2 § Feats — General. Available starting at
  // level 4 (the first ASI tier) via a class's Ability Score Improvement.
  'ability-score-improvement': {
    id: 'ability-score-improvement', name: 'Ability Score Improvement',
    category: 'general',
    prerequisite: { level: 4 },
    grants: {
      // Either +2 to one ability or +1/+1 to two; cap 20 unless raised
      // by another feature. The loop reads the chosen distribution.
      abilityScorePoints: 2,
      maxPerAbility: 20
    },
    repeatable: true
  },
  'tough': {
    id: 'tough', name: 'Tough',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { hpPerLevelBonus: 2 }
  },
  'lucky': {
    id: 'lucky', name: 'Lucky',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { luckPoints: 3, rerollOrSwapPerLongRest: true }
  },
  'mobile': {
    id: 'mobile', name: 'Mobile',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { speedBonus: 10, dashDifficultTerrainIgnored: true, noOpportunityAttackFromTargets: true }
  },
  'sentinel': {
    id: 'sentinel', name: 'Sentinel',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { opportunityAttackStopsMovement: true, blockDisengage: true, reactionAttackAllyHit: true }
  },
  'great-weapon-master': {
    id: 'great-weapon-master', name: 'Great Weapon Master',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { bonusActionAttackOnCritOrKill: true, heavyWeaponPowerAttack: { toHit: -5, damage: 10 } }
  },
  'sharpshooter': {
    id: 'sharpshooter', name: 'Sharpshooter',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { ignoreHalfAndThreeQuartersCover: true, noLongRangeDisadvantage: true, rangedPowerAttack: { toHit: -5, damage: 10 } }
  },
  'crossbow-expert': {
    id: 'crossbow-expert', name: 'Crossbow Expert',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { ignoreLoadingCrossbow: true, noRangedDisadvantageInMelee: true, bonusActionHandCrossbowAttack: true }
  },
  'polearm-master': {
    id: 'polearm-master', name: 'Polearm Master',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { bonusActionButtEndD4: true, opportunityAttackOnEnterReach: true }
  },
  'war-caster': {
    id: 'war-caster', name: 'War Caster',
    category: 'general',
    prerequisite: { level: 4, spellcasting: true },
    grants: { advantageOnConcentrationSaves: true, somaticWithFullHands: true, castAsOpportunityAttack: true }
  },
  'elemental-adept': {
    id: 'elemental-adept', name: 'Elemental Adept',
    category: 'general',
    prerequisite: { level: 4, spellcasting: true },
    variants: ['acid', 'cold', 'fire', 'lightning', 'thunder'],
    grants: { ignoreResistanceForChosenType: true, treatOnesAsTwosOnDamageDice: true },
    repeatable: true
  },
  'inspiring-leader': {
    id: 'inspiring-leader', name: 'Inspiring Leader',
    category: 'general',
    prerequisite: { level: 4, abilityScore: { cha: 13 } },
    grants: { tenMinuteSpeechTempHp: 'level + chaMod', maxRecipients: 6 }
  },
  'resilient': {
    id: 'resilient', name: 'Resilient',
    category: 'general',
    prerequisite: { level: 4 },
    variants: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    grants: { abilityBonus: 1, savingThrowProficiencyForChosen: true },
    repeatable: true
  },
  'skilled': {
    id: 'skilled', name: 'Skilled',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { skillOrToolProficiencies: 3 },
    repeatable: true
  },
  'tavern-brawler': {
    id: 'tavern-brawler', name: 'Tavern Brawler',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { improvisedWeaponDamage: '1d4', grappleAsBonusAction: true, unarmedStrikePush: true }
  },
  'chef': {
    id: 'chef', name: 'Chef',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { cooksUtensilsProficiency: true, shortRestExtraHealing: '1d8', snacksTempHp: 'profBonus' }
  },
  'magic-initiate-general': {
    id: 'magic-initiate-general', name: 'Magic Initiate',
    category: 'general',
    prerequisite: { level: 4 },
    variants: ['cleric', 'druid', 'wizard'],
    grants: {
      cantripsKnown: 2,
      level1Spell: 1,
      spellcastingAbility: 'choose:int|wis|cha'
    },
    repeatable: true
  },
  'piercer': {
    id: 'piercer', name: 'Piercer',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { abilityBonus: 1, abilityChoice: ['str', 'dex'], rerollOnePiercingDamageDiePerTurn: true, extraDieOnPiercingCrit: true }
  },
  'slasher': {
    id: 'slasher', name: 'Slasher',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { abilityBonus: 1, abilityChoice: ['str', 'dex'], slashingHitReducesSpeed: 10, slashingCritGivesDisadvantage: true }
  },
  'crusher': {
    id: 'crusher', name: 'Crusher',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { abilityBonus: 1, abilityChoice: ['str', 'con'], bludgeoningHitPushes5Ft: true, bludgeoningCritGrantsAdvantage: true }
  },
  'spell-sniper': {
    id: 'spell-sniper', name: 'Spell Sniper',
    category: 'general',
    prerequisite: { level: 4, spellcasting: true },
    grants: { attackRollSpellRangeDoubled: true, ignoreHalfAndThreeQuartersCoverOnSpells: true, bonusCantrip: 1 }
  },
  'skill-expert': {
    id: 'skill-expert', name: 'Skill Expert',
    category: 'general',
    prerequisite: { level: 4 },
    grants: { abilityBonus: 1, skillProficiency: 1, expertise: 1 },
    repeatable: true
  },
  'telekinetic': {
    id: 'telekinetic', name: 'Telekinetic',
    category: 'general',
    prerequisite: { level: 4 },
    grants: {
      abilityBonus: 1,
      abilityChoice: ['int', 'wis', 'cha'],
      mageHandCantrip: true,
      mageHandRangeBonus: 30,
      bonusActionShove5Ft: true
    }
  }
};
