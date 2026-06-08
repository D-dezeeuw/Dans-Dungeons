# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run serve   # serves the repo root; open: http://localhost:3000
node build.js   # esbuild bundle → vendor/app.bundle.js + version stamp
npm test        # node --test tests/ — zero-dep test runner (Node 20+)
```

Run a single test file: `node --test tests/dnd/dice.test.js`

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

- **Zero deps installed.** `node_modules` holds only esbuild (dev). Runtime libraries (Spektrum, bag-of-holding) are vendored or load from `unpkg` at pinned URLs.
- **esbuild bundles for prod.** `node build.js` produces `vendor/app.bundle.js`, stamps the git hash into `vendor/app.version` and `sw.js`. GitHub Pages serves the bundle.
- **BYOK.** The player provides their own OpenRouter API key, stored in `localStorage`, sent only to the configured AI base URL.

### Module map

```
src/
├── main.js              Boot entry, settings wiring, locale init
├── core/
│   ├── state.js          Spektrum wrapper (setValue, tick, computed, etc.)
│   └── utils.js          escHtml and other small helpers
├── game/
│   ├── flow.js           Game lifecycle FSM: setup, play loop, victory/defeat, autoplay
│   ├── loop.js           Turn engine: classify → resolve → narrate → commit
│   ├── resolver.js       Pure D&D rules: attack, skill, move, take, unlock
│   ├── character.js      Character creation wizard
│   ├── world.js          Procedural dungeon generator
│   └── rules.js          Thin re-export shim for bag-of-holding
├── ai/
│   ├── client.js         OpenRouter HTTP transport, retry, streaming
│   ├── classify.js       Intent classifier (tiny tier)
│   ├── narrate.js        GM narrator + scene image generation (medium tier)
│   ├── autoplay.js       LLM-driven autopilot (tiny tier)
│   ├── journal.js        LLM story weaver for journal export (medium tier)
│   ├── schemas.js        JSON schemas: CLASSIFIER, NARRATOR, AUTOPLAY, JOURNAL
│   ├── tiers.js          Default model IDs per tier
│   ├── stream.js         SSE stream parser / NarrationExtractor
│   ├── tts.js            Text-to-speech via OpenRouter
│   └── stt.js            Speech-to-text via OpenRouter
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
    ├── epub.js            Zero-dep EPUB builder (ZIP + XHTML + canvas cover)
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

`src/ui/exports.js` + `src/ai/journal.js` + `src/ui/epub.js`:

- Sends all narrations to medium tier LLM to weave into coherent prose with chapters
- Chapters cached in `localStorage` (`dg-journal-cache`) — fingerprinted, only new turns re-processed
- Zero-dep EPUB builder: minimal store-only ZIP, XHTML chapters, canvas-rendered cover
- Cover: "DAN'S DUNGEONS: {title}" on sepia parchment, character name/class subtitle
- Falls back to raw HTML journal if LLM fails
- Step-by-step progress shown in transcript

### AI model tiers

| Tier | Purpose | Default model |
|------|---------|---------------|
| `tiny` | Classifier, autoplay (every turn) | gemini-2.5-flash-lite |
| `medium` | Narrator, journal story | deepseek-v4-pro |
| `image` | Scene sketches | gemini-2.5-flash-image |
| `tts` | Text-to-speech | gemini-3.1-flash-tts |
| `stt` | Speech-to-text | nvidia/parakeet-tdt |

The `maxTokens` override in `chatCompletion()` opts allows per-call limits (journal uses 4000).

### Service worker

Cache-first for speed, self-invalidating via version check:

- Page fetches `vendor/app.version` (`cache: no-store`) on every load
- Posts hash to SW via `postMessage`
- On mismatch: SW purges all caches, unregisters, reloads all tabs
- Next load gets fresh files, new SW installs

### Icons

Lucide SVG icons (MIT) vendored in `vendor/icons/`. `src/ui/icons.js` exports inline SVG strings via `icon.name(size)`. No emoji in the UI — all icons are Lucide SVGs.

### Sibling repo: `bag-of-holding`

D&D rules engine at `../bag-of-holding/`. Imported via `src/game/rules.js` shim. Provides: dice, checks, combat, conditions, XP, character derivation, class/species/background SRD data.

### Sibling repo: `bag-of-holding-client`

Browser host toolkit at `../bag-of-holding-client/` (vendored at `vendor/bag-of-holding-client/`, esbuild alias `'bag-of-holding-client'`). The host machinery the rules engine deliberately omits — now owns the **LLM client** (`src/ai/client.js` is a thin appState→config adapter over it), the **seeded blueprint factory + `runWorldgenPipeline` orchestration** (worldseed/worldgen consume it; `startCampaign` + `generateWorldBible` share one `runPipeline`), the **dungeon-graph generator** (`world.js` injects i18n descriptors + bestiary stats), and the **travel FSM** (`flow.js` imports it). Config-injected, zero deps, `node --test`-able. See `docs/ideas/14-client.md`.

### Persistence

Saves in `localStorage` (key: `dans-dungeons`). Full state exported as `.dnd.json`. Journal cache in `dg-journal-cache`. Locale in `dg-locale`.

### Tests

Tests in `tests/` using `node --test` (zero deps). Test deterministic logic only: dice, checks, combat, XP, schema validation.
