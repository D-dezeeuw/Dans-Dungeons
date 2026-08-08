// tests/validate.test.js — what happens when the model ignores the schema.
//
// Every structured call ships a JSON schema and, until now, trusted the answer.
// `strict` json_schema is a request: providers vary, and a call that walks the
// tier's fallback chain can land on a model that honours it loosely or not at
// all. The failures were all silent and downstream — an out-of-enum intent fell
// through every resolver branch to the narrator, a missing `narration` rendered
// as the literal string "undefined" into the transcript and then the save.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  validateClassification, validateNarration, validateBeatCheck,
  validateAct, validateChapters, onSchemaViolation,
} from '../src/ai/validate.js';
import { clampDc } from '../src/ai/parse.js';
import { CLASSIFIER_SCHEMA } from '../src/ai/schemas.js';

const INTENTS = CLASSIFIER_SCHEMA.properties.intent.enum;
const classify = (out) => validateClassification(out, { intents: INTENTS, clampDc });

// Collect the reports a run produces, so "we noticed" is asserted rather than
// assumed.
function withReports(fn) {
  const seen = [];
  onSchemaViolation((where, detail) => seen.push({ where, detail }));
  try { return { result: fn(), seen }; }
  finally { onSchemaViolation(null); }
}

describe('classifier responses', () => {
  it('passes a well-formed response through', () => {
    const out = classify({
      intent: 'attack', target_id: 'g1', direction: null, skill: null,
      spell_id: null, dc: null, reason: 'they swung',
    });
    assert.equal(out.intent, 'attack');
    assert.equal(out.target_id, 'g1');
    assert.ok(!out.invalid);
  });

  it('replaces an intent outside the enum with one that changes nothing', () => {
    const { result, seen } = withReports(() => classify({ intent: 'yeet', reason: '' }));
    assert.equal(result.intent, 'look', 'an unknown intent must not reach the narrator to improvise');
    assert.equal(seen.length, 1);
    assert.match(seen[0].detail, /yeet/);
  });

  it('normalises case and whitespace before judging', () => {
    assert.equal(classify({ intent: '  ATTACK ' }).intent, 'attack');
    assert.equal(classify({ intent: 'move', direction: ' North ' }).direction, 'north');
  });

  it('drops a direction that is not a direction', () => {
    const { result } = withReports(() => classify({ intent: 'look', direction: 'up' }));
    assert.equal(result.direction, null);
  });

  it('a move with no direction is not a move', () => {
    const { result, seen } = withReports(() => classify({ intent: 'move', direction: null }));
    assert.equal(result.intent, 'look', 'a directionless move resolves to nothing at all');
    assert.ok(seen.some(s => /move without a direction/.test(s.detail)));
  });

  it('coerces a numeric string DC and clamps it', () => {
    assert.equal(classify({ intent: 'skill', dc: '18' }).dc, 18);
    assert.equal(classify({ intent: 'skill', dc: '99' }).dc, 25);
    assert.equal(classify({ intent: 'skill', dc: 'hard' }).dc, null);
  });

  it('accepts spell_id under either name and reports both', () => {
    assert.equal(classify({ intent: 'cast', spell_id: 'fire-bolt' }).spellId, 'fire-bolt');
    assert.equal(classify({ intent: 'cast', spellId: 'fire-bolt' }).spell_id, 'fire-bolt');
  });

  it('survives a response that is not an object at all', () => {
    for (const junk of [null, undefined, 'nope', 42, []]) {
      const out = classify(junk);
      assert.equal(out.intent, 'look');
      assert.equal(out.invalid, true);
    }
  });

  it('always returns every field the resolver reads', () => {
    const out = classify({ intent: 'wait' });
    for (const k of ['intent', 'target_id', 'direction', 'skill', 'spell_id', 'dc', 'reason']) {
      assert.ok(k in out, `missing '${k}'`);
    }
  });
});

describe('narration', () => {
  it('passes a narration through untouched, with its other fields', () => {
    const out = validateNarration({ narration: 'You step through.', mood: 'tense' }, { fallback: 'x' });
    assert.equal(out.narration, 'You step through.');
    assert.equal(out.mood, 'tense');
    assert.ok(!out.invalid);
  });

  it('substitutes the fallback rather than writing "undefined" into the save', () => {
    for (const junk of [{}, { narration: '' }, { narration: 42 }, null, 'text']) {
      const out = validateNarration(junk, { fallback: 'nothing arrived' });
      assert.equal(out.narration, 'nothing arrived');
      assert.equal(out.invalid, true);
    }
  });
});

describe('beat check', () => {
  it('only true is true', () => {
    assert.equal(validateBeatCheck({ fulfilled: true }).fulfilled, true);
    assert.equal(validateBeatCheck({ fulfilled: false }).fulfilled, false);
    // The string "false" is truthy in JavaScript, and used to advance the story.
    assert.equal(validateBeatCheck({ fulfilled: 'false' }).fulfilled, false);
    assert.equal(validateBeatCheck({ fulfilled: 1 }).fulfilled, false);
    assert.equal(validateBeatCheck({}).fulfilled, false);
    assert.equal(validateBeatCheck(null).fulfilled, false);
  });

  it('accepts the string "true", which providers do send', () => {
    assert.equal(validateBeatCheck({ fulfilled: 'true' }).fulfilled, true);
  });
});

describe('generated acts', () => {
  const beat = (id) => ({ id, title: id, dramaticPurpose: `do ${id}`, location: null, requires: [], completesOn: [] });

  it('passes a well-formed act through', () => {
    const act = validateAct({ title: 'A', premise: 'p', beats: [beat('one'), beat('two')] });
    assert.equal(act.beats.length, 2);
    assert.equal(act.title, 'A');
  });

  it('refuses an act with nothing to do', () => {
    const { result, seen } = withReports(() => validateAct({ title: 'A', premise: 'p', beats: [] }));
    assert.equal(result, null, 'adopting it would leave the campaign with a title and no beats');
    assert.ok(seen.length > 0);
  });

  it('drops beats missing the fields the runtime reads', () => {
    const act = validateAct({ title: 'A', beats: [beat('ok'), { id: 'no-purpose' }, { dramaticPurpose: 'no id' }] });
    assert.deepEqual(act.beats.map(b => b.id), ['ok']);
  });

  it('drops a duplicate id, which would make `requires` ambiguous', () => {
    const { result, seen } = withReports(() =>
      validateAct({ title: 'A', beats: [beat('one'), beat('one'), beat('two')] }));
    assert.deepEqual(result.beats.map(b => b.id), ['one', 'two']);
    assert.ok(seen.some(s => /duplicate beat id/.test(s.detail)));
  });

  it('normalises the list fields so the runtime never sees a bare string', () => {
    const act = validateAct({ beats: [{ ...beat('one'), requires: 'beat-done-x', completesOn: 'boss-slain' }] });
    assert.deepEqual(act.beats[0].requires, ['beat-done-x']);
    assert.deepEqual(act.beats[0].completesOn, ['boss-slain']);
  });

  it('fills a missing title and premise rather than rendering undefined', () => {
    const act = validateAct({ beats: [beat('one')] });
    assert.equal(typeof act.title, 'string');
    assert.equal(typeof act.premise, 'string');
  });

  it('returns null for a non-object', () => {
    assert.equal(validateAct('nope'), null);
    assert.equal(validateAct(null), null);
  });
});

describe('journal chapters', () => {
  it('drops chapters with no text — a blank EPUB page is worse than one fewer', () => {
    const out = validateChapters(
      { title: 'T', chapters: [{ heading: 'One', text: 'words' }, { heading: 'Two' }, { text: '' }] },
      { fallbackTitle: 'F' },
    );
    assert.equal(out.chapters.length, 1);
    assert.equal(out.title, 'T');
  });

  it('numbers a chapter that forgot its heading', () => {
    const out = validateChapters({ chapters: [{ text: 'words' }] }, { fallbackTitle: 'F' });
    assert.equal(out.chapters[0].heading, 'Chapter 1');
    assert.equal(out.title, 'F');
  });

  it('returns null when nothing is usable, so the caller can fall back', () => {
    assert.equal(validateChapters({ chapters: [] }, { fallbackTitle: 'F' }), null);
    assert.equal(validateChapters(null, { fallbackTitle: 'F' }), null);
  });
});

describe('validation never throws', () => {
  it('survives every shape a broken provider can send', () => {
    const junk = [null, undefined, 0, '', 'text', [], [1, 2], { a: 1 }, { beats: 'no' },
                  { chapters: 'no' }, { intent: {} }, { narration: [] }];
    for (const j of junk) {
      assert.doesNotThrow(() => classify(j));
      assert.doesNotThrow(() => validateNarration(j, { fallback: 'x' }));
      assert.doesNotThrow(() => validateBeatCheck(j));
      assert.doesNotThrow(() => validateAct(j));
      assert.doesNotThrow(() => validateChapters(j, { fallbackTitle: 'x' }));
    }
  });

  it('survives a reporter that throws', () => {
    onSchemaViolation(() => { throw new Error('reporter is broken'); });
    try {
      assert.doesNotThrow(() => classify({ intent: 'nonsense' }));
    } finally {
      onSchemaViolation(null);
    }
  });
});
