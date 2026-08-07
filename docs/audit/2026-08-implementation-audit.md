# Implementation Audit — the 80-Hour AAA Campaign plan, verified against the code

> **Date:** 2026-08-07 · **Subject:** [`2026-08-comprehensive-implementation.md`](2026-08-comprehensive-implementation.md)
> **Method:** every story's acceptance bullets read against the four repos at
> `Dans-Dungeons@f0dce56`, `bag-of-holding@ba13068`, `bag-of-holding-client@cc8e43f`,
> `bag-of-holding-mcp@81e5151`. Claims were checked by locating the call site, not the
> export. Test suites were run.

---

> **Follow-up pass, same day.** Sections 2–5 below are the audit as found. A remediation
> pass has since landed the fixes in §7 items 1–5: the four orphans are wired and the
> wiring test no longer counts imports as consumers; E1.S5 shipped as engine **2.2.1**;
> the per-turn cost items and DC clamping / response validation are in; the docs are
> re-stamped. **Not** fixed, and still open: the thirteen unstarted stories in §3 beyond
> E1.S5, and the partials in §4.3. One plan bullet was deliberately rejected — see the note
> at the end of §4.1. Findings are left as written so the evidence stays checkable — which
> means file:line references point at the audited commits above, not at `HEAD`.

## 1. Verdict

**The foundations are real. The execution log overstates how much of the plan they cover.**

The keystone work landed and landed well: the world ledger, canon extraction, the scope
assembler, chapters and rolling digests, the atlas graph, entity minting and threat clocks
are genuinely built, genuinely wired into the turn loop, and genuinely tested. That is the
hard half of the plan and it is not a facade.

But the plan has **49 stories**, and the execution log reads as though nearly all of them
landed, closing with "Still open, deliberately" naming three. The real count:

| Status | Stories | Share |
|---|---|---|
| **Complete** — every acceptance bullet met | 18 | 37% |
| **Partial** — story landed, named bullets unmet | 18 | 37% |
| **Not started** | 13 | 27% |

Of those 13 untouched stories, **three were declared open** (E8.S2 spells, E11.S1 `flow.js`
split, E11.S4 MCP harness). **Ten were not**, including **E1.S5 — a P0 showstopper** that
never appears in the execution log at all.

The plan's own sharpest structural finding — *"machinery without content, content without a
consumer"* — **has recurred**, in the exact form `tests/wiring.test.js` was written to
prevent. Four capabilities are built, tested, exported, and called by nothing.

Test suites are green and honest: game **427**, engine **1,574**, client **187**, all
passing. (MCP's 12 failures in this container are a missing `node_modules`, not a defect;
same for `node build.js` failing on a missing esbuild.)

---

## 2. The recurrence: orphaned capabilities

`tests/wiring.test.js` guards 19 symbols against becoming orphans. It has two holes: it
lists only symbols someone remembered to add, and its check is `new RegExp('\\b'+symbol+'\\b')`
over `src/` — **an unused `import` satisfies it**. Four capabilities added in the same pass
are orphans today.

| Capability | Story | Evidence | Consequence |
|---|---|---|---|
| **Foreshadowing / payoff ledger** | E7.S4 | `plantClue()` and `payClue()` (`src/game/acts-runtime.js:77,82`) have **zero callers** in `src/` | Nothing ever plants a setup, so `unpaidSetups()` always returns `[]`. The act-generation prompt's *"Any unpaidSetups MUST be paid off in this act… A clue that never lands is a broken promise"* is fed an empty list every time. The whole story is inert. |
| **Digest invalidation** | E4.S3 | `staleDigests()` (`src/game/ledger.js:126`) has **zero callers** | Region/settlement/world digests are written once at worldgen and never re-render. `world-clocks.js:40` even comments *"digests go stale and the next region summary has to account for it"* — nothing reads the dirty set, so no summary ever does. This is the stale-digest drift loop E4.S3 exists to close. |
| **Chapter titling** | E4.S1 | `titleChapter()` (`src/ai/summarize.js:44`) has **zero callers**; the sole `cutChapter(reason)` call (`flow.js:1661`) passes no title | Every chapter falls back to `t('chapter.untitled')`. The plan's "Chapter 4 — The Road to Saltmarch" ceremony renders as "Chapter 4". |
| **Faction project clocks** | E6.S3 | `addClock()` is called from exactly one place: `armThreatClocks()` (`world-clocks.js:63`) | Only E9's invented local threats get clocks. No faction ever gets the 2–3 project clocks with `onFill: patches[]` the story specifies. "The world visibly moved while you were in a dungeon" only happens for ghouls, never for factions. |

**Fix the guard, not just the four:** add these symbols to `WIRED`, and change `callersOf`
to ignore `import` statements so an unused import stops counting as a consumer.

---

## 3. Not started, and not declared open

### 3.1 E1.S5 — Engine replay & session integrity *(P0-7, showstopper S5)*

Untouched. Not one of its five bullets landed, and it is absent from the execution log.

- `verifyLog` still ends in `default: throw new Error('Cannot replay unknown roll op')`
  (`bag-of-holding/src/replay.js:152`). It has no case for `deathSave`, `mechanicApplied`
  or `hookFired` — all three of which `record()` emits (`engine.js:629`, `:835`, `:337`).
  **Any session containing a death save, a class mechanic or a fired hook is unverifiable.**
- The Dans-Dungeons workaround the plan said to delete is still there, and its comment still
  explains why: *"The engine's own rollLog isn't reused because it tags death saves with a
  `deathSave` op that verifyLog can't replay"* (`src/game/rng.js:77-79`).
- Unlogged RNG draws remain unlogged. `travel.js`, `equipment.js`, `movement.js` and
  `magic-items.js` take a raw `rng` parameter and never route through `record()` — every
  `record()` call site in the engine is inside `engine.js`.
- `conditionName` / `conditionsRequiringSave` — the API merge `c4654c7` dropped — are still
  absent from `src/conditions.js`.

### 3.2 The other nine

| Story | State | Evidence |
|---|---|---|
| **E3.S2** Multi-tab & integrity | Nothing | No Web Locks, no `storage`-event fallback, no hot-envelope checksum. Two tabs still last-writer-wins. |
| **E3.S3** Save slots & export v2 | Nothing | No slot machinery anywhere. `handleImportFile` (`exports.js:83`) restores state and commits but never reboots the flow FSM — the audit's "wrong loop driving after mid-session import" is unfixed. |
| **E4.S3** Digest refresh | Primitive only | Orphan above. Also: world-bible still calls `buildWorldBlueprint()` and re-runs the pipeline from a seed (`worldbible.js:9,24`) — it documents a fresh random world, not the campaign. Journal still weaves raw narrations; no chapter-digest consumption. |
| **E6.S2** History layer & continents | Nothing | No `history` entry in `WORLDGEN_LAYERS` (`worldgen.js:106`), no `HISTORY_SCHEMA` in the client lib, no continent stubs, no `ev.*` dungeon origin tags. |
| **E6.S4** Region density | Nothing | No site archetypes beyond settlement+dungeon, no side-quest generator, no extra dungeon topologies, no rumour propagation from settlements. |
| **E7.S3** Casting & binding | Nothing | The engine's archetype-casting module is still unwired. `beatsPrompt` still instructs `preferredLocation: null (will be assigned to regions later)` — the exact "prompted to null" defect the story names. (Flag-primary completion and stall detection *did* land, via E7.S1/S2.) |
| **E7.S4** Foreshadowing & payoff | Orphan | §2 above. |
| **E10.S2** Input & affordances | Nothing | `pickFrom` (`input.js:129`) still `appendEntry`s numbered text lines and waits for typed input — character creation and tier selection are unclickable. The global Spacebar handler (`input.js:191-196`) guards only against the command field, so Space on a focused button is still hijacked. Five `font-size: 9px` rules remain in `style.css` (244, 279, 313, 565, 927). |
| **E10.S5** Language parity | Nothing | **39 keys missing from `nl.json`** — precisely the enemy intros the audit named (`world.enemyIntros.spider`, `.kobold`, `.bandit`, …). 17 orphan NL keys. 15 en/nl strings identical beyond 12 chars (untranslated). No parity CI check. |

> On the parity claim specifically: the execution log credits E11's prompt-contract suite
> with "locale parity". `tests/prompt-contract.test.js:27` checks parity for the **`ai.*`
> prompt keys only** — the 39-key content gap sits outside its scope and CI is green over it.

---

## 4. Landed, but short of the written spec

These stories are in the execution log as done. Each has named acceptance bullets that are
not met. Grouped by what it costs.

### 4.1 Costs money and latency on every turn

- **E5.S1 — JSON minification.** The narrator minifies; the classifier does not.
  `JSON.stringify(sceneContext, null, 2)` still pretty-prints in `classify.js:10`,
  `autoplay.js:12` and `dialogue.js:15`. The plan's "~12% of input tokens" applies to the
  tiny-tier call that runs *every turn*.
- **E5.S3 — classifier skip for structured input.** Not implemented. `loop.js:147`
  unconditionally `await classify(...)`, including for chip and compass input that is
  already structured. The plan lists this as one of two "pure-win" latency fixes.
- **E5.S3 — beat check off the critical path.** Not implemented. `await maybeAdvanceBeat()`
  (`loop.js:224`) runs before `finalizeTurn()`. The plan says fire-and-forget.
- **E2.S3 — async canon commit.** Spec: *"extraction runs off the critical path (after
  `finalizeTurn`)"*. Actual: `await absorbNarration()` at `loop.js:221`, before
  `finalizeTurn()` at `:228`. A second tiny-tier round trip sits in the player's wait.
  **Rejected on review, not fixed.** `finalizeTurn` stamps the undo boundary at the
  *current* history length, so anything written after it lands outside the turn: an undo
  to that turn would scrub the minted entities and canon patches, and the story-flag
  writes above it already carry a comment explaining why they must land first. This
  bullet was written before time travel shipped and is unsafe as specified. Latency is
  worth less than a save that survives an undo; `loop.js` now records the reasoning.
- **E10.S4 — image rationing.** Not implemented. `requestSceneImage()` fires on every turn's
  narration (`flow.js:1629`), gated only on the `sketchView` setting. The plan's "47× the
  text cost" stands.

### 4.2 Correctness and safety

- **E5.S2 — DC clamping.** No clamp exists. `resolver.js:68` takes the model's number
  verbatim: `const checkDC = dc ?? 12`. The schema types `dc` as `['number','null']` with no
  bounds, and the prompt's only guidance is one line — *"For skill checks suggest a dc
  between 10 and 20"* — not the rubric the story asks for. A hallucinated DC 45 resolves as
  DC 45.
- **E11.S2 — client-side response validation.** Not implemented, and not declared open. No
  intent-in-enum check, no DC clamp, no narrator-field assertion, no typed fallbacks.
  Schemas are sent and responses trusted, exactly as the audit found.
- **E5.S3 — schema on the streaming call.** `_callStream({ tier: 'medium', messages })`
  (`narrate.js:66`) passes no schema; `NARRATOR_SCHEMA` is used only in the repair path
  (`:71`). The story requires it as `response_format` on the stream itself.
- **E1.S7 — CSP pin.** `index.html:7` ships `connect-src https:` — any HTTPS origin. The
  story asks for the configured base URL. (Credential stripping *did* land properly:
  `withoutCredentials()` on export, `sanitizeImported()` on import, `state.js:319,327`.)
- **E2.S2 — dungeon interior write-back (P1-7).** On exit only `completed: true` is stamped
  (`flow.js:1475`); the live `world.rooms`/`world.npcs` are never folded into
  `world.dungeons[id]`. Re-entry restores the *generated* rooms and npcs (`flow.js:1345`),
  so re-entering a cleared dungeon resurrects its dead and restores its taken loot. The
  ledger holds the truth; the world the resolver reads does not. The plan noted this should
  be free once the ledger existed.

### 4.3 Scale properties the 80-hour goal depends on

- **E2.S4 — save envelope v3.** Not done. `SAVE_VERSION = 2` and
  `SAVE_MIGRATIONS = { 1: (data) => data }` (`state.js:168,174`) — the only migration is the
  identity function. The plan wanted v3 `{seed, baseHydrations, ledger, viewCache?}`
  specifically so the migration runner "finally gets exercised"; it remains unexercised.
- **E5.S1 — `canonHits`.** No inverted index, no associative recall. `assembleScope` returns
  world/region/memory/here/nearby/known/gmOnly and no `canonHits` tier.
- **E9.S2 — detail budget.** No cap, no LRU demotion. 80 hours of set dressing accumulates
  unbounded per location.
- **E10.S1 — turn cancel.** No `AbortController` anywhere in the game or in the client's
  transport/client/stream layer (the only one is a catalog-fetch timeout,
  `catalog.js:14`). P1-11 is unimplemented; there is no way to cancel a turn.
- **E8.S3 — equipment and gold sinks.** Item effects landed (heals/gold/value/lore, honestly
  claimed). The story's other two bullets did not: no `Equipment.*` usage, no attunement, no
  AC-from-armour, and no gold sinks (no inn stays, no brokers). The equipment module
  unlocked by the E1.S6 re-vendor is still unused.
- **E8.S4 — NL creature parity.** The tier templates landed (`elevate`, `bossTierForLevel`,
  `bestiary.js:42-56`) and are genuinely good. The story's fourth bullet — NL parity for
  creature content — is part of the 39-key gap in §3.2.
- **E7.S2 — epilogue.** Act generation, finale gating and the finale prompt note landed. The
  "epilogue renderer (world-state → where-are-they-now from the ledger)" did not.
- **E9.S4 — acceptance script.** Steps 1–4 are covered by `tests/ledger-memory.test.js`
  (moldy curtains, ghoul minting, escalation, resolution, dedup) — genuinely strong work.
  Step 5, export → reimport → all still true, has no test.
- **E11.S3 — coherence harness.** The cost/latency budget bullet landed
  (`tests/scope-budget.test.js`). The golden-scene eval set and the 100-turn coherence soak
  — the drift metric the plan wants tracked per release — did not.

---

## 5. Documentation drift — E0.S2 has already regressed

E0.S2 stamped every design doc with a status header and corrected `CLAUDE.md`. Both were
true when written and are not true now: the E2–E9 work landed **the same day**, and nothing
re-stamped.

**Design docs now understate the codebase:**

| Doc | Says | Reality |
|---|---|---|
| `12-context-scoping.md` | *"DOC-ONLY … None of this is implemented"* | `src/game/scope.js` implements it; E5 landed |
| `03-game-loop-and-sessions.md` | *"DOC-ONLY … There are no chapters, no recaps"* | `src/game/chapters.js`; E4 landed |
| `06-persistence.md` | *"The IndexedDB split … does NOT exist"* | `bag-of-holding-client/src/persistence/idb.js`; E3.S1 landed |

**`CLAUDE.md` has drifted back into the state E0.S2 fixed:**

- **12 modules missing from the map:** `acts.js`, `canon.js`, `summarize.js`,
  `acts-runtime.js`, `atlas.js`, `canon-commit.js`, `chapters.js`, `ledger.js`,
  `progression.js`, `scope.js`, `scope-budget.js`, `world-clocks.js`.
- **2 phantom paths:** `src/ui/epub.js` (does not exist) and `src/llm/tiers.js` (belongs to
  the client lib, not `src/`).
- **Test count says 301; the suite is 427.**
- The turn-loop section still describes the six-step 2026-07 loop, with no mention of the
  ledger write, canon extraction, scope assembly or progression that `loop.js` now runs.

The plan's own §1 pillar 6 — *"the repo tells the truth"* — is the gate E0 exists to hold.
It is open again.

---

## 6. What is solid

Stated plainly, because the list above is long and the work underneath it is not thin:

- **E2 the ledger** — precedence is enforced in code, not convention
  (`bag-of-holding-client/src/ledger/patch.js:89-101`: a canon patch contradicting mechanical
  state returns `{ok:false, reason, conflict}`). The turn loop writes mechanical patches from
  the resolver and extracts canon from the narration. This is the keystone and it holds.
- **E9 emergence** — minting, dedup, stat-block binding, escalation and resolution, all
  covered by named tests that read like the acceptance script.
- **E4.S2 memory** — chapter digests + rolling digest + a 14-entry window, assembled
  stable-first for prefix caching.
- **E1** — every showstopper except S5: models heal at boot, chips render, encounters resume,
  saves are narrow and loud, the engine is vendored under a checked manifest.
- **E5.S1's secrets boundary** — `buildGmContext()` is the only path secrets travel, and
  `wiring.test.js` asserts `buildScene` never carries them into the UI or the save.
- **CI in all four repos**, with a vendor-manifest check and a stale-bundle guard.

---

## 7. Recommended order

1. **Wire the four orphans** (§2) and fix `callersOf` to discount imports. Small, and it
   restores the guarantee the guard was supposed to give.
2. **E1.S5** — it is a P0, it is untouched, and it silently invalidates replay verification
   for any session with a death save.
3. **The per-turn cost/latency set** (§4.1) — five small fixes, all named in the plan, all
   paid on every turn: minify, skip the classifier for chips, move the beat check and canon
   extraction after `finalizeTurn`, ration images.
4. **DC clamp + response validation** (§4.2) — the shortest path to bounding what a
   hallucinating model can do to mechanical state.
5. **Re-stamp the docs and `CLAUDE.md`** (§5), then keep E0.S2 honest by treating the stamp
   as part of the story that changes the behavior.
6. **Correct the execution log** so its "still open" line names the ten undeclared stories.
   The log is the artifact the next contributor will trust.

---

*Companion documents: [implementation plan](2026-08-comprehensive-implementation.md) ·
[audit synthesis](2026-08-comprehensive-audit.md) ·
[findings appendix](2026-08-comprehensive-audit-appendix.md).*
