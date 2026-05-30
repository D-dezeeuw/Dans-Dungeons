# 04 — D&D mechanics

> **Status:** rough sketch.

The rules engine lives in a sibling repo:
[**`bag-of-holding`**](../../../bag-of-holding/).
For ability scores, dice, checks, combat, XP, classes, conditions, movesets,
and the beat runtime, see
[`bag-of-holding/docs/spec.md`](../../../bag-of-holding/docs/spec.md).

This doc only captures **app-side mechanical concerns** — things that wrap
the engine in this game's UX, not the rules themselves.

## What the app adds on top of the engine

- **Movesets as chips.** The engine returns `Movesets.legal({ pc, scene })`
  as structured action objects; the UI renders them as clickable chips
  alongside the free-text input. The player can always type free-form;
  the classifier maps it to the closest legal action, or asks for
  clarification. Resource costs on chips are hidden by default and only
  rendered inline when Nerd mode is on (see [07-ui-ux.md](07-ui-ux.md)).
- **Dice rolls stay backstage by default.** The engine always returns the
  d20 and dice rolls in its results. Default UI presentation paraphrases
  the outcome in prose ("you connect cleanly"); the math surfaces only
  when Nerd mode is on (its Dice & roll log pane is the canonical view).
- **Narration of mechanical outcomes.** When the engine returns
  `{ hit: true, damage: 12 }`, the Narrator agent turns that into prose.
  Per [`bag-of-holding/docs/boundary.md`](../../../bag-of-holding/docs/boundary.md),
  the app never lets the AI invent the numbers.
- **Death & failure scenes.** Death saves use real engine rolls; the
  Narrator gets free rein on the *moment*. Total party kill ends the run;
  the save is preserved as a read-only "world archive."
- **Trademarked-name blocklist.** When the AI invents monsters / NPCs /
  items / settings, the app filters their names against a static list
  (see below) and re-rolls on a match. (The engine's SRD data is already
  clean.)

## Player-facing terminology (legal-aware)

Project legal guidance (kept in `docs/references/legal.md`, local-only
and gitignored) prefers terminology that doesn't lean on D&D
trademarks. Internal code/schema names stay clearest-wins (we still
write `armorClass` in JSON because that's what developers reading the
code expect), but **everything the player sees** uses the safe terms:

| Concept | Player-facing string |
| --- | --- |
| The GM agent | **Narrator** |
| Saving throw | **Resistance Check** |
| Armor Class | **Defense Rating** |
| The setting / campaign world | **Realm** |
| The campaign as a long-form story | **Chronicle** |
| The combat & encounter system | **Encounter System** |

The world generator and prompt templates produce these terms directly; we
don't translate at render time. (Internal code that uses `ac` or `save`
in variable names is fine — the contract is "what reaches the screen.")

## Trademark blocklist

Shipped as `src/world/blocklist.js`. Generation-time names are normalised
(lowercase, stripped of punctuation/articles, fuzzy-matched against the
list); a match triggers a re-roll. Initial list, drawn from the
local-only project legal guidance:

- **Monsters / creatures:** Beholder, Mind Flayer, Illithid, Githyanki,
  Githzerai, Displacer Beast.
- **Settings & places:** Forgotten Realms, Faerûn, Waterdeep, Baldur's
  Gate, Neverwinter, Phandelver.
- **Brand strings:** "Dungeons & Dragons", "D&D".

Expand as we encounter near-misses during playtesting. Goal is small and
maintained-by-hand, not exhaustive — exhaustiveness is a lawyer's job
before commercial release.

## Content licensing

We rely on the **5e SRD 5.2** (released 2025 by Wizards of the Coast
under [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)) and
credit prominently. The engine paraphrases mechanics; the app
paraphrases anything player-visible the engine doesn't own
(lore-flavored item descriptions, NPC titles, etc.). The full SRD is
freely available at [dndbeyond.com/srd](https://www.dndbeyond.com/srd).

CC-BY-4.0 attribution we must ship in any user-visible "About" or
documentation surface:

> This work includes material from the System Reference Document 5.2
> ("SRD 5.2") by Wizards of the Coast LLC, available at
> <https://www.dndbeyond.com/srd>. The SRD 5.2 is licensed under the
> Creative Commons Attribution 4.0 International License, available at
> <https://creativecommons.org/licenses/by/4.0/legalcode>.

We may also note "compatible with fifth edition" or "5E compatible" per
the license; no other affiliation with Wizards is permitted.

## SRD 5.2 deltas → MVP engine work

Audited 2026-05-17 against `bag-of-holding` 0.x. Five additions ship at
MVP because they appear in nearly every turn:

1. **Rename `races` → `species` in `bag-of-holding/src/srd/`.** Matches
   SRD 5.2 vocabulary and the player-facing terminology table above.
   Internal API: `SRD.species` replaces `SRD.races`.
2. **Add the 5 missing species** as minimal records: Dragonborn, Gnome,
   Goliath, Orc, Tiefling. (Existing four — Human, Elf, Dwarf, Halfling
   — stay.) Speed + key ability bumps + a one-line signature trait each.
3. **Exhaustion as a numeric condition (1–6).** SRD 5.2's revised model:
   −2 to all D20 Tests per level, −5 ft Speed per level, death at 6.
   Lives on the actor as `actor.exhaustion: 0..6` with `Conditions.exhaustion`
   helpers (`gain`, `reduce`, `modifierToD20Tests`). The frozen
   `CONDITIONS` list stays boolean-only; Exhaustion is sui generis.
4. **Weapon Mastery.** Every weapon in `items.js` gains a `mastery`
   property from the 8-property set (Cleave, Graze, Nick, Push, Sap,
   Slow, Topple, Vex). New helper `Combat.applyMastery(weapon, target,
   attackRoll)` returns the rider effect. Fighter L1 gets
   `weaponMasterySlots: 3` (rotateable on long rest); Fighter L2 gets
   Tactical Mind; Fighter L5 gets Tactical Shift.
5. **Backgrounds + Origin Feats (minimal set).** New
   `bag-of-holding/src/srd/backgrounds.js` with the four SRD 5.2
   backgrounds (Acolyte, Criminal, Sage, Soldier). Each carries skill
   proficiencies, a tool proficiency, three ability bumps, and one
   Origin Feat. The four backgrounds reference three distinct feats:
   **Magic Initiate** (Acolyte → cleric variant, Sage → wizard
   variant), **Alert** (Criminal), and **Savage Attacker** (Soldier).
   Other feat categories (General, Fighting Style, Epic Boon) stay
   out of scope.

### Deferred from SRD 5.2 (kept on the "later" pile)

- The 8 classes we don't currently implement (Barbarian, Bard, Druid,
  Monk, Paladin, Ranger, Sorcerer, Warlock) — extend after MVP one at
  a time per playtesting demand.
- All subclass mechanics past L3 placeholder; multiclassing; levels 6+.
- Full feats catalog beyond the 4 origin feats above.
- Full spell catalog — 6 starters cover L1–5 spellcasters at MVP;
  expand alongside class scope.
- Monster stat blocks — world-gen invents creatures (subject to the
  blocklist below); SRD monster mechanics aren't engine-side.
- Gameplay-toolbox sections (Travel Pace, Curses, Mental Stress, Traps,
  etc.) — Narrator-side content; informs prompts, not engine code.

## Open

- Companions: how many, how autonomous? Probably max 1 NPC companion at
  MVP. The engine handles each PC turn-by-turn so multi-companion is
  more a UX problem than an engine one.
- Project rename. "Dan's Dungeons" — rename resolved
  before any public release whether to rebrand (e.g. "Realms and Dans",
  "Chronicle of Dans") or lean into it as parody — the legal calculus is
  different in each case.
