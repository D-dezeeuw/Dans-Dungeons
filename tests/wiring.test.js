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
function callersOf(symbol, definedIn) {
  return Object.entries(SOURCE)
    .filter(([file, src]) => file !== definedIn && new RegExp(`\\b${symbol}\\b`).test(src))
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
    ['unpaidSetups',      'src/game/acts-runtime.js',       'planted clues reaching the narrator'],
    ['takePendingActClose','src/game/story.js',             'act closes surviving the mid-turn seam'],
    ['refreshStaleDigests','src/game/ledger.js',            'region digests absorbing regional news'],
    ['titleChapter',      'src/ai/summarize.js',            'chapters named for what happened in them'],
    ['initAtlas',         'src/game/atlas.js',              'pre-atlas saves gaining a map on resume'],
    ['activeThreatsAt',   'src/game/world-clocks.js',       'minted threats being findable'],
    ['resolveThreat',     'src/game/world-clocks.js',       'a dealt-with threat staying dealt with'],
    ['generateContinentOutlines', 'src/game/worldgen.js',   'the global outline at genesis (doc 17)'],
    ['generateProvinceOutline',   'src/game/worldgen.js',   'provinces outlining on approach'],
    ['applyContinentOutlines',    'src/game/atlas.js',      'outlines landing on the skeleton'],
    ['seaLaneFrom',       'src/game/atlas.js',              'continents reachable by sea'],
    ['provinceOf',        'src/game/atlas.js',              'regions knowing their province'],
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

describe('dungeons scale with the campaign', () => {
  it('the act number reaches the dungeon generator', () => {
    // The generator takes a size; the game computes one from the act. Both
    // halves have to hold or every dungeon is the same six rooms for 80 hours.
    assert.match(SOURCE['src/game/world.js'], /dungeonSizeForAct/,
      'world.js no longer computes a size from the act');
    assert.match(SOURCE['src/game/flow.js'], /act:\s*actNumber\(\)/,
      'flow.js no longer passes the current act into createDungeonEntry');
  });
});
