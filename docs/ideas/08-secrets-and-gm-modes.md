# 08 — Secrets and GM modes

> **IMPLEMENTATION STATUS (DOC-ONLY)** — audited 2026-08-07.
> The GM secrets slice shipped with E5.S1: `assembleScope({includeGmOnly:true})` collects unrevealed NPC secrets, the beat directive and unpaid foreshadowing into a `gmOnly` block that reaches the narrator's system prompt and never the scene object the UI renders or the save serialises (`tests/wiring.test.js` asserts the separation). The information-asymmetry model and player-as-GM mode B are still unbuilt. The audit's caveat stands: secrets travel verbatim inside the prompt, so this design still wants secrets-by-reference before it scales.
> Full evidence: [`docs/audit/2026-08-comprehensive-audit.md`](../audit/2026-08-comprehensive-audit.md).

> **Status:** rough sketch.

## Why this gets its own doc

A D&D-style experience lives or dies on **information asymmetry**: the GM
knows things the player doesn't, and rationing that knowledge is what makes
mystery, surprise, and reveal possible. When the GM is an AI, that knowledge
has to be modeled *and* protected, not just narrated around.

There's also a second axis the user wants to explore: **inverting the
roles** — the player runs the world, the AI plays the party. That's a
different product, with overlap; capturing both here so we don't paint
ourselves into a one-mode corner.

## Secret state

A dedicated `secrets` slice in Spektrum. Examples of what lives here:

- True identities behind disguises and aliases.
- NPC motives, loyalties, and lies.
- Dungeon contents before the player sees them.
- Trap locations, hidden doors.
- The "true" version of historical events vs. the rumored versions.
- The red thread's next intended beat and any pre-planted hooks.

### Read/write rules

- **Read:** the GM agents (narrator, classifier, NPC tactics, lazy expander)
  may read `secrets` as part of their context. The transcript view never
  renders it.
- **Write:** the world generators write to `secrets` at creation time. The
  loop writes to `secrets` when the GM places a new clue or twist. Player
  actions don't write to `secrets` directly.
- **Reveal:** when the player discovers a secret, the loop *copies* the
  relevant fact from `secrets` into `world` (now canonical, player-known).
  The secret itself stays in `secrets` so the GM remembers what *was* hidden
  vs. what's always been public.

### Audit & dev tools

A dev-only `/show secrets` command (gated by a setting that's off by
default) dumps the relevant secrets for the current scene. Invaluable for
debugging "why did the GM do that?" without playing the game blind.

## Trust boundary

The persistence layer writes `secrets` to local storage like any other slice
— this is **not** a security boundary; the player owns their machine and can
read it. The boundary is between the **renderer** (transcript view, export
preview) and the underlying state. We just make casual peeking inconvenient,
which is enough for a single-player game.

> If anyone ever asks for "no-cheat mode" we can encrypt `secrets` with a
> key the app discards after generation. Out of scope at MVP.

## GM mode A — AI as GM (MVP)

The default mode this whole doc set is built around. Player types actions,
AI runs the world. Already covered in
[03-game-loop-and-sessions.md](03-game-loop-and-sessions.md).

## GM mode B — Player as GM (later)

A different loop, sharing the same world model:

- Player narrates scenes, sets DCs, controls NPCs.
- AI controls the **party** (3–4 PCs with distinct classes and voices).
- Player can `/roll` for the party or let the AI roll automatically.
- The AI party characters have private inner monologues (in `secrets`)
  visible to the player as GM, so the player can roleplay their reactions.

Reused infrastructure:

- World generation (same pipeline; same exported world is playable in both
  modes).
- Persistence (same save format; mode is a flag).
- AI runtime (same provider, different prompt set).

New infrastructure:

- A "party AI" agent that takes the GM's scene description and returns each
  PC's intended action + dialogue, mediated by personality profiles.
- A GM-side UI for setting DCs, revealing/hiding info, and granting
  inspiration.

This mode is on the roadmap as a post-MVP milestone — see
[10-roadmap.md](10-roadmap.md) phase 8.

## Modes are config, not a fork

We keep both modes single-codebase by treating the player ↔ GM relationship
as an injectable role: each turn, *somebody* names actions and *somebody*
adjudicates them. The plumbing is the same; the prompt set and the UI swap.

## Open

- Hybrid mode: AI co-GMs alongside the player (suggests scenes, but player
  approves). Could be the bridge between modes A and B.
- Companion mode: AI controls one NPC companion alongside a player-PC, in
  mode A. Probably cheaper to ship than full mode B and useful on its own.
