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
  Dice, Checks, Combat, Conditions, XP, Movesets, Beats, Spellcasting, Rest, Mechanics, SceneClock, MagicItems, Monsters, Movement, Multiclass, Inspiration, EncounterDesign, Hazards, Equipment, Travel, MountedCombat,
  Solo, Session, Replay,
  species, classes, backgrounds, feats, spells, items, monsters
} = _default;

// Monster templates — derive higher-tier stat blocks (Elite / Champion /
// Ancient) from verified SRD entries, so a campaign can reach CR 16-24 and give
// the monster-mechanics module (multiattack, legendary actions and resistance)
// something to consume, without transcribing stat blocks from memory.
export { elevate, tiersFor, templateForTargetCr, TEMPLATES } from './src/monster-templates.js';

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
