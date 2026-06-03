// src/game/worldseed.js — pre-seeded world blueprint builder.
//
// Pure JS, no AI. Picks from curated archetype lists using seeded RNG.
// The blueprint becomes concrete constraints for each AI generator call,
// shifting the LLM's job from "invent everything" to "flesh out these choices."
//
// Same seed → same blueprint → reproducible worlds.

import { Dice } from './rules.js';

// ─── RNG helpers ─────────────────────────────────────────────────────────────

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(arr, n, rng) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// ─── Tones (5) ───────────────────────────────────────────────────────────────

const TONES = ['grimdark', 'heroic', 'mysterious', 'tragic', 'whimsical'];

// ─── World archetypes (24) ───────────────────────────────────────────────────

const WORLD_ARCHETYPES = [
  'post-collapse empire',   'frontier expansion',     'divine conflict',
  'creeping corruption',    'ancient awakening',      'invasion from beyond',
  'succession crisis',      'forbidden knowledge',    'dying world',
  'planar convergence',     'eternal war',            'shattered continent',
  'theocratic tyranny',     'merchant republic',      'nomadic wasteland',
  'underwater dominion',    'sky archipelago',        'prison realm',
  'dream-touched lands',    'clockwork civilization', 'plague aftermath',
  'dragon age',             'fey-mortal border',      'underdark ascent',
];

// ─── Threat types (24) ──────────────────────────────────────────────────────

const THREAT_TYPES = [
  'undead plague',          'demonic incursion',      'dragon tyranny',
  'mind flayer hive',       'lich ritual',            'fey wild breach',
  'orc horde',              'cult ascension',         'elemental chaos',
  'vampire court',          'abyssal rift',           'beholder conspiracy',
  'yuan-ti infiltration',   'kraken awakening',       'tarrasque stirring',
  'shadow fell bleed',      'modron march',           'githyanki raid',
  'aboleth domination',     'werewolf curse',         'hag coven',
  'djinn wish gone wrong',  'titan prison cracking',  'void entity',
];

// ─── Beat arc templates by tone ─────────────────────────────────────────────

const BEAT_ARCS = {
  grimdark:    ['omen', 'discovery', 'betrayal', 'sacrifice', 'pyrrhic victory'],
  heroic:      ['call to action', 'gathering allies', 'trial', 'darkest hour', 'triumph'],
  mysterious:  ['whisper', 'clue', 'revelation', 'reversal', 'truth'],
  tragic:      ['hope', 'hubris', 'fall', 'consequence', 'acceptance'],
  whimsical:   ['curiosity', 'misadventure', 'unlikely ally', 'chaos', 'bittersweet resolution'],
};

// ─── Faction archetypes (20) ────────────────────────────────────────────────

const FACTION_ARCHETYPES = [
  { type: 'crown',          desc: 'ruling monarchy or imperial authority' },
  { type: 'church',         desc: 'organized religion with political power' },
  { type: 'military',       desc: 'standing army or knightly order' },
  { type: 'rebellion',      desc: 'oppressed group fighting for freedom' },
  { type: 'cult',           desc: 'secret worshippers of a dark or forbidden power' },
  { type: 'syndicate',      desc: 'criminal network — thieves guild, smugglers, assassins' },
  { type: 'guild',          desc: 'trade or craft organization with economic leverage' },
  { type: 'warband',        desc: 'nomadic fighters, raiders, or mercenaries' },
  { type: 'circle',         desc: 'druids, sages, or arcanists pursuing knowledge' },
  { type: 'inquisition',    desc: 'zealots hunting heresy, witchcraft, or monsters' },
  { type: 'merchant house', desc: 'wealthy trading dynasty controlling supply lines' },
  { type: 'spy network',    desc: 'intelligence agency or shadow council' },
  { type: 'undead legion',  desc: 'organized undead under a lich or vampire lord' },
  { type: 'dragonsworn',    desc: 'mortals serving a dragon overlord' },
  { type: 'ranger corps',   desc: 'wilderness protectors, monster hunters' },
  { type: 'pirate fleet',   desc: 'naval raiders controlling sea routes' },
  { type: 'exile commune',  desc: 'banished outcasts forming their own society' },
  { type: 'elemental lodge', desc: 'elementalists harnessing primal forces' },
  { type: 'blood pact',     desc: 'warlocks bound by a shared patron' },
  { type: 'ancestors watch', desc: 'spirit-channelers preserving ancient traditions' },
];

// ─── Climates (20) ──────────────────────────────────────────────────────────

const CLIMATES = [
  'frozen tundra',         'boreal taiga',          'temperate forest',
  'rolling grasslands',    'arid desert',           'rocky badlands',
  'coastal cliffs',        'tropical coast',        'mangrove swamp',
  'highland plateau',      'volcanic caldera',      'deep canyon',
  'river delta',           'island chain',          'underground caverns',
  'floating islands',      'petrified forest',      'crystal wastes',
  'mushroom jungle',       'eternal twilight moor',
];

// ─── Settlement types (grouped by climate, 4 each = 80 total) ───────────────

const SETTLEMENT_TYPES = {
  'frozen tundra':          ['frontier outpost', 'mining camp', 'fortified lodge', 'ice-fisher village'],
  'boreal taiga':           ['logging town', 'trapper hamlet', 'wolf-rider camp', 'monastery'],
  'temperate forest':       ['farming village', 'woodland hamlet', 'crossroads town', 'mill town'],
  'rolling grasslands':     ['herder camp', 'caravan waystation', 'horse-lord hold', 'market town'],
  'arid desert':            ['oasis trading post', 'canyon settlement', 'sandstone citadel', 'nomad bazaar'],
  'rocky badlands':         ['cliff dwelling', 'ruin-scavenger camp', 'bandit hideout', 'quarry town'],
  'coastal cliffs':         ['fishing village', 'lighthouse garrison', 'smuggler cove', 'shipwright town'],
  'tropical coast':         ['pearl-diver hamlet', 'port town', 'plantation estate', 'pirate haven'],
  'mangrove swamp':         ['stilt village', 'herbalist commune', 'lizardfolk trading post', 'druid grove'],
  'highland plateau':       ['fortress town', 'goat-herder settlement', 'sky temple', 'watchpost'],
  'volcanic caldera':       ['forge city', 'obsidian mining camp', 'fire-cult commune', 'refugee camp'],
  'deep canyon':            ['rope-bridge town', 'cave settlement', 'hermit cluster', 'mine head'],
  'river delta':            ['barge town', 'rice-farming village', 'ferry crossing', 'flood-watch post'],
  'island chain':           ['harbor village', 'coral-diver camp', 'marooned colony', 'sea-elf enclave'],
  'underground caverns':    ['mushroom farm', 'duergar outpost', 'crystal market', 'exile colony'],
  'floating islands':       ['sky-dock', 'wind-temple', 'cloud shepherd camp', 'aeronaut guild'],
  'petrified forest':       ['stone-cutter camp', 'ghost town', 'druid circle', 'fossil dig'],
  'crystal wastes':         ['shard-miner outpost', 'arcane observatory', 'nomad camp', 'rift shelter'],
  'mushroom jungle':        ['spore-farmer village', 'myconid embassy', 'alchemist colony', 'ranger station'],
  'eternal twilight moor':  ['peat-cutter hamlet', 'will-o-wisp shrine', 'fogbound inn', 'wardstone outpost'],
};

// ─── Dungeon themes (24) ────────────────────────────────────────────────────

const DUNGEON_THEMES = [
  'undead crypt',          'goblin warren',         'cult sanctum',
  'beast lair',            'arcane ruin',           'flooded cavern',
  'haunted manor',         'abandoned mine',        'dragon hoard',
  'vampire castle',        'elemental nexus',       'fungal depths',
  'clockwork vault',       'planar rift',           'sunken temple',
  'frozen tomb',           'spider nest',           'bandit fortress',
  'fey glade gone wrong',  'demonic hellgate',      'ancient library',
  'petrified giant',       'living dungeon',        'dream prison',
];

// ─── God domains (20) ──────────────────────────────────────────────────────

const GOD_DOMAINS = [
  { domain: 'death',     exemplars: ['Kelemvor', 'Myrkul', 'The Raven Queen'] },
  { domain: 'war',       exemplars: ['Tempus', 'Bane', 'Gruumsh'] },
  { domain: 'nature',    exemplars: ['Silvanus', 'Mielikki', 'Chauntea'] },
  { domain: 'trickery',  exemplars: ['Mask', 'Cyric', 'Lolth'] },
  { domain: 'light',     exemplars: ['Lathander', 'Pelor', 'Helm'] },
  { domain: 'knowledge', exemplars: ['Oghma', 'Mystra', 'Azuth'] },
  { domain: 'tempest',   exemplars: ['Talos', 'Umberlee', 'Kord'] },
  { domain: 'forge',     exemplars: ['Moradin', 'Gond', 'Hephaestus'] },
  { domain: 'life',      exemplars: ['Ilmater', 'Lliira', 'Boldrei'] },
  { domain: 'grave',     exemplars: ['Jergal', 'Anubis', 'Wee Jas'] },
  { domain: 'order',     exemplars: ['Tyr', 'Pholtus', 'Aureon'] },
  { domain: 'twilight',  exemplars: ['Selune', 'Sehanine', 'Celestian'] },
  { domain: 'arcana',    exemplars: ['Mystra', 'Corellon', 'Boccob'] },
  { domain: 'vengeance', exemplars: ['Hoar', 'Erythnul', 'Nemesis'] },
  { domain: 'chaos',     exemplars: ['Cyric', 'Lolth', 'Tharizdun'] },
  { domain: 'sea',       exemplars: ['Umberlee', 'Procan', 'Deep Sashelas'] },
  { domain: 'hunting',   exemplars: ['Malar', 'Ehlonna', 'Obad-Hai'] },
  { domain: 'dreams',    exemplars: ['Sehanine', 'Morpheus', 'Dal Quor'] },
  { domain: 'madness',   exemplars: ['Tharizdun', 'Cyric', 'Hadar'] },
  { domain: 'beauty',    exemplars: ['Sune', 'Hanali Celanil', 'Aphrodite'] },
];

// ─── Building types (24) ────────────────────────────────────────────────────

const BUILDING_TYPES = [
  'tavern',         'inn',            'blacksmith',      'temple',
  'market hall',    'barracks',       'library',         'apothecary',
  'stables',        'town hall',      'warehouse',       'bakery',
  'tannery',        'watchtower',     'herbalist hut',   'alchemist shop',
  'fighting pit',   'fortune teller', 'bathhouse',       'cemetery chapel',
  'brewery',        'docks',          'wizard tower',    'orphanage',
];

// ─── Location types for overworld (24) ──────────────────────────────────────

const LOCATION_TYPES = [
  'crossroads',     'bridge',         'ancient ruin',     'standing stones',
  'abandoned farm',  'battlefield',   'sacred grove',     'waterfall',
  'cave mouth',     'cliffside path', 'merchant caravan', 'bandit camp',
  'haunted well',   'toll gate',      'shipwreck',        'hermit hut',
  'hot springs',    'frozen lake',    'mushroom ring',    'dragon bones',
  'elven waystone', 'dwarven marker', 'obelisk',          'petrified tree',
];

// ─── Blueprint builder ──────────────────────────────────────────────────────

export function buildWorldBlueprint(seed) {
  const numSeed = typeof seed === 'number' ? seed : hashString(seed ?? String(Date.now()));
  const rng = Dice.seededRng(numSeed);

  const tone    = pick(TONES, rng);
  const climate = pick(CLIMATES, rng);

  return {
    seed:            numSeed,
    tone,
    worldArchetype:  pick(WORLD_ARCHETYPES, rng),
    threatType:      pick(THREAT_TYPES, rng),
    beatArc:         BEAT_ARCS[tone] ?? BEAT_ARCS.heroic,
    factionSlots:    pickN(FACTION_ARCHETYPES, 3, rng),
    climate,
    settlementType:  pick(SETTLEMENT_TYPES[climate] ?? SETTLEMENT_TYPES['temperate forest'], rng),
    dungeonTheme:    pick(DUNGEON_THEMES, rng),
    godDomains:      pickN(GOD_DOMAINS, 3, rng),
    buildingTypes:   pickN(BUILDING_TYPES, 4, rng),
    locationTypes:   pickN(LOCATION_TYPES, 3, rng),
  };
}

// ─── Dungeon theme overlays (24) ─────────────────────────────────────────────
// Each theme maps to an atmosphere sentence + preferred enemy names.

export const DUNGEON_OVERLAYS = {
  'undead crypt':          { atmosphere: 'The air reeks of embalming salts and grave earth.',                    enemies: ['Guard Skeleton', 'Shambling Corpse'] },
  'goblin warren':         { atmosphere: 'Crude markings cover the walls. Something gnaws in the dark.',        enemies: ['Grizzik the Goblin', 'Giant Rat'] },
  'cult sanctum':          { atmosphere: 'Candle wax pools on every surface. Chanting echoes from deeper within.', enemies: ['Feral Cultist', 'Guard Skeleton'] },
  'beast lair':            { atmosphere: 'Claw marks gouge the stone. The stench of animal musk is overwhelming.', enemies: ['Giant Rat', 'Cave Spider'] },
  'arcane ruin':           { atmosphere: 'Faint runes pulse along the walls. The air crackles with residual magic.', enemies: ['Feral Cultist', 'Guard Skeleton'] },
  'flooded cavern':        { atmosphere: 'Water drips from the ceiling. The floor is slick and treacherous.',     enemies: ['Giant Rat', 'Cave Spider'] },
  'haunted manor':         { atmosphere: 'Dust motes drift through pale light. A door creaks on its own.',       enemies: ['Shambling Corpse', 'Cave Spider'] },
  'abandoned mine':        { atmosphere: 'Rotting timber props sag under the weight of earth. Pickaxes rust in corners.', enemies: ['Giant Rat', 'Grizzik the Goblin'] },
  'dragon hoard':          { atmosphere: 'Scorch marks blacken the walls. The heat is unnatural.',               enemies: ['Guard Skeleton', 'Feral Cultist'] },
  'vampire castle':        { atmosphere: 'Velvet drapes hang in tatters. The scent of old blood lingers.',       enemies: ['Shambling Corpse', 'Feral Cultist'] },
  'elemental nexus':       { atmosphere: 'Sparks of raw energy arc between the walls. The ground hums.',         enemies: ['Guard Skeleton', 'Cave Spider'] },
  'fungal depths':         { atmosphere: 'Bioluminescent mushrooms cast an eerie glow. Spores drift lazily.',    enemies: ['Giant Rat', 'Cave Spider'] },
  'clockwork vault':       { atmosphere: 'Gears click and whir behind the walls. The floor vibrates rhythmically.', enemies: ['Guard Skeleton', 'Shambling Corpse'] },
  'planar rift':           { atmosphere: 'Reality shimmers at the edges. Colours that shouldn\'t exist bleed through.', enemies: ['Feral Cultist', 'Cave Spider'] },
  'sunken temple':         { atmosphere: 'Waterlogged stone and barnacle-crusted pillars. Fish bones crunch underfoot.', enemies: ['Shambling Corpse', 'Giant Rat'] },
  'frozen tomb':           { atmosphere: 'Ice coats every surface. Your breath crystallizes instantly.',          enemies: ['Guard Skeleton', 'Shambling Corpse'] },
  'spider nest':           { atmosphere: 'Silk threads catch the light everywhere. Husks of drained prey line the walls.', enemies: ['Cave Spider', 'Giant Rat'] },
  'bandit fortress':       { atmosphere: 'Crude barricades and stolen goods are piled in every corner.',         enemies: ['Grizzik the Goblin', 'Feral Cultist'] },
  'fey glade gone wrong':  { atmosphere: 'Flowers bloom in impossible colours. The laughter you hear isn\'t human.', enemies: ['Cave Spider', 'Feral Cultist'] },
  'demonic hellgate':      { atmosphere: 'The stone is warm to the touch. Symbols of binding cover every surface.', enemies: ['Feral Cultist', 'Shambling Corpse'] },
  'ancient library':       { atmosphere: 'Shelves of rotting tomes stretch into shadow. Pages flutter with no wind.', enemies: ['Guard Skeleton', 'Feral Cultist'] },
  'petrified giant':       { atmosphere: 'The walls are organic — veins of stone pulse faintly. You\'re inside something.', enemies: ['Cave Spider', 'Giant Rat'] },
  'living dungeon':        { atmosphere: 'The corridors shift when you\'re not looking. The dungeon is alive.',  enemies: ['Shambling Corpse', 'Cave Spider'] },
  'dream prison':          { atmosphere: 'The geometry is wrong. Stairs lead sideways. Gravity is a suggestion.', enemies: ['Feral Cultist', 'Guard Skeleton'] },
};

// ─── Domain-themed treasures (20 domains) ────────────────────────────────────

export const DOMAIN_TREASURES = {
  'death':     { name: 'skull-crowned scepter',       desc: 'A scepter topped with a silver skull whose eye sockets glow faintly.' },
  'war':       { name: 'battle-scarred war banner',   desc: 'A tattered banner that fills you with courage when unfurled.' },
  'nature':    { name: 'living seed crystal',         desc: 'A gemstone with a tiny fern growing inside, warm to the touch.' },
  'trickery':  { name: 'mirror of false faces',       desc: 'A hand mirror that shows a different face each time you look.' },
  'light':     { name: 'sunstone pendant',            desc: 'A golden pendant that radiates warmth and a soft, steady glow.' },
  'knowledge': { name: 'tome of whispered truths',    desc: 'An ancient book that murmurs answers when you ask questions aloud.' },
  'tempest':   { name: 'stormcaller\'s horn',         desc: 'A curved horn that crackles with static electricity.' },
  'forge':     { name: 'anvil shard',                 desc: 'A fragment of a divine anvil, impossibly dense and warm.' },
  'life':      { name: 'chalice of renewal',          desc: 'A silver chalice. Any water poured in becomes sweet and restorative.' },
  'grave':     { name: 'mourner\'s lantern',          desc: 'A lantern that burns without fuel. The dead are drawn to its light.' },
  'order':     { name: 'seal of binding oaths',       desc: 'A heavy seal ring. Promises made while wearing it cannot be broken.' },
  'twilight':  { name: 'duskweave cloak',             desc: 'A cloak that seems woven from the last light of sunset.' },
  'arcana':    { name: 'crystallized spell',          desc: 'A hovering crystal containing a spell frozen mid-cast.' },
  'vengeance': { name: 'grudge-keeper\'s blade',      desc: 'A dagger that grows warm when pointed at someone who wronged you.' },
  'chaos':     { name: 'entropy marble',              desc: 'A sphere of constantly shifting matter. It is never the same twice.' },
  'sea':       { name: 'tide pearl',                  desc: 'A black pearl that hums with the rhythm of distant waves.' },
  'hunting':   { name: 'predator\'s fang necklace',   desc: 'A necklace of fangs from creatures that no longer exist.' },
  'dreams':    { name: 'sleepwalker\'s compass',      desc: 'A compass that points toward whatever you dreamed of last.' },
  'madness':   { name: 'whispering orb',              desc: 'A glass orb filled with smoke that forms words you almost understand.' },
  'beauty':    { name: 'rose that never wilts',       desc: 'A perfect crimson rose, eternally in bloom. It smells like nostalgia.' },
};

// ─── Domain-themed keys (20 domains) ─────────────────────────────────────────

export const DOMAIN_KEYS = {
  'death':     { name: 'bone key',          desc: 'Carved from a single finger bone. It feels heavier than it should.' },
  'war':       { name: 'iron war key',      desc: 'Forged from a melted-down sword hilt. Still warm.' },
  'nature':    { name: 'living vine key',   desc: 'A key of twisted green vine that pulses with sap.' },
  'trickery':  { name: 'invisible key',     desc: 'You can feel it in your hand but can only see it from the corner of your eye.' },
  'light':     { name: 'sunmetal key',      desc: 'A golden key that glows softly in darkness.' },
  'knowledge': { name: 'runic key',         desc: 'Covered in tiny runes that rearrange themselves when you blink.' },
  'tempest':   { name: 'lightning-scarred key', desc: 'A key with branching fracture lines like a lightning bolt.' },
  'forge':     { name: 'slag key',          desc: 'Rough-cast metal, still showing the pour marks. Unbreakable.' },
  'life':      { name: 'heartwood key',     desc: 'Smooth wood from a tree that was already ancient when the world was young.' },
  'grave':     { name: 'mourner\'s key',    desc: 'Cold iron wrapped in black cloth. It smells of lilies.' },
  'order':     { name: 'magistrate\'s key', desc: 'An official key stamped with a judicial seal. Heavy with authority.' },
  'twilight':  { name: 'dusk key',          desc: 'A key that only becomes solid at twilight. The rest of the time it shimmers.' },
  'arcana':    { name: 'crystal key',       desc: 'Transparent and faintly humming. It refracts light into impossible colours.' },
  'vengeance': { name: 'barbed key',        desc: 'A key with tiny hooks. It draws blood when turned.' },
  'chaos':     { name: 'shifting key',      desc: 'Its shape changes slightly each time you look away. It always fits.' },
  'sea':       { name: 'coral key',         desc: 'Encrusted with barnacles. It smells of salt and deep water.' },
  'hunting':   { name: 'antler key',        desc: 'Carved from a stag\'s antler. The tines form the teeth.' },
  'dreams':    { name: 'gossamer key',      desc: 'Light as a thought. You\'re not sure it\'s entirely real.' },
  'madness':   { name: 'wrong key',         desc: 'It shouldn\'t fit any lock. It does anyway.' },
  'beauty':    { name: 'rose-gold key',     desc: 'Delicate and ornate, too beautiful to be merely functional.' },
};

// Simple string → number hash for seed conversion.
function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// ─── Exports for tests ──────────────────────────────────────────────────────

export const _lists = {
  TONES, WORLD_ARCHETYPES, THREAT_TYPES, BEAT_ARCS, FACTION_ARCHETYPES,
  CLIMATES, SETTLEMENT_TYPES, DUNGEON_THEMES, GOD_DOMAINS,
  BUILDING_TYPES, LOCATION_TYPES, DUNGEON_OVERLAYS, DOMAIN_TREASURES, DOMAIN_KEYS,
};
