// Public surface for `@zeeuw/bag-of-holding`.
//
// Two ways to consume:
//
//   1. Default singleton — convenient for the common single-engine
//      case. Namespaces are spread as named exports.
//
//      import { Combat, Conditions, SRD } from '@zeeuw/bag-of-holding';
//      Combat.applyMastery(weapon, target, attackResult);
//
//   2. Custom engine — when you want to mix in plugin content
//      (homebrew species, custom masteries, additional conditions),
//      seed the RNG for replay-determinism, or run multiple isolated
//      rule sets on the same page.
//
//      import { createEngine, Dice } from '@zeeuw/bag-of-holding';
//      const engine = createEngine({
//        rng: Dice.seededRng(42),
//        extraSpecies: { 'half-elf': ... }
//      });
//      engine.Combat.applyMastery(weapon, target, attackResult);
//      engine.rollLog;          // audit trail
//      engine.verifyLog({ seed: 42, log });
//
// The two share the same shape — the default singleton is just
// `createEngine()` with no options.

import * as Classes from './src/classes/index.js';
import * as CharacterModule from './src/character.js';
import { createEngine, HOOK_EVENTS } from './src/engine.js';
import { verifyLog } from './src/replay.js';
import { STARTER_PARTY } from './src/solo/starter.js';

export { createEngine, verifyLog, HOOK_EVENTS, STARTER_PARTY };

const _default = createEngine();
export default _default;

export const {
  Dice, Checks, Combat, Conditions, XP, Movesets, Beats, Spellcasting, Rest, Mechanics, SceneClock, MagicItems, Monsters, Movement, Multiclass, Inspiration, EncounterDesign, Hazards, Equipment, Travel, MountedCombat, VariantCombat, VariantRest, VariantEncounter,
  Solo, Session, Replay,
  species, classes, backgrounds, feats, spells, items, monsters,
  regions, npcs, storyHooks, adventures
} = _default;

// Monster templates — derive higher-tier stat blocks (Elite / Champion /
// Ancient) from verified SRD entries, so a campaign can reach CR 16-24 and give
// the monster-mechanics module (multiattack, legendary actions and resistance)
// something to consume, without transcribing stat blocks from memory.
export { elevate, tiersFor, templateForTargetCr, TEMPLATES } from './src/monster-templates.js';

// Adventures (2.6.0) — the pack format (validateAdventure + run glue) and
// The Quiet Stair, the starter adventure shipped inside the package. The
// content packs are deliberately NOT merged into the default engine: mount
// them at construction — `createEngine({ extraMonsters:
// QUIET_STAIR_MONSTERS, extraItems: QUIET_STAIR_ITEMS })` — so the SRD
// registries stay SRD-only.
import * as AdventuresModule from './src/adventures/index.js';
export const Adventures = Object.freeze({ ...AdventuresModule });
export { QUIET_STAIR, QUIET_STAIR_MONSTERS, QUIET_STAIR_ITEMS, QUIET_STAIR_NPCS } from './src/adventures/index.js';

// Bestiary I (2.7.0) — 50 invented creatures, CR 0–5, across the common
// ecology niches. Mount via `createEngine({ extraMonsters: BESTIARY_I })`
// (composable with the adventure packs: spread them into one map). The SRD
// registry stays SRD-only.
export { BESTIARY_I } from './src/bestiary/bestiary-i.js';
// Bestiary II (2.8.0) — 30 boss-tier opponents, CR 6–15, the first AUTHORED
// data with Legendary Actions, Lair Actions and Innate Spellcasting.
export { BESTIARY_II } from './src/bestiary/bestiary-ii.js';
// Bestiary III (2.9.0) — 10 capstone monsters, CR 16–20, with Legendary
// Resistance pools, Mythic Actions (whose consumer lands with this batch)
// and Innate Spellcasting at levels 6+.
export { BESTIARY_III } from './src/bestiary/bestiary-iii.js';

// Grimoire I (2.10.0) — 50 invented spells, cantrips through 5th, filling
// the tactical roles the SRD selection left thin (reaction casts,
// cylinder/line save-for-half AoEs, concentration buffs, single-target
// debuffs). First shipped data carrying 1.8's `upcast(castLevel)` deltas.
// Mount via `createEngine({ extraSpells: GRIMOIRE_I })`.
export { GRIMOIRE_I } from './src/grimoire/grimoire-i.js';
// Grimoire II (2.11.0) — 30 invented spells, 6th through 9th: city-sized
// AoEs, plane-shifting alternatives, complex multi-target control, so
// tier-3/4 spellcasters have a real list. Composable with Grimoire I.
export { GRIMOIRE_II } from './src/grimoire/grimoire-ii.js';

// The Treasury (2.12.0) — 40 invented magic items across all six rarity
// bands, demonstrating every 1.9 mechanic: charges on all four recharge
// schedules, all three attunement-prereq kinds, cursed items, item saving
// throws, and sentient blocks as host data. Mount via
// `createEngine({ extraItems: TREASURY })`.
export { TREASURY } from './src/treasury/treasury.js';

// The Origin pack (2.13.0) — 5 invented species, 8 backgrounds, 12 feats,
// back-filling the 1.13 deferral. Every species exercises a trait
// mechanic the sheet deriver consumes (darkvision / resistance / movement
// mode / racial cantrip). Mount via `createEngine({ extraSpecies:
// ORIGIN_SPECIES, extraBackgrounds: ORIGIN_BACKGROUNDS, extraFeats:
// ORIGIN_FEATS })`.
export { ORIGIN_SPECIES, ORIGIN_BACKGROUNDS, ORIGIN_FEATS } from './src/origins/origins.js';

// Sundermark (3.0.0) — the first complete setting pack: 6 regions, 10
// cities, 15 factions, 13 story hooks, 12 named NPCs, the Vesperin
// species, 3 backgrounds, 5 feats and 2 starter adventures, mounted via
// the 3.0.0 setting slots (extraRegions / extraNpcs / extraStoryHooks /
// extraAdventures) plus the Phase-A content slots. The kernel's default
// registries stay empty — no setting is ever on by default.
export {
  SUNDERMARK,
  SUNDERMARK_REGIONS, SUNDERMARK_CITIES, SUNDERMARK_FACTIONS, SUNDERMARK_HOOKS,
  SUNDERMARK_NPCS, SUNDERMARK_SPECIES, SUNDERMARK_BACKGROUNDS, SUNDERMARK_FEATS,
  THE_SINGING_TOWER, HALBERDS_EDGE, SUNDERMARK_ADVENTURES,
} from './src/settings/sundermark/index.js';

// Brassgear (3.1.0) — the second setting pack: magitech-noir, THE MAGIC
// IS DYING. 5 city-state regions, 5 factions, 10 noir hooks, the
// inherited-talent system, the Cogborn, and the Tinker — an artificer-
// equivalent shipped as a Phase A.2 class graft, not a new class.
// Setting packs are also importable as subpaths
// (`@zeeuw/bag-of-holding/settings/brassgear`) so bundlers that don't
// tree-shake still get the kernel lean; measure-bundle now tracks the
// settings track under its own budget.
export {
  BRASSGEAR,
  BRASSGEAR_REGIONS, BRASSGEAR_CITIES, BRASSGEAR_FACTIONS, BRASSGEAR_HOOKS,
  BRASSGEAR_NPCS, BRASSGEAR_TALENTS, BRASSGEAR_TINKER,
  BRASSGEAR_SPECIES, BRASSGEAR_BACKGROUNDS, BRASSGEAR_FEATS,
  THE_GREENMIST_HEIST, BRASSGEAR_ADVENTURES,
} from './src/settings/brassgear/index.js';

// The Hollow Vale (3.2.0) — the third setting pack: gothic horror in
// one small valley. 8 domains whose Darklords are people with tragedies
// and DOORS OUT (every domain can end without a stake through anyone's
// heart); the dread track rides VariantEncounter's custom-track
// machinery, light-as-resource is the pure burnLight helper, and dream
// sequences are ordinary beats flagged `dream: true`.
export {
  HOLLOW_VALE,
  HOLLOW_VALE_REGIONS, HOLLOW_VALE_CITIES, HOLLOW_VALE_FACTIONS,
  HOLLOW_VALE_HOOKS, HOLLOW_VALE_NPCS, HOLLOW_VALE_DREAD, burnLight,
  BRAMBLEFELL, HOLLOW_VALE_ADVENTURES,
} from './src/settings/hollow-vale/index.js';

// The setting plugin contract (3.3.0) — formalises the pack shape the
// three shipped settings established ad-hoc. `Settings.validate` reports,
// `Settings.register` gates (throws the full report), and
// `Settings.compose(...packs)` merges N packs into ONE createEngine
// options object for crossover play, refusing cross-pack id collisions:
//   createEngine(Settings.compose(SUNDERMARK, HOLLOW_VALE))
import {
  validateSettingPack, registerSetting, composeSettings,
} from './src/settings/contract.js';
export const Settings = Object.freeze({
  validate: validateSettingPack,
  register: registerSetting,
  compose: composeSettings,
});

// Localization (3.4.0) — `Strings.t(key, lang)` over the rules
// vocabulary (conditions, classes, species, abilities, action verbs,
// rarities, rests). The kernel stays English by default; locale packs
// are plugins: `createEngine({ extraLocales: { nl: {...} } })` binds a
// per-engine surface, and this module-level export is the English-only
// shim for engine-less callers. `DEFAULT_STRINGS` is the complete key
// table (asserted complete against the live registries in CI).
import { makeStrings } from './src/strings.js';
export { makeStrings, DEFAULT_STRINGS } from './src/strings.js';
export const Strings = makeStrings({});

// Reference cards (3.5.0) — printable reference material as PURE DATA
// (the 4.3.0 roadmap row): one Card shape across spell/item/monster/
// class cards and the combat cheat-sheet, so a host writes ONE layout
// pass. The cheat-sheet reads the LIVE rules — a gritty engine prints
// a gritty sheet.
import * as CardsModule from './src/cards.js';
export const Cards = Object.freeze({ ...CardsModule });

// The plugin manifest format (3.6.0) — `bag-of-holding.json`, the file
// a third-party content pack publishes beside its code so loaders and
// catalogs can reason about it WITHOUT executing it: identity, the
// kernel range it was built against, and which plugin tables it
// contributes. `Manifest.matches(manifest, kernelVersion)` is the
// loader's red/green.
import {
  MANIFEST_VERSION, MANIFEST_TABLES,
  validateManifest, kernelSatisfies, manifestMatches,
} from './src/manifest.js';
export const Manifest = Object.freeze({
  VERSION: MANIFEST_VERSION,
  TABLES: MANIFEST_TABLES,
  validate: validateManifest,
  satisfies: kernelSatisfies,
  matches: manifestMatches,
});

// Conversion tools (3.7.0) — third-party SRD-JSON importers (snake_case
// fields, textual CRs, prose dice) that emit kernel records WITH a
// guess report; the character-migration seam (ledger empty by design —
// no breaking record change has shipped); and save-snapshot
// re-validation that reports unknown fields instead of dropping them.
import * as ConvertModule from './src/convert.js';
export const Convert = Object.freeze({ ...ConvertModule });

// Character — exposed as a namespace so module-level callers can
// derive sheets without going through the default singleton:
//   import { Character, createEngine } from '@zeeuw/bag-of-holding';
//   Character.deriveSheet(record, createEngine());
// The default singleton's `deriveSheet` also re-exports below for the
// common case ("just give me the sheet").
export const Character = Object.freeze({
  deriveSheet: CharacterModule.deriveSheet,
  SKILL_ABILITY: CharacterModule.SKILL_ABILITY,
  encumbranceLevel: CharacterModule.encumbranceLevel
});

// Back-compat `SRD` namespace: groups the data registries the way
// pre-Phase-A consumers imported them. New code can read the
// registries directly off the default export or an engine instance.
export const SRD = Object.freeze({ species, classes, backgrounds, feats, spells, items, monsters });

// Which classes may learn which spells — the half of the SRD spell data the
// records themselves never carried. A host offering a player their real spell
// list had to invent one from school and level, which gets a wizard casting
// Cure Wounds.
export {
  CASTER_CLASSES, classesFor, isOnClassList, spellsFor, maxSpellLevel,
} from './src/srd/spell-lists.js';

// `Classes` was historically exported as the class-definition map.
// Kept for compatibility — same content as `_default.classes`, just
// under the old name.
export { Classes };
