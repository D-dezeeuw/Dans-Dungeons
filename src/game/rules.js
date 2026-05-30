// src/game/rules.js
//
// Thin re-export shim for bag-of-holding.
// All app code imports from here, never directly across repos.
//
//   Dev:     import map → /2026n/bag-of-holding/index.js
//   Release: import map → pinned unpkg URL (swap in index.html)

export {
  Dice,
  Checks,
  Combat,
  Conditions,
  XP,
  Character,
  SRD,
  Monsters,
  createEngine,
} from 'bag-of-holding';
