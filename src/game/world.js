// src/game/world.js
//
// Procedural world generator. Every call to generateWorld() returns a fresh
// 4-room house with randomised directions and flavour.
//
// Topology (fixed):
//   [Start] ──enterDir──▶ [Hub (enemy)] ──keyDir──▶ [Key (key item)]
//                                 │
//                            lockedDir 🔒
//                                 │
//                                 ▼
//                         [Vault (treasure + exit)]

import { t, tRaw } from '../i18n/i18n.js';

// ─── Direction helpers ────────────────────────────────────────────────────────

const ALL_DIRS = ['north', 'south', 'east', 'west'];
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Interpolates {{key}} placeholders in a string.
function interp(str, params) {
  let out = str;
  for (const [k, v] of Object.entries(params)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateWorld() {
  // Randomise directions
  const enterDir  = pick(ALL_DIRS);
  const backDir   = OPPOSITE[enterDir];
  const sideDirs  = ALL_DIRS.filter(d => d !== enterDir && d !== backDir);
  const keyDir    = sideDirs[0];
  const lockedDir = sideDirs[1];

  // Locale-driven flavour tables
  const houseStyles = tRaw('world.houseStyles');
  const startRooms  = tRaw('world.startRooms');
  const hubRooms    = tRaw('world.hubRooms');
  const keyRooms    = tRaw('world.keyRooms');
  const vaultRooms  = tRaw('world.vaultRooms');
  const enemies     = tRaw('world.enemies');
  const keys        = tRaw('world.keys');
  const treasures   = tRaw('world.treasures');

  // Randomise flavour
  const style    = pick(houseStyles);
  const startDef = pick(startRooms);
  const hubDef   = pick(hubRooms);
  const keyDef   = pick(keyRooms);
  const vaultDef = pick(vaultRooms);
  const enemyDef = pick(enemies);
  const keyItem  = { ...pick(keys) };
  const treasure = { ...pick(treasures) };

  // Enemy stats (not locale-dependent — only name/intro are translated)
  const ENEMY_STATS = [
    { hp: 7, maxHp: 7, ac: 15, toHit: 4, damageDie: '1d6', damageBonus: 2, damageType: 'slashing' },
    { hp: 9, maxHp: 9, ac: 13, toHit: 4, damageDie: '1d6', damageBonus: 2, damageType: 'slashing' },
    { hp: 8, maxHp: 8, ac: 12, toHit: 3, damageDie: '1d6', damageBonus: 1, damageType: 'piercing' },
    { hp: 5, maxHp: 5, ac: 12, toHit: 3, damageDie: '1d4', damageBonus: 0, damageType: 'piercing' },
  ];
  const enemyIdx = enemies.indexOf(enemyDef);
  const stats    = ENEMY_STATS[enemyIdx] ?? ENEMY_STATS[0];

  const rooms = {
    'room-start': {
      id:          'room-start',
      name:        startDef.name,
      description: interp(startDef.desc, { style }),
      exits: [
        { dir: enterDir, roomId: 'room-hub' },
      ],
      loot: [],
    },

    'room-hub': {
      id:          'room-hub',
      name:        hubDef.name,
      description: hubDef.desc,
      exits: [
        { dir: backDir,   roomId: 'room-start' },
        { dir: keyDir,    roomId: 'room-key' },
        { dir: lockedDir, roomId: 'room-vault', locked: true, keyId: 'found-key' },
      ],
      loot: [],
    },

    'room-key': {
      id:          'room-key',
      name:        keyDef.name,
      description: keyDef.desc,
      exits: [
        { dir: OPPOSITE[keyDir], roomId: 'room-hub' },
      ],
      loot: [
        { id: 'found-key', name: keyItem.name, description: keyItem.desc, taken: false },
      ],
    },

    'room-vault': {
      id:          'room-vault',
      name:        vaultDef.name,
      description: interp(vaultDef.desc, { treasure: treasure.name }),
      exits: [
        { dir: OPPOSITE[lockedDir], roomId: 'room-hub', locked: false },
      ],
      loot: [
        { id: 'treasure', name: treasure.name, description: treasure.desc, type: 'treasure', value: 250, taken: false },
      ],
    },
  };

  const npcs = {
    'enemy-1': {
      id:          'enemy-1',
      roomId:      'room-hub',
      name:        enemyDef.name,
      ...stats,
      conditions:  [],
      attitude:    'hostile',
      alive:       true,
      intro:       interp(enemyDef.intro, { style }),
    },
  };

  return {
    currentRoom: 'room-start',
    exitRoomId:  'room-vault',
    rooms,
    npcs,
  };
}
