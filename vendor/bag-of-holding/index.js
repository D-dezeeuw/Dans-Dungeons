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

export { createEngine, verifyLog, HOOK_EVENTS };

const _default = createEngine();
export default _default;

export const {
  Dice, Checks, Combat, Conditions, XP, Movesets, Beats, Spellcasting, Rest, Mechanics, SceneClock, MagicItems, Monsters, Movement, Multiclass, Inspiration, EncounterDesign,
  species, classes, backgrounds, feats, spells, items, monsters
} = _default;

// Character — exposed as a namespace so module-level callers can
// derive sheets without going through the default singleton:
//   import { Character, createEngine } from '@zeeuw/bag-of-holding';
//   Character.deriveSheet(record, createEngine());
// The default singleton's `deriveSheet` also re-exports below for the
// common case ("just give me the sheet").
export const Character = Object.freeze({
  deriveSheet: CharacterModule.deriveSheet,
  SKILL_ABILITY: CharacterModule.SKILL_ABILITY
});

// Back-compat `SRD` namespace: groups the data registries the way
// pre-Phase-A consumers imported them. New code can read the
// registries directly off the default export or an engine instance.
export const SRD = Object.freeze({ species, classes, backgrounds, feats, spells, items, monsters });

// `Classes` was historically exported as the class-definition map.
// Kept for compatibility — same content as `_default.classes`, just
// under the old name.
export { Classes };
