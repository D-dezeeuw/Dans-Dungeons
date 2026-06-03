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
  BUILDING_TYPES, LOCATION_TYPES,
};
