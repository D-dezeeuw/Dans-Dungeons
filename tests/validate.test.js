// Client-side validation of model responses (Epic E11.S2).
//
// Every gameplay call sent a JSON schema and then used the answer as given.
// Structured output is a provider FEATURE, not a guarantee: a fallback model
// may not honour it, `additionalProperties: false` is enforced by whichever
// provider is serving the request, and the repair path returns whatever the
// model wrote. So a classifier could return intent 'yeet' and reach the
// resolver, or a DC of 45 — turning a locked door into an impossible one and
// leaving the player to conclude the GM is arbitrary.
//
// Imports the real module: validate.js is dependency-free precisely so this
// test does not have to mirror it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateClassified, validateNarration, clampDc, INTENTS, DC_MIN, DC_MAX,
} from '../src/ai/validate.js';

const good = {
  intent: 'skill', target_id: 'npc-1', direction: null, skill: 'stealth', dc: 15, reason: 'sneaking',
};

describe('DC clamping', () => {
  it('keeps a sensible DC exactly as rolled', () => {
    for (const dc of [5, 10, 12, 15, 20, 25]) assert.equal(clampDc(dc), dc);
  });

  it('pulls a hallucinated DC back onto the ladder', () => {
    assert.equal(clampDc(45), DC_MAX, 'DC 45 is not a check, it is a denial');
    assert.equal(clampDc(1),  DC_MIN, 'DC 1 is not a check either');
    assert.equal(clampDc(-30), DC_MIN);
    assert.equal(clampDc(9999), DC_MAX);
  });

  it('rounds a fractional DC rather than passing it to the dice', () => {
    assert.equal(clampDc(14.4), 14);
    assert.equal(clampDc(14.6), 15);
  });

  it('reports "no DC" rather than inventing one', () => {
    for (const bad of [null, undefined, 'hard', NaN, Infinity, {}]) {
      assert.equal(clampDc(bad), null, `${JSON.stringify(bad)} must not become a number`);
    }
  });

  it('clamps through the classifier path too', () => {
    assert.equal(validateClassified({ ...good, dc: 45 }).dc, DC_MAX);
  });
});

describe('classifier responses', () => {
  it('passes a well-formed response through unchanged', () => {
    const out = validateClassified(good);
    assert.equal(out.intent, 'skill');
    assert.equal(out.skill, 'stealth');
    assert.equal(out.dc, 15);
    assert.equal(out.fellBack, false);
  });

  it('accepts every intent the schema declares', () => {
    for (const intent of INTENTS) {
      assert.equal(validateClassified({ ...good, intent }).intent, intent);
    }
  });

  it('refuses an intent the resolver has never heard of', () => {
    const out = validateClassified({ ...good, intent: 'yeet' });
    assert.equal(out.intent, 'impossible', 'an unknown intent must not reach the resolver');
    assert.equal(out.fellBack, true);
  });

  it('fails toward impossible, which changes nothing', () => {
    // 'impossible' is the one intent guaranteed not to invent a state change —
    // the only safe direction to fail in.
    for (const junk of [null, undefined, 'a string', 42, []]) {
      const out = validateClassified(junk);
      assert.equal(out.intent, 'impossible');
      assert.equal(out.fellBack, true);
    }
  });

  it('drops a direction that is not a direction', () => {
    assert.equal(validateClassified({ ...good, intent: 'move', direction: 'up' }).direction, null);
    assert.equal(validateClassified({ ...good, intent: 'move', direction: 'NORTH' }).direction, 'north');
  });

  it('normalises empty and non-string fields to null', () => {
    const out = validateClassified({ ...good, target_id: '   ', skill: 7 });
    assert.equal(out.target_id, null);
    assert.equal(out.skill, null);
  });

  it('always returns the full shape the resolver destructures', () => {
    for (const input of [good, {}, null, { intent: 'nonsense' }]) {
      const out = validateClassified(input);
      for (const k of ['intent', 'target_id', 'direction', 'skill', 'dc', 'reason']) {
        assert.ok(k in out, `${k} missing — the resolver reads it unconditionally`);
      }
    }
  });

  it('keeps the model\'s reason when it gave one, even on a fallback', () => {
    assert.equal(validateClassified({ intent: 'yeet', reason: 'tried to vault the rail' }).reason,
      'tried to vault the rail');
  });
});

describe('narrator responses', () => {
  it('passes narration through with its other fields intact', () => {
    const out = validateNarration({ narration: 'The door groans open.', mood: 'tense' });
    assert.equal(out.narration, 'The door groans open.');
    assert.equal(out.mood, 'tense', 'unknown fields survive — only narration is required');
  });

  it('trims, because a whitespace narration renders as a blank turn', () => {
    assert.equal(validateNarration({ narration: '  The hall is silent.  ' }).narration, 'The hall is silent.');
  });

  it('rejects a response with nothing to read', () => {
    for (const bad of [null, undefined, {}, { narration: '' }, { narration: '   ' },
                       { narration: null }, { narration: 42 }, 'just a string']) {
      assert.equal(validateNarration(bad), null,
        `${JSON.stringify(bad)} must not commit a turn behind a blank screen`);
    }
  });
});
