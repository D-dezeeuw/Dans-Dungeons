// src/game/world.js
//
// Procedural dungeon generator. Every call to generateWorld() returns a fresh
// dungeon with 7-12 rooms, branching paths, multiple enemies, and a key-lock
// puzzle. The topology varies each run.
//
// Algorithm:
//   1. Generate a spine of 4-6 rooms (start → ... → vault)
//   2. Attach 2-4 branch rooms off the spine
//   3. Place rooms on a 2D grid, derive cardinal-direction exits
//   4. Pick a lock gate on the spine; place the key in a pre-gate branch
//   5. Place 1-3 enemies in non-start, non-vault rooms
//   6. Scatter loot in branch rooms
//   7. Dress rooms with locale-driven descriptions

import { t, tRaw } from '../i18n/i18n.js';
import { Dice } from './rules.js';

// ─── Seeded RNG helpers ──────────────────────────────────────────────────────
// All randomness flows through _rng so dungeons are reproducible from a seed.

let _rng = Math.random;

export function setDungeonRng(rng) { _rng = rng; }

const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

function pick(arr) { return arr[Math.floor(_rng() * arr.length)]; }
function randInt(min, max) { return min + Math.floor(_rng() * (max - min + 1)); }
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function interp(str, params) {
  let out = str;
  for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{{${k}}}`, v);
  return out;
}

// ─── Grid placement ──────────────────────────────────────────────────────────
// Each room gets a (col, row) position. Connections between adjacent grid cells
// map to cardinal directions.

function dirBetween(from, to) {
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  if (dc === 1 && dr === 0) return 'east';
  if (dc === -1 && dr === 0) return 'west';
  if (dc === 0 && dr === -1) return 'north';
  if (dc === 0 && dr === 1) return 'south';
  return null;
}

function neighbourOffsets() {
  return shuffle([
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
  ]);
}

// Place a chain of rooms on a grid using a random walk.
function placeOnGrid(count) {
  const grid = new Map(); // "col,row" → roomIndex
  const positions = [];   // roomIndex → { col, row }

  let col = 0, row = 0;
  grid.set(`${col},${row}`, 0);
  positions.push({ col, row });

  for (let i = 1; i < count; i++) {
    const offsets = neighbourOffsets();
    let placed = false;
    for (const { dc, dr } of offsets) {
      const nc = col + dc, nr = row + dr;
      if (!grid.has(`${nc},${nr}`)) {
        grid.set(`${nc},${nr}`, i);
        positions.push({ col: nc, row: nr });
        col = nc;
        row = nr;
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Backtrack: find any placed room with a free neighbour.
      for (let j = positions.length - 1; j >= 0; j--) {
        const p = positions[j];
        for (const { dc, dr } of neighbourOffsets()) {
          const nc = p.col + dc, nr = p.row + dr;
          if (!grid.has(`${nc},${nr}`)) {
            grid.set(`${nc},${nr}`, i);
            positions.push({ col: nc, row: nr });
            col = nc;
            row = nr;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }
  }

  return { grid, positions };
}

// Try to attach a branch room adjacent to a given room on the grid.
function attachBranch(parentIdx, positions, grid) {
  const p = positions[parentIdx];
  for (const { dc, dr } of neighbourOffsets()) {
    const nc = p.col + dc, nr = p.row + dr;
    if (!grid.has(`${nc},${nr}`)) {
      const idx = positions.length;
      grid.set(`${nc},${nr}`, idx);
      positions.push({ col: nc, row: nr });
      return idx;
    }
  }
  return -1; // no free neighbour
}

// ─── Room types ──────────────────────────────────────────────────────────────

const MID_TYPES = ['hall', 'corridor', 'chamber', 'storage', 'quarters', 'shrine'];

function assignRoomType(idx, spineLen, totalRooms, isSpine) {
  if (idx === 0) return 'entrance';
  if (idx === spineLen - 1 && isSpine) return 'vault';
  return pick(MID_TYPES);
}

// ─── Dungeon generator (L04/L05) ──────────────────────────────────────────────
// Returns { rooms, npcs, currentRoom, exitRoomId } for embedding in world.dungeons.

export function generateDungeon(seed) {
  if (seed != null) _rng = Dice.seededRng(seed);
  const style = pick(tRaw('world.houseStyles'));

  // 1. Spine: 4-6 rooms
  const spineLen  = randInt(4, 6);
  const { grid, positions } = placeOnGrid(spineLen);
  const spineIds  = Array.from({ length: spineLen }, (_, i) => i);

  // 2. Branches: attach 2-4 side rooms to random spine rooms (not start/vault)
  const branchCount  = randInt(2, 4);
  const branchIds    = [];
  const branchParent = {}; // branchIdx → spineIdx it's attached to
  const candidates   = spineIds.slice(1, -1); // skip start and vault
  for (let b = 0; b < branchCount; b++) {
    const parent = pick(candidates.length ? candidates : spineIds.slice(1));
    const idx = attachBranch(parent, positions, grid);
    if (idx >= 0) {
      branchIds.push(idx);
      branchParent[idx] = parent;
    }
  }

  const totalRooms = positions.length;

  // 3. Build adjacency from grid positions
  const adjacency = Array.from({ length: totalRooms }, () => []);
  for (let i = 0; i < totalRooms; i++) {
    for (let j = i + 1; j < totalRooms; j++) {
      const dir = dirBetween(positions[i], positions[j]);
      if (dir) {
        adjacency[i].push({ target: j, dir });
        adjacency[j].push({ target: i, dir: OPPOSITE[dir] });
      }
    }
  }

  // 4. Assign room types and build room objects
  const roomTypes = [];
  for (let i = 0; i < totalRooms; i++) {
    const isSpine = spineIds.includes(i);
    roomTypes[i] = assignRoomType(i, spineLen, totalRooms, isSpine);
  }

  const treasure   = { ...pick(tRaw('world.treasures')) };
  const keyItem    = { ...pick(tRaw('world.keys')) };

  const rooms = {};
  for (let i = 0; i < totalRooms; i++) {
    const id   = `room-${i}`;
    const type = roomTypes[i];
    const pool = tRaw(`world.rooms.${type}`) ?? tRaw('world.rooms.chamber');
    const def  = pick(pool);

    const descParams = { style };
    if (type === 'vault') descParams.treasure = treasure.name;

    rooms[id] = {
      id,
      name:        def.name,
      description: interp(def.desc, descParams),
      exits:       adjacency[i].map(a => ({
        dir:    a.dir,
        roomId: `room-${a.target}`,
        locked: false,
      })),
      loot: [],
    };
  }

  // 5. Lock gate: pick a spine room (not first, not last) and lock its exit toward the next spine room
  const gateSpineIdx = randInt(1, spineLen - 2); // index within spine
  const gateRoomId   = `room-${spineIds[gateSpineIdx]}`;
  const nextSpineId  = `room-${spineIds[gateSpineIdx + 1]}`;
  const gateRoom     = rooms[gateRoomId];
  const gateExit     = gateRoom.exits.find(e => e.roomId === nextSpineId);
  if (gateExit) {
    gateExit.locked = true;
    gateExit.keyId  = 'found-key';
  }

  // Place key in a branch room reachable before the gate, or in an early spine room
  let keyPlaced = false;
  // Prefer branch rooms attached to spine rooms before the gate
  for (const bIdx of branchIds) {
    const parentSpineOrder = spineIds.indexOf(branchParent[bIdx]);
    if (parentSpineOrder >= 0 && parentSpineOrder <= gateSpineIdx) {
      rooms[`room-${bIdx}`].loot.push({ id: 'found-key', name: keyItem.name, description: keyItem.desc, taken: false });
      keyPlaced = true;
      break;
    }
  }
  // Fallback: place in an early spine room (before the gate, not start)
  if (!keyPlaced) {
    const earlySpine = spineIds.slice(1, gateSpineIdx + 1);
    const keyRoomIdx = pick(earlySpine);
    rooms[`room-${keyRoomIdx}`].loot.push({ id: 'found-key', name: keyItem.name, description: keyItem.desc, taken: false });
  }

  // Place treasure in vault
  const vaultId = `room-${spineLen - 1}`;
  rooms[vaultId].loot.push({ id: 'treasure', name: treasure.name, description: treasure.desc, type: 'treasure', value: 250, taken: false });

  // 6. Place enemies (1-3) in non-start, non-vault rooms
  const enemyDefs  = tRaw('world.enemies');
  const enemyStats = tRaw('world.enemyStats');
  const enemyCount = randInt(1, Math.min(3, totalRooms - 2));
  const enemyCandidates = shuffle(
    Array.from({ length: totalRooms }, (_, i) => i).filter(i => i !== 0 && i !== spineLen - 1)
  ).slice(0, enemyCount);

  const npcs = {};
  for (let e = 0; e < enemyCandidates.length; e++) {
    const roomIdx  = enemyCandidates[e];
    const eIdx     = e % enemyDefs.length;
    const def      = enemyDefs[eIdx];
    const stats    = enemyStats[eIdx] ?? enemyStats[0];
    const npcId    = `enemy-${e + 1}`;
    npcs[npcId] = {
      id:          npcId,
      roomId:      `room-${roomIdx}`,
      name:        def.name,
      ...stats,
      conditions:  [],
      attitude:    'hostile',
      alive:       true,
      intro:       interp(def.intro, { style }),
    };
  }

  // 7. Scatter optional loot in branch rooms that don't have the key
  const lootPool = tRaw('world.loot') ?? [];
  for (const bIdx of branchIds) {
    const room = rooms[`room-${bIdx}`];
    if (room.loot.length === 0 && lootPool.length > 0) {
      const item = pick(lootPool);
      room.loot.push({ id: `loot-${bIdx}`, name: item.name, description: item.desc, taken: false });
    }
  }

  return {
    currentRoom: 'room-0',
    exitRoomId:  vaultId,
    rooms,
    npcs,
  };
}

// ─── Dungeon entry wrapper ────────────────────────────────────────────────────
// Wraps raw generateDungeon() output with metadata for world.dungeons storage.

const DUNGEON_THEMES = ['undead', 'goblin', 'cult', 'beast', 'arcane', 'ruin'];

export function createDungeonEntry({ id, name, regionId, seed: entrySeed }) {
  const dungeonSeed = entrySeed ?? Math.floor(Math.random() * 2147483647);
  const dungeon     = generateDungeon(dungeonSeed);
  const roomCount   = Object.keys(dungeon.rooms).length;
  const enemyNames  = Object.values(dungeon.npcs).map(n => n.name);
  const theme       = pick(DUNGEON_THEMES);

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

// Legacy wrapper — returns the flat world shape that flow.js currently expects.
// Once flow.js is updated for the layered model, this can be removed.
export function generateWorld() {
  return generateDungeon();
}
