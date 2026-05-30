# 02 — World generation

> **Status:** rough sketch. Schemas will get nailed down in the implementation
> phase per agent.

## Strategy

**Eager generation, lazy fallback.** When the player clicks "New Campaign", we
walk a fixed pipeline of agents that each consume the prior layer's output and
produce the next. The result is a coherent world with a ~100-hour story
backbone. If the player walks somewhere unplanned, an on-demand agent fills in
that gap *consistent with* what already exists.

Each layer is a separate AI call with a strict JSON schema (see
[05-ai-runtime.md](05-ai-runtime.md)). All entities get stable IDs so later
layers can reference them and lazy fallbacks can append without collisions.

## The pipeline

```text
seed ─► geography ─► history ─► red-thread ─► cities ─► quest-weave ─► READY
                                                ▲                ▲
                                                └── lazy NPC ─────┘
                                                └── lazy region ──┘
```

### Layer 1 — Geography

Continents, climates, biomes, major sites (cities, towns, forests, caves,
lakes, ruins, roads). Output is a **graph of regions with adjacency** so the
GM can reason about travel time and visibility.

### Layer 2 — History & powers

Religions, factions, dynasties, legendary events, a coarse timeline. Seeded by
geography: a desert spawns sun-worship, a coast spawns trade leagues, etc.

### Layer 3 — Main goal (the red thread)

The campaign's central dramatic question: a murdered heir whose killer is
unknown; an amulet whose shards are scattered; a gate to another plane
cracking open. Output is a **beat sheet of ~10–20 story nodes**, each tagged
with a region/city, required NPCs (by archetype, not yet detailed), required
items, and a target playtime.

Beats conform to **`bag-of-holding`**'s `beats/schema` — see
[`../../../bag-of-holding/docs/beat-schema.md`](../../../bag-of-holding/docs/beat-schema.md)
in the sibling repo. The schema carries `successors[]` so the same beats
become branchable in a later release; v1 walks them linearly by index.

### Layer 4 — City & people details

For every city the red thread *touches*: politics, royal family tree,
important NPCs (clergy, merchants, hunters, knights, criminals), local
problems, hooks. Cities not on the thread get a one-paragraph stub and are
expanded lazily if the player visits.

### Layer 5 — Quest weave

Cross-references everything: which beat happens where, which NPC carries
which secret, which dungeon contains which clue, which item unlocks which
door. Also estimates **playtime per beat** to roughly hit the ~100h target;
beats that come up short get optional side quests attached.

## Lazy fallback

The player will go off-script. The lazy expander handles four cases:

| Trigger | What it generates |
| --- | --- |
| Enters undescribed region | Region detail consistent with adjacency + biome |
| Talks to nameless NPC | NPC stub: name, role, attitude, 1 secret |
| Opens unexplored building | Interior + occupants consistent with city's politics |
| Investigates an absent topic | Rumor or lore fragment that doesn't contradict history |

Lazy outputs are persisted into the same world store and become canon — they
must respect existing IDs, factions, and the red thread.

## Determinism & seeds

- A single **campaign seed** is generated at "New Campaign" (UUID v4 is fine).
- Each layer agent is called with `(campaignSeed, layerName)` so re-running a
  layer with the same inputs is reproducible-ish (LLMs aren't perfectly
  deterministic but `temperature: 0` + identical inputs gets close enough for
  debugging and "share this world" workflows).
- The seed is included in the exported `.dnd.json`.

## Coherence guards

To keep a 100-hour world internally consistent:

- **ID stability.** Every place/person/faction has a slug like
  `city.thornharbor` or `npc.queen-eliana`. Agents reference by ID, never by
  loose name.
- **World digest + per-entity cards.** A compressed summary of canonical facts
  (places, factions, key NPCs, red-thread state) is injected into every
  subsequent agent and GM call so newly generated content doesn't contradict
  old content. The digest is one of several **size-tiered cards** per entity;
  see [12-context-scoping.md](12-context-scoping.md) for how they're picked
  per turn and per scope tier.
- **Schema validation + repair.** Outputs that fail schema get one retry with
  the validation error pasted back; second failure surfaces to the player and
  pauses generation. We do not silently accept malformed lore.
- **No retcons without a flag.** The lazy expander may *add*, never *change*.
  Any change must go through an explicit retcon action (see
  [03-game-loop-and-sessions.md](03-game-loop-and-sessions.md)).

## Cost & latency budget

Eager generation will take **minutes** and **measurable money**. The UI must:

- Show a layer-by-layer progress bar with live token/USD counters.
- Make each layer cancellable (we keep what's been generated so far).
- Cache and dedupe — re-rolling Layer 3 shouldn't re-spend Layer 1.

A rough target for v1: a full world in **under 5 minutes** on a 100 Mbps
connection and **under $1** on a mid-tier OpenRouter model. These are
guesses to refine with measurement.

## Open

- Should the red thread be branching or linear? (Linear MVP, branching later?)
- How many cities is "enough" before play feels rich? (10? 20?)
- Do we want a "tone" knob (grimdark / heroic / comedic) at campaign start?
