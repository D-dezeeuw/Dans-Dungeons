# 17 — Layered world: textual LOD

> **Status:** design / approved scope (owner-directed, 2026-08-09: "focus on
> world building in the different layers … a global outline, but the details
> loaded in a lazy way. A bit like a LOD but textual"). Builds on the shipped
> stub-graph ([`geography.js`](../../vendor/bag-of-holding-client/src/worldgen/geography.js)),
> the layered pipeline (`runPipeline`), and the scope packet
> ([doc 12](12-context-scoping.md)). Grounded in the post-implementation
> audit's content findings
> ([`docs/audit/2026-08-09-post-implementation-audit.md`](../audit/2026-08-09-post-implementation-audit.md)).

## Why this, why now

The 2026-08-09 audit measured the game at **~5–8 hours per campaign, ~25–35
hours before structural repetition** — and concluded the remaining distance to
80 hours is *breadth*, not systems. Every campaign today is one region-frontier
walked outward from one settlement: the world has no shape above the region,
so nothing above the region can vary, foreshadow, or be travelled toward.

The audit's sharpest content findings are all symptoms of that missing
structure:

- every dungeon in a campaign hands out the same domain treasure/key, because
  neighbour regions **pin** the base blueprint's `godDomains` — there is no
  layer between "world" and "region" that could own variation;
- the overworld encounter pool ignores climate, because climate is rerolled
  per region instead of belonging to a geographic band;
- 36 of 84 creatures (the whole CR≥5 band) are unreachable, because there is
  no late-campaign *place* whose pools could carry them.

A layered world fixes the architecture and absorbs those fixes naturally.

## The shape: five layers, three detail levels

```
world                       (exists: seed, tone, gods, red thread, factions)
└── continent               (new)   2–4 per world
    └── province            (new)   2–4 per continent
        └── region          (exists) unbounded frontier, now WITHIN a province
            └── site        (exists) settlement / dungeon / cave / road
```

Every node in the geography graph gains two fields:

- `parent` — containment (`region.emberfen` belongs to `province.saltmarch`
  belongs to `continent.veld`). `null` marks a legacy flat-world node.
- `detail` — the LOD:
  - **0 — stub.** `{id, name, hook, seed}`, minted deterministically from the
    parent's seed. Costs nothing. This is the existing stub concept, promoted
    to every layer.
  - **1 — outlined.** One cheap LLM call produced a ~40–60-word digest:
    what the place is *about* — climate band, two conflicts, dominant faction
    and its stance, two signature landmarks. Enough for rumours, maps, and
    the narrator's middle distance.
  - **2 — detailed.** Full generation — exactly today's region/settlement/
    dungeon content. Only regions and sites ever reach detail 2.

**Genesis** mints the whole skeleton (continents + provinces, stubs all the
way down) deterministically from the world seed — no LLM — and makes **one**
outline call for the continents, so the player has a true global outline from
hour zero. Everything else stays a stub until approached.

**Promotion** is the lazy load:

- crossing toward a province the player has never entered outlines it
  (detail 0→1, one call, before the arrival narration);
- arriving in a region hydrates it fully (detail 1→2 — today's generators,
  unchanged, except the parent digest they receive is now the *province*
  digest instead of the world digest);
- continents outline at genesis; provinces outline on approach; nothing
  below detail 1 ever costs a token.

**Serving** is the other half of the LOD. The scope packet's stable head
becomes a chain with budgets pinned by tests — farther means fewer tokens:

```
world     ~60 tokens   (exists)
continent ~50 tokens   (new)
province  ~50 tokens   (new)
region    ~80 tokens   (exists)
here      full detail  (exists)
```

Neighbouring provinces appear only as their one-line hooks ("across the
Saltmarch border: bells heard at odd hours") — rumour-distance text.

## What each layer owns

The pinned-`godDomains` bug is really an ownership question: *what varies at
which scale?* The layers answer it:

| Layer | Owns (varies here) | Inherited unchanged |
|---|---|---|
| world | tone, gods, red thread, faction roster | — |
| continent | faction homelands, broad culture, sea borders | tone, gods |
| province | climate band, domain focus (treasure/key tables), local faction stance, conflict pair | continent's culture |
| region | settlement + dungeon rolls, encounter pool drawn from the province's climate + act band | province's climate/domain |
| site | rooms, NPCs, loot | region's theme |

Concretely this absorbs four audit findings: domain treasures/keys rotate
**per province** (not pinned per campaign); overworld encounter pools key on
the **province's climate band** and the current act (routing the unreachable
CR≥5 band into late-act provinces); enemy count scales with dungeon size;
and neighbour-region generation stops rerolling climate at random because
climate belongs to the province.

**Factions** already exist at world level. The continent outline assigns each
faction a homeland; the province outline states the local stance (dominant /
contested / absent, one tension line). Region and settlement generation
inherit that through the digest chain they already consume. Reputation stays
global (`story.js`), but rumours can now name the local power.

## Travel

- **Within a province** — exactly today: region stubs, frontier expansion,
  travel FSM. Unchanged.
- **Across a province border** — the border is a real edge between regions of
  different provinces. Crossing promotes the far province to detail 1 (if
  needed) before the arrival narration, and the existing `region-changed`
  chapter cut fires as today.
- **Across the sea** — each continent's skeleton marks 1–2 **port provinces**;
  sea edges connect ports. Sailing runs the same travel FSM with sea
  flavour and more days. v1 keeps it minimal: no ships, no economy — a port,
  a crossing, a landfall.

## Back-compat

Saves from the flat world load through a one-time, LLM-free migration: any
geography node without a `parent` is adopted under a synthetic
continent/province ("the Known Lands") minted from the world seed. Nothing
regenerates; the old campaign simply acquires an address.

## Split of ownership (repo boundaries)

- **bag-of-holding-client** (pure, `node --test`able): geography `parent`/
  `detail` fields + `childrenOf`/`ancestorsOf`/`promoteNode`; skeleton
  minting (`mintWorldSkeleton(seed, opts)` → continents/provinces/ports,
  deterministic); `CONTINENTS_SCHEMA` / `PROVINCE_SCHEMA`; hint builders in
  the blueprint style. Plus the two in-lane audit defects: `pushAct` stamping
  the stall clock, and the vault treasure's field pass-through.
- **Dans-Dungeons**: prompts (en+nl), genesis wiring (skeleton + one
  continent-outline call), promotion wiring in travel, scope-packet chain +
  budget pins, migration, `/map` hierarchy, i18n parity, wiring-contract
  additions.

## Phases (feature branches, repo convention)

- **A — client core.** Layered geography + skeleton + promote + schemas +
  the two defect fixes. Tests: determinism (same seed → identical skeleton),
  containment queries, promote semantics, parentless back-compat, stall
  regression, treasure regression.
- **B — game genesis + serving.** initialAtlas builds the skeleton; one
  continent-outline call at campaign start; scope packet serves the chain
  within pinned budgets; flat-save migration. Tests: atlas wiring, budget
  pins, migration, i18n parity.
- **C — travel + variation.** Province-border promotion; per-province domain
  rotation; climate+act-keyed encounter pools; enemy count scaling (client
  generator opt). Tests: promotion-on-crossing, pool keying, scaling sweep.
- **D — surfacing.** `/map` shows the hierarchy (continent → province →
  known regions); rumour lines can cite outlined-but-unvisited places.
- **E — content tables** (separate, sized S–M in the audit): room pools
  5→12/type, dressing 6→12/theme, travel discoveries 4→10, both locales.

## Test plan (the "and test it")

1. **Unit, client:** every Phase-A item above, plus: an outline clamp test
   (digests over budget are truncated at serve time, never stored truncated).
2. **Unit, game:** scope-budget pins for the new chain; wiring contract rows
   for `mintWorldSkeleton` / `promoteNode` consumers; i18n parity for the new
   prompt + name tables.
3. **Simulation (the load-bearing proof):** walk 500 regions across
   provinces and continents in-memory — assert node count stays
   O(visited + frontier) (boundedness), the same seed reproduces the identical
   walk (determinism), and **zero** outline/detail calls are required below
   detail 1 (laziness). Mirrors the 10k-dungeon sweep that validated act
   scaling.
4. **e2e:** the existing 9 tests must stay green untouched (quick-dungeon
   path has no layers); campaign-mode e2e remains mocked-LLM and gains one
   assertion: the boot of a campaign save with flat geography does not error
   (migration smoke).
5. **Suites + build + vendor:** `npm test` green in both repos, re-vendor,
   bundle rebuilt, manifests match — the standing gates.

## Open questions (deliberately deferred)

- Sea travel texture (ships, fares, storms) — v1 is a crossing, not a system.
- Whether continents ever reach detail 2 (a "continent event" layer) — not
  needed for 80h.
- TARGET_ACTS beyond 5 for longer campaigns — the audit's arithmetic says the
  80h path is layered breadth **plus** longer campaigns; acts-per-campaign is
  a constant today and becomes interesting once provinces give late acts
  somewhere new to go.
