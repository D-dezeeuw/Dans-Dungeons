// src/game/digests.js — keeping rendered digests true (Epic E4.S3).
//
// A digest is a RENDERED VIEW, not a fact. Region, settlement and world digests
// were written once at worldgen and never touched again, so an hour-30 region
// summary still described the world as it was at hour zero — the audit's
// stale-digest drift loop, and the reason a GM can cite a village as peaceful
// while the ledger records that the player burned it down.
//
// The ledger already knew: `staleDigests()` returns every entity whose digest a
// regional-or-wider patch has invalidated. Nothing called it. This module is
// the consumer — it re-renders those digests from the previous text plus what
// actually changed, on the tiny tier, at chapter boundaries.
//
// Determinism (pillar 5): a render is stamped with `digestV` and `digestTurn`,
// and a target is only re-rendered when new patches have landed since the last
// render. Two loads of the same save therefore read the same text; the digest
// never silently regenerates under the player.

import { appState, setValue, tick } from '../core/state.js';
import { digestScopeOf, causesFor } from 'bag-of-holding-client';
import { staleDigests, ledger } from './ledger.js';
import { redigestPlace } from '../ai/summarize.js';

// Re-rendering costs a tiny-tier call each, so cap the batch. Anything left
// dirty stays dirty and is picked up at the next boundary.
const MAX_PER_PASS = 3;

const slug = (x) => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';

// Ledger ids are slugged (`region.the-fen.settlement.farstay`); appState keys
// are not. Build the reverse map by slugging the keys we have.
function indexOf(collection) {
  const out = {};
  for (const key of Object.keys(collection ?? {})) out[slug(key)] = key;
  return out;
}

// Which appState entity does this ledger id render a digest for? The parsing is
// the library's (`digestScopeOf`, pure and node-tested); this only resolves the
// slug back to the live key and hands over the record.
function digestTargetFor(id) {
  const scope = digestScopeOf(id);
  if (!scope) return null;                       // below place granularity
  const collection = appState.world?.[scope.collection];
  const key = indexOf(collection)[scope.key];
  if (!key) return null;
  return { path: `world.${scope.collection}.${key}`, entity: collection[key], label: scope.kind };
}

// Re-render every digest the ledger has invalidated since the last pass.
// Best-effort throughout: a failed render keeps the previous digest, which is
// stale but never wrong-shaped. Returns the ids actually re-rendered.
export async function refreshStaleDigests({ max = MAX_PER_PASS } = {}) {
  const since = appState.world?.digestsRenderedAtTurn ?? 0;
  const turn  = appState.session?.turnCount ?? 0;
  if (turn <= since) return [];

  const dirty = staleDigests(since);
  const done  = [];

  for (const id of dirty) {
    if (done.length >= max) break;
    const target = digestTargetFor(id);
    if (!target?.entity?.digest) continue;

    const causes = causesFor(ledger(), id, { sinceTurn: since });
    if (!causes.length) continue;

    const next = await redigestPlace({
      kind:     target.label,
      name:     target.entity.name ?? id,
      previous: target.entity.digest,
      changes:  causes,
    });
    if (!next) continue;

    setValue(`${target.path}.digest`, next);
    setValue(`${target.path}.digestV`, (target.entity.digestV ?? 0) + 1);
    setValue(`${target.path}.digestTurn`, turn);
    done.push(id);
  }

  // Advance the watermark even when nothing rendered, so a target that only
  // ever produces causeless patches cannot pin the pass at turn zero forever.
  setValue('world.digestsRenderedAtTurn', turn);
  if (done.length) tick();
  return done;
}
