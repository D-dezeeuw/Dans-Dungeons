// Sundermark — the world layer: regions, cities, factions, story hooks.
//
// The first complete setting pack (3.0.0). High fantasy at continental
// scope with one defining twist: THE GODS HAVE DIED. Three centuries
// ago the Sundering killed every god in a single night. Clerics draw
// power from preserved relics; paladins swear oaths to memories;
// divination feels like a séance. Everything here is built around what
// gets left behind when the divine leaves.
//
// All names invented (docs/legal.md; swept by tests/legal.test.js).
// Regions and story hooks mount via the 3.0.0 plugin slots
// (`extraRegions`, `extraStoryHooks`); factions and cities are plain
// pack data (hosts and the worldgen client consume them directly).

export const SUNDERMARK_REGIONS = Object.freeze({
  'the-reliquary-coast': Object.freeze({
    id: 'the-reliquary-coast', name: 'The Reliquary Coast',
    biome: 'temperate-coast',
    summary: 'Drowned temple-cities and salvage fleets; the sea gives back one holy fragment at a time, and every one of them is worth killing for.',
    cities: Object.freeze(['saint-anchor', 'the-shriven-port']),
    dangers: Object.freeze(['relic-runners', 'the-tithe-galleys', 'grave-tides']),
  }),
  'the-candle-marches': Object.freeze({
    id: 'the-candle-marches', name: 'The Candle Marches',
    biome: 'farmland-borders',
    summary: 'The breadbasket between three crowns, lit by shrine-candles nobody dares let gutter — the dark between villages has learned to walk.',
    cities: Object.freeze(['wickfield', 'lantern-cross']),
    dangers: Object.freeze(['the-unlit', 'toll-knights', 'harvest-courts']),
  }),
  'the-throne-barrens': Object.freeze({
    id: 'the-throne-barrens', name: 'The Throne Barrens',
    biome: 'badlands',
    summary: 'Where the gods fell bodily: a desert of fused glass and heaven-bone, mined for miracle-ore by anyone desperate enough.',
    cities: Object.freeze(['ossuary-gate']),
    dangers: Object.freeze(['bone-storms', 'miracle-fever', 'the-still-choirs']),
  }),
  'the-vesper-heights': Object.freeze({
    id: 'the-vesper-heights', name: 'The Vesper Heights',
    biome: 'alpine',
    summary: 'Mountain monasteries that heard the gods die and wrote it down; the Vesperin bloodlines were born here, in the echo.',
    cities: Object.freeze(['the-listening-house', 'high-matins']),
    dangers: Object.freeze(['echo-slides', 'silence-cults', 'the-long-stair-bandits']),
  }),
  'the-verdigris-weald': Object.freeze({
    id: 'the-verdigris-weald', name: 'The Verdigris Weald',
    biome: 'old-forest',
    summary: 'A forest that swallowed a dead nature-god whole and has been digesting it for three hundred years; the green here does not need the sun.',
    cities: Object.freeze(['rootharrow', 'the-copper-bower']),
    dangers: Object.freeze(['god-rot', 'the-antler-parliament', 'verdigris-wardens']),
  }),
  'the-sunder-deep': Object.freeze({
    id: 'the-sunder-deep', name: 'The Sunder Deep',
    biome: 'underground',
    summary: 'The crack the Sundering left in the world\'s floor. Expeditions go down for heaven-bone and come back speaking in borrowed voices.',
    cities: Object.freeze(['the-winch-town']),
    dangers: Object.freeze(['borrowed-voices', 'depth-tolls', 'the-closing-dark']),
  }),
});

// Ten mapped cities. `hooks` reference SUNDERMARK_HOOKS ids so a host
// can walk city → hook → adventure without string-matching prose.
export const SUNDERMARK_CITIES = Object.freeze({
  'saint-anchor': Object.freeze({
    id: 'saint-anchor', name: 'Saint Anchor', regionId: 'the-reliquary-coast',
    size: 'city', ruler: 'the-salvage-synod',
    hooks: Object.freeze(['the-wet-reliquary', 'the-tithe-audit']),
  }),
  'the-shriven-port': Object.freeze({
    id: 'the-shriven-port', name: 'The Shriven Port', regionId: 'the-reliquary-coast',
    size: 'town', ruler: 'harbormistress-vell',
    hooks: Object.freeze(['the-empty-crate']),
  }),
  'wickfield': Object.freeze({
    id: 'wickfield', name: 'Wickfield', regionId: 'the-candle-marches',
    size: 'town', ruler: 'the-candle-council',
    hooks: Object.freeze(['the-guttering']),
  }),
  'lantern-cross': Object.freeze({
    id: 'lantern-cross', name: 'Lantern Cross', regionId: 'the-candle-marches',
    size: 'city', ruler: 'magistrate-oren-tallow',
    hooks: Object.freeze(['the-toll-war', 'the-singing-tower-hook']),
  }),
  'ossuary-gate': Object.freeze({
    id: 'ossuary-gate', name: 'Ossuary Gate', regionId: 'the-throne-barrens',
    size: 'city', ruler: 'the-miracle-cartel',
    hooks: Object.freeze(['the-vein-of-grace', 'miracle-fever-quarantine']),
  }),
  'the-listening-house': Object.freeze({
    id: 'the-listening-house', name: 'The Listening House', regionId: 'the-vesper-heights',
    size: 'town', ruler: 'prioress-ashvane',
    hooks: Object.freeze(['the-last-recording']),
  }),
  'high-matins': Object.freeze({
    id: 'high-matins', name: 'High Matins', regionId: 'the-vesper-heights',
    size: 'town', ruler: 'the-bell-warden',
    hooks: Object.freeze(['halberds-edge-hook']),
  }),
  'rootharrow': Object.freeze({
    id: 'rootharrow', name: 'Rootharrow', regionId: 'the-verdigris-weald',
    size: 'town', ruler: 'the-antler-parliament',
    hooks: Object.freeze(['the-god-rot-cure']),
  }),
  'the-copper-bower': Object.freeze({
    id: 'the-copper-bower', name: 'The Copper Bower', regionId: 'the-verdigris-weald',
    size: 'village', ruler: 'warden-sylvex',
    hooks: Object.freeze(['the-green-tithe']),
  }),
  'the-winch-town': Object.freeze({
    id: 'the-winch-town', name: 'The Winch Town', regionId: 'the-sunder-deep',
    size: 'town', ruler: 'the-depth-consortium',
    hooks: Object.freeze(['the-borrowed-voice']),
  }),
});

// Fifteen factions. `stance` is how they answer the setting's one
// question — what do you do with a dead god? — which is what makes any
// two of them able to conflict on sight.
export const SUNDERMARK_FACTIONS = Object.freeze({
  'the-salvage-synod': Object.freeze({
    id: 'the-salvage-synod', name: 'The Salvage Synod',
    stance: 'recover-and-ration', seat: 'saint-anchor',
    wants: 'every relic catalogued, priced and doled out by them alone',
    enemies: Object.freeze(['the-drowned-congregation', 'the-miracle-cartel']),
  }),
  'the-drowned-congregation': Object.freeze({
    id: 'the-drowned-congregation', name: 'The Drowned Congregation',
    stance: 'worship-the-remains', seat: 'the-shriven-port',
    wants: 'the sea-tombs sealed and the salvage fleets burned',
    enemies: Object.freeze(['the-salvage-synod']),
  }),
  'the-miracle-cartel': Object.freeze({
    id: 'the-miracle-cartel', name: 'The Miracle Cartel',
    stance: 'mine-and-sell', seat: 'ossuary-gate',
    wants: 'heaven-bone flowing like any other ore, no questions kept',
    enemies: Object.freeze(['the-salvage-synod', 'the-still-choirs']),
  }),
  'the-still-choirs': Object.freeze({
    id: 'the-still-choirs', name: 'The Still Choirs',
    stance: 'let-the-dead-rest', seat: null,
    wants: 'the Barrens emptied of miners and the fallen left unpicked',
    enemies: Object.freeze(['the-miracle-cartel']),
  }),
  'the-candle-council': Object.freeze({
    id: 'the-candle-council', name: 'The Candle Council',
    stance: 'keep-the-lights', seat: 'wickfield',
    wants: 'every shrine-candle in the Marches lit, whatever it costs',
    enemies: Object.freeze(['the-unlit']),
  }),
  'the-unlit': Object.freeze({
    id: 'the-unlit', name: 'The Unlit',
    stance: 'embrace-the-dark', seat: null,
    wants: 'the candles out — they say what walks the dark is owed its turn',
    enemies: Object.freeze(['the-candle-council', 'the-lantern-road-league']),
  }),
  'the-lantern-road-league': Object.freeze({
    id: 'the-lantern-road-league', name: 'The Lantern Road League',
    stance: 'keep-the-roads', seat: 'lantern-cross',
    wants: 'toll-free lit roads from coast to Barrens; trade heals what prayer cannot',
    enemies: Object.freeze(['the-toll-knights', 'the-unlit']),
  }),
  'the-toll-knights': Object.freeze({
    id: 'the-toll-knights', name: 'The Toll Knights',
    stance: 'order-at-a-price', seat: null,
    wants: 'every road a toll road; their protection racket dressed as an order',
    enemies: Object.freeze(['the-lantern-road-league']),
  }),
  'the-vesperin-conclave': Object.freeze({
    id: 'the-vesperin-conclave', name: 'The Vesperin Conclave',
    stance: 'remember-precisely', seat: 'the-listening-house',
    wants: 'the death of the gods recorded exactly, against whoever rewrites it',
    enemies: Object.freeze(['the-choir-of-the-second-dawn']),
  }),
  'the-choir-of-the-second-dawn': Object.freeze({
    id: 'the-choir-of-the-second-dawn', name: 'The Choir of the Second Dawn',
    stance: 'raise-a-new-god', seat: 'high-matins',
    wants: 'enough relics, faith and heaven-bone to birth a god that answers',
    enemies: Object.freeze(['the-vesperin-conclave', 'the-still-choirs']),
  }),
  'the-antler-parliament': Object.freeze({
    id: 'the-antler-parliament', name: 'The Antler Parliament',
    stance: 'digest-the-divine', seat: 'rootharrow',
    wants: 'the Weald left to finish its slow green feast undisturbed',
    enemies: Object.freeze(['the-verdigris-wardens']),
  }),
  'the-verdigris-wardens': Object.freeze({
    id: 'the-verdigris-wardens', name: 'The Verdigris Wardens',
    stance: 'contain-the-rot', seat: 'the-copper-bower',
    wants: 'the god-rot burned back before the green stops needing rain',
    enemies: Object.freeze(['the-antler-parliament']),
  }),
  'the-depth-consortium': Object.freeze({
    id: 'the-depth-consortium', name: 'The Depth Consortium',
    stance: 'descend-and-profit', seat: 'the-winch-town',
    wants: 'deeper winches, longer chains, and no audits of what comes up',
    enemies: Object.freeze(['the-closed-door-society']),
  }),
  'the-closed-door-society': Object.freeze({
    id: 'the-closed-door-society', name: 'The Closed Door Society',
    stance: 'seal-the-deep', seat: 'saint-anchor',
    wants: 'the Sunder Deep collapsed and the borrowed voices silenced',
    enemies: Object.freeze(['the-depth-consortium']),
  }),
  'the-gray-procession': Object.freeze({
    id: 'the-gray-procession', name: 'The Gray Procession',
    stance: 'mourn-forever', seat: null,
    wants: 'the whole continent walking one endless funeral; grief as governance',
    enemies: Object.freeze([]),
  }),
});

// Story hooks — the 3.0.0 `extraStoryHooks` slot's first data. Each
// binds a place, a faction pressure, and what it pays; `adventureId`
// present when a hook opens one of the pack's playable adventures.
export const SUNDERMARK_HOOKS = Object.freeze({
  'the-wet-reliquary': Object.freeze({
    id: 'the-wet-reliquary', title: 'The Wet Reliquary',
    cityId: 'saint-anchor', factionId: 'the-salvage-synod',
    pitch: 'A salvage crew brought up a sealed reliquary that weeps fresh tears; the Synod wants it opened quietly, the Congregation wants it drowned again.',
    reward: 'salvage-shares-and-a-favor',
  }),
  'the-tithe-audit': Object.freeze({
    id: 'the-tithe-audit', title: 'The Tithe Audit',
    cityId: 'saint-anchor', factionId: 'the-salvage-synod',
    pitch: 'Three relic shipments vanished between dock and vault. The auditor who noticed has a week to live unless someone else notices louder.',
    reward: 'coin-and-synod-standing',
  }),
  'the-empty-crate': Object.freeze({
    id: 'the-empty-crate', title: 'The Empty Crate',
    cityId: 'the-shriven-port', factionId: 'the-drowned-congregation',
    pitch: 'A crate marked for the deep came ashore empty — and the thing it held has been attending funerals as a mourner nobody remembers inviting.',
    reward: 'the-congregations-silence',
  }),
  'the-guttering': Object.freeze({
    id: 'the-guttering', title: 'The Guttering',
    cityId: 'wickfield', factionId: 'the-candle-council',
    pitch: 'Wickfield\'s candles are dying in alphabetical order of the families they guard. The Council is four names from the end of the ledger.',
    reward: 'a-seat-at-the-council-table',
  }),
  'the-toll-war': Object.freeze({
    id: 'the-toll-war', title: 'The Toll War',
    cityId: 'lantern-cross', factionId: 'the-lantern-road-league',
    pitch: 'The Toll Knights chained the Lantern Road at both ends of the Marches. The League will pay for the chains broken — or for the knight who holds the writ.',
    reward: 'league-shares-and-road-passage',
  }),
  'the-singing-tower-hook': Object.freeze({
    id: 'the-singing-tower-hook', title: 'The Singing Tower',
    cityId: 'lantern-cross', factionId: 'the-choir-of-the-second-dawn',
    pitch: 'A dead god\'s bell-tower has started singing again, and everyone who hears a full verse walks toward it and does not stop.',
    reward: 'the-verse-written-down',
    adventureId: 'the-singing-tower',
  }),
  'the-vein-of-grace': Object.freeze({
    id: 'the-vein-of-grace', title: 'The Vein of Grace',
    cityId: 'ossuary-gate', factionId: 'the-miracle-cartel',
    pitch: 'A new heaven-bone vein heals everyone who mines it — of everything, including the scars they wanted to keep. The Cartel needs it surveyed before the Choirs seal it.',
    reward: 'miracle-ore-cut',
  }),
  'miracle-fever-quarantine': Object.freeze({
    id: 'miracle-fever-quarantine', title: 'The Miracle-Fever Quarantine',
    cityId: 'ossuary-gate', factionId: 'the-still-choirs',
    pitch: 'A mining camp caught miracle-fever: everyone in it is now briefly, uncontrollably divine. The quarantine cordon is asking for volunteers who can say no to answered prayers.',
    reward: 'the-choirs-gratitude',
  }),
  'the-last-recording': Object.freeze({
    id: 'the-last-recording', title: 'The Last Recording',
    cityId: 'the-listening-house', factionId: 'the-vesperin-conclave',
    pitch: 'The only transcript of the seventh god\'s last words has been stolen — and whoever holds it can rewrite what the Sundering meant.',
    reward: 'conclave-archives-access',
  }),
  'halberds-edge-hook': Object.freeze({
    id: 'halberds-edge-hook', title: "Halberd's Edge",
    cityId: 'high-matins', factionId: 'the-choir-of-the-second-dawn',
    pitch: 'The Choir\'s prototype god-vessel has a heartbeat. The paladin guarding it swore her oath to a god she now hears knocking.',
    reward: 'a-memory-oath-witnessed',
    adventureId: 'halberds-edge',
  }),
  'the-god-rot-cure': Object.freeze({
    id: 'the-god-rot-cure', title: 'The God-Rot Cure',
    cityId: 'rootharrow', factionId: 'the-verdigris-wardens',
    pitch: 'A warden claims the rot can be cured with a graft from the dead god\'s heartwood — which the Antler Parliament guards as its holiest table.',
    reward: 'warden-safe-passage-forever',
  }),
  'the-green-tithe': Object.freeze({
    id: 'the-green-tithe', title: 'The Green Tithe',
    cityId: 'the-copper-bower', factionId: 'the-antler-parliament',
    pitch: 'The Parliament demands a living memory of the sun as this year\'s tithe. The village has chosen who to send. She has other plans.',
    reward: 'the-bowers-debt',
  }),
  'the-borrowed-voice': Object.freeze({
    id: 'the-borrowed-voice', title: 'The Borrowed Voice',
    cityId: 'the-winch-town', factionId: 'the-closed-door-society',
    pitch: 'Winch crew nine came up speaking as one person — a person the records say died in the Sundering. The Society wants the interview conducted before the Consortium sends them back down.',
    reward: 'society-membership-offered',
  }),
});
