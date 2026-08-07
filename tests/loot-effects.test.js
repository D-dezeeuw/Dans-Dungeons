// Loot that does something (Epic E8.S3).
//
// Items were flavour only: a healing potion in the pack healed nothing, and a
// purchase changed the gold total and then sat inert forever. The `use` intent
// did not exist at all, so there was no way to drink the potion even in prose
// that the rules would honour.
//
// Reads the content and the resolver's source rather than executing them, since
// the resolver binds the Spektrum singleton at import time (the repo's
// mirror-testing convention).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (loc) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/${loc}.json`), 'utf8'));
const resolver = fs.readFileSync(path.join(ROOT, 'src/game/resolver.js'), 'utf8');

const en = read('en');
const nl = read('nl');

describe('loot carries mechanical effects', () => {
  it('at least one item is a real consumable', () => {
    const consumables = en.world.loot.filter(i => i.consumable);
    assert.ok(consumables.length > 0, 'nothing in the loot pool could be used');
  });

  it('the healing potion actually heals', () => {
    const potion = en.world.loot.find(i => i.heals);
    assert.ok(potion, 'no healing item exists');
    assert.ok(potion.heals > 0);
    assert.equal(potion.consumable, true, 'drinking it must remove it from the pack');
  });

  it('every item has at least one reason to exist', () => {
    for (const item of en.world.loot) {
      const meaningful = item.heals || item.gold || item.value || item.lore;
      assert.ok(meaningful, `"${item.name}" has no effect, no value and no lore — it is set dressing in an inventory slot`);
    }
  });
});

describe('both locales describe the same items', () => {
  it('the pools are the same length', () => {
    assert.equal(nl.world.loot.length, en.world.loot.length);
  });

  it('mechanical fields match index for index', () => {
    en.world.loot.forEach((item, i) => {
      const other = nl.world.loot[i];
      for (const field of ['heals', 'gold', 'value', 'lore', 'consumable']) {
        assert.equal(other[field], item[field],
          `"${item.name}" and "${other.name}" disagree on ${field} — the Dutch player would get different rules`);
      }
    });
  });

  it('names are actually translated, not copied', () => {
    const identical = en.world.loot.filter((item, i) => item.name === nl.world.loot[i].name);
    assert.equal(identical.length, 0, 'loot names appear untranslated in Dutch');
  });
});

describe('the resolver honours those effects', () => {
  it('drinking restores hit points and consumes the item', () => {
    assert.match(resolver, /item\.heals/);
    assert.match(resolver, /consumed: true/);
    assert.match(resolver, /party\.inventory.*filter/s, 'a consumed item must leave the pack');
  });

  it('found coins reach the purse', () => {
    assert.match(resolver, /item\.gold/);
    assert.match(resolver, /party\.pc\.record\.gold/);
  });

  it('anything else is examined, never invented into an effect', () => {
    assert.match(resolver, /noEffect: true/);
  });

  it('using something you do not carry is refused', () => {
    assert.match(resolver, /You are not carrying that/);
  });
});
