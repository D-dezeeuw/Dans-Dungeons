# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run serve   # serves the repo root; open: http://localhost:3000
node build.js   # esbuild bundle → vendor/app.bundle.js + version stamp
npm test        # node --test — zero-dep test runner (Node 20+)
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

- **Zero deps installed.** `node_modules` holds only esbuild (dev). Runtime libraries (Spektrum, bag-of-holding, bag-of-holding-client) are **vendored** under `vendor/` — nothing loads from a CDN. Sync them with `node scripts/vendor-sync.js`, which stamps a `VENDOR.json` manifest; `--check` fails CI when vendored files drift from it. Never hand-patch `vendor/` — patch the sibling repo and re-sync.
- **esbuild bundles for prod.** `node build.js` produces `vendor/app.bundle.js`, stamps the git hash into `vendor/app.version` and `sw.js`. GitHub Pages serves the bundle.
- **BYOK, and no secrets in the bundle.** The player provides their own OpenRouter key, stored in `localStorage`, sent only to the configured base URL. A shared demo key can be injected at build time via `DD_DEMO_KEY` (see `src/ai/demo-key.js`) but defaults to `null`; a browser bundle cannot keep a secret, so any such key must be treated as public.
- **Model ids rot.** Defaults live in the client library and are healed against the provider catalog at boot; `node scripts/check-models.js` (weekly in CI) fails when a configured id is delisted.

### Module map

```
src/
├── main.js              Boot entry, settings wiring, locale init
├── core/
│   ├── state.js          Spektrum wrapper (setValue, tick, computed, etc.)
│   └── utils.js          escHtml and other small helpers
├── game/
│   ├── flow.js           Game lifecycle FSM: setup, play loop, towns, travel, end states
│   ├── loop.js           Turn engine: classify → resolve → narrate → commit → remember
│   ├── resolver.js       Pure D&D rules: attack, skill, move, take, unlock
│   ├── character.js      Character creation wizard
│   ├── world.js          Dungeon assembly (content injection over the client lib)
│   ├── worldgen.js       Layered AI world generation pipeline (L00→L03)
│   ├── worldseed.js      Seeded blueprint wrapper + domain treasures/keys
│   ├── worldbible.js     World-bible EPUB generation
│   ├── ledger.js         World ledger: base ⊕ append-only patches (E2)
│   ├── canon-commit.js   Commits extracted canon; mints what the GM invents (E9)
│   ├── scope.js          Per-turn context packet: here/nearby/region/known/gmOnly (E5)
│   ├── scope-budget.js   Token budgets for the packet, asserted in CI
│   ├── chapters.js       Chapter boundaries, rolling digest, narrator memory (E4)
│   ├── digests.js        Re-renders the digests the ledger invalidated (E4.S3)
│   ├── atlas.js          Geography as a graph with seeded neighbour stubs (E6)
│   ├── world-clocks.js   Faction projects + invented-threat clocks (E6.S3/E9.S3)
│   ├── acts-runtime.js   Acts over beats, stalls, the payoff ledger (E7)
│   ├── progression.js    XP from kills and milestones, level-ups (E8.S1)
│   ├── story.js          Story flags, faction reputation, GM directive
│   ├── undo.js           Time travel: epochs, undo/redo, branches, persistence
│   ├── rng.js            Epoch-seeded combat dice + verifiable roll log
│   ├── bestiary.js       Stat blocks + boss tier templates over the engine's SRD monsters
│   ├── creatures.js      Creature id pools (overworld, dungeon)
│   ├── dungeon-overlays.js  Re-export of the client lib's 24 theme overlays
│   ├── encounter-state.js   Pure world swap for road encounters
│   └── rules.js          Thin re-export shim for bag-of-holding
├── ai/
│   ├── client.js         appState→config adapter over the client lib's LLM client
│   ├── classify.js       Intent classifier (with a local chip fast path) + beat check
│   ├── validate.js       Checks model responses before the rules layer acts (E11.S2)
│   ├── narrate.js        GM narrator, travel beats, scene images (medium tier)
│   ├── canon.js          Extracts durable claims from narration (tiny tier, E2.S3)
│   ├── summarize.js      Rolling/chapter digests, chapter titles, place re-digests
│   ├── acts.js           Generates the next act from what actually happened (E7.S2)
│   ├── dialogue.js       Settlement classifier + NPC conversation (tiny/medium)
│   ├── autoplay.js       LLM-driven autopilot (tiny tier)
│   ├── journal.js        LLM story weaver for journal export (medium tier)
│   ├── schemas.js        JSON schemas: CLASSIFIER, NARRATOR, ACT, AUTOPLAY, JOURNAL
│   ├── tiers.js          Pricing tier → model set (tables live in the client lib)
│   ├── demo-key.js       Optional build-injected demo credential (null by default)
│   ├── auth.js           OpenRouter OAuth redirect + code exchange
│   ├── spend.js          Real cumulative spend (outside replayable history)
│   ├── tts.js            Text-to-speech
│   └── stt.js            Speech-to-text
├── i18n/
│   ├── i18n.js           t(key, params), tRaw(key), locale(), setLocale()
│   ├── en.json           English string table (~200 keys)
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

1. **Build scene** — pure snapshot of room, PC, NPCs, plus the scope packet
   (`scope.js`) and ledger memory. Secrets travel separately, via `buildGmContext()`
2. **Classify** — chip and compass input is matched locally (no model call);
   free text goes to the tiny tier and the response is validated (`validate.js`)
3. **Resolve** — pure JS D&D rules (d20, damage, movement validation)
4. **Enemy retaliation** — counter-attack if applicable and not escaped
5. **Narrate** — medium tier LLM streams GM narration, with chapter digests as
   memory and the `gmOnly` slice in the system prompt
6. **Commit** — writes resolved state to Spektrum + appends transcript
7. **Remember** — mechanical patches to the ledger, canon extracted from the
   narration, XP awarded, rolling digest refreshed, beat advanced. All of this
   runs *before* `finalizeTurn` so it lands inside the turn's undo boundary

An empty narration never commits: the turn throws before step 6 and flow.js
runs its failure path, rather than advancing the world behind a blank screen.

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

`src/ui/exports.js` + `src/ai/journal.js`:

- Sends all narrations to medium tier LLM to weave into coherent prose with chapters
- Chapters cached in `localStorage` (`dg-journal-cache`) — fingerprinted, only new turns re-processed
- Zero-dep EPUB builder: minimal store-only ZIP, XHTML chapters, canvas-rendered cover
- Cover: "DAN'S DUNGEONS: {title}" on sepia parchment, character name/class subtitle
- Falls back to raw HTML journal if LLM fails
- Step-by-step progress shown in transcript

### AI model tiers

Model tables live in **bag-of-holding-client** (its `src/llm/tiers.js`) — one owner,
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

Saves in `localStorage` (key: `dans-dungeons`). Full state exported as `.dnd.json`. Journal cache in `dg-journal-cache`. Locale in `dg-locale`.

### Tests

Tests in `tests/` using `node --test` (zero deps), 476 passing. Test deterministic
logic: dice, checks, combat, XP, schema validation, encounter state, save-growth
shape, the ledger memory loop, the classifier fast path and response validation.

Two contract tests guard classes of bug rather than functions:

- `tests/dom-contract.test.js` — every `getElementById` target in `src/` exists
  in `index.html`, so a null-guarded renderer can never silently no-op again
  (the chip layer did, for the repo's entire history).
- `tests/wiring.test.js` — every capability listed there has a real caller.
  Imports do not count: an unused import used to satisfy it, which is how four
  systems shipped built, tested and called by nothing.

Most tests mirror the pure shape rather than importing `src/` modules, because
`src/core/state.js` and anything importing it resolve `bag-of-holding-client`
through an esbuild alias that `node --test` cannot follow. New pure logic should
go somewhere importable (`src/ai/validate.js`) or into the client library, where
it can be tested for real.

CI (`.github/workflows/ci.yml`) runs the suite, the vendor-manifest check, the
build, and a stale-bundle guard on every push and PR.
