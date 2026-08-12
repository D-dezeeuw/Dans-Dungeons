// src/game/world.js — dungeon generation: the ALGORITHM lives in the client
// library (@zeeuw/bag-of-holding-client/dungeon); this module injects the app's
// content — locale room/loot descriptors (i18n) and engine stat blocks
// (bestiary) — and keeps the dungeon-entry + encounter-enemy wrappers.

import { tRaw } from '../i18n/i18n.js';
import { Dice } from './rules.js';
import { statBlockFor, bossBlockFor, bossTierForLevel, BESTIARY, DEFAULT_ENEMY_IDS } from './bestiary.js';
import { DUNGEON_OVERLAYS, DOMAIN_TREASURES, DOMAIN_KEYS } from './worldseed.js';
import { activePack } from '../settings/index.js';
import { generateDungeon as libGenerateDungeon } from 'bag-of-holding-client';

// ─── Creature presentation (name + intro, localized) ─────────────────────────

function enemyName(id) {
  const names = tRaw('world.enemyNames') ?? {};
  return names[id] ?? BESTIARY[id]?.name ?? id;
}

function enemyIntro(id, name, style) {
  const intros = tRaw('world.enemyIntros') ?? {};
  const tmpl = intros[id] ?? tRaw('world.enemyIntroGeneric') ?? '{{name}} turns toward you, hostile and ready.';
  return tmpl.replaceAll('{{style}}', style).replaceAll('{{name}}', name);
}

// The locale-driven content the dungeon algorithm needs (room descriptions, loot
// tables, themed treasures/keys, creature presentation).
function dungeonContent() {
  const roomTypes = ['entrance', 'hall', 'corridor', 'chamber', 'storage', 'quarters', 'shrine', 'vault'];
  const roomPools = {};
  for (const type of roomTypes) roomPools[type] = tRaw(`world.rooms.${type}`) ?? tRaw('world.rooms.chamber');
  return {
    houseStyles:     tRaw('world.houseStyles'),
    roomPools,
    // One small concrete detail per room, drawn by the generator from its own
    // seeded stream. The theme's `atmosphere` is a single sentence, so without
    // this every middle room in a crypt ended with the same line and the rooms
    // were interchangeable. Entrance and vault get the generic pool: they skip
    // the theme atmosphere by design, and a bare doorway is still a place.
    dressingFor: (theme, type) => {
      const generic = tRaw('world.dressingGeneric') ?? [];
      if (type === 'entrance' || type === 'vault') return generic;
      const byTheme = tRaw('world.dressing') ?? {};
      return byTheme[theme] ?? generic;
    },
    treasures:       tRaw('world.treasures'),
    keys:            tRaw('world.keys'),
    loot:            tRaw('world.loot') ?? [],
    // Room prose, loot and creature names all come through i18n, so the pack's
    // content overlay re-points them with no change here. These two are keyed
    // objects consumed directly, so they take the pack explicitly.
    domainTreasures: activePack().domainTreasures ?? DOMAIN_TREASURES,
    domainKeys:      activePack().domainKeys ?? DOMAIN_KEYS,
    enemyName,
    enemyIntro,
  };
}

// ─── Dungeon generator ────────────────────────────────────────────────────────
// Returns { rooms, npcs, currentRoom, exitRoomId } for embedding in world.dungeons.

// Dungeon scale by act: act 1 keeps the classic 4-6 spine / 2-4 branches, and
// each later act adds rooms, so a finale dungeon is a real descent rather than
// the same six chambers the campaign opened with. Pure — callers pass the act.
export function dungeonSizeForAct(act = 1) {
  const grow = Math.max(0, Math.trunc(act || 1) - 1);
  return {
    spineMin:  4 + Math.floor(grow / 2),
    spineMax:  6 + grow,
    branchMin: 2 + Math.floor(grow / 2),
    branchMax: 4 + grow,
  };
}

export function generateDungeon(seed, blueprint, { partyLevel = 1, act = 1 } = {}) {
  // The vault boss is raised a tier for the party's level, so it brings
  // multiattack, legendary actions and legendary resistance to the fight rather
  // than just a bigger hit-point pool. The generator asks for the boss block by
  // passing isBoss, so ordinary enemies are untouched.
  const blockFor = (id, opts = {}) => (opts.isBoss
    ? bossBlockFor(id, { tier: bossTierForLevel(partyLevel) })
    : statBlockFor(id));

  return libGenerateDungeon(seed, {
    blueprint,
    rng:             seed != null ? Dice.seededRng(seed) : undefined,
    statBlockFor:    blockFor,
    crOf:            (id) => BESTIARY[id]?.cr ?? 0,
    overlays:        activePack().overlays ?? DUNGEON_OVERLAYS,
    defaultEnemyIds: DEFAULT_ENEMY_IDS,
    content:         dungeonContent(),
    size:            dungeonSizeForAct(act),
  });
}

// Build a standalone combat NPC for a literal roomId (overworld travel encounters).
export function buildEnemy(creatureId, { npcId = 'enc-1', roomId = 'encounter', style } = {}) {
  const s    = style ?? (tRaw('world.houseStyles')?.[0] ?? 'ancient hold');
  const name = enemyName(creatureId);
  return {
    id:         npcId,
    roomId,
    name,
    creatureId,
    ...statBlockFor(creatureId),
    conditions: [],
    attitude:   'hostile',
    alive:      true,
    intro:      enemyIntro(creatureId, name, s),
  };
}

// ─── Dungeon entry wrapper ────────────────────────────────────────────────────
// Wraps raw generateDungeon() output with metadata for world.dungeons storage.

const DUNGEON_THEMES = ['undead', 'goblin', 'cult', 'beast', 'arcane', 'ruin'];

export function createDungeonEntry({ id, name, regionId, seed: entrySeed, blueprint = null, partyLevel = 1, act = 1 }) {
  const dungeonSeed = entrySeed ?? Math.floor(Math.random() * 2147483647);
  const dungeon     = generateDungeon(dungeonSeed, blueprint, { partyLevel, act });
  const roomCount   = Object.keys(dungeon.rooms).length;
  const enemyNames  = Object.values(dungeon.npcs).map(n => n.name);
  const theme       = blueprint?.dungeonTheme ?? DUNGEON_THEMES[Math.floor(Math.random() * DUNGEON_THEMES.length)];

  return {
    id:          id ?? `dungeon-${dungeonSeed}`,
    name:        name ?? 'Unknown Dungeon',
    description: `A ${theme} dungeon with ${roomCount} chambers.`,
    theme,
    regionId:    regionId ?? null,
    digest:      `${name ?? 'Dungeon'} — ${theme}, ${roomCount} rooms, ${enemyNames.join(', ') || 'no enemies'}.`,
    completed:   false,
    seed:        dungeonSeed,
    ...dungeon,
  };
}
