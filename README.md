# Dan's Dungeons

A text-based fantasy roleplaying game in the spirit of Zork, pulled into the 21st
century by putting an LLM in the Game Master's chair. It runs entirely in your
browser, on your own API key, with a deterministic 5e-compatible rules engine
keeping the AI honest.

**Play:** https://d-dezeeuw.github.io/Dans-Dungeons/

## What it does today

- **AI Game Master over real mechanics.** Dice, attacks, damage, conditions,
  death saves and skill checks are resolved by a deterministic rules engine
  ([`bag-of-holding`](https://github.com/d-dezeeuw/bag-of-holding)); the LLM
  narrates the outcome it is given and may not overrule it.
- **Two ways to play.** *Quick Dungeon* generates a lock-and-key dungeon
  instantly. *New Campaign* generates a small world first — lore, factions, a
  red-thread story, a region and a settlement — then drops you into it.
- **Towns, travel and trade.** Talk to NPCs with persistent memory and secrets,
  take quests, buy gear, rest, and travel between settlements with road
  encounters along the way.
- **Seeded, auditable dice.** Every combat roll comes from a seeded stream that
  can be replayed and verified from the seed ("Verify" in Settings).
- **Time travel.** Undo, redo, and jump to any earlier turn; diverging creates a
  branch you can switch between.
- **Streaming narration**, optional scene sketches, and an EPUB journal of
  your adventure. Text-to-speech and speech-to-text are wired but need a
  speech-capable provider behind your key — OpenRouter hosts no speech models.
- **English and Dutch**, including AI prompts.
- **Your save is yours.** Everything lives in your browser — recent play in
  `localStorage`, older chapters archived to IndexedDB — and the whole run
  exports and imports as a single `.dnd.json` file. No accounts, no servers,
  no telemetry.

## Bring your own key

The game talks to [OpenRouter](https://openrouter.ai) with a key you supply —
connect your account in one click, or paste a key. Free models are available and
the classifier/narrator defaults are chosen to work on them; a Deluxe tier
switches to stronger paid models and unlocks scene images.

Builds ship **no credential of any kind**. (A shared demo key can be injected at
build time via `DD_DEMO_KEY`, but a browser bundle cannot keep a secret, so any
such key must be treated as public and rate-limited behind a proxy.)

## What it is not

- No multiplayer, no accounts, no cloud sync.
- No tilemaps or portraits — text-first by design (scene sketches are optional
  decoration).
- Not a finished 80-hour campaign yet. See the audit and plan below for exactly
  how far it is and what comes next.

## Development

```bash
npm install         # esbuild + Playwright — dev-only; `npm test` needs neither
npm test            # node --test tests/  (zero-dep runner, Node 20+)
node build.js       # bundle src/main.js -> vendor/app.bundle.js + version stamp
npm run serve       # serve the repo root at http://localhost:3000
```

Runtime libraries are vendored under `vendor/` and copied from their sibling
repos by `node scripts/vendor-sync.js` (which stamps a `VENDOR.json` manifest;
`--check` fails CI on undeclared drift). `node scripts/check-models.js` verifies
every configured model id still exists in the provider catalog.

See [CLAUDE.md](CLAUDE.md) for the architecture and module map.

## Where the project stands

- [`docs/audit/2026-08-comprehensive-audit.md`](docs/audit/2026-08-comprehensive-audit.md)
  — an honest, evidence-based audit of all four repos.
- [`docs/audit/2026-08-comprehensive-implementation.md`](docs/audit/2026-08-comprehensive-implementation.md)
  — the phased plan toward the 80-hour campaign.
- [`docs/ideas/`](docs/ideas/) — design documents. Each carries a status header;
  several describe intentions rather than shipped behaviour.

## Licence and attribution

Dan's Dungeons is licensed under the **Mozilla Public License 2.0** (see
[LICENSE](LICENSE)).

The game's mechanics are built on the **System Reference Document 5.2** by
Wizards of the Coast LLC, licensed under
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

This is an independent product and is not affiliated with, endorsed, sponsored,
or specifically approved by Wizards of the Coast LLC. See [NOTICE](NOTICE) for
bundled third-party components.
