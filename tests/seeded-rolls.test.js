import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Phase 5 — epoch-seeded combat dice + audit. src/game/rng.js stores the RNG
// position in appState (so time-travel rewinds it) and records a verifyLog-shaped
// roll log. The module imports the Spektrum singleton, so — per the repo's
// mirror-testing convention (timetravel.test.js) — we pin the underlying contract
// here against the SHIPPING vendored engine, not a hand-rolled stand-in.
//
// The library's Combat/Checks are bound to the default engine, so a seeded RNG
// can only be injected by rolling through an engine created WITH it. That is
// exactly what rng.js does and what this mirror reproduces.
import { createEngine, Combat, Dice, verifyLog } from '../vendor/bag-of-holding/index.js';

// Mirror of rng.js: a Mulberry32 stream fast-forwarded to a cursor (so it is
// reconstructable from { seed, cursor } alone), counting every draw.
function countedRng(seed, cursor) {
  const base = Dice.seededRng(seed >>> 0);
  for (let i = 0; i < cursor; i++) base();
  let draws = 0;
  const fn = () => { draws++; return base(); };
  fn.draws = () => draws;
  return fn;
}

// Mirror of rng.js's roller: rolls through a seeded engine and records one
// verifyLog-replayable entry per roll (death saves encoded as their single d20).
function makeRoller(seed, cursor) {
  const rng = countedRng(seed, cursor);
  const engine = createEngine({ rng, logRolls: true });
  const log = [];
  return {
    log,
    attack(o)    { const r = engine.Combat.attackRoll(o);   log.push({ op: 'attackRoll', attackBonus: o.attackBonus, ac: o.ac, stance: 'normal', d20: r.d20, hit: r.hit }); return r; },
    damage(o)    { const r = engine.Combat.damageRoll(o);   log.push({ op: 'damageRoll', damageDice: o.damageDice, damageMod: o.damageMod ?? 0, baseRolls: r.baseRolls, critRolls: r.critRolls }); return r; },
    check(o)     { const r = engine.Checks.abilityCheck(o); log.push({ op: 'abilityCheck', abilityScore: o.abilityScore, proficient: o.proficient ?? false, proficiencyBonus: o.proficiencyBonus ?? 2, dc: o.dc, d20: r.d20, success: r.success }); return r; },
    deathSave(a) { const r = engine.Combat.deathSave(a);    if (r.outcome !== 'noop') log.push({ op: 'rollDie', sides: 20, value: r.d20 }); return r; },
    draws: () => rng.draws(),
  };
}

describe('seeded combat rolls — determinism + verifyLog audit (Phase 5)', () => {
  function mixedRun(seed) {
    const r = makeRoller(seed, 0);
    const atk = r.attack({ attackBonus: 5, ac: 14 });
    if (atk.hit) r.damage({ damageDice: '1d8', damageMod: 3, critical: atk.critical });
    r.check({ abilityScore: 14, proficient: true, proficiencyBonus: 2, dc: 12 });
    r.deathSave({ deathSaves: Combat.freshDeathSaves() });
    return r.log;
  }

  it('same seed + same actions → identical rolls, and verifyLog confirms them', () => {
    const a = mixedRun(12345);
    const b = mixedRun(12345);
    assert.deepEqual(a, b);                                       // deterministic
    assert.equal(verifyLog({ seed: 12345, log: a }).ok, true);   // every roll replays from the seed
  });

  it('verifyLog fails on the wrong seed (the log is not reproducible from it)', () => {
    const r = makeRoller(999, 0);
    const atk = r.attack({ attackBonus: 4, ac: 12 });
    r.damage({ damageDice: '2d6', damageMod: 2, critical: atk.critical });
    assert.equal(verifyLog({ seed: 999,  log: r.log }).ok, true);
    assert.equal(verifyLog({ seed: 1000, log: r.log }).ok, false);
  });

  it('verifyLog catches a tampered roll log', () => {
    const r = makeRoller(77, 0);
    r.attack({ attackBonus: 2, ac: 13 });
    r.damage({ damageDice: '1d8', damageMod: 1, critical: false });
    assert.equal(verifyLog({ seed: 77, log: r.log }).ok, true);
    const tampered = r.log.map((e, i) => i === 0 ? { ...e, d20: (e.d20 % 20) + 1 } : e);
    assert.equal(verifyLog({ seed: 77, log: tampered }).ok, false);   // d20 no longer matches the seed
  });

  it('logs a death save as a replayable rollDie(20)', () => {
    const r = makeRoller(31415, 0);
    r.deathSave({ deathSaves: Combat.freshDeathSaves() });
    assert.equal(r.log.length, 1);
    assert.equal(r.log[0].op, 'rollDie');
    assert.equal(verifyLog({ seed: 31415, log: r.log }).ok, true);
  });
});

describe('seeded combat rolls — cursor resume + time-travel (Phase 5)', () => {
  it('a stream resumed at a cursor continues identically to one run straight through', () => {
    const rngC = countedRng(7, 0);
    const ec = createEngine({ rng: rngC, logRolls: true });
    ec.Combat.attackRoll({ attackBonus: 0, ac: 10 });
    ec.Combat.attackRoll({ attackBonus: 0, ac: 10 });
    const cursorAfter2 = rngC.draws();                            // 2 d20 draws consumed
    const s3 = ec.Combat.attackRoll({ attackBonus: 0, ac: 10 });

    const rngR = countedRng(7, cursorAfter2);                    // rebuilt from { seed, cursor }
    const er = createEngine({ rng: rngR, logRolls: true });
    const r3 = er.Combat.attackRoll({ attackBonus: 0, ac: 10 });
    assert.equal(r3.d20, s3.d20);                                // resume == straight-through
  });

  it('after a rewind the divergence slot is shared, but the choice drives what the stream consumes', () => {
    const seed = 4242, base = 5;   // pretend we have undone back to cursor 5

    const ra = makeRoller(seed, base);            // choice A: landing attack + damage → ≥2 draws
    const a = ra.attack({ attackBonus: 20, ac: 1 });
    ra.damage({ damageDice: '1d6', damageMod: 0, critical: false });

    const rb = makeRoller(seed, base);            // choice B from the SAME point: a skill check → 1 draw
    const b = rb.check({ abilityScore: 12, proficient: false, dc: 10 });

    assert.equal(a.d20, b.d20);                   // first draw at the divergence point is the same slot…
    assert.equal(ra.draws(), 2);
    assert.equal(rb.draws(), 1);
    assert.notEqual(ra.draws(), rb.draws());      // …but the choice determines the stream's next position
  });

  it('re-issuing the exact same action after a rewind reproduces the roll', () => {
    const seed = 4242, base = 5;
    const first = createEngine({ rng: countedRng(seed, base) }).Combat.attackRoll({ attackBonus: 3, ac: 15 });
    const redo  = createEngine({ rng: countedRng(seed, base) }).Combat.attackRoll({ attackBonus: 3, ac: 15 });
    assert.equal(redo.d20, first.d20);
    assert.equal(redo.hit, first.hit);
  });
});
