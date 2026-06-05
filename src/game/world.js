// src/game/world.js — dungeon generation: the ALGORITHM lives in the client
// library (@zeeuw/bag-of-holding-client/dungeon); this module injects the app's
// content — locale room/loot descriptors (i18n) and engine stat blocks
// (bestiary) — and keeps the dungeon-entry + encounter-enemy wrappers.

import { tRaw } from '../i18n/i18n.js';
import { Dice } from './rules.js';
import { statBlockFor, BESTIARY, DEFAULT_ENEMY_IDS } from './bestiary.js';
import { DUNGEON_OVERLAYS, DOMAIN_TREASURES, DOMAIN_KEYS } from './worldseed.js';
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
    treasures:       tRaw('world.treasures'),
    keys:            tRaw('world.keys'),
    loot:            tRaw('world.loot') ?? [],
    domainTreasures: DOMAIN_TREASURES,
    domainKeys:      DOMAIN_KEYS,
    enemyName,
    enemyIntro,
  };
}

// ─── Dungeon generator ────────────────────────────────────────────────────────
// Returns { rooms, npcs, currentRoom, exitRoomId } for embedding in world.dungeons.

export function generateDungeon(seed, blueprint) {
  return libGenerateDungeon(seed, {
    blueprint,
    rng:             seed != null ? Dice.seededRng(seed) : undefined,
    statBlockFor,
    crOf:            (id) => BESTIARY[id]?.cr ?? 0,
    overlays:        DUNGEON_OVERLAYS,
    defaultEnemyIds: DEFAULT_ENEMY_IDS,
    content:         dungeonContent(),
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

export function createDungeonEntry({ id, name, regionId, seed: entrySeed, blueprint = null }) {
  const dungeonSeed = entrySeed ?? Math.floor(Math.random() * 2147483647);
  const dungeon     = generateDungeon(dungeonSeed, blueprint);
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
