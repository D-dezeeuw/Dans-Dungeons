// === Solo oracle (since 2.0.0; SRD-style GM emulator) ===
//
// Solo play needs a yes/no/maybe-with-flavour ruling source the
// player can lean on when there is no human DM at the table. The
// classic Mythic-style oracle takes (1) a question, (2) an odds
// band, and returns one of six outcomes:
//
//   exceptional-no | no | no-but | yes-but | yes | exceptional-yes
//
// The bands collapse to a single probability of "yes" against a
// d100; the extreme bands (1-5 / 96-100) flag exceptional results.
// Twists and complications draw weighted entries from small
// tables the host can extend at construction.
//
// Everything routes through the engine's rng so a seeded solo
// session reproduces every oracle answer end-to-end (the whole
// point of solo mode: a replay isn't just dice, it's the GM
// rulings too).

const ODDS = Object.freeze({
  'certain':       95,
  'near-certain':  90,
  'very-likely':   85,
  'likely':        75,
  'fifty-fifty':   50,
  'unlikely':      25,
  'very-unlikely': 15,
  'near-impossible': 10,
  'impossible':     5
});

const EXCEPTIONAL_LOW = 5;
const EXCEPTIONAL_HIGH = 95;

const DEFAULT_TWISTS = Object.freeze([
  { id: 'npc-action',      weight: 4, text: 'An NPC acts in a way the party did not expect.' },
  { id: 'npc-arrives',     weight: 4, text: 'A new NPC arrives on the scene.' },
  { id: 'old-foe',         weight: 2, text: 'An old foe resurfaces.' },
  { id: 'reveal-truth',    weight: 3, text: 'A hidden truth is suddenly revealed.' },
  { id: 'reveal-lie',      weight: 2, text: 'A trusted source proves to be lying.' },
  { id: 'reversal',        weight: 3, text: 'The situation reverses against the party.' },
  { id: 'time-pressure',   weight: 3, text: 'A deadline tightens; the party has less time than they thought.' },
  { id: 'resource-loss',   weight: 3, text: 'A resource the party relied on is lost or compromised.' },
  { id: 'mistaken-id',     weight: 2, text: 'A case of mistaken identity complicates things.' },
  { id: 'weather',         weight: 2, text: 'The weather turns hostile.' },
  { id: 'environmental',   weight: 2, text: 'The environment itself becomes a problem.' },
  { id: 'object-found',    weight: 2, text: 'A meaningful object is found at an inconvenient moment.' },
  { id: 'rumor-true',      weight: 2, text: 'A rumour the party dismissed turns out to be true.' },
  { id: 'physical-event',  weight: 2, text: 'An unusual physical event occurs (tremor, flash, sound).' },
  { id: 'misfortune',      weight: 2, text: 'Bad luck strikes someone the party knows.' }
]);

const DEFAULT_COMPLICATIONS = Object.freeze([
  { id: 'reinforcements',  weight: 3, text: 'Reinforcements arrive for the opposition.' },
  { id: 'witness',         weight: 2, text: 'An unintended witness sees what just happened.' },
  { id: 'broken-tool',     weight: 2, text: 'A tool, weapon, or item is damaged or breaks.' },
  { id: 'noise',           weight: 2, text: 'A loud noise draws unwanted attention.' },
  { id: 'wounded-ally',    weight: 2, text: 'An ally is hurt off-screen.' },
  { id: 'mistaken-target', weight: 2, text: 'Someone or something gets caught in the crossfire.' },
  { id: 'collateral',      weight: 2, text: 'Collateral damage compromises the objective.' },
  { id: 'trail-cold',      weight: 2, text: 'A lead the party is chasing goes cold.' },
  { id: 'wrong-place',     weight: 2, text: 'Someone is in the wrong place at the worst time.' },
  { id: 'misread-cue',     weight: 2, text: 'A social cue is misread; tempers flare.' }
]);

/** The six oracle outcome labels. Frozen because hosts will want
 *  to switch over them in UI code. */
export const OUTCOMES = Object.freeze([
  'exceptional-no', 'no', 'no-but', 'yes-but', 'yes', 'exceptional-yes'
]);

/** The odds bands the oracle accepts. Frozen and exported so a
 *  UI can render a dropdown without re-typing the strings. */
export const ODDS_BANDS = Object.freeze(Object.keys(ODDS));

function rollD100(rng) {
  return 1 + Math.floor(rng() * 100);
}

function weightedPick(rng, table) {
  let total = 0;
  for (const entry of table) {
    const w = entry.weight ?? 1;
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`Solo.oracle: weighted table entry '${entry.id ?? '<no id>'}' has invalid weight ${w}; must be a non-negative finite number`);
    }
    total += w;
  }
  if (total <= 0) throw new Error('Solo.oracle: weighted table must have at least one positive-weight entry');
  let r = rng() * total;
  for (const entry of table) {
    r -= entry.weight ?? 1;
    if (r < 0) return entry;
  }
  return table[table.length - 1];
}

function resolveOdds(odds) {
  if (typeof odds === 'number') {
    if (!Number.isFinite(odds) || odds < 0 || odds > 100) {
      throw new Error(`Solo.oracle.ask: numeric odds must be in [0, 100] (got ${odds})`);
    }
    return odds;
  }
  if (typeof odds === 'string' && odds in ODDS) return ODDS[odds];
  throw new Error(`Solo.oracle.ask: unknown odds band '${odds}'. Use one of: ${ODDS_BANDS.join(', ')}, or a number in [0, 100].`);
}

/**
 * Build a solo-play oracle. The oracle has its own rng — sharing
 * the engine's dice rng would silently advance the dice stream
 * (the d100 pulls go nowhere observable in `engine.rollLog`), so
 * `engine.verifyLog` would diverge whenever a host mixed oracle
 * questions with attacks. Pass an explicit seeded rng for a
 * reproducible oracle stream:
 *
 *   const engine = createEngine({ rng: Dice.seededRng(42) });
 *   const oracle = engine.Solo.oracle({ rng: Dice.seededRng(7) });
 *   //                                ^^^ separate seed, independent stream
 *
 * Or default to `Math.random` for a casual non-replayable session:
 *
 *   const oracle = engine.Solo.oracle();
 *
 * @param {object} [opts]
 * @param {() => number} [opts.rng]              RNG; default Math.random.
 * @param {Array}        [opts.twists]           Extra entries appended to the default twists table.
 * @param {Array}        [opts.complications]    Extra entries appended to the default complications table.
 */
export function oracle({ rng = Math.random, twists = [], complications = [] } = {}) {
  const twistTable = [...DEFAULT_TWISTS, ...twists];
  const compTable = [...DEFAULT_COMPLICATIONS, ...complications];

  /**
   * Ask the oracle a yes/no question with an odds band. Returns the
   * outcome plus the d100 face for trace-back, so the host UI can
   * render "rolled 23 vs likely (75) → yes".
   */
  function ask(question, odds = 'fifty-fifty') {
    const threshold = resolveOdds(odds);
    const d100 = rollD100(rng);
    const yes = d100 <= threshold;
    let outcome;
    if (yes && d100 <= EXCEPTIONAL_LOW) outcome = 'exceptional-yes';
    else if (!yes && d100 >= EXCEPTIONAL_HIGH) outcome = 'exceptional-no';
    else if (yes && d100 > threshold - 10) outcome = 'yes-but';
    else if (!yes && d100 < threshold + 10) outcome = 'no-but';
    else outcome = yes ? 'yes' : 'no';
    return { question, odds, threshold, d100, outcome };
  }

  /** Draw a twist from the table. Returns `{ id, text, d100 }`. */
  function twist() {
    const entry = weightedPick(rng, twistTable);
    return { id: entry.id, text: entry.text };
  }

  /** Draw a complication. Same shape as `twist`. */
  function complication() {
    const entry = weightedPick(rng, compTable);
    return { id: entry.id, text: entry.text };
  }

  /**
   * Pick from a host-supplied weighted table. Entries are
   * `{ weight?, ... }`; missing weights default to 1. Returns the
   * entry verbatim so the host can attach any shape it wants.
   */
  function pick(table) {
    if (!Array.isArray(table) || table.length === 0) {
      throw new Error('Solo.oracle.pick: table must be a non-empty array');
    }
    return weightedPick(rng, table);
  }

  return Object.freeze({ ask, twist, complication, pick, ODDS_BANDS, OUTCOMES });
}
