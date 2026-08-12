// src/settings/pack-deep-holds.js — the far reskin that never goes outside.
//
// neon-stacks proved the seams survive a change of era. This pack asks a
// narrower question: what happens when a setting deletes the sky? Every layer
// of the world tree becomes a hole in rock — a deep, a hold, a delve, a hall —
// and the sea lane between two coasts becomes the long dark: days of unlit
// connecting tunnel with waystations on it. Everything the engine calls
// travel, weather, frontier and homeland still runs; none of it may say
// horizon. If a genre assumption about being outdoors survived anywhere, this
// is the pack that makes it audible.
//
// Nothing mechanical moves. Every stat block is the SRD's, every DC is the
// resolver's, every id in `overlays` is one the bestiary already knows. A
// skeleton here is a body laid in the burial courses two centuries ago, with
// the same thirteen hit points it had as a guard skeleton.
//
// On the setting: §7.4 bites from the opposite side here. No real community is
// being borrowed — but this genre's own caricature is one adjective away at
// all times, and it is the drinking joke, the phonetic accent and the beard.
// The register is the only guard, so the register is doing the work: a mining
// civilisation whose engineering is its religion, whose law is cut in stone
// because stone outlasts the argument, and whose deepest problem is that every
// seam worth having is behind a wall their grandparents built for a reason.
// Terse, material, and never funny about itself.

export const PACK = Object.freeze({
  id: 'deep-holds',
  packVersion: 1,
  era: 'medieval',

  card: {
    en: {
      name: 'The Deep Holds',
      blurb: 'An underground civilisation of cut holds and worked seams, where air, water and timber are counted by the day and every rich seam lies behind a wall somebody sealed for a reason.',
    },
    nl: {
      name: 'De Diepe Holden',
      blurb: 'Een ondergrondse beschaving van uitgehouwen holden en bewerkte aders, waar lucht, water en stuthout per dag geteld worden en elke rijke ader achter een muur ligt die iemand met reden dichtmetselde.',
    },
  },

  // ─── Blueprint palettes ────────────────────────────────────────────────────
  // Partial: tones, beat arcs and god domains inherit. The domain epithets are
  // deliberately name-free, and a founder-myth patron reads as an ancestor here
  // without any help — which is exactly the case the library kept them for.
  tables: {
    worldArchetypes: [
      'a deep worked out and living on its rents',
      'the great seam found again, in sealed ground',
      'two holds and one aquifer',
      'a debt of two centuries called in at last',
      'the air-wrights holding a whole deep to ransom',
      'a hold that sold its ancestor-vault to the surface',
      'grain bought from above at a price the deep cannot meet',
      'the lower galleries flooding a course a year',
      'a survey proving the boundary courses were cut wrong',
      'an exile hold digging back toward the deep that cast it out',
      'a new shaft sunk against every reckoner\'s advice',
      'timber gone, and every prop in the deep counted twice',
    ],

    // Material, arithmetical, and mostly slow: a deep is killed by the air
    // budget long before it is killed by anything with teeth. Two entries stay
    // open-ended ('opened something', 'nobody saying who ordered it') because a
    // threat table that names the monster spends the discovery.
    threatTypes: [
      'a flooded seam',
      'a failing air shaft',
      'a two-century debt called in',
      'a collapse that opened something',
      'firedamp in the low workings',
      'the timber ration halved',
      'a boundary dispute settled with picks',
      'a hold cutting off the water tribute',
      'the ancestor-vault broken into',
      'rock burst in the deep drifts',
      'blight in the grain caverns',
      'the lower gangs walking off shift',
      'a hold sealed from the outside, and nobody saying who ordered it',
    ],

    factionArchetypes: [
      { type: 'delve guild',       desc: 'the gangs who cut the rock, and who settle by seniority which face a hand works' },
      { type: 'reckoners',         desc: 'keepers of the debt-stone: every loan, tribute and blood-price cut where all can read it' },
      { type: 'ancestor-wardens',  desc: 'wardens of the burial courses, who count the dead as a hold\'s second population' },
      { type: 'air-wrights',       desc: 'shaft and fan-house engineers whose walkout would empty a deep in three days' },
      { type: 'water court',       desc: 'arbiters of sumps, springs and drainage, and of who pays for the pumping' },
      { type: 'lamp house',        desc: 'issuers of oil, wick and flame, and the only people who know what the air is doing' },
      { type: 'prop-wrights',      desc: 'importers and setters of pit timber, holding the one thing keeping the roof up' },
      { type: 'stone-law bench',   desc: 'a court that reads judgements cut two hundred years ago and applies them unchanged' },
      { type: 'exile hold',        desc: 'a hold cast out under an old judgement, working ground nobody else will claim' },
      { type: 'surface factors',   desc: 'brokers who buy grain and timber above and sell it down at the deep\'s own rates' },
      { type: 'seam prospectors',  desc: 'freelance finders who sell the location of a seam and never the working of it' },
      { type: 'gate-head wardens', desc: 'the crews who keep the long dark passable and decide which parties go through' },
      { type: 'cavern granaries',  desc: 'growers of the deep\'s own food, and the loudest voice against any new shaft' },
    ],

    // The legacy 20-climate table is the last surface vocabulary left in the
    // blueprint: `buildBlueprint` rolls it into `climate` and renders it into
    // the worldgen context ("Climate: mangrove swamp"), and `flow.js` falls
    // back to it when a region has none. A world with no sky cannot inherit
    // it. `settlementTypes` has to come with it in the same breath — the
    // singleton looks the palette up BY climate name and falls back to
    // `settlementTypes['temperate forest']`, so overriding one without the
    // other hands an underground hold a farming village.
    climates: [
      'dry limestone galleries', 'wet chalk workings', 'granite deeps', 'salt beds',
      'coal measures', 'iron seams', 'frost-cracked upper galleries', 'flooded lower drifts',
      'basalt heat galleries', 'gypsum caverns', 'shale slips', 'sandstone sumps',
      'quartz reefs', 'clay swells', 'fungus caverns', 'undersea workings',
      'crest adits', 'ash beds', 'ancestor courses', 'sealed ground',
    ],

    settlementTypes: {
      'dry limestone galleries':      ['cut hall', 'guild hall', 'shift town'],
      'wet chalk workings':           ['pump works', 'drain-gate hall', 'seep works'],
      'granite deeps':                ['deep hall', 'stone-law hall', 'gate-head hall'],
      'salt beds':                    ['salt works', 'brine hall', 'store-cavern hall'],
      'coal measures':                ['lamp-house hall', 'firedamp works', 'gang town'],
      'iron seams':                   ['smelt works', 'forge hall', 'ore-floor town'],
      'frost-cracked upper galleries': ['frost-gate hall', 'cold store works', 'upper gallery hall'],
      'flooded lower drifts':         ['sump hall', 'pump works', 'raft landing'],
      'basalt heat galleries':        ['forge hall', 'heat-gallery hall', 'slag works'],
      'gypsum caverns':               ['plaster works', 'white hall', 'quarry hall'],
      'shale slips':                  ['timber hall', 'shored hall', 'prop-yard works'],
      'sandstone sumps':              ['cistern hall', 'water-court hall', 'seep works'],
      'quartz reefs':                 ['assay hall', 'stamp works', 'claim town'],
      'clay swells':                  ['brick works', 'kiln hall', 'mud-gate hall'],
      'fungus caverns':               ['grow-cavern hall', 'bed works', 'granary hall'],
      'undersea workings':            ['tide-gate works', 'sea-adit hall', 'salt-gate hall'],
      'crest adits':                  ['crest-gate hall', 'high adit works', 'wind-gate hall'],
      'ash beds':                     ['dust works', 'ration hall', 'dry delve'],
      'ancestor courses':             ['vault hall', 'warden hall', 'lamp-rota hall'],
      'sealed ground':                ['watch hall', 'sealed-gate hall', 'gate-head works'],
    },

    // Exactly six, all invented compounds. Every one of them is a place a hold
    // would have a policy about: ground it sealed, ground it buries in, ground
    // it lost to water, heat, crop or somebody older.
    dungeonThemes: [
      'sealed seam', 'ancestor vault', 'drowned works',
      'magma gallery', 'fungus deep', 'collapsed undercity',
    ],

    buildingTypes: [
      'lamp house', 'fan house', 'pump gallery', 'prop yard',
      'assay office', 'debt-stone hall', 'ore floor', 'smelt hall',
      'grain cavern', 'mushroom bed', 'cistern house', 'rope walk',
      'tally office', 'bath house', 'guild lodge', 'gate-head barracks',
    ],

    locationTypes: [
      'sealed adit', 'winding shaft', 'sump head', 'ventilation drift',
      'ancestor gallery', 'boundary course', 'rock-burst face', 'abandoned stope',
      'inclined drift', 'waystation', 'ladderway', 'cage landing',
      'spoil heap', 'collapse mouth', 'water gate', 'survey marker',
    ],
  },

  // The bands describe how a place feels to stand in, not what latitude it sits
  // at — which is what lets a world with no sky wear them. Upper burial
  // galleries are frozen, heat workings are volcanic, the sumps are mire, the
  // crest adits are highland, the grain caverns are tropical, and a working
  // driven out under the sea is coastal. All eight are claimed: an unclaimed
  // band falls back to the whole theme list, which is a worse fit than a
  // deliberate one.
  themeClimates: {
    'sealed seam':         ['temperate', 'arid', 'highland'],
    'ancestor vault':      ['frozen', 'arid', 'temperate'],
    'drowned works':       ['mire', 'coastal'],
    'magma gallery':       ['volcanic', 'arid'],
    'fungus deep':         ['tropical', 'mire', 'temperate'],
    'collapsed undercity': ['highland', 'coastal', 'frozen'],
  },

  bandSettlements: {
    temperate: ['cut hall', 'works hall', 'guild hall', 'shift town'],
    arid:      ['dust works', 'cistern hall', 'ration hall', 'dry delve'],
    frozen:    ['frost-gate hall', 'cold store works', 'upper gallery hall'],
    tropical:  ['grow-cavern hall', 'bed works', 'warm-seam hall'],
    volcanic:  ['forge hall', 'smelt works', 'heat-gallery hall', 'slag works'],
    coastal:   ['tide-gate works', 'sea-adit hall', 'salt works'],
    highland:  ['crest-gate hall', 'high adit works', 'wind-gate hall'],
    mire:      ['sump hall', 'pump works', 'drain-gate hall', 'seep works'],
  },

  // What the reckoners say about a hold nobody here has worked. The library's
  // pool talks of sailors and caravans; underground, distance is measured in
  // air, water and who owes whom.
  stubHooks: [
    'its air comes from somewhere nobody has surveyed',
    'the debt-stone there was cut over, not added to',
    'two holds claim the same seam and neither will open the ledger',
    'the water in its lower works runs warm',
    'nobody from there has come up the long dark in nine years',
    'their ancestor-vault is sealed from the inside',
  ],
  // ─── Naming culture ────────────────────────────────────────────────────────
  // Hard consonants, all invented: real morphemes concatenate into real place
  // names sooner or later and §7.4 does not survive a lucky roll. Prefix +
  // suffix is a bare string join in the library, so every pair here was checked
  // for doubled consonants at the seam — 'Vald' + 'dur' is why there is no
  // prefix ending in the letter a suffix opens on.
  syllables: {
    continentPrefixes: ['Grum', 'Barn', 'Kaz', 'Thurn', 'Dor', 'Valg', 'Brek', 'Skorn', 'Hulm', 'Murg'],
    continentSuffixes: ['dur', 'gard', 'grim', 'thak', 'burn', 'stok', 'kar', 'morn', 'runn', 'holt'],
    provincePrefixes:  ['Ord', 'Kruk', 'Bren', 'Torv', 'Gald', 'Nurg', 'Skaf', 'Drum', 'Vek', 'Harn', 'Brok', 'Zorn'],
    provinceSuffixes:  ['hold', 'gate', 'deep', 'shaft', 'seam', 'stone', 'vault', 'drift', 'works', 'span', 'ledge', 'reach'],
  },

  // ─── Dungeon overlays ──────────────────────────────────────────────────────
  // Ascending challenge, last id is the vault boss. No id appears in two pools:
  // display names are keyed by id globally, so one stat block cannot be both a
  // fissure spider and a rubble weaver.
  overlays: {
    'sealed seam': {
      atmosphere: 'The sealing wall came down from the inside, and the draught has not stopped since.',
      enemies: ['kobold', 'goblin', 'hobgoblin', 'ogre', 'young-drake'],
    },
    'ancestor vault': {
      atmosphere: 'Names in courses to the roof, lamp oil kept topped up, and nobody here to keep it.',
      enemies: ['skeleton', 'zombie', 'specter', 'wight', 'banshee'],
    },
    'drowned works': {
      atmosphere: 'The water is chest-deep, cold, and moving in a direction the survey does not allow.',
      enemies: ['giant-rat', 'swarm-of-rats', 'constrictor-snake', 'crocodile', 'gibbering-mouther'],
    },
    'magma gallery': {
      atmosphere: 'The rib will not take a hand for a count of three, and the lamp burns tall and pale.',
      enemies: ['magma-mephit', 'imp', 'will-o-wisp', 'hell-hound', 'lesser-demon'],
    },
    'fungus deep': {
      atmosphere: 'Warm, wet, and smelling of bread left too long. Something has been eating the beds.',
      enemies: ['violet-fungus', 'fungal-zombie', 'ghoul', 'ankheg', 'myconid-sovereign'],
    },
    'collapsed undercity': {
      atmosphere: 'Stonework jointed finer than this hold can cut, and a street under the fall.',
      enemies: ['cave-spider', 'flying-sword', 'giant-spider', 'animated-armor', 'stone-sentinel'],
    },
  },

  // What the map promises about a delve nobody has walked. Every one is a
  // reading somebody took: a draught, a sound, a lamp, an assay, a tally.
  frontierHooks: [
    'a draught coming out of ground nobody has cut',
    'water heard behind the face',
    'lamps that will not stay lit past the third drift',
    'a hold that stopped answering the tallies',
    'prop marks in a working sealed two hundred years ago',
    'a seam that assays too rich to have been left',
  ],

  // Inherit: the library keys these by god domain, and a founder-relic reads
  // correctly as an ancestor's grave-good without a pack override.
  domainTreasures: null,
  domainKeys: null,

  // The record still says `classId: 'wizard'` and the sheet still derives from
  // the same SRD data. Only the word on the button moves.
  classSkins: {
    fighter: { en: 'Gate-Warden' },
    rogue:   { en: 'Prospector' },
    cleric:  { en: 'Ancestor-Speaker' },
    wizard:  { en: 'Rune-Wright' },
  },
  speciesSkins: null,

  // ─── Voice ─────────────────────────────────────────────────────────────────
  // This block rides in every narrator, dialogue, travel and journal prompt for
  // the length of a campaign, so it is a recurring bill. It is also the only
  // defence against the caricature this genre invites, hence `forbid`: those
  // four words belong to comic-fantasy dwarves, which is a different world, and
  // nothing this pack or the base bundle can roll produces them.
  voice: {
    address:      ['kinsman', 'hold-guest'],
    register:     'terse and precise; figures where another world would use adjectives',
    honorifics:   ['reckoner, for anyone who keeps the stone'],
    exclamations: ['stone hold', 'by the roof'],
    forbid:       ['aye', 'lad', 'jolly', 'tankard'],
    examples: {
      narrator: ['The lamp leans toward the face and keeps leaning. The air is going somewhere.'],
      npc: [
        'Your line owes eleven hundred weight. The stone has it cut.',
        'Two lamps a shift, kinsman. The air will not carry a third.',
      ],
    },
    settingNoun: {
      en: 'a working hall of the deep holds',
      nl: 'een werkhal in de diepe holden',
    },
  },

  // ─── Locale content overlay ────────────────────────────────────────────────
  // English only. Dutch play falls through to pack-English by design: a
  // half-translated pack reads worse than an untranslated one, because the
  // untranslated one at least stays underground.
  i18n: {
    en: {
      world: {
        // What a dungeon IS here — every one of them is ground a hold has a
        // policy about. Substituted into the entrance descriptions as {{style}}.
        houseStyles: [
          'sealed working',
          'worked-out delve',
          'forfeited hold',
          'drowned lower gallery',
          'undercity nobody surveyed',
          'ancestor gallery gone untended',
        ],

        rooms: {
          entrance: [
            { name: 'Gate-Head',     desc: 'You stand at the gate-head of a {{style}}. The tally board beside the door still shows a shift that never came back up, chalked and left.' },
            { name: 'Lamp Room',     desc: 'The lamp room of a {{style}}: hooks for forty lamps and oil for none. The issue book lies open, its last column unsigned.' },
            { name: 'Adit Mouth',    desc: 'A cut stone adit opens into the {{style}}, its arch keyed and true. Cold air pushes steadily out past you, and it is coming from somewhere.' },
            { name: 'Cage Landing',  desc: 'The winding cage stands at the landing of the {{style}}, chained off at the rail. Someone barred the gate from this side and walked away.' },
            { name: 'Sealing Wall',  desc: 'A mortared wall closed this {{style}} a long lifetime ago. Someone has taken it down again, course by course, and stacked the stone neatly to one side.' },
          ],
          hall: [
            { name: 'Muster Floor',    desc: 'A floor cut wide enough for a whole shift to stand in ranks and be counted. The benches are set square and the roll board has been wiped clean.' },
            { name: 'Pillar Hall',     desc: 'Rock left standing in pillars holds up a ceiling the width of a street. Every pillar carries a cut number, and one has been robbed to half its width.' },
            { name: 'Ore Floor',       desc: 'A sorting floor of long stone tables, waste to one side and good rock to the other. Both heaps sit exactly where the last shift left them.' },
            { name: 'Debt-Stone Hall', desc: 'One wall is a ledger: names, weights and terms cut deep enough to outlast the argument. Three entries near the bottom have been ground out, and that grinding is fresh.' },
            { name: 'Winding House',   desc: 'The great drum stands in the middle of the floor with a hundred fathoms of rope still wound on it. The brake is off and nothing is moving.' },
          ],
          corridor: [
            { name: 'Main Drift', desc: 'The main drift runs straight and level, propped at a pace the whole way. The timber is sound underfoot and older than timber has any business being.' },
            { name: 'Crosscut',   desc: 'A crosscut driven to meet another working, its walls still carrying the marks of two gangs who met a hand\'s width out of true.' },
            { name: 'Ladderway',  desc: 'A ladderway drops through the floor in stages, rungs iron and slick. The count of stages does not agree with the survey cut at the head of it.' },
            { name: 'Air Drift',  desc: 'A narrow drift cut for air alone, too low to stand up in. The draught runs the wrong way along it, cold and steady.' },
            { name: 'Incline',    desc: 'An inclined roadway climbs away with rails set into the stone. A tub stands loaded halfway up, chocked with a wedge of prop timber.' },
          ],
          chamber: [
            { name: 'Pump Chamber',   desc: 'A chamber built around a pump that has not turned in years, its rod standing in the sump. The water below is flat, and the level is chalked on the wall higher each time.' },
            { name: 'Fan House',      desc: 'A wooden fan the width of a cart wheel sits in a walled cut, geared to a treadle nobody is treading. Every joint of it has been kept greased.' },
            { name: 'Assay Room',     desc: 'Scales, crucibles and sample trays, each tray marked with a working and a depth. One tray holds rock that assays better than anything else on the shelf.' },
            { name: 'Stope',          desc: 'The seam has been taken out here from floor to roof, leaving a hollow braced with timber and waste stone. The bracing has been added to twice, by different hands.' },
            { name: 'Survey Station', desc: 'A cut stone bench, a plumb line still hanging true, and the bearings of six drifts chiselled into the wall. One bearing runs into ground that should be solid.' },
          ],
          storage: [
            { name: 'Prop Yard',     desc: 'Pit timber stacked to the roof, sorted by length and banded. The count cut into the door post is short by more than a shift could use.' },
            { name: 'Oil Store',     desc: 'Sealed jars of lamp oil in stone racks, cool and full. Two racks stand empty and swept, and the dust says they emptied recently.' },
            { name: 'Grain Store',   desc: 'Sacks of surface grain on raised stone, roped against the damp. Most are sound. Two have been opened, emptied, and folded flat.' },
            { name: 'Tool Cache',    desc: 'Picks, wedges and hammers hung in order of size, every haft marked with a gang number. The gaps in the row are all the same size.' },
            { name: 'Water Cistern', desc: 'A cut cistern holds clean water behind a stone lip, fed by a pipe that still runs. A tin cup sits on the rim, dry.' },
          ],
          quarters: [
            { name: 'Shift Bunkroom',  desc: 'Sleeping shelves cut into the wall three high, each with a straw pallet and a lamp niche. Half the pallets have been carried out, and half have not.' },
            { name: 'Overman\'s Room', desc: 'One room with a desk, a slate and a locked box. The slate carries a rota that runs three days past the day the working stopped.' },
            { name: 'Wash House',      desc: 'Benches, hooks and a stone trough with a drain, all of it worn smooth. Work clothes still hang on the hooks, stiff with rock dust.' },
            { name: 'Family Cell',     desc: 'A cut room for a household: a stove flue, a shelf of small things, a bed frame. Heights are chiselled up the door jamb and stop at a child\'s shoulder.' },
            { name: 'Sick Room',       desc: 'Four beds, a shuttered lamp and a shelf of stoppered jars. The bedding from all four has been stripped and burned in the hearth.' },
          ],
          shrine: [
            { name: 'Ancestor Niche',  desc: 'Names fill the wall in cut niches, each with a lamp bracket and a measure of oil. Most brackets are cold. Two are not.' },
            { name: 'Vault Gallery',   desc: 'The hold\'s dead lie in courses behind cut slabs, oldest at the roof. One slab has been lifted out and set against the wall, face outward.' },
            { name: 'Oath Stone',      desc: 'A block of undressed rock stands alone on a swept floor, its top polished by hands. What is cut into it is a promise, and the terms are still legible.' },
            { name: 'Founder\'s Cut',  desc: 'The first working of this hold, kept as it was found: a face worked with hand tools, one lamp burning, the tools laid down beside it.' },
            { name: 'Silence Gallery', desc: 'A gallery kept unworked and unlit by rule. There is a bell rope, a bench, and a standing order about noise that everyone here obeys.' },
          ],
          vault: [
            { name: 'Strong Cut',         desc: 'A strong room cut into living rock behind a door of banded iron, standing open. On the shelf inside, exactly where the inventory says, is {{treasure}}. A drift runs on toward air.' },
            { name: 'Reckoners\' Vault',  desc: 'The debt-stone\'s own strong room, where settlements are kept once the terms are met. The last account was closed and left weighted down by {{treasure}}. A stair climbs out.' },
            { name: 'Founder\'s Deposit', desc: 'A chamber sealed when the hold was first cut, opened once a century by right. The seal is broken, and {{treasure}} sits on the plinth in the middle of the floor. A hatch opens on a lit drift.' },
            { name: 'Rich Face',          desc: 'The seam runs true here and wide enough to walk into. Set in the rock, worked around and never taken, is {{treasure}}. A ladderway leads up.' },
            { name: 'Assay Strongroom',   desc: 'The assay strongroom, its trays emptied and its ledger gone. Bolted under the bench, missed by whoever cleared the rest, is {{treasure}}. The gate at the far end is unbarred.' },
          ],
        },

        dressing: {
          'sealed seam': [
            'The sealing wall has been taken down from the inside.',
            'Chalk on the rib gives a date two hundred years before this one.',
            'A lamp flame leans toward the face and stays leaning.',
            'Tool marks in the fresh cut match no pattern in use.',
            'The prop timber here is a wood that no longer grows above.',
            'Someone has re-cut the survey marks and left the old ones beside them.',
          ],
          'ancestor vault': [
            'Oil has been topped up in a bracket nobody is charged to keep.',
            'A slab sits out of its course, and the mortar dust is still soft.',
            'The name cut here has been added to in a second, later hand.',
            'Offerings of ore sit in the niches, sorted by grade.',
            'The floor has been swept toward the door and left in a heap.',
            'A bell rope hangs cut off at head height.',
          ],
          'drowned works': [
            'The water line on the rib is above the top of the doorway.',
            'A pump rod stands in the sump, seized and rusted solid.',
            'Prop timber floats in the drift, still roped into a raft.',
            'Silt has set in the rail bed in a smooth grey crust.',
            'Somebody drove a plug into the face, and it is weeping.',
            'Chalked level marks climb the wall a hand apart, then stop.',
          ],
          'magma gallery': [
            'The rib is too hot to keep a hand on for a count of three.',
            'A lamp flame here burns tall, pale and quiet.',
            'The floor rings hollow, and warmth comes up through the boot.',
            'Rock has run and set again in ropes along the wall.',
            'A watering pipe crosses the roof, dry and scaled with salt.',
            'The air tastes of struck flint and standing water gone bad.',
          ],
          'fungus deep': [
            'Beds of grey growth run in cut rows, tended and then not.',
            'Spores drift through the lamp beam like slow snow.',
            'The floor gives underfoot, half rock and half mat.',
            'A crop tally is chalked on the rib, the last figure crossed out.',
            'Something has been eating the beds from the far end inward.',
            'The air is warm, wet, and smells of bread left too long.',
          ],
          'collapsed undercity': [
            'The stonework here is jointed finer than this hold can cut.',
            'A street runs under the rubble, kerbed and drained.',
            'Roof falls have been cleared, stacked and squared by somebody.',
            'Iron pins stand in the wall in a pattern with no obvious use.',
            'A doorway is cut for a body a head taller than yours.',
            'The dust on the floor holds one set of tracks, going in.',
          ],
        },

        dressingGeneric: [
          'A draught moves the lamp flame and lets it settle again.',
          'Chalk marks on the rib give a gang number and a date.',
          'A prop has taken weight and split along the grain.',
          'Water beads on the roof stone and drips at a steady count.',
          'Somebody scratched a tally here and stopped at nine.',
          'Rock dust lies even on the floor, and one boot print crosses it.',
        ],

        treasures: [
          { name: 'settled debt-stone',      desc: 'A cut block recording a debt of two centuries, and under it the mark that says it is paid in full.' },
          { name: 'founder\'s survey plate', desc: 'A bronze plate cut with the first bearings of a hold, accurate enough that it is still worth killing for.' },
          { name: 'ancestor lamp',           desc: 'A lamp of worked silver, kept alight by rota from the day the hold was first cut.' },
          { name: 'seam charter',            desc: 'A slate charter granting the working of a seam — sealed, undisputed, and worth more than the seam.' },
        ],

        keys: [
          { name: 'warden\'s gate key', desc: 'A long iron key, its bit cut in three steps, worn bright at the bow.' },
          { name: 'guild seal-key',     desc: 'A brass key stamped with a guild mark, issued by seniority and never lent.' },
          { name: 'vault slab wedge',   desc: 'A steel wedge ground to one slab in one course, and useless anywhere else.' },
          { name: 'lamp-house tally',   desc: 'A notched rod that opens the oil store and records that it was opened.' },
        ],

        // Field sets match the base item for item — heals+consumable, value,
        // lore, gold+consumable — because the resolver reads the fields, not
        // the names.
        loot: [
          { name: 'stone-bruise salve', desc: 'A flat tin of grey salve that takes the heat out of a crush and lets the hand close again.', heals: 8, consumable: true },
          { name: 'seniority ring',     desc: 'A plain iron ring with a gang number and a count of years cut inside the band.', value: 25 },
          { name: 'overman\'s slate',   desc: 'A shift slate still carrying a rota, a water reading and a note that stops mid-word.', lore: true },
          { name: 'purse of hold coin', desc: 'A short string of struck coin, good in this hold and argued over in the next.', gold: 15, consumable: true },
        ],

        // Same stat block, different clothes. The skeleton is a body laid in
        // the burial courses; it has a guard skeleton's thirteen hit points.
        enemyNames: {
          'giant-rat':         'Drift Rat',
          'wolf':              'Drift Dog',
          'bandit':            'Toll-Taker',
          'goblin':            'Seam Thief',
          'scout':             'Claim-Watcher',
          'worg':              'Pit Wolf',
          'black-bear':        'Cave Bear',
          'dire-wolf':         'Deep Wolf',
          'skeleton':          'Vault-Laid Dead',
          'cultist':           'Grave-Tender',
          'zombie':            'Roof-Fall Dead',
          'cave-spider':       'Fissure Spider',
          'kobold':            'Rubble-Picker',
          'hobgoblin':         'Drift-Gang Soldier',
          'ogre':              'Roof-Breaker',
          'young-drake':       'Sealed-Ground Drake',
          'specter':           'Unsettled Account',
          'wight':             'Standing Founder',
          'banshee':           'Vault Keener',
          'swarm-of-rats':     'Sump Swarm',
          'constrictor-snake': 'Cistern Serpent',
          'crocodile':         'Sump Lurker',
          'gibbering-mouther': 'Drowned Chorus',
          'magma-mephit':      'Slag Spitter',
          'imp':               'Flue Creeper',
          'will-o-wisp':       'Firedamp Light',
          'hell-hound':        'Slag Hound',
          'lesser-demon':      'Furnace Shape',
          'violet-fungus':     'Rot Cap',
          'fungal-zombie':     'Spore-Struck',
          'ghoul':             'Blight Eater',
          'ankheg':            'Bed-Borer',
          'myconid-sovereign': 'The Standing Crop',
          'flying-sword':      'Kept Blade',
          'giant-spider':      'Rubble Weaver',
          'animated-armor':    'Standing Harness',
          'stone-sentinel':    'Undercity Sentinel',
        },

        enemyIntros: {
          // The travel and fallback pools first: OVERWORLD_ENEMY_IDS and
          // DEFAULT_ENEMY_IDS are reached without consulting an overlay, so a
          // pack that skins only its own themes still meets a "Wolf" in the
          // long dark and a "Goblin" in a dungeon with no theme match.
          'giant-rat':   'A rat the length of your forearm comes out of the spoil at a flat run, wet-backed and unbothered by the lamp.',
          'wolf':        'A dog gone wild in the drifts comes out of the dark at knee height, ribs showing, with no bark in it.',
          'bandit':      'A toll-taker steps into the lamplight with a pick handle. "Nobody said you were coming through."',
          'goblin':      'A seam thief drops off the rib with a stolen wedge in each hand and no intention of explaining itself.',
          'scout':       'A claim-watcher rises from behind the spoil with a bow half-drawn. "This ground is cut and held."',
          'worg':        '{{name}} comes down the drift at a trot, shoulder-high, taking its time about it.',
          'black-bear':  'Something the size of an ore tub uncoils out of a side working and stands up into the lamplight.',
          'dire-wolf':   '{{name}} fills the drift rib to rib, head low, and the lamp finds nothing behind its eyes.',
          'skeleton':    'A body laid in the courses two hundred years ago puts a hand out of its slab and takes hold of the edge.',
          'cultist':     'A grave-tender turns from the niche wall, oil jar in one hand and a knife already in the other.',
          'zombie':      'A man the roof came down on drags himself upright, still wearing the gang number he died in.',
          'cave-spider': 'A crack in the rib empties itself of legs, and the thing riding them is low and black and fast.',

          'kobold':            'A rubble-picker scrambles up out of the fall with a sharpened rail spike, all fear and spite.',
          'hobgoblin':         '{{name}} comes on in order, shield up, and does not hurry. This one has done it before.',
          'ogre':              'Something has been working this seam without tools. It straightens, and takes the roof timber with it.',
          'young-drake':       'The heat arrives before the shape does. {{name}} uncoils in the sealed working, and the wall makes sense at last.',
          'specter':           'The lamp goes blue. Something that was never settled comes down the drift, keeping the exact pace you set.',
          'wight':             'A founder of this hold steps down out of its course, grave-goods and all, and reads you as a trespass.',
          'banshee':           '{{name}} unfolds out of the vault dark and opens a mouth the whole gallery hears at once.',
          'swarm-of-rats':     'The standing water breaks apart into rats and comes at you across the drift as one moving floor.',
          'constrictor-snake': 'Coils come over the cistern lip one after another, unhurried, tasting the lamp-warm air.',
          'crocodile':         'Something long and plated leaves the flooded gallery in a single surge, jaws already open.',
          'gibbering-mouther': 'The water heaves up into a shape full of mouths, and every one of them is using a voice you know.',
          'magma-mephit':      'A knot of running rock pulls itself off the hot rib and spits.',
          'imp':               'Something small comes down the flue headfirst, grinning, entirely at home in the heat.',
          'will-o-wisp':       'A light drifts up the gallery ahead of you, steady and friendly, the way the ones that kill men always are.',
          'hell-hound':        '{{name}} comes out of the gallery mouth with the heat rolling ahead of it, and the lamp is no longer the brightest thing here.',
          'lesser-demon':      'The gallery floor cracks, and what stands up out of it is a thing this hold has a word for and does not use.',
          'violet-fungus':     'A grey cap the height of a man turns on its stalk and reaches, unhurried.',
          'fungal-zombie':     'A miner who never came up walks out of the beds, pale growth splitting the seams of his coat.',
          'ghoul':             'Whatever has been eating the beds from the far end comes at you on too many joints.',
          'ankheg':            'The floor of the bed gives, and what comes up through it is armoured, long, and already biting.',
          'myconid-sovereign': 'The crop at the far end of the cavern stands up all at once, and one part of it walks.',
          'flying-sword':      'A blade lifts off the pegs where somebody left it, comes to guard, and holds there.',
          'giant-spider':      'A weaver drops out of the roof fall on a line thicker than your thumb, far too fast for its size.',
          'animated-armor':    'A harness of old plate steps down off its stand with nobody inside it and sets its feet.',
          'stone-sentinel':    '{{name}} turns on its plinth with a grinding of stone on stone. It has been waiting a long time to do that.',
        },

        enemyIntroGeneric: '{{name}} sets itself between you and the drift, and there is no talking to it.',
      },

      // Kind vocabulary. Only keys the base bundle already has — an invented
      // key is not an override, it is a silent no-op that reads as applied.
      map: {
        empty:          'You have surveyed none of the deep yet.',
        header:         '── Surveyed deep ──',
        connectsLine:   '    → drifts run toward: {{names}}',
        rumouredHeader: 'Beyond the workings you have walked:',
        heldBy:         '— home hold of {{names}}',
        // Marks a hold with a gate-head on it: the mouth of a long dark.
        portMark:       '⛏',
      },

      // The sea crossing, in a world with no sea: days of unlit connecting
      // tunnel between two deeps, waystation to waystation. {{days}} still
      // means days.
      sail: {
        noLane:      'No long dark opens from this hold.',
        depart:      'You draw oil, sign the gate book and take the long dark — {{days}} days of unlit tunnel toward {{name}}.',
        sight:       'Cut stone returns, and the waystation lamps of {{name}} come up out of the black. {{digest}}',
        arriveKnown: 'You know the count of waystations now. The long dark puts you out in {{name}}.',
        arrive:      'The passage ends at the gate-head of {{settlement}}, inside {{name}}.',
        noPassage:   'No party goes through today. The gate-head is barred and the warden will not open it.',
        arrivalNote: 'You came up out of the long dark after {{days}} days, and the lamp-black is still in the seams of your hands.',
      },

      settlement: {
        sailChip: 'Take the long dark to {{name}}',
      },

      lexicon: {
        kind: {
          continent:  'deep',
          province:   'hold',
          region:     'delve',
          settlement: 'hall',
          place:      'working',
          npc:        'kin',
          creature:   'hazard',
          faction:    'guild',
          item:       'stock',
          quest:      'writ',
        },
      },
    },
  },

  imageStyle:
    'Lamp-lit graphite section drawing of a deep stone working — cut galleries, timber props, iron ladderways, one lamp as the only light source. ' +
    'Drawn hard and precise in a surveyor\'s field book, smudged with rock dust, no colour beyond graphite grey. ' +
    'No borders, no frames, no decorative edges. No text, no labels.',

  promptLine: {
    en: 'This setting is an underground civilisation of cut holds, worked seams and ancestor-vaults where air, water, timber and grain are counted, owed and recorded in stone, and there is no surface world in play — no sky, no sea, no forest, no horses, and no comic drunken dwarves.',
    nl: 'Deze wereld is een ondergrondse beschaving van uitgehouwen holden, bewerkte aders en voorouderkelders waar lucht, water, stuthout en graan geteld, verschuldigd en in steen vastgelegd worden, en waarin geen bovenwereld voorkomt — geen lucht, geen zee, geen bos, geen paarden, en geen komische dronken dwergen.',
  },
});
