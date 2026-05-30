# 11 — Open questions

> **Status:** living list. Each entry should either get resolved into another
> doc, or graduate to a concrete ticket in `/docs/implementation/`.

## Spektrum specifics

Resolved against Spektrum 1.0.0 (2026-05-17). Captured in
[01-architecture.md § Spektrum's role](01-architecture.md#spektrums-role)
and [09-hosting-build.md](09-hosting-build.md). Short version:

- **Not redux-shaped.** Live `appState` reference, path-based
  `setValue`/`addValue`/`addAsync`, `computed`, `addSystem`/`watch`,
  `history`/`replay`/`checkpoint`/`forks`, `createSpektrum()` for instances,
  `serialize()` for snapshots. Agent surface (`describe`/`explain`/
  `attempt`/`defineFn`/`findByIntent`) is opportunistic, not load-bearing.
- **Persistence adapter ships.** `spektrum/persist`
  (`saveHistory`/`loadHistory`/`autoSave`) persists `history` to any
  `{getItem, setItem}` backend. Our slot-based saves go through IDB on top
  of `serialize()`; the companion is the right fit if/when we want history
  itself mirrored (e.g. for cross-tab dev tooling).
- **CDN URLs (Spektrum 1.0.0).**
  `https://unpkg.com/spektrum@1.0.0/spektrum.min.js` (core, ~13 kB) and
  `https://unpkg.com/spektrum@1.0.0/companions/spektrum-persist.min.js`.
  Still TODO: compute and lock the SRI hash via
  `openssl dgst -sha384 -binary <file> | openssl base64 -A` when we wire
  `index.html` (Phase 1).

## Model defaults

Tiers are defined in [05-ai-runtime.md](05-ai-runtime.md); concrete model
choices per tier are deferred to Phase 3 benchmarking.

- Best default per tier (`tiny`, `small`, `medium`, `large`, `summarizer`)
  on OpenRouter, balancing latency, JSON reliability, narrative quality,
  and cost-at-scale.
- TTS provider matrix: which combinations of `OpenRouter chat + X TTS`
  feel right as defaults? `SpeechSynthesis` is the obvious zero-cost
  fallback; OpenAI and ElevenLabs are the obvious paid options.
- Embedder host (post-MVP): server-API embedding vs. CDN-loaded WASM
  (`transformers.js`-style) running locally? The WASM route avoids
  per-use cost but contradicts the zero-deps rule unless pinned and
  hashed like Spektrum.

## Cost shape

- What does a fully generated 100h campaign actually cost end-to-end? —
  🔬 Phase 3 benchmarking.
- Packet-cache eviction: **decided** — LRU with 50 MB combined cap across
  packet + rendered-prompt IDB caches; evict packet cache first (cheaper
  to rebuild).

## Content & legal

Decided policies live in the local-only project legal guidance
(`docs/references/legal.md`, gitignored) and
[04-dnd-mechanics.md](04-dnd-mechanics.md) (player-facing terminology
table, trademark blocklist, and the SRD 5.2 audit).

- **SRD 5.2 audit — done.** Five engine deltas ship at MVP (species
  rename + 5 new species, Exhaustion 0–6, Weapon Mastery on items +
  Fighter L1/2/5 additions, Backgrounds + 4 Origin Feats). The rest
  (more classes, subclasses, levels 6+, full feats/spell catalogs,
  monsters, Narrator-side toolbox sections) stays deferred. See
  [04-dnd-mechanics.md § SRD 5.2 deltas → MVP engine work](04-dnd-mechanics.md#srd-52-deltas--mvp-engine-work).
  Execution lives in `bag-of-holding` (sibling repo) as 5 separate
  tickets, to be filed when that engine's next iteration starts.
- **Project rename — resolved. Name is now "Dan's Dungeons".
  name leans on the D&D phrasing; decide whether to rebrand or lean into
  parody before any public release. Tracked in
  [04-dnd-mechanics.md § Open](04-dnd-mechanics.md#open).

## Coherence at 100 hours

**Architecturally resolved.** See
[12-context-scoping.md](12-context-scoping.md) for the foundation:
hierarchical digest tree (Realm → Continent → Region → Location, path
depth `log(realm)` so per-turn cost stays roughly constant regardless
of campaign length) **plus** two complementary recall systems shipping
at MVP — inverted-index for proper-noun queries and client-side RAG via
a WASM embedder for associative recall. Splitting is automatic when any
node's L card exceeds budget.

Decided defaults captured in that doc:

- Verbatim transcript turns kept: **20 most recent**, summarised beyond.
- "Nearby" radius: **1 hop dungeons, 2 hops outdoor**. 3-hop revisit
  parked for very-open-world campaigns.
- Inverted-index retrieval: **ship at MVP**.
- Semantic retrieval: **ship at MVP** (local WASM embedder, hosted
  fallback in settings).

Remaining: concrete S/M/L token budgets (🔬 Phase 3 benchmarking) and
exact embedder model + CDN URL + SRI hash (decide alongside chat-tier
picks in [05-ai-runtime.md](05-ai-runtime.md)).

## Failure & weirdness — decided

- **Hallucinated contradictions.** Player reports via meta channel
  (`/report`); loop offers `/retcon <turn-id>` which rewinds to the
  nearest checkpoint and re-narrates with the contradiction noted in the
  Narrator's system prompt.
- **Streaming + cancel.** Tokens land in a buffer for display only; the
  structured commit happens once at stream end. Cancel drops the buffer,
  zero state mutation. No mid-stream writes ever.
  (Captured in [07-ui-ux.md § Streaming & interruption](07-ui-ux.md).)
- **Provider outage.** Cascade tier-fallback within the same provider
  (medium → small → tiny), then a configured alternate provider; if
  everything fails, show "the Narrator is sleeping" with manual retry.
  No silent model swaps — every fallback adds a one-line note in the
  transcript.

## UI / UX — decided

- Moveset resource costs, dice math, and other mechanical detail are
  **hidden by default**. A right-side **Nerd mode** sidebar (toggle
  `Ctrl+\` or 🔬 chrome button) reveals state inspector, dice log, AI
  call log, scope packet, cost meter, the `spektrum/agent` chat panel,
  and an optional dev console. The sidebar is the single place
  mechanical detail surfaces — no separate dev UI.
  (Captured in [07-ui-ux.md § Nerd mode](07-ui-ux.md).)
- Theme default: **parchment** (matches the "paperback novel" north
  star); light and dark also ship.

## Persistence — decided

- **`secrets` encryption.** Opt-in "no-cheat mode" setting; Web Crypto
  AES-GCM with a player-set passphrase. Off by default.
- **Save compression on export.** Yes, `CompressionStream('gzip')` on
  export, `DecompressionStream` on import. Auto-detect via magic bytes
  so uncompressed files still load.
- **Multi-slot saves.** Yes, in-app slot manager at MVP. Branching-saves
  decision already requires this; "export files" is too coarse.
- **Branching saves.** When the player rewinds and the engine drops a
  tail to `spektrum.forks`, we promote that fork to a new save slot by
  replaying its `{op, path, value, id}` entries into a fresh instance
  (~5 lines). No upstream `loadForks` API needed; "sibling save slots"
  UX is easier to reason about than a nested fork tree. `forks` keeps
  its day-to-day role as recovery after an accidental
  scrub-back-and-mutate.

## bag-of-holding integration — decided

- **Dev import:** relative path `import {…} from '../../bag-of-holding/index.js'`
  (zero overhead, no symlink admin).
- **v0.1.0 cut:** after one real campaign has run through it, ~Phase 5
  of [10-roadmap.md](10-roadmap.md). Tagged + published then.
- **License:** MPL 2.0 (file-level copyleft — kernel improvements
  stay public). The earlier decision was MIT to match Spektrum;
  revisited 2026-05-18 once the moat argument in
  [bag-of-holding/docs/why.md](../../../bag-of-holding/docs/why.md)
  made the licence the natural enforcement mechanism for the
  discipline. App code (Dans-Dungeons repo) is unaffected —
  MPL 2.0 doesn't infect the surrounding application.
- **npm publish workflow:** GitHub Action triggered on `v*` git-tag push.

## Scope creep we're saying "later" to

- Multiplayer / shared sessions.
- Image generation.
- Speech-to-text input. (Optional GM TTS *output* is in scope as a
  setting — see [05-ai-runtime.md](05-ai-runtime.md).)
- Mobile-first UX.
- Beyond level 5.
- Full multiclassing / feats / subclasses.

Move items out of this file the moment they're decided — this list should
shrink, not grow indefinitely.
