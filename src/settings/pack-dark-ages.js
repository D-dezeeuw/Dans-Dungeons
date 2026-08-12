// src/settings/pack-dark-ages.js — the near reskin, and the template.
//
// Same era as classic, the same creatures, the library's own twenty-four
// dungeon themes. On the manifest almost nothing changes, and that is the
// entire argument: this pack exists to show that REGISTER is a genre lever by
// itself. Classic's narrator announces that an ancient evil stirs; this one
// says the ford is over the horse's knees and four are buried since the thaw.
// Identical dungeon graph, identical goblin, identical d20 — a different
// century comes out. If a pack had to mint new monsters and new themes to feel
// like a different world, the seams would be in the wrong place.
//
// It is also meant to be the cheapest pack in the repo to read, because it is
// the one the next author copies: a partial `tables` override, a voice block
// inside its budget, one locale table, and nulls everywhere else. Every field
// left null here is a field nobody has to think about to ship a setting.

export const PACK = Object.freeze({
  id: 'dark-ages',
  packVersion: 1,
  era: 'medieval',

  card: {
    en: {
      name: 'The Dark Ages',
      blurb: 'Mud, tithes and kept oaths, where a hard winter is the end of the world and magic is only ever something somebody heard.',
    },
    nl: {
      name: 'De Donkere Eeuwen',
      blurb: 'Modder, tienden en gehouden eden, waar een harde winter het einde der tijden is en magie altijd slechts van horen zeggen blijft.',
    },
  },

  // A partial override: absent keys inherit the library's defaults. Notably
  // `dungeonThemes` is NOT overridden — the library's crypts, warrens and
  // flooded caverns already belong to this century, and a pack that mints its
  // own themes owes each one an overlay, a climate band and a dressing table.
  // Keeping them is what makes this the ~150-line pack instead of the 450-line
  // one, and the lint's theme rules stay quiet by never being triggered.
  tables: {
    worldArchetypes: [
      'a kingdom held together by oaths and nothing else',
      'the year the harvest failed twice',
      'a church grown richer than the crown it crowns',
      'three claimants and one unburied king',
      'a coast that has learned the shape of a raider\'s sail',
      'a frontier of the new faith, half-converted and watchful',
      'a land counted, taxed and written down for the first time',
      'roads the old empire left, and nobody left to mend them',
      'a border where two tongues meet and neither gives ground',
      'the long peace that nobody under thirty believes in',
      'a river valley bought back from the marsh, field by field',
      'a shire that has not seen its lord in nine years',
    ],

    // Human-scale and material: hunger, weather, debt, law, and men with axes
    // who have to eat somewhere. Two entries stay supernatural but are phrased
    // as things people SAY — the register only holds if the world never
    // confirms them, and a threat table that promises a demon will get one.
    threatTypes: [
      'famine winter',
      'a plague ship riding at anchor',
      'an interdict laid on the whole shire',
      'a war band overwintering on the abbey\'s grain',
      'relic theft',
      'a claimant with a forged pedigree',
      'blood feud between two great households',
      'the tithe doubled to buy back a hostage',
      'ergot in the rye',
      'a court sent out to hunt heresy',
      'murrain in the cattle, and the herds burned',
      'the sea taking another furlong of the fields',
      'a child said to work miracles, and the crowds that follow',
      'whatever it is the charcoal burners will not name',
    ],

    factionArchetypes: [
      { type: 'abbey',            desc: 'a landholding house of monks: granary, scriptorium, and the only lender for thirty miles' },
      { type: 'reeve and bailiff', desc: 'the lord\'s men for rents, boundaries and small justice, hated in proportion to their accuracy' },
      { type: 'oath-band',        desc: 'sworn fighting men fed at one hall, loyal exactly as long as the hall feeds them' },
      { type: 'relic-keepers',    desc: 'guardians of a saint\'s bones and of the pilgrim trade that walks in behind them' },
      { type: 'tithe-collectors', desc: 'church men with a cart, a tally stick and the right to open any barn door' },
      { type: 'bishop\'s court',  desc: 'the only law that crosses borders, and the only one that can read' },
      { type: 'freeholders\' moot', desc: 'landed farmers who settle boundaries and feuds by memory, precedent and shouting' },
      { type: 'great household',  desc: 'a lord, his kin, and everyone who eats at his table and owes for it' },
      { type: 'bridge wardens',   desc: 'townsmen who keep the crossing standing and set the toll to match' },
      { type: 'wintering traders', desc: 'foreigners lodged under charter until the passes open: resented, and needed' },
      { type: 'sea-raiders',      desc: 'crews from over the water who arrive in the same season as the herring' },
      { type: 'hermits and anchorites', desc: 'holy solitaries whose blessing is sought and whose opinions are feared' },
    ],

    buildingTypes: [
      'longhouse', 'tithe barn', 'watermill', 'smokehouse',
      'motte', 'palisade gate', 'alehouse', 'forge',
      'church porch', 'priest\'s house', 'byre', 'malt house',
      'salt house', 'charnel house', 'dovecote', 'lime kiln',
      'weaving shed', 'moot bench', 'pig yard', 'boat shed',
    ],

    locationTypes: [
      'ford', 'boundary stone', 'gallows hill', 'drowned meadow',
      'charcoal burner\'s clearing', 'hollow way', 'fish weir', 'plague pit',
      'old dike', 'beacon hill', 'hermit\'s cell', 'wayside cross',
      'sheep fold', 'peat cutting', 'fallen bridge', 'holy well',
      'coppice', 'flooded ferry landing', 'burnt steading', 'cattle drove',
    ],
  },

  themeClimates: null,
  bandSettlements: null,
  syllables: null,

  // The library's frontier hooks already suit this century; these are the ones
  // it does not have — rumour in the register of people who walk everywhere.
  frontierHooks: [
    'smoke on the horizon',
    'a road nobody maintains',
    'bells heard at odd hours',
    'a ford that has drowned two carts this year',
    'a boundary stone somebody moved',
    'strangers wintering where nobody winters',
  ],
  overlays: null,
  domainTreasures: null,
  domainKeys: null,
  speciesSkins: null,

  // The one place this pack cannot leave the base alone. A party led by a
  // "Wizard" is the high-fantasy note the whole register is trying not to
  // strike, and the mechanics do not care what the button says: the id stays
  // `wizard`, the sheet derives from the same SRD data, the spells are the
  // same spells. Only the word changes.
  classSkins: {
    fighter: { en: 'Oathman',    nl: 'Eedman' },
    rogue:   { en: 'Poacher',    nl: 'Stroper' },
    cleric:  { en: 'Cleric',     nl: 'Geestelijke' },
    wizard:  { en: 'Charm-Worker', nl: 'Bezweerder' },
  },

  // The whole pack, really. Everything above changes what the world contains;
  // this changes what it sounds like, and it rides in every narrator, NPC and
  // travel prompt for the length of a campaign — hence the token ceiling the
  // lint enforces. The examples are here to be imitated, not read: a register
  // described ('plain, weary') is a preference, a register demonstrated is an
  // instruction.
  voice: {
    address: ['friend', 'traveller', 'stranger', 'neighbour'],
    register: 'plain, weary and concrete; few adjectives; the speech of people who count winters',
    honorifics: ['Brother or Sister for anyone in orders'],
    exclamations: ['God keep you', 'by the saints', 'Lord above'],
    // Only words this world can never produce. It is tempting to forbid
    // 'wizard', 'elf' and 'rune' as well, but the pack inherits the base
    // creature pools, the SRD species list and the library's dungeon themes —
    // an arcane ruin's own dressing says runes. Forbidding a word the scene
    // hands the narrator two lines later teaches it to describe badly.
    forbid: ['choom', 'neon', 'mana', 'mage-tower', 'hit points'],
    examples: {
      narrator: ['The rain has been at the thatch three days. The ford is over the horse\'s knees.'],
      npc: ['We buried four since the thaw. Take the far bed, it is drier.'],
    },
    settingNoun: {
      en: 'a village of the old kingdoms',
      nl: 'een dorp uit de oude koninkrijken',
    },
  },

  promptLine: {
    en: 'This setting is the early middle ages as they were actually lived — mud, tithes, oaths, relics and a winter that kills — where magic is rumoured and never demonstrated and nothing of high fantasy exists.',
    nl: 'Deze wereld is de vroege middeleeuwen zoals ze werkelijk geleefd werden — modder, tienden, eden, relieken en een winter die doodt — waar magie een gerucht is en nooit getoond wordt en niets van hoge fantasy bestaat.',
  },

  imageStyle:
    'Charcoal and ash-wash chronicle illustration of a bleak early-medieval scene. ' +
    'Smudged black and grey washes on coarse rag paper, heavy soot shading, plain unpractised linework. ' +
    'No colour of any kind. No text, no labels, no lettering. No borders, no frames, no decorative edges.',

  // One table, chosen because it is the one the player reads most often: the
  // name of the place they are standing in. No `nl` overlay — the lint requires
  // every translated key to have an English original in the same pack, and a
  // Dutch game falls through to the pack's English before it falls through to
  // the base bundle, which is the documented order.
  i18n: {
    en: {
      world: {
        houseStyles: [
          'burnt hall',
          'abandoned motte',
          'collapsed tithe barn',
          'flooded undercroft',
          'plague-emptied grange',
          'ruined minster',
        ],
      },
    },
  },
});
