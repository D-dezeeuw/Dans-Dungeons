// src/core/state.js
//
// Thin wrapper around the Spektrum singleton.
// All top-level appState paths are initialised here so the shape is
// always predictable regardless of restore order.

import { DEFAULT_MODELS } from '../ai/tiers.js';
import { wrapEnvelope, saveEnvelope, loadEnvelope, makeCommit } from 'bag-of-holding-client';

import {
  appState,
  setValue,
  addValue,
  watch,
  addSystem,
  serialize,
  computed,
  run,
  tick,
  bindDOM,
  replay,
  checkpoint,
  onFork,
  history as spektrumHistory,
} from 'spektrum';

export { appState, setValue, addValue, watch, addSystem, serialize, computed, run, tick, bindDOM };

// Time-travel surface (used by game/undo.js for undo/redo + branching).
// `spektrumHistory` is the live, append-only mutation log; `replay(n)` rebuilds
// the state after the first n entries; `checkpoint()` records a tagged,
// state-less marker that replay walks past unchanged; `onFork(fn)` fires with
// the dropped history tail whenever a mutation while scrubbed back diverges the
// timeline — the hook the branch registry listens on.
export { replay, checkpoint, onFork, spektrumHistory };

// ─── Default shape ───────────────────────────────────────────────────────────

const DEFAULTS = {
  session: {
    phase: 'loading',   // loading | key-setup | char-create | play | game-over
    turnCount: 0,
    chapterId: 'ch-1',
    skillCooldowns: {},  // { skillId: turnsRemaining }
    rng:     null,       // { seed, cursor } — epoch-seeded combat dice stream (game/rng.js)
    rollLog: [],         // verifyLog-compatible audit of this epoch's rolls
  },
  ai: {
    tier:    'free',       // 'free' | 'deluxe'
    baseUrl: 'https://openrouter.ai/api/v1',
    key: '',
    models: { ...DEFAULT_MODELS },
    totalTokens: 0,
    totalCostUsd: 0,
  },
  party: {
    pc: null,           // { record: CharacterRecord, sheet: DerivedSheet }
    inventory: [],
  },
  world: {
    // L00 — World lore
    seed:   null,
    name:   null,
    tone:   null,
    lore:   null,
    digest: null,

    // Factions
    factions: {},

    // Red thread (story arc)
    redThread: {
      beats:        [],   // array of beat objects (bag-of-holding schema)
      currentIndex: 0,    // active beat index
      flags:        {},   // { flagId: true } — prerequisites and completion
    },

    // L02 — Regions
    regions: {},

    // L03 — Settlements
    settlements: {},

    // Quest tracker (Phase 2) — { [questId]: { id, npcId, npcName, description, status } }
    quests: {},

    // Faction reputation (Phase 4) — { [factionId]: number in [-100, 100] }
    factionReputation: {},

    // L04/L05 — Dungeons (each contains rooms + npcs)
    dungeons: {},

    // Player location pointer
    location: {
      type:         null,   // 'dungeon' | 'settlement' | 'road'
      regionId:     null,
      settlementId: null,
      dungeonId:    null,
    },

    // Legacy compat — flat room/npc refs for active dungeon (resolver reads these)
    currentRoom: null,
    exitRoomId:  null,
    rooms: {},
    npcs: {},
  },
  flags: {},
  transcript: [],
  settings: {
    sceneImage: false,      // generate a journal-sketch scene image after each turn
    actionBar:  true,       // show the action bar above the debug bar
    sketchView: 'windowed', // 'minimized' | 'windowed' | 'maximized'
  },
};

export function initState() {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    setValue(key, value);
  }
}

// Restore a previously saved snapshot (top-level keys only).
export function restoreState(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    setValue(key, value);
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────
// Saves are versioned envelopes ({ v, data }) via the client library, so future
// state-shape changes get an ordered migration path. localStorage already IS the
// { getItem, setItem, removeItem } adapter the library expects, so it's injected
// directly. Legacy bare-snapshot saves load as version 0 and pass straight
// through — adding versioning never strands an existing save.

const SAVE_KEY     = 'dans-dungeons';
const SAVE_VERSION = 1;
// Persisted top-level paths (ui is transient and rebuilt on load).
const PERSIST_KEYS = ['session', 'ai', 'party', 'world', 'flags', 'transcript', 'settings'];
// Ordered v→v+1 migrations for saved-state shape changes. Empty today.
const SAVE_MIGRATIONS = {};

// The persisted slice of appState (the single source of the save shape, shared
// by the localStorage save and the downloadable save file).
function pickPersisted() {
  return Object.fromEntries(PERSIST_KEYS.map(k => [k, appState[k]]));
}

export function saveToStorage() {
  if (!saveEnvelope(localStorage, SAVE_KEY, appState, SAVE_VERSION, { pick: PERSIST_KEYS })) {
    console.warn('[state] localStorage save failed');
  }
}

export function loadFromStorage() {
  return loadEnvelope(localStorage.getItem(SAVE_KEY), {
    migrations:     SAVE_MIGRATIONS,
    currentVersion: SAVE_VERSION,
  });
}

// Serialize the persisted state as a versioned-envelope JSON string for a
// downloadable save file. Same { v, data } shape as the localStorage save, so a
// file and a browser save are interchangeable.
export function serializeSave() {
  return JSON.stringify(wrapEnvelope(pickPersisted(), SAVE_VERSION), null, 2);
}

// Parse a save file's text — envelope-aware, so it accepts both new versioned
// envelopes and legacy bare snapshots (which load as version 0 and migrate
// forward). Returns the unwrapped, migrated data, or null if unparseable.
export function parseSave(raw) {
  return loadEnvelope(raw, { migrations: SAVE_MIGRATIONS, currentVersion: SAVE_VERSION });
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

// tick (flush the Spektrum delta) + saveToStorage in one call — use after any
// state mutation that must survive a reload. Replaces the repeated, easy-to-
// forget `tick(); saveToStorage();` pair.
export const commit = makeCommit({ tick, save: saveToStorage });
