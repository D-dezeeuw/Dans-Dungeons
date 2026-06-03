# World Generation — Implementation

## Overview

The world generation system builds an infinite, layered world around the
existing procedural dungeon generator. Each layer is AI-generated with a
strict JSON schema and receives only its parent's digest for token efficiency.

## What's implemented (Phase A, tasks 1-4)

### Schemas (`src/ai/schemas.js`)

Three new schemas added:

- **WORLD_SEED_SCHEMA** — name, tone (grimdark/heroic/mysterious), creation
  myth, 2-3 gods with domains, red thread (premise + hook), digest
- **REGION_SCHEMA** — id, name, climate, description, settlement name,
  dungeon name, rumor, adjacent hints, digest
- **SETTLEMENT_SCHEMA** — id, name, description, NPCs (id, name, role,
  attitude, greeting, questHook), exits (direction, target, type, targetId),
  digest

NPC roles: `innkeeper`, `questgiver`, `merchant`, `guard`, `elder`.
Exit types: `dungeon`, `road`, `wilderness`.

### Data model (`src/core/state.js`)

`appState.world` expanded with layered structure:

```js
world: {
  seed, name, tone, lore, digest,  // L00 World
  regions: {},                      // L02 keyed by slug id
  settlements: {},                  // L03 keyed by slug id
  dungeons: {},                     // L04 keyed by slug id
  location: {                       // Player position
    type, regionId, settlementId, dungeonId
  },
  // Legacy flat fields for backward compat
  currentRoom, exitRoomId, rooms: {}, npcs: {},
}
```

### AI generators (`src/game/worldgen.js`)

Three async functions, each receiving only the parent digest:

- `generateWorldSeed()` — no parent, creates the root
- `generateRegion(worldDigest)` — creates a region
- `generateSettlement(regionDigest)` — creates a settlement

All use the `medium` tier with custom `max_tokens`.

### Dungeon generator (`src/game/world.js`)

Refactored:

- `generateDungeon(seed?)` — the core procedural generator, accepts optional
  seed for deterministic output via Mulberry32 RNG
- `generateWorld()` — legacy wrapper, calls `generateDungeon()` without a seed
- `setDungeonRng(rng)` — inject a custom RNG function
- All internal randomness (`pick`, `randInt`, `shuffle`) flows through `_rng`

### i18n (`src/i18n/en.json`, `src/i18n/nl.json`)

Worldgen AI prompts added to the `ai` section:
- `worldSeedPrompt`, `worldSeedUserMsg`
- `regionPrompt`, `regionUserMsg`
- `settlementPrompt`, `settlementUserMsg`
- `worldgenStep1` through `worldgenStep4`, `worldgenDone`

### Tests (50 passing)

| File | Tests | Coverage |
|------|-------|----------|
| `tests/worldgen/schemas.test.js` | 13 | All 3 schemas: valid, missing fields, invalid enums, extra fields, nullable |
| `tests/worldgen/digest.test.js` | 5 | Cascade isolation: child sees only parent, S-cards compact, bounded growth |
| `tests/worldgen/dungeon.test.js` | 10 | Shape contract: fields, exits bidirectional, key/treasure/lock, NPC stats, nesting |
| `tests/worldgen/location.test.js` | 11 | Location transitions, world export/import, seeded RNG determinism |
| `tests/worldgen/resolver-settlement.test.js` | 11 | Talk (by id/role/default, questHook), travel (by dir/name/id, impossible) |

---

## What's remaining (Phase A, tasks 5-8)

### A5: Game flow rewrite (`src/game/flow.js`)
- Start menu: "Quick Dungeon" vs "New Campaign"
- Campaign flow: worldgen progress → settlement scene → dungeon entry
- Settlement play loop (talk, travel, rest)
- Victory returns to settlement instead of game over

### A6: AI context expansion
- `buildScene()` in `loop.js` includes leaf-to-root digest path
- Narrator prompt gets world/region/settlement S-cards
- Classifier handles settlement intents (talk, travel, buy)

### A7: Settlement UI
- Settlement chips (talk to NPCs, travel to exits)
- Action bar adaptation for settlement context
- World export/import buttons in sidebar

### A8: Build and verify end-to-end

---

## Phase B: Lazy expansion (planned)

On-the-fly generation when the player moves beyond generated content.
Each lazy generator receives only its parent's digest.

## Phase C: Red thread + beats (planned)

5-10 beat story arc using `bag-of-holding`'s beat schema and thread runtime.

## Phase D: Advanced settlements (planned)

Buy/sell, inn rest, side quests, faction reputation.

---

## Design principles

1. **Cascading digests** — child sees only parent, never grandparent
2. **Seeded RNG** — all procedural output deterministic from seed
3. **Schema-first** — every AI call has a strict JSON schema
4. **Backward compat** — legacy flat world fields preserved until flow.js migrates
5. **Test-driven** — every contract tested before integration
6. **Quick start** — always offer instant dungeon alongside slow worldgen
