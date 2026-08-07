// Wiring contract: the systems the library ships must have consumers.
//
// The audit's sharpest structural finding was "machinery without content,
// content without a consumer" — branching beat threads, archetype casting, a
// scene clock, SRD travel and the whole XP module were built, tested, and
// called by nothing, while the game reimplemented simpler versions beside them.
//
// It is an easy mistake to repeat: every system added since is pure, tested and
// exported, which looks identical to "working" until you check that something
// actually calls it. These tests fail if a capability regresses into an orphan.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir = path.join(ROOT, 'src')) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return e.name.endsWith('.js') ? [full] : [];
  });
}

const FILES = sourceFiles();
const SOURCE = Object.fromEntries(FILES.map(f => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8')]));

// Everything except the module that defines it must be considered a consumer.
//
// An IMPORT IS NOT A CONSUMER. The first version of this file matched the bare
// symbol anywhere in another file, so `import { plantClue } from ...` satisfied
// it — and four capabilities (the payoff ledger, digest invalidation, chapter
// titling, faction clocks) sat unused behind a green test for exactly that
// reason. Strip import statements before looking, so only real references count.
function withoutImports(src) {
  return src.replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]+['"];?\s*$/gm, '');
}

function callersOf(symbol, definedIn) {
  return Object.entries(SOURCE)
    .filter(([file, src]) => file !== definedIn && new RegExp(`\\b${symbol}\\b`).test(withoutImports(src)))
    .map(([file]) => file);
}

describe('every capability has a consumer', () => {
  const WIRED = [
    // symbol,            defined in,                       what it powers
    ['assembleScope',     'src/game/scope.js',              'the per-turn context packet'],
    ['memoryContext',     'src/game/chapters.js',           "the narrator's long memory"],
    ['maybeRefreshDigest','src/game/chapters.js',           'the rolling chapter summary'],
    ['cutChapter',        'src/game/chapters.js',           'chapter boundaries'],
    ['recordMechanical',  'src/game/ledger.js',             'ground truth in the world ledger'],
    ['extractCanon',      'src/ai/canon.js',                'turning narration into world facts'],
    ['commitCanon',       'src/game/canon-commit.js',       'minting what the GM invents'],
    ['awardXp',           'src/game/progression.js',        'experience from kills'],
    ['awardMilestone',    'src/game/progression.js',        'experience from story events'],
    ['tickWorldClocks',   'src/game/world-clocks.js',       'the world moving while you are away'],
    ['armThreatClocks',   'src/game/world-clocks.js',       'invented threats starting to count'],
    ['rumours',           'src/game/world-clocks.js',       'ignored threats reaching the player'],
    ['initialAtlas',      'src/game/atlas.js',              'the world map'],
    ['stubToward',        'src/game/atlas.js',              'deterministic neighbour hydration'],
    ['hydrateRegion',     'src/game/atlas.js',              'pushing the frontier outward'],
    ['nextActContext',    'src/game/acts-runtime.js',       'generating the next act from what happened'],
    ['adoptAct',          'src/game/acts-runtime.js',       'adding a generated act to the thread'],
    ['storyStalled',      'src/game/acts-runtime.js',       'escalating a frozen story'],
    ['generateAct',       'src/ai/acts.js',                 'act generation'],
    // The second wave — all four were built, tested, exported and called by
    // nothing until the audit found them. They are listed here so that can
    // never be true again silently.
    ['activeSetups',      'src/game/acts-runtime.js',       'the GM knowing which clues to seed'],
    ['refreshStaleDigests','src/game/digests.js',           'digests that stop describing a dead world'],
    ['titleChapter',      'src/ai/summarize.js',            'chapters with names instead of numbers'],
    ['seedFactionClocks', 'src/game/world-clocks.js',       'factions that are working on something'],
  ];

  for (const [symbol, definedIn, powers] of WIRED) {
    it(`${symbol} is called (${powers})`, () => {
      const callers = callersOf(symbol, definedIn);
      assert.ok(callers.length > 0,
        `${symbol} is exported from ${definedIn} but nothing calls it — ${powers} does not actually happen`);
    });
  }
});

describe('the red thread runs on one runtime', () => {
  it('story.js delegates to the acts runtime rather than a parallel beat list', () => {
    const story = SOURCE['src/game/story.js'];
    assert.match(story, /acts-runtime\.js/, 'story.js must consume the acts runtime');
    assert.ok(!/currentBeat\(/.test(story),
      'story.js still calls the library\'s flat beat evaluator — two runtimes again');
  });

  it('legacy saves are migrated rather than stranded', () => {
    assert.match(SOURCE['src/game/acts-runtime.js'], /redThread/,
      'an in-flight campaign must keep its progress when acts arrive');
  });
});

describe('foreshadowing is planted, carried and paid', () => {
  // The payoff ledger shipped complete — plantSetup, duePayoffs, paySetup, all
  // tested in the library — and had no producer. duePayoffs() returned [] for
  // the life of every campaign, so the act generator's "any unpaidSetups MUST
  // be paid off" instruction was addressed to an empty list, forever.
  it('an act plants the clues it generates', () => {
    assert.match(SOURCE['src/game/acts-runtime.js'], /plantClue\(\{/,
      'adoptAct must plant the generated setups, or the payoff ledger has no input');
  });

  it('the generator is asked for setups', () => {
    assert.match(SOURCE['src/ai/schemas.js'], /setups:\s*\{/,
      'ACT_SCHEMA must carry setups');
  });

  it('completing a beat pays off the clue that led to it', () => {
    assert.match(SOURCE['src/game/acts-runtime.js'], /paysInto === beatId/,
      'a beat that resolves a setup must settle it, or every clue stays due forever');
  });

  it('unpaid clues reach the GM privately, not the player', () => {
    assert.match(SOURCE['src/game/scope.js'], /activeSetups\(\)/);
    const scope = SOURCE['src/game/scope.js'];
    const gmBlock = scope.slice(scope.indexOf('if (includeGmOnly)'));
    assert.match(gmBlock, /gm\.setups/,
      'setups must live in the gmOnly slice — foreshadowing handed to the player is not foreshadowing');
  });
});

describe('GM-private material is separated', () => {
  it('secrets reach the narrator through a dedicated channel', () => {
    assert.match(SOURCE['src/game/loop.js'], /buildGmContext\(\)/);
    assert.match(SOURCE['src/ai/narrate.js'], /gmOnly/);
  });

  it('the player-visible scene never carries the gmOnly slice', () => {
    const loop = SOURCE['src/game/loop.js'];
    const buildScene = loop.slice(loop.indexOf('export function buildScene'), loop.indexOf('export function buildGmContext'));
    assert.ok(!/includeGmOnly:\s*true/.test(buildScene),
      'buildScene feeds the UI and the save; secrets must not travel in it');
  });
});

describe('the world map is a graph, not a star', () => {
  it('a neighbour is hydrated from its own stub seed', () => {
    const flow = SOURCE['src/game/flow.js'];
    assert.match(flow, /stubToward\(/);
    assert.match(flow, /stub\?\.seed \?\? Math\.floor/,
      'generation must prefer the pre-minted stub seed over a fresh random one');
  });
});
