// The classifier fast path.
//
// Chips and the compass submit strings this app itself wrote — "I go north",
// "I take the brass key". Sending those to a model to be told they mean
// {intent:'move', direction:'north'} bought nothing and cost a tiny-tier round
// trip on the majority of turns, since most turns ARE chip turns.
//
// The risk of a fast path is that it swallows input it should not: a player who
// types something interesting must still reach the model. These tests pin both
// halves — our own commands are recognised, everything else falls through.
//
// Mirrors the matcher rather than importing src/ai/classify.js, which binds the
// esbuild-aliased LLM client at import time (the repo's mirror-testing
// convention — see seeded-rolls.test.js).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (loc) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n', `${loc}.json`), 'utf8'));

// t() over one locale table, matching src/i18n/i18n.js interpolation.
function tFor(table) {
  return (key, params = {}) => {
    const raw = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), table) ?? key;
    return String(raw).replace(/\{\{(\w+)\}\}/g, (_, p) => params[p] ?? `{{${p}}}`);
  };
}

const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '');

const intent = (over) => ({
  intent: 'wait', target_id: null, direction: null, skill: null, dc: null,
  reason: 'chip input — classified locally', ...over,
});

function localClassify(t, playerInput, scene = {}) {
  const input = norm(playerInput);
  if (!input) return null;

  for (const dir of ['north', 'south', 'east', 'west']) {
    if (input === norm(t('chips.goDir', { dir: t(`directions.${dir}`) }))) {
      return intent({ intent: 'move', direction: dir });
    }
  }
  if (input === norm(t('chips.unlockCmd'))) return intent({ intent: 'unlock' });
  if (input === norm(t('chips.lookCmd')))   return intent({ intent: 'look' });
  if (input === norm(t('chips.talkCmd')))   return intent({ intent: 'talk' });
  if (input === norm(t('chips.waitCmd')))   return intent({ intent: 'wait' });

  if (input === norm(t('chips.attackCmd'))) {
    const targets = (scene.npcs ?? []).filter(n => n.alive !== false);
    if (targets.length === 1) return intent({ intent: 'attack', target_id: targets[0].id });
    return null;
  }
  for (const item of scene.room?.loot ?? []) {
    if (input === norm(t('chips.takeCmd', { name: item.name }))) {
      return intent({ intent: 'take', target_id: item.id });
    }
  }
  return null;
}

const GOBLIN = { id: 'npc-goblin-1', name: 'Goblin', alive: true };
const KEY    = { id: 'item-key', name: 'brass key' };
const SCENE  = { npcs: [GOBLIN], room: { loot: [KEY] } };

for (const loc of ['en', 'nl']) {
  const t = tFor(load(loc));
  const c = (input, scene = SCENE) => localClassify(t, input, scene);

  describe(`chip commands are classified without a model call (${loc})`, () => {
    it('resolves every compass direction', () => {
      for (const dir of ['north', 'south', 'east', 'west']) {
        const out = c(t('chips.goDir', { dir: t(`directions.${dir}`) }));
        assert.equal(out?.intent, 'move', `${dir} must classify locally in ${loc}`);
        assert.equal(out.direction, dir, 'the English direction id, not the translated word');
      }
    });

    it('resolves the plain action chips', () => {
      assert.equal(c(t('chips.unlockCmd')).intent, 'unlock');
      assert.equal(c(t('chips.lookCmd')).intent,   'look');
      assert.equal(c(t('chips.talkCmd')).intent,   'talk');
      assert.equal(c(t('chips.waitCmd')).intent,   'wait');
    });

    it('binds take to the item actually in the room', () => {
      const out = c(t('chips.takeCmd', { name: KEY.name }));
      assert.equal(out.intent, 'take');
      assert.equal(out.target_id, KEY.id);
    });

    it('falls through for an item that is not here', () => {
      assert.equal(c(t('chips.takeCmd', { name: 'silver crown' })), null,
        'a renamed or absent item must reach the model, not resolve to nothing');
    });

    it('shrugs off trailing punctuation and casing from the input field', () => {
      assert.equal(c(t('chips.goDir', { dir: t('directions.north') }).toUpperCase() + '.')?.direction, 'north');
    });

    it('returns a full classifier-shaped object', () => {
      const out = c(t('chips.lookCmd'));
      for (const k of ['intent', 'target_id', 'direction', 'skill', 'dc', 'reason']) {
        assert.ok(k in out, `${k} must be present — the resolver reads the same shape either way`);
      }
    });
  });

  describe(`the fast path knows what it does not know (${loc})`, () => {
    it('attacks locally only when the target is unambiguous', () => {
      assert.equal(c(t('chips.attackCmd')).target_id, GOBLIN.id);
      const crowd = { npcs: [GOBLIN, { id: 'npc-goblin-2', name: 'Goblin', alive: true }], room: { loot: [] } };
      assert.equal(c(t('chips.attackCmd'), crowd), null, 'two goblins is a real choice — let the model make it');
    });

    it('ignores the dead when counting targets', () => {
      const scene = { npcs: [GOBLIN, { id: 'npc-rat', alive: false }], room: { loot: [] } };
      assert.equal(c(t('chips.attackCmd'), scene).target_id, GOBLIN.id);
    });

    it('passes real player writing to the model', () => {
      for (const typed of ['I sneak along the wall and listen at the door',
                           'ask the goblin who sent him',
                           'north-ish, but quietly']) {
        assert.equal(c(typed), null, `"${typed}" must not be swallowed by the fast path`);
      }
    });

    it('passes empty input through', () => {
      assert.equal(c(''), null);
      assert.equal(c('   '), null);
    });
  });
}

describe('the two locales cannot collide', () => {
  it('a Dutch command is not read as an English one', () => {
    const en = tFor(load('en'));
    const nl = load('nl');
    const nlGo = tFor(nl)('chips.goDir', { dir: tFor(nl)('directions.north') });
    assert.equal(localClassify(en, nlGo), null,
      'the matcher must only recognise the ACTIVE locale, or a locale switch silently misroutes input');
  });
});
