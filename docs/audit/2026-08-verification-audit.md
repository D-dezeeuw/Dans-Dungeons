# Verification Audit — is the 80-hour campaign real?

> **Date:** 2026-08-08 · **Scope:** all four repos at HEAD (`Dans-Dungeons 163d014`,
> `bag-of-holding 39b7a7b` = v2.4.0, `bag-of-holding-client 7b0dea4` = v0.1.0,
> `bag-of-holding-mcp 70eb2e2`) · **Subject:** the
> [2026-08-07 comprehensive audit](2026-08-comprehensive-audit.md), the
> [implementation plan](2026-08-comprehensive-implementation.md) built on it, and the
> implementation passes of 2026-08-07/08 that the plan's execution log records as landed.
> **Method:** five adversarial verification agents (game showstoppers, engine, client
> toolkit, live-loop wiring, MCP + cross-repo), each tracing claims to `file:line` and
> refuting where possible; every fatal claim re-verified first-hand before inclusion;
> empirical proofs where reading was not enough (a 13,000-dungeon lock-bypass sweep, a
> cold-archive growth simulation, six replay-desync reproductions, a live OpenRouter
> catalog check of every configured model id). All four test suites were run
> (**2,503 passing, 0 failing**, exactly as claimed), the bundle rebuilt and diffed, and
> vendored copies byte-compared against their siblings. Nothing in this audit modifies
> code.

---

## 1. Executive verdict

The user's three questions, answered up front.

**Was the implementation plan any good?** Yes — as a planning artifact it is genuinely
strong, and better than most: complete traceability to the audit (every P0/P1 maps to a
story, §6 of the plan), a correct keystone choice (the world ledger unifies memory,
persistence shape, and emergence on one primitive), honest dependency ordering, pivot
valves, and an execution log that records measured numbers rather than adjectives. Its
failures are specific and named in §8 below: exit gates that depended on a harness that
was never built, no "a consumer exists" acceptance criterion until a follow-up pass
invented one, roughly five stories silently skipped without appearing in the plan's own
"what remains" list, and five owner decisions of which approximately one was actually
made.

**Is the implementation done correctly and coherently?** The work is *real* — this must
be said first, because the previous audit's worst discoveries were things that had never
existed at all, and that failure mode is mostly gone. All 2,503 claimed tests exist and
pass. All ten showstoppers from the previous audit are genuinely fixed or materially
improved (scoreboard in §4). The turn loop demonstrably carries the ledger, scope
packet, chapter memory, acts, XP, and canon extraction in the live path. The lock-and-key
fix survived a 13,000-dungeon adversarial sweep at exactly 0% bypass. Model healing was
verified against the live provider catalog today.

But it is not correct, and in places not coherent. Verification found **one fatal
regression and a belt of integration defects sitting precisely where the 2,503 green
tests do not look**. The headline: **at HEAD, the shipped game plays exactly one dungeon
turn per page load** — a `ReferenceError` introduced by the *presentation polish* commit
crashes the play loop after every successful turn (§2). Beneath it: the storage tier
built for 80 hours grows quadratically through duplication (§3.1), the ledger's core
"colour never overwrites truth" guarantee has two demonstrated holes (§3.2), the story
engine silently stops generating acts on its own designed common case (§3.3), and the
signature FarStay-ghoul loop is half unreachable in live play (§3.5).

**Is everything implemented for an 80-hour campaign?** No. Three different answers to
three different words in that question:

- **Architecture: yes, with defects.** Every subsystem the previous audit named as
  80h-gating (persistence split, narrative memory, world topology, story depth,
  progression) now exists, is wired, and is one focused fix-pass away from working as
  designed. That is a real transformation from August 7th, when none of them existed.
- **Content: no.** The structural variety is roughly what it was: one dungeon topology,
  one settlement loop, 48 creatures, 24 theme skins over the same room shapes, 8 room
  types. The plan's content-density stories (E6.S2 history layer and continents, E6.S4
  site archetypes and side-quests, most of E8.S3's economy) were silently skipped. The
  systems can *sustain* 80 hours; the material supports roughly 20–30 before the loop
  visibly repeats. The plan's own risk register predicted exactly this failure
  ("80h content still feels samey despite systems") and named the cut stories as the
  mitigation.
- **Validation: none.** Every milestone gate that required live play (M1's "the GM cites
  an hour-2 event at hour 9", M4's "scripted 80-hour playtest") has never been run.
  The milestones were reached in the code-complete sense only. Given what §2 found on
  the first simulated turn, this distinction is not academic.

**Do the repos keep their responsibilities?** Largely yes — the cleanest part of the
story (§6). The engine stayed pure, the client library owns the host machinery, the
vendoring is byte-exact with accurate manifests, and duplication is down to one table
and one test directory. The MCP server remains the laggard by design and by neglect at
once: its declared role was never implemented.

---

## 2. The game at HEAD: one turn per page load

**Every successful turn in the main dungeon loop ends the session.**
`src/game/flow.js:1353` executes `clearTimeout(stageTimer)` on the success path of
`playLoop` — but `stageTimer` is a `const` declared inside `runEncounterLoop`
(`flow.js:909`), a different function. In strict-mode ESM that is a `ReferenceError`,
thrown *after* the turn has committed and the narration has streamed: the player watches
the turn land, then the loop dies, the error propagates to boot's catch, and input is
dead until reload. Reload → resume → one more turn → crash again. Road-encounter
turns are unaffected (their loop has its own timer); every dungeon turn is affected.

Provenance: commit `1f27059` ("feat(ui): staged waiting, calm scrolling, and an
installable app" — the E10 *presentation* commit) added the staged-indicator timer to
the encounter loop and only the cleanup line to `playLoop`. The unresolved identifier
ships in `vendor/app.bundle.js` (exactly one un-minified `stageTimer` reference — esbuild
leaves free variables as-is).

Why 544 unit + 8 e2e green tests didn't see it: unit tests cannot reach `playLoop`;
the e2e turn test asserts the streamed narration text appears (it does — the crash
comes after) and attaches no `pageerror` listener; only the boot test listens for page
errors, and boot doesn't play a turn. `tests/wiring.test.js` does not help because it
checks name-presence, not execution (§7).

**The same extraction accident, four more times.** The `flow.js` split (commit
`7e77360`) moved the read-only views into `src/game/views.js` without carrying eight of
their imports. All confirmed unbound at HEAD, all crash at call time:

| Site | Unbound | What dies |
|---|---|---|
| `views.js:33` | `storyProgressNow` | `/story` view |
| `views.js:48` | `standing` | `/story` once any faction reputation exists |
| `views.js:117,119,122,126` | `tick`, `setStoryFlag`, `awardMilestone`/`announcementFor`, `saveToStorage` | quest resolution at the campaign victory gate — quest completion, faction reward, quest XP, chapter cut and return-to-town all throw |
| `views.js:141` | `goldOf` | the settlement "inventory" action |

`node --check` passes (unbound identifiers are runtime errors, not syntax errors), and
the wiring test *certifies* `views.js:122` as a valid consumer of `awardMilestone` —
a name-grep cannot tell a call site from a crash site.

The bitter symmetry with the previous audit is worth stating plainly: its headline was
"the default free tier cannot play a turn today." One implementation cycle later, after
every showstopper was genuinely fixed, **the game again cannot play (more than) a turn
today** — this time for all tiers, introduced by the polish epic, and shipped green.

---

## 3. The defect belt in the new systems

Everything in this section is empirically demonstrated or traced to a reproduction,
with the discovering evidence noted. Ordered by how hard each one blocks the 80-hour
goal.

### 3.1 The cold archive grows quadratically and corrupts the exports it serves

`saveToStorage` runs on every committed turn (`state.js:423` — `commit = makeCommit({
tick, save })`). Each save calls `splitSave` on the **live, never-trimmed** transcript
and archives everything except the last 50 entries as a **brand-new** IndexedDB segment
(`state.js:267-306` → `vendor/bag-of-holding-client/src/persistence/idb.js:127-146`).
Nothing persists the `archived` watermark the split emits (`archived` is not in
`PERSIST_KEYS`, `state.js:173`), so consecutive saves archive almost-identical
overflow slices forever.

Measured with the vendored module itself: **200 turns → 30,800 cold entries where 350
exist (88×); the first entry archived 175 times.** Independent reproduction by a second
agent: 40 turns → 4.0× duplication; after one reload + 10 turns, a single entry appears
15 times. Extrapolated to the 80h target (~2,400 turns): **~5.6M cold entries, ~2.3 GB.**
`fullTranscript()` (`state.js:310-314`) flattens all of it — so the journal EPUB and the
world bible of any campaign past ~25 turns are woven from massively duplicated history.
Two aggravators from the library side: a failed IndexedDB write **returns success**
(`idb.js:50-63` — `wrap` resolves `null` on error, `coldPut` reports `true`; the silent
quota failure this tier exists to eliminate is back), and `appendSegment` derives the
next index from the *count* of keys, so any prune-then-append overwrites the newest
segment (`idb.js:100-106`). The ledger's cold segments, meanwhile, are **write-only** —
`readSegments` is called for `'transcript'` only; nothing ever reads the archived ledger
back.

Why the suites are green: the client's `idb.test.js` appends only disjoint batches (and
its own test at `:156-163` demonstrates the intended feed-the-hot-back-in usage the app
doesn't follow); the game's `save-growth.test.js` never touches the cold tier.

### 3.2 The ledger's precedence guarantee has two demonstrated holes

The keystone promise — *mechanical truth beats canon colour* — is enforced by exact
path-string comparison only (`vendor/bag-of-holding-client/src/ledger/patch.js:95-104`
at append, `:63-73` at fold). Two proven bypasses:

1. **Path granularity.** A canon patch on a *parent* path replaces everything beneath
   it: dice set `stats.hp` to 2, a later canon patch on `stats` folds to 9. The
   narrator can un-wound a goblin by writing one level up.
2. **Compaction erases the protection.** `compact()` (`patch.js:152-168`) folds stale
   local patches into base *beneath* kept patches, reordering history and discarding
   the mechanical `kind`: after a chapter-close compaction (the game compacts every
   chapter, `chapters.js:122`), a previously-rejected contradiction *appends and
   wins* (measured: hp 2 → 99). The module's own contract comment (`:149-151`) and its
   round-trip test use disjoint paths only, so the suite cannot see either hole.

Related: `setPath` spreads arrays into plain objects (an inventory list `['sword',
'rope']` becomes `{"0":"axe","1":"rope"}` after a patch through index 0) and accepts
unvalidated LLM-supplied paths including `__proto__` segments (`patch.js:41-52`).

### 3.3 The story engine stops at its own designed common case

Three compounding defects around act progression:

- **Flag-completed final beats close the act into silence.**
  `autoCompleteFlaggedBeats` (`story.js:34-39`) discards the `{actClosed}` result, and
  `onActClosed` — the only place the next act is generated (`loop.js:376-382`) — is
  reachable only from the narration-judged path, which sees `activeBeat() === null`
  after the act already closed and returns. An act whose last beat completes on a
  mechanical flag (`completesOn: ["boss-slain"]` — the *designed* fast path the plan
  celebrates) never generates a successor. The campaign's story silently stops; the
  stall detector can't fire either (no active beat). The same helper reads
  `completesOn` (an array per the schema) as a scalar property key, so only
  single-element arrays ever match on this path.
- **Two of the six whitelisted completion flags are phantoms.** The act-generation
  prompt offers `settlement-reached` / `region-reached`; nothing in the game raises
  either (arrival raises `visited-<regionId>`, `flow.js:347`). Arrival beats can never
  flag-complete — and `tests/intent-coverage.test.js` whitelists the phantom flags, so
  it enforces the defect.
- **The payoff ledger is an orphan.** `plantClue`/`payClue`
  (`acts-runtime.js:77-84`) have zero callers, so `activeSetups` (narrator context) and
  `unpaidSetups` (act generation) are permanently empty — while both prompts carry
  standing instructions about them. Foreshadowing, the plan's E7.S4, runs on an empty
  list. Additionally, the client-side stall detector rearms against turn 0 whenever any
  flag is raised (`narrative/acts.js:49-52` + `:73-77` — `stallSince: null` read as 0),
  producing spurious "the world comes to the player" escalations, and an act
  deadlocked by unmeetable `requires` flags reads as *not* stalled forever — the
  hardest-stuck state is the one escalation cannot see.
- **After the finale, nothing.** When act 5 completes, `onActClosed` returns null and
  play drifts on actless — no epilogue, no completion state. The plan's promised
  epilogue renderer ("where are they now", from the ledger) was never built. This is
  the previous audit's "completing the last beat changes a progress line" defect, one
  level up.

### 3.4 Chapters — and therefore clocks, compaction, and memory — gate on one event

`markChapterBoundary` has exactly one call site: dungeon-clear victory
(`flow.js:1414`). The other designed triggers (region change, act transition, safe
rest, the 40-turn backstop in `chapters.js:83-86`) are dead reasons — the backstop is
unreachable because the cut condition is only ever *evaluated* at dungeon-clear. A
campaign that wanders, roleplays in town, or ignores dungeons never cuts a chapter:
world clocks never tick, the ledger never compacts, and long-term memory stays a single
rolling digest forever. (`titleChapter` also has zero callers — every chapter is
"Untitled Chapter N".)

### 3.5 The FarStay ghoul is mintable but not fightable

The signature E9 loop runs its front half live (extraction → validation → mint with
stat-block binding → threat clock armed → rumours in settlements). The back half has no
code path: **minted creatures are never spawned into `world.npcs`** — and the resolver
only fights `world.npcs` — so a minted ghoul exists in the ledger and nowhere the
combat system can reach; consequently *resolution* rewards (XP, reputation, the
journal-citable ledger entry) can never trigger. Escalation writes only
`escalated: true` (no reputation hit, no victim, no digest mention), clock *pressure*
on encountered-but-ignored threats never applies (`world-clocks.js:34` looks up dotted
entity ids in a map keyed by underscore-encoded ids), and `staleDigests` — the
mechanism meant to refresh digests when the world changes — has no consumer.
`tests/ledger-memory.test.js` covers the acceptance script by *hand-writing the ghoul's
patches and escalation ticks* against the vendored primitives; it never executes
`extractCanon`, `commitCanon`, `armThreatClocks`, `tickWorldClocks`, or a fight. The
acceptance script the plan calls "the demo that proves the vision" is covered
end-to-end by nothing and is not currently playable.

### 3.6 Progression: real XP, broken details

Kill XP (CR-based), milestones, and level-up re-derivation are live. But: **level-up
heals to the previous level's maximum** (`progression.js:59` reads the sheet before
`tick()` — Spektrum defers writes), **loot never carries its mechanical fields into
live play** (the dungeon generator copies `{id, name, description, taken}` and travel
loot `{id, name, description, quantity}`, stripping `heals/gold/value/lore` — so the
`use` machinery, E8.S3's centerpiece, is unreachable from generated content; the test
covers the i18n pool and the resolver but not the pass-through), beat completion awards
no XP (`MILESTONE_XP['beat-completed']` has no call site), and quest XP crashes (§2,
`views.js:122`). Spellcasting is the strongest E8 delivery: slots spent through the
engine, attack-vs-AC and save-vs-DC both correct, cantrip scaling, upcasting, and slots
that only return on a long rest — all confirmed.

### 3.7 Smaller but load-bearing

- **Save-slot loading is a silent no-op** (`exports.js:381-389`): restore + reload
  without `commit()`, so the reload boots the untouched autosave. Six slots that save
  and never load.
- **Importing a save over a live campaign contaminates both** (`exports.js:99`):
  Spektrum's `deepMerge` unions `world.npcs/rooms/settlements/dungeons/quests` and
  `flags` from the two campaigns, then commits the blend. (Boot-time import is clean
  only because `initState()` resets first.)
- **Stealth still contradicts** (`loop.js:176-185`): only a successful *flee*
  suppresses retaliation; a successful stealth check still eats the counter-attack —
  the exact contradiction the previous audit flagged, whose fix both a code comment and
  a test header now (incorrectly) describe as done.
- **Scope budget theater**: the assembled packet's here/world/region/memory slices are
  discarded — `buildScene` rebuilds its own unclamped versions (`loop.js:41-120`), so
  the token budget applies to an object that mostly doesn't reach the prompt, and
  `tests/scope-budget.test.js` asserts a hand-built fixture, never `assembleScope`.
- **The world bible's acts chapter never renders** (`worldbible.js:54` reads
  `world.acts.acts`; acts live at `world.thread`) — the "documents the campaign being
  played" fix works for regions and the Chronicle but reports the stale act-1 beat
  list in the colophon. Two more legacy readers (`views.js:62`, `flow.js:968`) still
  read `world.redThread.flags` while live flags land in `world.thread.flags`.
- **Mixed-language failure on locale switch** remains (owner decision 4, never made),
  the client's image path reports tokens but never cost (the 47×-cost tier the meter
  was built to expose shows $0.0000), auto-retry retries non-retryable 402/403/404/413
  and never auto-retries retryable 5xx/network, `initAtlas` (the migration path that
  would give pre-atlas saves a geography) is imported and never called, and re-travel
  toward an already-hydrated stub without a known `targetId` re-runs AI region
  generation over it.

### 3.8 Engine-side: the increment that wasn't

The engine's v2.3.0/2.4.0 work is largely real (six rules fixes confirmed, restore
fixed, purity intact) with four significant exceptions:

- **Replay totality is still not total.** Six RNG paths desync `verifyLog`, each
  empirically reproduced from a clean engine-recorded log: surprised initiative (which
  the fix's own comment lists as fixed — two d20s drawn, one recorded), auto-failed
  saves under paralysis/stun, stable-regen hours, Halfling Lucky, `rerollFailedSave`,
  and scroll-cast checks.
- **The condition-record API is phantom**: `conditionName`/`conditionsRequiringSave`
  exist only in `index.d.ts`; at runtime they are `undefined`, and record-form
  `apply` throws. The execution log claims this restoration; it never happened.
  `npm run typecheck` is green because `tsconfig` checks the declarations against
  `tests/types` only — never against `src/` — so declaration drift is structurally
  invisible.
- **"One rules edition" is still two editions.** Real moves to 5.2 happened
  (half-caster L1, rage cap, structured components), but the goblin still has 2014's
  7 HP under a file header claiming SRD 5.2, the orc (not in SRD 5.2) still ships,
  prepared-spell counts use the 2014 formula under a 5.2 docstring, Fighter Second
  Wind's refresh matches *neither* edition (and contradicts its own comment), and
  there are zero `HOUSE RULE` tags repo-wide — the labeling rule the audit asked for.
  The repo itself concedes the point: `monster-templates.js:9` ("the bestiary already
  suffers from edition drift") was written *after* the "one rules edition" commit.
- **Legendary actions are dead-on-arrival ecosystem-wide**: `useLegendaryAction` looks
  up `legendaryActions.options[].id`; the tier templates — the only mechanics-block
  producer in the package — emit `legendaryActions.actions[]` keyed by `name`. Every
  option lookup returns "unknown legendary option" (proven for every variant). A CR-22
  Ancient boss has legendary actions it can never use. The template test checks pool
  sizes and never calls the consumer. Spell lists (2.4.0) are similarly correct data
  that nothing consumes: `castSpell` performs no class-list check (a wizard casts
  cure-wounds, `ok:true`), and the one function that wants the data still takes a
  caller-supplied boolean.
- One more gate-eroding find: `tests/death-saves.test.js:364-371` rolls an unseeded
  d20 and asserts an outcome enum that omits the natural-20 `'revived'` — **the engine's
  CI gate fails ~5% of runs by dice**, observed twice in ~40 suite runs during this
  audit.

---

## 4. Previous-audit showstopper scoreboard

All ten, re-verified at HEAD:

| # | Was | Now | Evidence |
|---|---|---|---|
| S1 dead models | **FIXED** | Boot healing of persisted maps (`session-setup.js:184-197`, ordered after restore); chain walks 429/400/404 on both call paths; weekly canary; every configured id verified live against today's catalog | agent + live run |
| S2 dead chips | **FIXED** | Containers in markup; DOM-contract test both directions; shop prints numbered wares, accepts "buy 3"/"koop 3"; free-text fast travel on both classifier and offline paths; e2e-covered | agent + e2e |
| S3 encounter brick | **FIXED** | `world.encounterReturn` in-save; `resumeEncounter` route restores on win/flee/defeat; JSON-roundtrip regression test with a covers-every-mutated-field invariant | agent |
| S4 quadratic saves | **FIXED at the hot tier** — narrow appends, loud health, honest `/save`, quota warning, corrupt-save quarantine. **Re-broken one tier down** (§3.1) | agent + measurement |
| S5 replay | **IMPROVED, not total** — 4 new ops handled, 7 sites now record; six proven desyncs remain incl. one the fix claims (§3.8) | 6 reproductions |
| S6 vendor chimera | **FIXED** | Byte-identical vendoring, accurate manifests, CI drift check. Residue: Spektrum has no provenance/license text and sits outside the manifest regime; `--check` verifies fingerprints only | agent + diff |
| S7 two editions | **PARTIAL** — real 5.2 moves; monsters/prepared-counts/Second Wind still 2014-or-neither; zero HOUSE RULE tags (§3.8) | agent |
| S8 embedded key | **FIXED at HEAD** — no credential anywhere incl. bundle; real PKCE + state; `?key=` gone; export/import strip credentials. **The old key is still recoverable from public git history (commit `42dc51d`) and revocation at OpenRouter remains pending owner action** | agent |
| S9 no CI | **FIXED** — all four repos gate tests for real; game adds vendor-drift + stale-bundle + e2e + weekly canary. Residue: engine Pages deploy has no `needs: test`; game Pages deploys the pushed branch regardless of CI | agent |
| S10 decorative lock | **FIXED** — graph cut confirmed at 0.00% bypass / 0 soft-locks over 13,000 dungeons across five adversarial sweep shapes | empirical |

This table is the good news, and it is genuinely good: the ten worst things about the
August 7th codebase are, as a class, gone.

---

## 5. What the epics actually delivered

Against the plan's own stories. **Landed** = verified working in the live path;
**partial** = landed with defects above; **skipped** = not built, and *not* recorded in
the plan's "what remains" list unless noted.

| Epic | Verdict |
|---|---|
| E0 truth & safety | Landed, **decayed within a day** — licensing/CI/key-removal real; doc stamps and CLAUDE.md now under-claim (written pre-implementation, never re-stamped); free-tier decision made in code but never recorded in doc 05 as required; engine roadmap header still four releases stale |
| E1 stop the bleeding | **Landed** (S1–S4, S10 above) |
| E2 world ledger | **Partial** — primitives + live wiring real; precedence holes (§3.2); movement and all flow-level events (purchases, reputation, arrivals, completions) emit zero patches; envelope v3 and the undo/ledger unification silently dropped (SAVE_VERSION=2, `_timeTravel` spine retained); the exit-gate replay test ("200-turn session replays from seed+base+ledger") does not exist |
| E3 storage | **Partial** — hot slice + IDB + degradation real; archive quadratic-duplicating, silently failing, write-only for ledger (§3.1) |
| E4 chapters | **Partial** — digests/window/recap real; boundaries gate on dungeon-clear only (§3.4) |
| E5 scope + intents | **Partial** — gmOnly separation real and pinned; budget applies to a discarded object; stealth contradiction still live; noEffect is one generic rule rather than per-intent |
| E6 atlas | **Partial** — graph, stubs, hydration, /map, rumours real; clock pressure dead (id-encoding mismatch), ticks gated on §3.4; **E6.S2 (history layer, continents, dungeon origin tags) skipped silently; E6.S4 (site archetypes, side-quest generator) skipped silently** |
| E7 red line | **Partial** — acts runtime live with flag-primary completion; act-transition drop, phantom flags, orphaned payoff ledger, no epilogue (§3.3) |
| E8 progression | **Partial** — XP/level-up/casting real; level-up heals to old max, loot fields stripped in live play, quest XP crashes; **economy beyond the inn (brokers, gear sinks) skipped silently** |
| E9 emergence | **Partial** — front half live, back half unreachable (§3.5) |
| E10 presentation | **Landed** as chrome (indicator, scroll, PWA, a11y, pickFrom, spacebar) — **and its commit is what broke the game** (§2) |
| E11 quality | **Partial** — validators + prompt-contract suite real and live; wiring test is a name-grep; scope/loot/FarStay tests assert fixtures or mirrors rather than the integration; E11.S3 (the eval harness every soak-shaped gate depended on) not built, honestly recorded |
| MCP (E11.S4) | **Tools tranche only** — 55 tools incl. spellcasting/monster-tiers; still cannot look up a monster directly (the `monsters` registry is missing from the SRD tool enum — the "look up a goblin" gap survives on a one-line omission), cannot apply damage or rest an actor; no `engine_verify_session`, no encounter simulation, no balance workflow; README claims 46 tools and carries install instructions for an unpublished package |

---

## 6. Repo responsibilities — held, mostly

- **bag-of-holding (engine):** boundary held. Zero deps, no host APIs, single ESM
  surface, 99%+ coverage discipline intact. Its failures are internal honesty failures
  (phantom typings, edition labels, comments promising one increment more than the
  code performs), not boundary failures.
- **bag-of-holding-client:** boundary held and it is where it should be — ledger,
  persistence, geography, clocks, acts, LLM client all live here, config-injected,
  node-tested; the game consumes rather than reimplements. Its failures are contract
  failures inside owned modules (§3.1, §3.2, stall detection, deadline gaps).
- **Dans-Dungeons (game):** consumes the libraries properly; its failures are wiring
  failures (§2, §3) — precisely the layer that has no owner between "library unit
  tests" and "does the game run".
- **bag-of-holding-mcp:** the only repo whose *decided role* (the plan's E11.S4
  balance harness) was simply not implemented. It tracks the engine's new surface
  partially and its README overstates. Honest options remain the same as in August:
  finish the harness role, or park it with an honest README.
- Residual duplication: the 24-theme `DUNGEON_OVERLAYS` table exists verbatim in both
  the client and the game with **no parity test** (and the game's CLAUDE.md falsely
  calls its copy a re-export); `tests/worldgen/` still carries ~1,900 lines of
  mirror/fixture tests the plan said to retire — now re-blessed as a "convention"
  instead. One beat runtime is live (the client's acts), but the plan's chosen owner
  (the engine's) sits exported-and-unconsumed alongside a second client evaluator.

---

## 7. Why 2,503 green tests missed all of this

The most transferable lesson of this audit. Six named blind spots, each of which let a
specific defect ship:

1. **Name-presence as wiring proof.** `wiring.test.js` greps for the symbol name in
   other source files. An unused import passes it (`initAtlas`), a comment passes it,
   and an *unbound identifier at a crash site* passes it (`awardMilestone`,
   `views.js:122`). It answers "is the name mentioned?", not "does the system run?"
2. **E2E that asserts output, not health.** The turn test watches for streamed text
   (which arrives before the crash) and never listens for `pageerror`. One line —
   `page.on('pageerror', …)` — or a second played turn would have caught §2 on the
   first CI run.
3. **Mirror and fixture tests.** The FarStay suite hand-writes the patches the real
   pipeline should produce; the scope-budget suite asserts a hand-built packet; the
   loot suite tests the pool and the resolver but not the generator that strips the
   fields in between. Green tests, untested seams.
4. **Typecheck that never sees the implementation.** The engine's `tsconfig` checks
   `index.d.ts` against type-fixtures only, so declarations drifted into fiction
   (§3.8) under a green gate.
5. **Library tests that stop one call short.** `idb.test.js` proves `appendSegment`
   works on disjoint batches — the app feeds it overlapping ones. The template test
   proves the legendary *pool* fills — never that an elevated block's action can be
   *used*. The interaction is where four of the worst defects live.
6. **A flaky gate teaches people to ignore red.** The engine's unseeded death-save
   test fails ~5% of runs on a natural 20. A gate that cries wolf weekly is a gate
   nobody believes the day it matters.

The fix-shape for all six is the same discipline: **test the seam, not the parts** —
one Playwright run that plays five turns with `pageerror` fatal, one integration test
per cross-module contract (split→archive→read-back; extract→mint→spawn→fight;
elevate→useLegendaryAction), and gates that run the real pipeline instead of a
hand-built imitation of it.

---

## 8. The plan, judged as a plan

**What it got right** (worth repeating in future planning): tracing every story to
audit evidence; choosing the ledger as the keystone and being right about it; pillars
with a precedence rule that demonstrably shaped code; pivot valves decided *before*
they were needed; an execution log with measured numbers ("13.05 MB → 294 KB");
recording deferrals with reasons.

**Where it failed:**

1. **Gates that couldn't gate.** E5's exit gate was measured by the E11.S3 harness —
   which was never built. M1 and M4 require live play nobody ran. A gate that cannot
   be evaluated is a wish; every "milestone reached" claim in the log is really
   "milestone's code merged".
2. **No consumer criterion until it was too late.** The first pass rebuilt the
   audit's own antipattern (built, tested, exported, called by nothing) and the cure —
   `wiring.test.js` — was itself built to the weakest possible standard (§7.1).
3. **Silent scope drops.** The log's "what remains" lists four items; reality is
   roughly nine (E2.S4 envelope v3, E6.S2, E6.S4's sites/side-quests, E7.S2's
   epilogue, E8.S3's economy, plus the locale policy). A plan whose completion record
   under-reports its own cuts loses the property that made it valuable — you could
   trust it.
4. **Owner decisions treated as optional.** Of five explicitly blocking decisions,
   one (edition) was executed — partially. The free-tier decision was implemented but
   never recorded where the plan required; the pivot was de-facto made by skipping
   E6.S2 without ever being chosen.
5. **Speed without the plan's own verification cadence.** The plan assumed playtests
   at M2/M3 as checkpoints. Execution compressed months into two days and skipped
   every checkpoint that needed a human at a keyboard — which is exactly where §2
   would have been caught in minutes.

---

## 9. What to do now — priority order

P0 = the game is broken or lies to the player today. P1 = gates the 80h goal.
Effort: S ≤ 1 day, M ≤ 1 week.

| # | Fix | Repo | Effort |
|---|---|---|---|
| P0-1 | `stageTimer` + the eight unbound `views.js` identifiers; add `pageerror`-fatal + a multi-turn scenario to e2e | game | S |
| P0-2 | Cold archive: persist the `archived` watermark, slice only new overflow, or trim live state post-archive; make `coldPut` report real failure; max+1 segment keys; read-back or delete the ledger archive; an integration test that saves twice | game+client | S–M |
| P0-3 | Ledger precedence: prefix-aware conflict gate (both directions); compaction that preserves kind/order on shared paths; array-safe `setPath` with path validation | client | M |
| P0-4 | Act flow: honor `actClosed` on the flag path; fix `completesOn` array handling; replace phantom flags with `visited-*` equivalents (or raise the promised ones); wire `plantClue`/`payClue`; an epilogue/campaign-complete state | game | M |
| P0-5 | Chapter boundaries: evaluate `shouldCutChapter` per turn (backstop), add region-change/act-close triggers | game | S |
| P0-6 | Slot load commit; import resets before restore (or routes through the boot path) | game | S |
| P0-7 | Spawn minted creatures into `world.npcs` (+attitude); fix clock-pressure id encoding; give escalation its promised patches | game | M |
| P0-8 | Loot field pass-through (generator + travel); level-up max-HP read-after-tick | game+client | S |
| P0-9 | ~~Revoke the leaked OpenRouter key~~ **Resolved 2026-08-09**: owner confirms the key was already replaced and was free-tier only. The BYOK decision is recorded in `docs/ideas/05-ai-runtime.md`. | owner | done |
| P0-10 | De-flake the death-save test (seeded rng or complete enum) | engine | S |
| P1-1 | Replay: record surprise initiative + auto-failed saves + the four unlogged draw sites | engine | M |
| P1-2 | Legendary-action shape fix (`options[].id` vs `actions[].name`) + a use-on-elevated test; integrate spell lists into `castSpell` | engine | S–M |
| P1-3 | Implement or delete the phantom condition-record API; typecheck the implementation, not just the declarations | engine | S–M |
| P1-4 | Stealth-success suppresses retaliation (extend the flee rule) | game | S |
| P1-5 | Make `assembleScope`'s output the actual narrator packet (or move the budget to what ships) | game | M |
| P1-6 | Content density: this is now the long pole for 80h — E6.S2/E6.S4/E8.S3 or a deliberate, recorded pivot to a denser-but-smaller world | game+client | L+ |
| P1-7 | Re-stamp the docs (ideas 03/04/06/07/12, CLAUDE.md module map + persistence, README's three stale claims, engine roadmap header, MCP README) — and adopt a rule that stamps carry the commit they describe | all | S–M |
| P1-8 | World-bible acts path (`world.thread`), legacy `redThread.flags` readers, `initAtlas` call for old saves, world-clock tick triggers | game | S–M |
| P1-9 | Publish engine 2.4.0 (MCP's declared peer is uninstallable); decide the MCP's role for real | engine/mcp | S + owner |
| P1-10 | The five owner decisions, recorded where the plan said they go | owner | S |

A serious hour-estimate for "80 hours of coherent play": after P0 (≈2–3 weeks of
focused fixes), the systems support long play honestly; with today's content the
experience is ~20–30 hours before structural repetition; P1-6 is the remaining
distance, and it is content work, not architecture.

---

## 10. Closing calibration

On August 7 this project was a well-engineered 2–4-hour game wearing 80-hour design
documents, with ten showstoppers and four missing subsystems. On August 8 it is a
well-engineered ~20-hour architecture wearing a fresh fatal regression, with zero
missing subsystems, ten fixed showstoppers, and a defect belt concentrated in the seams
between freshly-built parts. That is real progress — the plan's own 4–6-month
solo estimate landed in substance in two days, and the foundations (determinism, atomic
turns, the ledger idea, the test discipline where it aims at the right target) remain
excellent.

But the discovery that closes this audit is the same one that opened the last: **every
layer of this project's quality machinery can be green while the game cannot play a
second turn.** Until a played turn — not a passed suite — is the definition of done,
each pass will keep shipping its own S1. The cheapest fix in this entire document is
one Playwright line and a second turn; it would have caught the worst finding here,
and it is the first thing to write.

---

*Method note: verification performed by five parallel adversarial agents over the four
repos, with every fatal or headline claim independently re-verified by hand before
inclusion (the `stageTimer` crash, the unbound `views.js` identifiers, the cold-archive
math, and the model-catalog liveness were each confirmed twice by different methods).
Empirical artifacts: 13,000-seed dungeon sweep, 200-turn archive simulation, six
replay-desync reproductions, live OpenRouter catalog check (2026-08-08). Companion
documents: [2026-08 audit](2026-08-comprehensive-audit.md) ·
[implementation plan](2026-08-comprehensive-implementation.md).*
