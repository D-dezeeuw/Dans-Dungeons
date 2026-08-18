# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run serve    # serves the repo root; open: http://localhost:3000
node build.js    # esbuild bundle → vendor/app.bundle.js + version stamp
npm test         # node --test — zero-dep test runner (Node 20+)
npm run test:e2e # Playwright smoke tests in a real browser (needs a browser)
```

Run a single test file: `node --test tests/seeded-rolls.test.js`

(The runner is invoked with no path argument: `--test` with a glob needs Node 22+,
while bare `--test` discovers tests recursively on Node 20 too — and CI pins 20.)

## Development workflow

Every feature request follows this loop (no PRs — direct merge to `main`):

1. **Branch** — `git checkout main && git checkout -b feature/<short-slug>`.
2. **Implement** — make the change on the feature branch.
3. **Verify** — `npm test` must be green **and** `node build.js` must bundle
   cleanly. A failure blocks the merge; fix before proceeding.
4. **Commit** — commit on the feature branch with a clear message. Rebuild the
   bundle so `vendor/app.bundle.js` + version stamp are in the commit.
5. **Merge** — `git checkout main && git merge --no-ff feature/<short-slug>`,
   then push `main` to origin (this is the GitHub Pages deploy trigger).
6. **Clean up** — delete the merged feature branch (local and remote).

## Architecture

**Dan's Dungeons** is a text-based, AI-driven D&D game that runs 100% in the browser — no backend, no installed npm dependencies. esbuild bundles `src/main.js` into `vendor/app.bundle.js` for GitHub Pages.

### Key constraints

- **Zero RUNTIME deps.** `node_modules` holds esbuild (bundling) and
  `@playwright/test` (the e2e layer only — `npm test` never touches it and
  stays runnable with an empty `node_modules`). Runtime libraries (Spektrum, bag-of-holding, bag-of-holding-client) are **vendored** under `vendor/` — nothing loads from a CDN. Sync them with `node scripts/vendor-sync.js`, which stamps a `VENDOR.json` manifest; `--check` fails CI when vendored files drift from it. Never hand-patch `vendor/` — patch the sibling repo and re-sync.
- **esbuild bundles for prod.** `node build.js` produces `vendor/app.bundle.js`, stamps the git hash into `vendor/app.version` and `sw.js`. GitHub Pages serves the bundle.
- **BYOK, and no secrets in the bundle.** The player provides their own OpenRouter key, stored in `localStorage`, sent only to the configured base URL. A shared demo key can be injected at build time via `DD_DEMO_KEY` (see `src/ai/demo-key.js`) but defaults to `null`; a browser bundle cannot keep a secret, so any such key must be treated as public.
- **…or a tenant key.** The setup step also takes a token from a hosted
  `bag-of-holding-mcp` deployment (`src/ai/relay.js` + `connectTenant` in
  `src/ai/client.js`): the base URL becomes that deployment's relay
  (`/mcp/<token>/v1`), the operator's account pays inside the tier's token
  budget, and `ai.credential` says which of the two a session is on. Speech
  stays off on a hosted table whatever the tier — the relay carries
  completions, not `audio/*` — and the cost meter shows tokens, not the host's
  money. `DD_TENANT_URL` names a default deployment at build time; it is not a
  credential.
- **Model ids rot.** Defaults live in the client library and are healed against the provider catalog at boot; `node scripts/check-models.js` (weekly in CI) fails when a configured id is delisted.

### Module map

```
src/
├── main.js              Boot entry, settings wiring, locale init, cold-archive migration
├── core/
│   ├── state.js          Spektrum wrapper (setValue, tick, computed) + hot/cold save split
│   ├── slots.js          Named save slots over the storage envelope
│   ├── tabs.js           Tab ownership: one writer, spectator banner for the rest
│   └── utils.js          escHtml and other small helpers
├── game/
│   ├── flow.js           Game lifecycle FSM: play loop, towns, travel, end states
│   ├── session-setup.js  Credential acquisition (OAuth/provider key/tenant key/demo), tier, model healing
│   ├── views.js          Read-only screens: /story, region map, quests, inventory
│   ├── loop.js           Turn engine: classify → resolve → narrate → commit
│   ├── preclassify.js    Deterministic intent shortcuts before the LLM classifier
│   ├── resolver.js       Pure D&D rules: attack, skill, move, take, unlock
│   ├── spells.js         Casting UX over the engine's spellcasting module
│   ├── character.js      Character creation wizard
│   ├── progression.js    XP awards, milestones, level-up re-derivation
│   ├── chapters.js       Chapter digests, rolling summary, boundaries, recap
│   ├── ledger.js         World ledger bound to Spektrum + digest refresh
│   ├── scope.js          Per-turn scope packet (here/nearby/region/memory/gmOnly)
│   ├── scope-budget.js   Token budgets for the scope packet, pinned by tests
│   ├── canon-commit.js   Validate + mint what the narrator invents
│   ├── world-clocks.js   Threat clocks: tick, rumours, confront/resolve reads
│   ├── acts-runtime.js   Acts thread: flags, beat completion, clue payoffs
│   ├── atlas.js          Seeded region graph: stubs, hydration, frontier
│   ├── world.js          Dungeon assembly (content injection over the client lib)
│   ├── worldgen.js       Layered AI world generation pipeline (L00→L03)
│   ├── worldseed.js      Seeded blueprint wrapper + domain treasures/keys
│   ├── worldbible.js     World-bible EPUB generation
│   ├── story.js          Story flags, faction reputation, GM story context
│   ├── undo.js           Time travel: epochs, undo/redo, branches, persistence
│   ├── rng.js            Epoch-seeded combat dice + verifiable roll log
│   ├── bestiary.js       Stat-block provider over the engine's SRD monsters
│   ├── creatures.js      Creature id pools (overworld, dungeon)
│   ├── dungeon-overlays.js  Re-export of the client lib's 24 theme overlays
│   ├── encounter-state.js   Pure world swap for road encounters
│   └── rules.js          Thin re-export shim for bag-of-holding
├── ai/
│   ├── client.js         appState→config adapter over the client lib's LLM client
│   ├── classify.js       Intent classifier + beat-fulfilment check (tiny tier)
│   ├── narrate.js        GM narrator, travel beats, scene images (medium tier)
│   ├── dialogue.js       Settlement classifier + NPC conversation (tiny/medium)
│   ├── summarize.js      Rolling chapter summaries + chapter titles (tiny tier)
│   ├── canon.js          Canon extractor: narration → proposed facts/mints
│   ├── acts.js           Act generator (medium tier)
│   ├── autoplay.js       LLM-driven autopilot (tiny tier)
│   ├── journal.js        LLM story weaver for journal export (medium tier)
│   ├── schemas.js        JSON schemas: CLASSIFIER, NARRATOR, AUTOPLAY, JOURNAL, ACT…
│   ├── validate.js       Schema-shape normalization for provider output
│   ├── parse.js          Tolerant JSON extraction from model text
│   ├── errors.js         AI error taxonomy: retryable vs terminal, user wording
│   ├── tiers.js          Pricing tier → model set (tables live in the client lib)
│   ├── demo-key.js       Optional build-injected demo credential (null by default)
│   ├── relay.js          Tenant-key shapes, tier mapping, probe reading (pure)
│   ├── auth.js           OpenRouter OAuth redirect + code exchange
│   ├── spend.js          Real cumulative spend (outside replayable history)
│   ├── tts.js            Text-to-speech playback (provider call in the client lib)
│   └── stt.js            Speech-to-text capture (provider call in the client lib)
├── i18n/
│   ├── i18n.js           t(key, params), tRaw(key), locale(), setLocale()
│   ├── en.json           English string table
│   └── nl.json           Dutch string table
└── ui/
    ├── console.js        Re-export barrel for UI modules
    ├── input.js           Prompt, pickFrom, chip wiring, mic button
    ├── transcript.js      Transcript DOM, thinking indicator, speak hover
    ├── chips.js           Action/character/skill chips, room chips
    ├── actionbar.js       Three-zone footer: compass, class, skills
    ├── sidebar.js         Settings sidebar, debug panel
    ├── reactive.js        Spektrum computed bindings for UI state
    ├── sketch.js          Scene background image management
    ├── exports.js         Journal (EPUB), screenshot, sketches, save import
    ├── timeline.js        Time-travel timeline panel (turns + branches)
    └── icons.js           Lucide SVG icon catalog
```

### State ownership (Spektrum)

Spektrum is the **single source of truth**. `appState` is a stable live reference:

- `setValue(path, value)` / `addValue(path, value)` for writes.
- `computed(path, deps, fn)` for derived values.
- `watch(deps, fn)` for imperative DOM updates (stat bars, TTS icon).
- `serialize()` for export/save.

Top-level `appState` paths: `world`, `party`, `flags`, `transcript`, `session`, `ai`, `settings`, `ui`.

### Turn loop

The turn engine (`src/game/loop.js`) is the only module that calls AI and commits state:

1. **Build scene** — pure snapshot of room, PC, NPCs for AI context
2. **Classify** — tiny tier LLM maps player input to structured intent
3. **Resolve** — pure JS D&D rules (d20, damage, movement validation)
4. **Enemy retaliation** — goblin counter-attack if applicable
5. **Narrate** — medium tier LLM streams GM narration
6. **Commit** — writes resolved state to Spektrum + appends transcript

### Procedural dungeon generator

`src/game/world.js` generates a unique dungeon each game:

- **Grid-based placement** — rooms placed on a 2D grid, exits derived from cardinal adjacency
- **Spine + branches** — main path of 4-6 rooms (start → vault), plus 2-4 branch rooms
- **Lock-and-key puzzle** — one locked gate on the spine, key placed in a pre-gate branch room
- **Multiple enemies** — 1-3 enemies from a pool of 6, placed in different rooms
- **Room types** — `entrance`, `hall`, `corridor`, `chamber`, `storage`, `quarters`, `shrine`, `vault` — each with 5 locale-driven descriptions
- **Output shape** — `{ currentRoom, exitRoomId, rooms: {}, npcs: {} }` consumed by resolver, narrator, and UI unchanged

### i18n

Zero-dep locale system in `src/i18n/`:

- `t(key, params)` — string lookup with `{{param}}` interpolation
- `tRaw(key)` — returns arrays/objects (flavour tables, room pools)
- `locale()` / `setLocale(code)` — get/set, persisted to `localStorage` as `dg-locale`
- Supported: `en` (default), `nl` (Dutch)
- AI prompts are locale-conditional: classifier accepts Dutch input, narrator outputs Dutch, STT passes `language: locale()`, TTS auto-detects from text

### Autoplay

LLM-driven autopilot (`src/ai/autoplay.js`):

- Toggle button (recycle arrow) next to mic in input row
- When active: disables input, shows thinking indicator, calls tiny tier to pick next action from available chips
- Scene context + 6 transcript entries + available actions → single action string
- On failure: falls back to manual input
- System prompt gives personality: curious, fights with flair, never backtracks

### Journal export (EPUB)

`src/ui/exports.js` + `src/ai/journal.js` + the client lib's EPUB builder
(`vendor/bag-of-holding-client/src/output/epub.js`):

- Sends all narrations to medium tier LLM to weave into coherent prose with chapters
- Chapters cached in `localStorage` (`dg-journal-cache`) — fingerprinted, only new turns re-processed
- Zero-dep EPUB builder: minimal store-only ZIP, XHTML chapters, canvas-rendered cover
- Cover: "DAN'S DUNGEONS: {title}" on sepia parchment, character name/class subtitle
- Falls back to raw HTML journal if LLM fails
- Step-by-step progress shown in transcript

### AI model tiers

Model tables live in **bag-of-holding-client** (`src/llm/tiers.js`) — one owner,
one place to fix when a provider delists a model. `src/ai/tiers.js` only maps the
app's pricing tiers onto them.

| Tier | Purpose | Free default | Deluxe default |
|------|---------|--------------|----------------|
| `tiny` | Classifier, autoplay, beat checks (every turn) | gemma-4-26b:free | gemini-2.5-flash-lite |
| `medium` | Narrator, journal, worldgen, dialogue | nemotron-3-super-120b:free | deepseek-v4-pro |
| `large` | (configured, no call sites) | nemotron-3-super-120b:free | deepseek-v4-pro |
| `image` | Scene sketches | — | gemini-2.5-flash-image |
| `tts` / `stt` | Speech | — | — (OpenRouter hosts no speech models) |

Ids are verified live by `scripts/check-models.js`; a delisted id is healed to the
tier default at boot, and a rate-limited or dead model walks the tier's fallback
chain. The `maxTokens` override in `chatCompletion()` allows per-call limits.

### Service worker

Cache-first for speed, self-invalidating via version check:

- Page fetches `vendor/app.version` (`cache: no-store`) on every load — the SW must never cache that file, or the check compares a frozen value to itself
- Posts hash to SW via `postMessage`
- On mismatch: SW purges all caches, unregisters, reloads all tabs
- Next load gets fresh files, new SW installs

### Icons

Lucide SVG icons (ISC) vendored in `vendor/icons/`. `src/ui/icons.js` exports inline SVG strings via `icon.name(size)`. No emoji in the UI — all icons are Lucide SVGs.

### Sibling repo: `bag-of-holding`

D&D rules engine at `../bag-of-holding/`. Imported via `src/game/rules.js` shim. Provides: dice, checks, combat, conditions, XP, character derivation, class/species/background SRD data.

### Sibling repo: `bag-of-holding-client`

Browser host toolkit at `../bag-of-holding-client/` (vendored at `vendor/bag-of-holding-client/`, esbuild alias `'bag-of-holding-client'`). The host machinery the rules engine deliberately omits — now owns the **LLM client** (`src/ai/client.js` is a thin appState→config adapter over it), the **seeded blueprint factory + `runWorldgenPipeline` orchestration** (worldseed/worldgen consume it; `startCampaign` + `generateWorldBible` share one `runPipeline`), the **dungeon-graph generator** (`world.js` injects i18n descriptors + bestiary stats), and the **travel FSM** (`flow.js` imports it). Config-injected, zero deps, `node --test`-able. See `docs/ideas/14-client.md`.

### Persistence

Hot/cold split. The `localStorage` envelope (key: `dans-dungeons`) keeps a
bounded hot slice — recent transcript and ledger — and everything older is
archived to IndexedDB in append-only segments (`src/core/state.js` +
`vendor/bag-of-holding-client/src/persistence/idb.js`). The archive watermark
advances only after a cold write is CONFIRMED, and it is Spektrum-recorded so
undo rewinds it with the rest of history; a one-time boot migration
(`compactColdArchive`) dedupes archives written before that rule existed.
Named save slots live beside the envelope (`src/core/slots.js`). Full state
exports as `.dnd.json`. Journal cache in `dg-journal-cache`, locale in
`dg-locale`.

### Tests

Two layers.

**Unit** — `tests/`, run with `node --test`, zero dependencies, 555 passing.
Deterministic logic: dice, checks, combat, XP, spells and slots, schema
validation, encounter state, save growth, the ledger, the cold archive, save
slots, and a wiring contract (`wiring.test.js`) that fails when a shipped
capability loses its last consumer. Modules bound to Spektrum or i18n are
either injectable (`preClassify` takes `{ t, locale }`) or mirror-tested
against the vendored library.

Three contract tests carry more weight than their size suggests:
`dom-contract.test.js` asserts every `getElementById` target exists in
`index.html` AND that every `ui.*` binding has a computed producing it — both
directions of the same silence. `i18n-parity.test.js` compares the keyed
content tables entry for entry, because a key-set check passed for the repo's
whole history while 39 creature intros were English-only. `validate.test.js`
covers what happens when a provider ignores the schema it was sent.

**End-to-end** — `tests/e2e/`, Playwright, `npm run test:e2e`. The LLM is mocked
at the network boundary; everything else is the real turn loop in a real
browser. This is the layer that would have caught the chip renderers looking up
element ids that were not in the markup — every renderer null-guarded, so the
whole click-to-play surface no-opped in silence for the repo's entire history,
and no unit test could see it.

CI (`.github/workflows/ci.yml`) runs the unit suite, the vendor-manifest check,
the build, and a stale-bundle guard on every push and PR; the e2e suite runs as
a separate job so a browser install can never destabilise the logic gate.
