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

// ─── Direction helpers ────────────────────────────────────────────────────────

const ALL_DIRS = ['north', 'south', 'east', 'west'];
const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east' };

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Flavour tables ───────────────────────────────────────────────────────────

const HOUSE_STYLES = [
  'crumbling manor',
  'abandoned estate',
  'forsaken keep',
  'derelict townhouse',
];

const START_ROOMS = [
  {
    name: 'Entrance Hall',
    description: (style) =>
      `You stand in the entrance hall of a ${style}. Tattered tapestries cling to damp stone walls, and the reek of mildew fills your lungs. A heavy timber door ahead suggests the house goes deeper.`,
  },
  {
    name: 'Foyer',
    description: (style) =>
      `The foyer of this ${style} greets you with warped floorboards and the ghost of old grandeur. A cracked mirror reflects your wary face. Passage inward beckons from the far wall.`,
  },
  {
    name: 'Mudroom',
    description: (style) =>
      `A narrow mudroom at the threshold of the ${style}. Boots long rotted away line one wall; rusted coat-hooks the other. A sagging door leads further inside.`,
  },
];

const HUB_ROOMS = [
  {
    name: 'Great Hall',
    description:
      'A vaulted great hall stretches before you, its long feasting table overturned. Moonlight bleeds through a cracked skylight above. One passage disappears into shadow to the side, and a locked door dominates the far wall — its keyhole dark and waiting.',
  },
  {
    name: 'Drawing Room',
    description:
      'The drawing room reeks of old smoke and something worse. Furniture has been shoved to the walls. A side passage gapes open to your left, and across the room a door hangs sealed by a heavy lock.',
  },
  {
    name: 'Corridor',
    description:
      'A long corridor bisects the heart of the house. Sconces hold nothing but wax stumps. To one side a doorway stands open; to the other a locked door bears a keyhole shaped for something specific.',
  },
];

const KEY_ROOMS = [
  {
    name: 'Kitchen',
    description:
      'The kitchen still holds the ghost of old meals. Pots hang from rusted hooks, and a butcher\'s block is scarred deep by years of use. Something glints on the shelf above the cold hearth — catching the faint light.',
  },
  {
    name: 'Pantry',
    description:
      'Rows of empty shelves line the pantry, their contents long since spoiled or stolen. A single item rests on the lowest shelf as if left deliberately — it catches your eye immediately.',
  },
  {
    name: "Servants' Quarters",
    description:
      'A cramped room once shared by servants, now empty of all comfort. Bare pallets are pushed against the walls. On a small bedside table something metallic glints — left behind, or hidden here on purpose?',
  },
];

const VAULT_ROOMS = [
  {
    name: 'Master Study',
    description: (treasureName) =>
      `The master's study is in disarray — shelves ransacked, papers scattered. Yet in the centre of the room, ${treasureName} sits untouched, as though protected by some old ward. A window to the outside stands unlatched — a way out.`,
  },
  {
    name: 'Trophy Room',
    description: (treasureName) =>
      `Glass cases line the trophy room, most shattered and empty. But one pedestal still bears its prize: ${treasureName}. Dust motes swirl as your entrance disturbs the stale air. A back door creaks open to the outside — your way out.`,
  },
  {
    name: 'Vault',
    description: (treasureName) =>
      `Stone walls and an iron-banded floor mark this as the vault proper. Someone breached it long ago, but left the most valuable thing behind: ${treasureName}. A drainage passage in the far wall leads upward — and out.`,
  },
];

const ENEMIES = [
  {
    name: 'Grizzik the Goblin',
    hp: 7, maxHp: 7, ac: 15, toHit: 4,
    damageDie: '1d6', damageBonus: 2, damageType: 'slashing',
    intro: (style) =>
      `A goblin crouches atop the overturned furniture, yellow eyes snapping open as you enter. It snatches up a battered scimitar and bares its teeth: "This ${style} belongs to Grizzik! Turn back or bleed, big-folk!"`,
  },
  {
    name: 'Guard Skeleton',
    hp: 9, maxHp: 9, ac: 13, toHit: 4,
    damageDie: '1d6', damageBonus: 2, damageType: 'slashing',
    intro: (style) =>
      `Bones rattle as the skeleton assigned to guard this ${style} lurches upright. Its hollow eye sockets fix on you; a rusted longsword rises into a fighting stance with terrible purpose.`,
  },
  {
    name: 'Feral Cultist',
    hp: 8, maxHp: 8, ac: 12, toHit: 3,
    damageDie: '1d6', damageBonus: 1, damageType: 'piercing',
    intro: (style) =>
      `A robed figure spins to face you, madness bright in its eyes. It has been waiting in this ${style} for a reason you don't yet understand — and it levels a long dagger at your throat.`,
  },
  {
    name: 'Giant Rat',
    hp: 5, maxHp: 5, ac: 12, toHit: 3,
    damageDie: '1d4', damageBonus: 0, damageType: 'piercing',
    intro: (style) =>
      `A rat the size of a terrier erupts from beneath the debris of the ${style}, hackles raised and yellow teeth bared. It lunges before you can take a breath.`,
  },
];

const KEYS = [
  { id: 'found-key', name: 'brass key',   description: 'A tarnished brass key, its bow cast in the shape of a crescent moon.' },
  { id: 'found-key', name: 'iron key',    description: 'A heavy iron key, cold to the touch and etched with a single Roman numeral.' },
  { id: 'found-key', name: 'silver key',  description: 'A slender silver key that catches the light with an almost warm glow.' },
  { id: 'found-key', name: 'bone key',    description: 'A key carved from a single piece of bone — its origin better left unasked.' },
];

const TREASURES = [
  { id: 'treasure', name: 'chest of gold coins',       description: 'A brass-banded chest overflowing with gold coins, worth a small fortune.',          type: 'treasure', value: 250, taken: false },
  { id: 'treasure', name: 'sapphire amulet',           description: 'A deep-blue sapphire set in filigreed silver, pulsing with faint inner light.',       type: 'treasure', value: 500, taken: false },
  { id: 'treasure', name: 'sealed arcane tome',        description: 'A thick book sealed with wax and cord, its cover warm despite the cold room.',        type: 'treasure', value: 400, taken: false },
  { id: 'treasure', name: 'jewelled ceremonial sword', description: 'A sword more art than weapon — its hilt crusted with rubies and engraved silver.',    type: 'treasure', value: 600, taken: false },
];

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateWorld() {
  // Randomise directions
  const enterDir  = pick(ALL_DIRS);
  const backDir   = OPPOSITE[enterDir];
  const sideDirs  = ALL_DIRS.filter(d => d !== enterDir && d !== backDir);
  const keyDir    = sideDirs[0];
  const lockedDir = sideDirs[1];

  // Randomise flavour
  const style    = pick(HOUSE_STYLES);
  const startDef = pick(START_ROOMS);
  const hubDef   = pick(HUB_ROOMS);
  const keyDef   = pick(KEY_ROOMS);
  const vaultDef = pick(VAULT_ROOMS);
  const enemyDef = pick(ENEMIES);
  const keyItem  = { ...pick(KEYS) };          // copy so id stays 'found-key'
  const treasure = { ...pick(TREASURES) };

  const rooms = {
    'room-start': {
      id:          'room-start',
      name:        startDef.name,
      description: startDef.description(style),
      exits: [
        { dir: enterDir, roomId: 'room-hub' },
      ],
      loot: [],
    },

    'room-hub': {
      id:          'room-hub',
      name:        hubDef.name,
      description: hubDef.description,
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
      description: keyDef.description,
      exits: [
        { dir: OPPOSITE[keyDir], roomId: 'room-hub' },
      ],
      loot: [
        { ...keyItem, taken: false },
      ],
    },

    'room-vault': {
      id:          'room-vault',
      name:        vaultDef.name,
      description: vaultDef.description(treasure.name),
      exits: [
        { dir: OPPOSITE[lockedDir], roomId: 'room-hub', locked: false },
      ],
      loot: [
        treasure,
      ],
    },
  };

  const npcs = {
    'enemy-1': {
      id:          'enemy-1',
      roomId:      'room-hub',
      name:        enemyDef.name,
      hp:          enemyDef.hp,
      maxHp:       enemyDef.maxHp,
      ac:          enemyDef.ac,
      toHit:       enemyDef.toHit,
      damageDie:   enemyDef.damageDie,
      damageBonus: enemyDef.damageBonus,
      damageType:  enemyDef.damageType,
      conditions:  [],
      attitude:    'hostile',
      alive:       true,
      intro:       enemyDef.intro(style),
    },
  };

  return {
    currentRoom: 'room-start',
    exitRoomId:  'room-vault',
    rooms,
    npcs,
  };
}
