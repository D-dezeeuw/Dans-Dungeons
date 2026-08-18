// The Origin pack — 5 invented species, 8 invented backgrounds, 12
// invented feats: distinct origins, not SRD recolors, back-filling the
// 1.13 deferral. Each species exercises a species-trait mechanic the
// sheet deriver actually consumes — darkvision depth, damage resistance,
// an extra movement mode (swim / climb / fly), or a racial cantrip
// (shipped as `effects.cantripId` DATA referencing a real spell id; the
// host grants the spell, the engine validates the reference).
//
// Backgrounds follow the SRD 5.2 shape exactly (three ability bumps, two
// skills, a tool, an Origin Feat) — but their Origin Feats are this
// pack's own. Feats split 6 origin / 4 general / 2 epic boons; `grants`
// carries structured flags for the host loop, same contract as the SRD
// three.
//
// Same rules as every content pack (docs/legal.md; swept by
// tests/legal.test.js). Mount via `createEngine({ extraSpecies:
// ORIGIN_SPECIES, extraBackgrounds: ORIGIN_BACKGROUNDS, extraFeats:
// ORIGIN_FEATS })` — the SRD registries stay SRD-only.

const E = (e) => Object.freeze(e);

export const ORIGIN_SPECIES = Object.freeze({
  emberkin: {
    id: 'emberkin', name: 'Emberkin', size: 'medium', speed: 30,
    traits: ['Cinder Blood', 'Racial Cantrip: Fire Bolt', 'Warm Even Here'],
    effects: E({
      darkvisionFt: 0,
      damageResistances: Object.freeze(['fire']),
      cantripId: 'fire-bolt',
      flags: E({ cinderBlood: true, warmEvenHere: true })
    })
  },
  tidefolk: {
    id: 'tidefolk', name: 'Tidefolk', size: 'medium', speed: 30,
    traits: ['Swim 30ft', 'Hour of Held Breath', 'Salt-Sighted'],
    effects: E({
      darkvisionFt: 60,
      extraSpeeds: E({ swim: 30 }),
      flags: E({ hourOfHeldBreath: true, saltSighted: true })
    })
  },
  'crag-kin': {
    id: 'crag-kin', name: 'Crag-Kin', size: 'medium', speed: 30,
    traits: ['Climb 30ft', 'Sure Anchor', 'Weathered'],
    effects: E({
      darkvisionFt: 60,
      extraSpeeds: E({ climb: 30 }),
      flags: E({ sureAnchor: true, weathered: true })
    })
  },
  hollowed: {
    id: 'hollowed', name: 'Hollowed', size: 'medium', speed: 30,
    traits: ['Darkvision 120ft', 'Half a Step Beyond', 'Grave-Calm'],
    effects: E({
      darkvisionFt: 120,
      damageResistances: Object.freeze(['necrotic']),
      flags: E({ halfAStepBeyond: true, graveCalm: true })
    })
  },
  zephyrine: {
    id: 'zephyrine', name: 'Zephyrine', size: 'small', speed: 30,
    traits: ['Fly 30ft (no heavy armor)', 'Hollow Bones', 'Weather-Wise'],
    effects: E({
      darkvisionFt: 0,
      extraSpeeds: E({ fly: 30 }),
      flags: E({ hollowBones: true, weatherWise: true, flightBarredInHeavyArmor: true })
    })
  },
});

export const ORIGIN_BACKGROUNDS = Object.freeze({
  'tide-runner': {
    id: 'tide-runner', name: 'Tide Runner',
    abilityScores: ['str', 'dex', 'wis'],
    skillProficiencies: ['athletics', 'survival'],
    toolProficiency: 'navigators-tools',
    originFeat: { id: 'tide-reader' }
  },
  'reliquary-clerk': {
    id: 'reliquary-clerk', name: 'Reliquary Clerk',
    abilityScores: ['int', 'wis', 'cha'],
    skillProficiencies: ['history', 'religion'],
    toolProficiency: 'calligrapher-supplies',
    originFeat: { id: 'keen-reckoner' }
  },
  'ashfield-farmer': {
    id: 'ashfield-farmer', name: 'Ashfield Farmer',
    abilityScores: ['str', 'con', 'wis'],
    skillProficiencies: ['animal-handling', 'nature'],
    toolProficiency: 'herbalism-kit',
    originFeat: { id: 'hearth-warden' }
  },
  'lantern-keeper': {
    id: 'lantern-keeper', name: 'Lantern Keeper',
    abilityScores: ['con', 'wis', 'cha'],
    skillProficiencies: ['insight', 'perception'],
    toolProficiency: 'tinkers-tools',
    originFeat: { id: 'bell-tuned' }
  },
  'road-magistrate': {
    id: 'road-magistrate', name: 'Road Magistrate',
    abilityScores: ['int', 'wis', 'cha'],
    skillProficiencies: ['insight', 'persuasion'],
    toolProficiency: 'cartographers-tools',
    originFeat: { id: 'road-wise' }
  },
  'bone-setter': {
    id: 'bone-setter', name: 'Bone-Setter',
    abilityScores: ['dex', 'int', 'wis'],
    skillProficiencies: ['medicine', 'sleight-of-hand'],
    toolProficiency: 'healers-kit',
    originFeat: { id: 'iron-lungs' }
  },
  'fen-guide': {
    id: 'fen-guide', name: 'Fen Guide',
    abilityScores: ['dex', 'con', 'wis'],
    skillProficiencies: ['stealth', 'survival'],
    toolProficiency: 'herbalism-kit',
    originFeat: { id: 'tide-reader' }
  },
  'bell-founder': {
    id: 'bell-founder', name: 'Bell-Founder',
    abilityScores: ['str', 'con', 'int'],
    skillProficiencies: ['athletics', 'investigation'],
    toolProficiency: 'smiths-tools',
    originFeat: { id: 'bell-tuned' }
  },
});

export const ORIGIN_FEATS = Object.freeze({
  // ── Origin feats (6) — the ones the backgrounds grant ─────────────────
  'tide-reader': {
    id: 'tide-reader', name: 'Tide Reader', category: 'origin',
    grants: {
      advantageOnSkill: 'survival',
      neverLostByWater: true
    }
  },
  'keen-reckoner': {
    id: 'keen-reckoner', name: 'Keen Reckoner', category: 'origin',
    grants: {
      advantageOnSkill: 'investigation',
      perfectRecallDays: 30
    }
  },
  'hearth-warden': {
    id: 'hearth-warden', name: 'Hearth Warden', category: 'origin',
    grants: {
      bonusHpPerLevel: 1,
      restfulCampFlag: true
    }
  },
  'bell-tuned': {
    id: 'bell-tuned', name: 'Bell-Tuned', category: 'origin',
    grants: {
      advantageOnSkill: 'perception',
      hearThroughDoors: true
    }
  },
  'road-wise': {
    id: 'road-wise', name: 'Road-Wise', category: 'origin',
    grants: {
      travelPaceBonus: 'fast-without-penalty',
      advantageOnSkill: 'insight'
    }
  },
  'iron-lungs': {
    id: 'iron-lungs', name: 'Iron Lungs', category: 'origin',
    grants: {
      holdBreathMinutes: 30,
      advantageVsInhaled: true
    }
  },
  // ── General feats (4) ─────────────────────────────────────────────────
  'shield-splitter': {
    id: 'shield-splitter', name: 'Shield-Splitter', category: 'general',
    prerequisite: { abilityMin: { str: 13 } },
    grants: {
      ignoreShieldAcOncePerTurn: true,
      abilityIncrease: 'choose:str|con'
    }
  },
  'spell-braider': {
    id: 'spell-braider', name: 'Spell-Braider', category: 'general',
    prerequisite: { spellcaster: true },
    grants: {
      swapCantripOnLongRest: true,
      abilityIncrease: 'choose:int|wis|cha'
    }
  },
  'stalwart-anchor': {
    id: 'stalwart-anchor', name: 'Stalwart Anchor', category: 'general',
    prerequisite: { abilityMin: { con: 13 } },
    grants: {
      advantageVsForcedMovement: true,
      abilityIncrease: 'con'
    }
  },
  'fleet-of-purpose': {
    id: 'fleet-of-purpose', name: 'Fleet of Purpose', category: 'general',
    grants: {
      speedBonusFt: 5,
      dashAsBonusActionOncePerRest: true
    }
  },
  // ── Epic boons (2) — L19+, same contract as the SRD boons ─────────────
  'boon-of-the-unbroken-hour': {
    id: 'boon-of-the-unbroken-hour', name: 'Boon of the Unbroken Hour',
    category: 'epic-boon',
    prerequisite: { levelMin: 19 },
    grants: {
      extraReactionPerRound: true,
      abilityIncrease: 'choose:any'
    }
  },
  'boon-of-the-deep-root': {
    id: 'boon-of-the-deep-root', name: 'Boon of the Deep Root',
    category: 'epic-boon',
    prerequisite: { levelMin: 19 },
    grants: {
      regainHpAtStartOfTurnWhileBloodied: '1d10',
      abilityIncrease: 'choose:str|con'
    }
  },
});
