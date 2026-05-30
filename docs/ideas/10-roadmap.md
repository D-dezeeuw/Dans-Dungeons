# 10 — Roadmap

> **Status:** rough phasing. Each phase ends in something demonstrable.

The idea: prove the **loop** before we prove the **world**. A boring tiny
world with a working AI GM, dice, and persistence is a far stronger
foundation than a beautiful world with hand-waved play.

---

## Phase 0 — Repo scaffold (½ day)

- `index.html`, `src/main.js`, `src/ui/style.css`, empty Spektrum mount.
- `package.json` (zero deps).
- This idea folder.

**Done when:** the page loads, mounts Spektrum, and prints "ready".

---

## Phase 1 — AI plumbing & key flow (1–2 days)

- Settings panel for OpenRouter key + base URL + two model slots.
- `ai/openrouter.js` wrapper with timeouts, retries, token accounting.
- A no-op "echo turn" that round-trips a single prompt for sanity.
- Cost meter in the chrome bar.

**Done when:** player pastes a key, picks a model, types a message,
sees a GM reply, and sees the cost tick up.

---

## Phase 2 — `bag-of-holding` engine standup ✓ done

Extracted the rules + beat runtime into a sibling repo (zero deps, ESM):

- `dice`, `checks`, `combat`, `conditions`, `xp`, `movesets` modules.
- Classes (Fighter, Rogue, Cleric, Wizard) at levels 1–5.
- Starter SRD data (races, spells, items).
- Beat schema + thread runtime + archetype casting (linear v1,
  branching-ready).
- 23 tests passing via `node --test`.

Lives at
[`/Users/ddezeeuw/Projects/2026n/bag-of-holding/`](../../../bag-of-holding/);
see its
[`docs/spec.md`](../../../bag-of-holding/docs/spec.md),
[`docs/beat-schema.md`](../../../bag-of-holding/docs/beat-schema.md),
and
[`docs/boundary.md`](../../../bag-of-holding/docs/boundary.md).

---

## Phase 2.5 — Wire `bag-of-holding` into the app

- Import the engine in `src/` via relative path
  (`../../bag-of-holding/index.js`) during dev.
- Add `src/game/rules.js` as a thin re-export shim so app code says
  `import { Dice } from '../game/rules.js'` rather than reaching across
  repos directly.
- Console smoke test: `Dice.roll('2d6+3')` returns sensible values in the
  browser.
- When the engine reaches v0.1.0 and publishes, swap the dev import to a
  pinned `unpkg` URL in `index.html` (mirror the Spektrum pattern from
  [09-hosting-build.md](09-hosting-build.md)).

**Done when:** the app can call `bag-of-holding` functions from the
browser console without errors.

---

## Phase 3 — Single-room demo (2–3 days)

- Hard-coded tiny world: one room, one NPC, one optional monster.
- Real turn loop: classifier → rules → narrator.
- Movesets render as chips.
- Autosave on every turn (localStorage only, no IndexedDB yet).

**Done when:** a player can fight the monster, win or die, and reload to
re-play the scene from save.

---

## Phase 4 — World generator v0 (1 week)

- Layered agents: geography → history → red thread. No cities yet.
- JSON schemas + repair retries.
- Layered progress UI with live cost.
- Export the generated world as `.dnd.json` (no play yet — it's just a
  generator).

**Done when:** "New Campaign" produces a coherent world JSON file in
under 5 minutes for a reasonable cost.

---

## Phase 5 — Full pipeline + lazy expansion (1–2 weeks)

- City and quest-weave agents.
- Lazy-expander for off-script regions/NPCs.
- World digest summarizer; injected into all prompts.
- IndexedDB tier; hot/cold split; quota monitoring.

**Done when:** a generated world is playable end-to-end through at least
one red-thread beat, including an off-script detour the lazy expander
handles cleanly.

---

## Phase 6 — Chapter / session UX (1 week)

- Chapter boundaries with autosave snapshots.
- "Previously on…" recap generator.
- `/save`, `/load`, `/redo`, `/end-chapter` slash commands.
- Drag-and-drop import.

**Done when:** a player can step away mid-campaign, return days later,
get a recap, and continue.

---

## Phase 7 — Leveling, party, and polish (1–2 weeks)

- XP awards at chapter end.
- Level-up flow as a dedicated screen.
- Add the other starter classes.
- Optional NPC companion.
- Accessibility pass.
- Cost cap + dashboard.

**Done when:** a player can take a fresh PC from level 1 to level 5
through a coherent campaign arc.

---

## Phase 8 — Inverted GM mode (2+ weeks, opt-in)

- "Player as GM, AI as party" mode behind a setting.
- Party-AI prompts and personality profiles.
- GM-side UI (set DCs, control NPCs, reveal info).

**Done when:** the same world can be loaded in either mode without data
migration.

---

## Phase 9 — Polish & share (open-ended)

- Themes (parchment, dark).
- Share-a-world URL format (encoded export).
- Optional image-gen agent (BYOK for image provider).
- Service worker for offline UI shell.

---

## What we're explicitly *not* doing in v1

- Multiplayer.
- Cloud sync / accounts.
- Voice I/O.
- Mobile-first polish.
- Levels 6+ and full D&D rule surface.

These are not bad ideas; they just aren't the smallest thing that proves
the concept. Each is fine fodder for v2.
