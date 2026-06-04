# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run serve   # serves the repo root on :3000 via python3 -m http.server
node build.js   # esbuild bundle → vendor/app.bundle.js + version stamp
npm test        # node --test 'tests/**/*.test.js' — zero-dep test runner (Node 20+)
```

Run a single test file: `node --test tests/worldgen/dungeon.test.js`

> esbuild is the only npm dependency (`devDependencies`). If `node_modules` is
> absent, run `npm install` before `node build.js`. Tests need no install.

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
│   ├── resolver.js       D&D rules + Spektrum commits: attack, skill, move, take, unlock
│   ├── combat-math.js    Pure combat/skill arithmetic (no state, no Dice) — unit-tested
│   ├── character.js      Character creation wizard
│   ├── world.js          Procedural dungeon generator (single dungeon)
│   ├── worldseed.js      Pure seeded "blueprint" builder (tone, archetypes, factions)
│   ├── worldgen.js       AI worldgen pipeline: world → factions → beats → region → settlement
│   ├── worldbible.js     Runs full pipeline + formats it into EPUB chapters
│   └── rules.js          Thin re-export shim for bag-of-holding
├── ai/
│   ├── client.js         OpenRouter HTTP transport, retry, 429 fallback chains, streaming
│   ├── auth.js           OpenRouter OAuth (PKCE) one-click connect, key exchange
│   ├── openrouter.js     Back-compat re-export barrel (prefer importing specific modules)
│   ├── classify.js       Intent classifier (tiny tier)
│   ├── narrate.js        GM narrator + scene image generation (medium tier)
│   ├── autoplay.js       LLM-driven autopilot (tiny tier)
│   ├── journal.js        LLM story weaver for journal export (medium tier)
│   ├── schemas.js        JSON schemas: classifier, narrator, autoplay, journal, worldgen
│   ├── tiers.js          Free/Deluxe model sets, fallback chains, embedded free-tier key
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

### AI world generation pipeline

Above the single dungeon sits a layered, AI-driven worldgen pipeline:

- `worldseed.js` — **pure, seeded** blueprint builder. Picks tone, world
  archetype, threat, climate, god domains, faction slots, etc. from curated
  lists using seeded RNG. Same seed → same blueprint → reproducible world. No AI.
- `worldgen.js` — turns the blueprint into prose via cascading AI calls
  (world → factions → beats → region → settlement). Each generator gets its
  parent's **digest** + the blueprint as constraints, so the LLM fleshes out
  fixed choices rather than inventing freely. Schemas live in `ai/schemas.js`.
- `worldbible.js` — runs the whole pipeline and formats the result into EPUB
  chapters; also keeps the raw world JSON for export/import.

The digest/S-card cascade (parent passes a compressed summary to children, and
the narrator receives leaf-to-root cards rather than full digests) is what keeps
prompts cheap — see `tests/worldgen/digest.test.js`.

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

### AI model tiers & free/Deluxe

`src/ai/tiers.js` defines named tiers (`tiny`, `medium`, `large`, `image`, `tts`,
`stt`) and two model sets:

- **Free** (`FREE_MODELS`, the default) — all `$0` OpenRouter models (`:free`
  suffix). No image/TTS/STT (those slots are `null`). Uses an **embedded
  free-tier key** (`_cfg()`, XOR-obfuscated). `FREE_FALLBACKS` gives each slot an
  ordered list of alternates the client rotates through on a 429.
- **Deluxe** (`PAID_MODELS`) — higher-quality paid models via the player's own
  key (BYOK). Unlocks image sketches, TTS, mic/STT, autoplay, and roleplay.

`modelsForTier(tier)` returns the set for `'deluxe'` vs anything else. Model IDs
are versioned and change often — read `tiers.js`, don't trust a hardcoded list.

> The embedded free-tier key ships in the bundle and is **public by design** —
> see the SECURITY NOTE in `tiers.js`. It must be provisioned with a hard spend
> cap and restricted to `:free` models.

The `max_tokens` override in `chatCompletion()` opts allows per-call limits (journal uses 4000).

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

### Persistence

Saves in `localStorage` (key: `dans-dungeons`). Full state exported as `.dnd.json`. Journal cache in `dg-journal-cache`. Locale in `dg-locale`.

### Tests

Tests in `tests/` using `node --test` (zero deps, no install). Test
**deterministic logic only** — never network or AI.

App source modules import bare specifiers (`spektrum`, `bag-of-holding`) and
browser globals (`localStorage`), so they can't be imported under bare Node.
Two patterns work around this:

- **Contract tests** (`tests/worldgen/`) assert the *shape* a generator must
  return, using inline fixtures — no app import.
- **Pure-module tests** (`tests/combat/combat-math.test.js`) import a
  browser-free module directly. Keep deterministic rules math in such modules
  (e.g. `game/combat-math.js`) so `resolver.js` stays a thin state-I/O wrapper
  over testable pure functions.
