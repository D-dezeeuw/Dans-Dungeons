# Implementation Plan — the 80-Hour AAA Campaign

> **Date:** 2026-08-07 · **Basis:** [`2026-08-comprehensive-audit.md`](2026-08-comprehensive-audit.md)
> (synthesis) and [`2026-08-comprehensive-audit-appendix.md`](2026-08-comprehensive-audit-appendix.md)
> (212 findings, 146 recommendations). Every story below traces to audit evidence; showstopper
> IDs (S1–S10) and priority IDs (P0-x/P1-x) refer to the synthesis §2 and §10.
> **Structure:** Epics (phases) → Stories (features) → Tasks (to-dos). Estimates are
> solo-dev: **S** ≤ 1 day · **M** ≤ 1 week · **L** ≤ 1 month · **XL** > 1 month.

---

## 0. The goal, in one paragraph

One campaign, one **red line** the player can always find their way back to — and total
freedom to walk away from it. The world unfolds wherever the player goes: seeded structure
decides *what is there*, the LLM Game Master decides *what it's like*, and **everything the
GM invents becomes canon** — persisted, addressable, and true forever. The moldy curtains
the narrator improvised on the castle walls in hour 3 are still moldy in hour 60 (unless
someone washed them, and then the ledger knows who). The ghoul terrorizing the toilets of
the FarStay Inn is not a throwaway line: the moment the GM speaks it, it gets an ID, a stat
block from the bestiary, a home (`settlement.farstay.inn.privy`), a clock (it gets worse if
ignored), and a place in the region digest — findable, fightable, and remembered whether the
player deals with it in hour 4 or hour 44. Eighty hours of that, at AAA presentation
quality, on a static site with the player's own key.

## 1. Design pillars (the six laws)

Every story in this plan serves at least one. When two conflict, the lower number wins.

1. **The engine is the ground truth.** Dice, damage, deaths, doors: deterministic, seeded,
   replayable. The LLM narrates outcomes; it never decides them. Precedence everywhere:
   *mechanical > canon > base*.
2. **Nothing spoken is forgotten.** Base (seeded + persisted-once LLM hydrations) ⊕
   append-only patch ledger = current world. Every fact has an owner ID; every change has a
   turn, a cause, and a scope.
3. **The GM sees exactly enough.** Scope-assembled context per turn — here in full, nearby
   in sense-impressions, region/world as fresh digests, plus what *this* player knows.
   Budgeted, cache-friendly, secrets filtered.
4. **The red line is a spine, not a rail.** Acts → beats, cast onto real NPCs and places,
   with failure states and payoffs. The player can ignore it for 20 hours; the world moves
   and the spine adapts, but it never breaks.
5. **Structure is seeded; flavor is generated; both persist.** Same seed → same world
   skeleton, deterministically, forever. LLM prose is generated once, stored, and never
   silently regenerated.
6. **Fail loudly or recover silently — never both silently.** Every error path either heals
   itself or tells the player what happened and what to do. (The audit's "silent failure as
   house style" ends here.)

## 2. How to read this plan

- **Epic (phase)** = a coherent capability with an exit gate. Epics are ordered by
  dependency, not importance; E2 is the keystone.
- **Story (feature)** = shippable slice with acceptance criteria. Format `E<n>.S<m>`.
- **Task (to-do)** = checkbox-level work item, with file references where known.
- **Gate** = what must be demonstrably true before the next epic leans on this one.
- **Pivot valve** = what to cut or shrink under audit §8's pivots (1 = hub-and-spoke,
  2 = episodic, 3 = authored spine). Stories without a valve are vision-independent.

### Execution log

> Updated as work lands. Story IDs link back to the epics below.

| Date | Landed | Status |
|---|---|---|
| 2026-08-07 | **E0.S1** shared key | Embedded XOR credential deleted; demo key is build-injected (`DD_DEMO_KEY`), default `null` → stock builds are BYOK-only. **Owner action still required: revoke the old key at OpenRouter** — it shipped publicly and must be treated as compromised. Proxy decision still open. |
| 2026-08-07 | **E0.S3** licensing | `LICENSE` (MPL-2.0) + `NOTICE`; SRD 5.2 / CC-BY attribution in the sidebar and README; trademark claim dropped. |
| 2026-08-07 | **E0.S4** CI | `ci.yml` (tests + vendor manifest + build + stale-bundle guard) in the game repo; weekly `model-canary.yml`. Sibling-repo workflows still to add. |
| 2026-08-07 | **E1.S1** models | Live-verified tables; boot healing against the catalog (fixes stale persisted maps); fallback walk on any swappable 4xx with the whole chain tried; `chatStream` gains the chain; `usage.cost` → real spend. 14 new library tests. |
| 2026-08-07 | **E1.S2** chips | Containers added; shop prints its wares (and accepts list numbers); fast travel gets a real free-text path; `dom-contract.test.js` makes the class of bug unshippable. |
| 2026-08-07 | **E1.S3** encounters | Swap snapshot persisted as `world.encounterReturn`; `resumeGame` has an `encounter` route; pure `encounter-state.js` + 9 tests. |
| 2026-08-07 | **E1.S4** persistence | Narrow transcript/roll-log writes: **13.05 MB → 294 KB of history at 200 turns**, linear thereafter. Save health broadcast, honest `/save`, quota pressure warning, corrupt-save quarantine. 6 tests. |
| 2026-08-07 | **E1.S6** vendoring | `scripts/vendor-sync.js` + `VENDOR.json` manifests + `--check` in CI; engine re-vendored 1.16.0-chimera → 2.1.0. |
| 2026-08-07 | **E1.S7** partial | Lock-and-key is a real graph cut (**68.7% → 0% bypass**, 0 soft-locks, 400-seed test); credentials stripped from save export and ignored on import; `app.version` excluded from SW cache; `castSpell` no longer burns a higher slot for a lower-level effect. |
| 2026-08-07 | **E0.S2** docs | Every `docs/ideas` file stamped CURRENT / PARTIAL / DOC-ONLY / STALE with an audited one-liner; CLAUDE.md module map, tier table, vendoring, licence and test sections corrected. |
| 2026-08-07 | **E2** world ledger | **The keystone.** base ⊕ append-only patches ⊕ views, hierarchical entity ids, mechanical-beats-canon precedence enforced at append and at fold, dirty-digest tracking, deterministic compaction. Wired into the turn loop: the resolver writes ground truth, a tiny-tier pass extracts what the narration asserted, and minted creatures bind to real stat blocks. |
| 2026-08-07 | **E4** chapters | Rolling digest (tiny tier, every 6 turns) + frozen chapter digests at story boundaries; narrator window 3 → 14 entries plus all prior chapters; "Previously on…" recap; chapter close compacts the ledger. Narrator contract v2: anti-invention rules, no-effect handling, world tone threaded. |
| 2026-08-07 | **E5** scope | Scope assembler (here/nearby/region/world/memory/known) with per-tier token budgets proven in CI, stable-first ordering for prefix caching, and a `gmOnly` slice so secrets stop riding in the object the UI reads. Intent gap closed: rest, flee, use and look mechanized; everything else declares `noEffect`. |
| 2026-08-07 | **E6** atlas | Geography as a graph with seeded stub neighbours (world feels endless, costs O(visited)); `routeBetween`, known-vs-rumoured map. Clocks advance at chapter boundaries with extra pressure on threats the player ignored. |
| 2026-08-07 | **E7** red line | Acts above beats, generated one at a time from what actually happened; flags as the primary completion signal; stall detection so a thread escalates instead of freezing; payoff ledger turning a planted clue into an obligation. |
| 2026-08-07 | **E8.S1** progression | XP from CR on kills plus milestones; level-up re-derives the sheet through the engine and heals to the new maximum. The engine's XP tables had shipped long ago with **zero call sites**. |
| 2026-08-07 | **E9** emergence | Entity minting from narration with dedup and stat-block binding; detail persistence served back with the room; threat clocks and rumour surfacing. The FarStay-ghoul acceptance script is covered by tests. |
| 2026-08-07 | **E10** presentation | Staged thinking indicator with elapsed time; stick-to-bottom scrolling; web app manifest + theme colour + apple-touch-icon; iOS input-zoom fix; focus-visible outlines; contrast/size floors; reduced-motion honoured. |
| 2026-08-07 | **E11** quality | Prompt-contract regression suite (locale parity, placeholder parity, prompt↔schema agreement, strict-mode exhaustiveness) — which immediately caught `beatCheckPrompt` not asking for the `reason` its schema required. CI added to all three sibling repos; MCP peer dep corrected to ^2.1.0. |

#### Follow-up pass — the deferrals, closed

| Landed | Status |
|---|---|
| **Wiring** | The previous pass reproduced the audit's own antipattern: the scope assembler, acts runtime, geography graph and threat clocks were built, tested, exported — and called by nothing. All four now have consumers, and `tests/wiring.test.js` asserts that 19 capabilities each have a caller so a system can never regress into an orphan again. |
| **E3** storage | IndexedDB cold store with segmented archives; every turn writes a bounded hot slice (live world + last 50 transcript entries + 200 ledger patches) and hands the rest to the archive. Degrades to hot-only where IndexedDB is refused. The journal reads through `fullTranscript()` so a long campaign's export still covers the campaign. |
| **E7** wiring | `story.js` runs on the acts runtime (migrating a legacy `redThread` on read); an act closing generates the next from what actually happened; a stalled thread nudges instead of freezing. |
| **E8.S3** loot | Items carry mechanical fields (heals / gold / value / lore) in both locales; the resolver honours them and refuses to invent effects for the rest. |
| **E8.S4** bestiary | Engine **v2.2.0** (the roadmap's reserved "Bestiary I" slot): Elite/Champion/Ancient templates *derive* CR 16–24 opponents from verified SRD entries rather than transcribing stat blocks from memory, and grant the multiattack/legendary blocks the monster-mechanics module had no data for. The vault boss now scales with party level — a CR 3 wight becomes a CR 11 Champion Wight. |

**Still open, deliberately:** E8.S2 (full spell wiring for casters — the engine's spell data needs its own correctness pass first, per the audit's engine findings), E11.S1's `flow.js` split and Playwright e2e, and the MCP re-sync (an owner decision: dev-time balance harness, or parked).

> ⚠️ **This log overstates coverage — see [`2026-08-implementation-audit.md`](2026-08-implementation-audit.md)**
> (2026-08-07), which verifies every story against the code. Of 49 stories: 18 complete,
> 18 partial, 13 not started — **ten of which are not in the "still open" line above**,
> including **E1.S5, a P0 showstopper absent from this log entirely**. Four capabilities
> added in these passes are orphans (built, tested, exported, called by nothing): the
> payoff ledger, digest invalidation, chapter titling and faction clocks.

Test counts after the follow-up pass: game **427** (was 267), client **187** (was 92), engine **1,574** (was 1,561), MCP 99 — **2,287 passing, 0 failing** across four repos, all gated by CI.

### Milestones

| Milestone | Epics | Demonstrable truth |
|---|---|---|
| **M0 — Honest** | E0–E1 | A new player on default settings plays a full dungeon with zero silent failures; CI gates every repo. |
| **M1 — It remembers** | E2–E4 | 10-hour test campaign: the GM correctly cites an hour-2 event at hour 9; hot save < 1MB; quota warnings are loud. |
| **M2 — The world is a place** | E5–E6 | Walk region A → B → A: everything persists; the FarStay ghoul, ignored, has escalated on its clock. |
| **M3 — A story worth telling** | E7–E8 | A 3-act campaign completes; the PC reaches level 5+; act 2 references act 1 through the ledger, not luck. |
| **M4 — AAA** | E9–E11 | Scripted 80-hour playtest passes the coherence + polish checklist; a stranger onboards in < 3 minutes. |

### Dependency map

```
E0 Truth & Safety ──┐
E1 Stop the Bleeding ┴─→ E2 World Ledger ─→ E3 Storage at Scale ─→ E4 Chapters & Memory
                                  │                                        │
                                  └─→ E5 Scope Assembler ←────────────────┘
                                            │
                          E6 Living Atlas ←─┴─→ E7 Red Line ←─ E8 Progression & Depth
                                            │
                          E9 Emergent Detail ┘
   E10 AAA Presentation / E11 Quality Engineering — run alongside E5+, gate M4
```

---

## Epic E0 — Truth & Safety *(gate for everything; mostly S-tasks)*

**Goal:** the repo tells the truth, the credentials are safe, and the law is satisfied.
**Why:** audit §2 S8, §11; vision-docs findings (docs describe two other products); critic
findings (no LICENSE, no SRD attribution, "D&D" trademark, privacy).
**Exit gate:** a new contributor reading README + CLAUDE.md is not lied to once; the old
OpenRouter key is dead; every doc in `docs/ideas/` carries a status stamp.

### E0.S1 — Rotate and re-architect the shared key *(S)* — S8 / P0-1
> As the owner, my API key is not decodable from a public bundle, and I have consciously
> decided what the free tier is.
- [ ] Revoke the current embedded OpenRouter key; issue a fresh one if the demo tier survives.
- [ ] Decide the free tier's future: **(a)** capped "demo: first dungeon only, shared key,
      N turns" with an honest banner, or **(b)** BYOK-only with a friction-free key flow.
      Record the decision in `docs/ideas/05-ai-runtime.md`.
- [ ] If (a): move the key behind a minimal proxy (e.g. Cloudflare Worker, per-IP rate
      limit, model allow-list) so the bundle ships no secret at all; delete `_cfg`/`_a`/`_b`
      from `src/ai/tiers.js`.
- [ ] Add a free-tier consent notice (player prose transits the owner's account) to the key
      screen — the disclosure `docs/ideas/05-ai-runtime.md` promised.

### E0.S2 — Documentation truth pass *(M)* — P0-12
> As a contributor, every design doc tells me its real status.
- [ ] Stamp every `docs/ideas/00–16` file: `CURRENT / PARTIAL / PARKED / CUT` + a one-line
      "what actually shipped" header (vision-docs finding has the full BUILT/PARTIAL/
      DOC-ONLY matrix to copy from).
- [ ] Rewrite `CLAUDE.md` module map to the real `src/` tree (14 missing files, 2 phantom
      files); fix the tier table; delete the unpkg claim.
- [ ] Rewrite `README.md`: current feature set, honest non-goals, BYOK/demo reality.
- [ ] Reconcile `bag-of-holding/docs/roadmap.md` status line (claims 2.0.1/1536 tests) and
      the Where-we-are table (claims 0.x/230 tests) with reality (2.1.0/1561); resolve the
      "Quiet Stair = 2.1.0" slot collision by re-numbering (engine CLAUDE.md reserves it).
- [ ] Fix `docs/ideas/14-client.md` stale execution-status header (claims `commit()` and
      save versioning "not yet done" — both shipped).

### E0.S3 — Licensing & attribution *(S)* — P1-17
> As the publisher, the shipped game satisfies the licenses it depends on.
- [ ] Add `LICENSE` to Dans-Dungeons (decide: MPL-2.0 to match siblings, or other).
- [ ] Ship SRD attribution: CC-BY-4.0 notice for SRD 5.2 content in an in-game "Legal"
      panel + README (the engine's `docs/legal.md` mandates downstream attribution).
- [ ] Include vendored licenses: MPL-2.0 texts for both vendored libs, Lucide's MIT,
      Spektrum provenance note in `vendor/`.
- [ ] Scrub "D&D" trademark from marketing copy (README tagline, page `<title>`, store
      text); "5e-compatible" / "the world's most popular roleplaying game" phrasing.

### E0.S4 — CI everywhere *(S per repo)* — S9 / P0-6
> As the maintainer, no repo can merge or deploy code whose tests fail.
- [ ] Dans-Dungeons: workflow running `npm test` + `node build.js` + a bundle-freshness
      check (`git diff --exit-code vendor/app.bundle.js` after rebuild) on every push/PR.
- [ ] bag-of-holding: workflow running `npm test` + `npm run typecheck`; make the Pages
      deploy depend on it.
- [ ] bag-of-holding-client + bag-of-holding-mcp: `npm test` workflows.
- [ ] Deploy the CI-built bundle (upload artifact → Pages) instead of trusting the
      committed one; keep the committed bundle only as a fallback until Pages migration.

---

## Epic E1 — Stop the Bleeding *(M0 gate; everything here is a verified showstopper)*

**Goal:** the game a new player meets today works.
**Why:** audit §2 — S1, S2, S3, S4 (UX half), S5, S6, S10, plus P0-9/P0-11.
**Exit gate:** default-settings player completes a quick dungeon and a campaign settlement
visit with zero silent failures; all fixes carry regression tests; CI (E0.S4) is green.

### E1.S1 — Models that exist, verified at boot *(S)* — S1 / P0-2
> As a player on defaults, every configured model is alive, and my old save heals itself.
- [ ] Replace dead IDs in `src/ai/tiers.js` + `bag-of-holding-client/src/llm/tiers.js`
      (medium free slot, all four `FREE_FALLBACKS`; delete the TTS/STT phantoms — OpenRouter
      hosts no speech models; route speech through a provider that exists or park the
      feature honestly).
- [ ] Boot-time validation: fetch `/api/v1/models` once, heal any dead slot back to the
      tier default, toast the player when a slot was healed (snippet in audit §2 S1).
- [ ] Save healing: on load, re-run `applyTier` against validated IDs — a persisted dead
      model map must never survive a boot (S1 verification: fixing tiers.js alone is not
      enough).
- [ ] Harden the fallback walker: try the *next* chain entry on any 4xx, not just 429
      (`bag-of-holding-client/src/llm/client.js:57-63`); give `chatStream` the same chain.
- [ ] Add a weekly scheduled CI job that validates all configured model IDs against the
      live catalog and opens an issue on rot (model churn is what killed the tier — make it
      structurally impossible to miss again).

### E1.S2 — Restore the click-to-play layer *(S)* — S2 / P0-3
> As a player, I can click what the game offers me — and the shop actually shows wares.
- [ ] Add `#action-chips`, `#character-chips`, `#skill-chips` containers to `index.html`
      where `style.css:210-245` expects them.
- [ ] DOM-contract smoke test: parse `index.html` in a test, assert every
      `getElementById` target in `src/ui/` exists (this class of bug can never ship again).
- [ ] Wire the shop wares list as *both* chips and printed transcript text (`flow.js:773-779`).
- [ ] Add a free-text `fasttravel` intent to `normalizeSettlementAction` — fast travel is
      currently dead end-to-end (verification of S2 found no non-chip path either).
- [ ] Verify Retry / Flee / leave / Restart chips render; keep their typed synonyms.

### E1.S3 — Un-brick the encounter save *(S)* — S3 / P0-4
> As a player, reloading mid-fight on the road resumes the fight.
- [ ] Persist the swapped-out world snapshot in the save (`world.encounterReturn = snap`)
      instead of a local variable (`flow.js:967-987`).
- [ ] Add an `'encounter'` route to `resumeGame` (`flow.js:1533-1538`): rebuild the
      encounter loop from persisted state, restore `encounterReturn` on victory.
- [ ] Victory/defeat path inside a resumed encounter must restore the real world fields
      and re-enter the settlement/travel loop (the current dead-end return is the brick).
- [ ] Regression test simulating save-mid-encounter → reload → win → back on the road.

### E1.S4 — Loud, honest persistence *(M)* — S4 / P0-5
> As a player, I know the instant saving stops working, and it mostly never stops working.
- [ ] Narrow transcript writes: append per-index (`transcript.${i}`) instead of re-recording
      the whole array (`resolver.js:301-305`) — kills the O(n²) spine growth at the source.
- [ ] Same for `session.rollLog` (`rng.js:120`): append entries, don't rewrite.
- [ ] Surface save failure: `saveToStorage` returns success; on failure set
      `session.saveHealth = 'failing'`, show a persistent banner + "Export now" button
      (the doc-06 UX), and make `/save` report the *actual* result (`flow.js:251` currently
      lies "saved" unconditionally).
- [ ] `navigator.storage.estimate()` monitor: warn at 70% quota, alarm at 90%.
- [ ] Byte-budget the `_timeTravel` blob (size cap, not just entry cap `MAX_TT_ENTRIES`).
- [ ] Corrupt-save path: back up the unparseable blob to a side key and tell the player,
      instead of silently starting a new game.

### E1.S5 — Engine replay & session integrity *(M)* — S5 / P0-7
> As the engine, every session I record, I can verify; every session I save, I can restore.
- [ ] `verifyLog` totality (`bag-of-holding/src/replay.js:152`): skip no-RNG ops
      (`mechanicApplied`, `hookFired`), replay `deathSave` as its single d20 (the exact
      shape of the Dans-Dungeons workaround at `src/game/rng.js:77-80` — then delete that
      workaround).
- [ ] Route unlogged RNG draws through `record()`: Travel forage/navigate/rest-interruption,
      Equipment.toolCheck, Movement.fall, MagicItems recharge/save, surprised-initiative.
- [ ] Fix `Session.restore` crash on saves containing ended encounters / non-party actors
      (re-adopt serialized actors).
- [ ] Restore the condition-record API (`conditionName`, `conditionsRequiringSave`) that
      merge `c4654c7` silently dropped (found during S6 verification).
- [ ] Tests: a full session (combat + death save + class mechanic + travel + restore)
      round-trips through `Replay.share` → `Replay.verify` green.

### E1.S6 — One engine, deliberately vendored *(M)* — S6 / P0-8
> As the game, I run one known version of the rules, and drift is a test failure.
- [ ] Re-vendor `bag-of-holding` at 2.1.0+ (post-E1.S5); absorb the behavior delta once —
      this unlocks equipment, hazards, travel, solo, `toolCheck`, species traits for E8.
- [ ] `vendor/*/VENDOR.json` manifest ({package, version, commit, patchedFiles}) for both
      vendored libs + Spektrum provenance.
- [ ] `npm run vendor:sync` script (copy from sibling, stamp manifest) + a CI test that
      fails when vendored files differ from the manifest's declared commit.
- [ ] Delete the game-side duplicates: `DUNGEON_OVERLAYS` copy, model-tier tables — import
      from the client library (P1 rec in integration section).
- [ ] MCP repo: bump peer dep to the real engine version; decide its role (dev-time balance
      harness — see E11.S4 — or park with an honest README).

### E1.S7 — Small verified fixes bundle *(S)* — P0-9/P0-10/P0-11
- [ ] Lock-and-key graph cut: lock every edge crossing the pre/post-gate partition
      (`bag-of-holding-client/src/dungeon/generate.js` — 68.7% bypass rate today).
- [ ] Strip `ai.key`/`ai.baseUrl` from `.dnd.json` export; validate/ignore them on import
      (a hostile save must not redirect prose + key to an attacker origin); pin CSP
      `connect-src` to the configured base URL.
- [ ] `castSpell` silent higher-slot burn: refuse or report the auto-upcast
      (`bag-of-holding/src/spellcasting.js`).
- [ ] SW: exclude `vendor/app.version` from runtime caching so the self-invalidation
      design actually detects deploys (ui-ux S-fix).
- [ ] OAuth path: ask the tier question on `?code=` return; make `prompt()` re-entrancy
      safe (mid-game "Upgrade" currently orphans the play loop).

---

## Epic E2 — The World Ledger *(the keystone: memory, drift-kill, and "everything persists")*

**Goal:** base ⊕ patches = world. Every mechanical change and every GM-asserted fact
becomes an addressable, scoped, replayable patch. This is the architecture answer to
"moldy curtains stay moldy."
**Why:** audit critical gaps "no narrative memory", "nothing the narrator says is
remembered"; the four drift loops; S4's save-shape problem dissolves here too.
**Exit gate:** a scripted 200-turn session replays to identical world state from
`seed + base + ledger`; a fact asserted by the narrator at turn 10 is servable at turn 200.
**Ownership:** fold/patch/compaction primitives in `bag-of-holding-client/src/ledger/`
(pure, config-injected, node-tested); Spektrum wiring + extraction calls in the game.

### E2.S1 — Ledger primitives *(M)*
> As the platform, I can fold any entity's current state from base + patches, purely.
- [ ] `src/ledger/patch.js`: patch shape `{turn, chapter, target, scope: local|regional|world,
      kind: mechanical|canon, op: {path, from, to}, because, source}` + validators.
- [ ] Hierarchical entity IDs (`region.X.settlement.Y.npc.Z`, `...inn.privy.detail.curtains`)
      + an ID grammar module (mint, parse, parent, prefix-match). Stable IDs are law: no
      display-name references anywhere (kills the star-topology name coupling later).
- [ ] `fold(base, patches, target)` and `foldAll(base, patches, prefix)` — pure, tested.
- [ ] Precedence rule as code: a `canon` patch conflicting with mechanical state on the
      same path is rejected at append time (returns `{ok:false, conflict}`).
- [ ] `world.ledger` in appState: append-only via narrow `setValue(`ledger.${i}`)` writes;
      ledger entries are never edited.

### E2.S2 — Mechanical patches from the resolver *(M)*
> As the engine, every world change I make explains itself.
- [ ] Teach `commitAll` (`resolver.js:252-281`) to emit its deltas (HP, deaths, loot taken,
      doors unlocked, movement) as `kind: 'mechanical'` patches alongside the state writes
      it already does — it computes them today and throws the semantics away.
- [ ] Same for flow-level events: quest status changes, purchases, reputation awards,
      travel arrivals, dungeon completions (currently whole-world spreads in `flow.js`).
- [ ] Dungeon interior write-back (P1-7): on dungeon exit/commit, fold the flat
      `world.rooms/npcs` back into `world.dungeons[id]` — re-entry stops resurrecting
      everything. With the ledger this is free: the dungeon's state *is* its fold.
- [ ] Replay test: seed + input script + ledger → identical `world` to live play.

### E2.S3 — Canon extraction: the write-back loop *(M)*
> As the GM, what I say becomes true — or gets rejected before the player sees a lie.
- [ ] Post-narration tiny-tier call: extract asserted facts from the narration as candidate
      `kind: 'canon'` patches, schema-constrained (`CANON_SCHEMA`: target must be a known
      entity ID from the scene packet, or an explicit `proposeEntity` — see E9.S1).
- [ ] Conflict gate: candidates that contradict mechanical state are dropped (and counted —
      a high drop rate is a narrator-prompt bug signal).
- [ ] Async commit: extraction runs off the critical path (after `finalizeTurn`), patches
      land before the *next* turn's packet is assembled.
- [ ] The FarStay test (fixture): narration asserting "mold stains the curtains" produces
      `{target: '...castle.hall.detail.curtains', op: {path:'condition', to:'moldy'}}`; 50
      turns later the packet for that room still carries it.
- [ ] Budget guard: extraction adds ≤ ~400 in / ~120 out tokens per turn (tiny tier —
      pennies per campaign; verify against the audit's cost model).

### E2.S4 — Compaction & the save format v3 *(M)*
> As an 80-hour save, I stay small, loadable, and deterministic.
- [ ] Chapter-close compaction: fold `local`-scope patches older than N chapters into
      per-entity base snapshots ("rebase"); `regional` kept longer; `world` kept forever.
      Deterministic: same fold → same result.
- [ ] Save envelope v3: `{seed, baseHydrations, ledger, viewCache?}` replaces the
      transcript-spine `_timeTravel` shape; write the v2→v3 migration in the existing
      migration runner (it finally gets exercised — audit called versioning "unexercised").
- [ ] Harden `loadEnvelope`: refuse silent migration gaps and future-version saves
      (client-toolkit P1 rec).
- [ ] Undo/branch compatibility: state at turn N = base ⊕ patches≤N; adapt `undo.js` epochs
      to ledger positions; branches fork the ledger index, not the state arrays.
- [ ] Size test: simulated 3,000-turn campaign save ≤ 2MB hot (pre-E3 IDB split).

---

## Epic E3 — Storage at Scale *(M1 gate with E4)*

**Goal:** the doc-06 architecture, finally: IndexedDB cold store + localStorage hot slice.
**Why:** audit critical "localStorage quota exhausted ~5–10h of play, silent loss"; doc 06
calls the split "essential, not optional" and ships none of it.
**Exit gate:** 40-hour simulated campaign: hot slice < 1MB, cold store unbounded, kill the
tab at any moment → resume loses at most the in-flight turn.

### E3.S1 — Async storage adapter + IDB cold store *(L)*
- [ ] `bag-of-holding-client/src/persistence/idb.js`: promise-based store (transcript
      history, compacted ledger segments, journal cache, sketches, EPUB blobs, TT epochs).
- [ ] Make `saveEnvelope`/`loadEnvelope` adapter-async (localStorage stays sync-wrapped).
- [ ] Hot slice definition: `session`, `party`, active-location fold, last ~50 transcript
      entries, ledger tail since last compaction → localStorage; everything else → IDB.
- [ ] Write-through: turn commit writes hot synchronously, queues cold batch; `beforeunload`
      flush.
- [ ] Migration: existing v2/v3 localStorage saves hydrate into the split on first boot.

### E3.S2 — Multi-tab & integrity *(S)*
- [ ] Web Locks (or `storage` events fallback): second tab opens read-only with a "game
      open elsewhere" banner (critic: last-writer-wins clobbering today).
- [ ] Checksum on hot envelope; on mismatch, offer the IDB-reconstructed state.
- [ ] SW update flow: never force-reload a tab mid-turn (queue until idle).

### E3.S3 — Save slots & export v2 *(M)*
- [ ] Multi-slot saves (doc-06 promise): named slots over the same hot/cold machinery.
- [ ] Export `.dnd.json` = full merged state (hot + cold), key-stripped (E1.S7), with a
      manifest header (version, seed, turn count, playtime) for support/debugging.
- [ ] Import validates the manifest, routes through migrations, and **reboots the flow FSM**
      (audit: mid-session import currently leaves the wrong loop driving).

---

## Epic E4 — Chapters & Memory *(M1 gate)*

**Goal:** play is structured into chapters; the GM's context is assembled from rolling +
chapter digests over the ledger; digests refresh when the world changes.
**Why:** audit critical "no chapter/session structure — `session.chapterId` is a dead
field"; "narrator memory horizon is 3 entries"; stale-digest drift loop.
**Exit gate:** the M1 test — at hour 9 the GM cites an hour-2 event correctly, from a
digest, not from a lucky window.

### E4.S1 — Chapter boundaries *(S)*
- [ ] Define boundary triggers: dungeon cleared, region changed, long rest in safety, act
      transition, ~2h of play — cut a chapter, stamp the ledger.
- [ ] `session.chapters[]` per the audit §7 shape: `{id, title, digest, startTurn, endTurn}`.
- [ ] Boundary ceremony in the transcript ("Chapter 4 — The Road to Saltmarch") — cheap
      AAA feel, and the anchor for recaps.

### E4.S2 — Rolling digest + chapter digests *(M)*
- [ ] Repoint the journal summarizer machinery (built, cached, tested — audit's "single
      highest-leverage feature") at play: rolling digest of the current chapter (~300 tok),
      refreshed every N turns on the tiny tier.
- [ ] On chapter close: freeze the rolling digest into the chapter digest (~150 tok),
      seeded from the ledger's chapter slice (facts first, prose second).
- [ ] Narrator context becomes: chapter digests (stable prefix → prompt-cacheable) +
      rolling digest + last 10–15 transcript entries + scene + story context. Fix the
      prompt's false "last 3 turns" claim while touching it.
- [ ] "Previously on…" recap on session resume (doc-03 promise), rendered from the last
      chapter digest + open threads.

### E4.S3 — Digest refresh: views over the ledger *(M)*
- [ ] Dirty-set: appending a patch with scope ≥ regional marks the affected
      region/settlement/world digests dirty.
- [ ] Re-render dirty digests lazily (next read or chapter boundary), tiny tier, from
      base digest + folded patches; version each render (`digestV`, `renderedAtTurn`) so
      two loads read identical text (pillar 5).
- [ ] World-bible export renders from base + ledger — fixing the audit defect where it
      generates a fresh random world instead of documenting the campaign.
- [ ] Journal/EPUB chapters consume chapter digests (incremental, no more single-shot
      over all narrations — audit's "cannot survive a long campaign" gap).

---

## Epic E5 — Scope Assembler & the GM's Eyes *(M2 gate with E6)*

**Goal:** the doc-12 scope packet, real: the narrator sees exactly enough, cheaply, with
secrets filtered and inventions bounded — and every intent is either mechanized or
explicitly fiction-only.
**Why:** audit critical "context-scoping architecture entirely unimplemented"; high
"narrator improvises state changes for 8 intents"; "no anti-invention guard"; secrets ride
exposed in prompts.
**Exit gate:** packet ≤ ~3k tokens at hour 20; zero mechanical contradictions in a 100-turn
scripted soak (E11.S3 harness measures this).

### E5.S1 — The scope packet *(M)* — P1-10
- [ ] Formalize `buildScene` (`loop.js:24-82`) into `assembleScope(location, ledger, pc)`:
      `{here (full folds), nearby (sense lines), region digest, world digest, pcKnowledge,
      canonHits, story}` with per-tier token budgets and deterministic assembly order
      (stable prefix first → prompt caching; audit: 12–120× cached-input discounts).
- [ ] `pcKnowledge`: facts filtered by what *this character* has encountered (encounter
      flags per entity — the ledger already knows what the player has seen).
- [ ] Secrets filter: GM-private data (`npc.secret`, beat directives) moves to a
      `gmOnly` slice injected only into the narrator system prompt, never into scene JSON
      the UI or exports can read; secrets-by-reference design (critic P1) before doc-08
      scales the blast radius.
- [ ] `canonHits`: keyword inverted index over ledger `because` lines + entity names —
      associative recall v1, zero infra (defer embeddings; the packet interface is where
      they plug in later).
- [ ] Minify all JSON in prompts (audit: pretty-printing wastes ~12% input tokens).

### E5.S2 — Close the intent gap *(M)* — P1-4
> As the resolver, every classified intent either changes the world or explicitly doesn't.
- [ ] Mechanize: `rest` (engine short-rest: hit dice, slot recovery, interruption roll),
      `flee` (opposed check + reposition), `use` (item effects for the E8 loot loop),
      `buy` (already priced — wire inventory effects), `look` (reveal `detail.*` entities —
      feeds E9), `wait` (pass turn, clocks tick).
- [ ] De-mechanize explicitly: `talk`/`inventory` resolve to `{intent, noEffect: true}` and
      the narrator prompt gets a rule per no-effect intent: *"narrate color only; you may
      not change HP, position, items, or NPC state."*
- [ ] Clamp classifier DCs to [5,25] and give the classifier a DC rubric (audit: unclamped,
      no rubric); skill checks gain consequences (position, reveals, clock ticks) so
      success/failure means something.
- [ ] Contradiction fix: when a skill success prevents retaliation (stealth), the resolver
      — not the narrator — decides; retaliation becomes conditional on the resolved outcome
      (audit: success narrated while the goblin's hit lands in the same paragraph).

### E5.S3 — Narrator contract v2 *(M)* — P1-5
- [ ] Anti-invention rules: may not invent exits, items, NPCs, rooms, or mechanical
      outcomes; *may* invent sensory detail and minor set dressing — which the canon
      extractor will persist (E2.S3) and the proposeEntity channel will formalize (E9.S1).
      Inventing within the rules is a feature, not a bug: that's where the moldy curtains
      come from.
- [ ] Thread tone end-to-end: align the 5-vs-3 tone enums (the June-audit bug still live),
      pass `world.tone` into narrator/journal/NPC-dialogue prompts; delete the hardcoded
      "gritty low fantasy".
- [ ] NPC dialogue gets the world: digest, tone, beat directive, relationships, and the
      NPC's ledger fold (audit: settlement roleplay is world-blind today).
- [ ] Streamed text is canon: pass `NARRATOR_SCHEMA` as `response_format` on the streaming
      call; local fence-strip salvage before any paid repair; never show the player one
      text and commit another (audit medium defects).
- [ ] Latency: skip the classifier for chip/compass input (already structured); move the
      beat check off the critical path (fire-and-forget before finalize) — the two
      pure-win fixes from the cost audit.

---

## Epic E6 — The Living Atlas *(M2 gate)*

**Goal:** the world is a graph of real places that pre-exist as deterministic stubs and
hydrate as the player approaches; history is a structured ledger everything cites; clocks
make it move.
**Why:** audit high "the world is a star, not a graph — open-world topology cannot be
represented"; scale discussion (stubs, event ledger, clocks); one-settlement-one-dungeon
thinness.
**Exit gate:** the M2 walk (A→B→A persists) + an ignored regional threat escalates on its
clock and shows up in the refreshed region digest.
**Pivot valve:** Pivot 1 keeps S1/S3/S4 but stubs never *need* hydrating beyond the hub
region; Pivot 2 cuts S2 continents entirely.

### E6.S1 — Geography graph *(M)* — P1-9
- [ ] `world.geography = {nodes, edges}` with pre-minted stable IDs (audit §7 Phase C
      shape); regions mint neighbor stubs at generation; roads carry real `targetId`s
      (kill the `Date.now()` dungeon-minting and display-name adjacency).
- [ ] Travel v2 on the graph: journeys are edge walks; the travel FSM gets
      per-journey config (client-toolkit gap); arrival hydrates the stub if needed.
- [ ] Region re-entry: everything folds from ledger — nothing regenerates.
- [ ] `/map` view: rendered from the graph + discovery flags (discovered edges only).

### E6.S2 — Layer stack v2: history & continents *(L)*
- [ ] Insert `history` layer into `WORLDGEN_LAYERS` (`worldgen.js:106`) after `world`:
      8–12 structured events `{id: 'ev.*', era, headline, actors[], consequences[],
      hooks[]}` — IDs only, no prose walls (scale discussion: prose history is drift fuel).
- [ ] `HISTORY_SCHEMA` in the client library; blueprint threads era/theme constraints;
      factions/beats/regions layers get history hints and must cite `ev.*` IDs.
- [ ] Continent tier as stubs: 2–3 minted with names + one-line hooks + seeds; only the
      starting continent hydrates; sailing to another is a chapter-level act (and can stay
      a stub for the whole campaign without breaking anything).
- [ ] Dungeon origin tags: generated dungeons cite an `ev.*` (built-during, ruined-by) —
      overlay themes get historical anchors, killing the "same manor rooms in a flooded
      cavern" incongruity at the source.

### E6.S3 — Faction clocks: the world moves *(M)*
- [ ] Wire the engine's scene-clock module (shipped, tested, unused): each faction gets
      2–3 project clocks `{id, faction, label, segments, filled, onFill: patches[]}`.
- [ ] Tick at chapter boundaries (E4.S1); player actions advance/rewind via reputation
      events; a filled clock appends its patches (scope regional/world) → digests go dirty
      → the world visibly moved while you were in a dungeon.
- [ ] The FarStay ghoul rule, generalized: local threats get clocks too (E9.S3).
- [ ] Determinism: clock advancement is pure function of (chapter, events) — replayable.

### E6.S4 — Region density *(L)*
- [ ] Sites beyond settlement+dungeon: 3–4 additional site archetypes per region (shrine,
      watchtower, farmstead, ruin, crossing) with small interaction loops — seeded
      placement, LLM-hydrated flavor, ledger-persisted state.
- [ ] Side-quest generator: template shapes (fetch/escort/investigate/cleanse) cast onto
      *existing* NPCs/sites/history events — never free-floating; completion emits
      reputation + ledger patches.
- [ ] Dungeon variety: 2–3 more topology recipes in the generator (loop, hub, descent) +
      per-theme room descriptor pools (lore audit: all 24 themes currently dress the same
      manor rooms; sampled-with-replacement duplicates fixed by sampling without
      replacement).
- [ ] Rumor propagation: settlements surface nearby ledger facts as tavern rumors
      (discovery mechanism for E9 emergent content and the red line both).

---

## Epic E7 — The Red Line *(M3 gate)*

**Goal:** one story worth 80 hours: acts above beats, cast onto the world, with failure
states, foreshadowing that pays off, and a finale — ignorable for 20 hours without
breaking.
**Why:** audit critical "red thread content math is an order of magnitude short"; high
"beat advancement can stall forever"; two competing beat runtimes; casting module unused.
**Pivot valve:** Pivot 3 replaces S2's act *generation* with authored act content on the
same runtime — everything else stands.

### E7.S1 — One beat runtime *(M)* — P1-8
- [ ] Adopt the engine's `beats/thread.js` (successors, sub-threads, branching) as the
      single owner; write an adapter from the client-lib linear evaluator's state shape;
      retire the duplicate (audit: the richer runtime has zero consumers).
- [ ] Extend the schema for campaign scale (engine-content P1): terminal markers, failure
      states, act grouping, valued (non-boolean) flags, expiry/clock hooks.
- [ ] Migration for in-flight saves (exercises the E2.S4 envelope).

### E7.S2 — Acts: lazy story generation *(L)*
- [ ] Act layer above beats: campaign = 4–5 acts; only the current act's beats are fully
      generated; the next act generates at act transition, conditioned on the ledger (what
      *actually happened*, including emergent E9 content — the story reacts to the world).
- [ ] Act generation prompt cites: world digest, history `ev.*`, faction standings +
      clock states, unresolved payoff ledger entries (S4), player's notable deeds.
- [ ] Act transitions are chapter boundaries with ceremony: title card, recap, stakes.
- [ ] Finale: the last act carries an explicit climax beat with victory/defeat variants
      and an epilogue renderer (world-state → "where are they now" from the ledger) —
      the audit found completing the last beat currently changes a progress line.

### E7.S3 — Casting & binding *(M)*
- [ ] Wire the engine's archetype-casting module (shipped, unused): every beat binds to
      cast entity IDs (`npc.*`, `loc.*`) at act generation; `preferredLocation` stops
      being prompted to null.
- [ ] Beat completion becomes flag-primary: mechanical events (E2.S2 patches) raise the
      flags; the LLM judge (`checkBeatFulfilled`) demotes to fallback-only (audit:
      judge-only progression can stall forever).
- [ ] Stall detection: a beat idle for N chapters triggers escalation — the world
      moves toward the player (cast NPC sends a letter, clock fires, rumor spreads) —
      the "ignorable but unbreakable" property.
- [ ] The red line is *findable*: `/story` view renders act/beat state + last known
      thread location from the ledger ("the trail leads back to Saltmarch").

### E7.S4 — Foreshadowing & payoff ledger *(M)*
- [ ] Payoff ledger: planted clue → obligated payoff `{plantedAt, clueText, paysInto:
      beatId|ev.id, dueBy: act}` — clue discoveries get *content* (audit: currently
      cosmetic) drawn from the next act's generated material.
- [ ] Act generation must consume due payoffs (unpaid setups carried forward or
      explicitly abandoned with a ledger note).
- [ ] Narrator gets `activeSetups` in the story context so it can seed clues naturally.

---

## Epic E8 — Progression & Depth *(M3 gate)*

**Goal:** 80 hours of mechanical growth: levels, spells, loot that matters, monsters worth
level 12, encounters that scale.
**Why:** audit critical "no progression: level 1 forever"; bestiary CR ≤ 15, zero
structured mechanics blocks; casters have no spells; equipment/hazards/travel modules
vendored out.

### E8.S1 — XP & leveling *(M)* — P1-6
- [ ] Award XP from mechanical patches: kills (engine `xpForCr`), dungeon clears, beat
      completions, quest turns — call sites currently number zero.
- [ ] Level-up flow: notify → choice UI (HP, features, ASI at 4/8/12/16, spell picks) →
      re-derive sheet via engine (`deriveSheet`); support to level ~12 for the 80h arc.
- [ ] Multiclass deferred (engine `deriveSheet` doesn't support it — audit gap); document
      as post-M4.
- [ ] Encounter scaling: dungeon depth × party level via the engine's DMG-exact encounter
      designer (shipped, unused by the game).

### E8.S2 — Spells & class play *(L)*
- [ ] Wire spellcasting for Cleric/Wizard (slots, prepared lists, cantrip scaling — all
      engine-side already); spell chips in the action bar; resolver `cast` intent.
- [ ] Fix engine spell-data debt first (from audit): normalize the 71 string-component
      records, multi-damage-type spells, upcast functions for the ~20 most-used combat
      spells.
- [ ] Movesets v2: real per-class chip sets (audit: ~2 chips per class, demo-grade) —
      weapon choice honored (resolver currently always swings `attacks[0]`).
- [ ] Rests: short/long rest as first-class actions (engine rest module) with
      interruption rolls tied to region danger.

### E8.S3 — Loot, equipment, economy *(M)*
- [ ] Purchases and found loot apply mechanical effects (equipment module from the E1.S6
      re-vendor: AC, weapons, tools; attunement for magic items).
- [ ] Treasure generation leans on domain tables (already authored) + magic-item registry
      by rarity/level band.
- [ ] Gold sinks: inn stays (heal + chapter tick), gear upgrades, information brokers
      (rumor purchases — ties to E6.S4).

### E8.S4 — Bestiary depth *(L)* — P1-18
- [ ] CR 16–24 tier for the SRD bestiary (engine-content: nothing above 15; 44/66 at ≤5).
- [ ] Structured mechanics blocks (legendary/lair actions, multiattack, innate casting)
      for every CR 5+ monster — the monster-mechanics module is complete and consumes
      zero data today.
- [ ] Boss encounters use them (the vault boss stops being a big HP bag).
- [ ] NL parity for creature content (39 missing intros, ~28 untranslated names) + the
      five concrete translation fixes (lore audit).

---

## Epic E9 — Emergent Detail: "The Ghoul of FarStay Inn" *(the signature feature)*

**Goal:** the GM's inventions become first-class world citizens. Detail persists at every
granularity — set dressing, named NPCs, local threats — discovered, escalated, and
resolvable.
**Why:** this is the user-stated vision made mechanical; it rides entirely on E2 (ledger),
E5 (narrator contract), E6 (clocks, rumors). Audit basis: "nothing the narrator invents is
ever remembered" + the beat/casting/clock machinery sitting unused.
**Exit gate:** the acceptance script below passes in a live playtest.

### E9.S1 — Entity minting *(M)*
> As the GM, when I invent something worth remembering, it becomes real.
- [ ] `proposeEntity` channel in the canon-extraction schema (E2.S3): the extractor may
      propose `{kind: npc|creature|detail|site|item, parentId, name, seedTraits}` for
      inventions that exceed set-dressing (named things, threats, hooks).
- [ ] Minting rules: `detail.*` entities (curtains, bloodstain, cracked bell) auto-mint
      under their location; `creature`/`npc` mint with a bestiary/archetype binding —
      the ghoul gets the SRD ghoul stat block, a home node
      (`settlement.farstay.inn.privy`), and `attitude: 'hostile'`.
- [ ] Dedup gate: proposals fold against existing entities by name+parent before minting
      (no twin ghouls from a re-told rumor).
- [ ] Player-facing rule of thumb encoded in the narrator prompt: *invent freely at
      set-dressing scale, propose at named scale, never at mechanical-outcome scale.*

### E9.S2 — Detail persistence *(S)*
> As a place, my details accumulate and my scars remain.
- [ ] `look` intent (E5.S2) surfaces the location's `detail.*` folds — revisiting the
      castle hall re-serves the moldy curtains verbatim-in-substance.
- [ ] Details are patchable like everything else (washed curtains: a `mechanical` patch
      from a player action, or a `canon` patch from narration — precedence applies).
- [ ] Detail budget per location (cap + LRU demotion at compaction) so 80 hours of
      set-dressing doesn't bloat the ledger (E2.S4 compaction handles the fold-in).

### E9.S3 — Local threats & escalation *(M)*
> As an invented threat, ignoring me has consequences.
- [ ] Threat minting: a proposed hostile entity gets a local clock (E6.S3 machinery,
      local scope): the ghoul's clock fills → patches escalate (`inn.reputation` down, an
      NPC victim, region digest mention) — the toilets get *worse*.
- [ ] Rumor surfacing (E6.S4): nearby settlements start talking about it; the innkeeper's
      dialogue context (E5.S3) carries it as an active concern with a quest hook.
- [ ] Resolution: killing it emits mechanical patches + XP + reputation + a
      `because`-rich ledger entry the journal and epilogue can cite ("the year the privy
      ghoul of FarStay finally met its match").
- [ ] Red-line integration: act generation (E7.S2) reads notable emergent entities from
      the ledger — a memorable side threat can get promoted into the main story's cast.

### E9.S4 — Acceptance script *(the demo that proves the vision)*
- [ ] Scripted playtest fixture: (1) GM invents mold on the castle curtains — persisted,
      re-served at revisit 30+ turns later; (2) GM proposes a ghoul at the FarStay Inn —
      minted with stats and a clock; (3) player ignores it two chapters — clock fires,
      region digest updates, rumor appears in the next town; (4) player returns and kills
      it — XP, reputation, journal chapter cites it; (5) export → reimport the save —
      all of the above still true.

---

## Epic E10 — AAA Presentation *(M4 gate, parallel from E5)*

**Goal:** the chrome earns the word AAA: waiting feels alive, everything clickable, mobile
works, both languages are equals, and errors speak like a GM.
**Why:** ui-ux audit (static "…" for 5–30s waits, no cancel, scroll hijack, no PWA
manifest, ARIA misuse, 2.1:1 contrast, iOS zoom); lore audit NL parity; cost audit image
economics.

### E10.S1 — The waiting game *(M)* — P1-15
- [ ] Staged thinking indicator (classify → resolve → narrate labels), elapsed time,
      animated; turn cancel that aborts cleanly (needs the client-lib AbortSignal work —
      P1-11: thread abort + default timeout through transport/client/stream, plus
      `runPipeline` checkpoint/resume for worldgen).
- [ ] Stick-to-bottom scrolling that respects the player scrolling up (audit: viewport
      hijack on every streamed token).
- [ ] Worldgen progress: per-layer progress with retry surfacing (resumable via
      checkpointing rather than all-or-nothing — client-toolkit P1).

### E10.S2 — Input & affordances *(M)*
- [ ] Clickable `pickFrom` options; chips everywhere the game offers choices (E1.S2 laid
      the containers); keyboard nav + focus rings (zero focus CSS rules today).
- [ ] Fix the global Spacebar hijack (breaks button activation); ARIA pass (menu roles,
      aria-expanded misuse, tooltip alternatives).
- [ ] Typography floor: rem-based sizes ≥ 12px equivalent, contrast ≥ 4.5:1 (audit: 9px
      fixed and 2.1:1 today).

### E10.S3 — PWA & mobile *(S)*
- [ ] Web app manifest, theme-color, apple-touch-icon; iOS input zoom fix
      (16px input font); installability test.
- [ ] SW correctness follow-through (E1.S7): update toast — "a new version is ready" —
      instead of silent staleness; never reload mid-turn (E3.S2).

### E10.S4 — Error voice & cost visibility *(S)* — P1-12
- [ ] Error message pass: every failure states cause + player action ("Your key was
      rejected (401) — check it in Settings" vs today's hardcoded guess; 402 ≠ "GM
      unavailable").
- [ ] Real cost meter: read `usage.cost` from every OpenRouter response into the spend
      accumulator (it literally arrives in the payload and is discarded today); per-tier
      breakdown; optional session budget cap with a soft warning.
- [ ] Image rationing: sketch on room change / on demand ("sketch this" chip), not every
      turn (47× the text cost); gallery keeps per-chapter covers.

### E10.S5 — Language parity *(M)*
- [ ] NL content pass: the 39 missing enemy intros, creature names, the mistranslations
      ("de vlakten" → "de bestaansvlakken"), untranslated fragments; pluralization fix
      ("2 turnen").
- [ ] Mid-campaign locale switch policy: world text is baked in generation locale —
      either lock the campaign's locale with a clear notice, or regenerate digests on
      switch (decide; audit flags the current mixed-language result).
- [ ] Parity CI check: key-set equality + a "missing-content" report (not just key
      presence — the NL gap hid behind identical key sets).

---

## Epic E11 — Quality Engineering *(M4 gate, parallel throughout)*

**Goal:** the test layers an LLM-first game actually needs — so the next "chips never
existed" or "model rotted" class of bug is structurally impossible.
**Why:** critic findings (zero e2e, zero DOM tests, no prompt evals, responses never
validated against sent schemas); game-logic finding (core turn modules have zero direct
coverage; tests assert against hand-copied reimplementations).

### E11.S1 — Testable core *(L)*
- [ ] Refactor `loop.js`/`resolver.js`/`flow.js` state access behind an injectable store
      so the *real* modules run under `node --test`; delete the reimplementation tests
      (audit lists the three files that test copies).
- [ ] Split `flow.js` (1,539 lines, 39% of src/game) along its natural seams: lifecycle
      FSM / settlement / travel+encounters / end-states — each unit-tested. (The doc-14
      split that never happened.)
- [ ] One owner per behavior test: library behavior tests live in the library; the game
      keeps integration glue only (~1,900 duplicated lines retired).

### E11.S2 — Contract & e2e layer *(M)*
- [ ] DOM-contract test (E1.S2) extended: every `data-if`/`data-each` binding target and
      every `getElementById` in `src/ui` exists in `index.html`.
- [ ] Playwright smoke: boot → key screen → quick dungeon → 3 scripted turns (mocked
      LLM) → save → reload → resume. Runs in CI headless.
- [ ] LLM response validation: every schema sent is also *asserted* client-side on
      receipt (classifier intents in-enum, DCs clamped, narrator fields present) with
      typed fallbacks — today schemas are sent and responses trusted.

### E11.S3 — Prompt regression & coherence harness *(M)*
- [ ] Golden-scene eval set: ~30 fixed (scene, input) pairs run against the classifier +
      narrator on model/prompt changes; score intent accuracy, schema validity,
      contradiction count (mechanical facts vs narration), tone adherence.
- [ ] Coherence soak: 100-turn scripted campaign with canon extraction on; measure
      contradiction rate and canon-conflict drop rate (E2.S3's counter) — the drift
      metric, tracked per release.
- [ ] Cost/latency budget test: assembled packet token counts asserted against budget
      (E5.S1) so context creep is caught in CI, not in the bill.

### E11.S4 — The MCP balance harness *(M)* — the MCP repo's decided role
- [ ] Re-sync bag-of-holding-mcp to the current engine (monsters/damage/rest/spellcasting
      tranches — descriptor pattern makes tool tranches mechanical).
- [ ] `engine_verify_session` server-side replay tool (audit P1) + encounter-simulation
      tools: Claude runs a 1,000-fight Monte Carlo balance pass over generated content
      (dungeon CR curves, boss survivability, XP pacing) during development.
- [ ] Wire into content workflow: every new bestiary tier / encounter recipe ships with a
      balance report generated through the harness.

---

## 4. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Model catalog churn keeps breaking defaults | **High** (it already did) | Game dead on defaults | E1.S1 boot validation + weekly CI canary; never persist unvalidated IDs |
| Canon extraction pollutes the ledger | Medium | Drift returns wearing a uniform | E2.S3 schema + ID whitelist + conflict gate; E11.S3 drop-rate metric |
| Ledger/compaction complexity creeps | Medium | The keystone epic stalls | Primitives stay pure + node-tested in the client lib; E2 exit gate is a replay test, not a feeling |
| 80h content still feels samey despite systems | Medium | The AAA verdict fails at M4 | E6.S4 density + E9 emergence + E7 payoffs are all *content multipliers*; playtest at M2 and M3, not just M4 |
| Solo bandwidth vs plan size | High | Half-done epics everywhere | Milestones are shippable; pivot valves pre-planned; audit §8: cut breadth, never the memory loops |
| IndexedDB edge cases (Safari, private mode) | Medium | Save loss on some platforms | E3.S1 write-through keeps localStorage authoritative for the hot slice; feature-detect + banner |
| LLM cost creep as context grows | Low | Budget balloons | Cost model says ~$2–3.5/80h text; E11.S3 budget tests + E10.S4 meter + caching keep it observable |

## 5. Decisions needed from the owner

1. **Free tier:** capped proxy demo or BYOK-only? (E0.S1 blocks on this.)
2. **Pivot commitment:** full open world, or pre-commit to hub-and-spoke (audit's
   recommendation) — decide before E6.S2 spends on continents.
3. **Rules edition:** declare SRD 5.2 and schedule the engine edition audit (S7/P1-13) —
   in which epic? (Suggest: alongside E8, since it touches the same tables.)
4. **Campaign locale policy:** lock at generation or regenerate-on-switch (E10.S5).
5. **The Quiet Stair:** does the reserved authored adventure become Pivot-3 content, a
   flagship act-1 for the generated campaign, or stay parked?

## 6. Traceability

Every audit P0 lands in E0–E1 (P0-1→E0.S1 · P0-2→E1.S1 · P0-3→E1.S2 · P0-4→E1.S3 ·
P0-5→E1.S4 · P0-6→E0.S4 · P0-7→E1.S5 · P0-8→E1.S6 · P0-9/10/11→E1.S7 · P0-12→E0.S2).
Every P1: P1-1/P1-2→E3–E4 · P1-3→E2.S3 · P1-4→E5.S2 · P1-5→E5.S3 · P1-6→E8.S1 ·
P1-7→E2.S2 · P1-8→E7.S1-3 · P1-9→E6.S1 · P1-10→E5.S1 · P1-11→E10.S1 · P1-12→E10.S4 ·
P1-13→E8/decision 3 · P1-14→E5.S3+E10.S5 · P1-15→E10.S1-2 · P1-16→E1.S7+E10.S3 ·
P1-17→E0.S3 · P1-18→E8.S4. The ledger architecture (E2) and emergence layer (E9) are the
two additions beyond the audit — they implement the owner's stated vision ("world unfolds
from lore, made up by the GM, persisted") on the seams the audit identified.

---

*Companion documents: [audit synthesis](2026-08-comprehensive-audit.md) ·
[full findings appendix](2026-08-comprehensive-audit-appendix.md).*
