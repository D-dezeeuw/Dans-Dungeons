// src/core/state.js
//
// Thin wrapper around the Spektrum singleton.
// All top-level appState paths are initialised here so the shape is
// always predictable regardless of restore order.

import { DEFAULT_MODELS } from '../ai/tiers.js';
import { wrapEnvelope, saveEnvelope, loadEnvelope, makeCommit, restoreBackup, LOAD_ERRORS,
         openCold, appendSegment, readSegments, splitSave, coldKeys, coldDelete } from 'bag-of-holding-client';

import { createSpektrum } from 'spektrum';
import { isPrimaryTab } from './tabs.js';
import { saveSlot as libSaveSlot, readSlot, listSlots, deleteSlot, MAX_SLOTS } from './slots.js';
export { MAX_SLOTS };

// One configured engine for the whole app — state.js is the sole 'spektrum'
// importer (everything else goes through this module). `snapshotEvery` captures a
// full-state snapshot every K recorded entries, so replay() — which powers
// undo/redo and branch-jump — costs O(K) instead of O(n) once an epoch has many
// turns. Snapshots are in-memory only (regenerated as history grows, never
// persisted), so the only cost is memory.
const spektrum = createSpektrum({ snapshotEvery: 25 });

const {
  appState, setValue, addValue, watch, addSystem, serialize, computed, run,
  tick, bindDOM, replay, checkpoint, onFork,
} = spektrum;
const spektrumHistory = spektrum.history;

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
    // Chapters (Epic E4): the GM's long memory. `chapters` holds frozen digests
    // of everything before the current one; `rollingDigest` is the live summary
    // of the chapter in progress, refreshed every few turns.
    chapterId:        'ch-1',
    chapters:         [],
    chapterStartTurn: 0,
    rollingDigest:    null,
    digestTurn:       0,
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

    // World ledger (Epic E2) — the world's memory. `ledger` is an append-only
    // list of patches (mechanical from the engine, canon from narration);
    // `ledgerBases` holds per-entity snapshots that compaction folds old local
    // detail into. Current state of anything = fold(base, patches).
    ledger:          [],
    ledgerBases:     {},
    ledgerRejected:  0,   // canon claims refused for contradicting the dice

    // Project clocks (Epic E6.S3): factions and threats advance at chapter
    // boundaries, so the world changes while the player is elsewhere.
    clocks: [],
    // Entities this character has actually met — the knowledge filter the scope
    // assembler uses so the GM never references what was never seen.
    encountered: {},

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

// Restore a previously saved snapshot (top-level keys only). The `_timeTravel`
// blob is NOT appState — it's reconstructed separately by game/undo.js — so it's
// skipped here to keep it out of the reactive store (and out of history).
export function restoreState(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === '_timeTravel') continue;
    setValue(key, value);
  }
}

// game/undo.js registers a provider that returns the serializable time-travel
// blob for the current epoch (or null). Inverted dependency: state.js never
// imports undo.js, avoiding a cycle. Saves embed the blob under `_timeTravel`.
let _timeTravelProvider = null;
export function setTimeTravelProvider(fn) { _timeTravelProvider = fn; }

// ─── Persistence ─────────────────────────────────────────────────────────────
// Saves are versioned envelopes ({ v, data }) via the client library, so future
// state-shape changes get an ordered migration path. localStorage already IS the
// { getItem, setItem, removeItem } adapter the library expects, so it's injected
// directly. Legacy bare-snapshot saves load as version 0 and pass straight
// through — adding versioning never strands an existing save.

const SAVE_KEY     = 'dans-dungeons';
const SAVE_VERSION = 2;
// Persisted top-level paths (ui is transient and rebuilt on load).
const PERSIST_KEYS = ['session', 'ai', 'party', 'world', 'flags', 'transcript', 'settings'];
// Ordered v→v+1 migrations for saved-state shape changes. v1→v2 added the
// optional `_timeTravel` blob; v1 saves simply lack it (load as no history), so
// the migration is an identity pass — it just records that the bump is benign.
// v0 is the legacy pre-versioning bare snapshot; it passes straight through.
// Declaring it explicitly is not ceremony — the library refuses an undeclared
// step now, because a silently skipped migration corrupts a save in a way that
// only surfaces turns later.
const SAVE_MIGRATIONS = {
  0: (data) => data,
  1: (data) => data,
};

// Previous saves kept alongside the live one. Two is enough to step back past a
// bad autosave without meaningfully competing for the localStorage quota.
const SAVE_BACKUPS = 2;

// Why the last load was refused, if it was — surfaced to the player rather than
// silently starting a new game on top of a campaign that is still there.
let _lastLoadError = null;
export function lastLoadError() { return _lastLoadError; }

// The persisted slice of appState (the single source of the save shape, shared
// by the localStorage save and the downloadable save file). Optionally carries
// the time-travel blob (game/undo.js) under `_timeTravel`.
export function pickPersisted() {
  return Object.fromEntries(PERSIST_KEYS.map(k => [k, appState[k]]));
}

// Credentials and endpoints for the SHAREABLE export. A .dnd.json is meant to be
// passed around, and it carried the player's API key; on the way back in, an
// imported baseUrl would silently redirect every future call (and that key) to
// whatever host the file named. Strip both — the importer keeps their own.
const CREDENTIAL_FIELDS = ['key', 'baseUrl'];

// Transient session facts that must never travel in a save: whether THIS tab
// is a spectator says nothing about the campaign and would follow an exported
// file into someone else's browser.
const TRANSIENT_SESSION = ['spectator'];

function withoutCredentials(snapshot) {
  if (!snapshot?.ai) return snapshot;
  const ai = { ...snapshot.ai };
  for (const f of CREDENTIAL_FIELDS) delete ai[f];
  return { ...snapshot, ai };
}

// Drop credential fields from imported data so a hostile or careless save file
// can never rewrite where this browser sends prose and keys.
export function sanitizeImported(data) {
  return withoutCredentials(data);
}

function buildSaveSnapshot() {
  const snap = pickPersisted();
  if (snap.session) {
    snap.session = { ...snap.session };
    for (const k of TRANSIENT_SESSION) delete snap.session[k];
  }
  const tt = _timeTravelProvider?.();
  if (tt) snap._timeTravel = tt;
  return snap;
}

// ─── Save health ─────────────────────────────────────────────────────────────
//
// localStorage writes fail silently once the quota is gone: saveEnvelope
// swallows the QuotaExceededError and returns false. The old handler only
// console.warn'd, so play continued with autosave dead and the player lost
// everything since the last successful write — while /save still cheerfully
// reported "saved". Health is tracked here and broadcast so the UI can say so.

let _saveHealthy = true;
const _saveHealthListeners = new Set();

export function onSaveHealthChange(fn) {
  _saveHealthListeners.add(fn);
  return () => _saveHealthListeners.delete(fn);
}

export function isSaveHealthy() { return _saveHealthy; }

function setSaveHealth(ok) {
  if (ok === _saveHealthy) return;
  _saveHealthy = ok;
  for (const fn of _saveHealthListeners) { try { fn(ok); } catch { /* listener owns its errors */ } }
}

// Returns true when the write actually landed. Callers that tell the player
// anything about saving MUST use the return value.
//
// Only the HOT slice is written here — a bounded tail of transcript and ledger
// plus the live world. Everything older is handed to the cold archive, so what
// this synchronous, quota-limited write costs stops growing with the campaign.
export function saveToStorage() {
  // A second tab is a spectator. Both tabs share one save key, so letting both
  // autosave means the last write wins and the other tab's turns are gone —
  // silently, and only visible on the next reload.
  if (!isPrimaryTab()) return false;

  // The watermark says how many leading entries are already durably archived.
  // Without it, every save re-archived the entire overflow-so-far as a brand
  // new segment: measured 88x duplication of the cold tier at 200 turns,
  // quadratic beyond, and the journal read the duplicates back as history.
  const marks = archiveMarks();
  const { hot, cold } = splitSave(buildSaveSnapshot(), {
    ...HOT_LIMITS,
    archivedTranscript: marks.transcript,
    archivedLedger:     marks.ledger,
  });
  const ok = saveEnvelope(localStorage, SAVE_KEY, hot, SAVE_VERSION, {
    backups:  SAVE_BACKUPS,
    checksum: true,
  });
  if (!ok) console.warn('[state] localStorage save failed (quota?)');
  setSaveHealth(ok);
  archiveCold(cold, marks, hot.archived);   // fire-and-forget; never blocks a turn
  return ok;
}

// ─── Cold archive (IndexedDB) ────────────────────────────────────────────────

const HOT_LIMITS = { keepTranscript: 50, keepLedger: 200 };

let _coldDb = null;
let _coldReady = null;

// Opened lazily and at most once. Resolves to null where IndexedDB is missing
// or refused, in which case archiving silently no-ops and the game keeps
// running on the hot tier alone.
function coldDb() {
  if (!_coldReady) _coldReady = openCold().then(db => (_coldDb = db));
  return _coldReady;
}

// The archive watermark rides `session.archived`, which is a PERSISTED and
// RECORDED path: it travels in the save, and an undo scrub rewinds it with
// everything else — so a rewound timeline re-archives at worst a small
// overlap (which fullTranscript's dedupe folds away) and can never silently
// skip entries a new branch wrote below a stale high-water mark.
function archiveMarks() {
  const a = appState.session?.archived;
  return { transcript: a?.transcript ?? 0, ledger: a?.ledger ?? 0 };
}

function archiveCold(cold, baseMarks, nextMarks) {
  if (!cold?.transcript?.length && !cold?.ledger?.length) return;
  coldDb().then(async (db) => {
    if (!db) return;
    let tOk = true, lOk = true;
    if (cold.transcript.length) tOk = !!(await appendSegment(db, 'transcript', 'run', cold.transcript));
    if (cold.ledger.length)     lOk = !!(await appendSegment(db, 'ledger', 'run', cold.ledger));
    // Advance the mark only for batches that DURABLY landed (appendSegment
    // reports real success now), and only if the mark hasn't moved since we
    // sliced — an undo or a competing save in between means the next save
    // re-slices from the truth rather than us clobbering it (compare-and-set).
    const now = archiveMarks();
    if (now.transcript !== baseMarks.transcript || now.ledger !== baseMarks.ledger) return;
    const next = {
      transcript: tOk ? nextMarks.transcript : now.transcript,
      ledger:     lOk ? nextMarks.ledger : now.ledger,
    };
    if (next.transcript !== now.transcript || next.ledger !== now.ledger) {
      setValue('session.archived', next);
      tick();
    }
  }).catch(() => { /* the cold tier is best-effort by design */ });
}

// Collapse duplicates from the merged history. Two sources: the pre-watermark
// archive (which re-wrote overlapping prefixes every save) and post-undo
// re-archives. Keyed by (turn, role, text) keep-first — divergent branches
// that share a turn number but not text both survive, exact copies fold away.
function dedupeHistory(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const key = `${e?.turn ?? ''}|${e?.role ?? ''}|${e?.text ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

// One-time cleanup for saves written by the pre-watermark archiver: their cold
// store holds each early entry dozens of times. Dedupe and rewrite as a single
// segment so the stored garbage stops occupying quota; from then on the
// watermark keeps it clean. Only runs when no watermark exists yet.
export async function compactColdArchive() {
  if (appState.session?.archived) return;
  const db = await coldDb();
  if (!db) return;
  for (const store of ['transcript', 'ledger']) {
    const keys = (await readSegmentKeys(db, store, 'run'));
    if (keys.length <= 1) continue;
    const merged = dedupeHistory(await readSegments(db, store, 'run'));
    const ok = await appendSegment(db, store, 'compact', merged, { startIndex: 0 });
    if (!ok) continue;                       // keep the originals if the rewrite failed
    for (const key of keys) await coldDelete(db, store, key);
  }
}

async function readSegmentKeys(db, store, prefix) {
  return (await coldKeys(db, store)).filter(k => typeof k === 'string' && k.startsWith(`${prefix}:`));
}

// The full transcript, hot tail included — for the journal and the world bible,
// which are the only things that need the whole campaign at once.
export async function fullTranscript() {
  const db = await coldDb();
  const compacted = db ? await readSegments(db, 'transcript', 'compact') : [];
  const archived  = db ? await readSegments(db, 'transcript', 'run') : [];
  return dedupeHistory([...compacted, ...archived, ...(appState.transcript ?? [])]);
}

// Fraction of the storage quota in use (0–1), or null when the browser will not
// say. Used to warn BEFORE writes start failing rather than after.
export async function storagePressure() {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota) return null;
    return (est.usage ?? 0) / est.quota;
  } catch {
    return null;
  }
}

export function loadFromStorage() {
  const raw = localStorage.getItem(SAVE_KEY);
  _lastLoadError = null;
  const data = loadEnvelope(raw, {
    migrations:     SAVE_MIGRATIONS,
    currentVersion: SAVE_VERSION,
    onError: (code, detail) => {
      // A checksum warning is not a refusal — the save still loaded.
      if (code !== LOAD_ERRORS.CHECKSUM) _lastLoadError = { code, detail };
      console.warn(`[state] save ${code}: ${detail}`);
    },
  });
  if (data) return data;

  // A save that exists but will not load is a bug, a corrupted write, or a file
  // from a newer build — not a new game. Keep the bytes so the player (or a
  // support request) can recover them instead of silently overwriting on the
  // next autosave, then try the rotated backups newest-first.
  if (raw) {
    try { localStorage.setItem(`${SAVE_KEY}-corrupt`, raw); } catch { /* nothing to do */ }
    console.error(`[state] save could not be loaded (${_lastLoadError?.code ?? 'unknown'}) — kept a copy at ${SAVE_KEY}-corrupt`);

    const recovered = restoreBackup(localStorage, SAVE_KEY, {
      keep:           SAVE_BACKUPS,
      migrations:     SAVE_MIGRATIONS,
      currentVersion: SAVE_VERSION,
    });
    if (recovered) {
      console.warn(`[state] recovered the save from backup slot ${recovered.slot}`);
      _lastLoadError = { code: 'recovered-from-backup', detail: `slot ${recovered.slot}` };
      return recovered.data;
    }
  }
  return null;
}

// Was a corrupt save quarantined on the last load?
export function hasCorruptSaveBackup() {
  try { return localStorage.getItem(`${SAVE_KEY}-corrupt`) !== null; } catch { return false; }
}

// Serialize the persisted state as a versioned-envelope JSON string for a
// downloadable save file. Same { v, data } shape as the localStorage save, so a
// file and a browser save are interchangeable.
export function serializeSave() {
  return JSON.stringify(wrapEnvelope(withoutCredentials(buildSaveSnapshot()), SAVE_VERSION), null, 2);
}

// Parse a save file's text — envelope-aware, so it accepts both new versioned
// envelopes and legacy bare snapshots (which load as version 0 and migrate
// forward). Returns the unwrapped, migrated data, or null if unparseable.
export function parseSave(raw) {
  const data = loadEnvelope(raw, {
    migrations:     SAVE_MIGRATIONS,
    currentVersion: SAVE_VERSION,
    onError: (code, detail) => console.warn(`[state] imported save ${code}: ${detail}`),
  });
  return data ? sanitizeImported(data) : data;
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

// ─── Named slots ─────────────────────────────────────────────────────────────
//
// One autosave meant a new campaign overwrote the last one and there was no way
// back. Slots use the same envelope, the same version, and the same migration
// path as the autosave, so a slot is not a second kind of save with its own
// bugs — it is the same save under another key.

export function saveToSlot(name) {
  // Exactly the bytes serializeSave() produces — same envelope, same version,
  // same credential stripping — so a slot, a save file and the autosave are
  // three places holding one format.
  return libSaveSlot(localStorage, name, serializeSave(), {
    turn:  appState.session?.turnCount ?? 0,
    pc:    appState.party?.pc?.record?.name ?? null,
    world: appState.world?.name ?? null,
  });
}

export function loadFromSlot(id) {
  const raw = readSlot(localStorage, id);
  if (raw == null) return null;
  // parseSave is the reload path: envelope, migrations, credential sanitising.
  return parseSave(raw);
}

export function slots()          { return listSlots(localStorage); }
export function removeSlot(id)   { return deleteSlot(localStorage, id); }

// tick (flush the Spektrum delta) + saveToStorage in one call — use after any
// state mutation that must survive a reload. Replaces the repeated, easy-to-
// forget `tick(); saveToStorage();` pair.
export const commit = makeCommit({ tick, save: saveToStorage });
