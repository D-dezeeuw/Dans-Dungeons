// src/settings/pack-walled-quarter.js — the far reskin with nothing to hide behind.
//
// neon-stacks proved a pack can flip era, kind-vocabulary and creature wardrobe
// at once. It also had an escape hatch: when a stat block refused to read as
// anything a city could contain, the rain and the wiring absorbed it — a
// specter became an orphan process and nobody had to ask what that was. This
// pack removes the hatch. It is the same vertical-density texture with the
// science fiction taken out: fourteen storeys, an unlicensed dentist, a water
// committee, a rent ledger, and a decade with a real electricity supply in it.
// Every creature has to land as an animal, a person, or a building failing.
// That is the risk this pack is here to run — if the wardrobe only worked
// because a genre was doing the explaining, this is where it shows.
//
// On the setting: doc 19 §7.4 governs, and this is the pack most likely to get
// it wrong. It is a FICTIONAL ANALOG — it reaches for the texture of a dense
// self-governing walled settlement without being one. Every proper noun is
// invented; no real city, district, country, community, language or
// organisation is named anywhere in it, and none is meant to be identifiable.
// The residents are written as competent people running a working society —
// rent collected, water rationed, disputes settled, records kept — because the
// alternative is exotica, and exotica is the failure mode §7.4 exists to stop.
// The register comes from cadence, address terms and what people care about
// (rent, pressure above the ninth floor, whose stairwell it is, who owes whom),
// never from mock-dialect spelling. The lint cannot check any of that; this
// paragraph is the review bar.

export const PACK = Object.freeze({
  id: 'walled-quarter',
  packVersion: 1,
  era: 'modern',

  card: {
    en: {
      name: 'The Walled Quarter',
      blurb: 'Fourteen storeys grown together without an architect, where the water is spliced, the law is your neighbours, and the roof is the only sky.',
    },
    nl: {
      name: 'De Ommuurde Wijk',
      blurb: 'Veertien verdiepingen aan elkaar gegroeid zonder architect, waar het water afgetapt is, de wet je buren zijn en het dak de enige hemel is.',
    },
  },

  // ─── Blueprint palettes ────────────────────────────────────────────────────
  // Partial: tones, beat arcs, climates and god domains inherit. The domain
  // epithets survive intact — a walled quarter keeps shrines, and the library's
  // table was written name-free precisely so it could.
  tables: {
    worldArchetypes: [
      'a settlement the city outside has decided not to see',
      'fourteen storeys grown together without an architect',
      'one legal water main and eleven thousand taps',
      'a demolition notice with a date on it',
      'rent collected by three parties who each believe they are owed',
      'order kept entirely by neighbours',
      'a generation born inside and registered nowhere',
      'trades that are legal everywhere except here',
      'freeholds sold twice and inherited by strangers',
      'a quarter that feeds a city it does not appear on the map of',
      'roof gardens above alleys that have never had sun',
      'a census that stopped counting at the fourth floor',
    ],

    // Material and human, in the order these actually arrive: infrastructure,
    // money, fire, paperwork, each other, and the outside.
    threatTypes: [
      'a water main cut',
      'a rent strike',
      'a fire no engine can reach',
      'a demolition notice served on the whole block',
      'a feud between two associations',
      'an outside inspector who cannot be bought',
      'the pumps failing above the ninth floor',
      'a stairwell that has begun to move',
      'a bad batch out of one of the clinics',
      'the power spliced one splice too far',
      'a debt bought up by an agent from outside',
      'a roof gate padlocked from the far side',
      'typhoid traced back to a shared standpipe',
      'a landlord nobody has ever met sending men',
    ],

    factionArchetypes: [
      { type: 'stair association',   desc: 'the households of one run of floors, who settle their own disputes and expect to' },
      { type: 'water committee',     desc: 'the few who hold the standpipe keys and decide which stairs have pressure and when' },
      { type: 'letter-writers',      desc: 'the literate, who write everyone\'s letters and are therefore the only records the quarter has' },
      { type: 'clinic hands',        desc: 'unlicensed dentists, bone-setters and midwives, better than the outside admits and cheaper' },
      { type: 'noodle-floor cooperative', desc: 'the kitchen floors, who own their presses jointly and set the price of a meal' },
      { type: 'landlords\' agents',  desc: 'outside men with a ledger and an escort, collecting for owners who have never walked a stair' },
      { type: 'roof keepers',        desc: 'those who hold the roof gates and the ladder-bridges, and rent the only sky there is' },
      { type: 'wire men',            desc: 'splicers who put the power in and can take it out of one landing at a time' },
      { type: 'burial society',      desc: 'a subscription against the day it is needed: coffin, flowers, and someone to carry' },
      { type: 'night watch',         desc: 'unpaid men on a rota at the stair heads, with whistles and a list of who is expected' },
      { type: 'pawn window',         desc: 'the quarter\'s bank: gold in, notes out, and every family\'s worst month on file' },
      { type: 'schoolroom keepers',  desc: 'two rooms, four benches and the argument about whose children get the morning' },
    ],

    // Exactly six, all invented. They name what a place IS here — a floor that
    // was sealed, the footing that floods, the loft where the splices meet —
    // rather than borrowing a genre's furniture.
    dungeonThemes: [
      'sealed floor', 'flooded footing', 'wire loft',
      'clinic back-room', 'shrine landing', 'roof forest',
    ],

    // 'tile parlour' is the gambling room, described by what is on the table
    // rather than by the game's name — same move as neon-stacks' 'oath den'.
    // The texture is the point; a real community's word for its own pastime is
    // not this pack's to spend (§7.4).
    buildingTypes: [
      'noodle floor', 'dumpling kitchen', 'unlicensed surgery', 'dentist\'s window',
      'tile parlour', 'letter-writer\'s window', 'herb counter', 'barber chair',
      'plastic-flower workshop', 'ice room', 'rice shop', 'standpipe court',
      'funeral parlour', 'schoolroom', 'metal shop', 'pawn window',
      'tea stall', 'laundry roof',
    ],

    locationTypes: [
      'light well', 'ladder-bridge', 'roof gate', 'standpipe',
      'meter wall', 'blind alley', 'spliced junction', 'drying frame',
      'stair landing', 'rubbish chute', 'water-tank deck', 'sealed doorway',
      'catwalk', 'pigeon loft', 'roof garden', 'party-wall breach',
      'shrine niche', 'sump grate', 'propped balcony', 'firebreak gap',
    ],
  },

  // The bands describe how a place feels to stand in, not a latitude, which is
  // what lets a single building wear all eight: the north face is frozen, the
  // boiler court is volcanic, the footings are mire, the roof is highland. All
  // eight are claimed — an unclaimed band falls back to the full theme list,
  // which works but picks worse.
  themeClimates: {
    'sealed floor':     ['temperate', 'arid', 'frozen'],
    'flooded footing':  ['mire', 'coastal', 'tropical'],
    'wire loft':        ['temperate', 'arid', 'volcanic'],
    'clinic back-room': ['temperate', 'frozen', 'arid'],
    'shrine landing':   ['temperate', 'tropical', 'highland'],
    'roof forest':      ['highland', 'coastal', 'frozen', 'volcanic'],
  },

  bandSettlements: {
    temperate: ['stair landing', 'market court', 'walk-up landing', 'tea-stall row'],
    arid:      ['dry-tap court', 'standpipe queue', 'ration landing', 'shutter row'],
    frozen:    ['ice-room landing', 'cold-store court', 'north-wall walk', 'unheated stair'],
    tropical:  ['grow-roof court', 'steam-kitchen landing', 'damp stair', 'vine landing'],
    volcanic:  ['boiler court', 'kiln landing', 'ash-vent row', 'furnace stair'],
    coastal:   ['roof-gate landing', 'wash-deck court', 'catchment landing', 'gutter row'],
    highland:  ['upper landing', 'roof court', 'aerial row', 'top-floor landing'],
    mire:      ['footing court', 'seep landing', 'drain row', 'silt stair'],
  },

  // What the landings say about a block nobody here has business in. Rent,
  // water pressure, and whose stairwell it is — the setting's real subjects.
  stubHooks: [
    'the water pressure there drops when their pumps run',
    'a demolition notice was served and then not served again',
    'their association has not sent anyone to the roof meetings',
    'the ladder-bridge across to it was taken down from the far side',
    'two families hold the same landing and the letters go to both',
    'nobody has run a wire in there for years and the lights are on',
  ],
  // ─── Naming culture ────────────────────────────────────────────────────────
  // Invented phonetics for a coastal port that does not exist. Prefix + suffix
  // is a bare concatenation in the library, so every prefix ends on a vowel and
  // every suffix opens on a consonant that will follow one. Deliberately not a
  // romanisation of any living language: a bank of real morphemes concatenates
  // into a real place name sooner or later, and §7.4 does not survive a lucky
  // roll. The province suffixes are plain structural English on purpose — a
  // block here is named for what it is, and everyone says it forty times a day.
  syllables: {
    continentPrefixes: ['Vau', 'Toro', 'Nabe', 'Sirra', 'Kelu', 'Omme', 'Drau', 'Pire', 'Yalu', 'Chero'],
    continentSuffixes: ['ssat', 'quoi', 'ssan', 'lva', 'nneth', 'mure', 'tegg', 'raan', 'volde', 'hune'],
    provincePrefixes:  ['Mora', 'Sena', 'Ubbo', 'Kalu', 'Tenna', 'Vosha', 'Ari', 'Delu', 'Haske', 'Noru', 'Pella', 'Zimu'],
    provinceSuffixes:  ['gate', 'stair', 'court', 'landing', 'well', 'row', 'lane', 'yard', 'roof', 'wall', 'span', 'rung'],
  },

  // ─── Dungeon overlays ──────────────────────────────────────────────────────
  // Ascending challenge, last id is the vault boss, no id in two pools (display
  // names are keyed by id globally, so one stat block cannot be two things).
  // The skins are the constraint that makes this pack hard: every one has to be
  // an animal, a person, or a structure coming apart. Nothing here is
  // supernatural, and the two that come closest — the draught off the light
  // well, the figure at the niche wall — are written so a resident could shrug
  // and explain them. Stats are the SRD's, untouched.
  overlays: {
    'sealed floor': {
      atmosphere: 'Bricked up years ago, opened since, and the dust remembers who came through.',
      enemies: ['giant-rat', 'kobold', 'skeleton', 'animated-armor', 'stone-sentinel'],
    },
    'flooded footing': {
      atmosphere: 'The ground water came up and never went back down. Everything here is soft.',
      enemies: ['violet-fungus', 'swarm-of-rats', 'constrictor-snake', 'crocodile', 'gibbering-mouther'],
    },
    'wire loft': {
      atmosphere: 'Every splice in the block meets overhead, and the bundles are warm.',
      enemies: ['flying-sword', 'cave-spider', 'goblin', 'giant-spider', 'will-o-wisp'],
    },
    'clinic back-room': {
      atmosphere: 'Boiled instruments, a curtain rail, and a light that is never switched off.',
      enemies: ['acolyte', 'zombie', 'fungal-zombie', 'ghoul', 'vampire-spawn'],
    },
    'shrine landing': {
      atmosphere: 'Swept this morning. Incense, cold air off the light well, and no noise at all.',
      enemies: ['cultist', 'shadow', 'specter', 'cult-fanatic', 'wight'],
    },
    'roof forest': {
      atmosphere: 'Aerials, tanks and dogs, and fourteen storeys of drop past the parapet.',
      enemies: ['bandit', 'scout', 'worg', 'dire-wolf', 'air-elemental'],
    },
  },

  // What the map promises about a stair nobody has walked. Rumour here is
  // infrastructural: pressure, post, padlocks and who is collecting.
  frontierHooks: [
    'a stairwell with a door at the top nobody opens',
    'water pressure that dies above the ninth floor',
    'a landing the letter-writers will not deliver to',
    'a floor both associations claim and neither collects on',
    'smoke that comes up the light well every evening',
    'a roof gate padlocked from the far side',
  ],

  // The library's domain relics read as founder-myth objects in any wardrobe,
  // and a shrine landing is exactly where one would end up.
  domainTreasures: null,
  domainKeys: null,

  // Grounded work, all four. The id stays `wizard` in the record and the sheet
  // derives from the same SRD data — the letter-writer is simply the person
  // whose words move things, which in a place with no other records is not a
  // small claim.
  classSkins: {
    fighter: { en: 'Doorkeeper',    nl: 'Portier' },
    rogue:   { en: 'Runner',        nl: 'Loper' },
    cleric:  { en: 'Bone-Setter',   nl: 'Beenzetter' },
    wizard:  { en: 'Letter-Writer', nl: 'Briefschrijver' },
  },
  speciesSkins: null,

  // ─── Voice ─────────────────────────────────────────────────────────────────
  // Warm and transactional at the same time, which is the whole register: you
  // are called neighbour and you are also one favour down. `forbid` names only
  // words this world can never produce and no inherited content uses — the two
  // obvious candidates are deliberately absent, because the SRD's Arcana skill
  // description says 'magic' and the class ids the sheet derives from say
  // 'wizard'. Forbidding a word the game hands the narrator two lines later
  // only teaches it to describe badly.
  voice: {
    address: ['neighbour', 'cousin'],
    register: 'quick, practical, favour-accounting; who owes whom and what it costs',
    honorifics: ['auntie or uncle for anyone a floor above'],
    exclamations: ['mind the wire', 'not my stairwell'],
    forbid: ['castle', 'knight', 'tavern', 'implant', 'hologram'],
    examples: {
      narrator: ['Six floors of pipe drip into the light well. The tap runs four to six, if the pump holds.'],
      npc: ['You want the third door. Say I sent you, and mind — that puts you one favour down.'],
    },
    settingNoun: {
      en: 'a landing in a walled quarter',
      nl: 'een portaal in een ommuurde wijk',
    },
  },

  // ─── Locale content overlay ────────────────────────────────────────────────
  // English only, by the documented order: a Dutch game falls through to this
  // pack's English before the base bundle, so it stays in the quarter rather
  // than splitting half here, half high fantasy.
  i18n: {
    en: {
      world: {
        houseStyles: [
          'condemned block',
          'burnt-out stair',
          'sealed upper floor',
          'flooded footing block',
          'emptied noodle factory',
          'boarded clinic wing',
        ],

        // {{style}} in the entrance pool and {{treasure}} in the vault pool are
        // load-bearing — the generator substitutes them. No other room type
        // takes a parameter, exactly as the base bundle has it.
        rooms: {
          entrance: [
            { name: 'Alley Mouth',  desc: 'The alley mouth of a {{style}}, wide enough for one person and a bicycle. Cable and weeping pipe run the full height of it, and the daylight stops two metres in.' },
            { name: 'Stair Foot',   desc: 'The bottom of a stairwell in a {{style}}, its steps worn into shallow dishes. The grille hangs open where the padlock was cut, and post has heaped up unread against the wall.' },
            { name: 'Shutter Gap',  desc: 'The roller shutter across the front of a {{style}} has been forced up a hand-span and left that way. Beyond it a corridor runs back further than the frontage should allow.' },
            { name: 'Gate Landing', desc: 'The gate landing of a {{style}}, where three passages meet and none of them are marked. Floor numbers were painted on the wall once, and painted over since.' },
            { name: 'Meter Porch',  desc: 'The porch of a {{style}}, walled floor to ceiling with electricity meters, half of them wired around. A ceiling fan turns on a circuit nobody is paying for.' },
          ],
          hall: [
            { name: 'Noodle Floor',      desc: 'A whole floor given over to noodle-making: hoppers, a dough brake, drying frames on rails. Flour has gone to paste in the corners, and the frames still swing when the draught takes them.' },
            { name: 'Tile Parlour',      desc: 'A long room of folding tables, four stools and a shaded lamp to each. The tiles have been swept back into their box, and the box has been left open.' },
            { name: 'Association Room',  desc: 'The association keeps its meetings here: benches on three sides, a long table, and a wall of framed photographs of men shaking hands. The minute book lies open at a blank page.' },
            { name: 'Light Well',        desc: 'A light well drops the full height of the block, three metres across, crossed by washing lines at every floor. What comes down it is rain, ash and whatever the upper floors have finished with.' },
            { name: 'Canteen Landing',   desc: 'A landing widened into a canteen: two woks over one gas ring, six stools, a hatch through to the stair. The oil in the pan has set solid and pale.' },
          ],
          corridor: [
            { name: 'Blind Alley',       desc: 'A passage between two buildings that were never meant to touch, roofed over where their eaves met. It is dark at noon and the walls sweat.' },
            { name: 'Pipe Run',          desc: 'The water pipes were run last down here, and lowest, so everyone stoops. Each splice is a different vintage and each one weeps.' },
            { name: 'Party-Wall Breach', desc: 'Somebody knocked a doorway through a party wall and framed it in scrap timber. The floor levels do not match — half a metre of step, and no handrail.' },
            { name: 'Cable Stair',       desc: 'A stair bundled so tightly with cable that the handrail has disappeared inside it. The bundles are warm against the back of the hand.' },
            { name: 'Drying Corridor',   desc: 'Bamboo poles cross the corridor at head height, hung with washing nobody has taken in. You go through it the way everyone here does — sideways, and without comment.' },
          ],
          chamber: [
            { name: 'Pump Room',  desc: 'The pump room for the whole stack: two pumps, one of them cannibalised to keep the other running. The gauge reads zero and the tank above is still full.' },
            { name: 'Meter Wall', desc: 'A room that is only a wall of meters, ticking over for households that have gone. Somebody has kept the dials wiped clean.' },
            { name: 'Ice Room',   desc: 'A cork-lined ice room, its door propped by a block that has half melted into the floor drain. The cold is still holding, just.' },
            { name: 'Workshop',   desc: 'A workshop for plastic flowers: two presses, a heat gun, trays of petals sorted by colour. A day\'s work lies out unfinished.' },
            { name: 'Tank Deck',  desc: 'A room built around a water tank that arrived before the walls did. Condensation runs down the side of it and the floor has been sloped to take it.' },
          ],
          storage: [
            { name: 'Rice Store',    desc: 'Sacks stacked to the ceiling on pallets, the bottom course swollen and split. A scoop stands upright in the one that is open.' },
            { name: 'Bicycle Store', desc: 'Frames and wheels hang from hooks on every wall, most of them incomplete. Chalk numbers on the plaster record whose is whose.' },
            { name: 'Lock-Up',       desc: 'A cage welded out of reinforcing bar, its door opening outward into the passage. The padlock is a good one and the hinges are not.' },
            { name: 'Cold Store',    desc: 'A meat store with its rails empty and its hooks still swinging a little. The floor drain has been scrubbed recently.' },
            { name: 'Paper Store',   desc: 'Cartons of forms, receipts and letters copied twice over. The damp has taken the lower half of everything.' },
          ],
          quarters: [
            { name: 'One-Room Home',     desc: 'One room for a whole household: a stove on a shelf, a bunk built over the door, a table that folds flat to the wall. Height marks climb the door frame in pencil.' },
            { name: 'Bunk Room',         desc: 'Eight bunks in a room built for four, each with a curtain on a wire. Photographs are taped to the underside of the bed above.' },
            { name: 'Loft Bed',          desc: 'A sleeping platform built into the ceiling space, reached by a ladder bolted to the wall. There is room to lie down and not to sit up.' },
            { name: 'Rented Corner',     desc: 'A corner of a larger room, partitioned off in hardboard and let by the month. The partition stops a foot short of the ceiling.' },
            { name: 'Caretaker\'s Room', desc: 'The caretaker\'s room at the stair head: a desk, a bed, a board of keys with half the hooks empty. The window looks straight at the wall opposite.' },
          ],
          shrine: [
            { name: 'Niche Landing',        desc: 'A landing kept clear for the niche — a red-painted shelf, two cups, a bowl of sand full of burnt-down sticks. Someone sweeps here every day.' },
            { name: 'Ancestor Shelf',       desc: 'Photographs stand in rows on a shelf above the stair, each with a name card and a small dish. The dishes at the near end were filled today.' },
            { name: 'Burial-Society Room',  desc: 'The burial society keeps this room: a ledger, a strongbox, and a wall of paper flowers waiting to be needed. The chairs are stacked in one corner.' },
            { name: 'Incense Corner',       desc: 'Coils of incense hang from the ceiling in a corner of the corridor, burnt down to different depths. The smoke has stained the plaster an even brown.' },
            { name: 'Quiet Landing',        desc: 'A landing everyone has agreed to keep quiet: no radios, no shouting, no cooking after dark. Nobody enforces it and nobody breaks it.' },
          ],
          vault: [
            { name: 'Strong Room',        desc: 'A room with a door heavier than the wall it hangs in, standing open. On the bare shelf, exactly where it was set down, is {{treasure}}. A service stair leads out.' },
            { name: 'Association Safe',   desc: 'The association\'s back office, its safe drilled at the hinge and the drawers turned out. What they missed is {{treasure}}, wedged behind a drawer runner. Daylight shows under the far door.' },
            { name: 'Records Room',       desc: 'Shelves of letters and receipts, ordered by a system that died with the man who kept it. Weighted down on the reading desk is {{treasure}}. A door stands ajar onto the stair.' },
            { name: 'Landlord\'s Office', desc: 'An office nobody could get into for eleven years, carpeted and airless. In the desk\'s one locked drawer is {{treasure}}. A private stair climbs out of the corner.' },
            { name: 'Roof Room',          desc: 'A room built on the roof out of what was left over, windowed on three sides. On the table, under a cloth, is {{treasure}}. Outside, the ladder-bridge crosses to the next block.' },
          ],
        },

        dressing: {
          'sealed floor': [
            'The doorway has been bricked up, opened, and bricked again.',
            'Dust lies thick enough to hold a footprint that is not yours.',
            'A ceiling brace has been jacked into place and left there.',
            'Plaster comes down the wall in a thin steady stream.',
            'A calendar hangs open at a month nine years gone.',
            'Something settles below, and the floor here answers it.',
          ],
          'flooded footing': [
            'The tide mark on the wall is higher than the door frame.',
            'Black water fills the stair two steps down and goes no further.',
            'A pump lies stripped of its impeller and left in the wet.',
            'Duckboards laid end to end lift slightly as you cross them.',
            'Something moves in the water ahead and does not surface.',
            'Silt has set into the floor grating in a smooth grey crust.',
          ],
          'wire loft': [
            'Forty splices meet on one hook, taped and taped again.',
            'A meter has been turned around to face the wall.',
            'The bundle overhead is warm and smells faintly of hot varnish.',
            'A paper wasps\' nest has been built around a junction box.',
            'A warning is chalked on the beam, and misspelt.',
            'A bare bulb swings, and every shadow in the loft swings with it.',
          ],
          'clinic back-room': [
            'A dentist\'s chair stands under a lamp run off a car battery.',
            'Instruments lie boiled and laid out on a folded towel.',
            'A spike of unpaid slips stands on the corner of the desk.',
            'The sharps tin has overflowed and been topped with a brick.',
            'A price list is taped to the wall, the figures scratched out and rewritten.',
            'Somebody\'s x-ray is clipped over the window as a sunshade.',
          ],
          'shrine landing': [
            'Ash from burnt paper has drifted into the corner of every step.',
            'Two cups stand full and a third stands turned over.',
            'Offerings have been left for a name the card no longer shows.',
            'A red cord crosses the stair at chest height.',
            'Someone swept here this morning; the broom is still against the wall.',
            'A bowl of water sits by the niche, refilled and never drunk.',
          ],
          'roof forest': [
            'Aerials stand in a thicket, guyed to anything that will hold.',
            'A ladder-bridge crosses to the next roof on two scaffold poles.',
            'Pigeons come off a loft all at once and settle again behind you.',
            'Water tanks stand on brick piers, one of them freshly patched.',
            'A vegetable bed has been made in a bathtub of carried soil.',
            'The wind up here has an opinion about where you are standing.',
          ],
        },

        dressingGeneric: [
          'A draught out of the light well moves grit along the floor.',
          'An arrow is painted on the wall, pointing back the way you came.',
          'Post has been pushed under a door and left to build up.',
          'A bucket sits under a drip, three-quarters full and unemptied.',
          'The number on this door has been changed twice.',
          'A hand mark shows on the plaster where everyone steadies themselves.',
        ],

        treasures: [
          { name: 'the block rent ledger',           desc: 'Ten years of rents in one hand: who paid, who did not, and which floors were never anyone\'s to let.' },
          { name: 'a licence nobody issued',         desc: 'A trade licence, correct in every particular, stamped by an office that does not exist.' },
          { name: 'a family\'s gold in a biscuit tin', desc: 'Two rings, a bracelet and a chain, wrapped in a handkerchief inside a tin that still smells of biscuits.' },
          { name: 'the standpipe key',               desc: 'A cast bronze key for the main below the quarter. Whoever holds it decides which stairs have water.' },
        ],

        keys: [
          { name: 'brass gate key',            desc: 'A worn brass key on a loop of string, cut for a grille that has been re-hung twice.' },
          { name: 'padlock key on a paper tag', desc: 'A small flat key, its tag inked with a floor number and a name crossed out.' },
          { name: 'caretaker\'s master',       desc: 'A long-shanked key off the board at the stair head, filed down to fit more doors than it should.' },
          { name: 'roof-gate key',             desc: 'A heavy key for the padlock on the roof gate — lent by the keepers, never given.' },
        ],

        loot: [
          { name: 'herbal tonic',     desc: 'A stoppered bottle of bitter brown tonic from the herb counter on the third landing.', heals: 8, consumable: true },
          { name: 'gold chain',       desc: 'A fine chain, sold by weight at the pawn window and bought back the same way.', value: 25 },
          { name: 'bundle of letters', desc: 'Letters written for someone by someone else, kept in order and never sent.', lore: true },
          { name: 'roll of banknotes', desc: 'A tight roll of small notes under a rubber band, counted twice before it was hidden.', gold: 15, consumable: true },
        ],

        // Same stat block, different clothes — and here every skin has to be an
        // animal, a person, or a structure failing. The scaffold and the
        // collapse are the load-bearing cases: a skeleton's thirteen hit points
        // and repeated attacks read perfectly as a frame that comes down, and
        // then comes down again, further in.
        enemyNames: {
          // travel + themeless-fallback pools, which are reached without
          // consulting an overlay
          'wolf':              'Alley Dog',
          'black-bear':        'Kept Boar',
          'giant-rat':         'Dust Rat',
          'goblin':            'Copper Thief',
          'bandit':            'Roof-Gate Muscle',
          'scout':             'Roof Watcher',
          'worg':              'Roof Dog',
          'dire-wolf':         'Chained Dog',
          'skeleton':          'Falling Scaffold',
          'cultist':           'Vigil-Keeper',
          'zombie':            'Half-Woken Patient',
          'cave-spider':       'Cable Spider',
          // the six theme pools
          'kobold':            'Scrap Picker',
          'animated-armor':    'Standing Press',
          'stone-sentinel':    'The Collapse',
          'violet-fungus':     'Wall Rot',
          'swarm-of-rats':     'Drain Swarm',
          'constrictor-snake': 'Pipe Snake',
          'crocodile':         'Sump Lizard',
          'gibbering-mouther': 'The Backflow',
          'flying-sword':      'Loose Fan Blade',
          'giant-spider':      'Loft Spider',
          'will-o-wisp':       'Live Splice',
          'acolyte':           'Clinic Assistant',
          'fungal-zombie':     'Ward Case',
          'ghoul':             'Back-Room Dog',
          'vampire-spawn':     'The Surgeon',
          'shadow':            'Censer Smoke',
          'specter':           'Cold Draught',
          'cult-fanatic':      'Vigil Master',
          'wight':             'The Mourner',
          'air-elemental':     'The Squall',
        },

        enemyIntros: {
          'wolf':              'Something low and quick comes off the rubbish line, all shoulder, making no sound at all.',
          'black-bear':        'A boar somebody was fattening on the back landing hits the door frame at a run and does not stop there.',
          'giant-rat':         'A rat the size of a slipper bolts out of the plaster dust, turns at the wall, and comes back.',
          'goblin':            'A wiry man drops off the ducting with stripped cable in one hand and a knife in the other.',
          'bandit':            'A heavy steps out from behind the tank stand with a length of pipe. "Wrong roof, neighbour."',
          'scout':             'A watcher comes off the parapet with a catapult already drawn. "You are on nobody\'s list."',
          'worg':              '{{name}} comes out of the aerial thicket low and fast, and has never once been called off.',
          'dire-wolf':         'The chain goes taut, the staple comes out of the brick, and {{name}} keeps coming.',
          'skeleton':          'A scaffold frame lets go of the wall and comes down across the doorway — and then comes down again, further in.',
          'cultist':           'A vigil-keeper turns from the niche with the taper still lit and takes the knife off the shelf.',
          'zombie':            'Somebody who should still be under gets off the table, drip line trailing, and will not be told otherwise.',
          'cave-spider':       'Cable and web are the same thing in here, and what is riding it is black-legged and quick.',
          'kobold':            'A scrap picker straightens out of the rubble with a claw hammer and no intention of sharing the floor.',
          'animated-armor':    'The press in the corner shifts on its bed, takes up the slack in its belt, and starts.',
          'stone-sentinel':    'The floor above lets go in one corner and keeps letting go, working across the room toward you, beam by beam.',
          'violet-fungus':     'The black bloom on the wall is deeper than the wall, and it is on your hand before you have finished thinking so.',
          'swarm-of-rats':     'The standing water lifts, comes apart into rats, and all of them are coming the same way.',
          'constrictor-snake': 'Coils slide out of a burst main one after another, tasting the damp, in no hurry at all.',
          'crocodile':         'Something long and armoured leaves the sump in one surge. Somebody kept it, once, and then stopped.',
          'gibbering-mouther': 'The drain gives up everything it has held since the rains, and it comes up the passage in a wave that does not stop.',
          'flying-sword':      'An extractor blade tears off its spindle and stays up, wobbling, cutting the air between you and the door.',
          'giant-spider':      'It comes down the cable bundle head first, far faster than a thing that size has any business moving.',
          'will-o-wisp':       'A splice lets go with a crack, and the arc does not stop where the wire ends. It drifts. It finds you.',
          'acolyte':           'The assistant looks up from the tray, sets down what is in her hands, and picks up something better.',
          'fungal-zombie':     'A case nobody came back for pushes up off the mattress, the dressings gone green and grown into the skin.',
          'ghoul':             'The dog kept behind the curtain comes out to the length of its chain, and then past it.',
          'vampire-spawn':     'The surgeon finishes his stitch, sets the needle down, and looks at you the way he looks at everything. "Sit. This costs you nothing."',
          'shadow':            'The smoke off the coils does not go up. It comes along the floor, and the cold arrives with it.',
          'specter':           'The draught off the light well finds your face, stays on it longer than air should, and follows when you move.',
          'cult-fanatic':      'The vigil master steps down off the landing with his sleeves pushed back, certain of his ground and of you being on it.',
          'wight':             'A figure at the niche wall does not accept that this floor is empty, and does not accept you either.',
          'air-elemental':     'The wind comes round the tank stand as a solid thing, and fourteen storeys of drop are one step behind you.',
        },

        enemyIntroGeneric: '{{name}} puts itself between you and the stair, and it is not here to talk.',
      },

      // Kind vocabulary. Only keys the base bundle already has — an invented key
      // is not an override, it is a silent no-op that reads as applied.
      map: {
        empty:          'You have not yet mapped the quarter.',
        header:         '── Known quarter ──',
        connectsLine:   '    → stairs run toward: {{names}}',
        rumouredHeader: 'Beyond the stairs you have walked:',
        heldBy:         '— home stair of {{names}}',
        portMark:       '⇞',
      },

      // The long crossing. Between quarters there is no ground route worth
      // taking — you go over the roofs, which means the ladder-bridges, the
      // gates, and several days of arrangements you will be paying back later.
      // {{days}} still means days.
      sail: {
        noLane:      'No roof route leaves this block.',
        depart:      'You go up and over — {{days}} days of roof routes and borrowed ladders toward {{name}}.',
        sight:       'The far quarter stands up out of the haze: {{name}}. {{digest}}',
        arriveKnown: 'You know the route now. You come down into {{name}} without asking anyone.',
        arrive:      'You come down off the roofs at {{settlement}}, on the edge of {{name}}.',
        noPassage:   'No roof gate opens today. The keepers are not taking arrangements.',
        arrivalNote: 'You came over the roofs after {{days}} days of arrangements and favours, and two of them are still owed.',
      },

      settlement: {
        sailChip: 'Cross the roofs to {{name}}',
      },

      lexicon: {
        kind: {
          continent:  'quarter',
          province:   'block',
          region:     'stair',
          settlement: 'landing',
          place:      'address',
          npc:        'neighbour',
          creature:   'hazard',
          faction:    'association',
          item:       'goods',
          quest:      'favour',
        },
      },
    },
  },

  imageStyle:
    'Grainy black-and-white photo-reportage of a dense walled-quarter interior — hand-held, available light only, wet concrete and hanging cable. ' +
    'Pushed film grain, blown highlights off a single bare bulb, deep shadow, nineteen-seventies press stock. ' +
    'No colour. No text, no labels, no lettering. No borders, no frames, no decorative edges.',

  promptLine: {
    en: 'This setting is a dense walled quarter of the nineteen-seventies — fourteen storeys grown together without an architect, water and power spliced by hand, unlicensed trades and an order the city outside pretends not to see — where nothing futuristic and nothing supernatural exists, and everything that threatens you is an animal, a person, or a building failing.',
    nl: 'Deze wereld is een dichtbevolkte ommuurde wijk uit de jaren zeventig — veertien verdiepingen zonder architect aan elkaar gegroeid, water en stroom met de hand afgetapt, ongereguleerde beroepen en een orde die de stad daarbuiten niet wil zien — waar niets futuristisch en niets bovennatuurlijks bestaat, en alles wat je bedreigt een dier is, een mens, of een gebouw dat het begeeft.',
  },
});
