// The deterministic-fallback promise: every classified intent either changes
// the world through the rules, or is explicitly declared to change nothing.
//
// Before this, 9 of 14 intents returned a bare { intent } and the narrator
// improvised: "rest" described the party recovering while their hit points sat
// unchanged, and a successful stealth check was narrated as success in the same
// paragraph as the retaliation it should have prevented. The project's own
// pillar — always fall back on deterministic systems — was kept for 5/14ths of
// play.
//
// Reads the source rather than executing the resolver, which binds the Spektrum
// singleton at import time (the repo's mirror-testing convention).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIFIER_SCHEMA } from '../src/ai/schemas.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolverSrc = fs.readFileSync(path.join(ROOT, 'src/game/resolver.js'), 'utf8');
const loopSrc     = fs.readFileSync(path.join(ROOT, 'src/game/loop.js'), 'utf8');
const enPrompts   = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/en.json'), 'utf8'));

const INTENTS = CLASSIFIER_SCHEMA.properties.intent.enum;

// Intents the resolver handles with real mechanics (dice, state, validation).
const MECHANIZED = ['attack', 'skill', 'move', 'take', 'unlock', 'rest', 'flee', 'use', 'look'];

describe('intent coverage', () => {
  it('the classifier can express fleeing and using an item', () => {
    assert.ok(INTENTS.includes('flee'), 'fleeing was unreachable — no intent existed for it');
    assert.ok(INTENTS.includes('use'),  'carried items could not be used');
  });

  it('every mechanized intent has a branch in the resolver', () => {
    for (const intent of MECHANIZED) {
      assert.match(resolverSrc, new RegExp(`intent === '${intent}'`),
        `resolver has no branch for '${intent}' — the narrator would improvise it`);
    }
  });

  it('more than half the intents now resolve mechanically', () => {
    const ratio = MECHANIZED.length / INTENTS.length;
    assert.ok(ratio > 0.5, `only ${MECHANIZED.length}/${INTENTS.length} intents are mechanized`);
  });

  it('everything else is explicitly declared to have no effect', () => {
    assert.match(resolverSrc, /return \{ intent, noEffect: true \}/,
      'unmechanized intents must say so rather than returning a bare intent');
  });
});

describe('the narrator is told what it may not do', () => {
  const prompt = enPrompts.ai.narratorPrompt;

  it('forbids inventing exits, items, rooms and NPCs', () => {
    assert.match(prompt, /Never invent an exit, door, room, item, or NPC/);
  });

  it('forbids narrating state changes the rules did not make', () => {
    assert.match(prompt, /no healing, no death, no gained or lost items/);
  });

  it('handles the no-effect case explicitly', () => {
    assert.match(prompt, /noEffect is true/);
    assert.match(prompt, /Do not imply any lasting change/);
  });

  it('still invites invention at the level that gives the world texture', () => {
    assert.match(prompt, /MAY INVENT FREELY/);
    assert.match(prompt, /mould on a curtain|cracked bell/);
  });

  it('no longer claims a window it does not receive', () => {
    assert.ok(!/last 3 turns/.test(prompt),
      'the prompt used to claim "last 3 turns" while receiving 3 entries — 1.5 turns');
  });

  it('takes the world\'s tone instead of hardcoding one', () => {
    assert.match(prompt, /\{\{tone\}\}/);
    assert.ok(!/Setting: gritty low fantasy/.test(prompt),
      'tone was hardcoded regardless of what the blueprint rolled');
  });

  it('honours details it established earlier', () => {
    assert.match(prompt, /knownDetails/);
  });
});

describe('rest actually rests', () => {
  it('refuses to rest with hostiles present', () => {
    assert.match(resolverSrc, /You cannot rest with enemies nearby/);
  });
  it('rolls a hit die through the audited stream', () => {
    assert.match(resolverSrc, /roller\.rollDie\(8\)/,
      'healing must come from the seeded stream so replay stays verifiable');
  });
  it('commits the recovered hit points', () => {
    assert.match(resolverSrc, /party\.pc\.record\.hpCurrent/);
  });
});

describe('escaping actually escapes', () => {
  it('a successful flight is not punished by the enemy it escaped', () => {
    assert.match(loopSrc, /const escaped\s+= resolved\.intent === 'flee' && resolved\.success === true/);
    assert.match(loopSrc, /goblinSurvived && !escaped/);
  });
  it('fleeing needs somewhere to run', () => {
    assert.match(resolverSrc, /There is nowhere to run/);
  });
});
