// tests/turn-plumbing.test.js — the three things that sit between the player
// and the model: what never needs a model call, what a failure tells the player,
// and what happens when the model answers in the wrong shape.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { preClassify, normalize } from '../src/game/preclassify.js';
import { describeAiError, statusOf } from '../src/ai/errors.js';
import { salvageJson, clampDc, DC_MIN, DC_MAX } from '../src/ai/parse.js';

// The chip command templates preClassify matches against, injected rather than
// loaded — src/i18n reads localStorage and imports JSON, neither of which node
// has. `tests/i18n-contract.test.js` asserts these keys still exist in the real
// bundle with the same shape, so the stub cannot silently drift from it.
const CHIPS = {
  'chips.goDir':      'I go {{dir}}',
  'chips.takeCmd':    'I take the {{name}}',
  'chips.unlockCmd':  'I use the key to unlock the door',
  'chips.attackCmd':  'I attack',
  'chips.lookCmd':    'I look around carefully',
  'chips.waitCmd':    'I wait and watch',
  'directions.north': 'north', 'directions.south': 'south',
  'directions.east':  'east',  'directions.west':  'west',
};
const i18n = {
  locale: () => 'en',
  t: (key, params = {}) => String(CHIPS[key] ?? key)
    .replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? ''),
};
const pre = (input, sc) => preClassify(input, sc, i18n);

// A minimal buildScene()-shaped object.
const scene = ({ exits = ['north', 'east'], loot = [], npcs = [] } = {}) => ({
  room: {
    name: 'Hall', description: 'A hall.',
    exits: exits.map(d => (typeof d === 'string' ? { direction: d, locked: false } : d)),
    loot,
  },
  npcs,
});

describe('preClassify — the turns that need no model', () => {
  it('recognizes the compass chip string', () => {
    const out = pre('I go north', scene());
    assert.equal(out?.intent, 'move');
    assert.equal(out.direction, 'north');
    assert.equal(out.preClassified, true);
  });

  it('recognizes a bare direction and its single letter', () => {
    assert.equal(pre('north', scene())?.direction, 'north');
    assert.equal(pre('n', scene())?.direction, 'north');
    assert.equal(pre('go east', scene())?.direction, 'east');
    assert.equal(pre('I head east.', scene())?.direction, 'east');
  });

  it('refuses to move through a wall that is not there', () => {
    // South is not an exit — this is a real question for the model, not a
    // silent rejection.
    assert.equal(pre('south', scene()), null);
    assert.equal(pre('I go south', scene()), null);
  });

  it('does not swallow prose that merely mentions a direction', () => {
    assert.equal(pre('I study the northern wall for cracks', scene()), null);
    assert.equal(pre('what lies north of here?', scene()), null);
  });

  it('takes a named item and knows its id', () => {
    const s = scene({ loot: [{ id: 'key-1', name: 'brass key' }] });
    const out = pre('I take the brass key', s);
    assert.equal(out?.intent, 'take');
    assert.equal(out.target_id, 'key-1');
  });

  it('does not take an item that is not in the room', () => {
    assert.equal(pre('I take the brass key', scene()), null);
  });

  it('attacks only when there is exactly one thing to mean', () => {
    const one = scene({ npcs: [{ id: 'g1', alive: true, attitude: 'hostile' }] });
    assert.equal(pre('I attack', one)?.target_id, 'g1');

    const two = scene({ npcs: [
      { id: 'g1', alive: true, attitude: 'hostile' },
      { id: 'g2', alive: true, attitude: 'hostile' },
    ] });
    assert.equal(pre('I attack', two), null, 'two targets is ambiguous — ask the model');
  });

  it('unlocks only when something is locked', () => {
    const locked = scene({ exits: [{ direction: 'north', locked: true }] });
    assert.equal(pre('I use the key to unlock the door', locked)?.intent, 'unlock');
    assert.equal(pre('I use the key to unlock the door', scene()), null);
  });

  it('handles look, wait, and inventory', () => {
    assert.equal(pre('I look around carefully', scene())?.intent, 'look');
    assert.equal(pre('look', scene())?.intent, 'look');
    assert.equal(pre('I wait and watch', scene())?.intent, 'wait');
    assert.equal(pre('inventory', scene())?.intent, 'inventory');
  });

  it('tells a long rest from a short one', () => {
    assert.equal(pre('make camp', scene())?.long, true);
    assert.equal(pre('long rest', scene())?.long, true);
    assert.equal(pre('rest', scene())?.long, false);
  });

  it('returns null for anything genuinely interesting', () => {
    for (const line of [
      'I whisper the dead king\'s name to the door',
      'I try to bribe the guard with my last coin',
      'cast fire bolt at the chandelier so it falls on them',
      '',
      '   ',
    ]) {
      assert.equal(pre(line, scene()), null, `should defer to the model: "${line}"`);
    }
  });

  it('always returns the classifier shape when it matches', () => {
    const out = pre('north', scene());
    for (const k of ['intent', 'target_id', 'direction', 'skill', 'dc', 'reason']) {
      assert.ok(k in out, `missing '${k}'`);
    }
  });

  it('normalizes punctuation and case', () => {
    assert.equal(normalize('  I Go NORTH!!  '), 'i go north');
  });
});

describe('clampDc', () => {
  it('keeps a check inside the band where dice matter', () => {
    assert.equal(clampDc(35), DC_MAX);
    assert.equal(clampDc(2),  DC_MIN);
    assert.equal(clampDc(15), 15);
    assert.equal(clampDc(14.6), 15);
  });

  it('passes through a missing DC rather than inventing one', () => {
    assert.equal(clampDc(null), null);
    assert.equal(clampDc(undefined), null);
    assert.equal(clampDc('hard'), null);
    assert.equal(clampDc(NaN), null);
    assert.equal(clampDc(Infinity), null);
  });
});

describe('describeAiError — cause and next step, not one guess for everything', () => {
  const err = (status) => Object.assign(new Error(`AI ${status}: body`), { status });

  it('separates the failures whose fix is different', () => {
    assert.deepEqual(describeAiError(err(401)), { key: 'error.auth',        retryable: false, status: 401 });
    assert.deepEqual(describeAiError(err(402)), { key: 'error.credit',      retryable: false, status: 402 });
    assert.deepEqual(describeAiError(err(403)), { key: 'error.refused',     retryable: false, status: 403 });
    assert.deepEqual(describeAiError(err(404)), { key: 'error.noModel',     retryable: false, status: 404 });
    assert.deepEqual(describeAiError(err(413)), { key: 'error.tooLong',     retryable: false, status: 413 });
    assert.deepEqual(describeAiError(err(429)), { key: 'error.rateLimited', retryable: true,  status: 429 });
  });

  it('marks waiting useful only where waiting helps', () => {
    // A rate limit and a server fault clear on their own; a dead key never does.
    assert.equal(describeAiError(err(429)).retryable, true);
    assert.equal(describeAiError(err(503)).retryable, true);
    assert.equal(describeAiError(err(402)).retryable, false);
  });

  it('reads the status out of a stringified error too', () => {
    assert.equal(statusOf(new Error('AI 429: rate limited')), 429);
    assert.equal(statusOf(err(500)), 500);
    assert.equal(statusOf(new Error('boom')), null);
    assert.equal(statusOf(null), null);
  });

  it('names a transport failure as one', () => {
    assert.equal(describeAiError(new Error('Failed to fetch')).key, 'error.network');
    assert.equal(describeAiError(new Error('The operation timed out')).key, 'error.network');
    assert.equal(describeAiError(new Error('request aborted')).key, 'error.network');
  });

  it('falls back without pretending to know', () => {
    assert.equal(describeAiError(new Error('something odd')).key, 'error.unknown');
  });
});

describe('salvageJson — recover the words the player already watched arrive', () => {
  it('parses a fenced object', () => {
    const raw = '```json\n{"narration":"The door groans open."}\n```';
    assert.deepEqual(salvageJson(raw), { narration: 'The door groans open.' });
  });

  it('parses an unlabelled fence', () => {
    assert.deepEqual(salvageJson('```\n{"narration":"Ok."}\n```'), { narration: 'Ok.' });
  });

  it('parses an object with prose around it', () => {
    const raw = 'Here you go:\n{"narration":"You step through."}\nHope that helps!';
    assert.deepEqual(salvageJson(raw), { narration: 'You step through.' });
  });

  it('keeps bare prose as the narration rather than paying for a repair', () => {
    const out = salvageJson('The corridor smells of wet stone and old smoke.');
    assert.equal(out.narration, 'The corridor smells of wet stone and old smoke.');
  });

  it('refuses an object with no narration to salvage', () => {
    assert.equal(salvageJson('{"summary":"nope"}'), null);
    assert.equal(salvageJson(''), null);
    assert.equal(salvageJson(null), null);
  });

  it('prefers the fenced object over a stray brace elsewhere in the text', () => {
    const raw = 'note: {not json}\n```json\n{"narration":"Right one."}\n```';
    assert.equal(salvageJson(raw)?.narration, 'Right one.');
  });
});
