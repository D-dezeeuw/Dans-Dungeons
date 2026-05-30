// src/core/state.js
//
// Thin wrapper around the Spektrum singleton.
// All top-level appState paths are initialised here so the shape is
// always predictable regardless of restore order.

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
    baseUrl: 'https://openrouter.ai/api/v1',
    key: '',
    models: {
      tiny:   'openai/gpt-4o-mini',
      medium: 'anthropic/claude-sonnet-4-5',
    },
    totalTokens: 0,
    totalCostUsd: 0,
  },
  party: {
    pc: null,           // { record: CharacterRecord, sheet: DerivedSheet }
    inventory: [],
  },
  world: {
    currentRoom: null,
    exitRoomId:  null,
    rooms: {},
    npcs: {},
  },
  flags: {},
  transcript: [],
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
