// src/game/ledger.js — the world ledger, bound to Spektrum.
//
// The pure primitives live in bag-of-holding-client (fold, precedence, dirty
// tracking, compaction). This module owns the app-side concerns: where the
// ledger lives in state, how patches are appended without re-recording the
// whole array, and how the current location resolves to an entity id.
//
// Reads are cheap and synchronous; the scope assembler and the narrator context
// both fold through here every turn.

import { appendPatch, makePatch, fold, foldAll, recentCauses, dirtyTargets, compact,
         makeId, isUnder } from 'bag-of-holding-client';
import { appState, setValue } from '../core/state.js';

export { makeId, isUnder };

const empty = [];

export function ledger()      { return appState.world?.ledger ?? empty; }
export function ledgerBases() { return appState.world?.ledgerBases ?? {}; }

// ─── Location → entity id ────────────────────────────────────────────────────
//
// A stable address for wherever the player is standing. Quick dungeons have no
// campaign geography, so they get their own root — the ledger works the same in
// both modes, which keeps one code path in the turn loop.

export function currentPlaceId() {
  const loc = appState.world?.location ?? {};
  const region = loc.regionId ? `region.${slug(loc.regionId)}` : 'region.wilds';
  if (loc.settlementId) return `${region}.settlement.${slug(loc.settlementId)}`;
  if (loc.dungeonId)    return `${region}.dungeon.${slug(loc.dungeonId)}`;
  return region;
}

// The room the player is in, as an id under the current place.
export function currentRoomId() {
  const room = appState.world?.currentRoom;
  return room ? `${currentPlaceId()}.room.${slug(room)}` : currentPlaceId();
}

function slug(x) {
  return String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

// ─── Appending ───────────────────────────────────────────────────────────────

// Record one change. Narrow per-index write: the ledger is append-only and the
// time-travel spine stores recorded entries verbatim, so re-writing the whole
// array every turn is exactly the quadratic-growth mistake the transcript made.
// Returns true when the patch was recorded, false when the precedence gate
// rejected it (a canon claim contradicting mechanical truth).
export function recordPatch(fields) {
  const patch = makePatch({
    turn:    appState.session?.turnCount ?? 0,
    chapter: appState.session?.chapterId ?? null,
    ...fields,
  });
  const current = ledger();
  const res = appendPatch(current, patch);
  if (!res.ok) {
    bumpRejected();
    return false;
  }
  setValue(`world.ledger.${current.length}`, patch);
  return true;
}

// Rejected canon claims are a narrator-quality signal: a rising rate means the
// prompt is drifting from the rules. Kept out of the ledger itself so it never
// affects what is true.
function bumpRejected() {
  setValue('world.ledgerRejected', (appState.world?.ledgerRejected ?? 0) + 1);
}

export function recordMechanical(target, path, to, { from = null, scope = 'local', because = null } = {}) {
  return recordPatch({ target, path, to, from, scope, because, kind: 'mechanical' });
}

export function recordCanon(target, path, to, { scope = 'local', because = null, source = 'narration' } = {}) {
  return recordPatch({ target, path, to, scope, because, source, kind: 'canon' });
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export function entity(id) {
  return fold(ledgerBases()[id], ledger(), id);
}

export function entitiesUnder(prefix) {
  return foldAll(ledgerBases(), ledger(), prefix);
}

// Details the player can notice here — the moldy curtains, the scratched
// bedpost. Returned as compact { name, note } lines for the scene packet.
export function detailsAt(placeId, { limit = 6 } = {}) {
  const all = entitiesUnder(placeId);
  return Object.entries(all)
    .filter(([id]) => id.includes('.detail.'))
    .slice(-limit)
    .map(([id, rec]) => ({
      id,
      name: rec.name ?? id.split('.').pop().replace(/-/g, ' '),
      note: rec.condition ?? rec.state ?? rec.description ?? null,
    }))
    .filter(d => d.note);
}

// Recent notable events, for the narrator's continuity block.
export function recentEvents(opts) {
  return recentCauses(ledger(), opts);
}

// ─── Digest invalidation ─────────────────────────────────────────────────────

// Which digests are stale because of patches since a given turn.
export function staleDigests(sinceTurn = 0) {
  return dirtyTargets(ledger().filter(p => p.turn >= sinceTurn));
}

// ─── Compaction ──────────────────────────────────────────────────────────────

// Fold stale local detail into base snapshots. Called at chapter boundaries so
// an 80-hour ledger stays bounded; regional and world history is never dropped.
export function compactLedger(beforeTurn) {
  const res = compact(ledgerBases(), ledger(), { beforeTurn });
  if (!res.foldedCount) return 0;
  setValue('world.ledgerBases', res.bases);
  setValue('world.ledger', res.ledger);
  return res.foldedCount;
}
