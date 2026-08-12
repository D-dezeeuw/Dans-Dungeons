// src/settings/pack-neon-stacks.js — the far reskin, and the stress test.
//
// classic proved the seams exist by changing nothing. This pack exists to prove
// they carry weight: it flips the era, the kind-vocabulary and the creature
// wardrobe all at once. Continents become sprawls, provinces become districts,
// a sea crossing becomes a ferry line, a skeleton becomes a derelict service
// chassis with the same thirteen hit points. If a genre assumption survived
// anywhere in the engine, this is the pack that makes it visible — a castle in
// a sketch, a "tavern" in an NPC's mouth, a room description that still smells
// of mildew and hay.
//
// Nothing mechanical moves. Every stat block is the SRD's, every DC is the
// resolver's, every id in `overlays` is a creature the bestiary already knows.
// What changes is the clothes.
//
// On the setting itself: doc 19 §7.4 is binding here. The texture this pack is
// reaching for — stacked tenement floors, water sold by the litre, sworn
// families holding a run of stairs, corporate tiers nobody is allowed to audit
// — is drawn from real dense-city life, so every proper noun in it is invented
// and none of it names a real place, a real community, or anyone's published
// setting. The speech is written as lived-in cant: address terms and cadence,
// never mock-dialect spelling, never a caricature accent. That is the review
// bar the lint cannot check.

export const PACK = Object.freeze({
  id: 'neon-stacks',
  packVersion: 1,
  era: 'future',

  card: {
    en: {
      name: 'The Neon Stacks',
      blurb: 'A vertical city that never sees the sky. Metered water, inherited debt, and rain all the way down.',
    },
    nl: {
      name: 'De Neonstapels',
      blurb: 'Een verticale stad die de hemel nooit ziet. Water op de liter, geërfde schuld, en regen tot helemaal beneden.',
    },
  },

  // ─── Blueprint palettes ────────────────────────────────────────────────────
  // Partial: anything absent (tones, beat arcs, climates, god domains) inherits
  // the library table. The god-domain epithets are deliberately kept — they are
  // name-free by design, and a founder myth reads as a god here without help.
  tables: {
    worldArchetypes: [
      'corporate succession war', 'grid blackout', 'inherited-debt economy',
      'water cartel', 'vertical land grab', 'sinking foundations',
      'quarantined tiers', 'unaudited floors', 'implant recall',
      'reclamation by the sea',
    ],

    threatTypes: [
      'water riot', 'stair-clan war', 'grid collapse',
      'black-clinic plague', 'eviction sweep', 'server-crypt awakening',
      'debt press-gang', 'tide surge', 'audit squad',
      'runaway automation',
    ],

    factionArchetypes: [
      { type: 'stair-clan',        desc: 'sworn family holding a run of floors and the stairs between them' },
      { type: 'water house',       desc: 'cartel metering every litre in the stack and pricing it by the hour' },
      { type: 'floor corp',        desc: 'corporate tenant of tiers nobody is permitted to audit' },
      { type: 'ferry guild',       desc: 'gate crews and boatmen who decide who crosses, and when' },
      { type: 'ripper collective', desc: 'unlicensed surgeons trading implants for favours and silence' },
      { type: 'debt office',       desc: 'collectors who buy inherited debts and the people attached to them' },
      { type: 'grid crew',         desc: 'linemen and splicers who own the power because they own the cable' },
      { type: 'ancestor society',  desc: 'shrine-keepers holding the tablets, the records and the grudges' },
      { type: 'scrap syndicate',   desc: 'salvagers stripping dead floors and selling them back up the stack' },
      { type: 'tenants union',     desc: 'organised residents who answer an eviction with barricades' },
      { type: 'roof cartel',       desc: 'antenna owners renting out the sky and selling the signal' },
      { type: 'quiet office',      desc: 'fixers and informants trading in what the floors say at night' },
    ],

    // Exactly six, all invented compounds. 'oath den' is the stair-clan back
    // room — the sworn-brotherhood texture without borrowing a real
    // community's word for itself (§7.4).
    dungeonThemes: [
      'server-crypt', 'flooded sublevel', 'oath den',
      'black clinic', 'shrine floor', 'antenna forest',
    ],

    buildingTypes: [
      'canteen stall', 'water shop', 'pawn window', 'cage hotel',
      'ripper clinic', 'ferry gate', 'lift house', 'wire shop',
      'ancestor shrine', 'laundry deck', 'scrap yard', 'debt office',
      'radio room', 'grow floor', 'fight cage', 'cooling plant',
    ],

    locationTypes: [
      'gantry crossing', 'dead lift shaft', 'cable gallery', 'flooded podium',
      'antenna mast', 'rain catchment', 'collapsed stairwell', 'ferry pontoon',
      'incinerator chute', 'roof allotment', 'condemned tier', 'sump outfall',
      'billboard scaffold', 'checkpoint bridge', 'pump house', 'transformer yard',
    ],
  },

  // The bands are abstract — they describe how a place FEELS to stand in, not
  // what latitude it sits at, which is exactly why a vertical city can wear
  // them. Cooling decks are frozen, heat exchange is volcanic, the sump levels
  // are mire, the mast tiers are highland. All eight are claimed, or the
  // province generator would have bands with no dungeon to put in them.
  themeClimates: {
    'server-crypt':     ['frozen', 'arid', 'volcanic'],
    'flooded sublevel': ['mire', 'coastal', 'tropical'],
    'oath den':         ['temperate', 'coastal', 'mire'],
    'black clinic':     ['temperate', 'arid', 'frozen'],
    'shrine floor':     ['temperate', 'tropical', 'highland'],
    'antenna forest':   ['highland', 'coastal', 'frozen', 'volcanic'],
  },

  bandSettlements: {
    temperate: ['tenement tier', 'market landing', 'walk-up block', 'canteen row'],
    arid:      ['condenser block', 'ration-queue tier', 'dust-filter market', 'dry stack'],
    frozen:    ['cooling deck', 'chiller tier', 'frost-pipe walk', 'cold-store block'],
    tropical:  ['grow floor', 'greenhouse tier', 'humid stack', 'vat row'],
    volcanic:  ['furnace tier', 'incinerator deck', 'heat-exchange row', 'slag landing'],
    coastal:   ['ferry gate', 'wharf tier', 'tide market', 'pontoon row'],
    highland:  ['antenna tier', 'mast deck', 'crown landing', 'signal roost'],
    mire:      ['sump row', 'seep tier', 'drain market', 'silt walk'],
  },

  // What the ferry crews say about a district they do not gate for. The
  // library's pool is sailors and caravans; here distance is water, power and
  // who is owed.
  stubHooks: [
    'the water there is metered by the hour and nobody says by whom',
    'its lifts run, and the call buttons are painted over',
    'two clans hold the same stairwell and both take the toll',
    'the grid draws power for floors that report nobody living on them',
    'no ferry has gated there since the last surge',
    'their ancestor tablets were moved and the shrine was not told',
  ],
  // ─── Naming culture ────────────────────────────────────────────────────────
  // Invented phonetics for a dense coastal port sprawl. Every syllable here is
  // made up rather than borrowed: real morphemes concatenate into real place
  // names sooner or later, and §7.4 does not survive a lucky roll. Prefix +
  // suffix is a bare string concatenation in the library, so every prefix ends
  // on a vowel or a soft consonant and every suffix opens on one.
  syllables: {
    continentPrefixes: ['Sau', 'Ngoi', 'Talu', 'Rin', 'Hoa', 'Kem', 'Yun', 'Bau', 'Sei', 'Lor'],
    continentSuffixes: ['kara', 'veyn', 'hoia', 'marr', 'tsun', 'daat', 'raan', 'reth', 'sai', 'luun'],
    provincePrefixes:  ['Loi', 'Fan', 'Mau', 'Sik', 'Tor', 'Nhu', 'Kal', 'Ghau', 'Perr', 'Sun', 'Vai', 'Zher'],
    provinceSuffixes:  ['gate', 'tier', 'quay', 'stack', 'deck', 'sump', 'row', 'lift', 'pier', 'hold', 'rung', 'span'],
  },

  // ─── Dungeon overlays ──────────────────────────────────────────────────────
  // Same shape as the library's DUNGEON_OVERLAYS: ascending challenge, last id
  // is the vault boss. Ids are the bestiary's, untouched — a pack renames a
  // stat block, it never invents one. No id appears in two pools, because the
  // display name is global (world.enemyNames is keyed by id, not by theme) and
  // one creature cannot be both a rack warden and a sump rat.
  overlays: {
    'server-crypt': {
      atmosphere: 'Cold air pours off dead racks and nothing is here to use it.',
      enemies: ['skeleton', 'flying-sword', 'animated-armor', 'specter', 'stone-sentinel'],
    },
    'flooded sublevel': {
      atmosphere: 'The water is waist-deep, warm, and moving against the current.',
      enemies: ['giant-rat', 'swarm-of-rats', 'constrictor-snake', 'crocodile', 'gibbering-mouther'],
    },
    'oath den': {
      atmosphere: 'Smoke, bolted doors, and a hush that arrived a moment before you did.',
      enemies: ['bandit', 'scout', 'spy', 'bandit-captain', 'veteran'],
    },
    'black clinic': {
      atmosphere: 'Antiseptic over rot, and a light that never gets switched off.',
      enemies: ['acolyte', 'zombie', 'fungal-zombie', 'ghoul', 'vampire-spawn'],
    },
    'shrine floor': {
      atmosphere: 'Incense hangs in the stairwell and the whole floor is trying to be quiet.',
      enemies: ['cultist', 'shadow', 'cult-fanatic', 'wight', 'banshee'],
    },
    'antenna forest': {
      atmosphere: 'Wind through a hundred masts, and the rain arriving sideways.',
      enemies: ['kobold', 'cave-spider', 'giant-spider', 'will-o-wisp', 'air-elemental'],
    },
  },

  // What the map says about a tier nobody has walked yet. Without these the
  // frontier promises 'bells heard at odd hours' in a city with no bells.
  frontierHooks: [
    'a lift line that still has power',
    'smoke coming off a floor nobody claims',
    'water pressure that drops every evening',
    'a stairwell the clans route around',
    'signal from a mast that should be dead',
    'a tier the ferries stopped calling at',
  ],

  // Domain treasures and keys inherit: the library's set is keyed by god
  // domain, and a founder-myth relic reads correctly in either wardrobe.
  domainTreasures: null,
  domainKeys: null,

  // Mechanics untouched — `classId` stays 'wizard' in the record and the sheet
  // derives from the same SRD data. Only the word on the button moves.
  classSkins: {
    fighter: { en: 'Enforcer' },
    rogue:   { en: 'Runner' },
    cleric:  { en: 'Ripperdoc' },
    wizard:  { en: 'Netrunner' },
  },
  speciesSkins: null,

  // ─── Voice ─────────────────────────────────────────────────────────────────
  // This block rides in every narrator, dialogue, travel and journal prompt of
  // the campaign, so it is a recurring bill and not a one-off. Kept under the
  // 120-token lint ceiling by saying each thing once.
  voice: {
    address:      ['choom', 'omae'],
    register:     'clipped street cant; tech worn casually; short sentences',
    honorifics:   ['elder, for anyone a tier above'],
    exclamations: ['null that', 'rain on it'],
    // 'magic' is deliberately NOT here: skills.arcana.desc ("Recall lore about
    // spells, magic items, and the planes") is inherited, not overridden, and
    // the skill chips print it every campaign. Forbidding a word the UI shows
    // teaches the narrator to write around something the player can see.
    forbid:       ['thee', 'ye', 'tavern', 'm\'lord', 'sword', 'longbow'],
    examples: {
      narrator: [
        'Rain works down forty storeys of pipe to find you.',
        'The lift cage stops between floors. Someone is deciding.',
      ],
      npc: [
        'You buying, or just bleeding on my counter, choom?',
        'Water is four a litre. Your debt is older than you.',
      ],
    },
    settingNoun: {
      en: 'a stacked district of a vertical city',
      nl: 'een gestapelde wijk van een verticale stad',
    },
  },

  // ─── Locale content overlay ────────────────────────────────────────────────
  // English only. A pack may translate later, but the lint refuses a Dutch key
  // with no English original, and a half-translated pack reads worse than an
  // untranslated one: Dutch play falls through to pack-en and stays in the
  // Stacks rather than splitting half-cyberpunk, half-fantasy.
  i18n: {
    en: {
      world: {
        // The {{style}} of the entrance pool and the {{treasure}} of the vault
        // pool are load-bearing: the generator substitutes them. Every other
        // room type takes no parameters, exactly as the base bundle does.
        houseStyles: [
          'condemned stack',
          'sealed corporate floor',
          'gutted arcade tower',
          'flooded podium block',
          'repossessed cage hotel',
          'dead exchange tower',
        ],

        rooms: {
          entrance: [
            { name: 'Gate Landing',  desc: 'The gate landing of a {{style}}, its shutter jammed a hand-width open. Rain runs in off the walkway and pools where the tiles have lifted.' },
            { name: 'Lift Lobby',    desc: 'The lift lobby of a {{style}}. Three cages, no power in any of them, and call buttons worn blank by decades of thumbs.' },
            { name: 'Cage Door',     desc: 'A steel cage door hangs off one hinge at the mouth of the {{style}}. Beyond it the corridor lights stutter in a rhythm nobody set.' },
            { name: 'Turnstile Row', desc: 'A row of dead turnstiles guards the way into the {{style}}. Someone has bent the third one aside and left the gap as an invitation.' },
            { name: 'Stair Head',    desc: 'Wet concrete steps climb into the {{style}} from the walkway below. The handrail is furred with cable ties and old prayer ribbon.' },
          ],
          hall: [
            { name: 'Assembly Floor', desc: 'A floor cleared wall to wall for assembly work, its benches shoved into a barricade at one end and left there. The extractor hoods still hum on nothing.' },
            { name: 'Atrium Well',    desc: 'A light well drops twelve storeys through the middle of the block. Washing lines cross it at every level, hung with clothes nobody has taken in for years.' },
            { name: 'Canteen Floor',  desc: 'Long tables, bolted down, and a serving hatch with its shutter half-lowered. Trays are stacked beside the till and the urn has gone cold.' },
            { name: 'Trading Floor',  desc: 'Terminals sit in ranks under a ceiling of dead strip lights. Every screen shows the same frozen number, and nobody came back to argue with it.' },
            { name: 'Meeting Deck',   desc: 'A deck built out over the void on cantilevered steel, railed on three sides. Rain falls past it in sheets and never touches it.' },
          ],
          corridor: [
            { name: 'Access Run',    desc: 'A service run barely wide enough for one, ducting overhead and standing water below. The lights come on a metre ahead and go out a metre behind.' },
            { name: 'Cable Gallery', desc: 'Bundled cable lines both walls, layer over layer, each generation strapped over the last. Somewhere inside it something is still drawing current.' },
            { name: 'Service Crawl', desc: 'A crawl space with pipes at head height and a floor of loose grating. Warm air pushes up from below carrying a smell of solvent.' },
            { name: 'Walkway',       desc: 'An external walkway runs along the face of the block, caged in mesh against the drop. Rain drives sideways through the gaps.' },
            { name: 'Stair Shaft',   desc: 'Concrete stairs switchback down into the dark, tagged at every landing in a dozen different hands. The count no longer matches the floors.' },
          ],
          chamber: [
            { name: 'Plant Room',   desc: 'Pumps and compressors fill the room, all of them silent, all of them still under pressure. Condensation beads on every cold surface.' },
            { name: 'Cold Aisle',   desc: 'Racks stand in two facing rows with a lane of chilled air between them. The chill is still being made and nothing is using it.' },
            { name: 'Junction Box', desc: 'A junction room where six ducts meet and none of them are labelled. Someone chalked arrows on the floor, then crossed half of them out.' },
            { name: 'Sorting Room', desc: 'Bins and chutes line the walls, ordered by a system that died with whoever kept it. Paper has drifted into the corners like snow.' },
            { name: 'Meter Room',   desc: 'A wall of water meters ticks over in the dark, counting litres for tenants who left. The dials are the only thing moving in here.' },
          ],
          storage: [
            { name: 'Bond Store',  desc: 'A cage-fronted store for bonded goods, its manifest board wiped clean. Two crates remain, banded shut and unlabelled.' },
            { name: 'Parts Cage',  desc: 'Drawers of components sorted by a careful hand, most of them empty, a few still holding parts for machines nobody runs. The mesh door is unlocked.' },
            { name: 'Water Store', desc: 'Drums stand in ranks, stencilled with a house mark and a date. Most have been drained through a neat hole punched near the base.' },
            { name: 'Cold Locker', desc: 'A walk-in locker still holding its cold, breath fogging in the doorway. Hooks hang empty along the rail and the floor drain is clean.' },
            { name: 'Crate Stack', desc: 'Crates stacked to the ceiling and lashed against the sway of the block. The topmost have been opened and left that way.' },
          ],
          quarters: [
            { name: 'Cage Hotel',      desc: 'Sleeping cages stacked three high fill the room, each one a bed, a locker and nothing else. Half the padlocks are still closed.' },
            { name: 'Bunk Row',        desc: 'Two rows of bunks under a low ceiling, each with a curtain rail and no curtain. Photographs are taped to the underside of the bed above.' },
            { name: 'Family Cell',     desc: 'One room for a whole household: a stove, a shrine shelf, a mattress rolled against the wall. Height marks in pencil climb the door frame and stop.' },
            { name: 'Foreman\'s Room', desc: 'A single room with a desk, a chair and a window onto the light well. The desk drawer has been forced, and forced again from the other side.' },
            { name: 'Crash Room',      desc: 'Mattresses on the floor, a kettle, and an ashtray cut down from a can. Somebody slept here recently and left in a hurry.' },
          ],
          shrine: [
            { name: 'Ancestor Niche', desc: 'Tablets fill a wall of shallow niches, each with a name cut into it and a cup set in front. Some of the cups are dry. Some are not.' },
            { name: 'Offering Ledge', desc: 'A concrete ledge under a vent, laid with paper money, cigarettes and a bowl of grain gone to dust. The vent breathes on it steadily.' },
            { name: 'Incense Room',   desc: 'Coils of incense hang from the ceiling in tightening spirals, burnt through to different depths. The smoke has stained the walls an even brown.' },
            { name: 'Memorial Wall',  desc: 'Hundreds of small photographs sit behind cracked glass, all of them the same size. Fresh flowers stand under two, and nothing under the rest.' },
            { name: 'Quiet Room',     desc: 'A room the block keeps unlit and unheated on purpose. There is a mat, a bell on a cord, and a rule about noise that everyone obeys.' },
          ],
          vault: [
            { name: 'Strong-Room',      desc: 'A strong-room with a door thicker than the wall it hangs in, standing open. Inside, on a bare steel shelf, sits {{treasure}}. A service hatch leads out.' },
            { name: 'Server Cage',      desc: 'A caged floor of dead racks, stripped of anything that could be carried. One rack still holds a locked drawer, and in it {{treasure}}. The fire door is ajar.' },
            { name: 'Ledger Room',      desc: 'Shelves of paper ledgers, water-stained and out of order. Weighted down on the reading desk, exactly where it was left, is {{treasure}}. Daylight shows under a far door.' },
            { name: 'Executive Floor',  desc: 'A floor that never appeared on the directory, carpeted and quiet. The desk drawers are empty but one, which holds {{treasure}}. A private lift stands open.' },
            { name: 'Deposit Vault',    desc: 'Rows of deposit boxes, most of them drilled out. The one nobody managed to open has been forced at last, and {{treasure}} lies half out of it. A stair climbs toward the rain.' },
          ],
        },

        dressing: {
          'server-crypt': [
            'A rack of drives spins up, holds the note, and spins down again.',
            'Dust has drifted into the cold aisle in long grey dunes.',
            'A password is written on the frame in marker and scratched half out.',
            'A patch panel hangs open with every cable pulled but one.',
            'Floor tiles are lifted in a trail that leads somewhere and stops.',
            'A screen wakes as you pass and offers a login for a company that folded.',
          ],
          'flooded sublevel': [
            'The tide mark on the wall is higher than the doorway.',
            'A ladder disappears into black water two rungs down.',
            'Plastic drums bob in the corner, roped together into a raft.',
            'Something large moves down the flooded corridor and does not surface.',
            'A pump housing has been cut open and stripped of its impeller.',
            'Silt has set into the floor grating in a smooth grey crust.',
          ],
          'oath den': [
            'A gaming table is still set out, stakes and all, mid-hand.',
            'Nine cups sit on a shelf in a row, one of them turned over.',
            'The door carries three bolts on the inside and none on the outside.',
            'Names are cut into the lintel in a column, the last one shallow and new.',
            'A carpet has been rolled back to show a hatch in the floorboards.',
            'Cigarette burns mark the table edge in a tally nobody will explain.',
          ],
          'black clinic': [
            'A dentist\'s chair has been rebuilt for a body twice its size.',
            'Sharps bins have overflowed onto the floor and stayed there.',
            'A drip stand holds a bag that has gone dark and thick.',
            'Consent forms are stacked on a trolley, none of them signed.',
            'The autoclave is warm to the hand and its door is welded shut.',
            'A tray of implants lies sorted by size, each etched with a stranger\'s name.',
          ],
          'shrine floor': [
            'Ash from burnt paper has drifted into every corner of the landing.',
            'A bell hangs on a cord too short to ring by accident.',
            'Offerings have been left for a name that was chiselled out.',
            'Red cord is strung across a doorway at chest height.',
            'Someone swept this floor today, and the broom is still here.',
            'A dish of water sits by the stair, refilled and never drunk.',
          ],
          'antenna forest': [
            'Guy wires sing in the wind at a pitch that sets teeth on edge.',
            'A dish points at nothing and tracks it patiently across the sky.',
            'Ice has built along the windward masts and lets go in sheets.',
            'A ladder cage climbs the mast and ends forty rungs up in open air.',
            'Warning lights pulse red through the cloud, out of step with each other.',
            'Cable ties have been woven into what is unmistakably a bird\'s nest.',
          ],
        },

        dressingGeneric: [
          'A draught out of the light well moves grit along the floor.',
          'An arrow has been sprayed on the wall, pointing back the way you came.',
          'A loop of cable tie hangs from a conduit at head height.',
          'The floor here has been mopped recently, and badly.',
          'A dropped work light lies on its side, its lens unbroken.',
          'The grouting between the tiles has been picked out in one place.',
        ],

        treasures: [
          { name: 'sealed water bond',        desc: 'A bearer note for four hundred litres, sealed and still tradeable at any gate.' },
          { name: 'clan ledger tablet',       desc: 'An ancestor tablet with a debt ledger cut into the back of it, name by name.' },
          { name: 'unregistered spinal deck', desc: 'A slim interface deck with no maker\'s mark and no registration anywhere.' },
          { name: 'black keycard',            desc: 'A matte card that opens floors the directory in the lobby does not list.' },
        ],

        keys: [
          { name: 'lift keycard',      desc: 'A worn access card, its magnetic stripe patched over with tape.' },
          { name: 'brass sump key',    desc: 'A heavy brass key, green at the bit, cut for a lock below the water line.' },
          { name: 'tenancy chit',      desc: 'A stamped metal chit that a door will accept in place of a name.' },
          { name: 'maintenance override fob', desc: 'A rubber-cased fob that argues with locks until they give up.' },
        ],

        loot: [
          { name: 'trauma patch',      desc: 'A sealed adhesive patch that floods a wound with clotting foam.', heals: 8, consumable: true },
          { name: 'ancestor tag',      desc: 'A thin steel tag with a family name and two dates stamped into it.', value: 25 },
          { name: 'salvaged memory stick', desc: 'A scratched stick of storage, half of it corrupt, the rest somebody\'s life.', lore: true },
          { name: 'roll of scrip',     desc: 'A tight roll of block scrip, good in maybe four stacks out of ten.', gold: 15, consumable: true },
        ],

        // Same stat block, different clothes. A derelict chassis has a
        // skeleton's thirteen hit points and a skeleton's rusted reach.
        enemyNames: {
          'wolf':              'Stray Dog',
          'worg':              'Fighting Dog',
          'dire-wolf':         'Pit Hound',
          'black-bear':        'Grow-Floor Brute',
          'goblin':            'Scavver',
          'skeleton':          'Derelict Chassis',
          'flying-sword':      'Loose Cutter',
          'animated-armor':    'Standing Rig',
          'specter':           'Orphan Process',
          'stone-sentinel':    'Rack Warden',
          'giant-rat':         'Sump Rat',
          'swarm-of-rats':     'Drain Swarm',
          'constrictor-snake': 'Pipe Crawler',
          'crocodile':         'Cistern Lurker',
          'gibbering-mouther': 'Overflow',
          'bandit':            'Door Muscle',
          'scout':             'Stair Watcher',
          'spy':               'Ledger Keeper',
          'bandit-captain':    'Den Boss',
          'veteran':           'House Enforcer',
          'acolyte':           'Ward Orderly',
          'zombie':            'Ward Leftover',
          'fungal-zombie':     'Graft Reject',
          'ghoul':             'Stim-Burned Feral',
          'vampire-spawn':     'Bleeder',
          'cultist':           'Candle-Tender',
          'shadow':            'Smoke Shape',
          'cult-fanatic':      'Floor Preacher',
          'wight':             'Ancestor Effigy',
          'banshee':           'Grief Siren',
          'kobold':            'Mast Scrapper',
          'cave-spider':       'Cable Spinner',
          'giant-spider':      'Guy-Wire Weaver',
          'will-o-wisp':       'Rogue Beacon',
          'air-elemental':     'Downdraught',
        },

        enemyIntros: {
          // The travel and fallback pools, first: OVERWORLD_ENEMY_IDS and
          // DEFAULT_ENEMY_IDS are reached without consulting an overlay, so a
          // pack that skins only its own themes still meets a "Wolf" on the
          // ferry crossing and a "Goblin" in a dungeon with no theme match.
          'wolf':              'Something low and quick comes off the walkway rail, all shoulder and no sound.',
          'worg':              '{{name}} pads out of the dark with a scarred muzzle and the confidence of a thing that is fed for this.',
          'dire-wolf':         'The pit gate is open and {{name}} is already in the doorway, taking up all of it.',
          'black-bear':        'Something enormous shoulders through the grow-floor plastic, sinuses full of fertiliser and temper.',
          'goblin':            'A wiry scavver drops off the pipework with a length of rebar and no intention of talking.',
          'skeleton':          'A service frame unfolds off the wall on stripped servos, tool arms swinging up into a guard.',
          'flying-sword':      'A cutting arm tears loose from its rail and hangs there, blade spinning up to a whine.',
          'animated-armor':    'An empty exo-rig steps down off its cradle and sets its feet, with nobody inside it.',
          'specter':           'Every screen in the row wakes at once, and something that used to be a person comes down the wire.',
          'stone-sentinel':    'A frame the size of a rack grinds around on its mount, floodlight swinging until it settles on you.',
          'giant-rat':         'A rat the size of a terrier bursts out of the drain wrack, wet fur bristling, teeth bared.',
          'swarm-of-rats':     'The water ahead breaks into a moving carpet of rats, squealing as it comes.',
          'constrictor-snake': 'Coils slide out of a burst pipe, one after another, a tongue tasting the damp air.',
          'crocodile':         'Something long and armoured leaves the flooded corridor in one surge, jaws already wide.',
          'gibbering-mouther': 'A slick of overflow heaves itself upright, full of mouths, talking over itself in stolen voices.',
          'bandit':            'A heavy steps out of the doorway with a length of bar in hand. "Wrong floor, choom."',
          'scout':             'A watcher drops off the stair rail with a bolt gun half-raised. "You are not on any list."',
          'spy':               'A quiet one closes a ledger, and there is a blade in the hand that closed it. No words.',
          'bandit-captain':    'The den boss rises from behind the table with a blade in each hand. "Take them apart."',
          'veteran':           'A house enforcer sets her feet in the doorway and rolls one shoulder. "Last warning, choom."',
          'acolyte':           'An orderly looks up from a half-finished graft, eyes going flat as a bone saw comes up.',
          'zombie':            'A patient nobody discharged drags itself off the table, drip line still trailing from its arm.',
          'fungal-zombie':     'A failed graft lurches upright, pale growth splitting the seams of its skin.',
          'ghoul':             'Something stim-burned past sense scrabbles up on too-long limbs, nails black to the bed.',
          'vampire-spawn':     'A pale figure smiles over the transfusion rig. "Sit down. You will barely feel it."',
          'cultist':           'A candle-tender turns from the niche wall, devotion hardening, a long knife already out.',
          'shadow':            'Smoke peels away from the incense wall and comes across the floor with intent.',
          'cult-fanatic':      'The floor preacher throws back a hood, eyes bright with what this block is willing to call faith.',
          'wight':             'An effigy of somebody\'s ancestor steps down off its ledge and regards you with cold patience.',
          'banshee':           'A grief siren unfolds out of the smoke and opens a mouth that promises to stop your heart.',
          'kobold':            'A scrapper scrambles down a mast strut and snatches up a pry bar, all fear and spite.',
          'cave-spider':       'Cable and silk are the same thing up here, and the thing riding them is black-legged and fast.',
          'giant-spider':      'A weaver drops from the guy wires on a thick strand, far too fast for its size.',
          'will-o-wisp':       'A beacon light drifts down off the mast, almost friendly, then crackles white-hot and lunges.',
          'air-elemental':     'The wind between the masts gathers itself into a shape and comes down the deck at you.',
        },

        enemyIntroGeneric: '{{name}} squares up in the doorway, and it is not here to talk.',
      },

      // Kind vocabulary. Only keys the base bundle already has — an invented
      // key is not an override, it is a silent no-op that reads as applied.
      map: {
        empty:          'You have not yet mapped the sprawl.',
        header:         '── Known sprawl ──',
        connectsLine:   '    → lines run toward: {{names}}',
        rumouredHeader: 'Beyond the tiers you have walked:',
        heldBy:         '— home floor of {{names}}',
        portMark:       '⛴',
      },

      sail: {
        noLane:      'No ferry line leaves this deck.',
        depart:      'You buy a seat on the ferry line — {{days}} days of grey water toward {{name}}.',
        sight:       'The far stacks resolve out of the rain: {{name}}. {{digest}}',
        arriveKnown: 'The crossing is routine now. The ferry puts you down in {{name}}.',
        arrive:      'The ferry ties up at {{settlement}}, on the edge of {{name}}.',
        noPassage:   'No ferry runs today. The gate stays shut and the queue does not move.',
        arrivalNote: 'You came in on the ferry line after {{days}} days on the water, and the damp of it is still in your coat.',
      },

      settlement: {
        sailChip: 'Ride the ferry line to {{name}}',
      },

      lexicon: {
        kind: {
          continent:  'sprawl',
          province:   'district',
          region:     'tier',
          settlement: 'block',
        },
      },
    },
  },

  imageStyle:
    'Rain-streaked ink sketch of a dense vertical city interior — stacked walkways, cable runs, neon bleed on wet metal. ' +
    'Drawn fast in a salvager\'s pocket notebook, smudged and off-register. ' +
    'No text, no labels, no writing of any kind. No borders, no frames, no decorative edges.',

  promptLine: {
    en: 'This setting is a rain-soaked vertical mega-city of stacked districts, ferry gates and metered water, where technology is grimy, personal and second-hand, and nothing medieval exists in it — no swords, no castles, no knights, no magic.',
    nl: 'Deze wereld is een doorregende verticale megastad van gestapelde wijken, veerponten en water op de liter, waar techniek smerig, persoonlijk en tweedehands is, en waarin niets middeleeuws bestaat — geen zwaarden, geen kastelen, geen ridders, geen magie.',
  },
});
