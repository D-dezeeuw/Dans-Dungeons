# 05 — AI runtime

> **Status:** rough sketch.

## Provider: OpenRouter (BYOK)

The site never holds an API key of its own. The player enters their
**OpenRouter** API key into a settings field; we store it in `localStorage`
under a namespaced key and send it *only* to `https://openrouter.ai/...`.

OpenRouter exposes an OpenAI-compatible REST surface, so the same wrapper
works for any compatible provider the player wants to swap in (Together,
Groq, a local Ollama running on the player's machine, etc.). Default
endpoint is OpenRouter; the endpoint URL is an editable setting for power
users.

### Why BYOK

- **Static-site friendly.** No backend, no key vault, no proxy.
- **Cost transparency.** The player sees their own usage on their own dash.
- **Trust.** We never see their key or their gameplay.

### Multi-provider note

Some optional features (notably **TTS** for the GM's voice) need providers
*other than* OpenRouter, because OpenRouter is chat-only. We allow a second
key + base URL per non-chat capability (TTS today; potentially image gen
later). Each extra provider is opt-in from the settings panel and shares
the same "key stays in localStorage, sent only to that base URL" rule.

## Model tiers (which AI does which job)

The right way to keep costs sane is to **match each job to the smallest
model that can do it well**. We pre-define named *tiers*; each tier maps to
a model id the player picks in settings (with sensible defaults populated
from OpenRouter's `/models` list).

| Tier slot | Job | Frequency | Why this tier |
| --- | --- | --- | --- |
| `tiny` | Intent classifier, slash-command parser, sentiment, simple disambiguation. | Every player turn. | Single structured output, small prompt. Latency matters more than nuance. A small, fast model is plenty. |
| `small` | NPC tactics (which moveset action does this orc take?), moveset filter, short reply drafts (shopkeeper one-liners). | Every NPC turn, sometimes more than once per round. | A bit more reasoning than the classifier, but still narrow. |
| `medium` | **GM narrator** — describes outcomes, voices NPCs, paints rooms turn-to-turn. | Every player turn. | This is the voice the player hears. Quality matters; cost matters because it runs constantly. Mid-tier sweet spot. |
| `large` | World generation layers, red-thread plotting, set-piece scenes (the king's death, the dragon's monologue), lazy-expander for important regions. | Rare: campaign start, ~once a chapter, story climaxes. | We pay for quality only where it lasts a hundred hours. |
| `summarizer` | World digest refresh, region/NPC card generation, transcript compression. | Background, occasional. | Compression is summarization — well-suited to a small model run with `temperature: 0`. |
| `embedder` | (Post-MVP.) Embeds transcript chunks and lore for semantic recall. | Background, occasional. | A tiny embedding model; could even run client-side via a CDN-loaded WASM model. |
| `tts` | (Optional.) Speak the GM's narration aloud. | Per narration if enabled. | Separate provider (OpenRouter doesn't do TTS). Browser `SpeechSynthesis` is a free fallback for "voice on, no extra key". |

A few rules-of-thumb the assembler follows:

- **Tiny/small calls are cheap and parallelizable.** Run classifier and NPC
  tactics in parallel where the loop allows.
- **Medium is the hot path.** Optimize it: streaming, small scope packet
  (see [12-context-scoping.md](12-context-scoping.md)), aggressive caching.
- **Large is the rare expensive case.** Budget it; show progress; allow
  cancel.
- **Summarizer runs lazily**, never on a turn's critical path. Schedule it
  during the player's reading time.

### What we store

```jsonc
{
  // OpenRouter (chat tiers)
  "ai.openrouter.key":  "sk-or-...",
  "ai.openrouter.base": "https://openrouter.ai/api/v1",

  "ai.model.tiny":       "<small/fast model id>",
  "ai.model.small":      "<small model id>",
  "ai.model.medium":     "<mid-tier model id>",
  "ai.model.large":      "<flagship model id>",
  "ai.model.summarizer": "<small model id>",
  "ai.model.embedder":   "<embedding model id, optional>",

  // TTS (optional, separate provider)
  "ai.tts.enabled":  false,
  "ai.tts.provider": "browser",        // "browser" | "openai" | "elevenlabs" | "custom"
  "ai.tts.key":      "",
  "ai.tts.base":     "",
  "ai.tts.voice":    "default"
}
```

Defaults are deferred until we benchmark on a real demo — see
[11-open-questions.md](11-open-questions.md).

The settings panel exposes a "**simple**" view (one model picker that fills
all tiers with sane spreads) and an "**advanced**" view (per-tier pickers).
Most players will only see simple.

## Structured outputs

Every non-trivial call uses **JSON-schema-constrained output**. Two layers
of safety:

1. Ask the model to return JSON conforming to a schema we paste into the
   prompt (and use the provider's `response_format: { type: "json_object" }`
   where available).
2. Validate the response with a small hand-rolled validator (zero deps).
   On failure, retry **once** with the validation error included; on second
   failure, surface to the player.

Schemas live in `src/ai/schemas/*.schema.json` (one per agent), versioned
with the save format.

## Prompt layering

Every prompt is composed from layered fragments. The **scope packet** built
by the scope assembler (see [12-context-scoping.md](12-context-scoping.md))
is what makes "context" small or large for this turn.

```text
[ system: role + tone + rules constraints, by tier ]
[ scope packet rendered to prose / structured fields ]
[ session context: recent transcript window ]
[ task: this turn's specific job + JSON schema ]
```

- **System prompt** is short, stable, and **tier-specific** (the classifier
  has a different system prompt than the narrator).
- **Scope packet** carries everything world-related the call needs. It's
  pre-built and shared across the turn's pipeline so we don't re-assemble
  for the classifier *and* the narrator.
- **Session context** is a sliding window over recent transcript (latest
  N turns; size tuned per tier — the classifier needs less than the
  narrator).
- **Task prompt** carries the specific instruction and the JSON schema.

## Cost economics

The 100-hour campaign target makes per-turn cost dominate total spend. The
levers we pull, in priority order:

1. **Right model for the job** (the tier table above).
2. **Small scope packet** ([12-context-scoping.md](12-context-scoping.md)).
3. **Cache assembled packets and rendered prompts** by content hash.
4. **Stream the narrator** so the player starts reading at first-token,
   reducing perceived latency without reducing cost (but reducing the
   wasted cost of cancelled long generations).
5. **Compress transcript aggressively**: keep the last ~10 turns verbatim,
   summarize the rest into chapter summaries.
6. **Budget caps** in settings: pause and confirm before exceeding.

Every call records:

- model id, tier, prompt tokens, completion tokens
- estimated USD (from OpenRouter's pricing list, cached on load)
- agent name (gm.narrate / world.geography / classifier / npc.tactics / ...)

The UI surfaces a live counter: **turn cost**, **chapter cost**,
**campaign-to-date cost**, with a tier breakdown on hover. A budget cap
pauses generation and asks for confirmation before exceeding it.

## Reliability

- **Timeouts.** Per-tier defaults: `tiny`/`small` 20s, `medium` 60s, `large`
  5 min.
- **Retries.** Network failure → exponential backoff, max 3 attempts.
  Schema failure → repair retry, max 1 attempt.
- **Cancellation.** Player can cancel any in-flight call; partial streamed
  content is kept and treated as canon (no silent discards).
- **Rate limits.** If we get 429, back off and surface the wait time.
- **Tier fallback.** If the configured model for a tier returns repeated
  errors, suggest (don't auto-swap) a fallback from the player's `/models`
  list.

## Privacy & data handling

- The key and the save live in `localStorage` / `IndexedDB` only.
- No analytics, no telemetry.
- Prompts include world facts and transcript — this is sent to the player's
  chosen provider, exactly as they'd expect. We tell them so in the
  settings panel.
- TTS audio is **streamed and discarded** by default; an opt-in setting
  caches generated audio in IndexedDB for replay (it can be large).

## Open

- Concrete model defaults per tier — deferred to Phase 3 benchmarking.
- TTS provider matrix: which combinations of (OpenRouter chat + X TTS) are
  reasonable defaults? `SpeechSynthesis` is the obvious zero-cost fallback.
- Should we ship STT (speech-to-text) input too? Probably no at MVP.
- Embedder host: API-side (cheap, network-dependent) or CDN-loaded WASM
  (free per use, hefty download, contradicts the zero-deps rule unless
  pinned)?
