# 02 — World generation

> **Status:** Phase A in progress. Schemas, data model, AI generators, seeded
> RNG, and dungeon refactor are implemented with 50 passing tests.
> See [implementation/world-gen.md](../implementation/world-gen.md) for the
> concrete build plan.

## Strategy

**Eager seed, lazy expansion.** When the player starts a campaign, an AI
pipeline generates a minimal world skeleton (world → region → settlement).
Everything deeper is generated on-demand as the player explores. A "Quick
Dungeon" option skips worldgen entirely for instant play.

Each layer is a separate AI call with a strict JSON schema (see
`src/ai/schemas.js`). All entities get stable slug IDs (`region-ashvale`,
`settlement-millhaven`) so later layers can reference them and lazy fallbacks
can append without collisions.

## The layer hierarchy

```text
L00  World       — name, cosmology, gods, tone, red thread premise
L01  Continent   — climate, biomes, geography graph (v1: collapsed into L00)
L02  Region      — countries/territories: factions, rulers, history
L03  Settlement  — cities/villages: NPCs, shops, quest hooks
L04  Building    — dungeons, taverns, temples (procedural + AI-themed)
L05  Room        — individual rooms (existing procedural dungeon generator)
```

Every layer is strictly hierarchical: an L05 always belongs inside an L04,
an L03 cannot be connected to L00 or L05. Context trickles from world to room.

## Cascading digests (token efficiency)

The key design constraint: **a child only sees its parent's digest, never
the full tree.** This keeps token counts bounded regardless of world size.

| Generating...  | Gets digest from         | Tokens |
|----------------|--------------------------|--------|
| L02 Region     | L00 World (~150 tok)     | ~150   |
| L03 Settlement | L02 Region (~200 tok)    | ~200   |
| L04 Building   | L03 Settlement (~150 tok)| ~150   |
| L05 Room       | L04 Building (~100 tok)  | ~100   |

The **narrator per turn** gets the leaf-to-root path as S-size cards
(~50 tok each), totaling ~250 tok of lore context regardless of world size.

Every entity stores its own digest at creation time. Adding 100 new regions
does not increase per-turn cost — the narrator only sees the current path.

## Eager generation pipeline (campaign start)

```text
world seed ─► starting region ─► starting settlement ─► READY
                                                         │
                                                    player explores
                                                         │
                                                    lazy expansion ──►
```

1. **World seed** (medium tier, ~1000 tok): world name, tone, creation myth,
   2-3 gods, red thread premise + hook, self-generated digest.
2. **Starting region** (medium tier, injected: world.digest): region name,
   climate, settlement name, dungeon name, rumor, adjacent hints, digest.
3. **Starting settlement** (medium tier, injected: region.digest): NPCs
   (innkeeper, questgiver, merchant), exits, digest.
4. **Starting dungeon** — procedural generator (instant, seeded RNG).

## Quick start option

The player can choose:
- **Quick Dungeon** — instant procedural dungeon, no worldgen, no settlement.
  Same as the current game experience.
- **New Campaign** — full worldgen pipeline (~30-60s), starts in settlement.

## Lazy expansion

When the player moves beyond what's been generated, on-demand generators fill
in the gaps — each receiving only its parent's digest.

| Trigger | What gets generated | Digest from |
|---------|--------------------|----|
| Complete dungeon | Return to settlement | — |
| Talk to questgiver after dungeon | New quest + new dungeon | settlement.digest |
| Travel to unknown region | Region + settlement + dungeon | world.digest |
| Enter new settlement | Settlement detail | region.digest |
| Enter new dungeon | Procedural dungeon + AI theme | settlement.digest |

Lazy outputs are persisted into the same world store and become canon.

## Seeded RNG

All procedural generation (dungeon topology, room picks, enemy placement,
direction assignment) flows through a **Mulberry32 seeded PRNG** from
`bag-of-holding`. The seed is stored in `world.seed` and included in exports.

- Same seed → same dungeon layout (deterministic).
- LLM calls include the seed for best-effort reproducibility (`temperature: 0`).
- World exports (`.world.json`) preserve the seed for sharing/replaying.

## World export/import

Generated worlds can be exported as standalone `.world.json` files, separate
from game saves. This allows:
- Sharing worlds between players.
- Re-using a world across multiple campaigns.
- Backing up worldgen output without game state.

## Coherence guards

- **ID stability.** Every place/person/faction has a slug ID. Generators
  reference by ID, never by loose name.
- **Cascading digests.** Each child sees only its parent's summary — never
  sibling or grandparent data.
- **Schema validation + repair.** Outputs that fail schema get one retry with
  the error; second failure surfaces to the player.
- **No retcons.** The lazy expander may *add*, never *change*. Changes go
  through explicit retcon actions.

## Red thread (Phase C — planned)

The campaign's central dramatic question, generated as a 5-10 beat story arc
using `bag-of-holding`'s beat schema. Beats drive quest progression; the
narrator nudges the player via NPC dialogue. Linear v1, branching v2.

## Current implementation status

| Component | Status | Location |
|-----------|--------|----------|
| Layer hierarchy + data model | Done | `src/core/state.js` |
| AI schemas (world, region, settlement) | Done | `src/ai/schemas.js` |
| AI generators (worldgen pipeline) | Done | `src/game/worldgen.js` |
| Procedural dungeon generator (L04/L05) | Done | `src/game/world.js` |
| Seeded RNG | Done | `src/game/world.js` (uses `Dice.seededRng`) |
| Cascading digest tests | Done | `tests/worldgen/digest.test.js` |
| Schema validation tests | Done | `tests/worldgen/schemas.test.js` |
| Location pointer tests | Done | `tests/worldgen/location.test.js` |
| Settlement resolver tests | Done | `tests/worldgen/resolver-settlement.test.js` |
| Dungeon shape contract tests | Done | `tests/worldgen/dungeon.test.js` |
| Game flow integration | In progress | `src/game/flow.js` |
| Settlement UI + chips | Planned | `src/ui/chips.js` |
| Narrator world context | Planned | `src/ai/narrate.js` |
| Lazy expansion | Planned | Phase B |
| Red thread + beats | Planned | Phase C |
| Advanced settlements | Planned | Phase D |

**Total tests:** 50 passing.
