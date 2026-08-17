// The Hollow Vale — hooks and the starter adventure.
//
// Bramblefell: the first domain, played as the setting means to go on —
// a moral arc with a door out. It also demonstrates the dream-sequence
// pattern: beat.03 is a dream (`dream: true`), staged by the Beats
// runtime like any other beat, presented by the host as sleep.

export const HOLLOW_VALE_HOOKS = Object.freeze({
  'bramblefell-hook': Object.freeze({
    id: 'bramblefell-hook', title: 'The Second Helping',
    cityId: 'bramblefell-green', factionId: 'the-vale-itself',
    pitch: 'A letter from an old friend: "Come to Bramblefell, the bread is wonderful, I am never leaving." The handwriting is right. The never is underlined twice.',
    reward: 'the-friend-out-or-the-reason-why-not',
    adventureId: 'bramblefell',
  }),
  'the-wax-ledger': Object.freeze({
    id: 'the-wax-ledger', title: 'The Wax Ledger',
    cityId: 'taperhold', factionId: 'the-vale-itself',
    pitch: 'Father Wick\'s ledger says the widow Harrow has three candle-hours left — total, ever. Her children are owed forty each. She has asked no one for help, which is the problem.',
    reward: 'hours-of-your-own-to-give',
  }),
  'the-hundredth-graft': Object.freeze({
    id: 'the-hundredth-graft', title: 'The Hundredth Graft',
    cityId: 'graftling', factionId: 'the-vale-itself',
    pitch: 'Sera Ashglove\'s hundredth tree fruits this week. The village knows whose memory it carries: the one duel that WASN\'T lawful. So does she. So does the tree.',
    reward: 'the-orchards-one-sweet-row',
  }),
  'the-flour-tithe': Object.freeze({
    id: 'the-flour-tithe', title: 'The Flour Tithe',
    cityId: 'millwrack-crossing', factionId: 'the-vale-itself',
    pitch: 'The river brought the mill a tax collector this month. Toller Grist hasn\'t ground him yet — the scales keep reading UNDECIDED, and the wheel is getting impatient.',
    reward: 'safe-crossing-written-in-flour',
  }),
  'the-empty-pane': Object.freeze({
    id: 'the-empty-pane', title: 'The Empty Pane',
    cityId: 'pane-street', factionId: 'the-vale-itself',
    pitch: 'There is one empty pane left in Ivenna\'s gallery, sized and leaded. She has started taking measurements of visitors. Politely. With chalk.',
    reward: 'a-window-that-holds-only-morning',
  }),
  'the-spoken-name': Object.freeze({
    id: 'the-spoken-name', title: 'The Spoken Name',
    cityId: 'the-quiet-stead', factionId: 'the-vale-itself',
    pitch: 'A child in the Quiet Stead spoke her mother\'s name aloud — the first word in Hushwood in nine years. Warden Mosswell is coming, and under the wood, something rolled over in its sleep.',
    reward: 'the-woods-first-song',
  }),
  'the-owed-winter': Object.freeze({
    id: 'the-owed-winter', title: 'The Owed Winter',
    cityId: 'tansy-moor', factionId: 'the-vale-itself',
    pitch: 'Mother Tansy has called in the Merrow family\'s debt: one winter, payable this year, from the daughter she delivered twenty years ago. The family is deciding which is worse — paying, or what refusing makes them.',
    reward: 'a-winter-nobody-pays',
  }),
  'the-open-bill': Object.freeze({
    id: 'the-open-bill', title: 'The Open Bill',
    cityId: 'the-last-inn-yard', factionId: 'the-vale-itself',
    pitch: 'The Last Inn has eleven guests who have "not settled up," some for decades. Halberd June takes payment in one currency: a story about a party that ended well. Nobody has had one he believed.',
    reward: 'the-pass-out-of-the-vale',
  }),
});

// ── Bramblefell (~90 minutes, 4 × L3) ───────────────────────────────────

const BRAMBLEFELL_BEATS = [
  {
    id: 'beat.01.the-underlined-never',
    dramaticPurpose: 'Arrive: the village is warm, the bread smells like childhood, and the friend who wrote is at Maren\'s table, happy in a way that does not blink.',
    targetPlaytimeMinutes: 15,
    prerequisites: [],
    setRequiredFlags: ['bf.at-table'],
    preferredLocation: 'scene.the-green',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'antagonist', notes: 'Maren greets every guest personally; refuse nothing rudely' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.02.the-hedge-walk',
    dramaticPurpose: 'Test the edges: walk the briar, find the grown-over road out, and meet what shepherds wanderers home.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['bf.at-table'],
    setRequiredFlags: ['bf.seen-the-briar'],
    preferredLocation: 'scene.the-hedge',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.03.the-famine-dream',
    dramaticPurpose: 'DREAM: sleep in Bramblefell and stand in the famine year — the locked granary, the empty chairs, the oath. Wake knowing WHY, which is the key to the door out.',
    targetPlaytimeMinutes: 15,
    prerequisites: ['bf.seen-the-briar'],
    setRequiredFlags: ['bf.dreamed-the-famine'],
    preferredLocation: 'scene.the-famine-year',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    dream: true,
    successors: []
  },
  {
    id: 'beat.04.the-refused-loaf',
    dramaticPurpose: 'The door out: refuse the bread kindly and STAY — prove a chair can empty and refill — while the briar and the oath object.',
    targetPlaytimeMinutes: 25,
    prerequisites: ['bf.dreamed-the-famine'],
    setRequiredFlags: ['bf.chair-refilled'],
    preferredLocation: 'scene.the-long-table',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'antagonist', notes: 'Maren is not defeated; she is walked to a door. The fight is the briar disagreeing.' }],
    boundEntities: {},
    successors: []
  }
];

const BRAMBLEFELL_SCENES = [
  {
    id: 'scene.the-green',
    title: 'Bramblefell Green',
    beatId: 'beat.01.the-underlined-never',
    readAloud: 'The green is mowed, the ovens are singing, and your friend waves from Maren\'s table with both hands — the wave of someone with nothing in the world to warn you about. The bread smells like every good year you ever had.',
    cast: ['darklord-maren-ovenwarm', 'the-letter-friend'],
    objectives: [{ flag: 'bf.at-table', description: 'Sit at the table; take Maren\'s measure without taking the bread' }],
    exits: [{ to: 'scene.the-hedge', label: 'Walk the village edge before dark', requiresFlag: 'bf.at-table' }]
  },
  {
    id: 'scene.the-hedge',
    title: 'The Hedge',
    beatId: 'beat.02.the-hedge-walk',
    readAloud: 'The road out is under the briar — you can see cobbles between the roots, a mile of them, all claimed. Lights drift the hedgerow like helpful lanterns, and the shade between them moves at walking pace, patiently, alongside you.',
    cast: [],
    objectives: [{ flag: 'bf.seen-the-briar', description: 'Find the old road and survive the hedge\'s shepherds' }],
    encounter: {
      monsters: [{ id: 'will-o-wisp', count: 1 }, { id: 'shadow', count: 2 }],
      // 450 + 100 + 100 = 650 XP — 'low' for 4 × L3.
      intendedDifficulty: 'low'
    },
    exits: [{ to: 'scene.the-famine-year', label: 'Sleep in Bramblefell', requiresFlag: 'bf.seen-the-briar' }]
  },
  {
    id: 'scene.the-famine-year',
    title: 'The Famine Year (a dream)',
    beatId: 'beat.03.the-famine-dream',
    readAloud: 'You are standing in snow that fell forty years ago. The granary is locked; you can hear the grain settling inside it like a fat man breathing. At a bare table, a young baker sets out five plates for a family of five, and then, one by one, takes four away.',
    cast: [],
    objectives: [{ flag: 'bf.dreamed-the-famine', description: 'Witness the oath being made; wake with the why' }],
    exits: [{ to: 'scene.the-long-table', label: 'Wake, and go to breakfast', requiresFlag: 'bf.dreamed-the-famine' }]
  },
  {
    id: 'scene.the-long-table',
    title: 'The Long Table',
    beatId: 'beat.04.the-refused-loaf',
    readAloud: 'Every chair in Bramblefell is at Maren\'s table this morning, and one is for you. The loaf lands warm in front of you. The village holds its breath. Somewhere under the floor, the briar tightens its grip on a mile of cobbles — it knows what a kind refusal costs it.',
    cast: ['darklord-maren-ovenwarm'],
    objectives: [{ flag: 'bf.chair-refilled', description: 'Refuse the bread kindly, stay anyway, and hold the table while the briar objects' }],
    encounter: {
      monsters: [{ id: 'cult-fanatic', count: 1 }, { id: 'gibbering-mouther', count: 1 }, { id: 'shadow', count: 1 }],
      // 450 + 450 + 100 = 1000 XP — 'moderate' for 4 × L3. The arc's
      // climax is the refusal; the briar's objection is the fight.
      intendedDifficulty: 'moderate'
    },
    treasure: ['loaf-that-remembers', { coins: { gp: 80 } }],
    exits: []
  }
];

const BRAMBLEFELL_NPCS = Object.freeze({
  'darklord-maren-ovenwarm': {
    id: 'darklord-maren-ovenwarm', name: 'Maren Ovenwarm',
    archetypeRole: 'antagonist',
    voice: ['flour-soft', 'feeds you before answering'],
    wants: ['a full table forever', 'no empty chair ever again'],
    statBlockId: 'cult-fanatic'
  },
  'the-letter-friend': {
    id: 'the-letter-friend', name: 'The Friend Who Wrote',
    archetypeRole: 'informant',
    voice: ['contentment with a crack in it', 'underlines words with a finger while speaking'],
    wants: ['you to stay', 'to remember why the never was underlined'],
    statBlockId: null
  }
});

export const BRAMBLEFELL = Object.freeze({
  id: 'bramblefell',
  title: 'Bramblefell',
  estimatedMinutes: 90,
  partyProfile: { size: 4, levels: [3, 3, 3, 3] },
  start: 'scene.the-green',
  beats: BRAMBLEFELL_BEATS,
  scenes: BRAMBLEFELL_SCENES,
  npcs: BRAMBLEFELL_NPCS
});

export const HOLLOW_VALE_ADVENTURES = Object.freeze({
  'bramblefell': BRAMBLEFELL,
});
