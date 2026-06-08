// src/game/rng.js — epoch-seeded, replayable combat dice stream + audit log.
//
// Combat dice live IN appState so time-travel rewinds them with everything else:
//   session.rng     = { seed, cursor }   Mulberry32 seed + cumulative draws this epoch
//   session.rollLog = [ verifyLog entries ]   complete-from-cursor-0 audit trail
//
// Because both are recorded Spektrum state, an undo restores the exact RNG
// position — so re-issuing the same action reproduces the same dice, while a
// *different* action consumes the stream differently and diverges. Dice become a
// deterministic function of the choice sequence, and the log stays reproducible
// from the seed (the engine's verifyLog() confirms it).
//
// A turn's rolls go through a "roller": resolver.js calls roller.attack/damage/
// check/deathSave instead of Combat.* directly, so the roller can thread the
// epoch RNG and record one verifyLog-shaped entry per roll. commitRoller() then
// advances the stored cursor by exactly the draws consumed and appends the
// entries. The default roller (no active stream) falls back to Math.random and
// logs nothing, so non-combat contexts and direct unit tests are unaffected.

import { appState, setValue } from '../core/state.js';
import { Dice, createEngine, verifyLog } from './rules.js';

// ─── Epoch seeding ─────────────────────────────────────────────────────────────

// Begin a fresh combat stream for an epoch (called on dungeon entry). Resets the
// cursor and the audit log so the log is self-contained and verifiable from the
// seed. `seed` is coerced to a uint32; null clears the stream (Math.random).
export function seedCombat(seed) {
  setValue('session.rng', seed == null ? null : { seed: seed >>> 0, cursor: 0 });
  setValue('session.rollLog', []);
}

// ─── Counted RNG ───────────────────────────────────────────────────────────────

// A Mulberry32 stream positioned at `cursor` draws past `seed`, counting every
// draw so the caller can advance the stored cursor afterwards. Skipping to the
// cursor (rather than caching internal state) keeps us decoupled from the PRNG's
// internals — only `seededRng(seed)` determinism is assumed, and the skip is
// O(cursor), bounded by one epoch's worth of rolls.
function countedRng(seed, cursor) {
  const base = Dice.seededRng(seed >>> 0);
  for (let i = 0; i < cursor; i++) base();   // fast-forward to the live position
  let draws = 0;
  const fn = () => { draws++; return base(); };
  fn.draws = () => draws;
  return fn;
}

// ─── Roller ─────────────────────────────────────────────────────────────────────

// Build the roller for one turn from the stored stream. With no active stream it
// returns the plain (Math.random) roller. Resolver code is identical either way.
//
// IMPORTANT: the library's `Combat`/`Checks` namespaces are bound to the default
// engine instance, so a per-call `rng` argument is ignored (it lands as the
// engine's `context`). The only way to inject a seeded RNG is to roll through an
// engine created WITH that rng — hence the per-turn engine here. A fresh engine
// positioned at the stored cursor (via countedRng) makes the stream restart from
// exactly the rewound point on a branch, which is what gives time-travel its
// reproducibility.
export function beginRoller() {
  const s = appState.session?.rng;
  if (!s || s.seed == null) return plainRoller();
  const rng    = countedRng(s.seed, s.cursor);
  const engine = createEngine({ rng, logRolls: true });
  return roller(engine, rng);
}

// Plain roller: an unseeded (Math.random) engine, no audit. Used outside a seeded
// epoch and as the resolver's default so existing unit tests are unchanged.
export function plainRoller() {
  return roller(createEngine(), null);
}

// One roller over an engine. Each method rolls through the engine (so the seeded
// rng + SRD mechanics apply) and records one verifyLog-replayable entry in draw
// order — but only when a seeded stream is active (`rng` set). The engine's own
// rollLog isn't reused because it tags death saves with a `deathSave` op that
// verifyLog can't replay; encoding the save as its single `rollDie(20)` keeps the
// whole log verifiable.
function roller(engine, rng) {
  const log = [];
  const seeded = rng != null;
  return {
    seeded,
    log,
    attack(opts) {
      const r = engine.Combat.attackRoll(opts);
      if (seeded) log.push({ op: 'attackRoll', attackBonus: opts.attackBonus, ac: opts.ac, stance: 'normal', d20: r.d20, hit: r.hit });
      return r;
    },
    damage(opts) {
      const r = engine.Combat.damageRoll(opts);
      if (seeded) log.push({ op: 'damageRoll', damageDice: opts.damageDice, damageMod: opts.damageMod ?? 0, baseRolls: r.baseRolls, critRolls: r.critRolls });
      return r;
    },
    check(opts) {
      const r = engine.Checks.abilityCheck(opts);
      if (seeded) log.push({ op: 'abilityCheck', abilityScore: opts.abilityScore, proficient: opts.proficient ?? false, proficiencyBonus: opts.proficiencyBonus ?? 2, dc: opts.dc, d20: r.d20, success: r.success });
      return r;
    },
    deathSave(actor) {
      const r = engine.Combat.deathSave(actor);
      if (seeded && r.outcome !== 'noop') log.push({ op: 'rollDie', sides: 20, value: r.d20 });
      return r;
    },
    draws: () => (rng ? rng.draws() : 0),
  };
}

// ─── Commit ──────────────────────────────────────────────────────────────────────

// Persist a turn's rolls: advance the stored cursor by the draws consumed and
// append the audit entries. No-op for the plain roller (nothing drawn, nothing
// logged), so it's safe to call unconditionally after every turn.
export function commitRoller(roller) {
  if (!roller?.seeded || !roller.draws()) return;
  const s = appState.session.rng;
  setValue('session.rng', { seed: s.seed, cursor: s.cursor + roller.draws() });
  setValue('session.rollLog', [...(appState.session.rollLog ?? []), ...roller.log]);
}

// ─── Audit ───────────────────────────────────────────────────────────────────────

// Replay the recorded log against the seed and confirm every roll reproduces.
// Returns the engine's { ok, divergedAt?, expected?, actual? }, or { ok: true }
// when no seeded stream is active.
export function verifyCombatLog() {
  const s = appState.session?.rng;
  if (!s || s.seed == null) return { ok: true };
  return verifyLog({ seed: s.seed, log: appState.session.rollLog ?? [] });
}
