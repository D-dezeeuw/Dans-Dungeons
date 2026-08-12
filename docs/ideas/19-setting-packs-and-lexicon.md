# 19 — Setting packs & the player's lexicon

> **Status: SHIPPED, 2026-08-12** — every phase in §17 except the deliberately
> deferred topic chips (§13c). What the code does differs from this plan in
> nine places, each recorded in [§20](#20--implementation-record), which is the
> section to read if the two disagree. The design sections below are unedited:
> they are the reasoning, and the reasoning survived.

> **Original status:** design / approved scope (owner-directed, 2026-08-12: *"we need to
> make sure the enemies, location, translations, but also things like how the
> AI writes responses fit a bit in that theme. 'Friend', 'Matey', 'Choom', all
> differ from the theme chosen … make it choosable or (seeded) generated
> randomly, automatically choosing first from a theme and then pick the
> contents with it"* and *"the responses can be a bit confusing because the AI
> Game Master knows more about the world than the player … create a 'free'
> action … a dictionary that explains the world and (seemingly known) objects
> without costing a turn. A magical staff can have hidden properties or an
> item can be unknown and that should remain like that. But 'known' knowledge
> has to be able to be brought up and explained freely."*).
>
> Builds on the layered world ([doc 17](17-layered-world-lod.md)), the
> client's lore-tree plan (the "doc 18" cited in client source =
> [`bag-of-holding-client/docs/worldgen-lore-tree.md`](../../vendor/bag-of-holding-client/docs/worldgen-lore-tree.md)
> — this document therefore takes number 19), the information-asymmetry model
> ([doc 08](08-secrets-and-gm-modes.md)), and two findings from the
> 2026-08-11 live red-line run: narrator jargon outruns the player, and every
> campaign wears the same high-fantasy clothes.
>
> **Written to be implemented by a smaller model.** Every change names its
> file and symbol, every new module gets a signature block, every phase ends
> in a runnable gate. Where a choice existed, this document makes it — the
> implementer should not have to.

---

## Part 0 — The one-screen version

Two features, one philosophy.

**Setting packs (Part I).** A theme — cyberpunk stacks, dark-ages mud, high
elvish courts — is *data, not code*. The engine's rules, the LOD tree, the
turn loop, the ledger: none of them know what genre they are running. Genre
lives in exactly four kinds of data, and all four already have injection
seams: **archetype tables** (the blueprint's `tables` option), **dungeon
overlays** (`generateDungeon`'s `overlays` option), **locale content tables**
(`tRaw('world.…')`), and **prompt text** (i18n templates with `{{params}}`).
A `SettingPack` bundles replacements for those four, plus a **voice block**
that tells the narrator and every NPC how people in this world talk
("choom" / "matey" / "friend"). Selection is *theme first, contents second*:
the player picks a pack in the wizard (or picks "surprise me", which is a
seeded draw), and only then does the world seed roll everything else —
inside that pack's tables.

**The lexicon (Part II).** A free action — costs no turn, calls no model —
that answers "what is X?" from what the game has *already stored as
player-known*: encountered ledger entities, discovered map nodes and their
digests, met NPCs, held items, accepted quests, chapter digests. Three
knowledge classes: **known** (serve it), **heard-of** (serve the rumour,
labelled as rumour), **hidden/unknown** (an in-fiction refusal — a staff's
unidentified property stays unidentified, an unrevealed secret stays
secret). Deterministic first; an optional tiny-tier paraphrase can restyle
the answer in the pack's voice, but never add to it.

They meet in the middle: the lexicon's labels and refusal lines are pack
content, and its optional paraphrase speaks in the pack's voice.

---

# PART I — SETTING PACKS

## 1 · Why theme is data, not a fork

An inventory of every place "high fantasy" is currently hardcoded. This
table is the whole feature — each row becomes a pack field and a threading
row in §5.

| # | Where | What it hardcodes today |
|---|-------|--------------------------|
| 1 | `vendor/bag-of-holding-client/src/worldgen/blueprint.js` `DEFAULT_TABLES` | 24 world archetypes, 24 threats, 20 climates, 24 dungeon themes, 20 faction archetypes, 20 god domains, buildings, landmarks — all D&D-flavoured. **Already injectable**: `buildBlueprint(seed, { tables })`, `deriveBlueprint(…, { tables })`. |
| 2 | `blueprint.js` `THEME_CLIMATES` / `BAND_SETTLEMENTS` | Which dungeon themes fit which climate band; settlement palettes per band. Module constants — **not yet injectable** (client change, §8). |
| 3 | `vendor/bag-of-holding-client/src/worldgen/skeleton.js` `CONTINENT_A/B`, `PROVINCE_A/B` | Fantasy syllable banks for continent/province names ("Veldrath", "Saltmarch"). Exported as `SYLLABLES` but `mintWorldSkeleton` cannot take replacements — **not yet injectable** (client change, §8). |
| 4 | `vendor/bag-of-holding-client/src/dungeon/generate.js` `DUNGEON_OVERLAYS` | 24 theme → `{ atmosphere, enemies: [creatureId] }` pools. **Already injectable**: `generateDungeon(seed, { overlays })`, and `src/game/world.js` passes them. |
| 5 | `src/i18n/en.json` + `nl.json` `world.*` | The dungeon's whole prose wardrobe: `world.rooms.{8 types}` (5 descriptions each), `world.dressing.{24 themes}` (6 details each), `world.houseStyles`, `world.treasures/keys/loot`, `world.enemyNames`, `world.enemyIntros`. Read via `tRaw()` in `src/game/world.js dungeonContent()`. |
| 6 | `src/i18n/*.json` `ai.*` | Prompt templates. `ai.narratorPrompt` says *"tabletop campaign"* and takes `{{tone}}` but has no voice channel; `ai.npcDialoguePrompt` says *"a single NPC in a fantasy town"*; `ai.travelPrompt`, `ai.journal*`, worldgen prompts likewise assume the genre. |
| 7 | `src/ai/narrate.js` `generateSceneImage()` | The image prompt is the string `'Old hand-drawn journal sketch of a medieval fantasy scene…'` — a cyberpunk campaign would still sketch castles. |
| 8 | `src/game/worldseed.js` `DOMAIN_TREASURES` / `DOMAIN_KEYS` | 20 domain-themed treasures/keys ("bone key", "tide pearl"). |
| 9 | `src/game/character.js` `STARTER_CLASSES` + SRD names | Class/species labels render raw SRD ids ("fighter", "wizard"). Mechanics must not change; labels can. |
| 10 | `src/game/creatures.js` / `src/game/bestiary.js` | Stat blocks are genre-neutral numbers; the *names* ("Goblin", "Vampire Spawn") are presentation — and presentation already routes through i18n (`world.enemyNames[id]` overrides `BESTIARY[id].name` in `world.js enemyName()`). |
| 11 | `src/i18n/*.json` `map.*`, `sail.*`, `travel.*`, `settlement.*` | Layer vocabulary: "continent", "province", "port", "set sail", "tavern". A vertical-city pack wants "sprawl", "district", "gate", "ride the ferry line". All format strings — swappable as data. |
| 12 | `vendor/bag-of-holding-client/src/output/epub.js` `TONE_PALETTE` + cover | Sepia parchment cover. (P2 — cosmetic, listed for completeness, not phased.) |

Two conclusions the implementer should hold on to:

- **The mechanics never change.** A pack swaps *presentation and palettes*.
  Stat blocks, dice, DCs, the resolver, schemas, the LOD tree, the ledger —
  untouched. A "netrunner" is a wizard's numbers wearing different clothes.
- **Most rows are already data.** Rows 1, 4, 5, 8, 11 need zero new
  mechanism beyond "let a pack supply the object". Only rows 2–3 need small
  client-library changes, and rows 6–7 need a new prompt parameter.

## 2 · The `SettingPack` contract

One frozen object per pack, in `src/settings/` (new directory — packs are
game content, not library code). The shape:

```js
// src/settings/pack-<id>.js
export const PACK = Object.freeze({
  id: 'neon-stacks',          // stable, lowercase-kebab; stored in saves
  packVersion: 1,             // bump on breaking content change
  era: 'future',              // 'ancient' | 'medieval' | 'modern' | 'future' — informational

  // ── wizard card ──────────────────────────────────────────────────────────
  // Localized: { en: {…}, nl: {…} }; nl optional (falls back to en).
  card: {
    en: { name: 'The Neon Stacks', blurb: 'A vertical city that never sees the sky. Debts, implants, and rain.' },
    nl: { name: 'De Neonstapels',  blurb: 'Een verticale stad die de hemel nooit ziet. Schulden, implantaten en regen.' },
  },

  // ── blueprint palettes (row 1–2) ─────────────────────────────────────────
  // Partial override of DEFAULT_TABLES: absent keys inherit the default.
  // If `dungeonThemes` is overridden, `themeClimates` MUST cover every new
  // theme and `dressing`/`overlays` MUST have entries for each (pack lint, §9).
  tables: {
    worldArchetypes: [/* ≥8 strings */],
    threatTypes:     [/* ≥8 */],
    dungeonThemes:   [/* ≥6 */],
    factionArchetypes: [/* ≥8 of { type, desc } */],
    settlementTypes: {/* per legacy climate — optional */},
    buildingTypes:   [/* ≥12 */],
    locationTypes:   [/* ≥12 */],
    // godDomains: optional; omit to keep the epithet table (it is deliberately
    // name-free and survives most genres — a cyberpunk 'god of the forge' is
    // a corp founder myth).
  },
  themeClimates: {/* theme → [bands] for every pack theme; bands = CLIMATE_BANDS */},
  bandSettlements: {/* band → [settlement types] — optional override */},

  // ── naming culture (row 3) ───────────────────────────────────────────────
  syllables: {
    continentPrefixes: [/* ≥8 */], continentSuffixes: [/* ≥8 */],
    provincePrefixes:  [/* ≥10 */], provinceSuffixes:  [/* ≥10 */],
  },

  // ── dungeon overlays + creature skins (rows 4, 10) ───────────────────────
  // overlays: same shape as DUNGEON_OVERLAYS; every enemy id MUST exist in
  // BESTIARY (stats are reused — only presentation changes).
  overlays: { 'server-crypt': { atmosphere: '…', enemies: ['skeleton', 'zombie', 'shadow', 'specter', 'wight'] } /* … */ },
  // skins rename creatures WITHOUT touching stats. Applied via the i18n
  // overlay (world.enemyNames / world.enemyIntros), listed here for lint.
  // A skeleton in the Stacks is a 'derelict chassis' with the same 13 hp.

  // ── label skins (row 9) ──────────────────────────────────────────────────
  classSkins:   { fighter: {en:'Enforcer', nl:'Handhaver'}, rogue: {en:'Runner'}, cleric: {en:'Ripperdoc'}, wizard: {en:'Netrunner'} },
  speciesSkins: {/* optional, same shape */},

  // ── voice (row 6) — see §6 ───────────────────────────────────────────────
  voice: {
    address:      ['choom', 'omae'],          // how strangers call the PC
    register:     'clipped street cant; tech slang worn casually; sentences that end early',
    honorifics:   ['-san for elders on the upper tiers'],
    exclamations: ['null that', 'by the Grid'],
    forbid:       ['thee', 'ye', 'tavern', 'm’lord'],
    examples: {                                // few-shot, 2–3 SHORT lines each
      narrator: ['Rain works its way down forty storeys of pipe to find you.'],
      npc:      ['You buying or just bleeding on my counter, choom?'],
    },
  },

  // ── locale content overlay (rows 5, 8, 11) — see §4 ─────────────────────
  // Sparse tree merged over the base bundle at lookup time. Anything absent
  // falls through to the base en.json/nl.json.
  i18n: {
    en: {
      world: { houseStyles: […], rooms: { entrance: [/*5*/], /* all 8 types */ },
               dressing: { 'server-crypt': [/*6*/] /* every pack theme */ },
               treasures: […], keys: […], loot: […],
               enemyNames: { skeleton: 'Derelict Chassis' }, enemyIntros: { skeleton: '…{{name}}…' } },
      map: { continentLine: '≣ {{name}} — sprawl {{held}}', /* … */ },
      sail: { chip: 'Ride the ferry line', /* … */ },
      lexicon: { kind: { era: 'epoch' /* optional relabels */ } },
    },
    nl: {/* optional; same sparse shape */},
  },

  // ── scene image + prompt colour (rows 6–7) ───────────────────────────────
  imageStyle: 'Rain-streaked ink sketch of a dense vertical city interior. Neon bleed on wet metal. No text.',
  promptLine: {  // ONE sentence injected into worldgen + narrator prompts
    en: 'This setting is a rain-soaked vertical mega-city of stacked districts; technology is grimy and personal; nothing medieval exists.',
    nl: '…',
  },
});
```

**Invariants** (enforced by the pack lint, §9):

1. Every `overlays[theme].enemies[i]` ∈ `KNOWN_CREATURE_IDS` (from
   `src/game/bestiary.js`). Packs never define stat blocks.
2. If `tables.dungeonThemes` is set: every theme has an `overlays` entry, a
   `themeClimates` entry, and an `i18n.en.world.dressing` entry.
3. `syllables` banks non-empty when present; all four lists together or none.
4. `voice.address` non-empty; `voice.examples.narrator/npc` ≤ 3 lines each,
   each ≤ 120 chars (few-shot bloat is a per-turn tax).
5. `i18n` overlay keys must be a subset of the base bundle's key paths *plus*
   the whitelisted extensible tables (`world.dressing.*`, `world.enemyNames.*`,
   `world.enemyIntros.*`, `lexicon.kind.*`) — a typo'd key must fail lint,
   not silently fall through.
6. A pack may NOT contain: functions (except none — it is JSON-shaped data
   frozen in a JS module), stat fields, schema fragments, model ids, prompts
   other than `promptLine`/`voice`/`imageStyle`.

**Registry** — `src/settings/index.js`:

```js
import { PACK as classic }    from './pack-classic.js';
import { PACK as darkAges }   from './pack-dark-ages.js';
import { PACK as neonStacks } from './pack-neon-stacks.js';

export const SETTING_PACKS = Object.freeze({ classic, 'dark-ages': darkAges, 'neon-stacks': neonStacks });
export const DEFAULT_PACK_ID = 'classic';
export function resolvePack(id) { return SETTING_PACKS[id] ?? SETTING_PACKS[DEFAULT_PACK_ID]; }
export function packIds() { return Object.keys(SETTING_PACKS); }
```

`resolvePack` never throws: a save carrying a deleted pack id degrades to
classic (and §3 says how the player is told).

## 3 · Selection: chosen or seeded, theme first

**Wizard step.** In `src/game/flow.js startNewGame()`, immediately *after*
the mode pick and *before* `createCharacter()` (the pack skins class labels,
so it must be resolved first):

```js
const packChoices = ['surprise', ...packIds()];
const packPick = await UI.pickFrom(
  t('newgame.settingQuestion'),
  packChoices,
  (id) => id === 'surprise' ? t('newgame.settingSurprise') : packCardName(id),  // card.{locale}.name
  0,  // default: surprise
);
```

**Seeded surprise — theme first, then contents.** The user's ordering
requirement, made mechanical: the pack draw happens from the *campaign seed*
before any content rolls, and the blueprint then rolls inside the pack.

```js
// src/settings/index.js
import { mulberry32, pick } from 'bag-of-holding-client';
const PACK_STREAM = 0x5e771e5; // any fixed constant: pack draw shares the seed
                               // but not the blueprint's rng stream
export function pickPack(seed) {
  return pick(packIds(), mulberry32((seed ^ PACK_STREAM) >>> 0));
}
```

Sort `packIds()` alphabetically inside `pickPack` before picking, so
registry insertion order can never silently reshuffle which pack a seed
lands on.

In `startCampaign()` the existing lines

```js
const blueprintSeed = Math.floor(Math.random() * 2147483647);
const blueprint = buildWorldBlueprint(blueprintSeed);
```

become

```js
const blueprintSeed = Math.floor(Math.random() * 2147483647);
const packId   = chosenPackId === 'surprise' ? pickPack(blueprintSeed) : chosenPackId;
const pack     = resolvePack(packId);
setValue('world.settingId', packId);
applyPackOverlay(pack);                       // §4 — before any content roll
const blueprint = buildWorldBlueprint(blueprintSeed, pack);   // §5 row 1
```

`startQuickDungeon()` gets the same treatment (same wizard answer; quick
dungeons deserve themes too).

**Persistence and every path back into a running game.** `world.settingId`
rides in `world`, so save export/import and time-travel branches carry it for
free. What does NOT come for free is the overlay re-application — it is
module state in i18n, not Spektrum state. Wire `applyPackOverlay(resolvePack(appState.world?.settingId))`
into, exhaustively:

1. `src/main.js` boot, after the save envelope is loaded and before the
   first render;
2. save import (`src/ui/exports.js`, wherever `.dnd.json` import restores
   state — after `resetAndRestore`);
3. slot load (`src/core/slots.js` consumers — same hook as 2 if they share
   the restore path; verify they do);
4. time-travel restore (`src/game/undo.js` `resetAndRestore`) — a branch
   made under a different experiment pack must re-skin on rewind;
5. locale switch (`setLocale` callers in `src/ui/sidebar.js`) — the overlay
   is per-locale, so re-apply after the bundle flips.

If `resolvePack` degraded (unknown id), print `t('newgame.settingMissing', { id })`
once at boot — the save keeps working in classic clothes rather than
refusing to load.

**Mid-campaign switching is refused.** The pack is genesis-bound (names,
overlays, and canon are already minted in its vocabulary). No UI offers a
switch; the settings sidebar shows the pack name read-only
(`sidebar.settingLabel`).

## 4 · The i18n overlay — the mechanism that makes packs cheap

There are ~200 `t()`/`tRaw()` call sites reading `world.*`, `map.*`,
`sail.*`, `settlement.*` content. Editing call sites does not scale; a
lookup-time overlay does. In `src/i18n/i18n.js`:

```js
let _overlay = null;   // { en: {...}, nl: {...} } — sparse tree, or null

export function setContentOverlay(byLocale) { _overlay = byLocale ?? null; }
export function clearContentOverlay()       { _overlay = null; }
```

Lookup order, for both `t(key, params)` and `tRaw(key)`:

1. `_overlay[_locale]` at `key` — pack, player's language;
2. `_overlay.en` at `key` — pack, English (a pack translated later still
   themes a Dutch game rather than splitting it half-fantasy);
3. base bundle `_locale`, then base `en` (existing behaviour, unchanged).

Concretely: extract the existing `_get(bundle, key, …)` walk into a helper
and try the four roots in order; first hit wins. `t()` keeps its
string-only guard per root (a non-string in an overlay root falls through to
the next root, exactly like the base bundles behave today).

`applyPackOverlay(pack)` (in `src/settings/index.js`) is just
`setContentOverlay(pack.i18n ?? null)` — classic's overlay is `null`, which
makes phase S1's "no behaviour change" claim testable.

**Interaction with `i18n-parity.test.js`:** the parity suite compares base
`en` vs `nl` entry-for-entry today. Extend, do not weaken: for each pack
with an `nl` overlay, every `nl` overlay key must also exist in the pack's
`en` overlay (the reverse is allowed — untranslated pack keys fall back to
pack-en by rule 2). Pure data check, no DOM.

## 5 · Threading map — every injection point

The complete wiring table. "Phase" refers to §17.

| # | File · symbol | Today | Change | Phase |
|---|---------------|-------|--------|-------|
| T1 | `src/game/worldseed.js` `buildWorldBlueprint(seed)` | calls `buildBlueprint(seed)` | `buildWorldBlueprint(seed, pack = null)` → `buildBlueprint(seed, { tables: packTables(pack) })` where `packTables` deep-merges `pack.tables` over `DEFAULT_TABLES` (array fields replace, object fields merge per key). Also attach `bp.settingId = pack?.id` and `bp.promptLine = pack?.promptLine?.[locale()] ?? pack?.promptLine?.en ?? null` so downstream prompt builders need no second lookup. | S1 |
| T2 | `src/game/flow.js` `startNewGame` / `startCampaign` / `startQuickDungeon` | no pack notion | wizard step, seeded pick, `world.settingId`, `applyPackOverlay` (§3) | S2 |
| T3 | `src/i18n/i18n.js` | two-root lookup | four-root overlay lookup (§4) | S1 |
| T4 | `src/game/world.js` `generateDungeon` | `overlays: DUNGEON_OVERLAYS` | `overlays: activePack().overlays ?? DUNGEON_OVERLAYS` — add `activePack()` to `src/settings/index.js` reading `appState.world?.settingId`; `world.js` already imports content lazily per call, so no caching trap | S2 |
| T5 | `src/game/world.js` `dungeonContent()` + `enemyName/enemyIntro` | `tRaw('world.…')` | **no change** — the overlay (T3) re-points every lookup | — |
| T6 | `src/game/worldseed.js` `DOMAIN_TREASURES/KEYS` | module constants | keep as classic defaults; pack may override via `i18n.en.world.domainTreasures/domainKeys`? **No** — these are keyed objects consumed directly. Simplest correct: `dungeonContent()` already passes them; make it `activePack().domainTreasures ?? DOMAIN_TREASURES` (optional pack field, same shape) | S2 |
| T7 | `src/ai/narrate.js` `narrate()` | prompt params: memory/transcript/scene/resolved/tone/gm | add `voice: voiceBlock()` param; `ai.narratorPrompt` gains a `{{voice}}` slot (§6) | S3 |
| T8 | `src/ai/dialogue.js` `npcReply()` | fixed persona preamble | add `voice: voiceBlock('npc')` param; `ai.npcDialoguePrompt` gains `{{voice}}`; the literal "in a fantasy town" becomes "in {{settingNoun}}" fed from pack (`lexicon.kind.settlement`-style label or a dedicated `voice.settingNoun`; decide: add `voice.settingNoun` with classic = 'a fantasy town') | S3 |
| T9 | `src/ai/narrate.js` `narrateTravel()` | `ai.travelPrompt` | add `{{voice}}` same as T7 | S3 |
| T10 | `src/ai/journal.js`, `src/game/worldbible.js`, `src/ai/summarize.js` | genre-neutral-ish | journal + worldbible get `{{voice}}` (they write reader-facing prose); summarize does NOT (digests should stay flat and factual — they feed prompts, and style there compounds) | S3 |
| T11 | `src/ai/narrate.js` `generateSceneImage()` | hardcoded medieval string | `const style = activePack().imageStyle ?? CLASSIC_IMAGE_STYLE;` — move the current literal into `pack-classic.js` verbatim | S3 |
| T12 | `src/game/worldgen.js` all generators (`generateWorldSeed`, `generateBeats`, `generateFactions`, `generateContinentOutlines`, `generateProvinceOutline`, `generateRegion`, `generateSettlement`) | prompts = i18n template + `worldSeedConstraints(bp)` | append `bp.promptLine` (T1) as one extra constraint line where `worldSeedConstraints(bp)`/`blueprintContext(bp)` output is used — implement once: in `worldseed.js`, wrap `worldSeedConstraints` as `appConstraints(bp)` = library string + (`bp.promptLine` ? `\nSetting: ${bp.promptLine}` : '') and re-point worldgen.js imports to it. One symbol, seven call sites covered | S3 |
| T13 | `src/game/atlas.js` `initialAtlas` → `mintWorldSkeleton(seed, …)` | library syllables | pass `{ syllables: pack.syllables }` (client change C1, §8) | S4 |
| T14 | client `deriveBlueprint` province case | module `THEME_CLIMATES`/`BAND_SETTLEMENTS` | honor `tables.themeClimates`/`tables.bandSettlements` when present (client change C2, §8); game passes them via T1's merge | S4 |
| T15 | `src/game/character.js` class/species `pickFrom` formatters + `src/ui/actionbar.js` class labels | raw ids/SRD names | `skinLabel('class', id)` from `src/settings/skins.js`: `pack.classSkins?.[id]?.[locale()] ?? pack.classSkins?.[id]?.en ?? srdName(id)`. Mechanics untouched; `classId` stored unchanged | S2 |
| T16 | `map.*`, `sail.*`, `settlement.*` strings | base bundles | **no code** — pack overlay (T3) | content phases |
| T17 | `src/game/flow.js` quick-dungeon flavour line (`Theme: ${blueprint.dungeonTheme}…`) | hardcoded English template literal | move to i18n key `newgame.themeLine` while touching the area (drive-by, it is currently untranslatable) | S2 |

**What deliberately does NOT get the voice block:** both classifiers
(`ai.classifierPrompt`, `ai.settlementClassifierPrompt`), the beat checker,
the canon extractor, autoplay. They are *readers*, not *speakers* — style in
their prompts is token cost and drift risk with zero player-visible gain.
This is a rule for the implementer, not a suggestion.

## 6 · Voice: how "choom" reaches the prose

New module `src/settings/voice.js`:

```js
import { locale } from '../i18n/i18n.js';
import { activePack } from './index.js';

// audience: 'narrator' | 'npc' | 'journal'
export function voiceBlock(audience = 'narrator') {
  const v = activePack()?.voice;
  if (!v) return '';                       // classic: empty — prompts read as today
  const lines = [];
  if (v.register)          lines.push(`Register: ${v.register}.`);
  if (v.address?.length)   lines.push(`People address the player character as: ${v.address.join(', ')}. Use these naturally, not in every line.`);
  if (v.honorifics?.length) lines.push(`Honorifics: ${v.honorifics.join('; ')}.`);
  if (v.exclamations?.length) lines.push(`Exclamations heard here: ${v.exclamations.join('; ')}.`);
  if (v.forbid?.length)    lines.push(`Never use these words/props (wrong world): ${v.forbid.join(', ')}.`);
  const ex = v.examples?.[audience === 'npc' ? 'npc' : 'narrator'] ?? [];
  if (ex.length)           lines.push(`Lines that sound right here:\n${ex.map(l => `- ${l}`).join('\n')}`);
  return lines.join('\n');
}
```

Template changes (both locales; the `{{voice}}` slot renders empty for
classic, so the diff to current prompts is one placeholder line):

- `ai.narratorPrompt`: after the `Setting tone: {{tone}}` line, insert
  `\nHOW THIS WORLD SOUNDS:\n{{voice}}\n` — and change nothing else.
- `ai.npcDialoguePrompt`: replace `in a fantasy town` with
  `in {{settingNoun}}`, add `{{voice}}` before the Rules block.
- `ai.travelPrompt`, journal weaver, worldbible prompts: append a
  `{{voice}}` line.

Wiring: `narrate()` adds `voice: voiceBlock('narrator')` to its `t('ai.narratorPrompt', {...})`
params; `npcReply()` adds `voice: voiceBlock('npc')` and
`settingNoun: activePack()?.voice?.settingNoun?.[locale()] ?? activePack()?.voice?.settingNoun?.en ?? t('ai.defaultSettingNoun')`
(new key, en: `a fantasy town`).

**Language rule:** `voice.register`, examples, forbid-lists are written in
English even for `nl` play — prompts are already English with a
"Reply in {{language}}" directive, and the model transfers register across
the output language. Pack authors may add `voice.nl` later; out of scope.

**Budget rule:** the rendered block must stay ≤ ~120 tokens
(`estimateTokens` from `src/game/scope-budget.js`); add this as a pack-lint
assertion (§9), not a runtime clamp.

## 7 · The packs to ship

### 7.1 `classic` — the extraction (S1, the load-bearing phase)

Not a new theme: the *current game*, restated as a pack, proving the seams
carry. `pack-classic.js` contains: `tables: {}` (inherit all),
`syllables: null` (library banks), `overlays: null` (library),
`i18n: null`, `voice: null`, `imageStyle:` the exact current string moved
out of `narrate.js`, `promptLine: null`, `classSkins: null`.

**Gate for S1:** with classic active, `npm test` green and a seeded
campaign generates byte-identical output to main — pin with a unit test
that runs `buildWorldBlueprint(12345)` and `buildWorldBlueprint(12345, classic)`
and asserts deep equality, plus `generateDungeon(999, bp, …)` equality with
overlays passed the new way.

### 7.2 `dark-ages` — the near reskin (S5)

Proves a pack can shift *register* without new creatures. Same era, so:
no `syllables` override (fantasy names survive), no `overlays` override
(themes fit), small `tables` override (drop the whimsical archetypes; add
'famine winter', 'interdict and excommunication', 'the king's peace broken'
archetypes/threats), full `voice` ("friend", "traveller", "God keep you";
register: plain, weary, concrete; forbid: 'choom', neon anythings),
`i18n.en.world.houseStyles` + a handful of `dressing` grime passes,
`imageStyle`: 'charcoal and ash-wash medieval chronicle illustration…'.
Content size: ~150 lines. This pack is deliberately cheap — it is the
template other authors copy.

### 7.3 `neon-stacks` — the far reskin (S6)

The stress test: era flip, kind-vocabulary flip, creature skins. A
**fictional** vertical mega-city (invented name — e.g. "Sān Yau Vertical
City"), *evoking* the Kowloon-walled-city texture the owner asked for
without claiming the real place. Checklist, exhaustive (pack lint enforces
the starred rows):

| Content | Count | Notes |
|---|---|---|
| `tables.worldArchetypes/threatTypes` | ≥8 each | corp succession, grid blackout, tong war, water-riot… |
| `tables.dungeonThemes`* | 6 | e.g. server-crypt, flooded sublevel, tong den, black clinic, shrine floor, antenna forest |
| `themeClimates`* | 6 entries | map onto existing bands (coastal, mire, highland…) — bands are abstract enough |
| `overlays`* | 6 × 4–5 enemy ids | all from `KNOWN_CREATURE_IDS`; ascending CR, last id is the boss |
| `i18n.en.world.enemyNames/Intros`* | every id used in overlays | skeleton→'derelict chassis', ghoul→'stim-burned feral', will-o-wisp→'rogue drone' |
| `i18n.en.world.rooms.{8}`* | 8 × 5 | entrance→'gate landing', vault→'strong-room' prose |
| `i18n.en.world.dressing.{6}`* | 6 × 6 | |
| `i18n.en.world.houseStyles/treasures/keys/loot` | 6/4/4/4 | keycards, ledgers, ancestor tablets |
| `syllables`* | 8+8, 10+10 | invented phonetics, HK-adjacent flavour without real place names |
| `i18n.en.map.* / sail.* relabels` | ~15 strings | continent→sprawl, province→district, port→ferry gate, sail→'ride the ferry line' |
| `classSkins` | 4 | fighter→Enforcer, rogue→Runner, cleric→Ripperdoc, wizard→Netrunner |
| `voice` | full block | 'choom' lives here |
| `imageStyle`, `promptLine`, `card` | 1 each | |

Content size: ~450 lines of data. No new code.

### 7.4 Authoring guideline for real-world-inspired settings

The owner's idea list includes settings drawn from real places and
communities ("90's african ghetto's", "japans hong kong kowloon walled
city"). The framework supports them the same way `neon-stacks` does
Kowloon: **the fictional-analog treatment** — invented proper nouns, the
texture and register without naming the real place or people, and voice
blocks written as *lived-in speech, not caricature* (address terms and
cadence, never mock-dialect spelling). The pack lint cannot check respect;
this paragraph is the review bar for any future pack PR, and packs that
name real places, real communities, or published-setting IP (the
`docs/legal.md` rule that already stripped deity names from
`blueprint.js`) do not merge.

## 8 · Client-library changes (bag-of-holding-client → 0.12.0)

Two seams, both backward-compatible, both in the sibling repo (never the
vendored copy), re-vendored via `node scripts/vendor-sync.js`:

**C1 — `mintWorldSkeleton(seed, { syllables })`** in
`src/worldgen/skeleton.js`: accept
`syllables = { continentPrefixes, continentSuffixes, provincePrefixes, provinceSuffixes }`,
default `SYLLABLES`. Use them where `CONTINENT_A/B`/`PROVINCE_A/B` are read
(continent naming, per-continent `nameParts` subsets). Also thread through
`adoptFlatWorld`? — no: adoption names are fixed English ('the Known
Lands'); leave them (they only appear for legacy flat saves, which predate
packs by definition).

**C2 — `deriveBlueprint` palette override** in `src/worldgen/blueprint.js`:
in the `province` case, `themesForBand(band, tables)` already filters by
`THEME_CLIMATES`; change the filter source to
`tables.themeClimates ?? THEME_CLIMATES` and the settlement palette to
`(tables.bandSettlements ?? BAND_SETTLEMENTS)[band] ?? …`. `DEFAULT_TABLES`
gains neither key (absent = today's constants), so every existing caller and
every existing test is untouched.

Tests in the client repo: `tests/` gains cases — skeleton with injected
syllables produces names only from those banks (assert every minted
continent/province name decomposes into the injected prefixes×suffixes);
derive with `tables.themeClimates` restricting a theme to one band yields
palettes honoring it; both defaulted paths byte-match current snapshots.
Version bump `0.12.0` + roadmap line, per that repo's conventions. The
game-side S4 phase then re-vendors and switches T13/T14 on.

**Hydration/cartridge note (forward-compat, no work now):** `bakeCartridge`
and `HYDRATION_TEMPLATES` consume the slices whose vocabulary the tables
define, so pack tables flow through them already; a *baked* cartridge is
implicitly single-pack. When the lore tree (client doc 18) ships, add
`settingId` to the cartridge catalog row. Recorded here so nobody designs a
second mechanism later.

## 9 · Pack lint & tests (Part I)

New `tests/setting-packs.test.js` (game repo, `node --test`, zero deps).
`src/game/bestiary.js` imports the `bag-of-holding` bare specifier and will
not load under the node runner; build the known-id set the way
`tests/spells.test.js` reaches the engine — relative vendored path:

```js
import { SRD } from '../vendor/bag-of-holding/index.js';
import { CUSTOM_MONSTERS } from '../src/game/creatures.js';   // import-free by design
const KNOWN_IDS = new Set(Object.keys({ ...SRD.monsters, ...CUSTOM_MONSTERS }));
```

Cases:

- **lint** (per pack, table-driven over `SETTING_PACKS`): invariants 1–6 of
  §2, the §6 voice-block token budget, overlay-key whitelist, per-pack
  `nl`⊂`en` parity (§4).
- **determinism:** `pickPack(seed)` stable for three known seeds;
  `buildWorldBlueprint(seed, pack)` twice → deep-equal.
- **classic-identity:** §7.1's byte-identity assertions.
- **overlay lookup:** `setContentOverlay` unit tests — four-root order,
  string-only fallthrough for `t`, raw pass-through for `tRaw`,
  `clearContentOverlay` restores base, missing-locale falls to pack-en.

`tests/wiring.test.js` additions: `voiceBlock`, `applyPackOverlay`,
`pickPack`, and `skinLabel` each have a consumer outside their module.

E2E (`tests/e2e/campaign.spec.js`): one new scenario seeded with
`world.settingId: 'neon-stacks'` forced via the localStorage seed the spec
already plants — assert a room description contains a pack-only string, an
enemy renders its skinned name, and the narrator mock received a system
prompt containing `choom` (the mock already dispatches on schema; add a
prompt-capture hook).

---

# PART II — THE LEXICON

## 10 · Why: the GM knows the world, the player met it yesterday

Live-run observation (2026-08-11): the narrator, correctly fed continent
and province digests, speaks of "the Emberfen accord" and "Saltmarch" as
established facts — because to the *world* they are. The player has seen
each name once, in a sentence that scrolled away. Asking "what is
Saltmarch?" today costs a full turn (classify → resolve as `look`/noEffect →
narrate), which (a) spends money to answer from memory the game already
holds structured, and (b) tempts the narrator to *embellish* — the exact
failure the ledger exists to prevent.

The fix is mechanical: the game already tracks what the player knows.
`world.encountered` (written by `src/game/loop.js` when scene entities are
first seen), the ledger fold (`entity`, `entitiesUnder`), geography
`discovered` flags + `knownMap`, `world.quests`, `party.inventory`, chapter
digests. `scope.js knownToPlayer()` already serves an 8-line slice of it to
the narrator every turn. The lexicon is the same read, pointed at the
player, with a query in front — and with the same hard wall `gmOnly` draws.

## 11 · The truth model: known / heard-of / hidden

Every queryable name resolves to exactly one class, and the class decides
the answer shape:

| Class | Serve | Never serve |
|---|---|---|
| **known** | stored player-visible fields, verbatim-ish | anything below |
| **heard-of** | the rumour/hook line, prefixed `lexicon.heardOfPrefix` ("You only know it from talk:") | digest details phrased as first-hand fact |
| **hidden / unknown** | `lexicon.unknown` refusal ("The name means nothing to you yet.") | that the thing exists at all |

**Source table** — the index builder's complete enumeration. Accessors are
existing exports; "kind" feeds the label (`lexicon.kind.*`).

| Source | Accessor | Class rule | Fields served | Forbidden |
|---|---|---|---|---|
| Ledger entities under the current region + world scope | `entitiesUnder('region')`-wide: iterate `ledgerBases()` keys ∪ ledger targets, `fold` each | `hasEncountered(id)` → known; else skip entirely | `name`, `description` / `condition` / `state` / `note` (the `detailsAt` precedence) | `gmOnly` never enters the ledger by design — nothing to filter, assert anyway |
| Geography nodes | `appState.world.geography` via `knownMap(geo)` | `visited` → known; `rumoured` → heard-of | known: `name`, `digest ?? hook`, kind, parent chain names; heard-of: `name`, `hook` (plus `digest` if outlined-on-approach — still heard-of: sailors' tales) | seeds, `detail` numbers, undiscovered siblings |
| Regions (legacy map) | `appState.world.regions[id]` | region `visited`/current → known | `name`, `digest`, `climate` | `digestBase` bookkeeping |
| Settlement NPCs | `world.settlements[*].npcs` | NPC has `dialogueHistory?.length` or is in `world.encountered` → known | `name`, `role`, `attitude`, faction name, quest hook *if that quest was accepted* | **`secret` unless `secretRevealed`** (and then only via the ledger fact below); `personality` (GM colour, not player knowledge) |
| Dungeon NPCs / creatures | `world.npcs` + encounter records | encountered → known | skinned display name, alive/dead, what the intro said | stat numbers (`cr`, `toHit` — mechanics stay behind the screen) |
| Factions | `world.factions` | rep ≠ 0, or an accepted quest names it, or a known continent lists it as homeland → known; named in any *heard* rumour → heard-of | `name`, `desc`/archetype line, standing (`reputationStanding`) | agendas from `gmOnly`/act directives |
| Items held | `party.inventory` + pc equipment | in inventory → known | `name`, `description`, quantity | any `hidden`/`secret`/unidentified property — if the record carries one, append `lexicon.hiddenMore` ("There is more to it than you can tell.") *only when* `item.hintHidden === true`, else stay silent about existence |
| Quests | `activeQuests(world.quests)` + completed | accepted/completed → known | `description`, giver `npcName`, status | unoffered quest hooks |
| Acts/story | `progress()` from `acts-runtime` | current act → known | act number, `currentTitle`, beats done/total | `directive`, unfired beats, `setups` |
| Chapters | `memoryContext()` | always known (it is the player's own past) | matching digest lines | — |
| World clocks | `rumours()` from `world-clocks.js` | rumour delivered → heard-of | the rumour text | clock values, `confront`/`resolve` internals |
| Eras/legends (lore tree) | `appState.world.lore?.…` | **guarded optional** — the lore tree is unshipped (client doc 18); include only entries flagged surfaced/encountered when it lands | name + surfaced digest | unsurfaced anything |

**One wiring change to make reveals durable:** when a secret reveal fires
(`src/game/flow.js`, the `secretRevealed: npc.secretRevealed || revealed`
merge + the `settlement.secretRevealed` transcript line), also
`recordCanon(npcEntityId, 'note', npc.secret, { because: t('settlement.secretBecause', { name: npc.name }), scope: 'local' })`.
Then the lexicon (and `knownToPlayer`, for free) serves revealed secrets
through the normal ledger path — no special case, and undo rewinds the
knowledge with the reveal. Add i18n key `settlement.secretBecause`.

## 12 · `src/game/lexicon.js` — module spec

Follows the house pattern: binds to `appState` for reads (like `ledger.js`),
pure helpers exported for tests, no DOM, no AI.

```js
// Entry: { key, kind, name, aliases: [string], body: string, class: 'known'|'heardOf' }
export function buildLexiconIndex()            // → Entry[] — assembled fresh per call; O(entities); no persistence
export function lookupLexicon(query, index?)   // → { hit: Entry } | { candidates: Entry[] } | { miss: true }
export function renderLexiconEntry(entry)      // → string[] transcript lines (localized)
export function lexiconTopics(limit = 8)       // → Entry[] — what to suggest on bare '/what'
```

**Alias building** (per entry): full name; name minus leading article
(en: the/a/an; nl: de/het/een — table `lexicon.articles` in both bundles);
each capitalized word ≥ 4 chars of multiword names (so "Saltmarch" finds
"the Saltmarch Reach") — collisions resolved at lookup, not build.

**Matching order** in `lookupLexicon` (input through `normalize()` from
`src/game/preclassify.js` — same punctuation/case folding, plus strip a
trailing `'s`):

1. exact name match (normalized) → hit;
2. exact alias match: one owner → hit; several → candidates;
3. whole-word containment (query ⊂ name or name ⊂ query): unique → hit,
   several → candidates (cap 4, `known` before `heardOf`, then longest
   name);
4. miss.

**Body assembly** (`renderLexiconEntry`): header line
`t('lexicon.entryHeader', { name, kind: t('lexicon.kind.' + kind) })`; body
clamped to `LEXICON_BODY_MAX = 320` chars at a sentence boundary; heard-of
prefixed with `t('lexicon.heardOfPrefix')`; optional trailing
`t('lexicon.hiddenMore')` per §11's item rule; provenance line only when
free (`t('lexicon.sourceQuest', …)` etc. — v1 ships without provenance,
key list reserves it).

**Topics** (`lexiconTopics`): current room NPC names, current region /
province / continent names, active quest names, up to `limit`, known-class
only — the things a confused player most likely just read.

## 13 · Surfaces — three, all turn-free by construction

The guarantee "no turn cost" is structural: the lexicon answers *before*
`processTurn` can see the input, exactly like `/`-commands. No classifier,
no undo mark (`markTurn` untouched), no `session.turnCount` change, no save
write.

**(a) `/what <term>`** — extend `handleMeta` in `src/game/flow.js`:

```js
if (cmd === 'what' || cmd.startsWith('what ')) {
  const q = raw.slice(1).replace(/^what\s*/i, '').trim();
  if (!q) { renderLexiconTopics(); return; }        // bare /what → topic list
  renderLexiconAnswer(q);                            // hit / candidates / miss lines
  return;
}
```

`renderLexiconAnswer` and `renderLexiconTopics` live in `src/game/views.js`
(they are read-only screens — that file's exact charter). Update
`meta.helpList` (both bundles) to include `/what`.

**(b) Natural questions** — the same intercept, before the LLM ever runs.
At each of the **three** loop sites that already do
`if (raw.startsWith('/')) { await handleMeta(raw); continue; }`
(settlement loop, travel-encounter loop, dungeon play loop — grep that
exact line in `flow.js`; there are three), insert directly below it:

```js
if (tryLexicon(raw)) continue;    // free action: answered from stored knowledge
```

`tryLexicon(raw)` (in `views.js`, exported): match `raw` against the
pattern table `tRaw('lexicon.patterns')` — en:
`["what is|what's|whats|who is|who's|where is|tell me about|explain"]`-style
prefix regexes built from the array; nl: `["wat is|wie is|waar is|vertel me over|leg uit"]`.
On a pattern match, extract the remainder as the query and run
`lookupLexicon`:

- **hit** → `UI.appendEntry('player', '> ' + raw)` then the entry lines;
  return `true`;
- **candidates** → echo + `lexicon.ambiguous` line listing them; return
  `true`;
- **miss** → return **`false`** — the input flows on into the normal turn.

That last rule is the boundary decision, stated once and binding: *a
question the index cannot answer is a normal turn.* The narrator may answer
diegetically (an NPC shrugs; the GM describes what the character would
plausibly recall) and it costs a turn like it does today. The lexicon never
answers "I don't know" to a pattern-matched question — a `false` here, a
refusal only for `/what` (explicit command deserves an explicit answer).
This keeps false-positive interception at zero: typing "what is that
sound?" mid-dungeon (index miss) still reaches the narrator, who is the
right authority for it.

**(c) Topic chips** — deferred to P2, deliberately. The blocking chip
surface (`UI.pickFrom`) fits wizards, not free lookups, and a persistent
"?" chip row needs UI design the owner should see first. Bare `/what`
covers discovery in v1. (Recorded so the implementer does not invent one.)

**Autoplay note:** the autopilot picks from chips and its own action string;
if it emits "what is X", the intercept answers free and the loop continues —
harmless, but exclude lexicon lines from the 6-entry transcript window
autoplay reads if repetition shows up. Not a v1 requirement; noted.

## 14 · Optional paraphrase — the only model call, off by default

Setting `settings.lexiconParaphrase` (sidebar toggle beside TTS; default
**false**; free tier: hidden). When on, a **hit** answer is restyled:

```js
// src/ai/lexicon-voice.js  (ai/ owns model calls; game/ never imports client.js)
export async function paraphraseLexicon(entry, rendered) {
  return chatCompletion({
    tier: 'tiny', maxTokens: 200,
    messages: [
      { role: 'system', content: t('ai.lexiconPrompt', { voice: voiceBlock('narrator'), language: locale() === 'nl' ? 'Dutch' : 'English' }) },
      { role: 'user', content: rendered.join('\n') },
    ],
    schema: LEXICON_PARAPHRASE_SCHEMA,   // { answer: string } — add to src/ai/schemas.js
  });
}
```

`ai.lexiconPrompt` (new key, both bundles), hard rules in the template:
*"Rewrite the note below in this world's voice. You may reorder and
rephrase. You may NOT add facts, names, numbers, hints, or speculation. If
you cannot comply, return the note unchanged."*

Output discipline: compute the deterministic rendering first, then attempt
the paraphrase with 1 retry and an 8-second deadline; print whichever you
end up with, **once** — never print the deterministic text and then replace
it (one answer, no flicker), and on any throw, timeout, or schema miss the
deterministic rendering is the answer. Hidden/unknown/heard-of classes are
**never** paraphrased — heard-of keeps its honest prefix, refusals stay
templated.

## 15 · i18n keys — the complete list (add to `en.json` + `nl.json`)

```
meta.helpList                     (updated: add /what)
lexicon.entryHeader               "{{name}} — {{kind}}"
lexicon.unknown                   "That name means nothing to you yet."
lexicon.heardOfPrefix             "You only know it from talk: "
lexicon.hiddenMore                "You sense there is more to it than you can tell."
lexicon.ambiguous                 "Which one? {{names}}"
lexicon.topicsHeader              "Things you could ask about:"
lexicon.topicLine                 "  {{name}} — {{kind}}"
lexicon.noTopics                  "Nothing comes to mind. Play on."
lexicon.kind.place / npc / creature / faction / item / quest / chapter / story / rumour / era / legend
lexicon.patterns                  [array of prefix alternatives, per locale]
lexicon.articles                  [array: locale's articles to strip]
settlement.secretBecause          "{{name}} confided it."
newgame.settingQuestion / settingSurprise / settingMissing / themeLine
sidebar.settingLabel
ai.lexiconPrompt                  (paraphrase system template)
ai.defaultSettingNoun             "a fantasy town"
(reserved, unused v1: lexicon.sourceQuest / sourceChapter / sourceMet)
```

`i18n-parity.test.js` picks the array/object ones up automatically once
they exist in both bundles; add `lexicon.kind` and `lexicon.patterns` to
its keyed-table comparison list explicitly (they are exactly the
"entry-for-entry" shape that test exists for).

## 16 · Tests (Part II)

`tests/lexicon.test.js` — real-Spektrum seam style (mirror
`tests/seam-fixes.test.js`: build a store, seed `world.*`, exercise, read
back):

1. encountered NPC with unrevealed secret → entry serves name/role, body
   contains neither `secret` text nor the word from `personality`;
2. after the reveal wiring (`recordCanon` on `secretRevealed`) → the fact
   appears via the ledger path; undo past it → gone (use the undo test
   helpers);
3. item with `description` + hidden property object → description served,
   hidden absent; `hintHidden: true` variant appends `lexicon.hiddenMore`;
4. rumoured geography node → heard-of prefix + hook, never phrased from
   `digest` as known; visited node → digest;
5. unknown term → miss for `tryLexicon` (returns false), refusal for
   `/what`;
6. ambiguity: two entries sharing alias "Salt" → candidates, capped, known
   first;
7. article stripping + possessive + case (`"the Saltmarch's"` →
   Saltmarch), nl articles under `nl` locale;
8. pattern table: every `lexicon.patterns` entry routes; non-question prose
   ("what a day") does NOT false-positive (patterns anchor at start + require
   a remainder);
9. **turn-free invariants:** run `tryLexicon` against a seeded store; assert
   `session.turnCount` unchanged, no new undo mark (whatever
   `clearTurnMarks`/mark inspection the undo tests use), ledger length
   unchanged;
10. body clamp at sentence boundary; header uses `lexicon.kind.*`.

E2E additions to `campaign.spec.js`: after first settlement arrival, type
`what is <regionName>?` → answer appears, thinking indicator never shows,
turn counter DOM unchanged, no narrator mock call recorded; `/what` lists
topics including the current settlement.

Wiring test: `tryLexicon`, `renderLexiconAnswer`, `buildLexiconIndex`
consumed outside their modules.

Budget note: the lexicon adds nothing to any prompt (scope packet
untouched — `scope-budget` pins stay green by construction); the only new
tokens are the opt-in paraphrase call (`maxTokens: 200`).

---

## 17 · Rollout — phases, branches, gates

Ship the lexicon first: it is smaller, it fixes the live-run pain, and S3's
voice work then has a consumer to restyle. Every phase = one feature branch
off the designated integration branch, `npm test` + `node build.js` green
before merge, per the repo workflow.

| Phase | Branch | Contents | Size | Depends on |
|---|---|---|---|---|
| **L1** | `feature/lexicon-core` | `lexicon.js`, views renderers, `/what`, `tryLexicon` intercepts ×3, reveal→`recordCanon` wiring, i18n keys, `tests/lexicon.test.js`, help list | **M** | — |
| **L2** | `feature/lexicon-e2e` | e2e scenario + wiring/parity additions + nl pattern polish | S | L1 |
| **L3** | `feature/lexicon-voice` | paraphrase toggle + `ai/lexicon-voice.js` + schema + prompt key | S | L1 (better after S3) |
| **S1** | `feature/packs-seams` | i18n overlay (§4), `settings/` registry + `pack-classic` extraction, `buildWorldBlueprint(seed, pack)`, classic-identity tests | M | — |
| **S2** | `feature/packs-select` | wizard step, seeded `pickPack`, `world.settingId`, `applyPackOverlay` at all 5 re-entry points, `activePack()` in world.js overlays/domain tables, `skinLabel`, T17 | M | S1 |
| **S3** | `feature/packs-voice` | `voiceBlock`, `{{voice}}` in narrator/dialogue/travel/journal/worldbible templates (both locales), image style from pack, `appConstraints` promptLine | M | S1 |
| **S4** | client `feature/pack-seams` → re-vendor branch | C1 syllables, C2 palette override, client tests, 0.12.0, `vendor-sync`, atlas/worldseed threading | S+S | S1 |
| **S5** | `feature/pack-dark-ages` | the near pack + lint additions | M (content) | S2, S3 |
| **S6** | `feature/pack-neon-stacks` | the far pack per §7.3 checklist | L (content) | S2–S4 |
| **S7** | `feature/packs-e2e` | forced-pack e2e, prompt-capture mock hook, parity extension | M | S5 or S6 |

A later model implementing this may batch L1+L2, or S1+S2, per sitting —
but never merge a phase whose gate is red, and never start S5/S6 content
before the S1 identity tests exist (they are what proves content cannot
break logic).

## 18 · Explicitly out of scope (so nobody "helpfully" bundles them)

- The recorded-but-open live-run findings: `leave`→travel verb trap, Attack
  chip shown with no hostile, worldgen per-call `timeoutMs`, narrator
  repetition on no-effect turns. Separate small fixes; two may land in any
  phase's branch *only* if a test in that branch trips over them.
- Topic chips UI (§13c), pack-localized voice blocks, EPUB cover styles per
  pack (row 12), cartridge `settingId` (§8 note), MCP world-pack surface
  alignment, mid-campaign pack switching (refused by design, §3).
- New mechanics per theme (cyber-implants ≠ new rules; they are spell/item
  *skins* until the owner asks otherwise).

## 19 · Guardrails for the implementing model

House rules that have each eaten a session before; violating any of them is
a red flag in review:

1. **Spektrum reads are pre-tick.** `setValue` defers until `tick()`. Never
   derive an append index from a just-written array's visible length
   (`makeAppendCursor` in `src/core/utils.js` exists for this); never
   re-read `appState.X` in a loop that also writes `X` (accumulate, write
   once); never write the same top-level path twice in one turn from two
   sources.
2. **Never hand-patch `vendor/`.** Client changes go to the sibling repo
   `../bag-of-holding-client`, get their own tests + version bump, then
   `node scripts/vendor-sync.js` and commit the manifest.
3. **Every i18n content table lands in BOTH bundles** or the parity test
   will (correctly) fail. Pack overlays follow §4's pack-en⊃pack-nl rule.
4. **Zero runtime deps, no CDN, no `package-lock.json` in the client repo.**
5. Gates per merge: `npm test`, `node build.js`, rebuilt
   `vendor/app.bundle.js` + version stamp in the commit (repo workflow at
   the top of `CLAUDE.md`).
6. **`gmOnly` never crosses.** No lexicon field, no pack prompt, no test
   fixture may move `secret`/directive material into player-visible output.
   When in doubt, the answer is the refusal line.
7. **Scope-budget pins stay green by construction** — do not "just raise
   the budget" to fit a voice block; §6's ≤120-token lint is the ceiling.
8. **Legal/PI:** no published-setting names (the `blueprint.js` god-table
   precedent), fictional-analog treatment per §7.4.

---

## 20 · Implementation record

Written after the fact, from the branch that shipped it. Where this section
and the design above disagree, this section is what the code does.

### What changed from the plan, and why

**1. The lexicon takes its sources injected** (§12 specified
`buildLexiconIndex()` reading `appState`). `src/game/lexicon.js` is pure:
`buildLexiconIndex(sources, i18n)`. The plan's signature would have made the
module untestable for the same three reasons `preClassify` takes `{ t, locale }`
— `state.js` imports the `spektrum` alias, `i18n.js` reads `localStorage` at
import time, and `bag-of-holding-client` is an esbuild alias the node runner
cannot resolve. `src/game/views.js` is the binding half and gathers the eleven
sources; the ledger needed one new export (`allEntities`) because `foldAll`
requires a prefix and the dictionary spans the whole world.

**2. Table merging belongs to the library, not the game** (§5 T1, §9). The
plan had the game deep-merge `pack.tables` over `DEFAULT_TABLES` — which the
library did not export. Worse, `buildBlueprint(seed, { tables })` was
**all-or-nothing**: a host replacing only `dungeonThemes` (the normal shape of
a genre re-skin) left `tables.tones` undefined and the factory threw inside
`pick()`. Fixed where it belonged: bag-of-holding-client 0.12.0 exports
`DEFAULT_TABLES` and `mergeTables`, applies the merge inside both
`buildBlueprint` and `deriveBlueprint`, and returns the defaults by identity
for an absent override — so every existing caller rolls byte-identically. The
game now passes `pack.tables` straight through.

**3. The empty-palette starvation** (not in the plan). `THEME_CLIMATES` and
`BAND_SETTLEMENTS` became overridable as designed (C2), but a pack whose
`themeClimates` leaves a band unclaimed produced an EMPTY `dungeonThemePalette`,
which reaches the region tier as `pick([])` → `undefined`: a dungeon with no
theme. The library now falls back to the full theme list for an unclaimed band
— a worse fit and a working dungeon, which is the right trade.

**4. The lexicon surfaces are async.** `tryLexicon` and `renderLexiconAnswer`
return promises so the optional paraphrase (§14) can await a call. The three
loop sites became `if (await tryLexicon(raw)) continue;`. The free action is
still free by construction — the await resolves immediately when the toggle is
off, which is the default and the only state the classic pack can be in.

**5. `/dictionary`, not a sidebar toggle** (§14). The chrome toggles are icon
buttons in `index.html` with a DOM contract test behind them; a meta command is
this game's established settings surface for text-first options, costs no
markup, and is discoverable through `/help`. Same setting
(`settings.lexiconParaphrase`), same default (off).

**6. A new lint rule: unskinned reachable creatures** (§9). Travel encounters
(`OVERWORLD_ENEMY_IDS`) and the no-overlay fallback (`DEFAULT_ENEMY_IDS`) are
reached WITHOUT consulting a dungeon overlay, so a pack that renames its own
themes' creatures still meets a "Wolf" on the ferry crossing. The lint now
fails a pack that renames any creature and leaves those pools alone. It caught
five in neon-stacks.

**7. §1 row 10 was wrong about bosses.** The inventory claimed
`world.enemyNames[id]` overrides `BESTIARY[id].name`. True for ordinary
enemies; false for the vault boss. `bossBlockFor` built its name from the SRD
block and the dungeon generator applies a block's `name` over the content
provider's, so four rooms of "Sump Rat" ended in "Elite Giant Rat". The skin
now goes in *before* the template, which composes the tier title from it
("Elite Downdraught"). This was a pre-existing defect in classic too.

**8. §1 missed the region frontier.** The inventory listed the skeleton's
syllable banks (row 3) but not `atlas.js`'s own `neighbourName`/`neighbourHook`,
which mint the region stubs — so the layers above the region wore the pack's
names while the frontier kept promising "Saltfen" and "bells heard at odd
hours" in a city with no bells. That is the layer a player reads *most*, since
it names everywhere they have not been. Both now come from the pack, and packs
gained an optional `frontierHooks` field.

**9. The vendored client was eight versions stale** (not in the plan at all).
`vendor/bag-of-holding-client` was pinned at 0.3.0 while the library was at
0.11.0, so none of the client-side fixes had reached the shipped game. The
re-vendor to 0.12.0 brought them in and surfaced one stale fixture:
`blueprint-context.test.js` still described god domains as
`{ domain, exemplars: ['Kelemvor', 'Myrkul'] }` — the shape the library retired
when it replaced named deities with epithets to keep Product Identity out of
prompts. Worth a standing habit: re-vendor when the library moves, not when a
feature needs it.

### Two contracts the base bundle hides

Both were found by writing packs against it, and both are now linted.

**`world.houseStyles` entries must be bare noun phrases.** The style is
substituted into three different frames — *"the entrance hall of a {{style}}"*,
*"The foyer of this {{style}} greets you"*, *"the threshold of the {{style}}"* —
so it supplies no article of its own and cannot be a clause. The base's six
entries are all 2–3 word phrases, which hides the constraint entirely; the
instinct when writing evocative content is `a garden that outlived its
gardeners`, which renders as *"the entrance hall of a a garden that outlived
its gardeners"*.

**Syllable banks need real depth.** The skeleton deals five prefixes and five
suffixes per continent, so a four-entry bank yields sixteen possible province
names for a whole landmass. §2's floors (8 / 8 / 10 / 10) are now what the lint
enforces; it used to accept four.

### Where things live

| Concern | File |
|---|---|
| Dictionary index, matching, rendering (pure) | `src/game/lexicon.js` |
| Its binding to live state + the three surfaces | `src/game/views.js` |
| Optional paraphrase | `src/ai/lexicon-voice.js` |
| Locale resolution order (pure) | `src/i18n/resolve.js` |
| Registry, seeded draw, lint | `src/settings/packs.js` |
| Active pack, overlay install, label skins | `src/settings/index.js` |
| Voice block, setting noun, image style | `src/settings/voice.js` |
| The packs | `src/settings/pack-{classic,dark-ages,neon-stacks}.js` |
| Author's lint runner | `scripts/lint-pack.js` |
| Tests | `tests/{lexicon,setting-packs,i18n-overlay}.test.js`, `tests/e2e/campaign.spec.js` |

### Still open

- **Topic chips** (§13c) — deferred by design; bare `/what` covers discovery.
- **Pack-localised voice blocks** — `voice.register` and the examples are
  written in English for both locales, as §6 specified.
- **EPUB cover styles per pack** (§1 row 12) and **cartridge `settingId`**
  (§8) — untouched, as scoped.
- The recorded-but-open live-run findings of §18 (`leave`→travel verb trap,
  Attack chip with no hostile, worldgen per-call `timeoutMs`, narrator
  repetition) are still open: none of them tripped a test on this branch.
