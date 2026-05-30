// Every roll the engine produces flows through this module, so it's
// the natural place to centralise the RNG contract. The default is
// `Math.random` (non-seedable, fine for casual play); consumers that
// need replay-determinism pass a `seededRng(seed)` through the engine
// factory or directly into the rolling functions below.
//
// The RNG signature deliberately matches `Math.random` — a zero-arg
// function returning a float in `[0, 1)` — so any custom generator
// (Node's crypto, a hardware RNG, a mocked sequence in tests) is a
// drop-in replacement without engine-side adapters.

const PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/;

/**
 * Parse the `XdY±Z` grammar the rest of the engine speaks in. Throws
 * rather than returning null on malformed input because a bad spec is
 * always a bug at the call site — silent fallback would hide it under
 * later "why is damage 0?" mysteries.
 */
export function parse(spec) {
  const m = PATTERN.exec(String(spec).trim());
  if (!m) throw new Error(`Invalid dice spec: ${spec}`);
  return { count: Number(m[1]), sides: Number(m[2]), modifier: m[3] ? Number(m[3]) : 0 };
}

/**
 * Single-die roll, uniform 1..sides. The optional `rng` parameter
 * lets callers (and the engine factory) substitute a deterministic
 * generator for replay or testing. Default keeps the casual-play
 * shape: `Math.random` is good enough when nobody needs reproducibility.
 */
export function rollDie(sides, rng = Math.random) {
  return 1 + Math.floor(rng() * sides);
}

/**
 * Roll a dice expression and return both the individual `rolls` and
 * the modified `total`. Keeping the per-die array around is what lets
 * Nerd mode show "you rolled 4 + 6 + 5 = 15" instead of just the sum
 * — losing the array would force the UI to re-roll for display. The
 * `rng` cascades through to each individual die so a seeded session
 * stays deterministic across the whole expression.
 */
export function roll(spec, rng = Math.random) {
  const { count, sides, modifier } = parse(spec);
  const rolls = Array.from({ length: count }, () => rollDie(sides, rng));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { spec, rolls, modifier, total };
}

/**
 * Advantage compares whole-expression totals, not individual dice.
 * "3d6+2 with advantage" means roll the entire 3d6+2 twice and keep
 * the better outcome — re-rolling die-by-die would silently misapply
 * the rule for multi-die attacks. Both expression rolls share the
 * passed `rng` so the sequence stays deterministic.
 */
export function rollAdvantage(spec, rng = Math.random) {
  const a = roll(spec, rng);
  const b = roll(spec, rng);
  return a.total >= b.total ? a : b;
}

/** Symmetric inverse of `rollAdvantage` — same shape, lower wins. */
export function rollDisadvantage(spec, rng = Math.random) {
  const a = roll(spec, rng);
  const b = roll(spec, rng);
  return a.total <= b.total ? a : b;
}

/**
 * Roll a dice expression with **exploding dice**: every die that
 * rolls its maximum value triggers another roll of the same die,
 * added on. Used by the engine's `explodingDamageDice` rule for
 * "savage worlds"-style critical damage; can also be called directly
 * for any host that wants exploding dice as a one-off mechanic.
 *
 * Chains compound — a max roll can chain into another max roll
 * which chains again. There's no cap in the SRD; in practice the
 * probability decays geometrically (1/sides per chain step), so a
 * runaway chain is extremely rare with normal dice. A degenerate
 * RNG that always returns max would loop forever; callers using a
 * custom RNG should ensure it's uniform.
 *
 * Returns the same shape as `roll`, with `rolls` containing every
 * die that hit the table — original three for `3d6` plus any
 * explosion follow-ups. The `count` field in the parsed spec stays
 * the original; the array's length grows.
 */
export function rollExplosive(spec, rng = Math.random) {
  const { count, sides, modifier } = parse(spec);
  const rolls = [];
  for (let i = 0; i < count; i++) {
    let value;
    do {
      value = rollDie(sides, rng);
      rolls.push(value);
    } while (value === sides);
  }
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  return { spec, rolls, modifier, total };
}

/**
 * Build a deterministic, seedable replacement for `Math.random`.
 * Returns a function with the same `() => [0, 1)` signature, so it's
 * a drop-in: pass it to any rolling function or hand it to the
 * engine factory via `createEngine({ rng })`.
 *
 * Algorithm: **Mulberry32**. 32-bit state, well-studied for game RNG,
 * passes the small-crush statistical battery. Not cryptographically
 * secure — this is a game engine, not a token mint. The closure
 * captures the state so successive calls advance independently of
 * any other rng instance the consumer may have spawned.
 *
 * **Determinism guarantee:** for a given `seed`, the sequence of
 * outputs is identical across platforms and Node/browser engines,
 * provided this exact implementation hasn't been touched. Tests in
 * `tests/rng.test.js` pin specific seed→output pairs precisely so
 * any change to the algorithm fails CI loudly. Same-seed sequences
 * across versions are part of the public contract.
 */
export function seededRng(seed) {
  let state = (seed | 0) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
