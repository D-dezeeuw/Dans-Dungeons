# World Generation — Implementation Plan

## Context

The game currently generates a single procedural dungeon (7-12 rooms) per game. The vision is a layered infinite world: continents → countries → places → buildings → rooms, with AI-generated lore, a red-thread story arc, and lazy expansion when the player goes off-script.

The current dungeon system works well as the L04/L05 layer. This plan builds the world *around* it — adding higher layers on top while keeping dungeons as-is.

## Layer hierarchy

```
L00  World       — name, cosmology, gods, tone, red thread premise
L01  Continent   — climate, biomes, geography graph (v1: collapsed into L00)
L02  Region      — countries/territories: factions, rulers, history
L03  Settlement  — cities/villages: NPCs, shops, quest hooks
L04  Building    — dungeons, taverns, temples (procedural + AI-themed)
L05  Room        — individual rooms (existing procedural generator)
```

Every layer is hierarchical: an L05 always belongs inside an L04, an L03 cannot be connected to L00 or L05. This trickles from world to room.

## Cascading digests (token efficiency)

Every entity stores its own **digest** — a compressed summary generated at creation. Children only ever see their parent's digest, not the full tree.

| Generating...  | Gets digest from         | Tokens |
|----------------|--------------------------|--------|
| L02 Region     | L00 World (~150 tok)     | ~150   |
| L03 Settlement | L02 Region (~200 tok)    | ~200   |
| L04 Building   | L03 Settlement (~150 tok)| ~150   |
| L05 Room       | L04 Building (~100 tok)  | ~100   |

**Narrator per turn** gets the leaf-to-root path as S-size cards:
```
room(~50) + building(~50) + settlement(~50) + region(~50) + world(~50) = ~250 tok
```

This scales to infinite worlds — adding 100 new regions doesn't increase per-turn cost.

## Data model

```js
appState.world = {
  // L00 — World
  seed: 'uuid',
  name: 'Erathis',
  tone: 'grimdark',
  lore: { creation: '...', gods: [...], redThread: '...' },
  digest: '...',  // ~150 tok

  // L02 — Regions
  regions: {
    'region-start': {
      id, name, climate, description,
      digest: '...',  // ~200 tok
      settlements: ['settlement-start'],
      dungeons: ['dungeon-start'],
      adjacentRegions: ['region-unknown-east'],
    }
  },

  // L03 — Settlements
  settlements: {
    'settlement-start': {
      id, name, description, regionId,
      digest: '...',  // ~150 tok
      npcs: { innkeeper: {...}, questgiver: {...}, merchant: {...} },
      exits: [{ dir, target, type: 'road'|'path'|'gate' }],
    }
  },

  // L04 — Dungeons/buildings
  dungeons: {
    'dungeon-start': {
      id, name, description, regionId,
      digest: '...',  // ~100 tok
      rooms: { ... },    // existing room format (L05)
      npcs: { ... },     // existing NPC format
      currentRoom: 'room-0',
      exitRoomId: 'room-N',
      completed: false,
    }
  },

  // Player location pointer
  location: {
    type: 'dungeon' | 'settlement' | 'road',
    regionId: 'region-start',
    settlementId: null,
    dungeonId: 'dungeon-start',
  },
}
```

The existing `rooms`, `npcs`, `currentRoom`, `exitRoomId` structure stays unchanged — it just nests inside a dungeon entry.

---

## Phase A: World seed + overworld scaffold

**Goal:** "New Campaign" generates a minimal world skeleton via AI — the player starts in a settlement with NPCs, a quest hook, and a dungeon to explore.

### What gets generated (eager, at campaign start)

1. **World seed** — AI call (large tier): world name, tone, creation myth, 2-3 gods, red thread premise
2. **Starting region** — AI call (medium tier, injected: world.digest): region name, climate, features, 1 settlement name, 1 dungeon name, rumor
3. **Starting settlement** — AI call (medium tier, injected: region.digest): village/town with key NPCs, description, exits
4. **Starting dungeon** — procedural generator (existing `world.js`, instant)

### Game flow

```
New Campaign
  → AI: generate world seed (large tier, ~30s)
  → AI: generate starting region (medium tier, ~10s)
  → AI: generate starting settlement (medium tier, ~10s)
  → Character creation (existing)
  → Show settlement scene (talk, buy, get quest)
  → Player travels to dungeon
  → Procedural: generate dungeon (instant)
  → Play dungeon (existing loop)
  → Victory → return to settlement
  → Get new quest → generate next dungeon/region
  → Loop forever
```

### AI schemas

```js
WORLD_SEED_SCHEMA = {
  name: string,
  tone: 'grimdark' | 'heroic' | 'mysterious',
  creation: string,           // 2 sentences
  gods: [{ name, domain }],   // 2-3 entries
  redThread: { premise: string, hook: string },
  digest: string,             // self-generated ~150 tok summary
}

REGION_SCHEMA = {
  id: string,
  name: string,
  climate: string,
  description: string,
  settlementName: string,
  dungeonName: string,
  rumor: string,
  adjacentHints: [string],    // "mountains to the east", "coast to the west"
  digest: string,             // ~200 tok
}

SETTLEMENT_SCHEMA = {
  id: string,
  name: string,
  description: string,
  npcs: [{
    id: string,
    name: string,
    role: 'innkeeper' | 'questgiver' | 'merchant' | 'guard' | 'elder',
    attitude: 'friendly' | 'neutral' | 'suspicious',
    greeting: string,
    questHook: string | null,
  }],
  exits: [{
    direction: string,
    targetName: string,
    targetType: 'dungeon' | 'road' | 'wilderness',
    targetId: string | null,
  }],
  digest: string,             // ~150 tok
}
```

### Files to create/modify

| File | Change |
|------|--------|
| `src/game/worldgen.js` (new) | AI world seed + region + settlement generators |
| `src/game/world.js` | Keep dungeon generator, add `generateDungeon()` export for on-demand use |
| `src/game/flow.js` | New campaign flow: worldgen → settlement → dungeon |
| `src/game/loop.js` | Expand `buildScene()` with settlement/region context |
| `src/game/resolver.js` | Add settlement intents: talk, buy, travel |
| `src/ai/schemas.js` | Add WORLD_SEED, REGION, SETTLEMENT schemas |
| `src/ai/classify.js` | Handle settlement intents |
| `src/ai/narrate.js` | Narrator gets leaf-to-root digest path |
| `src/core/state.js` | Expand DEFAULTS with new world shape |
| `src/i18n/en.json` + `nl.json` | Worldgen prompts, settlement strings |
| `src/ui/chips.js` | Settlement chips (talk, buy, travel) |

### Unit tests

| Test file | What it covers |
|-----------|---------------|
| `tests/worldgen/digest.test.js` | Digest cascade: child only sees parent digest |
| `tests/worldgen/schemas.test.js` | Schema validation for all 3 new schemas |
| `tests/worldgen/location.test.js` | Location pointer transitions: settlement ↔ dungeon ↔ road |
| `tests/game/resolver-settlement.test.js` | Settlement actions: talk, buy, travel resolve correctly |

---

## Phase B: Lazy expansion

**Goal:** On-the-fly generation when the player moves beyond what's been generated.

### Lazy triggers

| Trigger | What gets generated | Tier | Digest from |
|---------|--------------------|------|-------------|
| Complete dungeon | Return to settlement flow | — | — |
| Talk to questgiver | New quest + new dungeon | medium | settlement.digest |
| Travel to unknown region | Region + settlement + dungeon | medium | world.digest |
| Enter new settlement | Settlement detail | medium | region.digest |
| Enter new dungeon | Procedural dungeon + AI theme | tiny + procedural | settlement.digest |

Each new entity generates its own digest at creation time (one cheap summarizer call). Child generators receive only their parent's digest — never the full tree.

### Unit tests

| Test file | What it covers |
|-----------|---------------|
| `tests/worldgen/lazy.test.js` | Lazy generator fires on correct triggers, receives correct parent digest |
| `tests/worldgen/coherence.test.js` | Generated content doesn't contradict parent digest |

---

## Phase C: Red thread + beats

**Goal:** A 5-10 beat story arc drives the player across regions.

- Integrate `bag-of-holding`'s beat schema and thread runtime
- Generate beats during world seed phase
- Thread runtime (createThread, advance, isReady, isComplete) drives quest progression
- Narrator gets current beat hint in scope
- NPC dialogue nudges player toward next beat

---

## Phase D: Advanced settlement gameplay

- Merchant inventory + buy/sell resolver
- Inn rest (HP restore + chapter boundary)
- Side quest generation from settlement NPCs
- Faction reputation

---

## What stays the same

- Procedural dungeon generator (`world.js`) — becomes L04/L05
- Turn loop (`loop.js`) — classify → resolve → narrate → commit
- Resolver (`resolver.js`) — extended, not rewritten
- AI client (`client.js`) — already supports all tiers
- i18n system — extended with new keys
- Persistence — same localStorage, more data
- UI — extended with settlement chips, not redesigned
