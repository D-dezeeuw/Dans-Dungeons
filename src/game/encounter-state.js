// src/game/encounter-state.js — pure world transitions for a travel encounter.
//
// A road encounter borrows the dungeon-combat fields (currentRoom, rooms, npcs,
// …) for one fight and puts them back afterwards. Those fields used to be
// stashed in a local variable inside the encounter function while every combat
// turn autosaved the borrowed state — so a reload mid-fight resumed into a world
// whose real rooms and npcs existed only in a closure that no longer ran.
//
// Keeping the swap in state (world.encounterReturn) makes the round trip
// survive a reload, and keeping it pure here makes it testable without the
// Spektrum singleton or the DOM.

// The dungeon-combat fields an encounter borrows.
export const ENCOUNTER_FIELDS = ['currentRoom', 'exitRoomId', 'rooms', 'npcs', 'location'];

export function encounterSnapshot(world) {
  return Object.fromEntries(ENCOUNTER_FIELDS.map(k => [k, world?.[k]]));
}

// Swap the world into an encounter, remembering how to get back.
// An encounter entered while already in one keeps the ORIGINAL return point:
// nesting must never overwrite the way home.
export function enterEncounterState(world, { room, npcs }) {
  return {
    ...world,
    currentRoom: 'encounter',
    exitRoomId:  'encounter',
    rooms:       { encounter: room },
    npcs,
    location:        { ...world?.location, type: 'encounter' },
    encounterReturn: world?.encounterReturn ?? encounterSnapshot(world),
  };
}

// Put the borrowed fields back and drop the marker. Returns the world unchanged
// when there is nothing to restore, so calling it twice is harmless.
export function exitEncounterState(world) {
  const snap = world?.encounterReturn;
  if (!snap) return world;
  const next = { ...world, ...snap };
  delete next.encounterReturn;
  return next;
}

// Is this saved world parked inside an encounter?
export function isInEncounter(world) {
  return world?.location?.type === 'encounter';
}
