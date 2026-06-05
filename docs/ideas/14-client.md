# 14 — Client: Validation, Cleanup & the `bag-of-holding-client` Library

> Audit date: 2026-06-05. Whole-tree review (7172 LOC src, 1940 LOC tests, 362 KB
> bundle) plus a design for extracting the game-agnostic machinery into a reusable
> browser toolkit on top of the `bag-of-holding` rules engine.
>
> Method: 8 parallel subsystem auditors + a dedicated library-boundary designer,
> cross-checked against a firsthand read of the AI transport, state, and boot layers.

---

## ✅ Execution status (2026-06-05)

The library was **built and adopted** with a broader scope than the conservative
v1 in Part D below — per the brief, the meaty pieces (world/dungeon/NPC building
and travel) live in the library, not just the LLM client. Done:

- **`@zeeuw/bag-of-holding-client`** created as a sibling repo (`../bag-of-holding-client`,
  MPL-2.0, zero deps, ESM, `node --test`). **32 library tests green.** Modules:
  - `llm/` — `transport` (typed `ApiError`, one base-URL seam), `tiers`
    (`resolveModel` + sampling), `client` (`chatCompletion`/`chatStream`/`checkKey`,
    400/429 fallbacks on `err.status`), `stream` (`JsonFieldStreamer`, `\u`/`\r`
    escape bug fixed).
  - `worldgen/` — `rng` (the de-duplicated seeded helpers), `blueprint`
    (`buildBlueprint` + D&D `DEFAULT_TABLES` + the context formatters),
    `pipeline` (`runPipeline` layered DAG: digest threading, parallel groups,
    retry, critical-abort).
  - `dungeon/` — `generateDungeon` (the full grid/spine/lock-key/depth-scaled/boss
    algorithm) with injected stat blocks + content; `DUNGEON_OVERLAYS`.
  - `travel/` — the overworld FSM.
- **App adopts it** (vendored at `vendor/bag-of-holding-client/`, esbuild alias):
  - `src/ai/client.js` → a ~40-line adapter; `src/ai/stream.js` **deleted**.
  - `src/game/world.js` 407 → ~110 LOC (delegates the dungeon algorithm; injects
    i18n descriptors + bestiary stats).
  - `src/game/worldseed.js` 283 → ~80 LOC (wraps the library blueprint factory).
  - `src/game/travel.js` and `src/game/blueprint-context.js` **deleted** (library
    owns them; tests repointed to the vendored copy).
  - `startCampaign()` + `generateWorldBible()` collapsed onto one
    `runWorldgenPipeline` (deleted ~90 lines of divergent orchestration — S5).
  - Dead code removed: `openrouter.js` barrel, `generateWorld()`.
- **App src dropped 7172 → 6223 LOC** (~950 lines moved into the reusable library).
  **233 app tests + 32 library tests green; `node build.js` clean.**

Landed across `feature/client-lib`: LLM core → dungeon/travel/blueprint →
pipeline collapse → cleanup. Not yet done (follow-ups): the L1b/L1c speech+auth
extraction (the app's `tts/stt/auth` still work via the adapter), the `commit()`
state helper (S3), save versioning (S6), the i18n parity test (C2), and the L3
turn-driver. The remaining sections are the original design/rationale.

---

## Executive Summary

Dan's Dungeons is in good shape: zero installed runtime deps, a clean tier'd AI
transport with **no prompt strings in the HTTP layer**, a genuinely nice
structured-output primitive (`chatCompletion({tier, messages, schema})`), and a
pure-module test convention that gives real coverage where it's applied. The
World Gen 2.0 work landed five layered systems that hang together.

But the codebase has accumulated five structural debts, and it contains a
**reusable toolkit struggling to get out**:

1. **`flow.js` is a 1510-line god-object** spanning ~9 responsibilities — the
   single biggest obstacle to KISS.
2. **The `tick(); saveToStorage()` ritual is hand-repeated ~24×** and is the root
   cause of *every* persistence bug found in the WG2 reviews. It wants one helper.
3. **~34 DRY violations**, several load-bearing: the AI transport scaffold is
   copy-pasted across 4 files; the worldgen pipeline is implemented **twice** with
   divergent retry/digest logic; the seeded-RNG helpers are triplicated.
4. **The highest-value deterministic logic (`resolver.js`, `loop.js`) is
   untested** — blocked by one bare `spektrum` import — while two test files
   (`schemas.test.js`, `digest.test.js`) assert against re-declared copies on a
   *false premise* and en/nl i18n parity is **already silently broken** (39 keys).
5. **Four subsystems are game-agnostic but entangled with `appState`**: the LLM
   client, speech I/O, the blueprint→AI→assemble worldgen scaffold, and the
   classify→resolve→narrate→commit turn loop.

The north star: extract **`@zeeuw/bag-of-holding-client`** — a thin browser
toolkit that owns the generic machinery (transport, tiers, streaming, pipeline
orchestration, turn ordering) so the app keeps only its *content* (D&D schemas,
prompts/i18n, archetype tables, the resolver, the Spektrum shape). The app gets
~500 LOC lighter; `client.js`/`tiers.js`/`stream.js`/`tts.js`/`stt.js`/`auth.js`
**delete entirely**; the two worldgen pipelines collapse to one.

**The single architectural lever that makes all of this possible: invert the
`appState` coupling.** Today the AI/worldgen/turn modules `import { appState }`
and reach into global state. A library cannot do that (and it's *why* `resolver`
and `loop` are untested — `state.js` imports the bare `spektrum` specifier that
only esbuild's alias resolves). The fix is the same everywhere: **the library
takes config objects + callbacks; the app owns every Spektrum read/write.**

---

## Part A — Validation (current state)

### What's good (keep it)

- **Transport has no prompts.** `client.js` holds zero prompt strings; all prompts
  live in `i18n/*.json`. The HTTP layer is already prompt- and locale-agnostic —
  the most important precondition for reuse, already true.
- **`chatCompletion({tier, messages, schema})`** is a minimal, correct structured
  output primitive (schema → strict `json_schema` → parse → one repair pass).
  Eight generators route through it with no transport duplication.
- **Fail-soft optional features.** Image/TTS/journal/travel-narration all return
  `null` / fall back to templates; decorative paths never throw into the turn loop.
- **The pure-module test convention** (`blueprint-context.js`, `creatures.js`,
  `travel.js`, `beats.js`, `factions.js`, `settlement.js`) gives *real* coverage by
  keeping logic free of `spektrum`/JSON imports. This is the right pattern — it's
  just under-applied.
- **Backend-free BYOK** via OpenRouter client-side OAuth fits the zero-backend
  constraint exactly.

### Health snapshot

| Dimension | State | Notes |
|---|---|---|
| Correctness | Good | 233 tests green; a few real bugs below (tone drift, i18n parity, streaming escape) |
| KISS | At risk | `flow.js` 1510 LOC; 3 duplicated turn loops; transcript "views" inline in game logic |
| DRY | At risk | ~34 dup sites; transport ×4, worldgen pipeline ×2, RNG ×3, escape ×3, capitalize ×5 |
| Testability | Mixed | Pure modules well-covered; `resolver`/`loop` (the crown jewels) untested |
| Reusability | Buried | 4 agnostic subsystems coupled to `appState` |
| Persistence | Fragile | no save `version`/migration; `tick`-before-save unenforced; whole-subtree RMW |

---

## Part B — Top issues (prioritized)

### B1 — Correctness (fix regardless of the library)

| # | Issue | Where | Fix |
|---|---|---|---|
| C1 | **Blueprint tone vocab (5) > schema enum (3).** `TONES` has `tragic`/`whimsical` but `WORLD_SEED_SCHEMA.tone` enum is 3 values; strict `json_schema` fights the injected `Tone: tragic` constraint. | `worldseed.js:26` vs `schemas.js:97` | Widen the enum to all 5 (and confirm narrator/UI handle them). Add a test: `TONES ⊆ WORLD_SEED_SCHEMA.tone.enum`. |
| C2 | **en/nl parity already broken.** 39 keys in `en` missing from `nl` (most of `world.enemyIntros`), 17 keys only in `nl`. No guard. (This is the documented WG2 Phase-1 assumption, now a measured gap.) | `i18n/*.json` | Add `tests/i18n/parity.test.js` (import both via `with { type:'json' }`, flatten, assert equal key sets). Backfill the 39 Dutch intros. |
| C3 | **Streaming narration corrupts `\u` escapes, drops `\r`.** `NarrationExtractor` passes unknown escapes through verbatim, so `\uXXXX` (most non-ASCII) shows as literal `uXXXX` in the live UI (final parse is fine; the *streamed* tokens are wrong). | `stream.js:39` | Handle `\u`: read 4 hex, emit `String.fromCharCode`; buffer if <4 chars. Cover with adversarial chunk-boundary tests. |
| C4 | **`_callStream` silently ignores `max_tokens`/`schema`** — hardcodes temp 0.85 / 700 tokens, never sends `response_format`. Streaming and non-streaming look interchangeable but aren't. | `client.js:114-129` | Make streaming honor tier temp + `opts.max_tokens` (and `response_format` when a schema is given), or document "streaming = plaintext-JSON-by-convention" explicitly. |
| C5 | **Build version stamp is off-by-one** (git hash committed into the artifact it describes). | `build.js:9,31,36` | Stamp a content hash of the bundle, or accept+document the one-commit lag. Low priority. |

### B2 — Structure / KISS (the big rocks)

| # | Issue | Where | Fix |
|---|---|---|---|
| S1 | **`flow.js` god-object (1510 LOC, ~9 responsibilities):** key/tier setup, meta commands, new-game gating, quick-dungeon, the full campaign pipeline, settlement driver/loop/render/chips, NPC conversation, shop, rest/quests/inventory, overworld travel, encounters, map/story views, play loop, victory/defeat, resume. | `flow.js` | **Split along the existing section banners** → see Part E. |
| S2 | **Three near-duplicate turn-input loops** re-implement prompt→trim→meta→echo→stream→`processTurn`→tick→narrate→speak→debug. | `flow.js:456-477` (settlement), `966-1016` (encounter), `1253-1432` (play) | Extract one `runTurnInput({ chips, fleeable })` scaffold; encounters then inherit the play loop's retry/reauth ladder for free. |
| S3 | **`tick()`-before-save is an unenforced convention repeated ~24×** — the exact class of bug that produced 4+ WG2 review findings. | `state.js:118`, `loop.js:137,193`, `flow.js` (×many), `story.js`, `exports.js:84` | Add `commit()` to `state.js` (= `tick(); saveToStorage();`); route the ~20 couplet sites through it. **Strongly consider making `saveToStorage()` call `tick()` itself** — it reads `appState`, so tick-then-read is always correct and the footgun disappears. |
| S4 | **Whole-subtree read-modify-write** (`setValue('world', {...appState.world, X})`) at 17 sites defeats Spektrum's per-path `deepMerge` and is the mechanism behind delta-clobber bugs. | `resolver.js:243-298`, `story.js:23,41,51`, `flow.js` (×7) | Write leaf paths: `setValue('world.npcs.'+id, {...})`, `setValue('world.redThread', next)`. Smaller deltas, no clobber, no full-spread. |
| S5 | **Two parallel worldgen pipelines with divergent behavior.** `startCampaign` (sequential, ad-hoc digests, fail→quick-dungeon) and `generateWorldBible` (`withRetry`, `Promise.allSettled` parallel, continue-on-fail) run the identical 6-stage DAG. | `flow.js:293-369` & `worldbible.js:38-156` | Extract one `runWorldgenPipeline(blueprint, {onProgress, retry})` → `{seed,factions,beats,region,settlement,dungeon}`. Both callers consume it. Kills the divergence permanently. |
| S6 | **No save `version`/migration.** Any shape change (the redThread restructure, dungeons map, quest tracker, factionReputation) lands on old saves with missing keys and no remediation; `restoreState` *replaces* top-level keys instead of deep-merging onto `DEFAULTS`. | `state.js:108-142`, `main.js:124-130` | Stamp `version: SAVE_VERSION`; run an ordered `migrations[v]` chain on load; deep-merge onto `DEFAULTS` so new fields default cleanly. |
| S7 | **`resolver.js`/`loop.js` untested** (the highest-value deterministic logic) because both transitively import the bare `spektrum` specifier. | `resolver.js:7`, `loop.js:11` | Split each into a **pure core taking state as an argument** + a thin commit layer. Then unit-test the core (attack/skill/move/take/unlock, retaliation, death saves, goblin timing). |

---

## Part C — KISS/DRY cleanup catalog

Grouped, with the concrete consolidation. Most are mechanical and low-risk; do them
as a "cleanup" branch independent of the library extraction.

### C-AI — transport (4 files → 1 seam)

- **Base-URL normalization** `(ai.baseUrl||'…').replace(/\/$/,'')` appears **6×**
  (`client.js:34,49,116`, `narrate.js:70`, `stt.js:76`, `tts.js:75`) → one
  `apiBase(ai)` / `DEFAULT_BASE_URL`.
- **`stt.js` hand-rebuilds the auth headers** (re-hardcoding `X-Title: "Dan's
  Dungeons"`) instead of importing `headers()` → use `headers()`; lift the title
  to one `APP_TITLE` constant (the only thing tying transport to this game).
- **Token accounting** `if (data.usage?.total_tokens) addValue('ai.totalTokens',…)`
  duplicated at `client.js:79,165`, `narrate.js:101` → one wrapper.
- **`!res.ok → throw new Error(\`AI ${status}: …\`)`** at 5 sites, then **re-parsed
  by string prefix** (`err.message.startsWith('AI 400:')`) for retry decisions →
  a typed `class ApiError extends Error { status }`; branch on `err.status`. *This
  is the single most load-bearing fix for a clean library API.*

### C-STATE — Spektrum discipline

- `tick(); saveToStorage()` couplet (~20 sites) → `commit()` (see S3).
- Whole-subtree RMW (17 sites) → leaf-path writes (see S4).
- **Persisted-key list duplicated** in `DEFAULTS` (`state.js:26-99`) and the
  `saveToStorage` snapshot (`119-127`) — *and already drifted* → derive the snapshot
  from `Object.keys(DEFAULTS)` (or one `PERSISTED_KEYS`).
- `restoreState` replaces instead of deep-merging onto defaults (see S6).
- **`serialize` is imported, re-exported, never called** → delete.

### C-WORLDGEN — pipeline + RNG

- **Two pipelines** → one `runWorldgenPipeline` (see S5).
- **Seeded RNG helpers (`pick`/`pickN`/`shuffle`/`randInt`) triplicated** across
  `worldseed.js:14-22`, `world.js:30-45`, and the tests → a **zero-import
  `rng.js`** (rng injected) so `worldseed.js` becomes import-free and node-testable.
- `Math.floor(Math.random()*2147483647)` seed-mint at 5 sites → `mintSeed()`.
- **Digest-fallback strings** built inline at 5+ sites → `digestFor(kind, obj)`
  helpers applied *inside* each generator so the value is never re-derived.
- **`generateNeighbourRegion` re-implements** the region+settlement half-pipeline
  from `startCampaign` → shared `generateRegionAndSettlement(parentDigest, bp)`.

### C-UI — rendering

- **Transcript "views" (map/story/quests/inventory) are `appendEntry` line-spam
  inside game logic** (`flow.js` renderStoryView/renderRegionMap/showQuests/
  showInventory) → move to a `ui/views.js` that takes data and renders; `flow`
  computes, `ui` paints.
- **Chip building forked** into a declarative path + hand-rolled DOM paths that
  re-walk the same record/sheet/cooldowns (`chips.js`, `actionbar.js`) → build one
  normalized `{label,sub,tip,disabled,value}` list once, render twice.
- **HTML/XML escaping ×3** (`utils.escHtml`, `exports.esc`, `epub._escXml`) →
  export `escHtml`+`escXml` from `utils`; delete the copies.
- **`capitalize`-first-letter ×5** (`reactive`, `chips`, `actionbar`, `exports`,
  `character`) → `utils.cap()`.
- **Speaker/volume SVG path literals ×3** (`icons`, `reactive`, `transcript`) →
  use the `icons.js` catalog everywhere.
- **`localStorage` get/set+try/catch+JSON ×5** (`sketch`, `exports`, `state`,
  `journal`, `sidebar`) → a tiny `storage.get/set` helper.
- **Settings-toggle wiring** (read flag → negate → setValue → save) ×7 in
  `main.js` → a table-driven `wireToggle()`.
- **The `_speak/_speakAsync/_cancelSpeech` lazy-import trio** in `flow.js` → a
  small `audio.js` (becomes `createSpeaker` from the library; see Part D).

### C-DEAD — confirmed dead code (delete)

| Symbol | Where | Status |
|---|---|---|
| `ai/openrouter.js` (re-export barrel) | whole file | no importers — **dead** |
| `generateWorld()` | `world.js:405`, imported `flow.js:7` | imported, **never called** |
| `world.enemies` (i18n array) | `en.json`/`nl.json` | unused since WG2 Phase 1 — **dead** |
| `settlement.roadNotReady` (i18n) | `en.json`/`nl.json` | unused since WG2 Phase 3 — **dead** |
| `serialize` re-export | `state.js:15,22` | **never called** |
| `large` AI tier | `tiers.js` (FREE/PAID/FALLBACKS) | configured, **no call uses it** |
| `overworldEncounterPool()` no-op | `flow.js:877` | returns `[...OVERWORLD_ENEMY_IDS]` but its docstring claims it blends theme creatures — **either implement the blend or inline the constant** (self-inflicted in WG2 Phase 3) |

### C-TEST — fix the test debt

- **`schemas.test.js` re-declares every schema inline** on the false premise that
  "we can't import ESM with JSON imports" — `schemas.js` is **pure JS and imports
  fine in Node**. Copies can't detect source drift, defeating the test's purpose →
  `import { … } from '../../src/ai/schemas.js'` and keep only `validateAgainstSchema`.
- **`digest.test.js` tests functions that don't exist in `src`** (`buildNarratorContext`
  re-implemented in the test, joining with `' '` while the real `buildScene` joins
  with `' | '`) → extract the real builder into `game/digest.js`, import it in both
  `loop.js` and the test; delete the tautological cascade assertions.
- **`package.json` glob + CLAUDE.md reference a non-existent `tests/dnd/` layout** →
  update both to `tests/worldgen/` (the actual layout).

---

## Part D — The `@zeeuw/bag-of-holding-client` library

**Purpose.** A thin, game-agnostic **browser** toolkit that sits *above* the
`bag-of-holding` rules kernel and packages the four reusable subsystems currently
entangled inside Dan's Dungeons. The library owns the **generic machinery**;
the game keeps its **content**.

> Relationship to the rest of the stack: `bag-of-holding` = the *rules kernel*
> (dice/checks/combat/SRD/XP/beats, MPL-2.0). `bag-of-holding-mcp` = those rules
> over MCP. **`bag-of-holding-client` = the browser glue** (LLM + worldgen + turn
> loop) that an AI-driven D&D app needs but that doesn't belong in a rules kernel.

### Layered architecture

```
┌─────────────────────────────────────────────────────────────┐
│ APP  Dan's Dungeons  (content + 1 wiring site)               │
│  schemas.js · i18n prompts · archetype tables · resolver.js  │
│  core/state.js DEFAULTS + Spektrum · world.js dungeon gen    │
└───────────────▲─────────────────────────▲───────────────────┘
                │ injects config/callbacks │ injects schemas/prompts/tables
┌───────────────┴─────────────────────────┴───────────────────┐
│ bag-of-holding-client            (zero deps, ESM, no globals)│
│  L3 turn/run-turn.js      classify→resolve→narrate→commit     │  ← ships last
│  L2 worldgen/pipeline.js  runPipeline + seededBlueprint       │
│  L1 llm/client.js+stream  chatCompletion · chatStream · repair│
│     llm/speech.js         createSpeaker/createRecorder (opt)  │
│     llm/auth-openrouter   PKCE connect (opt)                 │
│  L0 llm/transport.js      endpoint · headers · postStream     │
│     llm/tiers.js          resolveModel · sampling · fallbacks │
└───────────────▲──────────────────────────────────────────────┘
                │ depends on (peer)
        ┌───────┴────────┐
        │ bag-of-holding │  rules kernel (Dice.seededRng, SRD, Combat, Beats…)
        └────────────────┘
```

| Layer | Modules | Agnostic? | Owns |
|---|---|:--:|---|
| **L0 transport** | `transport.js`, `tiers.js` | ✅ | base-URL/headers/`ApiError`, `/chat/completions` + `/audio/*` POST, SSE byte reading, tier→model + sampling defaults + fallback chains |
| **L1 client** | `client.js`, `stream.js` | ✅ | `chatCompletion` (schema→parse→repair), `chatStream`, 400→medium / 429→fallback policy on `err.status`, `JsonFieldStreamer` (generalized extractor, escape bug fixed), `checkKey` |
| **L1b speech** *(opt)* | `speech.js` | ✅ | `createSpeaker`/`createRecorder`, PCM→WAV, MediaRecorder mime negotiation, injected `language` |
| **L1c auth** *(opt)* | `auth-openrouter.js` | ✅ | OpenRouter PKCE connect/redirect/exchange — isolated so other providers ship their own |
| **L2 worldgen** | `pipeline.js`, `blueprint.js` | ✅ | `runPipeline` (digest chaining, `withRetry`, parallel fan-out, progress protocol), `seededBlueprint` + `pick/pickN/shuffle/randInt(rng)` |
| **L3 turn loop** | `run-turn.js` | ✅ | `runTurn` strategy driver: snapshot-before-mutate, stream via `onChunk`, the retry/reauth ladder, commit ordering |
| **APP** | schemas, prompts, tables, `resolver`, `state` DEFAULTS, `world.js` | ❌ | all D&D content + the one config-construction site |

### Public API (sketch)

```js
// L0/L1 — the structured AI client
const llm = createLlmConfig({
  key, baseUrl?, models?, appTitle: "Dan's Dungeons", referer?, defaultModels?,
});                                                    // immutable transport config
resolveModel(tier, llm, defaults) -> string|null      // config.models[tier] ?? defaults[tier]
await chatCompletion(llm, { tier, messages, schema?, maxTokens?, temperature? }, { onTokens? })
                                                       // schema → object; else string
await chatStream(llm, { tier, messages }, onChunk, { field='narration', onTokens? }) -> rawString
new JsonFieldStreamer('narration').feed(deltaText) -> string   // stream one JSON field
await checkKey(llm) -> boolean                         // false only on 401
class ApiError extends Error { status; body }          // branch on err.status, not string match

// L1b/L1c — optional speech + auth
createSpeaker(llm, { onTokens?, onCost? }) -> { speak(text), cancel(), isSpeaking() }
createRecorder(llm, { language?, onTokens? }) -> { start(), stop(), transcribe(blob) }
redirectToConnect() / getOAuthCode() / exchangeCodeForKey(code) / clearOAuthCode()

// L2 — worldgen scaffold (app supplies tables + per-layer generators)
seededBlueprint(seed, tables, picks) -> blueprint
await runPipeline(layers, { blueprint, ctx, onProgress, defaultRetries? }) -> { [layer]: result }
//   layer := { name, dependsOn?, parallelWith?, generate(parentDigests, bp, ctx),
//              digestOf?(result, fallback), retries? }

// L3 — turn loop (app injects its resolver + commit)
await runTurn(input, { buildScene, classify, resolve, react, narrate, commit }, { onChunk, onError? })
       -> { narration, debug }
```

### Before / after (the app gets thin)

**Today** — `narrate.js` reaches into globals and rebuilds transport:
```js
import { appState, addValue } from '../core/state.js';
const base = (appState.ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
// …hand-built fetch, hand-built headers with "Dan's Dungeons", token accounting inline…
```

**After** — `narrate.js` is content only:
```js
import { chatStream } from '@zeeuw/bag-of-holding-client';
export const narrate = (facts, scene, transcript, onChunk, llm, onTokens) =>
  chatStream(llm, { tier: 'medium', messages: buildMessages(facts, scene, transcript) },
             onChunk, { field: 'narration', onTokens });
```

**Wiring (one site).** `core/state.js` builds the config and the sink:
```js
const llm = createLlmConfig({ key: appState.ai.key, baseUrl: appState.ai.baseUrl,
                              models: appState.ai.models, appTitle: "Dan's Dungeons",
                              referer: location.origin });
const onTokens = n => addValue('ai.totalTokens', n);   // the app does accounting
```

**Net deletions:** `client.js`, `tiers.js`, `stream.js`, `tts.js`, `stt.js`,
`auth.js` (~500 LOC) leave the game. `classify`/`narrate`/`dialogue`/`journal`
shrink to "schema + prompt + `llm`". `flow.startCampaign` and
`worldbible.generateWorldBible` collapse onto one `runPipeline`.
`loop.processTurn` becomes a strategy object passed to `runTurn`.

---

## Part E — Restructuring `flow.js` (the #1 KISS win)

Split the 1510-line module along its **existing section banners** into cohesive
files. None of this changes behavior; it makes each piece testable and legible.

```
game/flow.js                 → boot FSM only: ensureKey → startNewGame/resumeGame, end states
game/setup.js                  key/tier setup, ensureKey, upgradeToDeluxe, requireDeluxe
game/campaign.js               startCampaign + startQuickDungeon (consume runWorldgenPipeline)
game/dungeon-loop.js           playLoop, victory/defeat, runEncounter  (use runTurnInput)
game/settlement-loop.js        enterSettlement driver, settlementLoop, chips, shop, rest,
                                 converseWithNpc, quest/inventory actions
game/overworld.js              doTravel, doOverworldTravel, arriveAtDestination, fastTravelTo
game/meta.js                   handleMeta (/save /status /map /story /help …)
ui/views.js                    renderStoryView, renderRegionMap, showQuests, showInventory
game/turn-input.js             runTurnInput({chips, fleeable}) — the shared S2 scaffold
game/audio.js                  speak/speakAsync/cancelSpeech (or createSpeaker from the lib)
```

Target: no game module over ~300 LOC; the shared turn scaffold used by all three
loops; transcript rendering out of game logic.

---

## Part F — Migration plan (incremental, each step shippable)

Sequenced so the **lowest-risk, highest-leverage** changes land first and the
**most-entangled** (L3 turn driver) lands last. Each step ends green
(`npm test` + `node build.js`) and follows the feature-branch workflow.

| Step | Scope | Risk | Outcome |
|---|---|---|---|
| **0** | Scaffold `@zeeuw/bag-of-holding-client` (zero-dep ESM, `node --test`, vendored via esbuild alias + import map like the engine). | none | empty package, prod bundle unchanged |
| **1** | **In the game first:** introduce `ApiError` + one `apiBase/endpoint/headers`; replace the 6 base-URL strips and the `startsWith('AI 4xx:')` branches; fix `stt.js` to use `headers()`; lift `X-Title` to `APP_TITLE`. | low | de-risks extraction without moving files |
| **2** | Extract **L0+L1** behind `createLlmConfig`+`onTokens`. Delete `client/tiers/stream`; re-point `classify/narrate/dialogue/journal`. Generalize `NarrationExtractor`→`JsonFieldStreamer` and fix the `\u`/`\r` bug. | med | the "structured AI client" deliverable |
| **3** | Extract **L1b speech + L1c auth**. Delete `tts/stt/auth`; inject `locale()` as `language`, cost as config. Manual verify mic/TTS/OAuth (browser-only). | med | voice/auth out of the app |
| **4** | Extract **L2 pipeline**. Move `runPipeline`/`withRetry`/`ensureDigest` + seeded blueprint helpers. Rewrite `worldseed.js` to inject `rng` (import-free, testable). Both `startCampaign` and `generateWorldBible` call one `runPipeline`. Add the tone-enum guard test. | med | **kills the two-divergent-pipelines bug** |
| **5** | Extract **L3 turn driver** last. `loop.processTurn`→`runTurn` strategy; fold `flow.js`'s 3 input loops onto it. Add the first-ever `resolver.js` tests behind the clean injected-state seam. Keep tick-before-save inside the injected commit. | high | unified, resilient, tested turn loop |
| **6** | Cleanup: delete `openrouter.js`, dead `generateWorld`, dead i18n keys; update CLAUDE.md module map. | none | tidy |

A pragmatic alternative the design explicitly raises: **v1 = L0/L1/L1b/L1c/L2
only** (the clearly-agnostic, low-entanglement pieces) and leave the turn loop as
a *documented pattern* until `resolver`/`loop` are split and tested. Shipping a
half-decoupled driver may be worse than shipping none.

The KISS/DRY cleanup catalog (Part C, excluding the library moves) can ship as a
standalone **"cleanup" branch before Step 0** — it's mechanical, low-risk, and
makes the extraction smaller.

---

## Cross-cutting concerns

- **Spektrum coupling is the real blocker** (not `bag-of-holding`). `state.js`
  imports the bare `spektrum` specifier that only esbuild resolves, so *any*
  library code touching `appState` won't load under `node --test`. **Hard
  constraint:** the library never imports state — it takes config + callbacks; the
  app keeps every Spektrum read/write.
- **License.** The engine is MPL-2.0 by deliberate choice (file-level copyleft is
  the moat). Decide whether the client matches MPL-2.0 (keeps the moat, app code
  can stay closed) or is MIT (encourages adoption as glue). *Open question.*
- **Seeded-RNG audit obligation.** The blueprint is stochastic; project policy is
  that stochastic libraries ship seedable RNG + roll log + replay verifier
  *together*. Decide whether `runPipeline`/`seededBlueprint` need a roll-log/replay
  story in v1, or lean entirely on the engine's `Dice.seededRng` +
  `engine.verifyLog` (app owns the audit trail). *Open question.*
- **Embedded free-tier key stays app-side.** The XOR'd `_cfg` bootstrap in
  `tiers.js` is deployment-specific and must **never** ship in the published
  library (credential-in-public-package risk). The library ships model *defaults*
  only.
- **Config lifecycle.** Rebuild `LlmConfig` on every `ai.*` change (immutable,
  clean) vs. pass a live getter so mid-game tier upgrades propagate without
  reconstruction. The immutable approach is cleaner but the app must remember to
  rebuild on upgrade — *exactly* the class of bug the recent Deluxe-upgrade fix
  addressed. *Open question.*
- **Packaging.** Vendor + import-map like `bag-of-holding` (pinned unpkg for
  release) vs. publish to npm. The zero-installed-deps constraint argues for
  vendoring. *Open question.*

---

## Open questions (for the human)

1. **License** of the client lib — MPL-2.0 (match the moat) or MIT (max adoption)?
2. **Audit trail** for stochastic worldgen — in the library, or delegated to the
   engine's seeded RNG + the app?
3. **v1 scope** — include the L3 turn driver, or ship L0–L2 and leave the turn loop
   as a documented pattern until the resolver is split + tested?
4. **`world.js` dungeon generator** — library candidate now (needs a room-descriptor
   provider + theme→enemy-pool injection to shed its i18n/worldseed reach-ins) or
   explicitly deferred to v2?
5. **Provider neutrality** — ship OpenRouter-as-default-with-seams and *not* claim
   full neutrality until a second provider is wired (avoid the over-engineering
   trap)?

---

## Estimated scope

| Track | New files | Touched | Size | Independent of library? |
|---|---|---|---|---|
| **Cleanup catalog** (Part C) | 2-3 helpers | ~15 | M | ✅ ship first |
| **Correctness fixes** (B1) | 2 tests | ~5 | S | ✅ ship first |
| **`flow.js` split** (Part E) | ~9 | 1 | M | ✅ (helps everything) |
| Library Step 0-1 | scaffold | ~5 | S | — |
| Library Step 2-3 (L0/L1/speech/auth) | ~6 | ~8 | M | — |
| Library Step 4 (L2 pipeline) | ~2 | ~5 | M | — |
| Library Step 5 (L3 turn driver) | ~1 | ~6 | L | — |

**Recommended order:** correctness fixes + cleanup catalog + `flow.js` split
(all app-internal, high value, no new repo) → then the library extraction Steps
0→5, with a hard stop after Step 4 to reassess whether L3 is worth the
entanglement. The `commit()` helper (S3) and the typed `ApiError` (C-AI) are the
two single highest-leverage changes — do them first; everything else gets easier.
