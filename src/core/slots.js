// src/core/slots.js — named save slots.
//
// The game has one autosave. Starting a new campaign overwrites the old one,
// and there was no way to keep a run you were fond of except exporting a file
// and remembering where it went. Slots are the small, obvious thing that makes
// "try something reckless" survivable: name a slot, come back to it.
//
// This module owns the INDEX and the keys; it never touches the save format.
// state.js wraps and unwraps the same versioned envelope the autosave uses, so
// a slot is not a second kind of save with its own migration bugs — it is the
// same bytes under another key. Keeping the split here is also what makes the
// index logic (naming, capacity, quota failures) testable without a browser.

const INDEX_KEY  = 'dans-dungeons-slots';
const SLOT_KEY   = (id) => `dans-dungeons-slot-${id}`;
export const MAX_SLOTS = 6;

function readIndex(storage) {
  try {
    const raw = JSON.parse(storage.getItem(INDEX_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
}

function writeIndex(storage, list) {
  try { storage.setItem(INDEX_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// Slot ids are derived from the name so saving twice under one name overwrites
// rather than accumulating near-duplicates.
export function slotId(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'slot';
}

// [{ id, name, savedAt, turn, pc, world }] — newest first.
//
// Ties are broken by position in the index (later entry = written later).
// Two slots saved in the same millisecond is not a hypothetical: it is what
// happens when a player saves twice in quick succession, and sorting on the
// timestamp alone left the order down to whatever the engine's sort happened
// to do.
export function listSlots(storage) {
  return readIndex(storage)
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => (b.entry.savedAt ?? 0) - (a.entry.savedAt ?? 0) || b.i - a.i)
    .map(x => x.entry);
}

// Write an already-serialized save to a named slot. `meta` is what the UI lists
// it by — keep it small, it lives in the index and is read every time the panel
// opens. Returns { ok, id, reason }.
export function saveSlot(storage, name, serialized, meta = {}) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return { ok: false, reason: 'empty-name' };

  const id    = slotId(trimmed);
  const index = readIndex(storage);
  const existing = index.findIndex(s => s.id === id);

  if (existing === -1 && index.length >= MAX_SLOTS) {
    return { ok: false, reason: 'full', id };
  }

  try {
    storage.setItem(SLOT_KEY(id), serialized);
  } catch {
    // Out of room. Say so rather than reporting a save that did not happen.
    return { ok: false, reason: 'quota', id };
  }

  const entry = { id, name: trimmed, savedAt: Date.now(), ...meta };
  if (existing === -1) index.push(entry);
  else index[existing] = entry;
  writeIndex(storage, index);

  return { ok: true, id };
}

// The raw stored string for a slot, or null. The caller runs it through the
// same envelope + migration path a reload uses.
export function readSlot(storage, id) {
  try { return storage.getItem(SLOT_KEY(id)); } catch { return null; }
}

export function deleteSlot(storage, id) {
  try { storage.removeItem(SLOT_KEY(id)); } catch { /* already gone */ }
  const index = readIndex(storage).filter(s => s.id !== id);
  return writeIndex(storage, index);
}

// Bytes a slot occupies, for the storage-pressure warning. Approximate by
// design: exact accounting would mean reading every slot on every check.
export function slotBytes(storage) {
  let total = 0;
  for (const { id } of readIndex(storage)) {
    try { total += (storage.getItem(SLOT_KEY(id)) ?? '').length; } catch { /* skip */ }
  }
  return total;
}
