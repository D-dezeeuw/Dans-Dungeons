# 01 — Architecture

> **Status:** rough sketch. Spektrum API surface verified against
> [Spektrum 1.0.0](https://github.com/D-dezeeuw/spektrum); slice names and
> module layout still draft.

## Runtime topology

A single static page, no build step, no installed dependencies. Spektrum
provides state + history; everything else is hand-authored ES modules.

```text
┌────────────────────────────────────────────────────────────────────┐
│ index.html  (static, served by GitHub Pages)                       │
│                                                                    │
│  <script type="module" src="https://unpkg.com/spektrum@1.0.0/…"> │
│  <script type="module" src="./src/main.js">                        │
└────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │  Spektrum runtime   │  ← single source of truth: state + history
        └─────────────────────┘
                  ▲
                  │ commits
                  │
┌─────────────────┴───────────────────────────────────────────────┐
│ game/loop                                                       │
│   - reads player input                                          │
│   - asks GM agent to classify intent                            │
│   - runs rules (dice/checks/combat) via game/dnd                │
│   - asks GM agent to narrate outcome                            │
│   - commits resolved deltas to Spektrum                         │
└─────────────────────────────────────────────────────────────────┘
       │                 │                  │
       ▼                 ▼                  ▼
 ┌──────────┐     ┌────────────┐     ┌─────────────────┐
 │ ai/*     │     │ world/*    │     │ bag-of-holding  │
 │ openrouter│    │ agents +   │     │ (external dep)  │
 │ prompts   │    │ model      │     │ rules, dice,    │
 │ schemas   │    │            │     │ XP, beats       │
 └──────────┘     └────────────┘     └─────────────────┘
                                            ▲
                                            │
                                     ┌─────────────┐
                                     │ ui/console  │
                                     │ text I/O    │
                                     └─────────────┘
```

## External dependencies (loaded from CDN, never installed)

| Name | Role | Source |
| --- | --- | --- |
| **Spektrum** | State + history runtime | `https://unpkg.com/spektrum@1.0.0/spektrum.min.js` (core) + `https://unpkg.com/spektrum@1.0.0/companions/spektrum-persist.min.js` (history persistence) |
| **bag-of-holding** | D&D rules + beat runtime (sibling repo at `../bag-of-holding/`) | Dev: relative path. Prod: `https://unpkg.com/bag-of-holding@<pinned>/index.js` (after v0.1.0 publishes). |

Both are pinned to exact versions with SRI hashes. Neither is `npm install`-ed.
See [09-hosting-build.md](09-hosting-build.md) for the pinning procedure.

## Folder layout (proposed)

```text
/
├── index.html
├── package.json              ← zero deps, scripts + metadata only
├── src/
│   ├── main.js               ← boot: mount Spektrum, load save, attach UI
│   │
│   ├── core/
│   │   ├── state.js          ← createSpektrum() + initial appState shape
│   │   ├── history.js        ← replay/checkpoint helpers around spektrum.history
│   │   └── persistence.js    ← spektrum/persist + IndexedDB slot store + export/import
│   │
│   ├── ai/
│   │   ├── openrouter.js     ← fetch wrapper (timeouts, retries, accounting)
│   │   ├── tiers.js          ← maps tier name (tiny/small/medium/large/…) → model
│   │   ├── tts.js            ← optional second provider for GM voice
│   │   ├── context/          ← scope assembler + caches (see doc 12)
│   │   │   ├── assemble.js   ← pure: (locationId, sceneState, pc) → ScopePacket
│   │   │   ├── cards.js      ← S/M/L size variants per entity
│   │   │   └── cache.js      ← LRU + IndexedDB packet cache
│   │   ├── prompts/          ← composable prompt fragments
│   │   │   ├── gm-system.md
│   │   │   ├── classifier-system.md
│   │   │   ├── world-digest.md
│   │   │   └── ...
│   │   └── schemas/          ← JSON schemas for each agent output
│   │       ├── geography.schema.json
│   │       ├── history.schema.json
│   │       └── ...
│   │
│   ├── world/
│   │   ├── agents/           ← one file per generation layer
│   │   │   ├── geography.js
│   │   │   ├── history.js
│   │   │   ├── red-thread.js
│   │   │   ├── city.js
│   │   │   └── quest-weave.js
│   │   └── model.js          ← shapes + ID conventions for world objects
│   │
│   ├── game/
│   │   ├── loop.js           ← turn engine
│   │   ├── rules.js          ← thin re-export of bag-of-holding (sibling repo)
│   │   └── sessions.js       ← chapter boundaries, "previously on…", autosave
│   │
│   └── ui/
│       ├── console.js        ← text I/O, command parsing, log render
│       ├── chrome.js         ← settings, key entry, cost meter
│       └── style.css
│
├── tests/                    ← `node --test` only, zero deps
│   └── dnd/*.test.js
└── docs/
    ├── ideas/                ← these files
    └── implementation/       ← detailed specs grow here later
```

## Spektrum's role

Spektrum is **the only thing that holds canonical state**, and the only thing
that owns the history needed for undo and chapter rewinds. Everything else is
allowed to *propose* state via path-based writes, but only the loop calls the
mutators after rule validation.

### API surface we rely on

Spektrum is not Redux-shaped. There is no `store`, no `dispatch`, no
reducers, no middleware — and no `getState()`: `appState` is a stable live
reference you import and read directly. The pieces we use:

- **Reads.** `appState` (live, always current). `computed(path, deps, fn)`
  for derived values that should re-materialise into the tree.
- **Writes.** `setValue(path, value, id?)` for absolute assigns,
  `addValue(path, value, id?)` for numeric accumulation (turn counter, XP,
  cost meter). Both record into `history` and replay deterministically.
- **Async.** `addAsync(path, fn)` + `refresh(path)` for one-shot or
  re-triggerable async fills (e.g. the OpenRouter call that produces a turn
  result lands the structured response at a path).
- **Subscriptions.** `addSystem` / `watch` for code that should react to
  path changes (e.g. autosave, cost meter, transcript view).
- **History & time-travel.** `history`, `cursor`, `replay(n)`,
  `checkpoint(id)`, `forks`, `snapshots` — power `/undo`, `/redo`, chapter
  rewinds, and `attempt()`-style speculative GM moves.
- **Instances.** `createSpektrum({ historyLimit, snapshotEvery, forkLimit })`
  — we run a single instance for the game; tests use isolated ones.
- **Serialisation.** `serialize({ includeHistory })` returns the JSON we
  hand to the persistence layer for exports and slot saves.
- **Agent surface (opportunistic).** `describe()`, `explain({from, to})`,
  `attempt(name, fn)`, `defineFn(name, fn, meta)`, `findByIntent(name)` —
  potentially useful for the GM agent and for debug overlays, but not
  load-bearing for the core loop.

### Top-level paths in `appState`

Spektrum doesn't have "slices" in the Redux sense; it has whatever
top-level keys you put on `appState`. We plan to use:

- `world` — generated, mostly immutable after each layer pass.
- `secrets` — GM-only knowledge; never rendered to the transcript view.
- `party` — characters, inventory, resources, XP.
- `flags` — quest/world flags ("met the queen", "amulet shard #2 found").
- `transcript` — the player-visible log (append-only within a chapter).
- `session` — current chapter id, turn count, autosave cursor.
- `ai` — current model, token totals, last error.

## Why pure functions around Spektrum

Agents and rules modules should be **pure**: input = (current state digest,
intent), output = (proposed delta, dice rolls, narration). This makes them:

- **Testable** without an LLM (mock the AI call, assert deltas).
- **Replayable** with the same seed for debugging.
- **Composable** — the loop can run a check before letting the GM narrate.

## Boundary rules

- The **UI** never calls the AI directly — only the loop does.
- The **AI** never writes to Spektrum directly — it returns structured data the
  loop validates and commits.
- The **rules** never call the AI — they're deterministic JS.
- The **persistence** layer never reads from the AI — it only mirrors Spektrum.
