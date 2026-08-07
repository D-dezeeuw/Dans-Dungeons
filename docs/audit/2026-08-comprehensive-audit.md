# Comprehensive Audit — Dan's Dungeons & the bag-of-holding ecosystem

> **Date:** 2026-08-07 · **Scope:** all four repos (`Dans-Dungeons`, `bag-of-holding`,
> `bag-of-holding-client`, `bag-of-holding-mcp`) · **Method:** 13 specialized audit agents
> (engine correctness, campaign systems, client toolkit, MCP, AI runtime, game logic,
> persistence, UI/UX, vision-vs-docs, lore, cost/latency, cross-repo consistency, 80-hour
> architecture), followed by an adversarial verification pass on the 10 most severe claims
> and a completeness critic that hunted for blind spots (security, legal, CI, privacy,
> multi-tab). Every finding cites `file:line` evidence; verified claims are labeled
> **CONFIRMED** / **PARTIAL** (none of the 10 were refuted).
>
> **This file is the synthesis.** The complete evidence base — all 212 findings
> (17 critical / 54 high / 93 medium / 48 low), 146 recommendations with code snippets,
> per-area strengths, and collected metrics — lives in the companion appendix:
> **[`2026-08-comprehensive-audit-appendix.md`](2026-08-comprehensive-audit-appendix.md)**.
> Nothing in this audit modifies code; every fix is a recommendation only.

---

## 1. Executive verdict

**The codebase is a well-engineered 2–4-hour game wearing the design documents of an
80–100-hour game — and its default configuration is broken in production right now.**

Three sentences of calibration before the bad news, because they change what kind of
project this is:

1. **The foundations are genuinely strong.** 2,019 tests pass across the four repos
   (267 app + 92 client + 1,561 engine + 99 MCP). The rules engine has 99.94% line
   coverage and its determinism architecture (injectable RNG, roll logs, seeded replay)
   is exemplary. The turn pipeline is properly atomic — nothing commits until narration
   succeeds. The time-travel/undo/branching system is a genuinely differentiating feature
   most commercial text games don't have. The library extraction
   (`bag-of-holding-client`) is clean, config-injected, and byte-identical to its
   vendored copy today.

2. **The "inconsistent mess" feeling is real, but it is mostly *doc drift and
   unfinished convergence*, not architectural rot.** The `docs/ideas` folder describes
   two different products (an open-world epic in docs 00–12; a dungeon+settlement
   crawler in docs 14–16) and the repo contains a third. README/CLAUDE.md describe
   deleted files, deny features that shipped (voice, images, service worker), and
   promise features that never existed (unpkg pinning, BYOK-only). Meanwhile the engine
   ships rich systems (branching beat threads, archetype casting, solo oracle, scene
   clock, SRD travel, XP) that the game never calls, while the game reimplements
   simpler versions of the same ideas. That is the mess: **three repos' overlapping
   abstractions that never converged**, plus documentation nobody can trust.

3. **The 80-hour goal is blocked by four missing subsystems, not by any single bug**
   — persistence at scale, narrative memory, world topology, and story-arc depth. All
   four have clean seams already present in the code. The dependency-ordered plan is
   in §7, and honest pivot options are in §8.

**But the house is on fire in one specific place:** the default free-tier onboarding
path cannot play a single turn today. The free `medium` model ID
(`openai/gpt-oss-120b:free`) no longer exists on OpenRouter, all four fallback-chain
models are also dead, and the model map is snapshotted into saves so existing players
stay broken even after the config is fixed. Combined with the missing chip containers
(the entire click-to-play layer silently no-ops — the shop is literally unusable) and
the silent save-quota data loss, a new player's first session is far below the bar the
project sets for itself — never mind AAA.

**Play ceiling today:** ~2–4 hours of coherent play (one generated arc), mechanically
playable but structurally repetitive to ~10–20 hours, with a storage wall at ~20–50
hours ending in *silent* data loss. Narrative memory fails far earlier: the narrator
sees only the last 3 transcript entries (1.5 turns), so the GM forgets events from ten
minutes ago within the first hour of play.

---

## 2. The showstoppers

Ten claims went through independent adversarial verification (a second agent tasked
with *refuting* each by re-tracing the code). Seven were confirmed exactly as stated,
three confirmed with corrections, zero refuted. Full verification transcripts are in
the appendix; corrections are folded in below.

### S1 — The default free tier cannot play a turn **[CONFIRMED]**
`FREE_MODELS.medium = 'openai/gpt-oss-120b:free'` (`src/ai/tiers.js:18`) does not exist
in OpenRouter's live catalog (400-model list fetched 2026-08-07; only `gpt-oss-20b:free`
and the *paid* 120b exist). Medium powers the narrator, journal, travel narration, and
all five worldgen layers — so campaign start aborts and every dungeon turn ends in
"GM unavailable" after burning a working classifier call. All four `FREE_FALLBACKS`
models are *also* delisted (`qwen/qwen3-72b:free` likely never existed), and the
fallback walker aborts on the first non-429 error anyway
(`bag-of-holding-client/src/llm/client.js:57-63`). Worst part: `applyTier()` persists
the model map into saves (`flow.js:117-130`, `state.js:147`), so **fixing `tiers.js`
alone will not heal existing saves** — a boot-time model refresh/migration is required.
Fix shape (validate at boot, never persist raw IDs without a version):

```js
// boot: validate configured models against the live catalog, heal dead IDs
const live = new Set((await fetch(`${baseUrl}/models`).then(r => r.json())).data.map(m => m.id));
const healed = Object.fromEntries(Object.entries(appState.ai.models)
  .map(([slot, id]) => [slot, (id && live.has(id)) ? id : modelsForTier(appState.ai.tier)[slot]]));
setValue('ai.models', healed); // + surface a toast when a slot was healed
```

### S2 — The click-to-play layer never existed **[CONFIRMED]**
`#action-chips` / `#character-chips` / `#skill-chips` appear in `index.html` in **no
revision in the repo's history** — every `showActionChips`/`insertActionChip` call
silently no-ops behind a null-guard (`chips.js:74-75` etc., 9 dead call sites). The
shop displays "Wares for sale:" and then *nothing* (wares exist only as chips);
settlement fast travel is dead code end-to-end (no chip, and no free-text intent
either — `flow.js:495` vs `flow.js:630-658`); the Retry, Flee, NPC-leave, and Restart
chips are all invisible. Free-text play works, so this is not a lockout — but the shop
and fast travel are unusable, and every affordance the campaign layer was written
against is missing. Fix: add the three containers to `index.html`, and add a DOM-contract
smoke test so this class of regression can never ship silently again:

```html
<div id="action-chips" class="chip-row"></div>
<div id="character-chips" class="chip-row"></div>
<div id="skill-chips" class="chip-row"></div>
```

### S3 — Mid-encounter saves soft-brick the campaign **[CONFIRMED]**
`runEncounter` swaps the real world fields for a transient `'encounter'` room, keeping
the originals only in a local variable (`flow.js:967-987`), while every combat turn
autosaves the swapped state. Reload during an encounter → `resumeGame` routes into
`playLoop` → victory path returns to no caller → no active prompt, input inert, on
*every* subsequent reload. No in-game recovery exists (`/restart` is only reachable
inside a live prompt consumer; undo refuses by design). The campaign data survives in
the save — it's the resume *routing* that's dead — but for the player it's a bricked
save. Fix: persist the swap-out snapshot inside the save (e.g. `world.encounterReturn`)
and give `resumeGame` an explicit `'encounter'` route that restores it.

### S4 — Save growth is quadratic and quota failure is silent **[PARTIAL — confirmed with corrections]** 
`appendTranscript` records the *full transcript array* as one history entry per turn
(`resolver.js:301-305`), the persisted time-travel spine carries one such copy per turn
plus a deep-cloned state root (`undo.js:100,371`), and `MAX_TT_ENTRIES=500` caps entry
*count*, not bytes. Measured: ~3.7MB at turn 200, ~7.6MB at turn 400 with 25-turn
epochs — past the ~5MB quota. Correction from verification: the failure **self-heals
between dungeons** (epoch resets shrink the save back to baseline), so the true defect
is a *recurring silent autosave-failure window* in mid/late campaign — close the tab
in that window and the dungeon run is gone. Aggravators: `saveEnvelope` swallows
`QuotaExceededError` and `saveToStorage` only `console.warn`s (`state.js:169-173`) —
and `/save` prints "saved" **unconditionally** even when the write failed
(`flow.js:251`). Even without time-travel, the never-trimmed transcript alone nears
quota by ~4,800 turns, so the 80h target dies either way. Fixes: narrow per-index
transcript writes, byte-budget + loud quota UX now; the IndexedDB split (§7 Phase B)
is the real cure.

```js
// resolver.js — append one entry, don't re-record the whole array
export function appendTranscript(playerText, narration) {
  const i = appState.transcript.length;
  setValue(`transcript.${i}`,     { role: 'player', text: playerText });
  setValue(`transcript.${i + 1}`, { role: 'gm',     text: narration });
}
```

### S5 — The engine's flagship replay promise is broken **[CONFIRMED]**
`verifyLog` throws `Cannot replay unknown roll op` on any log containing a death save
or a class-mechanic use — ops the engine itself records since v1.25.0
(`bag-of-holding/src/replay.js:152-153` vs `engine.js:629,835`). Every real session
with a 0-HP drop or a Second Wind breaks the audit path; the 1,561-test suite never
noticed because the replay tests only exercise the nine replayable ops. Decisive
proof it's real: **Dan's Dungeons already discovered this and works around it**
(`src/game/rng.js:77-80` re-encodes death saves as bare `rollDie(20)` "because
verifyLog can't replay them"). Additionally, Travel/Equipment/Movement/MagicItems
rolls and surprised-initiative draws consume the shared seeded RNG *without logging*,
silently desyncing replay, and `Session.restore` crashes on any save made after an
encounter ended. Fix: make `verifyLog` total over the recorded op vocabulary (skip
no-RNG ops, replay `deathSave` as one d20), route every engine RNG draw through
`record()`, and re-adopt serialized non-party actors in `Session.restore`.

### S6 — The vendored engine is a version chimera **[PARTIAL — confirmed with corrections]**
`vendor/bag-of-holding/` is engine v1.16.0 (46/47 files byte-identical to commit
`eeebb63`) with exactly one file — `src/srd/monsters.js` — taken from v1.27.0, because
the game's 24 dungeon themes need the 66-monster bestiary. The sibling engine repo is
at 2.1.0: 29 files differ, six whole modules (equipment, hazards, mounted-combat,
travel, solo/) and a dozen exports are missing from what the game ships. No manifest,
no version stamp, no sync script records any of this. Correction: a naive re-vendor
would *not* be fully silent (some game tests pin engine behavior) — but semantics-level
changes that keep APIs stable would land silently under existing saves. Verification
also surfaced a **new engine-side bug**: merge `c4654c7` silently dropped the v1.6.1
condition-record API (`conditionName`, `conditionsRequiringSave`) that commit `7badf09`
had added. Fix: deliberately re-vendor at a chosen pin, absorb the delta once, and add
a manifest + drift test:

```js
// vendor/bag-of-holding/VENDOR.json  +  a test that fails on undeclared drift
{ "package": "@zeeuw/bag-of-holding", "version": "2.1.0", "commit": "<sha>",
  "patchedFiles": [] }
```

### S7 — Two editions of D&D under one label **[CONFIRMED]**
The engine claims SRD 5.2 (2024) everywhere (~80 doc-comment citations, README badge),
but load-bearing tables are 5.1/2014: half-casters can't cast at level 1
(`spellcasting.js:87`), prepared-spell counts use the 2014 formula, the monster
statblocks are 2014 numbers (goblin HP 7 vs 5.2's 10; an orc that isn't in SRD 5.2 at
all), Fighter Second Wind has 1 use (2024: 2), Barbarian L20 rage is unlimited (2014).
Multiclass half-caster rounding matches *neither* edition. This matters beyond
pedantry: the narrator LLM is trained on 2024 rules, so **the deterministic ground
truth and the narrator will visibly contradict each other** — the exact failure the
engine exists to prevent. Fix: declare one edition (recommend 5.2), audit every table
against it, and tag any deliberate deviation `// HOUSE RULE:` so the label is honest.

### S8 — The BYOK pillar was silently abandoned, and the shared key is a liability **[CONFIRMED, security]**
`tiers.js:9-11` ships an XOR-obfuscated OpenRouter API key in the public bundle of a
public repo — trivially decodable by anyone (during this audit, three sandboxed
subagents independently decoded it, which is exactly what any curious player can do;
**rotate/revoke that key**). Beyond the leak: OpenRouter free-model caps are enforced
*per account* — 50 requests/day (1,000 with $10 credits) shared across **the entire
worldwide player base**. At 2–3 calls per turn that is ~16–25 turns per day for all
free players combined; the free tier can never be more than a demo, and the docs'
BYOK-only privacy stance (doc 05) is contradicted by every free-tier player's prose
transiting the owner's account with zero disclosure. Related hardening: save import
blindly restores `ai.baseUrl` + key while CSP `connect-src` is a wide-open `https:`
(a malicious `.dnd.json` exfiltrates the player's key to any origin), the export
writes the player's key into the shareable save file, the "PKCE" OAuth flow has no
PKCE, and `?key=` accepts a raw key in a URL. Fixes: rotate the key; make free tier an
explicit "demo (shared, limited)" product or drop it; strip `ai.key`/`ai.baseUrl` from
exports and validate them on import; pin `connect-src` to the configured base URL;
implement real PKCE.

### S9 — Nothing gates a deploy **[critic finding]**
Across four repos there is exactly one GitHub workflow (the engine's Pages deploy,
build-only). Zero CI runs a single test. Dan's Dungeons deploys to production by
pushing `main` with a *locally built, committed* bundle — nothing verifies
`vendor/app.bundle.js` matches `src/`. The chimera in S6 proves this class of drift
already happens. The dead-chips defect (S2) survived the repo's entire history because
no test loads `index.html`. Fix: a ~20-line workflow per repo (`npm test` +
`node build.js` + bundle-freshness diff) and a DOM-contract smoke test; deploy the
CI-built bundle instead of the committed one.

### S10 — The lock-and-key puzzle usually isn't one **[client-toolkit, empirical]**
The dungeon generator locks only the single spine edge, but exits are derived for
*all* grid-adjacent room pairs — in a 5,000-seed empirical run, **the vault was
reachable without the key 68.7% of the time** (0 soft-locks, to its credit). The
signature puzzle mechanic is decorative in two of three dungeons. Fix: lock every
edge crossing the pre-gate/post-gate partition (make the lock a graph cut), both
directions.

---

## 3. Area scorecard

Grades weigh fitness-for-purpose against the project's own 80h/AAA bar, not effort.
Every row expands into a full section in the appendix.

| Area | Grade | One-line verdict |
|---|---|---|
| Rules engine core (`bag-of-holding`) | **B+** | Exemplary determinism + tests; edition mixing (S7) and a handful of real rules defects (silent slot upcast, no adv/dis on checks, string spell components). |
| Engine campaign systems | **C+** | Encounter math is DMG-exact, but replay is broken (S5), bestiary tops out at CR 15 with zero structured mechanics blocks, and the rich beat runtime has no consumer. |
| Client toolkit (`bag-of-holding-client`) | **B** | Best-factored repo; clean seams; but no abort/timeout anywhere in the LLM stack, no pipeline resumability, and the lock bug (S10). |
| MCP server | **C** | Well-crafted but frozen at the engine's 1.0-era surface: a Claude DM can roll an attack but can't look up a goblin, take damage, rest, or cast; peer dep excludes the engine it's tested against. |
| Game logic (`Dans-Dungeons/src/game`) | **C+** | Atomic turn pipeline done right; but no XP/leveling ever, dungeon state never persists on re-entry, 9 of 14 intents fall through to fiction, and `flow.js` is a 1,539-line god module. |
| AI runtime & prompts | **C** | Clean adapter architecture and honest determinism boundaries, but dead model IDs (S1), a 1.5-turn memory horizon, no anti-invention guard for exits/items/NPCs, and narrated state changes for intents that resolve nothing. |
| Cost & latency | **B−** | Architecture is genuinely cheap (~$0.0008/turn, ~$2 text for 80h paid); but the cost meter shows $0.00 forever, images are a hidden 47× multiplier (~$95/80h), and the free tier is arithmetically impossible (S8). |
| State & persistence | **C+** | Versioned envelope + migrations + time-travel are real strengths; quadratic save growth with silent quota loss (S4), no IndexedDB despite docs calling it "essential, not optional". |
| UI / UX | **C−** | Disciplined XSS story and CLS-proofed boot; but the chip layer never existed (S2), the SW update check defeats itself, OAuth onboarding lands paid users on free models, and 5–30s waits show a static "…". |
| Lore & narrative | **C** | Micro-writing is genuinely good; but there is no setting (one proper noun in the whole corpus), the generated arc is 1.5–7.5h of content for an 80h goal, tone pipeline contradicts itself, and NL is missing 39 of 48 enemy intros. |
| Vision & docs | **D+** | Docs describe two products, the repo is a third; non-goals lists contradict shipped features; known bugs documented in June are still live; effort went 45-commits-deep on time-travel while every 80h-gating system got zero. |
| Cross-repo consistency | **C** | Client extraction is exemplary; engine vendoring is a chimera (S6); duplicated overlays/model tables; ~1,900 lines of game tests re-test library code and have already drifted. |
| Security / legal / ops (critic) | **D** | No CI (S9), embedded key (S8), prompt injection undefended, no LICENSE/SRD attribution in the shipped game, "D&D" trademark in marketing copy, multi-tab save clobbering. |

---

## 4. Where the "inconsistent mess" actually lives

Six patterns explain nearly all 212 findings. Naming them matters because each has a
different cure:

1. **Doc drift.** The docs describe products that don't exist and deny features that
   do. A contributor cannot currently trust README, CLAUDE.md, or docs 00–12. *Cure:
   one triage pass stamping every doc with a real status (§7 Phase 0) — cheap, high
   leverage.*

2. **Machinery without content, content without a consumer.** Branching beat threads,
   archetype casting, the solo oracle, scene clock, SRD travel, XP/leveling, the
   `large` tier, monster mechanics (legendary/lair actions) — all built, tested, and
   never called. Meanwhile the game re-implements simpler beat logic in the client
   library. *Cure: every system gets exactly one owner (§7 Phase D adopts the engine
   beat runtime; delete or park the rest explicitly).*

3. **Silent failure as house style.** Dead chips no-op behind null-guards; quota
   failure `console.warn`s while `/save` prints "saved"; dead model IDs surface as
   generic "GM unavailable"; migrations skip missing steps silently; future-version
   saves load silently; `narrateTravel` returns null on *any* error. AAA feel dies
   here — the player can't distinguish "the dice hate me" from "the app is broken."
   *Cure: an error-surfacing standard — every failure is either recovered, or loudly
   attributed with a player-actionable message. Never both silent and unrecovered.*

4. **Duplication that drifts.** The 24-theme overlay table and the model-tier tables
   exist verbatim in two repos; the vendored engine is a chimera; a third hand-rolled
   GM loop lives in the engine's `examples/solo.html`; ~1,900 lines of game tests
   re-test client-library behavior and have already drifted from the client's own
   suite. *Cure: vendor manifest + drift tests (S6), import-don't-copy, one owner per
   behavior test.*

5. **The deterministic promise, kept only 5/14ths.** Only `attack`, `skill`, `move`,
   `take`, `unlock` resolve mechanically. `rest`, `talk`, `look`, `buy`, `travel`,
   `wait`, `inventory`, `use`, `flee` in a dungeon return a bare `{intent}` and the
   narrator *improvises unverified fiction* — "rest" narrates recovery while HP stays
   unchanged; a successful stealth check is narrated as success while the goblin's
   retaliation lands in the same paragraph. This is the single largest LLM-quality
   lever in the project (§6). *Cure: every intent either resolves deterministically or
   is explicitly declared `noEffect: true` to the narrator, with prompt rules for each.*

6. **Effort allocation drift.** Roughly the last 45 of 83 commits are time-travel
   work — excellent work — while context scoping, sessions, storage scale, and
   progression (the four 80h gates) received zero commits. *Cure: the §7 sequence, and
   a rule: no new polish system before the current phase's gate ships.*

---

## 5. LLM quality, speed, and cost — the numbers

**Quality mechanisms that exist and work:** rules resolve before narration and the
narrator receives resolved facts it may not contradict on the 5 mechanized intents;
victory/defeat/secrets are host-gated, never model-decided; prompts are lean
(≤ ~400 tokens of template), imperative, and fully mirrored in Dutch; the two-stage
JSON strategy (parse → one repair call) is sound; temperature discipline is right
(0.1 classify / 0.85 narrate).

**Quality mechanisms that are missing:** memory (3 transcript entries ≈ 1.5 turns —
the prompt itself falsely claims "last 3 turns"); anti-invention rules for
exits/items/NPCs/rooms (only dice are protected); any feedback loop that writes what
the narrator *said* back into canon (nothing the GM invents is ever remembered);
schema enforcement on the streamed narrator call (markdown-fenced JSON triggers a full
paid re-generation, and the repaired text can differ from what the player watched
stream); DC discipline (the classifier invents DCs with no rubric and the resolver
accepts them unclamped); tone threading (narrator hardcodes "gritty low fantasy"
regardless of the generated world's tone; NPC dialogue gets no world context at all).

**Latency per campaign turn** (measured template sizes, streaming):
~1s classifier round-trip (paid even for chip clicks that are already structured
commands) → resolve (instant) → ~1.2–2.5s to first streamed narration token →
narration streams → **+0.5–1.2s blocking beat-check after the stream ends**. Two easy
wins: skip the classifier for chip/compass input, and move the beat check off the
critical path (fire-and-forget before finalize).

**Cost per turn / campaign** (live OpenRouter prices, 2026-08-07, paid tier):

| Item | Tokens (in/out) | Cost |
|---|---|---|
| Classifier (gemini-2.5-flash-lite) | ~850 / 60 | ~$0.0001 |
| Narrator (deepseek-v4-pro, streamed) | ~1,300 / 140 | ~$0.0007 |
| Beat check (campaign turns) | ~180 / 40 | ~$0.00003 |
| **Text turn total** | ~2,280 / 240 | **~$0.0008** |
| Scene image (when enabled, *every turn*) | ~1,290 img-out tok | **~$0.039 = 47× the text turn** |
| 80h campaign, text only (~2,400 turns) | ~6M | **~$2–3.5** |
| 80h campaign, images every turn | | **~$95** |

Conclusions: (a) the 80h campaign is **trivially affordable on text** — cost is not
the binding constraint, memory is; (b) images need rationing (per-room instead of
per-turn: ~8× cheaper) plus a manual "sketch this" affordance; (c) the free tier is
not economically real (S8) regardless of dead IDs — 50 shared requests/day is ~20
turns worldwide; (d) the promised cost meter must read `usage.cost` (already in every
OpenRouter response) instead of showing $0.0000 forever; (e) prompt-prefix caching
(12–120× cached-input discounts on the configured models) is free money once the scope
packet has a stable prefix layout.

---

## 6. Lore & content: why 80 hours has nothing to run on

- **There is no setting.** The only proper noun in the authored corpus is "Grizzik
  the Goblin" — who lives in a dead data block, yet still narrates every defeat
  regardless of who killed you. World identity per campaign is a ~30-word digest, 2–3
  gods, 2–3 factions, and 3–5 abstract beats. Room flavour is genuinely well-written
  but generic-fantasy; all 24 dungeon themes dress the same manor-shaped rooms
  (nursery, wine cellar, foyer — in a "flooded cavern").
- **The red thread is 1.5–7.5 hours long by its own prompt's arithmetic**
  (3–5 beats × 30–90 min `targetPlaytimeMinutes`), linear, with no acts layer, no
  failure states, no beat→NPC/location binding (archetype casting is never called),
  and no finale — completing the last beat changes a progress line in `/story`.
- **Foreshadowing is cosmetic** ("clue" discoveries have no content), NPC dialogue is
  world-blind, and the "World Bible" export generates a *fresh random world* instead
  of documenting the campaign being played.
- **NL parity is superficial**: identical key sets, but 39 of 48 enemy intros fall
  back to one generic line, ~28 creatures show English names, and "the planes" is
  translated as "de vlakten" (plains).

What 80 hours actually needs, content-wise (all snippetted in the appendix):
an **acts layer** above beats, generated lazily per act with digest handoff; a
**persistent canon store** (the live lore bible: every fact the narrator states gets
extracted and becomes citable context — this is also the anti-contradiction mechanism);
**arc templates + faction webs** so generated stories have load-bearing shape; and a
**payoff ledger** (planted clue → obligated payoff beat) so foreshadowing means
something.

---

## 7. The road to 80 hours — dependency-ordered plan

The order below is a strict dependency chain: each phase makes the next one buildable
and testable. Effort keys: S ≤ 1 day, M ≤ 1 week, L ≤ 1 month, XL > 1 month
(single-developer equivalents).

### Phase 0 — Make the repo tell the truth (S–M, do immediately)
Doc triage: stamp every `docs/ideas` file `CURRENT / PARTIAL / PARKED / CUT`; rewrite
README + CLAUDE.md to match reality; fix the two bugs doc 14 documented in June that
are still live (tone enum, NL parity); add the vendor manifest (S6); **rotate the
embedded key** (S8); bump the MCP peer dep. Nothing else in this plan can be trusted
while the map lies about the territory.

### Phase A — Stop the bleeding (S each; ~2 weeks total)
The showstoppers: S1 model healing + boot validation; S2 chip containers + DOM smoke
test; S3 encounter-resume route; S4 narrow transcript writes + loud quota UX; S9 CI in
all four repos; S10 lock cut; strip keys from save export; fix `castSpell` silent slot
burn; `verifyLog` totality + `Session.restore`. Plus the two pure-win latency fixes
(chip-click classifier bypass; beat check off critical path) and image rationing.
**Gate: a new player on defaults plays a full dungeon with zero silent failures, and
CI would have caught every fix in this phase.**

### Phase B — Storage + memory: the enablers (M+L)
1. **Persistence split** — IndexedDB cold store (transcript history, journal, sketches,
   time-travel epochs) + localStorage hot slice (world, party, session, last ~50
   transcript entries), with `navigator.storage.estimate` monitoring and the doc-06
   quota UX. The envelope/migration machinery already exists; it needs an async
   storage adapter.
2. **Chapters + rolling digests** — the single highest-leverage feature in the entire
   audit. The journal summarizer (built, cached, tested) is the exact machinery
   needed; it currently feeds only the EPUB. Repoint it at play:

```js
// session shape — chapter boundaries + rolling memory
session: {
  chapterId: 'ch-3',
  chapters: [{ id: 'ch-1', title: 'The Vault of Ash', digest: '~150 tok summary',
               startTurn: 0, endTurn: 143 }],
  rollingDigest: '~300 tok summary of the current chapter so far',
}
// narrator context becomes: chapter digests (old, cheap, stable-prefix → cacheable)
// + rollingDigest + last 10-15 transcript entries + scene + story context.
// Refresh rollingDigest every N turns with a tiny-tier call; cut a chapter on
// dungeon-clear / region-change / long-rest.
```

3. **Canon extraction** — after each narration, a tiny-tier call extracts asserted
   facts (`npc.blacksmith.knows-about-key`, `loc.chapel.desecrated`) into a canon
   store that the scope assembler serves back. This closes the loop that currently
   lets the GM contradict itself: *nothing the narrator says is remembered today*.

**Gate: play 10 hours; the GM correctly references an event from hour 2; the save is
< 1MB hot / unbounded cold; quota warnings are loud.**

### Phase C — World graph + scope assembler (M+M)
1. **Geography graph** — kill the star topology. Regions pre-mint stable IDs for
   neighbors at generation time (cheap stubs, hydrated lazily on first visit), roads
   get real `targetId`s, and adjacency becomes IDs, not display strings:

```js
world.geography = {
  nodes: { 'region.emberfen': { stub: false }, 'region.saltmarch': { stub: true } },
  edges: [{ from: 'region.emberfen', to: 'region.saltmarch',
            kind: 'road', days: 2, discovered: true }],
}
```

2. **Scope assembler v1** — formalize `buildScene` into the doc-12 packet
   (here / nearby / region digest / world digest / PC memory / canon hits / secrets
   *filter* — GM-private data stops riding in the same object the UI can read), with
   a token budget per tier and a stable prefix order for prompt caching. Defer
   RAG/embeddings; a keyword inverted index over canon + transcript chunks covers most
   recall at zero infra cost, and the packet interface is where embeddings plug in
   later without redesign.

**Gate: walk region A → B → A; everything persists; narrator packet stays ≤ ~3k
tokens at hour 20.**

### Phase D — A story worth 80 hours + progression (L+L)
1. **Red thread v2** — adopt the engine's beat runtime (successors, sub-threads,
   casting) as the one owner (retire the client-lib linear evaluator); add the acts
   layer (§6) with per-act lazy generation and digest handoff; bind beats to cast
   NPCs/locations; make *flags* the primary completion signal (deterministic) with the
   LLM judge as fallback only; add failure/timeout states so a stalled beat degrades
   the world instead of freezing it.
2. **Progression** — the engine ships all the math; the game never calls it. XP on
   kills/clears/beats, level-up flow re-deriving the sheet, spells for casters, and
   loot that matters (the equipment/magic-items modules are sitting unused in the
   sibling repo — this is what the S6 re-vendor unlocks).
3. **Content depth** — bestiary CR 16–24 with structured mechanics blocks (the
   monster-mechanics module is complete and consumes nothing); spell effects data;
   2–3 more settlement/dungeon shapes so the loop isn't structurally identical.

**Gate: a 3-act campaign completes; a character reaches level 5+; act 2 references
act 1 through the canon store, not luck.**

### Phase E — AAA hardening (parallel with D)
The UX debt that separates "works" from "feels AAA": staged thinking indicator +
elapsed time + cancel on 5–30s waits; stick-to-bottom scrolling; clickable pickFrom;
PWA manifest + iOS fixes; a11y (focus rings, ARIA, contrast, rem typography); real
PKCE; multi-tab Web Locks; licensing (LICENSE + SRD CC-BY-4.0 attribution + drop the
"D&D" trademark from marketing copy); free-tier consent notice; prompt-injection
hardening for the secrets path (secrets-by-reference before doc-08's asymmetry model
scales the blast radius).

---

## 8. Pivot options — if the full open world is too much

The full vision (Phases 0–E) is roughly 4–6 months of focused solo work. Three
coherent pivots, in descending order of recommendation:

### Pivot 1 — Hub-and-spoke campaign *(recommended)*
One deeply-simulated hub region (settlement + surrounding sites) per act; spokes are
generated dungeons/sites; travel between acts is narrated montage with digest handoff,
not simulated overworld. **Cuts Phase C's geography graph entirely** (the settlement
loop already *is* a hub), keeps Phases B and D intact, and honestly matches what the
engine + content pipeline are already good at. 80 hours = 4–5 acts × 4–6 spokes.
This is the cheapest path that still delivers "a red line through a world that
remembers you." Cost: the world feels *deep* rather than *wide* — closer to
Baldur's Gate chapters than Skyrim.

### Pivot 2 — Episodic campaign (8 × 10h chapters)
Self-contained chapter worlds, each generated fresh; continuity carried by the PC
record + a chapter-digest chain + a persistent faction/NPC roster that re-casts across
chapters. Cuts the geography graph *and* most of the canon store (each chapter's
active canon is small). Storage stays trivially inside localStorage. Cost: the world
visibly resets between chapters — the "truly open, granular world" pillar is
explicitly traded away for reliability and shippability. This is the safest pivot if
solo-dev time is the binding constraint.

### Pivot 3 — Authored spine, generated flesh
Hand-author the red line (5 acts, ~30 beats, real named factions/villain — i.e.
finally write the lore bible as *content*, and take the reserved "Quiet Stair" slot
seriously as the flagship campaign); generate everything around it (dungeons,
side-quests, NPCs, towns). Kills the "infinite worlds" pillar for the main campaign
but guarantees the red line lands with authored foreshadowing and a real finale —
the most reliable route to *AAA-feeling* storytelling, and the two content pillars
(authored spine, generated side content) can ship in either order. Cost: replayability
shifts to the generated layer; the authored campaign is a large writing project.

**Non-negotiables under every pivot:** Phase 0 and Phase A (the product is broken
today regardless of vision), the persistence split, chapters/rolling digests, canon
extraction, and progression. Those five are vision-independent.

**Also decide deliberately, whichever pivot:** (a) free tier becomes an explicit
capped demo or dies — it cannot be the 80h path (S8); (b) the MCP server either
re-syncs and becomes the dev-time balance/playtest harness (its genuinely valuable
role: rules-correct simulation from Claude during content development) or gets an
honest "parked" README; (c) one beat runtime, one overlay table, one model table —
every duplicated system gets exactly one owner.

---

## 9. What is genuinely strong (protect these)

Worth naming explicitly so refactors don't destroy them: the atomic turn pipeline
with correct failure semantics; the seeded-RNG/replay architecture end-to-end
(engine → `rng.js` → verify button); the engine's test discipline (1,561 tests, 2.7s,
99.94%); Spektrum write discipline (zero direct mutations in `src/`); the versioned
save envelope + migration runner; the time-travel/branching system and doc 16's
design-doc quality; the `bag-of-holding-client` extraction and its config-injection
boundary; XSS discipline (`textContent` everywhere, `__proto__` guards in Spektrum,
escaped EPUB output — the one unescaped sink is the sketch-gallery export); the
digest-threaded worldgen pipeline with schema-constrained blueprints; streaming
narration UX; the EPUB journal pipeline; micro-level flavour writing; bilingual
prompt/string mirroring as an architecture (the parity gaps are content debt, not
design debt); and the MCP server's tool craftsmanship (46 tools, 100% coverage,
correct wire behavior) — frozen, but well-made.

---

## 10. Consolidated priority table

P0 = broken now / data loss / security; P1 = gates the 80h goal. (P2/P3 in appendix.)

| # | Fix | Repo | Effort | From |
|---|---|---|---|---|
| P0-1 | Rotate the embedded OpenRouter key; decide the free tier's honest future | game | S | S8 |
| P0-2 | Replace dead model IDs; boot-time model validation + save healing | game+client | S | S1 |
| P0-3 | Restore chip containers + DOM smoke test | game | S | S2 |
| P0-4 | Encounter-resume route (un-brick mid-encounter saves) | game | S | S3 |
| P0-5 | Narrow transcript/rollLog writes; loud quota UX; honest `/save` | game+client | M | S4 |
| P0-6 | CI running tests in all four repos; CI-built deploys | all | S | S9 |
| P0-7 | `verifyLog` totality; log all RNG draws; fix `Session.restore` | engine | M | S5 |
| P0-8 | Vendor manifest + deliberate re-vendor at a chosen pin | game | M | S6 |
| P0-9 | Strip key/baseUrl from save export; validate on import; pin `connect-src` | game | S | critic |
| P0-10 | Lock-and-key graph cut | client | S | S10 |
| P0-11 | `castSpell` silent higher-slot burn | engine | S | engine-core |
| P0-12 | Doc triage pass (stamp statuses; fix README/CLAUDE.md) | all | M | vision-docs |
| P1-1 | Chapters + rolling digest into narrator context | game | M | scale-80h |
| P1-2 | IndexedDB cold store / localStorage hot slice | game+client | L | scale-80h |
| P1-3 | Canon extraction + serve-back (the anti-contradiction loop) | game | M | lore |
| P1-4 | Close the intent gap (mechanize or declare `noEffect`) | game | M | game-logic |
| P1-5 | Anti-invention narrator rules + wider window + streamed-text-is-canon | game | M | ai-runtime |
| P1-6 | XP/leveling/spells wired to the engine's existing math | game | M | game-logic |
| P1-7 | Persist dungeon interiors on exit/commit | game | S | game-logic |
| P1-8 | One beat runtime + acts layer + casting + failure states | engine+game | L | lore/scale |
| P1-9 | Geography graph with pre-minted stable IDs *(skip under Pivot 1/2)* | game+client | M | scale-80h |
| P1-10 | Scope assembler v1 with secrets filter + token budget | game | M | scale-80h |
| P1-11 | Abort/timeout through the whole LLM stack; pipeline checkpoint/resume | client | M | client |
| P1-12 | `usage.cost` → real cost meter; image rationing; classifier bypass for chips; beat check off critical path | game+client | S | cost |
| P1-13 | Edition audit: one SRD, labeled house rules | engine | L | S7 |
| P1-14 | Tone threading end-to-end; world-aware NPC dialogue; NL parity pass | game | M | lore |
| P1-15 | Wait-state UX (staged indicator, cancel), clickable pickFrom, PWA manifest | game | M | ui-ux |
| P1-16 | SW: exclude `app.version` from runtime cache; finish OAuth tier step; PKCE | game | S | ui-ux |
| P1-17 | LICENSE + SRD CC-BY attribution + trademark scrub + privacy notice | game | S | critic |
| P1-18 | Bestiary depth: CR 16–24, structured mechanics blocks | engine | L | engine-content |

---

## 11. Note on this audit's own security event

During the audit, three sandboxed analysis agents independently XOR-decoded the
embedded OpenRouter key from `tiers.js` (one used it for a live capability probe).
The decoded value appears nowhere in this document, the appendix, or the repo — the
working copies were scrubbed and verified clean before this file was written. But the
episode is itself the finding: **the obfuscation stops nobody with a JS console, so
treat the key as public and rotate it** (S8 / P0-1).

---

*Generated by a 24-agent audit workflow (13 auditors → 10 adversarial verifiers →
1 completeness critic; ~3.0M tokens of analysis over the four repos' 2,019-test
codebase). Full evidence:
[`2026-08-comprehensive-audit-appendix.md`](2026-08-comprehensive-audit-appendix.md).*
