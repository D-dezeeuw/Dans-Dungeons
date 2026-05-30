# 00 — Overview

> **Status:** rough idea, pre-implementation. Living doc.

## Vision

Dan's Dungeons is a **text-based D&D game in the spirit of Zork**, but pulled
into the 21st century by putting an LLM in the GM's chair. A player starts a
campaign, the engine generates a coherent world several layers deep, and then
play unfolds as natural-language dialogue with an AI Dungeon Master that knows
the rules, the world, and the secrets it must keep.

Everything runs in the browser. The site is **static, hosted on GitHub Pages**,
calls an **OpenAI-compatible API (OpenRouter) using the player's own key**, and
ships **zero npm dependencies** — runtime libraries (notably **Spektrum**) load
from a pinned `unpkg` URL.

## Product pillars

1. **AI-native by design.** The AI isn't a feature bolted onto a CRUD game; it
   *is* the GM, the world author, and the NPC voice. Mechanics exist to keep it
   honest, not to replace it.
2. **A coherent 100-hour world.** World layers are generated up front so the
   campaign has a real "red thread" the player can follow — not endless
   improvisation that contradicts itself by hour 4.
3. **Player-owned save.** Everything lives in `localStorage` (with IndexedDB
   spillover) and can be exported as a single `.dnd.json` file. No accounts,
   no servers, no telemetry.
4. **Zero supply-chain risk.** No dependencies are installed. Spektrum and any
   future runtime libs load from CDN at pinned, ideally SRI-hashed, URLs.
5. **Real D&D, lightly held.** Honour the basic ruleset (d20, ability scores,
   classes, XP) but let the AI handle narrative friction.

## Non-goals (for v1)

- Multiplayer / shared sessions.
- A graphical UI beyond text and basic chrome. No tilemaps, no portraits.
- Server-side state, accounts, leaderboards.
- Voice input. (Optional GM TTS *output* is in scope as a setting — see [05-ai-runtime.md](05-ai-runtime.md).)
- Image generation (could be a later add-on).
- Shipping copyrighted D&D content. Lean on the **5e SRD / basic rules** and
  attribute clearly.
- Mobile-first polish at MVP; desktop browser is the target form factor.

## Audience

- D&D players who want a solo experience without scheduling a table.
- Zork/IF fans who want richer state and persistent worlds.
- Hobbyists who'll happily paste an OpenRouter key.

## Glossary

| Term | Meaning |
| --- | --- |
| **GM** | Game Master. In MVP this is the AI; later, optionally the player. |
| **Red thread** | The main story arc generated alongside the world. |
| **Beat** | A single major story node on the red thread. |
| **Layer** | One pass of world generation (geography, history, cities, …). |
| **Chapter / session** | A D&D-style play session, bounded by autosave. |
| **Moveset** | The actions a character can take this turn given class/level/resources. |
| **Digest** | A compressed summary of long-term lore injected into prompts. |
| **Scope packet** | The minimal bundle of world facts assembled for one AI turn (here/nearby/region/world + PC memory). |
| **Tier** | A named model slot (`tiny`/`small`/`medium`/`large`/`summarizer`/`embedder`/`tts`) the player maps to a real model id. |
| **Spektrum** | The state + history engine, loaded from `unpkg`. |
| **BYOK** | Bring Your Own Key — the player provides their OpenRouter key. |

## Where to read next

- [01-architecture.md](01-architecture.md) — the module layout.
- [02-world-generation.md](02-world-generation.md) — how worlds are built.
- [05-ai-runtime.md](05-ai-runtime.md) — model tiers, BYOK, cost economics.
- [12-context-scoping.md](12-context-scoping.md) — what the AI sees per turn, and why it stays cheap.
- [10-roadmap.md](10-roadmap.md) — phased delivery plan.
