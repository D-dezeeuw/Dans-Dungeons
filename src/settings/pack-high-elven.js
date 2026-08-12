// src/settings/pack-high-elven.js — the second near reskin, and the clock test.
//
// dark-ages showed that register alone is a genre lever. This pack asks the
// narrower question: can a pack move the CLOCK without moving the wardrobe? It
// flips the era to 'ancient' and inherits all twenty-four of the library's
// dungeon themes untouched — because a people old enough to have ruined itself
// twice already owns the crypts, the sunken temples and the overgrown halls.
// Those rooms need no re-dressing here. They only need to be somebody's own
// earlier mistake instead of a stranger's, and that reframing is done by the
// voice block and one line of prompt. Nothing mechanical moves; no creature is
// renamed, so the travel pools and the themeless fallback stay in the base
// wardrobe on purpose, and the lint's creature rules stay quiet by never being
// triggered.
//
// What it risks: courtesy read as harmlessness. "Polite" gives a narrator
// nothing to threaten with, so the two example lines carry the whole
// instruction — the NPC line has to land without one impolite word, or every
// antagonist in an 80-hour campaign degrades into a gracious host with nothing
// at stake. If this pack ever reads toothless, that line is the thing to fix.
//
// On sourcing: this is the shelf of fantasy where borrowing is easiest and
// least excusable. Every proper noun, every syllable in the naming banks and
// every court title below is invented for this file — no published setting's
// language, houses or places, and nothing lifted from the one everybody means
// when they say "elves".

export const PACK = Object.freeze({
  id: 'high-elven',
  packVersion: 1,
  era: 'ancient',

  card: {
    en: {
      name: 'The High Elven Courts',
      blurb: 'Immortals with too much memory — courts that have argued one case for four centuries, grudges older than the mortals who inherited them, and a decline nobody will name aloud.',
    },
    nl: {
      name: 'De Hoge Elfenhoven',
      blurb: 'Onsterfelijken met te veel geheugen — hoven die één zaak al vier eeuwen behandelen, wrok ouder dan de stervelingen die hem erfden, en een verval dat niemand hardop benoemt.',
    },
  },

  // Partial override: tones, climates, dungeon themes and god domains all
  // inherit. Overriding `dungeonThemes` is what makes a pack expensive (an
  // overlay, a climate band and a dressing table per theme), and this setting
  // gains nothing by it — the library's ruins ARE this civilisation's history.
  tables: {
    // Every entry is a situation that only exists because the people in it
    // outlive their own decisions. The generator needs the premise, not the
    // mood; the mood is the voice block's job.
    worldArchetypes: [
      'a succession no one has needed for nine centuries',
      'a treaty whose signatories are all still alive',
      'a forest deeded to a family that no longer exists',
      'a court that has been hearing the same case for four hundred years',
      'a border settled by a marriage neither house now admits to',
      'a capital kept immaculate by a levy nobody has revisited',
      'a debt of hospitality nine mortal generations deep',
      'an empire that shrank so slowly it was never called a retreat',
      'a language that has stopped taking in new words',
      'a peace held together by everyone remembering the last war personally',
      'a coast the sea takes back at the rate of a hand each year',
      'a realm whose youngest citizen is two hundred years old',
    ],

    // Threats here are slow and mostly self-inflicted, which is a problem for a
    // clock that has to bite inside a campaign — so each entry is phrased at
    // the moment it stops being ambient and starts costing someone. Two are
    // external, and both are mortals declining to behave as they used to.
    threatTypes: [
      'a house ending, courteously, in one childless generation',
      'a bargain coming due after eleven centuries',
      'a warding-song nobody can still sing correctly',
      'mortals who have stopped being frightened',
      'a grievance archive opened by someone young',
      'a duel of precedent that has outlasted its own cause',
      'an exile returning within the exact letter of the banishment',
      'the shipwrights all dead and the craft never written down',
      'a boundary that holds only while a name is spoken each spring',
      'an heirloom found for sale in a mortal market',
      'a sister court silent for the third decade',
      'a garden failing that three houses had agreed to keep',
      'a mortal army that no longer asks leave to cross',
    ],

    // The `desc` has to tell a generator why each of these obstructs a player
    // without making any of them villains: everyone here is correct, and being
    // correct is the whole difficulty.
    factionArchetypes: [
      { type: 'elder house',          desc: 'kin, land and precedent held for nine centuries; slow to move and impossible to move past' },
      { type: 'keepers of courtesy',  desc: 'they rule on what may be said in hall, and a ruling can end a career without ever naming it' },
      { type: 'archivists of grievance', desc: 'they hold every wrong formally recorded, and lend from it to whichever house is asking' },
      { type: 'the exile court',      desc: 'a rival succession keeping full ceremony in a lesser hall, correct in everything but recognition' },
      { type: 'ward-singers',         desc: 'the songs that keep the borders shut are theirs, and the borders open the season they are slighted' },
      { type: 'the envoys\' compound', desc: 'short-lived, quick and blunt: the only party at court working to a deadline' },
      { type: 'the garden orders',    desc: 'they keep what everyone agrees must be kept, at a cost nobody wants itemised' },
      { type: 'the younger cousins',  desc: 'unlanded kin with three centuries of waiting behind them and no office in front of them' },
      { type: 'treaty-readers',       desc: 'jurists who can find the one clause that unmakes an arrangement everybody had settled into' },
      { type: 'the mourning houses',  desc: 'their office is the dead; their consent is required, is never refused, and is never quite given' },
      { type: 'the travelling court',  desc: 'wherever the sovereign\'s household stands is the capital, and it has not come this way in a lifetime' },
      { type: 'the seconds',          desc: 'professional intermediaries in matters of honour; nothing they arrange has ever finished early' },
    ],

    buildingTypes: [
      'audience hall', 'precedent house', 'grievance archive', 'ward-house',
      'mourning hall', 'winter pavilion', 'loom-house', 'lamp tower',
      'guest colonnade', 'name vault', 'quiet library', 'duelling floor',
      'envoys\' compound', 'ancestor gallery', 'glasshouse', 'long-vintage cellar',
      'scribes\' terrace', 'hour-bell tower', 'bathing court', 'boat house',
    ],

    locationTypes: [
      'tended grove', 'garden let go', 'reflecting stair', 'boundary song-stone',
      'silver ford', 'dry fountain court', 'grave orchard', 'terraced water',
      'lamp road', 'heron pool', 'long avenue', 'sunken parterre',
      'mourning bridge', 'quiet weir', 'overgrown hedge court', 'old duelling lawn',
      'wind-harp ridge', 'closed summer court', 'kept crossing', 'elder stand',
    ],
  },

  themeClimates: null,
  bandSettlements: null,

  // The lever dark-ages could skip and this one cannot: the library's banks
  // mint Saltmarch and Elderdowns, and a court of immortals cannot be seated in
  // Saltmarch. Prefix+suffix is bare concatenation with no joiner, so the two
  // pairs are built to opposite rules — continent prefixes all end on a vowel
  // and their suffixes all open on a consonant, province prefixes end on a
  // consonant and their suffixes open on a vowel — which means every one of the
  // 244 possible joins lands on a vowel/consonant boundary and stays sayable.
  // Every morpheme is invented; none is borrowed from a published language.
  syllables: {
    continentPrefixes: ['Aeli', 'Caelu', 'Ysse', 'Loeri', 'Nyrra', 'Saele', 'Thae', 'Velu', 'Orra', 'Oevi'],
    continentSuffixes: ['thanne', 'vaeri', 'somel', 'nuine', 'shaera', 'wenneth', 'liore', 'marren', 'sethen', 'venna'],
    provincePrefixes:  ['Aen', 'Corr', 'Rhoen', 'Haelm', 'Issen', 'Lyr', 'Myrr', 'Nael', 'Serr', 'Thir', 'Vess', 'Ysal'],
    provinceSuffixes:  ['aloth', 'ellis', 'ione', 'undel', 'aeve', 'orrel', 'esti', 'uaine', 'avel', 'enne', 'ossir', 'ilaine'],
  },

  // The frontier is the layer a player reads most, because it names everywhere
  // they have not been. These are rumours as reported by people for whom a
  // decade is recent — no alarm, and a date instead of a threat.
  frontierHooks: [
    'a hall nobody has opened since the second accord',
    'a road the seasons have finished with',
    'lamps still lit for a household that left',
    'a border-song sung a season late',
    'a house that has not answered its post in eighty years',
    'a garden that is still being weeded',
  ],

  overlays: null,
  domainTreasures: null,
  domainKeys: null,
  speciesSkins: null,

  // Court offices, not adventuring jobs — the id stays `fighter`/`rogue`/
  // `cleric`/`wizard`, the sheet derives from the same SRD data, only the word
  // on the button moves. The euphemism is the point: this is a place that
  // titles its duellist as kin and its poisoner as the one who pours.
  classSkins: {
    fighter: { en: 'Swordcousin', nl: 'Zwaardneef' },
    rogue:   { en: 'Cupbearer',   nl: 'Schenker' },
    cleric:  { en: 'Wardsinger',  nl: 'Wachtzanger' },
    wizard:  { en: 'Rememberer',  nl: 'Gedenker' },
  },

  // The whole pack. It rides in every narrator, NPC, travel and journal prompt
  // for the length of a campaign, hence the token ceiling — and the examples do
  // the work the adjectives cannot. `forbid` lists only words this world can
  // never produce: the base creature pools, the SRD species list and twenty-four
  // inherited dungeon themes all stay in play, so forbidding 'sword' or 'goblin'
  // here would only teach the narrator to describe its own scene badly.
  voice: {
    address: ['cousin', 'child of a season', 'honoured guest'],
    register: 'courteous, unhurried, exact; the threat lives in the courtesy',
    honorifics: ['Elder, for those who signed the accords'],
    exclamations: ['by the long year'],
    forbid: ['choom', 'neon', 'gunpowder', 'hit points', 'okay'],
    examples: {
      narrator: ['The hedge has been kept six hundred years. It is kept still, by no one you have seen.'],
      npc: ['You will be dead long before this is settled. I shall not trouble you with it.'],
    },
    settingNoun: {
      en: 'a court of the long-lived',
      nl: 'een hof van de langlevenden',
    },
  },

  promptLine: {
    en: 'This setting is the courts of a long-lived people in a decline nobody will name — law kept as etiquette, precedent older than any mortal kingdom, beauty maintained at a cost, ruins that are their own earlier mistakes — and nothing modern, mechanical or hurried exists in it.',
    nl: 'Deze wereld bestaat uit de hoven van een langlevend volk in een verval dat niemand benoemt — recht dat als etiquette gevoerd wordt, precedent ouder dan enig sterfelijk koninkrijk, schoonheid die tegen hoge prijs onderhouden wordt, ruïnes die hun eigen oude fouten zijn — en niets moderns, mechanisch of gehaast bestaat erin.',
  },

  imageStyle:
    'Silverpoint and pale ink wash of an ancient, exactingly kept hall of a long-lived people: tall slender stonework, worn gilding, formal gardens quietly going to seed, cold high light, ivory and grey-green with one thread of tarnished gold. ' +
    'No borders, no frames, no decorative edges. No text, no labels.',

  // One table, and the one the player reads most: what kind of place a dungeon
  // IS here. Each entry has to sit grammatically inside the inherited entrance
  // prose ('the entrance hall of a …', 'this …', 'the … waits in silence'), so
  // they stay compact noun phrases rather than the sentences they want to be.
  // English only — the lint refuses a Dutch key with no English original, and
  // Dutch play falls through to pack-English by design.
  i18n: {
    en: {
      world: {
        houseStyles: [
          'abandoned summer court',
          'sealed archive',
          'garden without gardeners',
          'shuttered guest palace',
          'silted river pavilion',
          'closed mourning hall',
        ],
      },
    },
  },
});
