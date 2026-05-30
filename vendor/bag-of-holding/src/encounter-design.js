// === Encounter design tools (SRD 5.2 § Gameplay Toolbox —
// Combat Encounters, since 1.16.0) ===
//
// XP-by-CR lookup, simplified 2024 encounter difficulty bands
// (low / moderate / high), and the inverse classifier that takes a
// monster mix and reports the difficulty for a given party. Pure
// data and pure math; the host owns picking actual monsters.

/**
 * SRD § Monsters — CR / XP table. Returns the XP award for a
 * single creature at the given CR. Fractional CRs (1/8, 1/4, 1/2)
 * are keyed off the numeric value.
 */
export function xpForCR(cr) {
  if (typeof cr !== 'number' || cr < 0) {
    throw new Error('xpForCR: cr must be a non-negative number');
  }
  if (cr === 0) return 10;
  if (cr === 1 / 8) return 25;
  if (cr === 1 / 4) return 50;
  if (cr === 1 / 2) return 100;
  // Integer CRs: SRD table values.
  const table = {
    1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900,
    8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000,
    14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000,
    19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000,
    24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000,
    29: 135000, 30: 155000
  };
  const value = table[cr];
  if (value === undefined) {
    throw new Error(`xpForCR: no XP for CR ${cr} (table covers 0..30 in 5e increments)`);
  }
  return value;
}

/**
 * SRD 5.2 § Gameplay Toolbox — Combat Encounters. 2024 simplified
 * the encounter budget to three bands: low (a warm-up), moderate
 * (a real fight), and high (a serious threat). The XP budget per
 * character per band is taken from the 2024 DMG.
 *
 * Returns `{ low, moderate, high }` XP totals — multiply by party
 * size yourself when building an encounter.
 */
export const ENCOUNTER_BUDGETS = Object.freeze({
  // PHB / DMG 2024 simplified table — XP per character.
  // (Values rounded to the SRD's per-character bands.)
  1:  { low: 50,    moderate: 75,    high: 100 },
  2:  { low: 100,   moderate: 150,   high: 200 },
  3:  { low: 150,   moderate: 225,   high: 400 },
  4:  { low: 250,   moderate: 375,   high: 500 },
  5:  { low: 500,   moderate: 750,   high: 1100 },
  6:  { low: 600,   moderate: 1000,  high: 1400 },
  7:  { low: 750,   moderate: 1300,  high: 1700 },
  8:  { low: 1000,  moderate: 1700,  high: 2100 },
  9:  { low: 1300,  moderate: 2000,  high: 2600 },
  10: { low: 1600,  moderate: 2300,  high: 3100 },
  11: { low: 1900,  moderate: 2900,  high: 4100 },
  12: { low: 2200,  moderate: 3700,  high: 4700 },
  13: { low: 2600,  moderate: 4200,  high: 5400 },
  14: { low: 2900,  moderate: 4900,  high: 6200 },
  15: { low: 3300,  moderate: 5400,  high: 7800 },
  16: { low: 3800,  moderate: 6100,  high: 9800 },
  17: { low: 4500,  moderate: 7200,  high: 11700 },
  18: { low: 5000,  moderate: 8700,  high: 14200 },
  19: { low: 5500,  moderate: 10700, high: 17200 },
  20: { low: 6400,  moderate: 13200, high: 22000 }
});

/**
 * Compute the XP budget for a party at a given difficulty band.
 * Sums the per-character allocation across the party (party levels
 * may differ).
 */
export function budgetFor(partyLevels, difficulty) {
  if (!Array.isArray(partyLevels) || partyLevels.length === 0) {
    throw new Error('budgetFor: partyLevels must be a non-empty array');
  }
  if (!['low', 'moderate', 'high'].includes(difficulty)) {
    throw new Error("budgetFor: difficulty must be 'low', 'moderate', or 'high'");
  }
  let total = 0;
  for (const lvl of partyLevels) {
    const band = ENCOUNTER_BUDGETS[lvl];
    if (!band) throw new Error(`budgetFor: no budget for character level ${lvl}`);
    total += band[difficulty];
  }
  return total;
}

/**
 * Classify a monster mix against a party. Sums monster XP from
 * their CRs, compares against the party's three budget bands, and
 * returns the matched difficulty (or `'trivial'` below low,
 * `'deadly'` above high).
 */
export function classifyEncounter({ monsterCRs, partyLevels }) {
  if (!Array.isArray(monsterCRs)) {
    throw new Error('classifyEncounter: monsterCRs must be an array');
  }
  const xp = monsterCRs.reduce((sum, cr) => sum + xpForCR(cr), 0);
  const low = budgetFor(partyLevels, 'low');
  const moderate = budgetFor(partyLevels, 'moderate');
  const high = budgetFor(partyLevels, 'high');
  let band;
  if (xp < low) band = 'trivial';
  else if (xp < moderate) band = 'low';
  else if (xp < high) band = 'moderate';
  else if (xp === high) band = 'high';
  else band = 'deadly';
  return { xp, band, budgets: { low, moderate, high } };
}
