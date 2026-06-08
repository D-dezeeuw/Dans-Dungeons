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

- **Own the branch registry.** Set `forkLimit: 0` on the store so Spektrum
  doesn't accumulate stale cross-epoch forks, but the `onFork` hook **still
  fires with the dropped `entries`**. Capture each into an epoch-scoped
  `_branches` list: `{ id, label, forkedAt, entries, ts }`, where `label` is the
  divergence point (e.g. `"Turn 7: open the vault"`, read from the transcript /
  turn counter at `forkedAt`). Reset `_branches` in `clearTurnMarks()` so
  branches never leak across an epoch.
- **Swap to a branch** = `replay(branch.forkedAt)` then re-apply
  `branch.entries` (Spektrum re-records them as live history; the branch you
  *left* fires `onFork`, so it lands back in `_branches` automatically). After
  the swap, rebuild `_stops`/`_pos` by scanning the now-live history for
  `'turn'` checkpoints. Branch-swapping is therefore symmetric ping-pong, all
  within one epoch.
- **UI (minimal):** a branch-count indicator (Lucide `git-branch`) that opens a
  dropdown of `_branches` (label + turn + timestamp); selecting one swaps.

**Tests:** within one epoch — diverge, assert the old tail is captured with the
right `forkedAt`/label; swap and assert `appState` + `_stops` match the branch;
ping-pong twice and assert no entries are lost; assert epoch reset clears
`_branches`.

## 6. Phase 3 — Visual timeline / branch tree (optional polish)

Read-only view over `checkpoints` (turn nodes on the active branch) + `_branches`
(divergence stubs). Render a vertical timeline with branch offshoots; clicking a
turn node scrubs (`replay`), clicking a branch stub swaps. Pure presentation —
no new state mechanics. Likely a sidebar panel or overlay; reuses the Lucide
catalog. Defer until Phases 1–2 feel right.

## 7. Phase 4 — Persist branches across reload

**Goal:** undo/redo/branch survive a page reload.

- Persist, scoped to the **current epoch only** (cross-epoch history is invalid
  per §3.1): the live appState (as today) plus a `timeTravel` blob
  `{ epochSig, stops, pos, branches: [{id,label,forkedAt,entries,ts}] }`.
  The live branch's serialized history runs from `stops[0]` (epoch root) to head.
- **Load:** after `restoreState` sets the live appState, rebuild Spektrum history
  by re-applying the recorded entries from the epoch root in order (dropping
  `checkpoint('turn')` at each stop), then re-register `_branches` from the blob.
- **Envelope:** bump `SAVE_VERSION` 1→2 with a forward migration; v1 saves load
  with an empty `timeTravel` (no branches) — never strands an old save.

> **⚠ Size risk — call this out before building.** History entries store
> **absolute** values, and `commitAll` does `setValue('world', { ...world })` —
> i.e. it snapshots the *whole world object* every turn. In-session that's just
> memory, but persisting N turns × full-world can bloat the save. Options, in
> order of preference: (a) cap persisted history to the last *K* stops; (b)
> accept it (one epoch is bounded — a single dungeon visit); (c) a separate
> refactor narrowing the mutation paths (`world.npcs`, `world.rooms.<id>`)
> instead of the whole `world`. Decide this when Phase 4 starts; it's the one
> place this design isn't "free."

## 8. Phase 5 — Seeded-roll audit (reproducible, verifiable branches)

The rules engine already ships the machinery, currently **bypassed** by the
game's resolver: `Dice.seededRng` + an engine session `rollLog` + `verifyLog`
([`../bag-of-holding/src/engine.js`](../../../bag-of-holding/src/engine.js),
[`replay.js`](../../../bag-of-holding/src/replay.js)). Adopt it:

- **Seed per epoch:** store a combat seed in appState at dungeon/campaign start
  (e.g. `world.dungeons[id].combatSeed`, defaulting from the existing dungeon
  seed) so it's saved and replayed like any other state.
- **RNG state lives in appState.** Store the raw RNG state (mulberry32 is a
  single 32-bit int) at e.g. `session.rngState`, and `setValue` it on every
  roll. Because it's in history, **scrub restores it automatically** — and a new
  branch continues from the restored RNG state. Net effect: **dice become a
  deterministic function of the choice sequence.** Replaying a branch reproduces
  it exactly; a *new* branch from a divergence point is deterministic given the
  state at that point, yet a *different* action advances the RNG differently →
  different outcome. Exactly the property we want.
- **Route combat through it.** Thread the stored RNG into
  [`Combat.attackRoll` / `damageRoll`](../../src/game/resolver.js#L32),
  `goblinRetaliates`, and `resolveDownTurn` (all currently default to
  `Math.random`). Append each roll to a `rollLog` kept in appState (so it's
  undone/redone/persisted with everything else).
- **Audit:** `verifyLog({ seed, log })` confirms the recorded rolls are
  reproducible from the seed — a tamper/desync check and a debugging aid. Aligns
  with the project's "seeded RNG with audit from day one" principle.

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

`snapshotEvery` (replay perf) and `forkLimit: 0` (§5) are set at store creation.
The app imports a **singleton** from `spektrum`; confirm the config seam (a
config call vs. `createSpektrum(opts)`) when Phase 2 starts. Also consider
`historyLimit` — but note a limit makes `replay()` below the surviving window
undefined, which is fine *only* because we never scrub past the epoch root.

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
