# 07 — UI / UX

> **Status:** rough sketch.

## North-star feeling

Reading a paperback novel that talks back. Text-first. Generous line-height
and reading-width. No flashy chrome. The Narrator's voice is the star; UI
elements fade until needed. Mechanical detail (dice math, resource costs,
state internals) is **hidden by default** to protect roleplay — players who
want to see under the hood toggle **Nerd mode** (see below).

## Screen anatomy

```text
┌──────────────────────────────────────────────────────────────┐
│  ☰ Dan's Dungeons     [HP 18/24]  [Lv 3 Rogue]  $0.42 ⓘ  │ ← chrome bar
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   The crypt's silence breaks. A skitter, behind the column. │
│   You can almost see the eyes catching torchlight.          │
│                                                              │
│   > You drew your dagger and edged left.                    │
│                                                              │
│   The shape lunges — wiry, claws first. Roll initiative.    │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Suggested:  ⚔ Attack   🗣 Talk   🏃 Run   👁 Look          │ ← moveset chips
├──────────────────────────────────────────────────────────────┤
│  > _                                                         │ ← free-text input
└──────────────────────────────────────────────────────────────┘
```

- **Chrome bar:** key vitals (HP, level, class, running cost). Click ⓘ for
  details, click ☰ for menu (settings, save/load, end chapter). A small
  toggle (🔬) opens Nerd mode.
- **Transcript:** the only thing that scrolls. Narrator text and player
  input are visually distinct (player as quoted/indented, Narrator as
  flowing prose).
- **Moveset chips:** clickable suggestions reflecting current legal
  actions. **Resource costs (slot used, HP, etc.) are hidden by default**
  and revealed inline only when Nerd mode is on. Power users can also hide
  the chips entirely and live in free-text.
- **Input:** single-line by default, expands to multi-line on Shift+Enter.
  Slash commands (`/save`, `/note`, …) auto-suggest.

## Input model

- **Default is free-text.** The classifier maps it to a legal action.
- **Slash commands** are first-class (meta channel — see
  [03-game-loop-and-sessions.md](03-game-loop-and-sessions.md)).
- **Moveset chips** insert a stub the player can edit before sending — they're
  *prompts*, not commits.

## Streaming & interruption

- Narrator responses stream token-by-token. Player can press `Esc` to
  interrupt. Streaming is **display-only**: tokens land in a buffer for
  the reader, and the structured commit happens once at stream end. A
  cancel during streaming drops the buffer; no state mutation occurs.
- The cursor stays in the input box while the Narrator streams, so the
  player can start typing the next turn. Sending while the stream is in
  flight is allowed and the loop queues it — a banner makes that visible.

## Nerd mode (debug + transparency sidebar)

A single right-side panel that doubles as **player-facing transparency**
and **developer debug**. Hidden by default; toggle via `Ctrl+\` (or the
🔬 chrome-bar button). Setting persists.

```text
┌──────────────────────────────────────────────┬───────────────────────┐
│  …transcript and chips as normal…           │  Nerd mode            │
│                                              │  ─────────────────    │
│                                              │  ▸ State inspector    │
│                                              │  ▸ Dice & roll log    │
│                                              │  ▸ AI calls           │
│                                              │  ▸ Scope packet       │
│                                              │  ▸ Cost meter         │
│                                              │  ▸ Spektrum agent     │
│                                              │  ▸ Console            │
└──────────────────────────────────────────────┴───────────────────────┘
```

Panes (each is a collapsible section):

- **State inspector.** Live read of `appState` — party, scene, flags,
  current beat. Powered by `spektrum.describe()` for the operational
  manifest; bound to state so it updates as turns commit.
- **Dice & roll log.** Every roll the engine produced this session, with
  modifiers, outcomes, and which engine call requested it. The "show
  dice math" setting becomes redundant — Nerd mode is the math.
- **AI calls.** Each request: model, role (classifier / narrator /
  summarizer / embedder), input tokens, output tokens, latency, USD
  cost, expandable to show the full rendered prompt and the raw response.
- **Scope packet.** The packet the assembler built for the current turn:
  which cards at which size class, which retrieved chunks, total token
  budget. Click an entity to jump to its full card in the inspector.
- **Cost meter.** Running session totals + per-tier breakdown; the
  chrome-bar number is just this pane summarised.
- **Spektrum agent.** The `spektrum/agent` companion's chat panel,
  pre-wired to our state. Lets a player (or developer) ask the engine
  questions like *"why did Bob refuse to talk to me?"* — it inspects
  state, history, and flags to answer.
- **Console.** Drops into a JS REPL bound to the live `spektrum`
  instance and to our module surface. Off by default, behind a "developer
  tools" setting — exposes power users can debug saves directly.

The same panel ships in production: power players get insight, devs get
debug, and we don't maintain two UIs. Mechanical-detail settings (dice
math toggle, etc.) simply move under Nerd mode — having the panel open
is the same as opting into the math.

## Settings panel

Accessed via ☰. Contains:

- OpenRouter API key + base URL.
- Model picker for `narrator` and `generator` slots.
- Cost cap (optional).
- Tone preference (heroic / grimdark / comedic).
- Nerd mode default (off by default; sidebar opens on toggle either way).
- Embedder choice (local WASM — recommended, ~30 MB one-time / hosted via
  OpenRouter / off — see [12-context-scoping.md](12-context-scoping.md)).
- No-cheat mode (encrypts the `secrets` slice; requires a passphrase).
- Theme (light / dark / parchment).
- Reset / export / import save.

## Long-running operations

World generation is the main offender — minutes of waiting. UI must:

- Show layer-by-layer progress (Geography ✓ • History ✓ • Red thread … • …).
- Stream the layer's structured output as it arrives where possible.
- Show live token + USD counters.
- Have a visible cancel button at every step.

## Accessibility

- Semantic HTML (article for transcript, button for actions).
- Keyboard-first: every chip and command reachable without a mouse.
- Respect `prefers-reduced-motion` (no streaming animations if reduced).
- Respect `prefers-color-scheme`.
- Color contrast targets WCAG AA at minimum.
- Font: a generous serif for narrative, monospaced for player input and
  system messages. Player-selectable.

## Performance targets

- Time-to-first-token for a turn: aim for **under 1.5s** on a fast model.
- World generation visible activity within **2s** of "New Campaign".
- Page bundle (everything we ship + the unpkg Spektrum): comfortably under
  **300KB** transferred.

## Mobile

Not the target form factor at MVP. Pages should not break on mobile, but
the moveset chips and input may be cramped; we accept that and revisit later.

## Open

- Should we render images of locations/NPCs via a separate image-gen agent
  later? Could be a setting once a player provides an image-gen key.
- Voice mode (TTS for GM, STT for player) is a fun future toggle.
