// src/core/state.js
//
// Thin wrapper around the Spektrum singleton.
// All top-level appState paths are initialised here so the shape is
// always predictable regardless of restore order.

import { DEFAULT_MODELS } from '../ai/tiers.js';

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
} from 'spektrum';

export { appState, setValue, addValue, watch, addSystem, serialize, computed, run, tick, bindDOM };

// ─── Default shape ───────────────────────────────────────────────────────────

const DEFAULTS = {
  session: {
    phase: 'loading',   // loading | key-setup | char-create | play | game-over
    turnCount: 0,
    chapterId: 'ch-1',
    skillCooldowns: {},  // { skillId: turnsRemaining }
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

const SAVE_KEY = 'dans-dungeons';

export function saveToStorage() {
  const snap = {
    session:    appState.session,
    ai:         appState.ai,
    party:      appState.party,
    world:      appState.world,
    flags:      appState.flags,
    transcript: appState.transcript,
    settings:   appState.settings,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn('[state] localStorage save failed', e);
  }
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
