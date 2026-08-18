// Brassgear — hooks, cast, and the starter adventure.
//
// Ten noir hooks (a job, a client with an angle, a payout that costs
// more than it says) and The Greenmist Heist: one last job into the
// fen-vault where House Fenn keeps the schematic that could restart
// the engines — or finish draining the world to do it.

export const BRASSGEAR_HOOKS = Object.freeze({
  'the-sixth-gauge': Object.freeze({
    id: 'the-sixth-gauge', title: 'The Sixth Gauge',
    cityId: 'brasswork-city', factionId: 'the-house-concord',
    pitch: 'The capital\'s pressure gauge reads a sixth and falling — but the flow ledgers say it should read a fifth. Someone is siphoning a city\'s share of magic, and the Concord wants it found before the lamps notice.',
    reward: 'concord-scrip-and-a-license',
  }),
  'the-heirloom-audit': Object.freeze({
    id: 'the-heirloom-audit', title: 'The Heirloom Audit',
    cityId: 'brasswork-city', factionId: 'the-house-concord',
    pitch: 'House Marrow is bankrupt enough to sell its talent — literally: a black-market clinic claims it can cut the Ledgerhand out of a scion and stitch it into a buyer.',
    reward: 'a-house-heirloom',
  }),
  'the-honest-forgery': Object.freeze({
    id: 'the-honest-forgery', title: 'The Honest Forgery',
    cityId: 'gutterlight-yards', factionId: 'the-scrap-barons',
    pitch: 'A forger in the Yards sells counterfeit charge-cells that work BETTER than the real ones. The Barons want his supplier; the Concord wants him disappeared; he wants a way out of both.',
    reward: 'a-crate-of-the-good-cells',
  }),
  'the-lift-that-fell': Object.freeze({
    id: 'the-lift-that-fell', title: 'The Lift That Fell',
    cityId: 'gutterlight-yards', factionId: 'the-scrap-barons',
    pitch: 'The Number Nine lift fell forty floors with a scrap baron\'s rival aboard, and the brake-charm\'s memory survived. Everyone wants the charm; nobody wants it read aloud.',
    reward: 'baron-favor-or-baron-bounty',
  }),
  'the-sealed-envelope': Object.freeze({
    id: 'the-sealed-envelope', title: 'The Sealed Envelope',
    cityId: 'exchange-harbor', factionId: 'the-neutrality-office',
    pitch: 'A courier died at the harbor gate holding an envelope sealed with a talent nobody has had since the war. The Office wants it delivered unopened. The address is a mass grave.',
    reward: 'neutral-papers-for-life',
  }),
  'the-defectors-price': Object.freeze({
    id: 'the-defectors-price', title: "The Defector's Price",
    cityId: 'exchange-harbor', factionId: 'the-neutrality-office',
    pitch: 'A Concord engine-master wants to defect to nowhere — just out. Her head is full of shutdown codes three governments would burn the port to own.',
    reward: 'her-second-copy-of-the-codes',
  }),
  'the-unspent-shell': Object.freeze({
    id: 'the-unspent-shell', title: 'The Unspent Shell',
    cityId: 'the-quay-camps', factionId: 'the-reclamation-crews',
    pitch: 'The reclamation crews found an intact war-shell in the quay mud — a city-killer with eleven years of interest on its fuse. Warden Tache needs it moved. Quietly. Tonight.',
    reward: 'reclamation-shares',
  }),
  'the-armistice-hour': Object.freeze({
    id: 'the-armistice-hour', title: 'The Armistice Hour',
    cityId: 'the-quay-camps', factionId: 'the-reclamation-crews',
    pitch: 'Every year at the armistice hour, the burned arsenal relights for nine minutes — every lamp, every engine, every alarm. This year a silhouette walked the wall. The crews want to know who keeps the appointment.',
    reward: 'first-salvage-rights',
  }),
  'the-greenmist-heist-hook': Object.freeze({
    id: 'the-greenmist-heist-hook', title: 'The Greenmist Heist',
    cityId: 'fenworks', factionId: 'the-harvest-combine',
    pitch: 'House Fenn\'s fen-vault holds the Reservoir Schematic — the plan that could restart the engines, or finish draining the world to do it. A buyer wants it lifted before the Combine\'s quota inspectors arrive.',
    reward: 'a-tenth-of-the-buyers-price',
    adventureId: 'the-greenmist-heist',
  }),
  'the-quota-riot': Object.freeze({
    id: 'the-quota-riot', title: 'The Quota Riot',
    cityId: 'fenworks', factionId: 'the-harvest-combine',
    pitch: 'The Combine raised the harvest quota past what the fen can give without waking it. The farmers know. The Combine\'s actuaries know. The fen, lately, appears to know.',
    reward: 'the-farmers-tithe',
  }),
});

// Factions referenced by hooks and cast — Brassgear powers are
// corporate where Sundermark's were creedal.
export const BRASSGEAR_FACTIONS = Object.freeze({
  'the-house-concord': Object.freeze({
    id: 'the-house-concord', name: 'The House Concord',
    stance: 'ration-the-decline', seat: 'brasswork-city',
    wants: 'the pressure falling slowly enough that they die rich',
    enemies: Object.freeze(['the-scrap-barons']),
  }),
  'the-scrap-barons': Object.freeze({
    id: 'the-scrap-barons', name: 'The Scrap Barons',
    stance: 'strip-it-for-parts', seat: 'gutterlight-yards',
    wants: 'the capital condemned and sold to them by the ton',
    enemies: Object.freeze(['the-house-concord']),
  }),
  'the-neutrality-office': Object.freeze({
    id: 'the-neutrality-office', name: 'The Neutrality Office',
    stance: 'never-choose', seat: 'exchange-harbor',
    wants: 'every side owing the port too much to burn it',
    enemies: Object.freeze([]),
  }),
  'the-reclamation-crews': Object.freeze({
    id: 'the-reclamation-crews', name: 'The Reclamation Crews',
    stance: 'defuse-the-past', seat: 'the-quay-camps',
    wants: 'the war\'s leftovers rendered safe before someone renders them useful',
    enemies: Object.freeze(['the-harvest-combine']),
  }),
  'the-harvest-combine': Object.freeze({
    id: 'the-harvest-combine', name: 'The Harvest Combine',
    stance: 'farm-the-spill', seat: 'fenworks',
    wants: 'the greenmist harvest scaled until the ledgers balance, fen be damned',
    enemies: Object.freeze(['the-reclamation-crews']),
  }),
});

export const BRASSGEAR_NPCS = Object.freeze({
  'chairwoman-brandt': Object.freeze({
    id: 'chairwoman-brandt', name: 'Chairwoman Brandt',
    archetypeRole: 'authority',
    voice: Object.freeze(['boardroom-warm', 'ends meetings by standing']),
    wants: Object.freeze(['the decline managed', 'her house\'s talent kept off the market']),
    factionId: 'the-house-concord', cityId: 'brasswork-city',
    statBlockId: null,
  }),
  'baron-null': Object.freeze({
    id: 'baron-null', name: 'Baron Null',
    archetypeRole: 'fixer',
    voice: Object.freeze(['scrap-yard drawl', 'weighs things by hefting them mid-sentence']),
    wants: Object.freeze(['the capital by the ton', 'his rivals\' brake-charms read aloud']),
    factionId: 'the-scrap-barons', cityId: 'gutterlight-yards',
    statBlockId: null,
  }),
  'the-registrar': Object.freeze({
    id: 'the-registrar', name: 'The Registrar',
    archetypeRole: 'informant',
    voice: Object.freeze(['stamped-flat', 'answers questions with form numbers']),
    wants: Object.freeze(['the port neutral', 'one envelope in particular never opened']),
    factionId: 'the-neutrality-office', cityId: 'exchange-harbor',
    statBlockId: null,
  }),
  'reclamation-warden-tache': Object.freeze({
    id: 'reclamation-warden-tache', name: 'Reclamation Warden Tache',
    archetypeRole: 'authority',
    voice: Object.freeze(['bomb-squad calm', 'counts before answering']),
    wants: Object.freeze(['the shell out of the mud', 'nobody learning what its fuse is set to']),
    factionId: 'the-reclamation-crews', cityId: 'the-quay-camps',
    statBlockId: null,
  }),
  'actuary-fenn': Object.freeze({
    id: 'actuary-fenn', name: 'Actuary Fenn',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['quota-polite', 'apologizes before each threat']),
    wants: Object.freeze(['the ledgers balanced', 'the schematic secured before the buyer\'s crew arrives']),
    factionId: 'the-harvest-combine', cityId: 'fenworks',
    statBlockId: null,
  }),
  'mireless-jonn': Object.freeze({
    id: 'mireless-jonn', name: 'Mireless Jonn',
    archetypeRole: 'informant',
    voice: Object.freeze(['fen-quiet', 'names every mist-shape before it fades']),
    wants: Object.freeze(['the fen left what it is', 'his daughter\'s harvest debt burned']),
    factionId: 'the-harvest-combine', cityId: 'fenworks',
    statBlockId: null,
  }),
});

// ── The Greenmist Heist (~75 minutes, 4 × L3) ───────────────────────────

const HEIST_BEATS = [
  {
    id: 'beat.01.the-buyers-terms',
    dramaticPurpose: 'Take the job: the buyer\'s agent lays out the vault, the fee, and the one thing nobody may ask — who\'s buying.',
    targetPlaytimeMinutes: 10,
    prerequisites: [],
    setRequiredFlags: ['gh.hired'],
    preferredLocation: 'scene.the-wet-ledger',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'fixer', notes: 'the agent pays well and lies better' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.02.the-fen-guides-price',
    dramaticPurpose: 'Only Jonn knows the mist-paths. His price isn\'t money: his daughter\'s harvest debt, burned before the books close.',
    targetPlaytimeMinutes: 15,
    prerequisites: ['gh.hired'],
    setRequiredFlags: ['gh.guided'],
    preferredLocation: 'scene.stilt-row',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'informant', notes: 'the mist listens to him; make him want to help' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.03.the-mist-crossing',
    dramaticPurpose: 'Cross the greenmist: the fen grows things that remember being spells, and the quota patrol hunts trespassers.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['gh.guided'],
    setRequiredFlags: ['gh.at-the-vault'],
    preferredLocation: 'scene.the-drowned-orchard',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.04.the-vault-floor',
    dramaticPurpose: 'The vault: the schematic hangs in a mist-lock, the actuary arrives with the quota muscle, and the buyer\'s name is on the receipt.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['gh.at-the-vault'],
    setRequiredFlags: ['gh.schematic-decided'],
    preferredLocation: 'scene.the-fen-vault',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'antagonist', notes: 'she\'d rather buy you than fight you; the mist disagrees' }],
    boundEntities: {},
    successors: []
  }
];

const HEIST_SCENES = [
  {
    id: 'scene.the-wet-ledger',
    title: 'The Wet Ledger',
    beatId: 'beat.01.the-buyers-terms',
    readAloud: 'The tavern floats, technically. The buyer\'s agent has a corner table, a fee in Concord scrip, and a map of House Fenn\'s vault drawn from memory — whose memory, the fee says not to ask.',
    cast: ['baron-null'],
    objectives: [{ flag: 'gh.hired', description: 'Take the job on the buyer\'s terms' }],
    exits: [{ to: 'scene.stilt-row', label: 'Find the fen guide on Stilt Row', requiresFlag: 'gh.hired' }]
  },
  {
    id: 'scene.stilt-row',
    title: 'Stilt Row',
    beatId: 'beat.02.the-fen-guides-price',
    readAloud: 'Mireless Jonn mends a net that catches things nets shouldn\'t need to. He\'ll walk you in — for a page torn from the Combine\'s debt book, and your word that what you\'re stealing makes the pumps stop, not go faster.',
    cast: ['mireless-jonn'],
    objectives: [{ flag: 'gh.guided', description: 'Win Jonn\'s guidance at his price' }],
    exits: [{ to: 'scene.the-drowned-orchard', label: 'Enter the greenmist', requiresFlag: 'gh.guided' }]
  },
  {
    id: 'scene.the-drowned-orchard',
    title: 'The Drowned Orchard',
    beatId: 'beat.03.the-mist-crossing',
    readAloud: 'The orchard drowned standing up, and the mist ripens what the trees still carry. Something ahead babbles in a hundred half-cast cantrips, and lights that are not lanterns drift closer, curious.',
    cast: [],
    objectives: [{ flag: 'gh.at-the-vault', description: 'Reach the vault stair with the guide alive' }],
    encounter: {
      monsters: [{ id: 'gibbering-mouther', count: 1 }, { id: 'will-o-wisp', count: 1 }, { id: 'shadow', count: 1 }],
      // 450 + 450 + 100 = 1000 XP — 'moderate' for 4 × L3.
      intendedDifficulty: 'moderate'
    },
    exits: [{ to: 'scene.the-fen-vault', label: 'Descend to the vault floor', requiresFlag: 'gh.at-the-vault' }]
  },
  {
    id: 'scene.the-fen-vault',
    title: 'The Fen-Vault',
    beatId: 'beat.04.the-vault-floor',
    readAloud: 'The schematic hangs in a lock made of held mist. Actuary Fenn arrives with the quota muscle and an offer, terribly reasonable: sell it to the Combine instead, and the fen only dies at the CONTRACTED rate. The receipt on the lock already carries the buyer\'s name. You know it.',
    cast: ['actuary-fenn'],
    objectives: [{ flag: 'gh.schematic-decided', description: 'Decide who gets the Reservoir Schematic — or whether anyone does' }],
    encounter: {
      monsters: [{ id: 'bandit-captain', count: 1 }, { id: 'cult-fanatic', count: 1 }, { id: 'bandit', count: 2 }],
      // 450 + 450 + 25 + 25 = 950 XP — 'moderate' for 4 × L3. A heist
      // finale about the choice, not the body count.
      intendedDifficulty: 'moderate'
    },
    treasure: ['sparrow-whistle', { coins: { gp: 200 } }],
    exits: []
  }
];

const HEIST_NPCS = Object.freeze({
  'baron-null': {
    id: 'baron-null', name: 'Baron Null',
    archetypeRole: 'fixer',
    voice: ['scrap-yard drawl', 'weighs things by hefting them mid-sentence'],
    wants: ['the job done deniably', 'the schematic\'s buyer kept three cutouts away'],
    statBlockId: null
  },
  'mireless-jonn': {
    id: 'mireless-jonn', name: 'Mireless Jonn',
    archetypeRole: 'informant',
    voice: ['fen-quiet', 'names every mist-shape before it fades'],
    wants: ['his daughter\'s harvest debt burned', 'the pumps stopped'],
    statBlockId: null
  },
  'actuary-fenn': {
    id: 'actuary-fenn', name: 'Actuary Fenn',
    archetypeRole: 'antagonist',
    voice: ['quota-polite', 'apologizes before each threat'],
    wants: ['the ledgers balanced', 'the schematic bought, not bled for — but bled for if it must be'],
    statBlockId: 'cult-fanatic'
  }
});

export const THE_GREENMIST_HEIST = Object.freeze({
  id: 'the-greenmist-heist',
  title: 'The Greenmist Heist',
  estimatedMinutes: 75,
  partyProfile: { size: 4, levels: [3, 3, 3, 3] },
  start: 'scene.the-wet-ledger',
  beats: HEIST_BEATS,
  scenes: HEIST_SCENES,
  npcs: HEIST_NPCS
});

export const BRASSGEAR_ADVENTURES = Object.freeze({
  'the-greenmist-heist': THE_GREENMIST_HEIST,
});
