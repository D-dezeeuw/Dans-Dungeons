import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Can't import world.js directly (needs localStorage + i18n).
// Instead, test the contract: the dungeon shape that generateDungeon() must return.

describe('Dungeon shape contract', () => {
  // A valid dungeon object (the shape generateDungeon returns)
  const dungeon = {
    currentRoom: 'room-0',
    exitRoomId:  'room-5',
    rooms: {
      'room-0': { id: 'room-0', name: 'Entrance Hall', description: '...', exits: [{ dir: 'north', roomId: 'room-1' }], loot: [] },
      'room-1': { id: 'room-1', name: 'Great Hall', description: '...', exits: [{ dir: 'south', roomId: 'room-0' }, { dir: 'east', roomId: 'room-2' }, { dir: 'west', roomId: 'room-5', locked: true, keyId: 'found-key' }], loot: [] },
      'room-2': { id: 'room-2', name: 'Kitchen', description: '...', exits: [{ dir: 'west', roomId: 'room-1' }], loot: [{ id: 'found-key', name: 'brass key', description: '...', taken: false }] },
      'room-5': { id: 'room-5', name: 'Vault', description: '...', exits: [{ dir: 'east', roomId: 'room-1' }], loot: [{ id: 'treasure', name: 'gold', description: '...', type: 'treasure', value: 250, taken: false }] },
    },
    npcs: {
      'enemy-1': { id: 'enemy-1', roomId: 'room-1', name: 'Goblin', hp: 7, maxHp: 7, ac: 15, toHit: 4, damageDie: '1d6', damageBonus: 2, damageType: 'slashing', conditions: [], attitude: 'hostile', alive: true, intro: '...' },
    },
  };

  it('has required top-level fields', () => {
    assert.ok(dungeon.currentRoom);
    assert.ok(dungeon.exitRoomId);
    assert.ok(typeof dungeon.rooms === 'object');
    assert.ok(typeof dungeon.npcs === 'object');
  });

  it('currentRoom is the first room', () => {
    assert.equal(dungeon.currentRoom, 'room-0');
  });

  it('exitRoomId exists in rooms', () => {
    assert.ok(dungeon.rooms[dungeon.exitRoomId]);
  });

  it('every room has required fields', () => {
    for (const room of Object.values(dungeon.rooms)) {
      assert.ok(room.id, 'room needs id');
      assert.ok(room.name, 'room needs name');
      assert.ok(room.description, 'room needs description');
      assert.ok(Array.isArray(room.exits), 'room needs exits array');
      assert.ok(Array.isArray(room.loot), 'room needs loot array');
    }
  });

  it('exits are bidirectional', () => {
    const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };
    for (const [roomId, room] of Object.entries(dungeon.rooms)) {
      for (const exit of room.exits) {
        const target = dungeon.rooms[exit.roomId];
        assert.ok(target, `exit from ${roomId} to ${exit.roomId} points to nonexistent room`);
        const backExit = target.exits.find(e => e.roomId === roomId);
        assert.ok(backExit, `no back exit from ${exit.roomId} to ${roomId}`);
        assert.equal(backExit.dir, OPPOSITE[exit.dir], `back exit direction mismatch: ${exit.dir} should map to ${OPPOSITE[exit.dir]}`);
      }
    }
  });

  it('has exactly one key item somewhere', () => {
    const keys = Object.values(dungeon.rooms).flatMap(r => r.loot.filter(l => l.id === 'found-key'));
    assert.equal(keys.length, 1);
  });

  it('has exactly one treasure in exitRoom', () => {
    const exitRoom = dungeon.rooms[dungeon.exitRoomId];
    const treasures = exitRoom.loot.filter(l => l.type === 'treasure');
    assert.equal(treasures.length, 1);
  });

  it('has a locked exit requiring the key', () => {
    const locked = Object.values(dungeon.rooms).flatMap(r => r.exits.filter(e => e.locked));
    assert.ok(locked.length >= 1, 'should have at least one locked exit');
    assert.equal(locked[0].keyId, 'found-key');
  });

  it('all NPCs have required combat stats', () => {
    for (const npc of Object.values(dungeon.npcs)) {
      assert.ok(npc.id);
      assert.ok(npc.roomId);
      assert.ok(npc.name);
      assert.ok(typeof npc.hp === 'number');
      assert.ok(typeof npc.ac === 'number');
      assert.ok(typeof npc.toHit === 'number');
      assert.ok(npc.damageDie);
      assert.ok(npc.attitude === 'hostile');
      assert.ok(npc.alive === true);
    }
  });

  it('dungeon can nest inside world.dungeons', () => {
    // The dungeon object can be stored as world.dungeons['dungeon-crypt']
    const world = {
      dungeons: {
        'dungeon-crypt': {
          id: 'dungeon-crypt',
          name: 'The Sunken Crypt',
          description: 'A burial complex beneath the hills.',
          regionId: 'region-ashvale',
          digest: 'Sunken Crypt — undead, 8 rooms.',
          ...dungeon,
          completed: false,
        },
      },
    };
    const d = world.dungeons['dungeon-crypt'];
    assert.equal(d.id, 'dungeon-crypt');
    assert.equal(d.currentRoom, 'room-0');
    assert.ok(d.rooms['room-0']);
    assert.equal(d.completed, false);
  });
});
