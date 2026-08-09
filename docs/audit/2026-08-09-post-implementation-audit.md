# Post-implementation audit — 2026-08-09

Third audit in the series. The [2026-08-07 comprehensive audit](2026-08-comprehensive-audit.md)
found ten showstoppers and four missing subsystems; the
[2026-08-08 verification audit](2026-08-verification-audit.md) verified the fix
round that followed and left a 20-item P0/P1 table; a second fix round closed
that table and merged on 2026-08-09 (engine 2.5.0 `fab1400`, client 0.2.0
`c7affd0`, MCP 0.1.0 `242b2ec`, game `fbaa01e`). **This audit verifies that
round on merged `main`, adversarially.**

Method: first-hand ground truth (every suite, build, and manifest, plus a
10,000-dungeon generator sweep), then five independent adversarial agents
tasked to *refute* the round's claims (engine, client, game wiring, MCP +
cross-repo honesty, content capacity), then first-hand confirmation of every
fatal or security claim before it entered this document. Every confirmed
finding below was reproduced by probe or sealed by a complete read chain —
none rests on an agent's word alone.

---

## 1. Verdict

**The fix round did what it said in the small and failed in the large.**
All 20 tracked findings are closed or honestly partial (14 CLOSED, 3 PARTIAL,
3 owner-items accurately open). Every suite is green — engine 1,613 +
typecheck, client 250, game 555 unit + 9 e2e with a reproducible bundle, MCP
148 at a true 100/100/100. The docs now tell the truth. The MCP's 63 tools
are honestly described, one overstated claim aside.

And yet the adversarial pass found **four fatal defects and one
security-grade leak, all in the game's wiring layer** — four of the five in
code this very round added or touched, none visible to any suite, all
confirmed by first-hand probe. The recurring lesson of this repo's history
("implemented but not wired", green tests over a dead surface) has a third
verse: **wired, tested at the mirror, and broken at the seam** — every one of
these lives at a boundary the unit suites deliberately mock (Spektrum's
deferred writes, module-local state across the reload boundary, ledger-form
vs world-form ids, a schema the classifier was never told about).

Playtime capacity, measured against content: **~5–8 hours per campaign to a
real epilogue** (up from ~3–5 — act-scaled dungeons, clue payoffs, escalation
and the epilogue bought genuine coherence), **~25–35 hours before structural
repetition**. Content breadth is confirmed as the long pole; the layered-world
program in [`docs/ideas/17-layered-world-lod.md`](../ideas/17-layered-world-lod.md)
is the owner-approved response.

---

## 2. Ground truth (all first-hand, on merged main)

| Gate | Result |
|---|---|
| Engine 2.5.0 (`fab1400`) | 1,613/1,613 tests, `tsc --noEmit` clean |
| Client 0.2.0 (`c7affd0`) | 250/250 tests |
| Game (`fbaa01e`) | 555/555 unit, 9/9 e2e (real browser), `vendor-sync --check` green, rebuild byte-identical bundle |
| MCP 0.1.0 (`242b2ec`) | 148/148 tests, coverage 100/100/100 (verified, not badge-trusted), typecheck clean |
| CI on main, all four repos | green; game Pages deployed |
| Act-scaled dungeon sweep | 10,000 dungeons (2,000/act × acts 1–5): **zero** lock/reachability/boss failures; spine never below minimum; rooms average 7.7 → 12.8 across acts. Branch counts are best-effort under grid crowding (~11% of act-5 dungeons place fewer than nominal minimum; pre-existing, by design, now recorded) |

---

## 3. Confirmed fatal and security findings (the new P0)

All five below were **confirmed first-hand** (probe output or complete
multi-file read chain, cited inline). Severity: F = fatal to a core loop,
S = security.

### F1 — The ledger clobbers itself on every multi-write turn (systemic)

`recordPatch` (`src/game/ledger.js:59-65`) computes its append index from
`ledger().length` — but Spektrum defers `setValue` until `tick()`, so within
one synchronous window every call sees the same length and writes the **same
index**. Probe against the real vendored Spektrum: three appends, one tick →
**one surviving entry** (the last).

Blast radius, verified at each call site:
- `commitCanon`/`mintEntity` (`canon-commit.js`): a mint writes up to 7
  patches (name, description, creatureId, alive, attitude, state, clock) in
  one window — **one survives**. The world ledger — the E2 memory the whole
  80h design leans on — retains a fraction of what the round believed it
  recorded, and since the survivor is the *last* patch (`clock`), the
  `state:'active-threat'`/`creatureId` facts that `activeThreatsAt` filters
  on are lost: **E9 threats are unfindable at the source**.
- `tickWorldClocks` (3 patches per fired clock) and `resolveThreat` (the
  citable `because` clobbered by the follow-up patch): escalation and
  resolution history halved or lost.
- `armThreatClocks`: only the last threat in a place gets a clock.
- Repeat-kill turns: the kill patch lost to the level-up patch.

Why every test is green: `ledger-memory.test.js` *mirrors* the wiring and
keeps `appendPatch`'s returned array — it tests the correct wiring that does
not ship. The e2e's mocked turns record ≤1 patch per window.

Related, same mechanism: `refreshStaleDigests` (`ledger.js`) spreads a
pre-tick `world.regions` per iteration — with ≥2 stale regions, earlier
refreshes are lost. And `recordPatch` calls `appendPatch(current, patch)`
**without** the `bases` argument, so the base-`__mech` precedence gate the
client round built is dead code in its only consumer.

### S1 — Exported saves leak the API key through the time-travel root

`serializeSave` strips credentials from the **top-level** `ai` only
(`state.js:446` → `withoutCredentials`). But `buildSaveSnapshot` embeds the
time-travel blob, whose epoch root is a deep clone of `pickPersisted()` —
**including `ai.key` and `ai.baseUrl`** (`undo.js:100`, `:380`). Any
`.dnd.json` exported while an undo epoch is active (i.e. any mid-play export)
carries the player's OpenRouter key at `_timeTravel.root.ai.key`.

The import side is worse: `sanitizeImported` also strips top-level only, then
`importTimeTravel` → `restoreState(tt.root)` (`undo.js:397`) re-applies `ai`
**from the file** — a crafted save redirects this browser's future calls (and
its key) to a hostile `baseUrl`. This is the exact attack `state.js:203-206`
documents as prevented. Read chain sealed at every hop; both directions must
strip inside the blob.

### F2 — Import over a live campaign restores the wrong character

`resetAndRestore` (`ui/exports.js:399-409`) — added by this round — calls
`initState()` + `restoreState(snap)` (both deferred `setValue`s) and then
reads `appState.party?.pc` **pre-tick**: that is the *old live campaign's*
PC. It reconciles it and writes it over the imported snapshot's party. Any
save imported (or slot loaded) while a campaign is live comes back with the
previous campaign's character. Same read-before-tick bug class at boot
(`main.js:203`, `:209-210`): the "never trust the persisted sheet"
re-derivation and the roleplay/autoplay settings restore **never run** —
appState is empty until the tick at line 251.

### F3 — Act closes strand in settlements; a failed generation kills the thread

The act-close queue (`story.js:34`, module-local) is drained only by the
dungeon/encounter turn loop (`loop.js:267`). `settlementLoop`
(`flow.js:453-477`) never calls `processTurn` — so an act whose final beat
completes on `settlement-reached`/`region-reached`/`visited-*` (all in the
generator's `completesOn` vocabulary, raised in `renderSettlement`) advances
`actIndex` and queues a close that is **never drained in town and lost on
reload**. The thread is left actless — `activeBeat()` null, the stall
detector blind by design (`acts.js:87-88`), no recovery path. If it was act
5, the epilogue never fires. Adjacent, same class: `onActClosed` returning
null (any `generateAct` failure, `loop.js:401-407`) after `actIndex` already
advanced — same dead thread, no retry, no re-queue.

### F4 — E9's spawn is invisible and its confront path unreachable

Two independent breaks in the round's emergence work, on top of F1:
- **Spawn:** `canon-commit.js:79-83` passes the *ledger-form* room id
  (`region.x.dungeon.y.room.room-3`) as the spawned npc's `roomId`; the scene
  filter, retaliation, and the vault gate all compare against
  `world.currentRoom` (`room-3`). The minted creature exists in `world.npcs`
  and **never appears, cannot be targeted, never retaliates** — and blocks
  `allEnemiesDead`. The `mintedId → resolveThreat` hook is therefore
  unreachable in dungeons.
- **Confront:** the settlement classifier's schema has no `confront` intent
  (`schemas.js:41`), the prompt maps unknowns to `look`, and the confront
  chip's value is plain text routed through that classifier — so when the AI
  *works*, "Confront the ghoul" becomes `look`. The regex that recognizes it
  lives only in the AI-failure fallback. `confrontThreat` itself and the
  encounter swap are correct; nothing can reach them.

---

## 4. Major findings (confirmed; not fatal to a loop today)

**Engine 2.5.0** — solid pass, oversold as totality; all five below
first-hand-probed:
1. `abilityCheck`/`savingThrow` accept a `bonus` that is applied but not
   recorded — an authentic log **fails its own `verifyLog`** (probe: recorded
   `success:true`, replay `success:false`, `divergedAt:0`). The one desync
   class the round missed. (Undeclared in `index.d.ts` too.)
2. Record-form condition apply skips the concentration break — the engine
   wrapper looks up `CONDITION_EFFECTS[condition]` with the raw argument
   (`engine.js:364`); `{name:'stunned'}` retains concentration where
   `'stunned'` drops it. One-line fix (`conditionName()`).
3. `castFromScroll` inverts the SRD: the DC check fires only for **on-list**
   casters; an off-list scroll succeeds unconditionally (probe: fighter +
   fireball scroll, worst rng → `ok:true, check:null`). Untagged deviation,
   pinned by a test.
4. The spell-list gate reads only `classId`: the engine's own
   `classes:{wizard:3,cleric:2}` multiclass shape bypasses it entirely, while
   `classId:'wizard'` + real cleric levels is *refused* cure-wounds.
5. The phantom-API class survives where the new conformance test doesn't
   walk: `Checks.toolCheck` and `turnStart/turnEnd → conditionSaves` are
   declared and absent at runtime. Plus: `RollEntry` omits ops this round
   added (`rngDraws`, `surprised`, `autoFailed`…), `useLegendaryAction`
   ignores `option.cost`, and `docs/roadmap.md:26-31` still lists shipped
   mechanics as missing.

**Client 0.2.0** — load-bearing math held under ~90 probes (IDB watermark
partition exhaustively verified; LLM deadlines leak-free; pipeline
checkpointing exact); four real defects:
1. **Mid-campaign act adoption reads as stalled** — nothing ever sets
   `startedAtTurn`, act close nulls `stallSince`, so `isStalled` measures
   act N>1 from turn 0 (probe: adopt at turn 200 → stalled at 201). One
   spurious "world reaches for you" nudge fires on the first turn of every
   act after the first.
2. The vault treasure is the one item that fails field pass-through: no
   `desc→description` mapping and `value:250` clobbers pool/domain values
   (probe: `description:null, value:250`). The campaign's goal object reaches
   the narrator descriptionless.
3. `fold(compact(x)) ≠ fold(x)` for out-of-order ledgers (compaction
   partitions by turn, fold applies by array order) — reachable only via
   imported/merged ledgers; the determinism comment overclaims.
4. Non-numeric `size` inputs crash the dungeon generator (`NaN` escapes the
   clamp); latent — the host passes computed numbers.

Also: `pathsConflict`/`mechanicalPathsOf` aren't re-exported from `index.js`;
the pipeline-resume machinery (`initialResults`/`onCheckpoint`/
`PipelineError`) and `appendPatch`'s `bases` are exported but consumed by
nothing in the shipped game — the round's two flagship resilience features
are wired to air. `beats.js` (8 exports) is fully superseded by acts and
consumed only by the MCP's `beats_*` tools.

**Game misc (beyond §3):** the GM beat directive also rides `scene.story`
into the *classifier* prompt (no save/UI leak; contract nuance);
`initAtlas`/`startCampaign` seed the atlas with `world.seed` which campaigns
store as the world *name* → `>>>0` = 0 → degenerate stub names; level-up
announcements print the previous level's stats (pre-tick read); the
`_timeTravel` branch/turn labels search for whole-array history entries the
narrow-write fix eliminated ("an earlier path" forever); four freshly
orphaned exports (`xpProgress`, `story.progress`, `travelDays`, `ai/_call`) —
the wiring test counts import *statements* as consumers, so dead imports
defeat it.

**MCP 0.1.0** — one overstated description (`monsters_elevate` promises save
scaling; `elevate()` never touches saves/abilities), two wording nuances
(`monsters_for_target_cr`'s null fires one CR below target too; temp HP is
bypassed at 0 HP vs "full SRD pipeline"), everything else — counts, versions,
CI, coverage, d.ts, all 63 descriptions — verified honest.

**Vendor system** — trees byte-identical to sibling HEADs; but the
fingerprint covers `*.js` only (`LICENSE`/`index.d.ts` unguarded) and
`vendor/spektrum.js` sits outside the manifest system entirely despite
CLAUDE.md implying coverage.

---

## 5. Closure of the 2026-08-08 table

14 CLOSED / 3 PARTIAL / 3 owner-open — every item traced to code on main by
the cross-repo agent, spot-confirmed first-hand (P0-1/5/6 personally):

- **CLOSED:** P0-1, P0-3…P0-8, P0-10, P1-1, P1-2, P1-4, P1-5, P1-8 (and
  P0-9 resolved by the owner earlier).
- **PARTIAL:** P0-2 (watermark + CAS + migration real; ledger cold segments
  still write-only in steady state — read by nothing but the migration);
  P1-3 (condition API real; "typecheck the implementation" not adopted —
  tsconfig still checks declarations only); P1-7 (all re-stamps done and
  verified accurate; the "stamps carry a commit" rule was never recorded).
- **OPEN, accurately:** P1-6 (content — now measured, see §6), P1-9 (publish
  + MCP role), P1-10 (owner decisions; 1 of 5 recorded).

Responsibility boundaries **held**: every fix landed in the repo the table
assigned, and the overlay-table duplication was retired to a true re-export.

---

## 6. Content capacity (measured)

Counted from the actual tables, loop modelled from the shipping turn engine:

- 84 unique creatures in the bestiary — **48 reachable** through any
  generation table; the other 36 include the *entire CR≥5 band* (nothing in
  the game can spawn a troll, giant, golem, or dragon except a GM mint).
- 24 themes × 5-slot pools yield **17 distinct bosses**; enemy count stays
  flat ~3 regardless of act while act-5 dungeons average 12.8 rooms.
- Every dungeon of a campaign hands out the **same domain treasure and key**
  — neighbour generation pins `godDomains`; the overworld encounter pool
  **ignores climate** (its own comment promises otherwise); 8×5 room
  descriptions and 6 dressings/theme start repeating around hour 1.5.
- One campaign ≈ **5–8 h** to the epilogue (~158 dungeon turns + towns +
  travel + overhead). Replay distinctness ≈ 2.5–3.5 campaigns →
  **~25–35 h** before structural repetition.
- 80 h ≈ twelve campaigns at current length: no plausible table expansion
  makes twelve campaigns distinct. The honest 80-h path is **layered breadth
  + longer campaigns** — which is exactly the owner-approved program in
  [doc 17](../ideas/17-layered-world-lod.md), whose province layer also
  absorbs the domain-pinning, climate, and CR-band findings structurally.

---

## 7. What to do now — priority order

P0 = broken or leaking today. Effort: S ≤ 1 day, M ≤ 1 week.

| # | Fix | Repo | Effort |
|---|---|---|---|
| P0-A | **Ledger append cursor** (survive the deferred-write window), pass `bases` to `appendPatch`, accumulate `refreshStaleDigests` writes | game | S |
| P0-B | **Strip credentials inside `_timeTravel`** on export AND import (root now; entries defensively) | game | S |
| P0-C | `resetAndRestore` reconciles the **snapshot's** pc; boot re-derivation + settings restore read the save object, not pre-tick appState | game | S |
| P0-D | Drain act closes in the settlement loop; **re-queue** on `generateAct` failure; re-queue dangling closes on resume (actIndex past acts, campaign incomplete) | game | S–M |
| P0-E | Spawn minted creatures with the **world-form** room id; add `confront` to the settlement classifier schema + prompt + normalize path (chip intercepted deterministically like fasttravel) | game | S |
| P0-F | Client: stamp the stall clock on act adoption/close; treasure field pass-through | client | S |
| P1-a | Engine: record `bonus` (and declare it); `conditionName()` in the effects lookup; scroll-gate HOUSE RULE decision (tag or fix); multiclass-aware gate; retire or implement `toolCheck`/`conditionSaves`; `RollEntry` union; `useLegendaryAction` cost; roadmap §"missing" | engine | M |
| P1-b | Wire or cut: pipeline resume in worldgen, ledger cold read-back, `xpProgress` status line, orphaned exports; wiring test to count *call sites* | game | S–M |
| P1-c | MCP: `monsters_elevate` description (or engine save-scaling); two wording nuances | mcp | S |
| P1-d | Vendor manifest: fingerprint all vendored files incl. `index.d.ts`/LICENSE; bring `spektrum.js` into the manifest | game | S |
| P1-e | The layered-world program (doc 17, phases A–E) — the 80-h path | client+game | L |

---

## 8. Closing calibration

On August 7 this was a 2–4-hour game wearing 80-hour documents. On August 8
it was a ~20-hour architecture with a fresh fatal regression and a defect
belt in the seams. On August 9 the architecture is real, the documentation
is honest, the libraries beneath it survive adversarial probing — and the
game layer that binds them carries four fatal seam defects and one credential
leak, none of which any of its 555 green tests can see, because they live
exactly where the tests stop: the reactive store's deferred writes, the
reload boundary, the id-space boundary, and the schema the classifier was
never told about. The pattern across three audits is now unambiguous: **this
codebase's failures concentrate at seams its test philosophy deliberately
mocks.** The next engineering investment that changes the slope is not more
unit tests — it is the integration layer this audit used: real-Spektrum
probes, real-storage round-trips, and an e2e that plays a campaign, not a
quick dungeon.
