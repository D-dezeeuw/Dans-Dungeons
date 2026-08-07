// src/game/rules.js
//
// Thin re-export shim for bag-of-holding.
// All app code imports from here, never directly across repos.
//
// The bare specifier is resolved by build.js's esbuild alias to the vendored
// copy under vendor/bag-of-holding (kept in sync, and manifest-checked, by
// scripts/vendor-sync.js). Nothing is loaded from a CDN.

export {
  Dice,
  Checks,
  Combat,
  Conditions,
  XP,
  EncounterDesign,
  Character,
  SRD,
  Monsters,
  elevate,
  templateForTargetCr,
  Beats,
  createEngine,
  verifyLog,
} from 'bag-of-holding';
