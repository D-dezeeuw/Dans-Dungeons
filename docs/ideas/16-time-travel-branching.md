# 16 — Time-travel: Undo, Redo & Branching

> **Status:** design / approved scope. Builds on the single-step undo already
> shipped in [`src/game/undo.js`](../../src/game/undo.js) (commit `89ec609`,
> hardened in the `spektrum-adoption` merge). Target: full undo + redo +
> branch-on-divergence + persisted branches + seeded-roll audit.
>
> Five phases, each an independent feature branch (per the repo's
> branch→build→verify→merge workflow). You can stop after any phase.

---

## 1. The substrate — what Spektrum already gives us

Spektrum records **every state mutation** as an append-only `history` entry
`{ id, path, value, op }` (`op ∈ {set, add, checkpoint}`). The relevant surface
(re-exported through [`src/core/state.js`](../../src/core/state.js)):

| API | What it does |
| --- | --- |
| `history` | the live append-only mutation log |
| `cursor` | index of the next slot; `< history.length` means "scrubbed back" |
| `replay(n)` | rebuild `appState` by re-applying the first `n` recorded entries — **re-fires reactive bindings, does not re-run app code** |
| `checkpoint(name, meta)` | record a state-less tagged marker; `replay` walks past it unchanged |
| `checkpoints` | filtered view of `history` (checkpoint entries + their indices) |
| `forks` | dropped history tails, auto-captured when you mutate while scrubbed back — **this is the branch store** |
| `onFork(fn)` | fires with `{ entries, forkedAt, ts }` whenever a divergence truncates history |
| `onRecord(fn)` | fires on every recorded entry |
| `serialize({includeHistory, includeForks})` | `{ state, history, cursor, forks? }` |
| `snapshotEvery: K` | periodic full-state snapshots → `replay` costs O(K) not O(n) |
| `forkLimit` | cap on retained fork tails (default 50; `0` = don't retain, hook still fires) |
| `attempt(name, fn)` | speculative block with `commit()` / `discard()` |

## 2. The core insight — scrub vs. branch

`replay(n)` **re-applies recorded mutations**; it does not re-run the turn loop,
the resolver, or the dice. Every dice result, HP change, and the narration text
are already baked into history by [`commitAll`](../../src/game/resolver.js#L235)
and [`appendTranscript`](../../src/game/resolver.js#L302). So the feature splits
into two mechanically different operations:

| | **Scrub** (undo / redo) | **Branch** (diverge) |
| --- | --- | --- |
| Trigger | press undo/redo | issue a *new* action while scrubbed back |
| Mechanism | `replay()` to a turn boundary on the current branch | the normal turn loop runs (classify → resolve → narrate → commit) |
| Cost | free, instant | LLM tokens + a fresh roll |
| Determinism | exact — replays recorded mutations | new outcome (desirable: a different choice → different result) |
| Spektrum effect | moves `cursor` | auto-forks the abandoned future; `onFork` fires |

**Consequence:** undo/redo need *no* seeded dice — they replay outcomes, they
don't re-roll. Seeded dice (Phase 5) only buy us *reproducible branches* and an
*audit trail*, not undo/redo correctness. Today combat is unseeded anyway
([`resolver.js:32`](../../src/game/resolver.js#L32) calls `Combat.attackRoll`
with the default `Math.random`); only dungeon generation is seeded.

## 3. Invariants the design must hold

1. **Epoch scoping is load-bearing.** `world` is rewritten wholesale on
   dungeon / settlement / encounter swaps, so replaying across a swap corrupts
   state. The shipped undo refuses this via
   [`contextSig()`](../../src/game/undo.js#L39); [`clearTurnMarks()`](../../src/game/undo.js#L79)
   is called at six transition points in
   [`flow.js`](../../src/game/flow.js). **All time-travel stays within one
   play-context epoch.** Crossing a swap starts a fresh root and drops prior
   branches. (This is distinct from the AI-prompt "context scoping" in
   [12-context-scoping.md](12-context-scoping.md).)
2. **Two imperative surfaces** — the transcript DOM and the compass — must be
   redrawn after any scrub. Reactive bindings (`:innerHTML`, `data-each`,
   `data-if="ui.canUndo"`) refresh themselves.
3. **Out-of-history side effects** don't revert on scrub: scene images live in
   `localStorage` + in-memory `journalLog`; `ai.totalTokens`/cost are monotonic.
   See the decision table in §9.
4. **History/forks aren't persisted** unless we opt in (Phase 4):
   [`saveToStorage`](../../src/core/state.js#L144) saves only the appState slice.

---

## 4. Phase 1 — Undo + Redo (linear time-scrub)

**Goal:** finish the half-built undo with a cursor model that also supports redo.

**Change [`src/game/undo.js`](../../src/game/undo.js) from a pop-stack to a
cursor:**

- Replace `_marks` (push/pop) with `_stops` — an ascending list of
  turn-boundary history indices for the current epoch — plus `_pos`, the index
  of the stop we're currently sitting at, and `_epochSig` (one sig per epoch).
- `_stops[k]` = "appState after `k` committed turns"; `_stops[0]` = epoch root.
- `finalizeTurn(mark)`:
  - seed `_stops` with `mark.index` (the epoch root) on the first turn of an epoch;
  - **if scrubbed back** (`_pos < _stops.length - 1`) truncate
    `_stops.length = _pos + 1` — the just-forked redo stops are gone (Phase 2
    captures them as a branch);
  - push the new head (`spektrumHistory.length`) and set `_pos` to it;
  - drop `checkpoint('turn')` (kept for the visual tree in Phase 3).
- `undo()`: `_pos > 0` → `_pos--`, `replay(_stops[_pos])`, redraw, refresh flags.
- `redo()`: `_pos < _stops.length - 1` → `_pos++`, `replay(_stops[_pos])`, redraw.
- Derived flags: `ui.canUndo = _pos > 0`, `ui.canRedo = _pos < _stops.length - 1`.
- Keep the existing guards: refuse mid-turn (`#cmd` disabled), and on
  `contextSig()` mismatch call `clearTurnMarks()`.

**UI:** add `#redo-btn` mirroring [`#undo-btn`](../../index.html#L309) with
`data-if="ui.canRedo"` and a redo glyph; wire both in `initUndoButton` (rename →
`initTimeTravel`). Optional: `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` shortcuts.

**Tests** (`tests/timetravel.test.js`): drive synthetic turns
(`setValue`+`checkpoint`+`finalizeTurn`); assert undo/redo move `appState`,
`canUndo`/`canRedo` track correctly, and a new turn after undo discards the redo
stops.

## 5. Phase 2 — Branch on divergence

**Goal:** "go back and take a different path," keeping the abandoned future
reachable.

- **Own the branch registry.** Subscribe to `onFork` and capture each dropped
  tail into an epoch-scoped `_branches` list: `{ id, label, forkedAt, entries,
  ts }`, where `label` is the action that started the path not taken (read from
  the first player line in the tail's first `transcript` write). The handler
  ignores forks whose `forkedAt` precedes the epoch root, and `clearTurnMarks()`
  resets `_branches`, so branches never leak across an epoch. (Note: the
  *vendored* Spektrum gates `onFork` on `forkLimit !== 0` — setting `forkLimit:
  0` would **suppress** the hook, the opposite of the `.d.ts` comment — so we
  keep the default `forkLimit` and simply don't read Spektrum's own `forks`
  array.)
- **Swap to a branch** = `replay(epoch root)` then re-apply `branch.entries`
  (Spektrum re-records them as live history; the branch you *left* fires
  `onFork`, so it lands back in `_branches` automatically). After the swap,
  rebuild `_stops` by scanning the now-live history for `'turn'` checkpoints.
  Branch-swapping is symmetric ping-pong, all within one epoch.
  - **Land at the DIVERGENCE POINT, not the head** (`commonTurnPrefix`): `_pos`
    is set to the turn where the target branch first differs from the path being
    left, then `replay(_stops[_pos])`. So after a switch the branch's
    continuation is the navigable **future** (redo) and the shared prefix is the
    **past** (undo) — the timeline becomes a tree where, at a fork, you choose
    which future is active and explore it both ways. (Landing at the head left
    you stuck at the branch's end with no redo.)
- **UI (minimal):** a branch-count indicator (Lucide `git-branch`) that opens a
  dropdown of `_branches` (label + turn + timestamp); selecting one swaps.

**Tests:** within one epoch — diverge, assert the old tail is captured with the
right `forkedAt`/label; swap and assert `appState` + `_stops` match the branch;
ping-pong twice and assert no entries are lost; assert epoch reset clears
`_branches`.

## 6. Phase 3 — Visual timeline + branch-model hardening

**Built in [`src/ui/timeline.js`](../../src/ui/timeline.js)** (which replaces the
Phase 2 branch dropdown — one popup for the whole tree). It renders the current
run's **spine** (one node per committed turn, labelled by that turn's action,
current node highlighted; click to scrub) and an **Other timelines** section
listing the abandoned branches (label + turn count; click to swap). undo.js gains
`jumpToStop(index)` (scrub to any turn) and `listTimeline()` / `listBranches()`,
and a single `onTimeTravelChange` listener fires the UI on every change.

This phase was **not** "pure presentation": exposing arbitrary branch jumps
surfaced a real correctness bug in Phase 2. Branches stored a history *index*
(`forkedAt`), but swapping to a shallower branch truncates history that a deeper
branch's index pointed into — a flat ping-pong is fine, a multi-level tree
corrupts. **Fix: branches are now root-relative.** `captureFork` stores the full
branch from the epoch root (`history.slice(root, forkedAt)` + the dropped tail),
and `jumpToBranch` always replays to the always-stable root before re-applying.
Covered by a dedicated "deep branch after a shallower divergence" test.

i18n of the panel's control labels (English today) is deferred — consistent with
the other time-travel control chrome.

## 7. Phase 4 — Persist branches across reload

**Goal:** undo/redo/branch survive a page reload. **Built.**

The blob (embedded in the save under `_timeTravel`) is scoped to the current
epoch and self-contained from the epoch ROOT:
`{ epochSig, pos, root, spine, branches: [{label, turns, entries}] }`, where
`root` is a deep-cloned PERSIST_KEYS snapshot captured at the first turn's
`beginTurn`, `spine` is the current branch's `root→head` entries, and each
branch carries its full root-relative entries.

- **Save** ([`state.js`](../../src/core/state.js)): undo.js registers an
  `exportTimeTravel` provider (inverted dependency — state.js never imports
  undo.js); `saveToStorage`/`serializeSave` embed its output. `SAVE_VERSION`
  bumped 1→2 with an identity migration (v1 saves just lack `_timeTravel`).
- **Load** ([`main.js`](../../src/main.js)/[`exports.js`](../../src/ui/exports.js)):
  `restoreState` skips `_timeTravel`; after init, `importTimeTravel` restores the
  root baseline, re-records the spine to rebuild history, recomputes the stops,
  re-registers branches, and replays to `pos`. It runs **before** `resumeGame`
  (which is read-only over appState) and doesn't touch the transcript DOM.
- **Failsafe (critical):** `importTimeTravel` is wrapped in try/catch and
  validates the blob; on any failure it returns false and the caller
  re-establishes the plain saved state. A broken/oversized blob can therefore
  **never** block loading the game — worst case is "no surviving history," i.e.
  today's behaviour.
- **Size cap:** the doc's §7 risk is real (entries store absolute values, and
  `commitAll` snapshots the whole `world` each turn). Resolved with option (b)+a
  guard: epochs over `MAX_TT_ENTRIES` (500) are simply **not** persisted
  (logged); basic save/load is unaffected. A typical dungeon (~15–40 turns) is
  well under. Future work for huge epochs: narrow `commitAll`'s mutation paths
  (option c) or a sliding window (option a).

## 8. Phase 5 — Seeded-roll audit (reproducible, verifiable branches)

The rules engine already ships the machinery, currently **bypassed** by the
game's resolver: `Dice.seededRng` + an engine session `rollLog` + `verifyLog`
([`../bag-of-holding/src/engine.js`](../../../bag-of-holding/src/engine.js),
[`replay.js`](../../../bag-of-holding/src/replay.js)). Adopt it:

**Implemented in [`src/game/rng.js`](../../src/game/rng.js).**

- **RNG position lives in appState.** `session.rng = { seed, cursor }` — the
  epoch seed plus the cumulative number of Mulberry32 draws consumed. Because
  it's recorded Spektrum state, **a scrub restores the exact position** and a new
  branch continues from it. Net effect: **dice become a deterministic function
  of the choice sequence** — re-issuing the same action after an undo reproduces
  the roll; a *different* action consumes the stream differently and diverges.
  `session.rollLog` is the audit trail, rebuilt from cursor 0 each epoch.
- **Reconstruct, don't cache.** The per-turn roller rebuilds the stream with
  `Dice.seededRng(seed)` fast-forwarded `cursor` draws — decoupled from the
  PRNG's internals (only `seededRng` determinism is assumed), and bounded
  O(cursor) per turn (one epoch's rolls).
- **Combat goes through a seeded *engine*, not bare functions.** Key discovery:
  the library exports `Combat`/`Checks` **bound to the default engine**
  (`export const { Combat } = createEngine()`), so a per-call `rng` argument is
  ignored. The only injection point is an engine created *with* the rng:
  `createEngine({ rng, logRolls: true })`. So [`resolver.js`](../../src/game/resolver.js)
  now takes a `roller` (default = unseeded engine, so existing tests are
  unchanged) and rolls through `engine.Combat.attackRoll` / `damageRoll` /
  `deathSave` and `engine.Checks.abilityCheck`. The roller counts draws (to
  advance `cursor`) and records a verifyLog-shaped entry per roll.
- **Seed per epoch:** `seedCombat(dungeon.seed)` on dungeon entry
  ([`flow.js`](../../src/game/flow.js)) resets `{ seed, cursor: 0 }` + `rollLog:
  []`, so each dungeon's log is self-contained and verifiable.
- **Audit:** `verifyCombatLog()` → `verifyLog({ seed, log })` confirms every
  recorded roll replays from the seed (tamper/desync check). The engine logs a
  death save under a `deathSave` op that `verifyLog` can't replay, so the roller
  encodes it as its single `rollDie(20)` draw instead — keeping the whole log
  verifiable. Exposed as `window.verifyRolls()` for console audits.
- **Limitation:** only dungeon epochs are seeded; settlement/overworld rolls
  (rare) stay on `Math.random`. Acceptable — combat and its time-travel stakes
  live in dungeons.

**Tests:** same seed + same action sequence → identical `rollLog`; scrub +
re-issue same action → identical roll; scrub + different action → RNG diverges;
`verifyLog` passes on a recorded run.

---

## 9. Cross-cutting decision — out-of-history side effects

| Side effect | On **scrub** (undo/redo) | On **new branch** | Decision |
| --- | --- | --- | --- |
| Scene image (`localStorage`/`journalLog`) | stays (not in history) | regenerated (tokens) | Accept stale image on scrub; it refreshes on the next narration. Optionally re-key images by turn so scrub shows the right one. |
| `ai.totalTokens` / cost | not reverted (monotonic) | increments | **Keep monotonic** — you really did spend it. Don't fold into history. |
| Transcript | reverts (it's in `appState`) | rewritten | Already correct; DOM redrawn imperatively. |
| RNG state (Phase 5) | reverts (in history) | continues from divergence | Deterministic branches — see §8. |

## 10. Spektrum config to confirm

The app imports the **default singleton** (`createSpektrum()` with default
options), and Phases 1–2 work on it as-is: default `forkLimit` (50) keeps
`onFork` firing, and `replay()` is O(n) without `snapshotEvery`, which is fine at
one-epoch scale. If replay perf ever bites, the singleton would need
re-creation with `snapshotEvery` (a vendored-file change). Avoid `forkLimit: 0`
(it suppresses `onFork` in this build) and `historyLimit` (makes `replay()` below
the surviving window undefined).

## 11. Recommended order

1 → 2 are the substance (the user's actual ask). 5 is independent and can land
any time after 1 (it makes 2's branches reproducible). 3 is polish. 4 is the
heaviest (the §7 size risk) — do it last, once branch shapes have settled.

## 12. Open questions

- Phase 4 persisted-history size: cap to last *K* stops, accept per-epoch, or
  narrow `commitAll`'s mutation paths? (§7)
- Should scrubbing re-show the matching scene image, or is "latest image" fine?
- Keyboard shortcuts for undo/redo — and do they conflict with the input box?
- Branch dropdown vs. full tree as the *first* branch UI (Phase 2 vs. straight
  to Phase 3)?
