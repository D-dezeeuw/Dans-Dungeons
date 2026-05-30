# 12 — Context scoping (what the AI sees, per turn)

> **Status:** rough sketch. The biggest unknown is the size-class budget
> tuning, which only real measurement will pin down.

## The problem

A 100-hour campaign accumulates **megabytes of world data**: regions, cities,
factions, NPC dossiers, dungeon contents, transcript history. We cannot send
all of that to the LLM on every turn — costs would balloon and most models
wouldn't accept the prompt anyway. But we also can't send too little, or the
GM forgets the player just saw the queen, or invents a tavern that
contradicts the one already in the city.

So: the AI must always see **the smallest packet of facts that fully
explains the current moment** — no more, no less. An empty room is a few
hundred tokens. A throne-room audience with a dozen NPCs is several
thousand. The runtime has to know which is which.

## Mental model: scope as concentric circles

Every turn happens *somewhere*. We model what the AI needs to see as
concentric tiers around that location:

```text
                       ┌──── world ────┐
                  ┌──── region ────┐
              ┌── nearby ──┐
          ┌── here ──┐
          │  player  │
          └──────────┘
```

| Tier | What's in it | Fidelity |
| --- | --- | --- |
| **Here** | The current location: scene description, present NPCs, visible items, current scene state (combat? conversation? exploring?). | **Full.** Every relevant field of every present object. |
| **Nearby** | Adjacent locations the player could move to in one action, plus anyone who could plausibly walk in. | **Sense-impression only** (sounds from next room, who's stationed at the gate). |
| **Region** | The city / dungeon / forest the player is currently in. Politics, ongoing events, faction tensions. | **Region digest** (1–3 paragraphs). |
| **Continent** | The continent the region sits on. Geopolitical neighbors, climate band, the broader cultures bleeding into this region. Present only when the realm has multiple continents. | **Continent digest** (1–2 paragraphs). |
| **Realm** | Everything above continents: cosmology, ages of history, lore that's true everywhere. | **Realm digest** (compact backbone the Narrator always needs). |
| **PC memory** | Cross-cutting: what *this character* knows, has heard, has met. Bridges all tiers. | **Memory cards** keyed by entity ID. |
| **Associative recall** | Anything semantically related to the player's intent or the current scene that the structural walk wouldn't pick up. Powered by client-side RAG over transcript chunks and entity cards. | **Top-k retrieved snippets**, bounded by budget. |

The scope assembler walks the geography graph (built in
[02-world-generation.md](02-world-generation.md)) to compute Here/Nearby
deterministically — no LLM needed. Region and World pull pre-built digests
from state. PC memory is filtered by what the player has actually
encountered (a flag per entity).

## The working set: a "scope packet"

Each AI call gets a **scope packet**: a small, structured object the prompt
assembler renders into the prompt's "context" section.

```js
{
  here: {
    location: { id: 'loc.thornharbor.castle.throne-room', card: '…' },
    npcsPresent: [ {id, card}, … ],
    items: [ {id, card}, … ],
    scene: { mode: 'audience', round: null, conditions: [...] }
  },
  nearby: [
    { id: 'loc.thornharbor.castle.antechamber', sense: 'murmuring courtiers' },
    { id: 'loc.thornharbor.castle.balcony',     sense: 'cold wind through arrowslits' }
  ],
  region: {
    id: 'region.thornharbor',
    digest: '…1–3 paragraphs…',
    activeEvents: [ 'tax-revolt-day-3', 'plague-rumor' ]
  },
  worldDigest: '…compact backbone…',
  pcMemory: {
    knownNpcs: [ 'npc.queen-eliana', 'npc.ser-corwin' ],
    knownFactions: [ 'faction.silver-court' ],
    learnedFacts: [ 'fact.king-died-poisoned' ]
  },
  redThread: {
    currentBeat: 'beat.04-audience-with-queen',
    nextHint: 'beat.05-investigate-the-cellar'
  }
}
```

The packet is built **once per turn** and reused across the classifier →
rules → narrator pipeline so we don't pay to re-assemble it three times.

## Layered digests catalog

Every world entity owns one or more representations at different sizes. We
pre-generate them when the entity is created and update them when state
changes.

| Card | Size target | Generated when | Used by |
| --- | --- | --- | --- |
| **Realm digest** | ~500 tokens | After Layer 2 (history); refreshed when major flags flip | Every AI call as "realm" tier (root of the digest tree) |
| **Continent digest** | ~400 tokens per continent | When a continent is split out of the realm digest | "Continent" tier when player is on it |
| **Region digest** | ~300 tokens per region | When region is generated; refreshed on event resolution | "Region" tier when player is in or adjacent |
| **Location card** | ~150 tokens | At generation; refreshed on scene state change | "Here" tier (full) and "Nearby" sense-impression (1 line excerpt) |
| **NPC card** | ~120 tokens | At generation; refreshed on relationship change | "Here" tier; PC memory if known |
| **Faction card** | ~100 tokens | At generation | Region/realm digest source; expanded if player interacts |
| **Item card** | ~80 tokens | At generation/pickup | "Here" tier; inventory |
| **Memory card** | ~50 tokens per known entity | Updated when player learns / interacts | PC memory tier |

Cards are stored alongside the canonical entity in `world` (see
[06-persistence.md](06-persistence.md)). Generating a card is itself an AI
call — done with the **summarizer** model (cheap), not the generator.

### Size classes

Each card has three **size variants** the assembler can pick from:

- `S` — one-line tag (`"Queen Eliana, sharp-eyed, recently widowed"`).
- `M` — paragraph (the default card).
- `L` — full dossier with backstory and secrets, used only for the very few
  entities active in the current scene.

The scope assembler chooses size by tier and budget: present NPCs get `L`,
known-but-absent NPCs get `S`, unknown NPCs are omitted entirely.

## The scope assembler

```text
scope/assemble(locationId, sceneState, pc) → ScopePacket
```

A pure function. Steps:

1. **Here.** Load the location's card (L), all present-NPC cards (L), all
   visible-item cards (M). Read the scene state.
2. **Nearby.** Walk geography adjacency. **1 hop in dungeons, 2 hops in
   outdoor regions** (the outdoor "next valley over" is reachable in one
   action and matters narratively). For each adjacent location, load its
   card (S) — the one-line sense impression.
3. **Path to root.** Walk up the digest tree from the leaf: region (M),
   continent if present (M), realm (M). Append region's active-events
   list (small array of flag IDs with one-line descriptions).
4. **PC memory (structural).** Intersect "all known entity IDs" with
   "entities relevant to nearby/region" — load their memory cards (S).
5. **Associative recall.** Run inverted-index lookups for proper nouns
   the player's input mentions, then a top-k semantic search over the
   embedding store. Splice non-duplicates into `pcMemory` (bounded — see
   budget step).
6. **Red thread.** Add current beat ID + the Narrator's private "next
   hint" (lives in `secrets`; only narrator/classifier prompts see it).
7. **Budget enforcement.** If the packet exceeds the model's budget,
   prune in order: associative recall → PC memory → region active events
   → nearby sense impressions. Never prune Here or the realm digest.

Steps 1–4 are pure state lookups. Step 5 hits two indexes (inverted +
vector) that live in IDB; both are local, both are cheap. No LLM is
called by the assembler at any point.

## Caching

The assembled packet is **content-addressed**: hash all input IDs + their
state versions, key the result in an in-memory LRU + IndexedDB cache. If
nothing in the scope has changed between turns (rare in combat, common in
exploration), we reuse the packet.

We can go further: cache the **rendered prompt** for `(packetHash, modelId,
promptTemplateVersion)`. Identical inputs → identical prompt → identical
expected output. With `temperature: 0`, we could even cache the *response*
for replay/debugging.

## Worked example: empty room vs. throne room

### Empty stone corridor (a typical exploration turn)

- Here: 1 location card (L, ~150t) + scene state (~20t).
- Nearby: 2 adjacent corridor cards (S, ~30t each).
- Region: dungeon digest (M, ~200t) + 0 active events.
- World: world digest (M, ~500t).
- PC memory: nothing relevant nearby.
- Red thread: current beat ID + 1-line hint (~30t).

**Packet total: ~960 tokens.** Plus the system prompt (~300t) and the last
few transcript turns (~600t) ≈ **1.9k input tokens**.

### Throne-room audience with 12 nobles

- Here: 1 location card (L, ~150t) + 12 NPC cards (L) for present nobles
  (~120t × 12 = 1.4k) + 4 item cards (M) for visible regalia (~320t) +
  scene state with relationship matrix (~150t).
- Nearby: 3 adjacent rooms with sentries (~30t × 3).
- Region: city digest (M, ~300t) + 3 active events (~150t).
- World: world digest (M, ~500t).
- PC memory: 8 of the nobles are known → 8 memory cards (S, ~50t × 8 = 400t).
- Red thread: current beat + private hint (~50t).

**Packet total: ~3.5k tokens.** Plus system + transcript ≈ **4.5k input
tokens** — pricier than the corridor by ~2.5× but still well under any
modern model's window, and that's the "expensive" extreme.

This is the win: routine turns stay cheap; only dramatic scenes pay the
dramatic-scene tax.

## Cost economics (sketch)

Order-of-magnitude only — real numbers wait for benchmarking:

- **Per turn (median, cheap model):** ~2k input + ~300 output tokens.
- **Per turn (set-piece, mid model):** ~5k input + ~600 output tokens.
- **Cards generated lazily:** ~500 input + ~150 output via summarizer model.
- **World digest refresh:** rare, ~3k input + ~600 output via summarizer.
- **Full world generation (Phase 4–5):** total of ~50–150k input + ~30–80k
  output across all layers — measured in dollars, not cents.

If a campaign averages 1500 turns over 100 hours, and 90% of turns are
median, the per-turn cost dominates total spend; making median turns cheap
is where we win or lose the cost game. **The scope tiers and size classes
exist precisely so the median case is small.**

## Hierarchical digest tree (the scalability foundation)

Long-running campaigns are the point where naive context strategies break.
We design for unbounded growth from day one by storing the realm as a
**digest tree**, not a flat collection:

```text
Realm
 └── Continent (1..N)
      └── Region (1..N)
           └── Location (1..N)
                └── (rooms / encounters)
```

Every node owns its own S/M/L cards (same scheme as the per-entity catalog
above). The scope assembler walks **the path from the current location up
to the root**, including:

- **Direct ancestors** at L fidelity (location → region → continent → realm).
- **Siblings of the leaf** (other locations in the same region) at S.
- **Uncles** (sibling regions in the same continent) only as a one-line tag
  if active events touch them; otherwise omitted.
- **Cousins and further** never materialised — they live behind associative
  recall (see below).

**Why this scales.** The path depth grows with `log(realm)`, not with realm
size. A 10× larger realm adds one level of hierarchy at most. Per-turn
token cost stays roughly constant whether the campaign has been running
for two hours or two hundred.

**Splitting is automatic.** When any node's L card exceeds its budget, the
world-gen layer (or a maintenance pass between sessions) splits it into
children. Splits are content-aware (a continent splits into geographic
sub-regions; a region splits into districts; a location splits into
sub-areas). The single-continent case collapses harmlessly — the continent
tier just isn't materialised until the realm grows past one.

**One-continent realms** skip the continent tier entirely; assembly walks
location → region → realm. Most campaigns will live here.

## Retrieval beyond the deterministic walk

The structural walk gives the Narrator *where you are*; it cannot answer
*"what did the abbot tell me about the iron crown back in Chapter 2?"* —
that fact is in some old transcript chunk and no current entity points to
it. We ship two complementary recall systems **at MVP**, alongside the
structural walk:

### 1. Inverted index (proper-noun recall)

When the loop commits state, the classifier's "named entities mentioned"
output feeds a small inverted index `entityId → [transcriptTurnIds]`.
The player asks about *the iron crown* → assembler pulls the 2–3
transcript chunks tagged with `item.iron-crown` and slots them under
`pcMemory`. Cheap to build, cheap to query, no model required.

### 2. Client-side RAG (associative recall)

For conceptual queries the inverted index can't catch ("anything I knew
about ancient crown-magic?"), we run a small embedding model **locally
in the browser** via WebAssembly. Default model: a `bge-small`-class
encoder (~30 MB on disk, CDN-pinned + SRI-hashed like every other dep,
loaded once and cached forever by the browser).

```text
On commit:           embed(card | transcriptChunk) → vector → IDB
On turn assembly:    embed(playerIntent + hereCard) → top-k cosine search
                     in IDB → splice non-duplicate results into the packet
```

- **Store:** flat cosine index in IDB. Sufficient into the low millions of
  vectors. ANN libraries (HNSW etc.) are heavy and skipped unless a real
  campaign saturates flat search.
- **Hybrid:** inverted-index hits are always preferred for proper-noun
  queries (they're exact); RAG fills the conceptual gaps.
- **Privacy & cost:** no per-call embedding fee. The chat models stay on
  OpenRouter; embeddings never leave the browser.

**Why local, not hosted.** A hosted embedding API would be ~$0.00001/1k
tokens — basically free — but every chunk write and every query would
need a network round-trip, the user's API key, and would leak transcript
contents to whichever provider. Local WASM is free at use-time, private,
and removes a network dependency from the hot path.

**The cost we accept.** The embedder is a ~30 MB one-time WASM download.
On first run we show a one-shot prompt: *"Enable richer memory? Downloads
~30 MB once."* Users who decline get the structural walk + inverted
index, which is still a strong baseline. Users who accept pay nothing
per-turn forever after.

**Fallback path.** Setting also exposes a hosted embedder option for users
who never want the WASM download. Uses the same OpenRouter API key against
a hosted embedding model. Cheaper than nothing, more expensive than
local; provided for completeness.

## What the *secrets* layer adds

The scope assembler is the place where the GM gets to see things the player
doesn't. Concretely: when assembling for a **narrator** or **classifier**
prompt, we include `secrets` fragments scoped to the present entities
(NPC's true motive, item's hidden property, location's trap). When
assembling for any user-visible context (the "previously on…" recap is the
main case), we strip secrets. Same scope walk, two filters.

## Failure modes

- **Packet exceeds model window.** Prune in the documented order; if still
  too big, drop "nearby" entirely and warn the GM ("you're in a packed
  scene; spatial awareness reduced"). Never silently truncate the world
  digest — that causes contradictions.
- **Missing card.** If a card is referenced but absent (lazy expander
  failure), generate it synchronously before continuing the turn. Cache
  the result so the next turn is fast.
- **Cache stale.** Every entity has a `version` integer bumped on any
  write. The cache key includes versions; bumps invalidate naturally.

## Open

- Concrete size-class token budgets (S/M/L targets above are guesses;
  real numbers wait for Phase 3 benchmarking).
- Exact embedder model + CDN URL + SRI hash — decide alongside the chat
  tier picks in [05-ai-runtime.md](05-ai-runtime.md). Working assumption:
  a `bge-small`-class encoder, ~30 MB WASM, CDN-pinned the same way as
  Spektrum.
- Whether to support outdoor 3-hop scope for very-open-world regions
  (deserts, oceans). 2-hop is the working default; revisit when an
  actual outdoor campaign feels too narrow.
