// Sundermark — the named cast (12 NPCs) and the setting origins
// (1 species, 3 backgrounds, 5 feats).
//
// NPCs use the record shape the Quiet Stair established (id, name,
// archetypeRole ∈ Beats.ARCHETYPE_ROLES, voice tags, concrete wants,
// statBlockId or null) extended with the setting's binding fields:
// factionId and cityId, so a host can walk faction → seat → cast. The
// 2.6.0 decision that there is no kernel NPC registry is REVISED at
// 3.0.0 (that's part of why it's a major): setting packs need a door,
// and `extraNpcs` is it. The casting boundary itself stands — Beats
// still doesn't own the cast; the registry just holds it.

export const SUNDERMARK_NPCS = Object.freeze({
  'auditor-crane': Object.freeze({
    id: 'auditor-crane', name: 'Auditor Crane',
    archetypeRole: 'informant',
    voice: Object.freeze(['precise', 'counting on fingers while speaking']),
    wants: Object.freeze(['the tithe ledgers to balance', 'to survive having noticed they do not']),
    factionId: 'the-salvage-synod', cityId: 'saint-anchor',
    statBlockId: null,
  }),
  'harbormistress-vell': Object.freeze({
    id: 'harbormistress-vell', name: 'Harbormistress Vell',
    archetypeRole: 'authority',
    voice: Object.freeze(['gravel-calm', 'never repeats an order']),
    wants: Object.freeze(['her port neutral in the relic wars', 'her drowned son left where the sea put him']),
    factionId: 'the-drowned-congregation', cityId: 'the-shriven-port',
    statBlockId: null,
  }),
  'brother-hollowell': Object.freeze({
    id: 'brother-hollowell', name: 'Brother Hollowell',
    archetypeRole: 'mentor',
    voice: Object.freeze(['gentle', 'quotes prayers in the past tense']),
    wants: Object.freeze(['clerics taught to draw from relics without burning out', 'one honest funeral for the gods']),
    factionId: 'the-vesperin-conclave', cityId: 'the-listening-house',
    statBlockId: null,
  }),
  'prioress-ashvane': Object.freeze({
    id: 'prioress-ashvane', name: 'Prioress Ashvane',
    archetypeRole: 'authority',
    voice: Object.freeze(['measured', 'pauses as if listening to a second conversation']),
    wants: Object.freeze(['the last recording recovered unaltered', 'the Choir kept out of her archive']),
    factionId: 'the-vesperin-conclave', cityId: 'the-listening-house',
    statBlockId: null,
  }),
  'magistrate-oren-tallow': Object.freeze({
    id: 'magistrate-oren-tallow', name: 'Magistrate Oren Tallow',
    archetypeRole: 'authority',
    voice: Object.freeze(['florid', 'signs the air when nervous']),
    wants: Object.freeze(['the Toll War ended before harvest', 'nobody examining his lamp-oil contracts']),
    factionId: 'the-lantern-road-league', cityId: 'lantern-cross',
    statBlockId: null,
  }),
  'dame-serel-of-the-writ': Object.freeze({
    id: 'dame-serel-of-the-writ', name: 'Dame Serel of the Writ',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['courteous-cold', 'recites toll law like scripture']),
    wants: Object.freeze(['every road paying', 'an order that outlives its racket — she half-believes the dressing']),
    factionId: 'the-toll-knights', cityId: null,
    statBlockId: null,
  }),
  'cantor-illiane': Object.freeze({
    id: 'cantor-illiane', name: 'Cantor Illiane',
    archetypeRole: 'herald',
    voice: Object.freeze(['musical', 'finishes sentences a third above where they started']),
    wants: Object.freeze(['the Second Dawn sung into being', 'to be forgiven for what the first rehearsal cost']),
    factionId: 'the-choir-of-the-second-dawn', cityId: 'high-matins',
    statBlockId: null,
  }),
  'the-knight-of-memory': Object.freeze({
    id: 'the-knight-of-memory', name: 'The Knight of Memory',
    archetypeRole: 'mentor',
    voice: Object.freeze(['steady', 'speaks of her dead god in the present tense, deliberately']),
    wants: Object.freeze(['her oath kept though its object is gone', 'the god-vessel guarded from its own makers']),
    factionId: 'the-choir-of-the-second-dawn', cityId: 'high-matins',
    statBlockId: null,
  }),
  'foreman-grist': Object.freeze({
    id: 'foreman-grist', name: 'Foreman Grist',
    archetypeRole: 'fixer',
    voice: Object.freeze(['fast', 'prices things mid-sentence']),
    wants: Object.freeze(['the vein of grace surveyed and sold', 'his crew back from quarantine — they owe him shifts']),
    factionId: 'the-miracle-cartel', cityId: 'ossuary-gate',
    statBlockId: null,
  }),
  'sister-quiet': Object.freeze({
    id: 'sister-quiet', name: 'Sister Quiet',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['barely audible', 'lets silences answer for her']),
    wants: Object.freeze(['the Barrens still', 'the miners taught what rest means, one way or the other']),
    factionId: 'the-still-choirs', cityId: null,
    statBlockId: null,
  }),
  'warden-sylvex': Object.freeze({
    id: 'warden-sylvex', name: 'Warden Sylvex',
    archetypeRole: 'muscle',
    voice: Object.freeze(['blunt', 'smells faintly of smoke and argues like it']),
    wants: Object.freeze(['the rot burned back a mile a year', 'the Parliament to admit the Weald is sick']),
    factionId: 'the-verdigris-wardens', cityId: 'the-copper-bower',
    statBlockId: null,
  }),
  'the-winch-speaker': Object.freeze({
    id: 'the-winch-speaker', name: 'The Winch-Speaker',
    archetypeRole: 'informant',
    voice: Object.freeze(['nine voices in loose unison', 'refers to itself as "the shift"']),
    wants: Object.freeze(['to finish what crew nine started saying', 'not to be sent back down before it does']),
    factionId: 'the-depth-consortium', cityId: 'the-winch-town',
    statBlockId: null,
  }),
});

// ── Setting origins ─────────────────────────────────────────────────────

const E = (e) => Object.freeze(e);

// The Vesperin: bloodlines born in the monasteries that heard the gods
// die. Echo-marked — they remember sounds perfectly and the dark holds
// no silence for them.
export const SUNDERMARK_SPECIES = Object.freeze({
  vesperin: {
    id: 'vesperin', name: 'Vesperin', size: 'medium', speed: 30,
    traits: ['Darkvision 60ft', 'Perfect Echo', 'Grief-Tempered', 'Racial Cantrip: Message'],
    effects: E({
      darkvisionFt: 60,
      damageResistances: Object.freeze(['psychic']),
      cantripId: 'message',
      flags: E({ perfectEcho: true, griefTempered: true })
    })
  },
});

export const SUNDERMARK_BACKGROUNDS = Object.freeze({
  'relic-warden': {
    id: 'relic-warden', name: 'Relic Warden',
    abilityScores: ['str', 'wis', 'cha'],
    skillProficiencies: ['religion', 'perception'],
    toolProficiency: 'masons-tools',
    originFeat: { id: 'relic-touched' }
  },
  'candle-keeper': {
    id: 'candle-keeper', name: 'Candle Keeper',
    abilityScores: ['con', 'wis', 'cha'],
    skillProficiencies: ['insight', 'survival'],
    toolProficiency: 'chandlers-supplies',
    originFeat: { id: 'light-hoarder' }
  },
  'seance-clerk': {
    id: 'seance-clerk', name: 'Séance Clerk',
    abilityScores: ['int', 'wis', 'cha'],
    skillProficiencies: ['arcana', 'insight'],
    toolProficiency: 'calligrapher-supplies',
    originFeat: { id: 'listener-at-the-door' }
  },
});

export const SUNDERMARK_FEATS = Object.freeze({
  // Origin feats — the three the setting backgrounds grant.
  'relic-touched': {
    id: 'relic-touched', name: 'Relic-Touched', category: 'origin',
    grants: {
      senseRelicsFt: 30,
      advantageOnSkill: 'religion'
    }
  },
  'light-hoarder': {
    id: 'light-hoarder', name: 'Light-Hoarder', category: 'origin',
    grants: {
      lightSourcesBurnTwiceAsLong: true,
      advantageOnSkill: 'perception'
    }
  },
  'listener-at-the-door': {
    id: 'listener-at-the-door', name: 'Listener at the Door', category: 'origin',
    grants: {
      askTheDeadOncePerLongRest: true,
      advantageOnSkill: 'insight'
    }
  },
  // General feats — the setting's two table-changers.
  'oathkeeper-of-memory': {
    id: 'oathkeeper-of-memory', name: 'Oathkeeper of Memory', category: 'general',
    prerequisite: { classId: 'paladin' },
    grants: {
      oathObjectMayBeDead: true,
      auraPersistsAtZeroHp: true
    }
  },
  'heaven-bone-miner': {
    id: 'heaven-bone-miner', name: 'Heaven-Bone Miner', category: 'general',
    prerequisite: { abilityMin: { con: 13 } },
    grants: {
      resistMiracleFever: true,
      abilityIncrease: 'con'
    }
  },
});
