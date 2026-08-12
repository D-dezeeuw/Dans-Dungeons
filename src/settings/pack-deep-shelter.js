// src/settings/pack-deep-shelter.js — the far reskin that goes down, not out.
//
// neon-stacks proved the kind-vocabulary seams carry a horizontal city. This
// pack stands the world tree on its end: a continent is a sealed shelter, a
// province is a level, a region is a sector, a settlement is a ring of bunks
// around a lamp. The sea lane between two port provinces becomes the one thing
// nobody here does willingly — a suited crossing over the top, at night, in
// stages, between two hatches that both stay shut longer than they open. If any
// layer of the generator still assumed a map that spreads sideways under an
// open sky, this is the pack where a player would see it.
//
// The risk it carries is not the Stacks' risk. Nothing in this setting is
// spectacular: no wasteland, no mutants, no skyline to point a camera at. What
// is dangerous here is arithmetic — the ration figure that no longer closes, a
// scrubber running at reduced output, an archive revision nobody voted on. That
// asks more of a narrator than a monster does, so the voice block is written to
// hold the register DOWN rather than up: plain, procedural, quietly devout,
// people who say "the light provides" the way others say "take care". A pack
// can supply nouns; only the voice can stop them being shouted.
//
// What is wrong with the surface is never stated in this file, and the hints
// that are here do not agree with each other — a dated seed tin, grit under a
// seal, a hatch that cycled from the outside. That is content, not an omission.
// The shelter's own records are edited, so the pack has no standing to be more
// consistent than they are.
//
// Doc 19 §7.4 is binding. The texture — rationing, shift rosters, a committee
// that decides what the archive says, light as the literal object of devotion
// because light is metered — is drawn from how real sealed, rationed and
// record-keeping communities actually work, so every proper noun in it is
// invented, nothing names a real place or anyone's published setting, and the
// speech is written as lived-in cant: address terms and cadence, never
// mock-dialect spelling. That is the review bar the lint cannot check.
//
// Nothing mechanical moves. Every id in `overlays` is a stat block the bestiary
// already owns: the Late Shift that pushes up off the bench is a zombie, hit
// point for hit point, and the Governor at the bottom of the machine deep rolls
// a stone sentinel's dice. What changes is the clothes and the lighting.

export const PACK = Object.freeze({
  id: 'deep-shelter',
  packVersion: 1,
  era: 'modern',

  card: {
    en: {
      name: 'Children of the Light',
      blurb: 'A sealed shelter where light is metered, births are drawn by lottery, and the levels below are older than the records that deny them.',
    },
    nl: {
      name: 'Kinderen van het Licht',
      blurb: 'Een verzegelde schuilplaats waar licht op de meter gaat, geboorten worden geloot, en de diepe niveaus ouder zijn dan de archieven die ze ontkennen.',
    },
  },

  // ─── Blueprint palettes ────────────────────────────────────────────────────
  // Partial: tones, beat arcs, climates and god domains inherit. The domains
  // are kept on purpose — they are name-free epithets, one of them is already
  // 'light' ("the lamp that will not be smothered"), and a founder myth in a
  // shelter reads as a god without any help from this file.
  tables: {
    worldArchetypes: [
      'metered light', 'sealed shelter', 'edited archive',
      'birth lottery', 'ration arithmetic', 'levels older than the plans',
      'hostile surface', 'inherited shift roster', 'air that has to be made',
      'a committee past its mandate', 'the deep levels reopening',
      'a second shelter, signalling',
    ],

    threatTypes: [
      'scrubber failure', 'suspended birth lottery', 'unvoted archive revision',
      'a sealed level reopening', 'a hatch cycled from outside', 'ration shortfall',
      'lamp famine', 'reclamation blight', 'pressure loss',
      'quarantine ring', 'a salvage crew gone quiet', 'roster strike',
    ],

    factionArchetypes: [
      { type: 'lamp order',        desc: 'keepers of the lamps, who ration light and call the rationing a liturgy' },
      { type: 'roster committee',  desc: 'the board that assigns every shift, every bunk and every pair of hands' },
      { type: 'archive office',    desc: 'clerks with standing authority to revise what the shelter remembers' },
      { type: 'suit crew',         desc: 'the few cleared to go over the top, and the only people who have seen weather' },
      { type: 'deep salvage gang', desc: 'crews working the levels below the plans, selling back what should not be there' },
      { type: 'the quiet ones',    desc: 'neighbours who believe the surface is survivable and say so only in private' },
      { type: 'ration office',     desc: 'accountants who decide what a body is owed per day and defend the figure' },
      { type: 'plant crew',        desc: 'engineers who keep the air breathable and know exactly how thin the margin is' },
      { type: 'cistern watch',     desc: 'stewards of reclaimed water, metering it by the cup and testing it hourly' },
      { type: 'grow collective',   desc: 'farmers of the lit decks — the only people who make food, and aware of it' },
      { type: 'lottery court',     desc: 'officers of the draw that decides which households may bear a child' },
      { type: 'hatch watch',       desc: 'wardens holding the locks between levels, logging every name that passes' },
      { type: 'infirmary order',   desc: 'ward staff who also keep the only register of the dead nobody has edited' },
    ],

    // Exactly six, all invented. 'machine deep' and 'surface lock' are the two
    // ends of the shelter's imagination: the plant nobody understands any more,
    // and the door everybody has agreed not to open.
    dungeonThemes: [
      'sealed level', 'flooded plant', 'archive stack',
      'grow deck', 'machine deep', 'surface lock',
    ],

    buildingTypes: [
      'ration hall', 'lamp house', 'cistern room', 'roster office',
      'archive stack', 'infirmary bay', 'crèche', 'suit locker',
      'scrubber house', 'grow deck', 'laundry deck', 'bunk block',
      'salvage yard', 'wake room', 'meeting commons', 'lottery office',
      'tool crib', 'pump room',
    ],

    locationTypes: [
      'stair well', 'lift shaft', 'air trunk', 'cable gallery',
      'plated door', 'sump gallery', 'chiller plant', 'reactor gallery',
      'spillway', 'ventilation crawl', 'observation lock', 'dead level',
      'name wall', 'lamp niche', 'ladder run', 'silt basin',
      'inspection catwalk', 'blast door',
    ],
  },

  // The bands describe how a place FEELS to stand in, not what latitude it sits
  // at — which is the only reason a sealed complex can wear them. A grow deck
  // is tropical, a chiller plant frozen, a reactor gallery volcanic, a sump
  // mire, the upper lock highland and coastal at once. All eight are claimed:
  // an unclaimed band falls back to the library's full theme list, and a
  // vampire castle two levels under the water table would end the illusion in
  // one room.
  themeClimates: {
    'sealed level':  ['temperate', 'frozen', 'arid'],
    'flooded plant': ['mire', 'coastal', 'tropical'],
    'archive stack': ['arid', 'frozen', 'temperate'],
    'grow deck':     ['tropical', 'temperate', 'mire'],
    'machine deep':  ['volcanic', 'arid', 'frozen'],
    'surface lock':  ['highland', 'coastal', 'frozen', 'volcanic'],
  },

  bandSettlements: {
    temperate: ['bunk ring', 'ration commons', 'lamp commons', 'quiet ring'],
    arid:      ['filter commons', 'dust ring', 'condensate walk', 'dry bunks'],
    frozen:    ['chiller ring', 'cold commons', 'frost-pipe walk', 'cold-store ring'],
    tropical:  ['grow-deck ring', 'vat commons', 'seedling walk', 'humid ring'],
    volcanic:  ['furnace ring', 'exchange commons', 'boiler walk', 'slag ring'],
    coastal:   ['sluice ring', 'reclaim commons', 'cistern walk', 'lock ring'],
    highland:  ['upper ring', 'crown commons', 'hatch-head walk', 'top-level ring'],
    mire:      ['sump ring', 'seep commons', 'silt walk', 'drain ring'],
  },

  // What the boards say about a level nobody has been cleared for. Procedural
  // on the surface, and each one is a discrepancy rather than a ghost story.
  stubHooks: [
    'the archive lists it twice, differently',
    'its ration figures have not changed in four years',
    'the lift stops there but the doors are not cycled',
    'a light budget is still allocated to it',
    'nobody assigned there appears on a roster',
    'the plans show a stairwell the plans also show as solid',
  ],
  // ─── Naming culture ────────────────────────────────────────────────────────
  // Shelter names started as designations and were said aloud for six
  // generations until they became liturgy; level names kept the function they
  // were built for. Every syllable is invented — real morphemes concatenate
  // into real place names sooner or later, and §7.4 does not survive a lucky
  // roll. The library joins prefix + suffix by bare concatenation, so every
  // prefix here ends where every suffix can start.
  syllables: {
    continentPrefixes: ['Ander', 'Velu', 'Serro', 'Marra', 'Ilva', 'Tesse', 'Oruna', 'Kalve', 'Numa', 'Dessa'],
    continentSuffixes: ['mira', 'thal', 'sende', 'rume', 'vane', 'lume', 'ressa', 'dium', 'sola', 'naeth'],
    provincePrefixes:  ['Vess', 'Orun', 'Halm', 'Tern', 'Cass', 'Dolm', 'Ryn', 'Sabe', 'Neth', 'Ilm', 'Karn', 'Ossa'],
    provinceSuffixes:  ['deep', 'deck', 'ward', 'run', 'lock', 'well', 'span', 'stack', 'gate', 'rung', 'hold', 'walk'],
  },

  // ─── Dungeon overlays ──────────────────────────────────────────────────────
  // Ascending threat, last id is the vault boss, no id in two pools — display
  // names are keyed by id globally, so one stat block cannot be both a clerk
  // and a dog. Skinned as the four things that go wrong down here: machinery
  // that failed, people who went wrong, animals that got in, and — below the
  // plans — something the records decline to account for.
  overlays: {
    'sealed level': {
      atmosphere: 'The lamps run at a third and nobody has come to trim them in a long time.',
      enemies: ['skeleton', 'zombie', 'ghoul', 'wight'],
    },
    'flooded plant': {
      atmosphere: 'Warm water to the waist, moving the wrong way against the pumps.',
      enemies: ['giant-rat', 'swarm-of-rats', 'constrictor-snake', 'crocodile', 'gibbering-mouther'],
    },
    'archive stack': {
      atmosphere: 'Dry air, full lamps, and box numbers that run in sequence with gaps in them.',
      enemies: ['cultist', 'acolyte', 'shadow', 'spy', 'cult-fanatic'],
    },
    'grow deck': {
      atmosphere: 'Heat, wet peat, and grow lamps burning past anything the meter would allow.',
      enemies: ['cave-spider', 'violet-fungus', 'fungal-zombie', 'black-bear', 'myconid-sovereign'],
    },
    'machine deep': {
      atmosphere: 'A hum that arrives through the boots, from plant older than the plans for it.',
      enemies: ['flying-sword', 'magma-mephit', 'animated-armor', 'will-o-wisp', 'stone-sentinel'],
    },
    'surface lock': {
      atmosphere: 'The inner door is warm. The outer door is not, and something works at it.',
      enemies: ['bandit', 'ice-mephit', 'scout', 'veteran', 'air-elemental'],
    },
  },

  // What the map promises about a sector nobody has walked. Without these the
  // frontier keeps offering bells and saltmarsh to a world with neither. The
  // last one is the pack's thesis in a single line.
  frontierHooks: [
    'a stair that keeps going below the last numbered level',
    'lamps burning on a level with no roster',
    'a door the deck plans do not show',
    'air moving where nothing should be running',
    'a shift that clocked in and never clocked out',
    'a sector the archive lists twice, differently',
  ],

  // Domain treasures and keys inherit: the library's set is keyed by god
  // domain, and a founder relic reads correctly in either wardrobe.
  domainTreasures: null,
  domainKeys: null,

  // Mechanics untouched — `classId` stays 'wizard' in the record and the sheet
  // derives from the same SRD data. A Reviser is a wizard: someone whose power
  // is that they decide what is written down.
  classSkins: {
    fighter: { en: 'Bulkhead Warden' },
    rogue:   { en: 'Crawlway Hand' },
    cleric:  { en: 'Lampwright' },
    wizard:  { en: 'Reviser' },
  },
  speciesSkins: null,

  // ─── Voice ─────────────────────────────────────────────────────────────────
  // This block rides in every narrator, dialogue, travel and journal prompt of
  // the campaign — a recurring bill, not a one-off. One example per audience is
  // enough when both examples do work: the narrator line shows that a failing
  // lamp is an administrative event, the NPC line shows devotion used as
  // ordinary courtesy.
  //
  // `forbid` lists only words this world cannot produce, and each was checked
  // against what the pack does NOT override: 'castle' and 'daylight' live in a
  // library dungeon theme this pack replaces, the rest appear nowhere in the
  // base bundle or the engine. Nothing here forbids a word inherited content
  // can still say.
  voice: {
    address:      ['neighbour', 'ration-mate', 'child of the light'],
    register:     'plain and procedural, quietly devout; short sentences',
    honorifics:   ['keeper, for a lamp-tender'],
    exclamations: ['the light provides', 'lamps keep you'],
    forbid:       ['castle', 'daylight', 'meadow', 'sunrise', 'horseback', 'thee'],
    examples: {
      narrator: ['The lamp on the stair is down to one bar. Someone signed for that.'],
      npc:      ['Two cups a day, neighbour. The board wrote it, not me.'],
    },
    settingNoun: {
      en: 'a lamp-lit ring inside a sealed underground shelter',
      nl: 'een lampverlichte ring in een verzegelde ondergrondse schuilplaats',
    },
  },

  // ─── Locale content overlay ────────────────────────────────────────────────
  // English only. The lint refuses a Dutch key with no English original, and a
  // half-translated pack reads worse than an untranslated one: Dutch play falls
  // through to pack-English and stays in the shelter.
  i18n: {
    en: {
      world: {
        // {{style}} in the entrance pool and {{treasure}} in the vault pool are
        // load-bearing — the generator substitutes them. No other room type
        // takes a parameter, exactly as the base bundle has it.
        houseStyles: [
          'condemned level',
          'sealed-off deck',
          'flooded plant block',
          'decommissioned lock house',
          'unlisted sub-level',
          'shut works',
        ],

        rooms: {
          entrance: [
            { name: 'Hatch Landing',  desc: 'You stand on the hatch landing of a {{style}}. The wheel has been backed off half a turn and left that way, and the seal has taken a set in the shape of the frame.' },
            { name: 'Muster Point',   desc: 'The muster point of the {{style}}: a painted square on the floor, one bench, and a board where the shift list should hang. The lamp above it is out.' },
            { name: 'Stair Head',     desc: 'Concrete steps drop away into the {{style}}. The handrail is worn bright on one side only — the side people came up.' },
            { name: 'Suit Rack',      desc: 'A rack of empty hangers guards the way into the {{style}}. Boots stand paired beneath it, toes to the wall, every pair a different size.' },
            { name: 'Pressure Door',  desc: 'A pressure door stands a hand-width open at the mouth of the {{style}}, chocked with a length of bar. Cold air moves through the gap and does not stop.' },
          ],
          hall: [
            { name: 'Ration Commons', desc: 'Long tables bolted to the floor, benches worn shiny, and a serving hatch with its shutter down. The chalk board still carries a portion figure nobody has revised.' },
            { name: 'Assembly Deck',  desc: 'A deck cleared for standing assembly, the floor marked out in numbered squares. Every square is empty, and the numbers run higher than the shelter has people.' },
            { name: 'Lamp Commons',   desc: 'A hall built around one great lamp on a column. The lamp is cold, and the benches face inward, still where the last meeting left them.' },
            { name: 'Roster Hall',    desc: 'Pin boards run wall to wall, curling with old shift lists. Names have been struck through and written over so often the paper has gone furry.' },
            { name: 'Cistern Floor',  desc: 'A vaulted floor built out over the water, its surface flat and black between the pillars. Sound arrives twice down here, and neither arrival is quite yours.' },
          ],
          corridor: [
            { name: 'Service Run',    desc: 'A run barely wide enough for one, pipework at shoulder height and loose grating underfoot. The lamps come on a stride ahead and go out a stride behind.' },
            { name: 'Ring Walk',      desc: 'A curved walk that follows the level around, doors on the inner wall and nothing at all on the outer. Whichever way you go, it brings you back.' },
            { name: 'Cable Gallery',  desc: 'Trays of cable line both walls, generation strapped over generation. Something deep in the bundle is warm to the back of the hand.' },
            { name: 'Air Trunk',      desc: 'A trunk big enough to walk upright in, its walls furred with dust in even grey stripes. The draught is steady and comes from further in.' },
            { name: 'Ladder Run',     desc: 'Rungs climb a caged shaft, lit at every third landing. The level numbers stencilled beside them count down past what the plans admit to.' },
          ],
          chamber: [
            { name: 'Scrubber Room',  desc: 'Banks of scrubber cans stand in rows, their gauges settled at the low end of green. One bank is off line, its pipework capped with a welded plate.' },
            { name: 'Pump Room',      desc: 'Pumps sit on their mounts under a ceiling of lagged pipe — silent, and all of them still holding pressure. Condensation stands on every cold surface.' },
            { name: 'Switch Room',    desc: 'A wall of breakers, half of them thrown, each with a paper tag tied to the handle. The tags name levels, and two of those levels are on no plan you have seen.' },
            { name: 'Sorting Room',   desc: 'Bins and chutes ordered by a system that died with whoever kept it. Salvage has drifted into the corners and settled there like snowfall.' },
            { name: 'Meter Room',     desc: 'A wall of lamp meters ticks over in the dark, counting hours against households that are not here to burn them.' },
          ],
          storage: [
            { name: 'Ration Store',   desc: 'Shelves of cans and sacks stacked to a plan chalked on the door frame. The plan and the shelves stopped agreeing some time ago.' },
            { name: 'Lamp Store',     desc: 'Racks of lamps, wicks trimmed, glasses polished, every one accounted for on a card. Three cards remain with no lamp against them.' },
            { name: 'Cold Locker',    desc: 'A walk-in locker still holding its cold, breath fogging in the doorway. The hooks are empty and the floor drain is clean enough to eat off.' },
            { name: 'Parts Crib',     desc: 'Drawers of parts sorted by a careful hand, most of them empty, a few holding fittings for machines that were never installed here.' },
            { name: 'Seed Store',     desc: 'Sealed tins of seed stock, labelled by year and by deck. The oldest tins are dated before the shelter was supposed to exist.' },
          ],
          quarters: [
            { name: 'Bunk Block',     desc: 'Bunks three high in ranks, each with a curtain rail and a numbered locker. Half the locker doors hang open; half are still padlocked shut.' },
            { name: 'Household Cell', desc: 'One room to a household: a stove ring, a lamp bracket, a mattress rolled against the wall. Height marks climb the door frame in pencil and stop low.' },
            { name: 'Shift Room',     desc: 'A room for sleeping between shifts, blacked out and warm. Six mattresses, six hooks, and a rota on the door amended in three different hands.' },
            { name: 'Crèche',         desc: 'Small beds in two rows, painted a colour chosen to look cheerful under lamplight. A rope of paper flags crosses the ceiling and was never taken down.' },
            { name: 'Warden\'s Room', desc: 'A single room with a desk, a chair and a window onto the ring walk. The desk drawer has been forced, and the lock afterwards replaced with one that does not match.' },
          ],
          shrine: [
            { name: 'Lamp Niche',     desc: 'A wall of alcoves, a lamp in each, a name card beneath every one. Some are lit. Most are not, and their cards have not been taken down.' },
            { name: 'Name Wall',      desc: 'Every name the shelter has carried is cut into the concrete in columns. Two columns were filled, scraped back, and filled again.' },
            { name: 'Quiet Room',     desc: 'A room kept unlit and unheated on purpose. There is a mat, a bell on a short cord, and a rule about noise that everyone here obeyed.' },
            { name: 'Oil Bench',      desc: 'A bench of oil jars and trimming knives, each tool in its own outline on the felt. One outline is empty, and has been for a long time.' },
            { name: 'Wake Room',      desc: 'A low room where the dead were laid to be counted before they were reclaimed. The trolley is scrubbed, the register closed, the lamp above it left burning.' },
          ],
          vault: [
            { name: 'Committee Room', desc: 'A room that appears on no deck plan, panelled and quiet. The long table is bare but for {{treasure}}, set out as though for a reading. A stair climbs away from it.' },
            { name: 'Strong Store',   desc: 'A store with a door thicker than the wall it hangs in, standing open. On a bare steel shelf sits {{treasure}}. A service hatch leads out.' },
            { name: 'Sealed Archive', desc: 'Files in numbered boxes, the numbers running with gaps in them. Weighted on the reading desk, exactly where it was left, is {{treasure}}. Lamplight shows under the far door.' },
            { name: 'Founders\' Store', desc: 'A store from the first years, stacked with crates whose stencils have faded to ghosts. One crate has been levered open, and inside it {{treasure}}. A ladder climbs toward moving air.' },
            { name: 'Deep Cache',     desc: 'A chamber the plans do not show, cut from rock rather than poured. In a niche at head height, dry and undisturbed, lies {{treasure}}. A worked passage leads back up.' },
          ],
        },

        dressing: {
          'sealed level': [
            'The lamps here run at a third and nobody comes to trim them.',
            'A door has been welded shut, and the weld ground back to look old.',
            'Dust lies flat and unmarked from one wall to the other.',
            'A shift list is still pinned up, dated to a year the archive does not use.',
            'The air is breathable and tastes of absolutely nothing.',
            'Chalk numbers on the doors are written in a hand nobody uses now.',
          ],
          'flooded plant': [
            'The water is warm, waist-deep, and moving against the pumps.',
            'A tide mark stands two hands above the top of the door frame.',
            'A ladder goes down into black water and stops being visible.',
            'Drums have been roped into a raft and tied off to a stanchion.',
            'Something breaks the surface down the gallery and does not come back up.',
            'Silt has set on the grating in a smooth grey crust.',
          ],
          'archive stack': [
            'Box numbers run in sequence with three numbers missing.',
            'A page has been razored out so cleanly the fold still lies flat.',
            'A loaded trolley waits, addressed to a level that is sealed.',
            'The reading lamps are the only ones on this deck at full.',
            'Two copies of one minute disagree about who was present.',
            'The ash in the bin is paper ash, and it is still warm.',
          ],
          'grow deck': [
            'The heat is close and smells of wet peat and green things.',
            'Grow lamps burn at full, and the meter beneath them has been bypassed.',
            'A trellis has been given over to something nobody planted.',
            'Condensation comes off the ceiling in a fine, constant rain.',
            'One row has been cut out and burned, and the ash left where it fell.',
            'The pollinating brushes are worn to stubs. There are no insects here.',
          ],
          'machine deep': [
            'The floor plates carry a hum that arrives through the boots.',
            'A gauge sits hard against its stop and has been painted over there.',
            'Heat comes off the wall in a band at chest height.',
            'A lubrication chart is filled in daily, in the same steady hand.',
            'Somewhere below, a machine changes note and then settles again.',
            'Guards have been taken off the moving parts and stacked neatly aside.',
          ],
          'surface lock': [
            'The inner door is warm to the palm. The outer door is not.',
            'Suits hang in numbered bays, and two of the bays are empty.',
            'Grit has come in under the seal and lies in a fan across the floor.',
            'The wash-down hose drips into a drain that runs somewhere else.',
            'A log by the door records who went up, and in one column, who came back.',
            'Wind works at the outer door with a patience that does not let up.',
          ],
        },

        dressingGeneric: [
          'A draught out of a duct moves grit along the floor.',
          'An arrow is painted on the wall, pointing back the way you came.',
          'A lamp bracket is empty, and the wall behind it is clean.',
          'The floor here has been mopped recently, and badly.',
          'A dropped work lamp lies on its side, its glass unbroken.',
          'The paint on the pipework has been picked away in one place.',
        ],

        treasures: [
          { name: 'unedited archive box',  desc: 'A file box from before the revisions, seals intact, holding minutes the shelter has voted not to have.' },
          { name: 'founder\'s lamp',       desc: 'A brass lamp serialled below every number the stores have ever issued, and it still lights.' },
          { name: 'complete deck plan',    desc: 'A folded plan of every level, including four that the current plans simply stop above.' },
          { name: 'sealed ration bond',    desc: 'A bearer chit for a year of full portions, countersigned twice and never once presented.' },
        ],

        keys: [
          { name: 'warden\'s keycard',     desc: 'A worn card with the shelter mark rubbed almost flat, its stripe patched over with tape.' },
          { name: 'hatch wheel',           desc: 'A short steel wheel cut to fit a spindle on a door that was meant to stay shut.' },
          { name: 'stamped transit chit',  desc: 'A brass chit stamped with a level and a shift, which a lock will accept in place of a name.' },
          { name: 'plant master key',      desc: 'A heavy square-shanked key off the plant crew\'s board, signed out to nobody at all.' },
        ],

        loot: [
          { name: 'infirmary ampoule',     desc: 'A glass ampoule of clouded fluid, the dose written on the label by hand.', heals: 8, consumable: true },
          { name: 'silver name tag',       desc: 'A thin silver tag stamped with a household name and two dates.', value: 25 },
          { name: 'shift diary',           desc: 'A pocket diary kept in tiny handwriting. The last three weeks have been torn out.', lore: true },
          { name: 'roll of ration chits',  desc: 'A tight roll of paper chits, good in maybe four rings out of ten.', gold: 15, consumable: true },
        ],

        // Same stat block, different clothes and different lighting. A Late
        // Shift is a zombie; a Governor is a stone sentinel that regulates
        // something nobody living has the paperwork for.
        enemyNames: {
          'skeleton':          'Sealed-In Dead',
          'zombie':            'Late Shift',
          'ghoul':             'Ration-Mad',
          'wight':             'Last Warden',
          'giant-rat':         'Duct Rat',
          'swarm-of-rats':     'Duct Swarm',
          'constrictor-snake': 'Intake Coil',
          'crocodile':         'Sluice Lurker',
          'gibbering-mouther': 'Reclaimer Bloom',
          'cultist':           'Lamp Devotee',
          'acolyte':           'Archive Clerk',
          'shadow':            'Unlit',
          'spy':               'Revision Officer',
          'cult-fanatic':      'Lamp Preacher',
          'cave-spider':       'Trellis Spinner',
          'violet-fungus':     'Bad Crop',
          'fungal-zombie':     'Spore-Taken',
          'black-bear':        'Deck Forager',
          'myconid-sovereign': 'Mother Crop',
          'flying-sword':      'Cutting Arm',
          'magma-mephit':      'Burn-Off',
          'animated-armor':    'Empty Suit',
          'will-o-wisp':       'Fault Light',
          'stone-sentinel':    'Governor',
          'bandit':            'Hatch Jumper',
          'ice-mephit':        'Frost Bleed',
          'scout':             'Lock Watcher',
          'veteran':           'Suit Captain',
          'air-elemental':     'Outside Air',
          'wolf':              'Loose Dog',
          'goblin':            'Unlisted',
          'worg':              'Ration Dog',
          'dire-wolf':         'Pack Sire',
        },

        enemyIntros: {
          // The travel and fallback pools come first: OVERWORLD_ENEMY_IDS and
          // DEFAULT_ENEMY_IDS are drawn WITHOUT consulting an overlay, so a
          // pack that skins only its own themes still meets a "Wolf" halfway
          // across the surface and a "Goblin" in a themeless dungeon.
          'wolf':              'A dog that has not been fed on any roster comes out of the dark, low and quick.',
          'worg':              '{{name}} pads into the lamplight with a scarred muzzle and the confidence of a thing that is fed for this.',
          'dire-wolf':         'The kennel gate stands open and {{name}} is already through it, filling the width of the walkway.',
          'black-bear':        'Something heavy shoulders through the plastic curtain, muzzle wet with fruit, and decides you are in its row.',
          'goblin':            'A wiry figure with no bunk number and no name on any sheet drops off the pipework holding a length of bar.',
          'bandit':            'Someone with no chit and nothing left to lose steps out of the bay. "Wrong level, neighbour."',
          'scout':             'A watcher drops off the catwalk with a bolt gun half-raised. "You are not on the sheet."',
          'skeleton':          'Bones in a work coat come up off the floor in one motion, and the coat still carries its shift number.',
          'cultist':           'A devotee looks up from the lamp they were trimming, and the trimming knife does not go down.',
          'zombie':            'Someone who never clocked off pushes up off the bench and starts toward you at a working pace.',
          'cave-spider':       'Something black-legged runs the trellis wire far faster than a thing that size should manage.',
          'giant-rat':         'A rat the size of a terrier bursts out of the pipe lagging, wet to the shoulders and unafraid.',

          // The overlay pools.
          'ghoul':             'A thin figure unfolds out of the corner on too-long limbs, nails black to the bed, mouth already working.',
          'wight':             '{{name}} rises from the door it was set to hold, unhurried, and waits for you to come the rest of the way.',
          'swarm-of-rats':     'The water ahead breaks into a moving carpet of rats, and every part of it is coming this way.',
          'constrictor-snake': 'Coils slide out of a burst intake, one length after another, a tongue tasting the damp.',
          'crocodile':         'Something long and plated leaves the flooded gallery in a single surge, jaws already open.',
          'gibbering-mouther': 'The reclamation tank heaves itself upright, full of mouths, talking over itself in voices the plant crew would know.',
          'acolyte':           'A clerk sets a box on the trolley, squares it to the edge, and turns around with a blade in hand.',
          'shadow':            'The dark between two stacks separates from the rest of the dark and comes down the aisle.',
          'spy':               '{{name}} closes a file, notes something in the margin, and steps into your way without a word.',
          'cult-fanatic':      'The preacher lifts both hands to the one lamp still burning on this deck. "The light provides. Not for you."',
          'violet-fungus':     'A row planted as food has become something else, and it leans toward the warmth of you.',
          'fungal-zombie':     'A grower stands up out of the beds, pale growth splitting the seams of their coveralls.',
          'myconid-sovereign': '{{name}} rises at the head of the beds, taller than the trellis, and the whole deck turns its caps toward you.',
          'flying-sword':      'A cutting arm tears off its rail, hangs in the air, and spins up to a whine.',
          'magma-mephit':      'Burning gas comes out of the vent and does not disperse. It gathers instead, and it chooses.',
          'animated-armor':    'A maintenance suit steps down off its cradle and sets its feet, with nobody inside it.',
          'will-o-wisp':       'A small light drifts down the gallery at head height, almost friendly, then goes white and hard.',
          'stone-sentinel':    '{{name}} grinds around on its mount, a frame the size of a bunk block, and its lamp settles on you.',
          'ice-mephit':        'Cold pours off the outer door and takes a shape that holds its own edges.',
          'veteran':           'The suit captain sets her feet in the doorway and rolls one shoulder. "Nobody goes up today."',
          'air-elemental':     'The outer door cycles when nobody asked it to, and what comes through has weight, and direction, and intent.',
        },

        enemyIntroGeneric: '{{name}} puts itself between you and the way on, and it has not come to talk.',
      },

      // Kind vocabulary. Only keys the base bundle already carries — an
      // invented key is not an override, it is a silent no-op that reads as
      // applied. The lines that are pure placeholders ({{name}} — {{climate}})
      // are left alone: they say nothing genre-specific in any world.
      map: {
        empty:          'You have not yet mapped the shelter.',
        header:         '── Known shelter ──',
        connectsLine:   '    → ways on: {{names}}',
        rumouredHeader: 'Beyond the levels you have walked:',
        heldBy:         '— home level of {{names}}',
        portMark:       '☼',
      },

      // The "sea crossing" of this world: the surface. Two shelters are joined
      // only over the top, suited, at night, in stages — {{days}} still means
      // days, and every one of them is a night stage and a day spent lying up.
      sail: {
        noLane:      'No surface route leaves this level.',
        depart:      'You suit up and go over the top — {{days}} days of night stages toward {{name}}.',
        sight:       'A mast light finds the far hatch at last: {{name}}. {{digest}}',
        arriveKnown: 'The crossing is routine now. You cycle down into {{name}}.',
        arrive:      'The lock cycles and lets you down into {{settlement}}, on the upper level of {{name}}.',
        noPassage:   'Nobody goes up today. The lock stays sealed and the roster does not move.',
        arrivalNote: 'You came over the top in {{days}} days of night stages — the grit of the crossing still in the seams of your suit.',
      },

      settlement: {
        sailChip: 'Go over the top to {{name}}',
      },

      lexicon: {
        kind: {
          continent:  'shelter',
          province:   'level',
          region:     'sector',
          settlement: 'ring',
          place:      'bay',
          npc:        'neighbour',
          creature:   'stray',
          faction:    'bloc',
          item:       'kit',
          quest:      'work order',
        },
      },
    },
  },

  imageStyle:
    'Soft graphite sketch of a lamp-lit concrete interior — bare bulbs, painted pipework, worn handrails, deep shadow past the throw of the light. ' +
    'Drawn with a blunt pencil on ruled maintenance paper, smudged at the edges. ' +
    'No text, no labels, no writing of any kind. No borders, no frames, no decorative edges.',

  promptLine: {
    en: 'This setting is a sealed underground shelter of levels, sectors and lamp-lit rings where light, air and water are metered, the records are edited, and the surface is lethal and crossed only at night in a suit — nothing medieval or open-air exists in it: no castles, no horses, no fields, no sky anybody living has stood under.',
    nl: 'Deze wereld is een verzegelde ondergrondse schuilplaats van niveaus, sectoren en lampverlichte ringen waar licht, lucht en water op de meter gaan, de archieven worden bijgewerkt, en het oppervlak dodelijk is en alleen \'s nachts in een pak wordt overgestoken — niets middeleeuws of bovengronds bestaat er: geen kastelen, geen paarden, geen velden, geen hemel waar iemand die nog leeft onder heeft gestaan.',
  },
});
