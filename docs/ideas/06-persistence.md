# 06 — Persistence

> **Status:** rough sketch.

## Storage tiers

| Tier | What lives there | Why |
| --- | --- | --- |
| `localStorage` | settings (keys, model tiers), active campaign meta + hot slices (party, session, last N transcript turns, flags) | Fast sync access, survives reload |
| `IndexedDB` | full world layers, per-entity cards (S/M/L), archived transcript, chapter snapshots, scope-packet & prompt cache, optional TTS audio cache | Larger quota; localStorage caps at ~5MB |
| Download | `.dnd.json` exports | Share / backup, no quota |

Caches in IndexedDB (scope packets, rendered prompts, TTS audio) are
**disposable**: they're regenerated on demand. Exports never include them.
See [12-context-scoping.md](12-context-scoping.md) for the scope-packet
caching strategy.

A 100-hour world plus its transcript will absolutely exceed localStorage's
~5MB quota, so the split is essential, not optional. We design for it from
day one.

## Save shape

A single logical object, split across tiers by a thin persistence layer
that hides the split from the rest of the app:

```json
{
  "schemaVersion": 1,
  "meta": {
    "campaignId": "uuid-v4",
    "seed": "uuid-v4",
    "createdAt": "2026-05-17T18:00:00Z",
    "playtimeSeconds": 12345,
    "tone": "heroic",
    "appVersion": "0.1.0"
  },
  "world": { /* geography, history, cities, redThread, npcs, ... */ },
  "secrets": { /* GM-only state; never rendered */ },
  "party": [ /* characters with class/level/inventory/HP/slots */ ],
  "flags": { /* questFlag.amuletShard1: true, ... */ },
  "session": {
    "currentChapter": 7,
    "turnCount": 138,
    "lastAutosaveAt": "..."
  },
  "transcript": [ /* append-only log of player + GM messages */ ],
  "chapters": [ /* chapter snapshots for rewind */ ],
  "ai": {
    "tokenTotals": { "prompt": 120000, "completion": 38000 },
    "usdEstimate": 0.42
  }
}
```

Each top-level slice gets its own IndexedDB object store; only `meta`,
`session`, `party`, `flags`, and the last N transcript turns are mirrored
into localStorage for cold-start speed.

## Export / import

- **Export.** Walks all slices, packs the JSON object above, downloads as
  `<campaignName>-<isoDate>.dnd.json`.
- **Import.** Drag-and-drop or file picker. Validates `schemaVersion`, runs
  migrators if older, writes into IndexedDB, mirrors hot slices to
  localStorage.
- **Share.** The same export is also the share format: another player can
  import the file and play "the same world" from chapter 1, or jump to the
  current chapter and continue.

## Versioning & migration

- `schemaVersion` is an integer, monotonically increasing.
- Every bump ships a migrator: `migrations/v1-to-v2.js`, etc., applied in
  order on import.
- **Missing migrator = blocked import** with a clear error ("this save was
  made with a newer/older version; upgrade/downgrade to N to load"). We do
  not silently coerce or drop fields — silent migration is how saves rot.

## Autosave policy

- After every committed turn: write the deltas of the *hot* slices to
  localStorage. Cheap because Spektrum already emitted the delta.
- Every chapter end: snapshot the full save and append to `chapters` in
  IndexedDB.
- On tab close (`beforeunload`): best-effort flush.

## Quota & failure modes

- Monitor `navigator.storage.estimate()` and warn at 80% of quota.
- If a write fails for `QuotaExceededError`: stop autosave, surface a
  blocking modal, suggest export. Never lose in-memory state silently.
- If IndexedDB is unavailable (private browsing, locked-down browser): fall
  back to localStorage only, warn the player that long campaigns won't fit,
  and aggressively recommend export.

## Multiple save slots

V1: one active campaign + a list of exports. No multi-slot UI in-app —
exporting + re-importing is the mechanism for parallel campaigns. This keeps
quota and complexity manageable.

## Open

- Do we encrypt the save? Probably not at MVP (the data isn't sensitive and
  the key is the player's own), but worth a setting later.
- Compression on export (e.g., gzip via `CompressionStream`) to shrink share
  files? Nice-to-have.
