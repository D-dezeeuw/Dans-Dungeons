# 15 — bag-of-holding-client: what else can move in (roadmap)

Follow-up to [`14-client.md`](14-client.md). That doc extracted the four founding
subsystems (LLM client, worldgen pipeline, dungeon generator, travel FSM). This
one is the result of a thorough audit of *everything still in the app* to answer:
**what more is reusable host machinery, and what could the library grow next?**

> ## ✅ Verified (adversarial re-audit, 14 verifiers + completeness critic)
>
> The tiers below were independently re-checked against source. Net: the audit
> holds, with these adjustments — **act on the verified list, not the original
> sizing**:
>
> - **Confirmed worthwhile (move):** `beats.js`, `factions.js`, `settlement.js`,
>   worldgen schemas, `narrate.js` image parser, `epub.js` (`buildEpub`+`buildZip`),
>   and the persistence `makeCommit`/save-envelope. All cleared both fences.
> - **REFUTED — do NOT move `tierForCr`/`TIER_BANDS`:** the lib's dungeon generator
>   already does CR→depth via `crOf` sort + `depthFraction` (`generate.js:223,229–240`)
>   and never references tier bands. The derived `.tier` field (`bestiary.js:52`) is
>   read **nowhere** in app runtime — dead metadata. Honest cleanup is to **delete**
>   it, not relocate it.
> - **Drop `triggerDownload`/`dataUriToBlob`:** `triggerDownload` is real but trivial
>   browser glue; **`dataUriToBlob` does not exist** (phantom — it's inline inside
>   `exportScreenshot`). Near-zero value vs `buildEpub`/`buildZip`.
> - **`auth.js`: don't move.** No `buildAuthUrl` exists (the real export
>   `redirectToOpenRouter` side-effects `location.href`); it's browser-only glue.
>   The embedded key is in **`tiers.js`** (`_a`/`_b`/`_cfg`, injected at
>   `flow.js:134,162,180,194`) and **must stay app-side** (fence 1) — confirmed.
> - **Corrections:** worldgen-schema extraction is a **mid-file slice** (NARRATOR
>   sits *below* it at `schemas.js:275–284`), not a clean tail. TTS core should
>   return **`ArrayBuffer`, not `Blob`**, and inject `origin`+`onCost`. STT core is
>   **browser-only** (`location.origin`, `btoa`). `settlement.js` export list omits
>   `questId`. Tier 4 is **build-new**, not lift-and-shift (the envelope doesn't
>   exist yet).
> - **Missed candidates (critic):** `i18n` `interpolate`/`getPath` (S),
>   `escHtml`/`escXml` consolidation (S, fixes an EPUB `&quot;` bug), a
>   `streamStructured` combinator in `narrate.js:39–60` (S), the `WORLDGEN_LAYERS`
>   DAG template (M), `journal.js` prefix-diff partial cache (M).
> - **Operational gotcha:** the app consumes a **hand-copied** `vendor/` copy (no
>   sync script; tests import `vendor/` by relative path). Every "move" is two steps
>   — author in the source repo *and* re-copy files + `index.js` into `vendor/` —
>   then `node build.js` + grep the bundle, or the deploy runs stale code.

The library's bar (from `travel/fsm.js`, `llm/client.js`): config/callback-injected,
zero-dep, loads under `node --test` (no `appState`, no DOM, no `spektrum` /
`bag-of-holding` bare specifiers, no `import.meta`). Anything that can't meet that
bar but is still generic goes in a clearly-labelled **browser-only** tier.

Two hard fences, unchanged:
1. **The embedded free API key stays app-side.** It lives in `src/ai/tiers.js`
   (`_a`/`_b`/`_cfg`, XOR-obfuscated), *not* `auth.js`. Obfuscation is defeatable;
   it must never be a constant in a publishable library. The lib stays
   credential-free — the app injects the decoded key into `config.key`.
2. **Rules belong in the kernel, not here.** Sheet-derive / `reconcilePc`, the
   `BESTIARY = SRD.monsters + custom` merge, anything importing `SRD`/`Combat`/
   `Checks`/`createEngine` → that's `@zeeuw/bag-of-holding`, not the client.

---

## The one big insight

The library already emits the **prompt-side scaffolding** for narrative state —
`beatsHints`, `factionsHints`, `settlementHints` (`blueprint.js:219–244`) — but it
does **not** own the **runtime engines** that consume the AI output those hints
produce. Those engines (`beats.js`, `factions.js`, `settlement.js`) live in the app
and are *already written to the library's exact bar*: pure, zero-import,
`node --test`-able today. Extracting them closes the loop — the lib would generate
the constraints **and** own the state machines that run on the results. This is the
highest value-to-effort move available.

---

## Tier 1 — pure engines, already at the bar (ship now, S each)

These are verbatim moves + a test suite. Zero coupling, no API design needed.

| Source | → Library module | Exports | Notes |
|---|---|---|---|
| `game/beats.js` | `narrative/beats.js` | `isBeatDone, isBeatEligible, nextEligibleBeats, currentBeat, setFlag, completeBeat, storyProgress, storyHint` | Pure fns over `{beats, currentIndex, flags}`. Pairs with `beatsHints`. |
| `game/factions.js` | `narrative/factions.js` | `REP_MIN/MAX, THRESHOLDS, clampRep, reputationOf, adjustReputation, standing, standingFor, priceModifier, adjustPrice, isHostile` | Pure rep math. Pairs with `factionsHints`. Price table could accept an injected override. |
| `game/settlement.js` | `settlement/economy.js` | `goldOf, resolvePurchase, addToInventory, resolveRest, makeQuest, addQuest, setQuestStatus, activeQuests, pushDialogue, canRevealSecret, slug, + constants` | Pure trade/quest/dialogue transitions. Pairs with `settlementHints`. Tunable constants → optional params. |
| `ai/schemas.js:91–273` | `worldgen/schemas.js` | `WORLD_SEED, REGION, NPC, FACTION, BEAT, RED_THREAD, FACTIONS, SETTLEMENT` | The *missing half* of the pipeline the lib already owns. Pure JSON-schema constants, zero imports. |
| `game/creatures.js:13–26` | `dungeon/tiers.js` | `TIER_BANDS, tierForCr` | CR→depth bucketing — the dungeon generator already needs depth-banding. (Stat-block **data** stays app content.) |

App-side after the move: `story.js` re-points its imports to the lib (it stays as
the thin Spektrum adapter, exactly like `flow.js` adapts `travel/fsm.js`).

---

## Tier 2 — AI/host fetch cores (S/M)

Split the generic fetch+normalize core (lib) from the DOM capture/playback (app).

| Capability | Source | Library seam | Effort |
|---|---|---|---|
| **Image-gen client** | `ai/narrate.js:103–129` | `generateImage(config, {prompt, model, maxTokens}) → dataUri\|null`. The multi-shape provider-response parser (`message.images[]` / content parts / `inline_data` / regex) is genuine provider-quirk machinery. App injects the art-direction prompt; accounts via `config.onTokens`. | M |
| **Speech: TTS** | `ai/tts.js` | `synthesizeSpeech(config, text, {voice, fallbacks}) → {blob, model, charCount}` incl. `pcmToWav`. Playback (`new Audio`) stays app-side. Add `config.onCost(usd)` to mirror `onTokens`. | M |
| **Speech: STT** | `ai/stt.js` | `transcribeAudio(config, blob, {language}) → text` incl. `blobToBase64`. `MediaRecorder` capture stays app-side; app injects `language` from its own i18n. | S |
| **OAuth-PKCE helpers** | `ai/auth.js` | `buildAuthUrl(baseUrl, callbackUrl)`, `exchangeCodeForKey(config, code)` — pure. App owns every `location`/`history` mutation. Contains no secret (that's the point of PKCE). | S |

New `audio/` tier groups TTS+STT; `image/` joins `llm/` or sits beside it.

> Skipped on purpose: `classify.js`, `autoplay.js`, `dialogue.js`, `journal.js`,
> `narrate()` body — these are thin i18n+schema glue (app *content*), not host
> machinery. Their only lib-worthy parts are the schemas (Tier 1) and the
> image client (above).

---

## Tier 3 — output tier (browser-only, S)

The library has no output tier yet. These are browser-only (canvas/Blob/ZIP) but
fully generic — a sanctioned `output/` tier, documented as not node-testable.

| Capability | Source | Library seam | Effort |
|---|---|---|---|
| **`buildEpub()`** | `ui/epub.js` | Already shaped `buildEpub({title, subtitle, lang, chapters, tone, tagline}) → Blob`. Only 3 hardcoded brand strings (`epub.js:156,308,318`) need a `brand` param; optional `css`/`palette` overrides. Cleanest, highest-value, lowest-effort extraction in the repo. | S |
| **`buildZip(entries)`** | `ui/epub.js:32–124` | The store-only ZIP writer + CRC32, standalone. Foundational for any bundle-to-download (saves, sketch packs, EPUB). | S |
| **`triggerDownload` / `dataUriToBlob`** | `ui/exports.js:12–17,27–31` | The boring browser glue every host re-implements. | S |

---

## Tier 4 — persistence tier (node-testable, M)

**There is no save versioning anywhere in the app today** (grep-confirmed). Saves
are raw snapshots; the only forward-compat is re-deriving the PC sheet via
`reconcilePc` on every load. Any future state-shape change has no migration path.
This is pure data transformation → fits the node-testable charter perfectly.

| Capability | Library seam | Effort |
|---|---|---|
| **Save-envelope + migration runner** (`persistence/envelope.js`) | `wrapEnvelope(data, version)`, `loadEnvelope(raw, {migrations, currentVersion, onReconcile})` (parse → detect version → run ordered `v→v+1` migrations → reconcile hook → data\|null), `saveEnvelope(storage, key, data, version)`. App injects a storage adapter (`{getItem,setItem,removeItem}`; a stub in tests), version, migrations map, reconcile callback. | M |
| **`makeCommit({tick, save})`** | The ubiquitous `tick(); saveToStorage()` pair as one combinator. tick/save stay app-owned (Spektrum + localStorage); the lib supplies only the combinator. Closes the root cause of every persistence bug in the WG2 reviews. | S |

---

## Tier 5 — bigger / future options

Net-new capabilities, not just extractions. Roughly highest-leverage first.

| Capability | What it is | Effort |
|---|---|---|
| **`resolveIntent(classified, scene, rules)`** | The mechanics half of `resolver.js` (attack/skill/move/take/unlock) as pure fns over an injected scene + injected `Combat`/`Checks`. The Spektrum-mutating `commitAll` half stays app-side. | M |
| **`runTurn(strategy)` orchestration skeleton** | The deferred L3 driver. Owns the load-bearing **ordering contract** — snapshot-before-mutate, retaliate-before-commit, two-phase save, downed→death-save interrupt branch — with ~8 injected callbacks (classify/resolve/retaliate/narrate/commit + predicates + hooks). Worth it for the *documented ordering guarantees*, not as a "smart" driver. | L |
| **Encounter CR-budget builder** | Given party level + creature pool, pick an encounter within an XP budget. Upgrades `pickEncounter` (currently flat-random, `fsm.js:63`). | M |
| **Token/cost accountant** | Formalize `onTokens`/`onCost` into a small running-totals accountant per tier. Spend visibility is a BYOK necessity; today it's scattered (`tts.js:103`, `narrate.js:101`). | S |
| **Response caching** | Content-addressed cache around `chatCompletion` (fingerprint = model+messages+schema), injectable store. `journal.js:24` already hand-rolls fingerprint caching — generalize it. | M |
| **Prompt-template system** | Tiny `{{param}}` interpolation + registry, so prompts are data the host supplies. Cleanly decouples lib fns from any i18n dependency. | M |
| **Tool / function calling** | `tools`/`tool_choice` passthrough + parse-and-dispatch loop. Opens agentic GM moves beyond single-schema JSON. | M |
| **Combat-statblock adapter** | `toCombatStatBlock(monster, parseDamage)` — pure SRD-block → flat `{toHit,damageDie,damageBonus,cr,tier}`, dice-parser injected (no kernel import). | S |
| **Re-derive-on-load helper** | `reconcileEntity(record, deriveSheet)` — generic "refresh derived sheet, fall back on corrupt record". | S |
| **Provider abstraction** | Adapter layer so base-URL + auth + response-quirks are pluggable (quirks already diverge per-provider in `tts.js` PCM handling + image parsing). Removes implicit OpenRouter lock-in. | L |
| **Embeddings / RAG memory** | `/embeddings` client + small vector store + retrieval for long-campaign memory. Natural successor to the worldgen `digest` strings (a poor-man's memory today). | L |
| **NPC relationship graph** | NPC↔NPC and NPC↔faction edges feeding dialogue tone. Successor to `factions.js` + settlement dialogue memory. | L |

---

## Stays in the app (correctly)

The per-app binding layers — they adapt the lib to Spektrum/DOM/kernel, mirroring
how `flow.js` binds `travel/fsm.js`:
`story.js`, `resolver.js` (commit half), `bestiary.js`, `character.js` wizard,
`sketch.js`, `main.js`, and all the i18n+schema AI glue (`classify`, `autoplay`,
`dialogue`, `journal`, `narrate` bodies).

## Suggested execution order

1. **Tier 1** — pure-engine moves + worldgen schemas. Biggest value/effort, no API
   design risk, closes the hints↔engines loop. (~5 modules, each verbatim + tests.)
2. **Tier 3 + 4** — `buildEpub`/`buildZip` and the save-envelope/migration runner.
   Both are clean and the save-migration gap is a real latent risk.
3. **Tier 2** — image + speech fetch cores once the `config.onCost` callback lands.
4. **Tier 5** — pick by need; `resolveIntent` and the CR-budget builder are the
   most game-shaping, `runTurn` the most ambitious.
