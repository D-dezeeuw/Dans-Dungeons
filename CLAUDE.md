# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run serve   # serves from Projects/ (parent of 2024/ and 2026n/)
                # open: http://localhost:8000/2026n/Dungeons-and-Dans/
npm test        # node --test tests/ — zero-dep test runner (Node 20+)
```

Run a single test file: `node --test tests/dnd/dice.test.js`

## Architecture

**Dungeons and Dans** is a text-based, AI-driven D&D game that runs 100% in the browser — no backend, no build step, no installed npm dependencies.

### Key constraints

- **Zero deps installed.** `node_modules` must stay empty. Runtime libraries (Spektrum, bag-of-holding) load from `unpkg` at pinned, SRI-hashed URLs. No CDN dependency is added without its exact version and `integrity` hash.
- **No build step.** What's in the repo is what's served (GitHub Pages). ES modules only; no bundler.
- **BYOK.** The player provides their own OpenRouter API key, stored in `localStorage`, sent only to the configured AI base URL. The app never proxies or stores it server-side.

### State ownership (Spektrum)

Spektrum is the **single source of truth** — all canonical state and the history needed for undo/rewind. It is not Redux-shaped; there is no `dispatch` or `getState()`. `appState` is a stable live reference:

- `setValue(path, value)` / `addValue(path, value)` for writes (both record into history).
- `computed(path, deps, fn)` for derived values.
- `addAsync(path, fn)` + `refresh(path)` for async fills (AI responses land at a path).
- `serialize({ includeHistory })` for export/save.

Top-level `appState` paths: `world`, `secrets`, `party`, `flags`, `transcript`, `session`, `ai`.

### Turn loop boundary rules

The game loop (`src/game/loop.js`) is the only thing that writes to Spektrum or calls the AI. The rules:

- **UI** never calls the AI directly.
- **AI agents** return structured data; the loop validates and commits.
- **Rules** (`src/game/rules.js`, a thin re-export of `bag-of-holding`) are deterministic JS — no AI calls.
- **Persistence** mirrors Spektrum only; it never reads from the AI.

### Sibling repo: `bag-of-holding`

The D&D rules + beat runtime lives at `../bag-of-holding/` (a separate repo). During dev, imported via relative path. On release, swapped to a pinned `unpkg` URL. `src/game/rules.js` is the thin re-export shim — all app code imports from there, never directly across repos.

### AI model tiers

Each job maps to a named tier (`tiny` / `small` / `medium` / `large` / `summarizer` / `embedder` / `tts`). The player maps each tier to a real model id in settings. `tiny` runs on every player turn (classifier); `medium` is the narrator hot path; `large` is used only for world generation and story climaxes.

### Context / scope packets

Every AI call gets a **scope packet** — the smallest bundle of world facts for the current moment. The assembler (`src/ai/context/assemble.js`) is a **pure function**: no LLM calls, no side effects. It walks the geography graph outward from the current location (here → nearby → region → realm) and applies a token budget, pruning from the outside in. The packet is built once per turn and shared across the classifier → rules → narrator pipeline.

### Structured AI outputs

Every non-trivial AI call targets a JSON schema in `src/ai/schemas/*.schema.json`. The response is validated by a hand-rolled validator (zero deps). On schema failure: one repair retry with the error included; on second failure, surface to the player.

### Persistence

Saves live in `localStorage` (primary) with IndexedDB spillover for large data. The full save exports as a `.dnd.json` file via `serialize({ includeHistory: true })`.

### Tests

Tests live in `tests/` and use `node --test` (zero deps). Test deterministic logic only: dice, checks, combat, XP, schema validation, persistence migrators. AI-touching layers get smoke tests with mocked network responses — assert that given a valid response shape, the loop commits the correct Spektrum delta.
