// Locale resolution order (doc 19 §4) — the mechanism that makes packs cheap.
//
// A setting pack re-points roughly two hundred existing `t()` / `tRaw()` call
// sites without touching one of them, by putting its content in front of the
// base bundles. That only works if resolution is per KEY rather than per root:
// a pack that renames the rooms must not shadow the creature names it left
// alone. And the order has to hold in both directions — a pack translated into
// Dutch later must theme a Dutch game rather than splitting it half-fantasy.
//
// i18n.js itself reads localStorage at import time, which is why the order
// lives in resolve.js and is tested here on plain objects.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPath, orderedRoots, resolveKey, interpolate } from '../src/i18n/resolve.js';

const EN = { world: { rooms: { entrance: ['A doorway.'], hall: ['A hall.'] }, houseStyles: ['old hold'] },
             meta: { helpList: '/help' }, chips: { attackCmd: 'I attack' } };
const NL = { world: { rooms: { entrance: ['Een deuropening.'], hall: ['Een hal.'] }, houseStyles: ['oude burcht'] },
             meta: { helpList: '/help' }, chips: { attackCmd: 'Ik val aan' } };
const PACK = {
  en: { world: { rooms: { entrance: ['A gate landing.'] } } },
  nl: { world: { houseStyles: ['stapel'] } },
};

const roots = (locale, overlay = PACK) => orderedRoots({ overlay, bundles: { en: EN, nl: NL }, locale, fallback: 'en' });

describe('resolution order', () => {
  it('prefers the pack, then the pack in English, then the bundles', () => {
    assert.deepEqual(resolveKey(roots('nl'), 'world.rooms.entrance', { allowNonString: true }),
      ['A gate landing.'],
      'a pack key the pack has not translated still themes a Dutch game');
    assert.deepEqual(resolveKey(roots('nl'), 'world.houseStyles', { allowNonString: true }),
      ['stapel'], 'the pack’s own Dutch wins over its English');
    assert.deepEqual(resolveKey(roots('nl'), 'world.rooms.hall', { allowNonString: true }),
      ['Een hal.'], 'a key the pack never mentions falls through to the base bundle');
  });

  it('is per key, not per root — a sparse pack shadows nothing it did not write', () => {
    assert.equal(resolveKey(roots('en'), 'chips.attackCmd'), 'I attack');
    assert.deepEqual(resolveKey(roots('en'), 'world.rooms.entrance', { allowNonString: true }), ['A gate landing.']);
    assert.deepEqual(resolveKey(roots('en'), 'world.houseStyles', { allowNonString: true }), ['old hold']);
  });

  it('with no overlay, behaves exactly as the two-bundle lookup always did', () => {
    assert.equal(resolveKey(roots('nl', null), 'chips.attackCmd'), 'Ik val aan');
    assert.equal(resolveKey(roots('en', null), 'chips.attackCmd'), 'I attack');
    assert.equal(resolveKey(roots('nl', null), 'nothing.here'), undefined);
  });

  it('drops duplicate roots so an English player is not searched twice', () => {
    assert.equal(orderedRoots({ overlay: null, bundles: { en: EN, nl: NL }, locale: 'en' }).length, 1);
    assert.equal(orderedRoots({ overlay: PACK, bundles: { en: EN, nl: NL }, locale: 'en' }).length, 2);
    assert.equal(orderedRoots({ overlay: PACK, bundles: { en: EN, nl: NL }, locale: 'nl' }).length, 4);
  });

  it('falls back for a locale nothing has been written in', () => {
    assert.equal(resolveKey(roots('de'), 'chips.attackCmd'), 'I attack');
  });
});

describe('string versus raw lookups', () => {
  it('a non-string where a string was asked for falls through to the next root', () => {
    const overlay = { en: { chips: { attackCmd: { oops: 'a table' } } } };
    assert.equal(resolveKey(roots('en', overlay), 'chips.attackCmd'), 'I attack',
      'a malformed pack entry must degrade to the base string, not render an object');
    assert.deepEqual(resolveKey(roots('en', overlay), 'chips.attackCmd', { allowNonString: true }), { oops: 'a table' });
  });

  it('getPath walks safely off the end of anything', () => {
    assert.equal(getPath(EN, 'world.rooms.nope'), undefined);
    assert.equal(getPath(EN, 'a.b.c.d.e'), undefined);
    assert.equal(getPath(null, 'world'), undefined);
    assert.equal(getPath(EN, ''), undefined);
  });
});

describe('interpolation', () => {
  it('replaces every occurrence of every param', () => {
    assert.equal(interpolate('{{a}} and {{b}} and {{a}}', { a: 'x', b: 'y' }), 'x and y and x');
  });

  it('leaves the string alone when there is nothing to put in it', () => {
    assert.equal(interpolate('plain', null), 'plain');
    assert.equal(interpolate('{{missing}}', { other: 1 }), '{{missing}}');
  });
});
