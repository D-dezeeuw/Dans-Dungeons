// src/game/chapters.js — chapter structure and rolling memory (Epic E4).
//
// `session.chapterId` existed as a hardcoded 'ch-1' for the repo's whole life:
// there was no session layer at all. The narrator's entire recall was the last
// three transcript entries, so the Game Master could not remember what an NPC
// said ten minutes ago — the first thing to fail on the road to 80 hours, and
// it failed within the first hour.
//
// The fix is two summaries and a boundary:
//
//   rollingDigest — a running ~300-token account of the CURRENT chapter,
//                   refreshed every few turns by the tiny tier.
//   chapters[]    — frozen ~150-token digests of everything before it. Stable
//                   text, so they sit at the front of the prompt where a
//                   provider's prefix cache can serve them cheaply.
//
// A boundary is cut when the fiction says a chapter ended: a dungeon cleared,
// a region left, a long rest taken in safety, or simply enough turns.

import { appState, setValue, tick } from '../core/state.js';
import { summarizeChapter, titleChapter } from '../ai/summarize.js';
import { recentEvents, compactLedger } from './ledger.js';
import { tickWorldClocks } from './world-clocks.js';
import { refreshStaleDigests } from './digests.js';
import { t } from '../i18n/i18n.js';

const REFRESH_EVERY_TURNS = 6;    // how often the rolling digest is rewritten
const SOFT_CHAPTER_TURNS  = 40;   // a chapter this long ends at the next beat
const TRANSCRIPT_WINDOW   = 14;   // entries fed verbatim to the narrator

export function chapters()      { return appState.session?.chapters ?? []; }
export function chapterIndex()  { return chapters().length + 1; }
export function rollingDigest() { return appState.session?.rollingDigest ?? null; }

// ─── The narrator's memory block ─────────────────────────────────────────────
//
// Ordered oldest → newest and stable at the front on purpose: frozen chapter
// digests first (cacheable prefix), then the live chapter, then raw recent
// turns. This is the whole of what the GM remembers.
export function memoryContext() {
  const past = chapters().map(c => `${c.title}: ${c.digest}`);
  const ctx = {};
  if (past.length)        ctx.chapters = past;
  if (rollingDigest())    ctx.thisChapter = rollingDigest();
  const events = recentEvents({ limit: 6, minScope: 'local' });
  if (events.length)      ctx.recently = events.map(e => e.because);
  return Object.keys(ctx).length ? ctx : null;
}

// The transcript slice the narrator sees. Was 3 entries (1.5 turns) while the
// prompt claimed "the last 3 turns"; the digests above carry everything older.
export function transcriptWindow(transcript = appState.transcript ?? []) {
  return transcript.slice(-TRANSCRIPT_WINDOW);
}

// ─── Rolling digest ──────────────────────────────────────────────────────────

// Refresh the current chapter's summary if enough turns have passed. Cheap
// (tiny tier, a few hundred tokens) and off the critical path — callers await
// it after the turn is committed, so a failure costs memory, never the turn.
export async function maybeRefreshDigest() {
  const turn = appState.session?.turnCount ?? 0;
  const last = appState.session?.digestTurn ?? 0;
  if (turn - last < REFRESH_EVERY_TURNS) return false;

  const text = await summarizeChapter({
    previous:   rollingDigest(),
    transcript: transcriptWindow(),
    events:     recentEvents({ limit: 10 }).map(e => e.because),
  });
  if (!text) return false;

  setValue('session.rollingDigest', text);
  setValue('session.digestTurn', turn);
  tick();
  return true;
}

// ─── Boundaries ──────────────────────────────────────────────────────────────

// Should this moment end the chapter? Story events first, turn count as a
// backstop so a wandering player still gets structure.
export function shouldCutChapter(reason) {
  if (['dungeon-cleared', 'region-changed', 'act-completed', 'safe-rest'].includes(reason)) return true;
  const turn  = appState.session?.turnCount ?? 0;
  const start = appState.session?.chapterStartTurn ?? 0;
  return turn - start >= SOFT_CHAPTER_TURNS;
}

// Freeze the current chapter and open the next one. Returns the closed chapter,
// or null when there was nothing to close.
export async function cutChapter(reason, { title = null } = {}) {
  const turn  = appState.session?.turnCount ?? 0;
  const start = appState.session?.chapterStartTurn ?? 0;
  if (turn <= start) return null;

  // Make sure the digest covers everything up to this moment.
  const digest = rollingDigest() ?? await summarizeChapter({
    previous:   null,
    transcript: transcriptWindow(),
    events:     recentEvents({ limit: 10 }).map(e => e.because),
  });

  // Name it. A chapter called "Chapter 4" is a counter; "The Road to Saltmarch"
  // is the boundary ceremony the plan asked for, and the anchor the recap and
  // the journal both cite. Cheap (tiny tier) and never fatal: an unnamed
  // chapter falls back to its number.
  const named = title ?? (digest ? await titleChapter(digest) : null);

  const closed = {
    id:        `ch-${chapterIndex()}`,
    title:     named ?? t('chapter.untitled', { n: chapterIndex() }),
    digest:    digest ?? '',
    startTurn: start,
    endTurn:   turn,
    reason,
  };

  const list = chapters();
  setValue(`session.chapters.${list.length}`, closed);   // narrow append
  setValue('session.chapterId', `ch-${list.length + 2}`);
  setValue('session.chapterStartTurn', turn);
  setValue('session.rollingDigest', null);
  setValue('session.digestTurn', turn);
  tick();

  // A closed chapter is the natural moment to fold stale local detail out of
  // the ledger — old turns are now represented by the digest.
  compactLedger(start);

  // ...and the moment the world moves on its own. Threats the player walked
  // away from get worse; a filled clock becomes regional news.
  tickWorldClocks();

  // A clock that fired wrote a regional patch, which means some digest now
  // describes a world that no longer exists. Re-render those before the next
  // chapter's first prompt is assembled, or the GM opens the chapter reading
  // last chapter's world. Best-effort: a failed render keeps the old text.
  try { await refreshStaleDigests(); } catch { /* stale beats broken */ }

  return closed;
}

// "Previously on…" — shown when a save is resumed, built from what is already
// stored (no LLM call).
export function recap() {
  const last = chapters().at(-1);
  const lines = [];
  if (last?.digest) lines.push(t('chapter.previously', { title: last.title, digest: last.digest }));
  if (rollingDigest()) lines.push(rollingDigest());
  return lines.length ? lines.join('\n\n') : null;
}
