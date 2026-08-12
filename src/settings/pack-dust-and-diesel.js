// src/settings/pack-dust-and-diesel.js — the far reskin with nothing to hide behind.
//
// neon-stacks proved the seams carry a genre flip by flipping to a genre that
// does not exist: nobody lives in a vertical mega-city, so nobody can be got
// wrong. This pack points the same machinery at a place people actually live —
// a working-class port city and the self-built settlements around it, late in
// the twentieth century — and that is the whole reason it is here. If the seams
// only work when the setting is safely imaginary, they are a party trick.
//
// Nothing mechanical moves. Every stat block is the SRD's, every DC is the
// resolver's, every id in `overlays` is a creature the bestiary already knows.
// A skeleton is a welding frame with the same thirteen hit points.
//
// On the setting: doc 19 §7.4 is binding, and this is the pack it was written
// for. The texture — minibus routes that are their own economy, sound systems,
// standpipe queues, a football pitch that is the neighbourhood's parliament, a
// city administration that shows up to demolish or to campaign — is drawn from
// real African port-city life in the 1990s, so every proper noun is invented,
// the syllable banks are invented phonetics rather than borrowed morphemes, and
// nothing here names a country, a city, a language, a people, a party or a
// person. There is no mock-dialect spelling anywhere in this file: the register
// is carried by cadence, address terms, humour and what people are talking
// about, which is fares, tankers, transformers and whose cousin has the papers.
//
// The other bar, which no lint can check: the residents of this world are
// competent, funny and entrepreneurial people running a working society under
// pressure. Poverty is a condition here, not a character trait. Enemies with
// faces have reasons — a yard owner robbed twice this year, a night-watch
// volunteer who has decided what you are, a guard who was told nobody is inside
// the fence tonight. Nobody in this file is scenery for someone else's danger.

export const PACK = Object.freeze({
  id: 'dust-and-diesel',
  packVersion: 1,
  era: 'modern',

  card: {
    en: {
      name: 'Dust and Diesel',
      blurb: 'A 1990s port city on an invented coast and the yards that ring it, where the routes, the standpipe and the football pitch are the real government.',
    },
    nl: {
      name: 'Stof en Diesel',
      blurb: 'Een havenstad uit de jaren negentig aan een verzonnen kust en de erven eromheen, waar de routes, de standpijp en het voetbalveld de echte regering zijn.',
    },
  },

  // ─── Blueprint palettes ────────────────────────────────────────────────────
  // Partial: tones, beat arcs, climates and god domains inherit the library
  // table. The god-domain epithets stay — they are name-free by design and read
  // here as the founding story a congregation or a burial society tells about
  // itself, which is exactly what they are for.
  tables: {
    worldArchetypes: [
      'a port that grew past its own plan and kept going',
      'a boom that arrived and left inside one decade',
      'a currency nobody trusts twice in the same week',
      'a coast that exports everything and keeps nothing',
      'a city administration that visits to demolish or to campaign',
      'a settlement older than the map that says it is not there',
      'a generation with schooling and nowhere to put it',
      'ground with four registered owners and one family living on it',
      'a river the city put in a pipe and then forgot',
      'a route network that moves more people than the state does',
      'a harbour rebuilt with money nobody will name out loud',
      'a dry season that starts earlier every year',
    ],

    // Material and human-scale: fares, water, paperwork, weather, and men with
    // a court order. Nothing here is a monster; everything here is a Tuesday
    // that somebody has to be talked through.
    threatTypes: [
      'a route war between two associations',
      'a demolition notice with a date on it',
      'the water tanker that stopped coming',
      'election season',
      'a currency that halved overnight',
      'a fire in the dry season',
      'the factory closing',
      'the transformer blown for the third time',
      'a burst main and a boil-water rumour',
      'a police sweep before an official visit',
      'the landlord selling the block out from under it',
      'rain arriving on ground that cannot take it',
      'the bridge closed and every route rerouted',
      'fuel gone to queue prices',
    ],

    factionArchetypes: [
      { type: 'route association',   desc: 'owners and drivers who set the fares, hold the ranks and decide who is allowed to load' },
      { type: 'water committee',     desc: 'householders elected to hold the standpipe key and argue with the tanker schedule' },
      { type: 'church school',       desc: 'a congregation running the only classroom, and knowing every family inside it' },
      { type: 'scrap dealers',       desc: 'buyers with a weighbridge and an opinion about where your copper came from' },
      { type: 'football club',       desc: 'a youth side that is also the yard\'s labour pool and its court of first instance' },
      { type: 'councillor\'s people', desc: 'the ward office\'s hands — lists, favours, and a van that appears before a vote' },
      { type: 'wholesalers',         desc: 'the families who front the stock at dawn and expect it settled by dark' },
      { type: 'night watch',         desc: 'volunteers with whistles and a rota, answerable to the corner and to nobody above it' },
      { type: 'sound crew',          desc: 'a system, a generator and a wall of dubbed cassettes; they decide what the street hears' },
      { type: 'traders\' committee', desc: 'stallholders who allocate pitches and remember exactly who was there first' },
      { type: 'burial society',      desc: 'a weekly subscription that buries you properly, and a book of who has paid' },
      { type: 'line crew',           desc: 'the electricians who bring the supply in off the pole and keep the whole row lit' },
      { type: 'landlord\'s agents',  desc: 'rent collectors for owners who have never once stood in the yard' },
      { type: 'demolition contractor', desc: 'a firm with a court order, a schedule, and men hired by the day to swing it' },
    ],

    // Exactly six, all grounded, all invented as phrases rather than borrowed.
    // Every one of them is a building the city stopped paying attention to,
    // which is the only kind of dungeon this setting has.
    dungeonThemes: [
      'dead factory', 'flooded culvert', 'scrapyard deep',
      'abandoned block', 'cargo shell', 'burnt market',
    ],

    buildingTypes: [
      'taxi rank', 'tuck shop', 'container shop', 'barber shack',
      'phone kiosk', 'drink yard', 'church hall', 'prayer hall',
      'cook shop', 'panel beater', 'welding shop', 'sewing room',
      'cassette stall', 'clinic room', 'school block', 'grain mill',
      'pool hall', 'generator shed',
    ],

    locationTypes: [
      'standpipe queue', 'earth pitch', 'route rank', 'weighbridge',
      'transformer pole', 'storm drain mouth', 'rubbish tip', 'water tank stand',
      'burnt stall row', 'unfinished slab', 'coach depot', 'ferry steps',
      'cell mast', 'dry riverbed', 'level crossing', 'fish landing',
    ],
  },

  // The bands describe how a place feels to stand in, not a latitude, which is
  // what lets one hot coast wear all eight: frozen is the ice plant and the fish
  // freezers, volcanic is the kilns and the burn tip, mire is the flood ground
  // below the drain outfall. Every band is claimed, or the province generator
  // hands a band a palette with nothing in it.
  themeClimates: {
    'dead factory':    ['temperate', 'arid', 'volcanic'],
    'flooded culvert': ['mire', 'tropical', 'coastal'],
    'scrapyard deep':  ['arid', 'temperate', 'highland'],
    'abandoned block': ['temperate', 'highland', 'frozen'],
    'cargo shell':     ['coastal', 'mire', 'frozen'],
    'burnt market':    ['arid', 'tropical', 'volcanic', 'highland'],
  },

  bandSettlements: {
    temperate: ['home yard', 'corner row', 'market corner', 'walk-up yard'],
    arid:      ['dust corner', 'tanker stop', 'queue yard', 'dry ground'],
    frozen:    ['ice-plant corner', 'cold-store yard', 'freezer row', 'chill dock'],
    tropical:  ['garden yard', 'green corner', 'shade row', 'rain yard'],
    volcanic:  ['kiln yard', 'charcoal corner', 'burn-tip row', 'furnace ground'],
    coastal:   ['landing corner', 'net yard', 'jetty row', 'salt corner'],
    highland:  ['ridge yard', 'top corner', 'mast ridge', 'high row'],
    mire:      ['flood yard', 'tide corner', 'reed row', 'silt ground'],
  },

  // What people at the rank say about a ward they do not run to. Practical,
  // funny where it can be, and never mysterious for its own sake.
  stubHooks: [
    'no route goes there after dark and nobody argues about why',
    'the tanker stopped calling and the standpipe still has a queue',
    'two associations sell the same fare there',
    'the council painted the numbers on and never came back',
    'their transformer has been fixed four times by four different men',
    'everyone there is somebody’s cousin, which cuts both ways',
  ],
  // ─── Naming culture ────────────────────────────────────────────────────────
  // Invented phonetics, deliberately not modelled on any real language family.
  // Borrowing real morphemes is how a generator eventually mints a real town's
  // name and takes §7.4 down with it, so these banks are nonsense built to a
  // rule instead: every prefix ends on a vowel, every suffix opens on a
  // consonant, and the library concatenates them bare.
  syllables: {
    continentPrefixes: ['Adju', 'Belwa', 'Enku', 'Ghirra', 'Jontu', 'Kessa', 'Muvo', 'Orru', 'Tarru', 'Vunde'],
    continentSuffixes: ['marra', 'sonde', 'kallu', 'berri', 'tonde', 'wassa', 'lomu', 'ndara', 'firra', 'zuko'],
    provincePrefixes:  ['Bawu', 'Dilu', 'Fenna', 'Gorra', 'Hessu', 'Illa', 'Kobbu', 'Marro', 'Petu', 'Sulli', 'Tenzo', 'Wubo'],
    provinceSuffixes:  ['dweni', 'kerro', 'nuffa', 'pello', 'ridda', 'sombu', 'tarko', 'venko', 'wolli', 'zabbo', 'mekko', 'jella'],
  },

  // ─── Dungeon overlays ──────────────────────────────────────────────────────
  // Ascending challenge, last id is the vault boss, no id in two pools (display
  // names are keyed by id globally, so one stat block cannot be two things).
  //
  // Everything here stays deniable. The machines are on a standby circuit and
  // somebody could be in the cab; the marsh light is a cut cable end in water;
  // the thing blocking the culvert is a packed wall of rag and silt with a
  // colony living in it. Nothing in this world is supernatural, and no enemy
  // with a face is here for being poor: the yard boss has been robbed twice
  // this year, the watchman is on a rota, the guard was told nobody is inside
  // the fence tonight.
  overlays: {
    'dead factory': {
      atmosphere: 'The standby circuit is still live, and it is feeding something.',
      enemies: ['skeleton', 'flying-sword', 'animated-armor', 'will-o-wisp', 'stone-sentinel'],
    },
    'flooded culvert': {
      atmosphere: 'Warm water to the knee, moving the wrong way, and no light after the second bend.',
      enemies: ['giant-rat', 'swarm-of-rats', 'constrictor-snake', 'crocodile', 'gibbering-mouther'],
    },
    'scrapyard deep': {
      atmosphere: 'Stacked to the sky at the far end, where the heaps have been there long enough to be geology.',
      enemies: ['cave-spider', 'worg', 'dire-wolf', 'ogre', 'veteran'],
    },
    'abandoned block': {
      atmosphere: 'Somebody is working out of this building, and it is not the people whose names are on it.',
      enemies: ['bandit', 'goblin', 'scout', 'spy', 'bandit-captain'],
    },
    'cargo shell': {
      atmosphere: 'The deck lies over far enough that everything loose went to one side years ago.',
      enemies: ['violet-fungus', 'zombie', 'hobgoblin', 'giant-spider', 'owlbear'],
    },
    'burnt market': {
      atmosphere: 'Ash over everything, stall frames standing in rows, and the heat still coming up through your shoes.',
      enemies: ['kobold', 'cultist', 'wolf', 'black-bear', 'air-elemental'],
    },
  },

  // What the map promises about a ward nobody has walked. Without these the
  // frontier keeps offering bells at odd hours in a city with no bells.
  frontierHooks: [
    'a route that runs with no rank at either end',
    'a standpipe that has water at odd hours',
    'smoke off a yard nobody will claim',
    'a corner the tankers stopped serving',
    'a pitch where the games stopped mid-season',
    'a depot the long-distance coaches pass without slowing',
  ],

  // Domain treasures and keys inherit: the library's set is keyed by god domain
  // and reads as a congregation's relic or a society's founding paper here
  // without help.
  domainTreasures: null,
  domainKeys: null,

  // Mechanics untouched — `classId` stays 'wizard' in the record and the sheet
  // derives from the same SRD data. The wizard is the one who understands how
  // the system is actually wired, which in this world is a job.
  classSkins: {
    fighter: { en: 'Doorman' },
    rogue:   { en: 'Runner' },
    cleric:  { en: 'Nurse' },
    wizard:  { en: 'Fixer' },
  },
  speciesSkins: null,

  // ─── Voice ─────────────────────────────────────────────────────────────────
  // Warm, fast and transactional. The register is the whole risk of this pack:
  // it has to sound like people who are good at their lives, so the examples
  // are about price and timing rather than hardship, and there is no phonetic
  // spelling anywhere. `forbid` lists only words this world cannot produce —
  // the pack keeps the SRD classes and the library's god domains, so forbidding
  // 'magic' or 'sword' would teach the narrator to describe its own content
  // badly.
  voice: {
    address:      ['boss', 'my friend', 'sister'],
    register:     'fast, funny and transactional; prices and names in one breath; never pitying',
    honorifics:   ['auntie or uncle for anyone older'],
    exclamations: ['ah-ah', 'you see now'],
    forbid:       ['thee', 'm\'lord', 'tavern', 'castle', 'neon'],
    examples: {
      narrator: ['The rank is loading. Nothing moves until the front seat is paid for.'],
      npc:      ['Two to the depot, my friend. Price went up Tuesday, ask anybody.'],
    },
    settingNoun: {
      en: 'a yard on the edge of a port city',
      nl: 'een erf aan de rand van een havenstad',
    },
  },

  // ─── Locale content overlay ────────────────────────────────────────────────
  // English only. Resolution is per key, so anything absent falls through to
  // the base bundle; Dutch play falls through to this English rather than
  // splitting half port-city, half fantasy.
  i18n: {
    en: {
      world: {
        houseStyles: [
          'closed cannery',
          'half-built block',
          'burnt market row',
          'stripped ferry shed',
          'condemned tenement',
          'dead pump house',
        ],

        // {{style}} in the entrance pool and {{treasure}} in the vault pool are
        // load-bearing — the generator substitutes them. No other room type
        // takes a parameter, exactly as the base bundle does it.
        rooms: {
          entrance: [
            { name: 'Gate Bay',       desc: 'The vehicle gate of a {{style}}, chained shut and cut open beside the hinge. Dust has drifted through the gap in a long tongue.' },
            { name: 'Guard Hut',      desc: 'A guard hut at the mouth of the {{style}}, its window knocked out and the visitors\' book still on the shelf, swollen with damp.' },
            { name: 'Loading Apron',  desc: 'The loading apron of a {{style}}, where lorries used to reverse. Two bays, one shutter up, and weeds coming through the concrete joints.' },
            { name: 'Side Door',      desc: 'A steel side door into the {{style}}, opened so many times without a key that the frame no longer holds it. It swings when the wind comes off the water.' },
            { name: 'Stair Foot',     desc: 'The foot of an outside stair climbing into the {{style}}. Somebody has painted a house number on the wall, and nobody has ever lived here.' },
          ],
          hall: [
            { name: 'Machine Floor',  desc: 'A floor built for machines that were sold years ago. Bolt patterns mark where each one stood, and the light comes in through gaps in the roof sheets.' },
            { name: 'Packing Hall',   desc: 'A long hall with a conveyor down the middle of it, belt gone, rollers left. Pigeons are arguing somewhere above the light line.' },
            { name: 'Covered Yard',   desc: 'A covered yard wide enough for a proper game, and somebody has plainly had one here: two stacks of brick stand in for goalposts.' },
            { name: 'Canteen',        desc: 'Long tables bolted to the floor and a serving hatch with the shutter half down. The urn is still on its stand, cold and full of nothing.' },
            { name: 'Sorting Floor',  desc: 'A wide floor divided into bays, each bay stencilled with a number. Somebody has been sleeping in bay four and folding the blanket every morning.' },
          ],
          corridor: [
            { name: 'Service Run',    desc: 'A narrow run between two walls with pipework at shoulder height. Water has been across this floor and left a tidemark of fine grey silt.' },
            { name: 'Cable Trench',   desc: 'A trench runs the length of the corridor, covers lifted and stacked neatly to one side. Every cable in it has been cut out and carried away.' },
            { name: 'Walkway',        desc: 'A covered walkway open on one side, its handrail bleached grey. The heat comes off the roof sheets in a slow, steady press.' },
            { name: 'Back Passage',   desc: 'A passage the building never meant anyone to use, painted once in a colour that stops halfway along the wall.' },
            { name: 'Stair Well',     desc: 'Concrete stairs with no handrail, tagged at every landing in a different hand. The floor numbers on the wall no longer match the floors.' },
          ],
          chamber: [
            { name: 'Compressor Room', desc: 'Two compressors sit on their mounts under a skin of dust, hoses coiled and tied off by somebody who expected to come back on Monday.' },
            { name: 'Pump Room',       desc: 'A room half a step down from the corridor, so it takes the water first. The pumps are gone and their pipes end in open air.' },
            { name: 'Switch Room',     desc: 'A wall of breakers behind a mesh door, most of them off, one of them on. The meter above them has been running this whole time.' },
            { name: 'Cold Room',       desc: 'An insulated room with a door like a strongroom\'s, hanging open on its hinge. The cold left years ago and the smell did not.' },
            { name: 'Office',          desc: 'A desk, a chair, and a wall calendar stopped on a month that people here still refer to. The drawers have been gone through twice.' },
          ],
          storage: [
            { name: 'Store Cage',   desc: 'A mesh cage with a shelf system and a padlock still on the door, hanging from a hasp that has been unscrewed clean out of the frame.' },
            { name: 'Drum Store',   desc: 'Blue drums stand in ranks, most of them empty and light enough to move with a foot. Two have been cut open and turned into water butts.' },
            { name: 'Spares Room',  desc: 'Bins of parts sorted by a careful hand for machines nobody runs. The card index is complete, current, and useless.' },
            { name: 'Bag Store',    desc: 'Sacks stacked against the wall to head height, split along the bottom row where rats got in and worked upward.' },
            { name: 'Tool Crib',    desc: 'A counter with a board behind it, every hook labelled and every hook empty but one, which holds a key on a wooden fob.' },
          ],
          quarters: [
            { name: 'Watchman\'s Room', desc: 'A mattress, a stove ring, a radio and a nail with a shirt on it. Whoever keeps this room keeps it properly.' },
            { name: 'Bunk Room',        desc: 'Two rows of steel bunks for a shift that slept between shifts. Photographs are taped to the underside of the upper beds.' },
            { name: 'Family Room',      desc: 'One room made into a household: a curtain across the corner, a paraffin stove, and a shelf of school books held level with a brick.' },
            { name: 'Wash Block',       desc: 'A row of taps over a concrete trough, one of them dripping to a schedule the whole building could set a watch by.' },
            { name: 'Rest Room',        desc: 'Plastic chairs in a half circle facing a television that has been gone a long time. Nobody has moved the chairs.' },
          ],
          shrine: [
            { name: 'Prayer Corner', desc: 'A corner swept clean and kept that way, a mat rolled against the wall and a shelf at head height. Whoever uses it comes early.' },
            { name: 'Memorial Wall', desc: 'Names painted in a column in the same steady hand, the last three in a paler colour than the rest.' },
            { name: 'Quiet Room',    desc: 'A room the building keeps empty on purpose. There is a bench, a jug of water, and a rule about noise that everybody keeps.' },
            { name: 'Candle Shelf',  desc: 'A ledge under a vent, laid with candle stubs, a bowl, and a photograph turned face down. The draught keeps everything on it moving slightly.' },
            { name: 'Meeting Room',  desc: 'Chairs set in a ring and a table with a cloth on it, laid out for a committee that still meets here whatever the building\'s status says.' },
          ],
          vault: [
            { name: 'Strong Room',     desc: 'A strong room with a door thicker than the wall it hangs in, standing open. On the shelf inside, exactly where it was left, sits {{treasure}}. A service door leads out to daylight.' },
            { name: 'Site Office',     desc: 'The site office, stripped of everything but the safe, and the safe is open. Inside it is {{treasure}}. A window has been lifted out of its frame and makes a serviceable exit.' },
            { name: 'Records Room',    desc: 'Shelves of files gone soft with damp and long out of order. Weighted down on the reading desk is {{treasure}}. A back door stands ajar on the yard.' },
            { name: 'Manager\'s Room', desc: 'A room with carpet, which nowhere else in this building has. The desk drawers are empty but one, and that one holds {{treasure}}. A stair goes straight down to the street.' },
            { name: 'Container Hold',  desc: 'A container welded into the wall and used as a strongroom, its doors levered wide. {{treasure}} sits at the back of it on a pallet. Sunlight comes through where a roof sheet has lifted.' },
          ],
        },

        dressing: {
          'dead factory': [
            'A line of pigeons sits along the crane rail, all facing the same way.',
            'The floor is marked out in yellow walkways nobody walks any more.',
            'A shift roster is still pinned up, curled, names crossed off in biro.',
            'One fluorescent tube flickers on a circuit that ought to be dead.',
            'Grease has set in the machine beds into something like brown stone.',
            'A safety poster shows a hand, a gear and an exclamation mark, and nothing else.',
          ],
          'flooded culvert': [
            'The tide mark on the wall is a hand above the top of the doorway.',
            'Plastic bags have caught on the grating and dried into a grey felt.',
            'A ladder goes down into the water and stops being visible at rung three.',
            'Something wide moves along the far wall and does not come up for air.',
            'The concrete has been patched here in four different colours over the years.',
            'A shopping trolley stands upright in the flow, silted in to the axles.',
          ],
          'scrapyard deep': [
            'Cars are stacked five high, and the fifth one is not lying flat.',
            'A weighbridge ticket blows past, then another, then a hundred.',
            'Every wing mirror in the heap has been taken, and nothing else has.',
            'Oil has soaked the ground until it holds a footprint like clay.',
            'A dog chain is bolted to a post with nothing on the end of it.',
            'A water bowl by the gate is full, and has been filled recently.',
          ],
          'abandoned block': [
            'Reinforcing bar stands up out of the top slab, waiting for a floor that never came.',
            'A stairwell has no outer wall, so the wind takes every third step.',
            'Somebody has plastered one room to a professional standard and then left.',
            'Washing hangs on a line strung across a doorway four floors up.',
            'The lift shaft has been boarded at every floor with a different door.',
            'A number is painted beside each opening, and the numbers run in order.',
          ],
          'cargo shell': [
            'Rust has eaten through the plate in a pattern like a map of islands.',
            'A doorway has been cut through the hull with a torch and squared off neatly.',
            'A mooring rope as thick as a leg lies across the mud, going nowhere.',
            'Gulls stand along the rail in a line and do not move when you do.',
            'Everything loose went to the low side years ago and has stayed there.',
            'A container door stands open on a hold packed solid with grey paper nest.',
          ],
          'burnt market': [
            'The steel stall frames stand up out of the ash in perfect rows.',
            'Everything is grey except where rain has cut channels down to the tile.',
            'A padlock has fused to its hasp and both have kept their shape.',
            'Somebody has already swept a square of floor clean and marked its corners.',
            'Wasps come and go from a frame that is still warm at midday.',
            'A price list survives on a board, the numbers now wrong by half.',
          ],
        },

        dressingGeneric: [
          'A draught moves grit along the floor in a slow curl.',
          'An arrow is sprayed on the wall, pointing back the way you came.',
          'Somebody has swept this floor recently and stacked the sweepings.',
          'A radio is playing two rooms away, or it was a moment ago.',
          'Heat comes off the roof sheets and makes the air above them shake.',
          'A chalk mark on the door frame counts something up to eleven.',
        ],

        treasures: [
          { name: 'title deed',           desc: 'A folded deed with a stamp, a site plan and four signatures — proof that this ground belongs to somebody who can prove it.' },
          { name: 'full cash box',        desc: 'A steel cash box, still locked, heavy in a way that answers every question anybody could ask about it.' },
          { name: 'generator that works', desc: 'A small diesel set under a tarpaulin, fuelled, oiled, and turned over by hand every month by somebody who meant to come back.' },
          { name: 'route licence',        desc: 'A laminated permit for a run with a rank at both ends — worth more than the vehicle that works it.' },
        ],

        keys: [
          { name: 'padlock key', desc: 'A brass key on a loop of wire, worn smooth, cut for a lock that has been changed twice since.' },
          { name: 'gate key',    desc: 'A long key for a sliding gate, kept on a wooden fob so it floats if it goes in the water.' },
          { name: 'shutter key', desc: 'A flat steel key for a roller shutter, bent very slightly and working better for it.' },
          { name: 'meter key',   desc: 'A square-drive key that opens meter cupboards, and in practice most cupboards.' },
        ],

        loot: [
          { name: 'first-aid kit',      desc: 'A green plastic box with a cross on the lid, half used and repacked properly.', heals: 8, consumable: true },
          { name: 'gold chain',         desc: 'A fine chain with a broken clasp, kept because it is easier to sell than to wear.', value: 25 },
          { name: 'exercise book',      desc: 'A school exercise book used as a ledger — dates, names and amounts in a careful hand, stopping mid-page.', lore: true },
          { name: 'roll of small notes', desc: 'A tight roll of small notes under a rubber band, worth a little less every week.', gold: 15, consumable: true },
        ],

        // Same stat block, different clothes. Every reachable id is skinned,
        // not only the ones this pack's own themes name: travel encounters and
        // the themeless fallback draw from fixed pools and would otherwise put
        // a "Worg" on a coast road.
        enemyNames: {
          'skeleton':          'Line Frame',
          'flying-sword':      'Live Blade',
          'animated-armor':    'Cycling Press',
          'will-o-wisp':       'Loose Line',
          'stone-sentinel':    'The Palletiser',
          'giant-rat':         'Culvert Rat',
          'swarm-of-rats':     'Rat Tide',
          'constrictor-snake': 'Drain Snake',
          'crocodile':         'Canal Crocodile',
          'gibbering-mouther': 'The Blockage',
          'cave-spider':       'Panel Spider',
          'worg':              'Yard Dog',
          'dire-wolf':         'Lead Dog',
          'ogre':              'The Loader',
          'veteran':           'Yard Boss',
          'bandit':            'Toll Collector',
          'goblin':            'Raiding Monkey',
          'scout':             'Route Watcher',
          'spy':               'Route Clerk',
          'bandit-captain':    'The Chairman',
          'violet-fungus':     'Wasp Nest',
          'zombie':            'Yard Ram',
          'hobgoblin':         'Port Guard',
          'giant-spider':      'Container Spider',
          'owlbear':           'Loose Bull',
          'kobold':            'Copper Picker',
          'cultist':           'Watch Volunteer',
          'wolf':              'Street Dog',
          'black-bear':        'Bush Pig',
          'air-elemental':     'Dust Devil',
        },

        enemyIntros: {
          // Machines on the standby circuit — the 'dead factory' pool. Every
          // one of them has a mundane explanation and the pack never confirms
          // or denies it, which is the only supernatural this world gets.
          'skeleton':          'A welding frame runs down its rail to the end stop and swings its arm up, as if the shift never finished.',
          'flying-sword':      'The trim saw spins up on its own, walks off its mount, and comes across the floor still turning.',
          'animated-armor':    'The press takes a breath of compressed air and starts its cycle, and there is nothing on the bed but you.',
          'will-o-wisp':       'A cut cable end swings down out of the dark, blue at the tip, hunting the shortest way to the ground.',
          'stone-sentinel':    'The palletiser wakes on the standby circuit, swings its arm through a full turn, and stops facing you.',

          'giant-rat':         'A rat the size of a cat comes off the silt shelf, wet to the shoulders and not remotely frightened.',
          'swarm-of-rats':     'The water ahead stops being water and becomes rats, and all of it is coming this way.',
          'constrictor-snake': 'Something thicker than your arm slides out of a joint in the pipe, unhurried, tasting the air.',
          'crocodile':         'What you took for a log leaves the mud in one shove, and the jaws are open before the tail lands.',
          'gibbering-mouther': 'The blockage shifts — packed rag, plastic and silt — and comes apart into everything that has been living inside it.',

          'cave-spider':       'A door panel gives up its passenger: black-legged, quick, and already halfway to your hand.',
          'worg':              'The yard dog comes out from between the stacks without barking first, which is the part that matters.',
          'dire-wolf':         'The big one comes last, the way it always does, and the rest of the pack makes room for it.',
          'ogre':              'The yard loader swings around on its own tracks, grab up, and you cannot see through the cab glass to say whether anybody is driving.',
          'veteran':           'The yard boss steps out with a length of bar he has clearly used before. "Third time this year. Not today."',

          'bandit':            'Somebody steps into the stairwell with a rope in one hand and a figure in mind. "You want to pass, we can talk."',
          'goblin':            'A monkey comes off the slab edge screaming, takes whatever is nearest to hand, and turns to fight you for it.',
          'scout':             'The watcher is down off the roof and behind you before you place the whistle that went up. "Who sent you?"',
          'spy':               'The clerk closes the route book, and there is a blade in the hand that closed it. He does not raise his voice.',
          'bandit-captain':    'The chairman comes down the stair with two of his people behind him. "You have been asking about my route."',

          'violet-fungus':     'The grey paper mass in the container corner is not cargo, and you have already knocked it.',
          'zombie':            'A ram walks out of the hold, looks at you for a long moment, and puts its head down.',
          'hobgoblin':         'A guard rounds the container with a baton and a torch. "Nobody is inside this fence tonight. Nobody."',
          'giant-spider':      'The web across the container door is the size of a bed sheet, and what built it is on your side of it.',
          'owlbear':           'A bull is loose among the containers and has run out of directions it is willing to be pushed in.',

          'kobold':            'Somebody is up to the elbows in ash pulling out burnt wire, and they are not sharing this stall with anybody.',
          'cultist':           'A whistle goes twice. The night watch has decided what you are, and the whistle was the polite part.',
          'wolf':              'A street dog comes out from under the stall frames low and fast, ribs showing, ears flat.',
          'black-bear':        'A pig the size of a table comes through the ash at a flat run, tusks up, and it is not going around you.',
          'air-elemental':     'The dry season turns a corner of the market into a spinning column of ash and roofing sheet, and it walks toward you.',
        },

        enemyIntroGeneric: '{{name}} is between you and the way out, and not moving.',
      },

      // Kind vocabulary. Only keys the base bundle already has — an invented key
      // is not an override, it is a silent no-op that reads as applied.
      map: {
        empty:          'You have not walked much of this coast yet.',
        header:         '── Known coast ──',
        connectsLine:   '    → the routes run to: {{names}}',
        rumouredHeader: 'Beyond the wards you have walked:',
        heldBy:         '— home ground of {{names}}',
        portMark:       '⇄',
      },

      // The long-distance run: an overnight coach or a boat up the coast, days
      // of it with stops, arranged through somebody who knows somebody. Same
      // placeholders as the base strings — {{days}} still means days.
      sail: {
        noLane:      'Nothing runs up the coast from here.',
        depart:      'You buy a seat on the long run — {{days}} days of coach, stops and roadside sheds toward {{name}}.',
        sight:       'The coast ahead comes up out of the haze: {{name}}. {{digest}}',
        arriveKnown: 'You know this run now. The coach puts you down in {{name}}.',
        arrive:      'The coach stops at {{settlement}}, on the edge of {{name}}.',
        noPassage:   'Nothing is going today. The depot is full of people waiting and nobody is lying about why.',
        arrivalNote: 'You came in on the long run after {{days}} days of coach seats and roadside stops, and your legs have not forgiven it.',
      },

      settlement: {
        sailChip: 'Take the long run to {{name}}',
      },

      lexicon: {
        kind: {
          continent:  'coast',
          province:   'district',
          region:     'ward',
          settlement: 'yard',
          place:      'spot',
          npc:        'person',
          creature:   'hazard',
          faction:    'outfit',
          item:       'item',
          quest:      'job',
        },
      },
    },
  },

  imageStyle:
    'Sun-bleached 35mm photo-reportage from the early 1990s — hard midday light, blown highlights, dust hanging in the air, ' +
    'heavy grain and the colour shift of expired film. Candid and eye-level, nothing posed, nothing romanticised. ' +
    'No text, no labels, no signage lettering. No borders, no frames, no decorative edges.',

  promptLine: {
    en: 'This setting is an invented port city on an invented tropical coast in the 1990s and the self-built yards around it, where everything runs on minibus routes, standpipes, cassettes, generators and hustle, the people are competent and funny rather than pitiable, and nothing magical, medieval or futuristic exists — no spells, no monsters, no swords, and no machine a good electrician could not explain.',
    nl: 'Deze wereld is een verzonnen havenstad aan een verzonnen tropische kust in de jaren negentig en de zelfgebouwde erven eromheen, waar alles draait op busroutes, standpijpen, cassettes, generatoren en handel, waar de mensen vaardig en geestig zijn in plaats van zielig, en waarin niets magisch, middeleeuws of futuristisch bestaat — geen spreuken, geen monsters, geen zwaarden, en geen machine die een goede elektricien niet kan uitleggen.',
  },
});
