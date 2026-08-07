// Prompt contract regression (Epic E11.S3).
//
// The product's core is a set of prompts and schemas, and nothing tested them.
// Model responses were never validated against the schemas that were sent, and
// no test would have caught a prompt losing a rule, a placeholder going
// unfilled, or the two locales drifting apart — all of which had happened.
//
// This is the cheap half of a prompt eval: it needs no API key and runs in
// milliseconds, so it can gate every push. It checks the things that are true
// of a correct prompt regardless of which model reads it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as SCHEMAS from '../src/ai/schemas.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (loc) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/${loc}.json`), 'utf8'));
const en = read('en');
const nl = read('nl');

const PROMPT_KEYS = Object.keys(en.ai).filter(k => k.endsWith('Prompt'));
const placeholders = (text) => new Set([...String(text).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]));

describe('every prompt exists in both locales', () => {
  it('finds the prompt set', () => {
    assert.ok(PROMPT_KEYS.length >= 8, `only ${PROMPT_KEYS.length} prompts found`);
  });

  for (const key of PROMPT_KEYS) {
    it(`${key} is translated and takes the same parameters`, () => {
      assert.ok(nl.ai[key], `nl is missing ai.${key} — the Dutch player gets an English prompt`);
      assert.deepEqual([...placeholders(nl.ai[key])].sort(), [...placeholders(en.ai[key])].sort(),
        `ai.${key} placeholders differ between locales — one of them will render {{unfilled}}`);
    });
  }
});

describe('prompts are non-trivial and well-formed', () => {
  // A handful of these keys are the short user-turn message that accompanies a
  // system prompt ("Narrate this turn."), so length is only asserted for the
  // system prompts that carry the actual instructions.
  const SYSTEM_PROMPTS = PROMPT_KEYS.filter(k => en.ai[k].length > 60);

  it('most prompts are substantial system prompts', () => {
    assert.ok(SYSTEM_PROMPTS.length >= 8, `only ${SYSTEM_PROMPTS.length} system prompts`);
  });

  for (const key of PROMPT_KEYS) {
    it(`${key} is well-formed`, () => {
      const text = en.ai[key];
      assert.ok(text.trim().length > 10, `ai.${key} is effectively empty`);
      assert.ok(!/\{\{\s*\}\}/.test(text), 'empty placeholder');
      assert.ok(!/\{\{[^}]*\{\{/.test(text), 'nested placeholder');
    });
  }
});

describe('JSON-returning prompts agree with their schemas', () => {
  const pairs = [
    ['narratorPrompt', 'NARRATOR_SCHEMA'],
    ['canonPrompt',    'CANON_SCHEMA'],
    ['beatCheckPrompt', 'BEAT_CHECK_SCHEMA'],
  ];
  for (const [promptKey, schemaKey] of pairs) {
    it(`${promptKey} asks for every required field of ${schemaKey}`, () => {
      const schema = SCHEMAS[schemaKey];
      const text   = en.ai[promptKey].toLowerCase();
      for (const field of schema.required ?? []) {
        assert.ok(text.includes(field.toLowerCase()),
          `${promptKey} never mentions '${field}', which ${schemaKey} requires`);
      }
    });
  }

  it('schemas that claim strict mode list every property as required', () => {
    // A strict-enforcing provider rejects a json_schema whose `required` is not
    // exhaustive; the client sends strict: true for all of them.
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      if (!schema || typeof schema !== 'object' || schema.type !== 'object') continue;
      const props = Object.keys(schema.properties ?? {});
      assert.deepEqual([...(schema.required ?? [])].sort(), props.sort(),
        `${name} is sent with strict: true but its required list is not exhaustive`);
    }
  });

  it('every object schema forbids extra properties', () => {
    for (const [name, schema] of Object.entries(SCHEMAS)) {
      if (!schema || typeof schema !== 'object' || schema.type !== 'object') continue;
      assert.equal(schema.additionalProperties, false, `${name} allows unspecified fields`);
    }
  });
});

describe('the classifier and the resolver share one vocabulary', () => {
  it('every intent the classifier can emit is handled somewhere', () => {
    const resolver = fs.readFileSync(path.join(ROOT, 'src/game/resolver.js'), 'utf8');
    const intents  = SCHEMAS.CLASSIFIER_SCHEMA.properties.intent.enum;
    // Either a dedicated branch, or the explicit no-effect fallthrough.
    const handled = intents.filter(i => resolver.includes(`intent === '${i}'`));
    assert.ok(resolver.includes('noEffect: true'),
      'unhandled intents must be declared as having no effect');
    assert.ok(handled.length >= 9, `only ${handled.length}/${intents.length} intents have real mechanics`);
  });

  it('the settlement classifier only emits intents the town loop routes', () => {
    const flow    = fs.readFileSync(path.join(ROOT, 'src/game/flow.js'), 'utf8');
    const intents = SCHEMAS.SETTLEMENT_CLASSIFIER_SCHEMA.properties.intent.enum;
    for (const intent of intents) {
      if (intent === 'meta') continue;   // handled by the /command path
      assert.ok(flow.includes(`'${intent}'`), `settlement intent '${intent}' is never routed`);
    }
  });
});
