// The Quiet Stair — the adventure pack (~90 minutes at the table).
//
// Beneath a ruined toll-house, a sealed stairwell descends to a bell-crypt
// where the town once rang the hours. The bell has begun tolling on its
// own at dusk, and everything near the stair is losing its voice. Warden
// Hesk hires the party; the sexton who sealed the stair knows why; at the
// bottom, something that eats sound wants a voice of its own.
//
// Format notes (the format is src/adventures/schema.js's contract):
// - beats[] drives progression through the ordinary Beats runtime; flags
//   are the only currency. beat.03 branches (successors) and both paths
//   merge on beat.05 via their own successors.
// - scenes[] bind presentation + content to those flags. Encounter
//   difficulty is a validated CLAIM: validateAdventure re-derives each
//   `intendedDifficulty` through classifyEncounter against partyProfile.
//   The climax is EXACTLY 1600 XP on purpose — the classifier's 'high'
//   band is an exact match (xp === high budget for 4 × L3), so this
//   composition is pinned; change a monster and validation fails.
// - All names invented (docs/legal.md; swept by tests/legal.test.js).

import { QUIET_STAIR_NPCS } from './npcs.js';

const BEATS = [
  {
    id: 'beat.01.the-wardens-plea',
    dramaticPurpose: 'Hook the party: the Warden lays out the tolling bell and the lost voices, and hires them.',
    targetPlaytimeMinutes: 10,
    prerequisites: [],
    setRequiredFlags: ['qs.hired'],
    preferredLocation: 'scene.wardens-gate',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'authority', notes: 'the one who pays, and who is afraid' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.02.the-sextons-secret',
    dramaticPurpose: 'Talk Brann into surrendering the stair key and the truth of why he sealed it.',
    targetPlaytimeMinutes: 15,
    prerequisites: ['qs.hired'],
    setRequiredFlags: ['qs.learned-bell'],
    preferredLocation: 'scene.bell-tower',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'informant', notes: 'knows why; needs Influence, not steel' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.03.descent',
    dramaticPurpose: 'Open the stair and win the landing — the undercroft answers back.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['qs.learned-bell'],
    setRequiredFlags: ['qs.reached-undercroft'],
    preferredLocation: 'scene.the-landing',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    // The branch point: force the flooded gallery, or find the side-vault.
    successors: ['beat.04a.the-flooded-gallery', 'beat.04b.the-side-vault']
  },
  {
    id: 'beat.04a.the-flooded-gallery',
    dramaticPurpose: 'The direct way down: wade the gallery where the drowned still carry their loads.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['qs.reached-undercroft'],
    setRequiredFlags: ['qs.found-the-bell'],
    preferredLocation: 'scene.flooded-gallery',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: ['beat.05.parley-in-the-dark']
  },
  {
    id: 'beat.04b.the-side-vault',
    dramaticPurpose: 'The quiet way around: pick through the webbed side-vault the sexton whispered about.',
    targetPlaytimeMinutes: 20,
    prerequisites: ['qs.reached-undercroft'],
    setRequiredFlags: ['qs.found-the-bell'],
    preferredLocation: 'scene.side-vault',
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: ['beat.05.parley-in-the-dark']
  },
  {
    id: 'beat.05.parley-in-the-dark',
    dramaticPurpose: 'Vel speaks in borrowed phrases: learn what it wants before deciding what it gets.',
    targetPlaytimeMinutes: 10,
    prerequisites: ['qs.found-the-bell'],
    setRequiredFlags: ['qs.vel-answered'],
    preferredLocation: 'scene.drowned-chancel',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'antagonist', notes: 'Influence again — a voice can be bargained with' }],
    boundEntities: {},
    successors: []
  },
  {
    id: 'beat.06.toll-or-still',
    dramaticPurpose: 'End it: break the abbot and its answering bell, or strike the bargain that quiets the stair.',
    targetPlaytimeMinutes: 15,
    prerequisites: ['qs.vel-answered'],
    setRequiredFlags: ['qs.stair-quiet'],
    preferredLocation: 'scene.bell-crypt',
    fallbackLocations: [],
    requiredArchetypes: [{ role: 'antagonist', notes: 'the same face, whichever way it ends' }],
    boundEntities: {},
    successors: []
  }
];

const SCENES = [
  {
    id: 'scene.wardens-gate',
    title: "The Warden's Gate",
    beatId: 'beat.01.the-wardens-plea',
    readAloud: 'The toll-house has no roof and the gate no toll, but Warden Hesk keeps the brazier lit. Below the hill, the town speaks in gestures now. At dusk, from under the ground, a bell rings the hour nobody asked for.',
    cast: ['warden-hesk'],
    objectives: [{ flag: 'qs.hired', description: 'Take the Warden\'s commission' }],
    exits: [{ to: 'scene.bell-tower', label: 'Seek the sexton at the fallen tower', requiresFlag: 'qs.hired' }]
  },
  {
    id: 'scene.bell-tower',
    title: 'The Fallen Bell-Tower',
    beatId: 'beat.02.the-sextons-secret',
    readAloud: 'Brann of the Bell sleeps beside the bell he cut down years ago, a brass key on a cord around his neck. He mouths his welcome. It takes a moment to notice no sound comes out.',
    cast: ['sexton-brann'],
    objectives: [{ flag: 'qs.learned-bell', description: 'Win the key and the truth from Brann' }],
    treasure: ['brass-stair-key', 'sextons-ledger'],
    exits: [{ to: 'scene.the-landing', label: 'Unseal the Quiet Stair and descend', requiresFlag: 'qs.learned-bell' }]
  },
  {
    id: 'scene.the-landing',
    title: 'The First Landing',
    beatId: 'beat.03.descent',
    readAloud: 'The stair swallows footfalls whole. On the first landing, pale things that hoard what the town lost look up from their work, and the silt along the walls starts to move.',
    cast: [],
    objectives: [{ flag: 'qs.reached-undercroft', description: 'Clear the landing and find the ways down' }],
    encounter: {
      monsters: [{ id: 'cellar-lurker', count: 2 }, { id: 'silt-shade', count: 2 }],
      intendedDifficulty: 'low'
    },
    exits: [
      { to: 'scene.flooded-gallery', label: 'Take the drowned gallery straight down', requiresFlag: 'qs.reached-undercroft' },
      { to: 'scene.side-vault', label: 'Follow the sexton\'s whisper to the side-vault', requiresFlag: 'qs.reached-undercroft' }
    ]
  },
  {
    id: 'scene.flooded-gallery',
    title: 'The Flooded Gallery',
    beatId: 'beat.04a.the-flooded-gallery',
    readAloud: 'Black water to the waist, and under it a procession that never clocked off: porters still carrying, spinners webbing the arches, leeches drinking the last echoes out of the stone.',
    cast: [],
    objectives: [{ flag: 'qs.found-the-bell', description: 'Cross the gallery to the chancel doors' }],
    encounter: {
      monsters: [{ id: 'drowned-porter', count: 1 }, { id: 'vault-spinner', count: 1 }, { id: 'echo-leech', count: 2 }],
      intendedDifficulty: 'moderate'
    },
    treasure: ['hush-lantern'],
    exits: [{ to: 'scene.drowned-chancel', label: 'Push through to the chancel', requiresFlag: 'qs.found-the-bell' }]
  },
  {
    id: 'scene.side-vault',
    title: 'The Webbed Side-Vault',
    beatId: 'beat.04b.the-side-vault',
    readAloud: 'The vault the sexton sealed his conscience in: tithe-chests webbed to the ceiling, a warden of stacked step-stones still on duty, and every archway spun shut.',
    cast: [],
    objectives: [{ flag: 'qs.found-the-bell', description: 'Cut through the vault to the chancel' }],
    encounter: {
      monsters: [
        { id: 'vault-spinner', count: 2 }, { id: 'stair-warden', count: 1 }, { id: 'pallid-creeper', count: 2 }
      ],
      intendedDifficulty: 'low'
    },
    treasure: ['bell-shard-amulet', 'cloak-of-settled-dust', { coins: { gp: 40 } }],
    exits: [{ to: 'scene.drowned-chancel', label: 'Slip into the chancel the quiet way', requiresFlag: 'qs.found-the-bell' }]
  },
  {
    id: 'scene.drowned-chancel',
    title: 'The Drowned Chancel',
    beatId: 'beat.05.parley-in-the-dark',
    readAloud: 'A figure in robes of settled dust stands where the choir stood, and when it speaks, it speaks in your own voices — a phrase from the Warden, a whisper from Brann, your own words handed back to you.',
    cast: ['vel-the-still'],
    objectives: [{ flag: 'qs.vel-answered', description: 'Learn what Vel wants — and what it will trade' }],
    exits: [{ to: 'scene.bell-crypt', label: 'Follow Vel down to the bell', requiresFlag: 'qs.vel-answered' }]
  },
  {
    id: 'scene.bell-crypt',
    title: 'The Bell-Crypt',
    beatId: 'beat.06.toll-or-still',
    readAloud: 'The bell hangs in a cistern of perfect black water, and the hour is about to strike. Whatever was agreed or refused in the chancel, it ends here — with a toll, or with the stillness after one.',
    cast: ['vel-the-still'],
    objectives: [{ flag: 'qs.stair-quiet', description: 'Quiet the stair, by steel or by bargain' }],
    encounter: {
      monsters: [
        { id: 'still-abbot', count: 1 }, { id: 'chime-wraith', count: 1 }, { id: 'mourner-husk', count: 1 }
      ],
      // 1100 + 450 + 50 = 1600 XP — the 'high' band exactly (see header).
      intendedDifficulty: 'high'
    },
    treasure: ['blade-of-the-last-watch', 'oathkeepers-signet', 'draught-of-the-clear-bell', { coins: { gp: 120 } }],
    exits: []
  }
];

export const QUIET_STAIR = Object.freeze({
  id: 'quiet-stair',
  title: 'The Quiet Stair',
  estimatedMinutes: 90,
  partyProfile: { size: 4, levels: [3, 3, 3, 3] },
  start: 'scene.wardens-gate',
  beats: BEATS,
  scenes: SCENES,
  npcs: QUIET_STAIR_NPCS
});

export default QUIET_STAIR;
