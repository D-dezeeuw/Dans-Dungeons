// Sundermark — the two starter adventures, in the 2.6.0 pack format
// (src/adventures/schema.js is the contract; validateAdventure re-derives
// every intendedDifficulty claim through classifyEncounter, so the
// compositions below are pinned — change a monster and validation fails).
//
// Both are sized for the Quiet Stair party profile (4 × L3) and use SRD
// stat blocks for their encounters — the setting's THEMES are invented,
// the math rides verified registry entries. Treasure references the
// Treasury pack (mount `extraItems: TREASURY` alongside).

// ── The Singing Tower (~75 minutes) ─────────────────────────────────────
//
// A dead god's bell-tower outside Lantern Cross has started singing
// again, and everyone who hears a full verse walks toward it and does
// not stop. The Choir of the Second Dawn calls it a miracle; the
// magistrate calls it eleven missing farmhands.

const SINGING_TOWER_BEATS = [
  {
    id: 'beat.01.eleven-empty-beds',
    dramaticPurpose: 'Hook: the magistrate lays out the missing and what the Choir will not say about the song.',
    targetPlaytimeMinutes: 10,
    prerequisites: [],
    setRequiredFlags: ['st.commissioned'],
    preferredLocation: 'scene.magistrates-hall',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'authority', notes: 'pays in coin and in road-passage; afraid of the harvest' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.02.the-cantors-confession',
    dramaticPurpose: 'The Choir knows the verse is real: talk Illiane into admitting what the first rehearsal cost.',
    targetPlaytimeMinutes: 15,
    prerequisites: ['st.commissioned'],
    setRequiredFlags: ['st.learned-verse'],
    preferredLocation: 'scene.choir-loft',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'herald', notes: 'wants absolution more than secrecy — Influence, not steel' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.03.the-walking-road',
    dramaticPurpose: 'Follow the walkers: wisp-lights shepherd the entranced up the old processional road.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['st.learned-verse'],
    setRequiredFlags: ['st.reached-tower'],
    preferredLocation: 'scene.processional-road',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.04.the-last-verse',
    dramaticPurpose: 'In the bell-chamber the Tower Voice sings the last verse of a dead god\'s morning hymn — end the song, or finish it for her.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['st.reached-tower'],
    setRequiredFlags: ['st.song-ended'],
    preferredLocation: 'scene.bell-chamber',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'antagonist', notes: 'she is grief, not malice; a finished hymn also ends her' }],
    boundEntities: {},
    successors: []
  }
];

const SINGING_TOWER_SCENES = [
  {
    id: 'scene.magistrates-hall',
    title: "The Magistrate's Hall",
    beatId: 'beat.01.eleven-empty-beds',
    readAloud: 'Magistrate Tallow has the shutters nailed and wax in a bowl by the door — for your ears, he says. Eleven farmhands gone up the hill in nine days. The Choir calls it pilgrimage. The families call it at his window every dawn.',
    cast: ['magistrate-oren-tallow'],
    objectives: [{ flag: 'st.commissioned', description: 'Take the magistrate\'s commission' }],
    exits: [{ to: 'scene.choir-loft', label: 'Put the question to the Choir', requiresFlag: 'st.commissioned' }]
  },
  {
    id: 'scene.choir-loft',
    title: 'The Choir Loft',
    beatId: 'beat.02.the-cantors-confession',
    readAloud: 'Cantor Illiane rehearses a hymn with no words — she stopped writing them down after the first rehearsal, when three singers finished the verse and walked out the door with their eyes shining.',
    cast: ['cantor-illiane'],
    objectives: [{ flag: 'st.learned-verse', description: 'Learn what the verse is and what it costs' }],
    exits: [{ to: 'scene.processional-road', label: 'Take the old processional road', requiresFlag: 'st.learned-verse' }]
  },
  {
    id: 'scene.processional-road',
    title: 'The Processional Road',
    beatId: 'beat.03.the-walking-road',
    readAloud: 'The road up the tor was built for ten thousand pilgrims and holds eleven sleepwalkers. Wisp-lights drift at the verges like ushers, and the shadows between them have learned to carry the slow ones.',
    cast: [],
    objectives: [{ flag: 'st.reached-tower', description: 'Reach the tower with the walkers unharmed' }],
    encounter: {
      monsters: [{ id: 'will-o-wisp', count: 1 }, { id: 'shadow', count: 2 }],
      // 450 + 100 + 100 = 650 XP — 'low' for 4 × L3 (budgets 600/900/1600).
      intendedDifficulty: 'low'
    },
    exits: [{ to: 'scene.bell-chamber', label: 'Climb to the bell-chamber', requiresFlag: 'st.reached-tower' }]
  },
  {
    id: 'scene.bell-chamber',
    title: 'The Bell-Chamber',
    beatId: 'beat.04.the-last-verse',
    readAloud: 'The bell is cracked and sings anyway. Around it stand the eleven, swaying, mouths open on the note they walked here holding. And in the bell\'s shadow: the Tower Voice, singing a dead god\'s morning hymn one verse from its end.',
    cast: ['the-tower-voice'],
    objectives: [{ flag: 'st.song-ended', description: 'End the song — by breaking it, or by finishing it' }],
    encounter: {
      // The Voice, an usher-light, and the old bell-ringer still at his rope.
      monsters: [{ id: 'banshee', count: 1 }, { id: 'will-o-wisp', count: 1 }, { id: 'skeleton', count: 1 }],
      // 1100 + 450 + 50 = 1600 XP — 'high' EXACTLY for 4 × L3, the same
      // pinned composition trick the Quiet Stair climax uses.
      intendedDifficulty: 'high'
    },
    treasure: ['candle-of-the-honest-hour', 'lodestar-compass', { coins: { gp: 150 } }],
    exits: []
  }
];

const SINGING_TOWER_NPCS = Object.freeze({
  'magistrate-oren-tallow': {
    id: 'magistrate-oren-tallow', name: 'Magistrate Oren Tallow',
    archetypeRole: 'authority',
    voice: ['florid', 'signs the air when nervous'],
    wants: ['the farmhands home before harvest', 'the Choir out of his jurisdiction'],
    statBlockId: null
  },
  'cantor-illiane': {
    id: 'cantor-illiane', name: 'Cantor Illiane',
    archetypeRole: 'herald',
    voice: ['musical', 'finishes sentences a third above where they started'],
    wants: ['the Second Dawn sung into being', 'forgiveness for the first rehearsal'],
    statBlockId: null
  },
  'the-tower-voice': {
    id: 'the-tower-voice', name: 'The Tower Voice',
    archetypeRole: 'antagonist',
    voice: ['a hymn where speech should be', 'grief pitched as song'],
    wants: ['the morning hymn finished', 'the god it woke for to answer one more dawn'],
    // The antagonist IS the climax monster — the Quiet Stair pattern.
    statBlockId: 'banshee'
  }
});

export const THE_SINGING_TOWER = Object.freeze({
  id: 'the-singing-tower',
  title: 'The Singing Tower',
  estimatedMinutes: 75,
  partyProfile: { size: 4, levels: [3, 3, 3, 3] },
  start: 'scene.magistrates-hall',
  beats: SINGING_TOWER_BEATS,
  scenes: SINGING_TOWER_SCENES,
  npcs: SINGING_TOWER_NPCS
});

// ── Halberd's Edge (~75 minutes) ────────────────────────────────────────
//
// The Choir's prototype god-vessel has a heartbeat, and the paladin
// guarding it swore her oath to a god she now hears knocking. Named for
// the question it asks: an oath is an edge — which way does it cut?

const HALBERDS_EDGE_BEATS = [
  {
    id: 'beat.01.the-knock',
    dramaticPurpose: 'Hook: the Knight of Memory admits the vessel knocks at night, and that she has started answering.',
    targetPlaytimeMinutes: 15,
    prerequisites: [],
    setRequiredFlags: ['he.sworn-in'],
    preferredLocation: 'scene.vigil-hall',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'mentor', notes: 'her oath is the adventure\'s spine; she needs witnesses, not rescuers' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.02.the-choirs-ledger',
    dramaticPurpose: 'What went into the vessel: bought relics, mined heaven-bone — and one thing the ledger refuses to name.',
    targetPlaytimeMinutes: 15,
    prerequisites: ['he.sworn-in'],
    setRequiredFlags: ['he.read-ledger'],
    preferredLocation: 'scene.matins-archive',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'herald', notes: 'Illiane again — she signed for the unnamed line' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.03.the-choir-militant',
    dramaticPurpose: 'The Choir moves the wake-date up to tonight; its soldiers hold the shrine stair against everyone, witnesses included.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['he.read-ledger'],
    setRequiredFlags: ['he.reached-shrine'],
    preferredLocation: 'scene.shrine-stair',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.04.the-wake',
    dramaticPurpose: 'The vessel opens its eyes. What looks out is not a god — decide, with the Knight, what happens to it.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['he.reached-shrine'],
    setRequiredFlags: ['he.vessel-decided'],
    preferredLocation: 'scene.the-cradle',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'mentor', notes: 'her oath decides the ending; the party decides her' }],
    boundEntities: {},
    successors: []
  }
];

const HALBERDS_EDGE_SCENES = [
  {
    id: 'scene.vigil-hall',
    title: 'The Vigil Hall',
    beatId: 'beat.01.the-knock',
    readAloud: 'The Knight of Memory keeps her vigil beside a shape under oilcloth, halberd grounded, and speaks of her dead god in the present tense — deliberately, like holding a door. Last night, she says, something on the other side knocked back.',
    cast: ['the-knight-of-memory'],
    objectives: [{ flag: 'he.sworn-in', description: 'Be sworn as witnesses to the vigil' }],
    exits: [{ to: 'scene.matins-archive', label: 'Search the Choir\'s ledgers', requiresFlag: 'he.sworn-in' }]
  },
  {
    id: 'scene.matins-archive',
    title: 'The Matins Archive',
    beatId: 'beat.02.the-choirs-ledger',
    readAloud: 'The Choir accounts for everything: relics by weight, heaven-bone by the dram, faith by the attendance sheet. One acquisition line is written in wax instead of ink, so it can be melted out of the record. Illiane\'s seal is on it.',
    cast: ['cantor-illiane'],
    objectives: [{ flag: 'he.read-ledger', description: 'Learn what the wax line bought' }],
    exits: [{ to: 'scene.shrine-stair', label: 'Reach the shrine before the wake', requiresFlag: 'he.read-ledger' }]
  },
  {
    id: 'scene.shrine-stair',
    title: 'The Shrine Stair',
    beatId: 'beat.03.the-choir-militant',
    readAloud: 'The Choir Militant holds the stair in parade order — a veteran of the god-wars at the landing and a scout on the wall above, both singing the processional under their breath. Orders are orders: no one attends the wake uninvited.',
    cast: [],
    objectives: [{ flag: 'he.reached-shrine', description: 'Win or talk your way up the stair' }],
    encounter: {
      monsters: [{ id: 'veteran', count: 1 }, { id: 'scout', count: 1 }],
      // 700 + 100 = 800 XP — 'low' for 4 × L3; the real fight is upstairs.
      intendedDifficulty: 'low'
    },
    exits: [{ to: 'scene.the-cradle', label: 'Enter the cradle-shrine', requiresFlag: 'he.reached-shrine' }]
  },
  {
    id: 'scene.the-cradle',
    title: 'The Cradle',
    beatId: 'beat.04.the-wake',
    readAloud: 'The vessel sits up. Relic-bone and braided prayer, stitched into the shape of an answer — and it moves like a question. The Knight of Memory sets her halberd\'s edge against its throat, and waits to find out which oath she meant.',
    cast: ['the-knight-of-memory', 'the-vessel'],
    objectives: [{ flag: 'he.vessel-decided', description: 'Decide the vessel\'s fate, and the Knight\'s' }],
    encounter: {
      monsters: [{ id: 'flesh-golem', count: 1 }],
      // 1800 XP — past the 1600 'high' budget for 4 × L3: honestly
      // 'deadly'. The scene offers the Knight and a bargain precisely
      // because fighting the vessel head-on should frighten a table.
      intendedDifficulty: 'deadly'
    },
    treasure: ['inkwell-of-small-confessions', { coins: { gp: 100 } }],
    exits: []
  }
];

const HALBERDS_EDGE_NPCS = Object.freeze({
  'the-knight-of-memory': {
    id: 'the-knight-of-memory', name: 'The Knight of Memory',
    archetypeRole: 'mentor',
    voice: ['steady', 'speaks of her dead god in the present tense, deliberately'],
    wants: ['her oath kept though its object is gone', 'the vessel judged for what it is, not what it was built to be'],
    statBlockId: null
  },
  'cantor-illiane': {
    id: 'cantor-illiane', name: 'Cantor Illiane',
    archetypeRole: 'herald',
    voice: ['musical', 'finishes sentences a third above where they started'],
    wants: ['the Second Dawn sung into being', 'the wax line never read aloud'],
    statBlockId: null
  },
  'the-vessel': {
    id: 'the-vessel', name: 'The Vessel',
    archetypeRole: 'antagonist',
    voice: ['a chord of borrowed prayers', 'asks what it is, repeatedly'],
    wants: ['to be someone\'s answer', 'not to be unmade before it finds out whose'],
    statBlockId: 'flesh-golem'
  }
});

export const HALBERDS_EDGE = Object.freeze({
  id: 'halberds-edge',
  title: "Halberd's Edge",
  estimatedMinutes: 75,
  partyProfile: { size: 4, levels: [3, 3, 3, 3] },
  start: 'scene.vigil-hall',
  beats: HALBERDS_EDGE_BEATS,
  scenes: HALBERDS_EDGE_SCENES,
  npcs: HALBERDS_EDGE_NPCS
});

export const SUNDERMARK_ADVENTURES = Object.freeze({
  'the-singing-tower': THE_SINGING_TOWER,
  'halberds-edge': HALBERDS_EDGE,
});
