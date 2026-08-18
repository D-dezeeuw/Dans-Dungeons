// The Hollow Vale — the third setting pack (3.2.0): gothic horror at
// valley scope, with one defining twist: THE DARKLORDS ARE PEOPLE THE
// PCS KNEW. The Vale is small — a dozen villages, one valley, eight
// domains — and every domain's lord is somebody's baker, somebody's
// priest, somebody's old adventuring partner. Each domain is a moral
// arc, not a slay-the-vampire arc.
//
// Gothic mechanics ship as DATA riding existing engine surfaces:
// - The dread track is a VariantEncounter custom track (band 0-10,
//   thresholds below) — adjustTrack/trackValue drive it unchanged.
// - Light-as-resource: a pure helper (burnLight) plus lantern-hours
//   bookkeeping on the actor; the dark raises dread, per the table.
// - Dream sequences are ordinary beats flagged `dream: true` in the
//   Bramblefell pack — the Beats runtime needs nothing new.
//
// All names invented (docs/legal.md; swept by tests/legal.test.js).

// ── Eight domains (regions), each a person gone wrong ───────────────────

export const HOLLOW_VALE_REGIONS = Object.freeze({
  'bramblefell': Object.freeze({
    id: 'bramblefell', name: 'Bramblefell',
    biome: 'briar-farmland',
    summary: 'The first village, swallowed hedge by hedge. Its darklord bakes bread nobody can refuse — one bite and you never want to leave, and the briar makes sure of it.',
    cities: Object.freeze(['bramblefell-green']),
    dangers: Object.freeze(['the-briar', 'the-second-helping', 'hedge-shepherds']),
  }),
  'the-chandlery': Object.freeze({
    id: 'the-chandlery', name: 'The Chandlery',
    biome: 'candle-town',
    summary: 'A town that tithes its candle-hours to the priest who kept the dark out — and now keeps the dark, and decides whose lamps deserve oil.',
    cities: Object.freeze(['taperhold']),
    dangers: Object.freeze(['the-unlit-curfew', 'wax-debts', 'the-snuffed']),
  }),
  'the-orchard-of-knives': Object.freeze({
    id: 'the-orchard-of-knives', name: 'The Orchard of Knives',
    biome: 'orchard',
    summary: 'The duellist who never lost retired here to graft apple trees. Every tree remembers a man she killed; the fruit remembers how.',
    cities: Object.freeze(['graftling']),
    dangers: Object.freeze(['the-remembering-fruit', 'satisfaction-demanded', 'the-first-tree']),
  }),
  'millwrack': Object.freeze({
    id: 'millwrack', name: 'Millwrack',
    biome: 'river-mill',
    summary: 'The miller drowned his scale-thumbing partner and the river took his side. The wheel turns without water now, grinding what the current brings him to grind.',
    cities: Object.freeze(['millwrack-crossing']),
    dangers: Object.freeze(['the-patient-river', 'the-tithe-of-flour', 'wheel-songs']),
  }),
  'the-glass-parish': Object.freeze({
    id: 'the-glass-parish', name: 'The Glass Parish',
    biome: 'village',
    summary: 'The stained-glass artisan who put her dead daughter in a window, and then her neighbors\' dead, and then — because grief scales — her neighbors.',
    cities: Object.freeze(['pane-street']),
    dangers: Object.freeze(['the-gallery', 'sitting-still-too-long', 'the-light-through-her']),
  }),
  'hushwood': Object.freeze({
    id: 'hushwood', name: 'Hushwood',
    biome: 'forest',
    summary: 'The old warden hushed the wood to save the village from what hunted by sound. The wood stayed hushed. Now he hunts whatever dares to speak in it.',
    cities: Object.freeze(['the-quiet-stead']),
    dangers: Object.freeze(['spoken-words', 'the-wardens-rounds', 'what-he-hushed-it-from']),
  }),
  'the-winter-court-of-mother-tansy': Object.freeze({
    id: 'the-winter-court-of-mother-tansy', name: 'The Winter Court of Mother Tansy',
    biome: 'high-moor',
    summary: 'The midwife who never lost a mother or a child — because she keeps them. Her moor-court is full of families that owe her, forever, and pay in winters.',
    cities: Object.freeze(['tansy-moor']),
    dangers: Object.freeze(['the-owed-winters', 'the-cradle-count', 'her-kindness']),
  }),
  'the-last-inn': Object.freeze({
    id: 'the-last-inn', name: 'The Last Inn',
    biome: 'crossroads',
    summary: 'The inn at the valley\'s only exit, kept by the adventurer who got out once and came back for his party. They didn\'t come. Now nobody leaves before settling the bill — and the bill is a story he can believe.',
    cities: Object.freeze(['the-last-inn-yard']),
    dangers: Object.freeze(['the-bill', 'the-guest-book', 'checkout-refused']),
  }),
});

export const HOLLOW_VALE_CITIES = Object.freeze({
  'bramblefell-green': Object.freeze({
    id: 'bramblefell-green', name: 'Bramblefell Green', regionId: 'bramblefell',
    size: 'village', ruler: 'darklord-maren-ovenwarm',
    hooks: Object.freeze(['bramblefell-hook']),
  }),
  'taperhold': Object.freeze({
    id: 'taperhold', name: 'Taperhold', regionId: 'the-chandlery',
    size: 'town', ruler: 'darklord-father-wick',
    hooks: Object.freeze(['the-wax-ledger']),
  }),
  'graftling': Object.freeze({
    id: 'graftling', name: 'Graftling', regionId: 'the-orchard-of-knives',
    size: 'village', ruler: 'darklord-sera-ashglove',
    hooks: Object.freeze(['the-hundredth-graft']),
  }),
  'millwrack-crossing': Object.freeze({
    id: 'millwrack-crossing', name: 'Millwrack Crossing', regionId: 'millwrack',
    size: 'village', ruler: 'darklord-toller-grist',
    hooks: Object.freeze(['the-flour-tithe']),
  }),
  'pane-street': Object.freeze({
    id: 'pane-street', name: 'Pane Street', regionId: 'the-glass-parish',
    size: 'village', ruler: 'darklord-ivenna-of-the-glass',
    hooks: Object.freeze(['the-empty-pane']),
  }),
  'the-quiet-stead': Object.freeze({
    id: 'the-quiet-stead', name: 'The Quiet Stead', regionId: 'hushwood',
    size: 'village', ruler: 'darklord-warden-mosswell',
    hooks: Object.freeze(['the-spoken-name']),
  }),
  'tansy-moor': Object.freeze({
    id: 'tansy-moor', name: 'Tansy Moor', regionId: 'the-winter-court-of-mother-tansy',
    size: 'village', ruler: 'darklord-mother-tansy',
    hooks: Object.freeze(['the-owed-winter']),
  }),
  'the-last-inn-yard': Object.freeze({
    id: 'the-last-inn-yard', name: 'The Last Inn Yard', regionId: 'the-last-inn',
    size: 'village', ruler: 'darklord-halberd-june',
    hooks: Object.freeze(['the-open-bill']),
  }),
});

// ── The eight Darklords: motive, tragedy, and the door out ──────────────
//
// Darklords are SettingNpcs with two extra fields the moral arcs turn
// on: `tragedy` (what they did, and why it made sense at the time) and
// `redemption` (the door the PCs can walk them to — every domain can
// end without a stake through anyone's heart).

export const HOLLOW_VALE_NPCS = Object.freeze({
  'darklord-maren-ovenwarm': Object.freeze({
    id: 'darklord-maren-ovenwarm', name: 'Maren Ovenwarm',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['flour-soft', 'feeds you before answering']),
    wants: Object.freeze(['a full table forever', 'no empty chair ever again']),
    tragedy: 'Her family starved in the famine year while the village granary stayed locked; she swore no one would leave her table hungry — or leave it at all.',
    redemption: 'Someone must refuse the bread, kindly, and stay anyway — prove a chair can empty and refill.',
    factionId: 'the-vale-itself', cityId: 'bramblefell-green',
    statBlockId: 'cult-fanatic',
  }),
  'darklord-father-wick': Object.freeze({
    id: 'darklord-father-wick', name: 'Father Wick',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['sermon-measured', 'counts your candle-hours aloud']),
    wants: Object.freeze(['the dark rationed', 'the unworthy unlit']),
    tragedy: 'He burned his own church as tinder to light the town through the Long Night, and decided light spent on the undeserving killed the deserving.',
    redemption: 'He must watch someone give their last candle away and survive the dark by company alone.',
    factionId: 'the-vale-itself', cityId: 'taperhold',
    statBlockId: 'cult-fanatic',
  }),
  'darklord-sera-ashglove': Object.freeze({
    id: 'darklord-sera-ashglove', name: 'Sera Ashglove',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['duellist-precise', 'grants you the first word like a first strike']),
    wants: Object.freeze(['every debt of satisfaction paid', 'one orchard row that bears sweet fruit']),
    tragedy: 'Every duel was lawful, every kill was clean, and every tree she grafts remembers one anyway; she retired to grow apologies and grew witnesses.',
    redemption: 'One of the remembered must taste his own tree\'s fruit and forgive her out loud.',
    factionId: 'the-vale-itself', cityId: 'graftling',
    statBlockId: 'knight',
  }),
  'darklord-toller-grist': Object.freeze({
    id: 'darklord-toller-grist', name: 'Toller Grist',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['wheel-rhythm', 'speaks in weights and fair shares']),
    wants: Object.freeze(['honest scales', 'the river to stop bringing him things']),
    tragedy: 'His partner thumbed the scale against widows; the drowning was almost an accident. The river approved, and now brings him everyone it thinks deserves grinding.',
    redemption: 'He must weigh his own deed on his own scale in front of the crossing, and let the river hear the total.',
    factionId: 'the-vale-itself', cityId: 'millwrack-crossing',
    statBlockId: 'bandit-captain',
  }),
  'darklord-ivenna-of-the-glass': Object.freeze({
    id: 'darklord-ivenna-of-the-glass', name: 'Ivenna of the Glass',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['kiln-warm', 'looks at the light around you, not at you']),
    wants: Object.freeze(['everyone she loves where she can see them', 'the morning sun through her daughter']),
    tragedy: 'Her daughter died sitting for a window portrait; finishing it felt like keeping her. The neighbors\' dead deserved keeping too. Eventually the living did.',
    redemption: 'She must break one pane herself — hers to choose — and grieve what the floor holds.',
    factionId: 'the-vale-itself', cityId: 'pane-street',
    statBlockId: 'banshee',
  }),
  'darklord-warden-mosswell': Object.freeze({
    id: 'darklord-warden-mosswell', name: 'Warden Mosswell',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['signed, never spoken', 'touches his lips in apology']),
    wants: Object.freeze(['the wood quiet', 'nobody learning what listens for noise']),
    tragedy: 'He hushed the wood to starve the thing that hunted by sound, and it worked — it sleeps. Every spoken word risks waking it, so he silences speakers first.',
    redemption: 'Someone must sing in the wood while the party proves the hunter is dead — or faces what wakes.',
    factionId: 'the-vale-itself', cityId: 'the-quiet-stead',
    statBlockId: 'wight',
  }),
  'darklord-mother-tansy': Object.freeze({
    id: 'darklord-mother-tansy', name: 'Mother Tansy',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['midwife-calm', 'calls everyone "my delivered"']),
    wants: Object.freeze(['every family whole', 'every debt of breath acknowledged']),
    tragedy: 'She truly never lost one — by lending her own winters to failing hearts. Decades of borrowed cold need paying, and she collects from the families she saved.',
    redemption: 'A family must offer a winter freely, unasked — charity where she only ever knew debt.',
    factionId: 'the-vale-itself', cityId: 'tansy-moor',
    statBlockId: 'banshee',
  }),
  'darklord-halberd-june': Object.freeze({
    id: 'darklord-halberd-june', name: 'Halberd June',
    archetypeRole: 'antagonist',
    voice: Object.freeze(['innkeeper-hearty, wearing thin', 'checks the door at every hoofbeat']),
    wants: Object.freeze(['his party to walk in', 'one story that makes their absence bearable']),
    tragedy: 'He took the only pass out to fetch help and the Vale closed behind him; his party never followed. He keeps the inn so the road has a witness — and keeps the guests so he isn\'t the only one waiting.',
    redemption: 'Tell him the true story of a party that ended well APART — and mean it — and he opens the pass himself.',
    factionId: 'the-vale-itself', cityId: 'the-last-inn-yard',
    statBlockId: 'veteran',
  }),
});

// The Vale itself is the only power; the domains answer to their lords
// and the lords answer to what they did.
export const HOLLOW_VALE_FACTIONS = Object.freeze({
  'the-vale-itself': Object.freeze({
    id: 'the-vale-itself', name: 'The Vale Itself',
    stance: 'keep-what-it-catches', seat: null,
    wants: 'its lords facing what they did, forever — unless someone walks them through the door out',
    enemies: Object.freeze([]),
  }),
});

// ── Gothic mechanics as data ────────────────────────────────────────────

// The dread track: a VariantEncounter custom track. adjustTrack /
// trackValue / rankFor drive it with no new machinery — thresholds are
// rank rows, and what each rank DOES is host guidance in `effect`.
export const HOLLOW_VALE_DREAD = Object.freeze({
  band: Object.freeze({ min: 0, max: 10, start: 0 }),
  thresholds: Object.freeze([
    Object.freeze({ at: 3, name: 'unnerved', effect: 'disadvantage on the next fear-adjacent check' }),
    Object.freeze({ at: 6, name: 'haunted', effect: 'sanity checks (VariantRest) at disadvantage while it holds' }),
    Object.freeze({ at: 9, name: 'breaking', effect: 'the next dread gain also costs 1d4 sanity' }),
  ]),
  // What moves it, so tables stay consistent: gains are moments, not rolls.
  gains: Object.freeze({
    witnessDomainTruth: 2, darklordAttention: 2, nightWithoutLight: 3,
    dreamSequence: 1, restInSanctuary: -2, daylightHour: -1,
  }),
});

/**
 * Light as a resource: burn lantern-hours and learn what the dark
 * costs. Pure — actor in, envelope out. `actor.lightHours` is the
 * host-stamped pool (Light-Hoarder doubles it, per that feat's grant).
 * Burning past empty returns `inTheDark: true` plus the dread gain the
 * table applies via HOLLOW_VALE_DREAD.gains.nightWithoutLight.
 */
export function burnLight(actor, hours = 1) {
  const pool = actor.lightHours ?? 0;
  const remaining = Math.max(0, pool - Math.max(0, hours));
  const inTheDark = remaining === 0 && hours > 0;
  return {
    actor: { ...actor, lightHours: remaining },
    remaining,
    inTheDark,
    ...(inTheDark ? { dreadGain: HOLLOW_VALE_DREAD.gains.nightWithoutLight } : {}),
  };
}
