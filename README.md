# Dan's Dungeons

A text-based D&D type game in the spirit of Zork, pulled into the 21st century by
putting an LLM in the Game Master's chair.

**Sales pitch:** generate a coherent ~100-hour fantasy world up front,
then play through it as natural-language dialogue with an AI Dungeon Master
that knows the rules, the world, and the secrets it must keep.

## Main features (planned)

- Layered, eagerly-generated worlds (continents → cities → red thread)
- AI Game Master enforcing real D&D basic-ruleset mechanics (dice, classes,
  XP, leveling)
- Chapter-based sessions with autosave and rewind
- Full save export / import as a single `.dnd.json` file
- 100% client-side, hostable on GitHub Pages
- Bring-your-own OpenRouter API key — no servers, no telemetry
- Zero shipped npm dependencies (Spektrum loaded from a pinned `unpkg` URL)

## What it does not (yet)

- No multiplayer, no accounts, no cloud sync
- No graphics — text-first by design
- No voice I/O
- No copyrighted D&D content; we lean on the 5e SRD / Basic Rules

## Status

Early ideation. Start here: [docs/ideas/00-overview.md](docs/ideas/00-overview.md).

For the phased delivery plan, see
[docs/ideas/10-roadmap.md](docs/ideas/10-roadmap.md).
