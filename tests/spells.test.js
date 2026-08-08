// tests/spells.test.js — the caster adapter.
//
// Mirror-tested against the vendored engine, like every other pure module here:
// src/game/spells.js imports the Spektrum-bound rules shim, so the test builds
// the same logic over vendor/bag-of-holding directly. What is asserted is the
// contract — a wizard gets a wizard's list, slots are spent and returned, and
// nothing offers a spell the character cannot actually cast.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SRD, Spellcasting, spellsFor, maxSpellLevel, createEngine,
} from '../vendor/bag-of-holding/index.js';

const engine = createEngine();

function sheetFor(classId, level = 1, scores = null) {
  const record = {
    id: 'pc-1', name: 'Test', classId, speciesId: 'human', backgroundId: 'sage',
    level,
    abilityScores: scores ?? { str: 10, dex: 14, con: 14, int: 16, wis: 15, cha: 10 },
    equipment: { weaponIds: [] }, conditions: [], exhaustion: 0, xp: 0, hpCurrent: 10,
  };
  return { record, sheet: engine.deriveSheet(record) };
}

// ─── The pieces spells.js composes ──────────────────────────────────────────
// (mirrored here so the assertions run without importing the Spektrum-bound
// module — the same convention the rest of tests/ uses)

function cantripsKnownAt(classId, level) {
  const table = SRD.classes?.[classId]?.spellcasting?.cantripsKnown ?? {};
  let known = 0;
  for (const [at, n] of Object.entries(table)) if (level >= Number(at)) known = Math.max(known, n);
  return known;
}

// Damage first, then healing, then utility — see the note in src/game/spells.js.
function byUsefulness(a, b) {
  const rank = (s) => (s.damage ? 0 : s.healing ? 1 : 2);
  return rank(a) - rank(b) || a.level - b.level || a.name.localeCompare(b.name);
}

function defaultLoadout(record, sheet) {
  const sc = sheet.spellcasting;
  if (!sc) return null;
  const progression = SRD.classes[record.classId].spellcasting.progression;
  const abilityMod  = sheet.abilityScores.mod[sc.ability] ?? 0;
  const level       = record.level ?? 1;
  const preparedMax = Spellcasting.preparedSpellCount({ casterLevel: level, abilityMod, progression });
  return {
    cantrips: spellsFor(record.classId, { level: 0 }).sort(byUsefulness)
      .slice(0, cantripsKnownAt(record.classId, level)).map(s => s.id),
    prepared: spellsFor(record.classId, { maxLevel: maxSpellLevel(level, progression) })
      .filter(s => s.level > 0).sort(byUsefulness).slice(0, preparedMax).map(s => s.id),
    slots: Spellcasting.freshSlots(progression, level),
  };
}

function lowestSlotFor(slots, level) {
  for (const s of (slots ?? [])) if (s.level >= level && s.used < s.max) return s.level;
  return null;
}

function splitSpec(spec) {
  const text = String(spec ?? '').trim();
  if (/^\d+$/.test(text)) return { damageDice: null, damageMod: Number(text) };
  const m = /^\s*(\d*d\d+)\s*([+-]\s*\d+)?\s*$/i.exec(text);
  if (!m) return { damageDice: text, damageMod: 0 };
  return { damageDice: m[1], damageMod: m[2] ? Number(m[2].replace(/\s+/g, '')) : 0 };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('caster loadout', () => {
  it('gives a level-1 wizard cantrips, prepared spells, and slots', () => {
    const { record, sheet } = sheetFor('wizard', 1);
    const magic = defaultLoadout(record, sheet);
    assert.equal(magic.cantrips.length, 3, 'a level-1 wizard knows 3 cantrips');
    assert.ok(magic.prepared.length > 0, 'and has something prepared');
    assert.deepEqual(magic.slots, [{ level: 1, used: 0, max: 2 }]);
  });

  it('gives a level-1 cleric its own list, not the wizard one', () => {
    const { record, sheet } = sheetFor('cleric', 1);
    const magic = defaultLoadout(record, sheet);
    assert.ok(magic.cantrips.includes('sacred-flame'), 'cleric cantrips');
    assert.ok(!magic.cantrips.includes('fire-bolt'), 'and not the wizard ones');
    assert.ok(magic.prepared.includes('cure-wounds') || magic.prepared.includes('guiding-bolt'));
    assert.ok(!magic.prepared.includes('magic-missile'), 'no arcane spells on a cleric');
  });

  it('never prepares a spell above the slot ceiling', () => {
    for (const cls of ['wizard', 'cleric']) {
      for (const level of [1, 3, 5, 9, 17]) {
        const { record, sheet } = sheetFor(cls, level);
        const magic = defaultLoadout(record, sheet);
        const ceiling = maxSpellLevel(level, 'full');
        for (const id of magic.prepared) {
          assert.ok(SRD.spells[id].level <= ceiling,
            `${cls} L${level} prepared ${id} (level ${SRD.spells[id].level}) above ceiling ${ceiling}`);
        }
      }
    }
  });

  it('is deterministic across calls', () => {
    const { record, sheet } = sheetFor('wizard', 5);
    assert.deepEqual(defaultLoadout(record, sheet), defaultLoadout(record, sheet));
  });

  it('returns nothing for a non-caster', () => {
    const { record, sheet } = sheetFor('fighter', 5);
    assert.equal(defaultLoadout(record, sheet), null);
  });
});

describe('slot accounting', () => {
  it('spends a slot on a leveled cast and none on a cantrip', () => {
    const slots = Spellcasting.freshSlots('full', 3);
    const actor = { id: 'pc', spellSlots: slots, spellsPrepared: ['magic-missile'] };

    const cantrip = Spellcasting.castSpell(actor, SRD.spells['fire-bolt'], {});
    assert.equal(cantrip.ok, true);
    assert.deepEqual(cantrip.actor.spellSlots, slots, 'a cantrip costs nothing');

    const leveled = Spellcasting.castSpell(actor, SRD.spells['magic-missile'], { slotLevel: 1 });
    assert.equal(leveled.ok, true);
    assert.equal(leveled.actor.spellSlots[0].used, 1);
  });

  it('refuses when the slots are gone, and says why', () => {
    const actor = { id: 'pc', spellSlots: [{ level: 1, used: 2, max: 2 }], spellsPrepared: [] };
    const out = Spellcasting.castSpell(actor, SRD.spells['magic-missile'], { slotLevel: 1 });
    assert.equal(out.ok, false);
    assert.ok(out.reason, 'a refusal always carries a reason');
  });

  it('burns the bigger slot and casts at that level when it is all that is left', () => {
    const actor = { id: 'pc', spellSlots: [{ level: 1, used: 2, max: 2 }, { level: 2, used: 0, max: 2 }], spellsPrepared: [] };
    const out = Spellcasting.castSpell(actor, SRD.spells['magic-missile'], { slotLevel: 1 });
    assert.equal(out.ok, true);
    assert.equal(out.castLevel, 2, 'a 2nd-level slot spent must cast at 2nd level');
  });

  it('lowestSlotFor agrees with what the cast actually takes', () => {
    const slots = [{ level: 1, used: 2, max: 2 }, { level: 2, used: 0, max: 2 }, { level: 3, used: 0, max: 1 }];
    assert.equal(lowestSlotFor(slots, 1), 2);
    assert.equal(lowestSlotFor(slots, 3), 3);
    assert.equal(lowestSlotFor(slots, 4), null);

    const actor = { id: 'pc', spellSlots: slots, spellsPrepared: [] };
    const out = Spellcasting.castSpell(actor, SRD.spells['magic-missile'], { slotLevel: 1 });
    assert.equal(out.castLevel, lowestSlotFor(slots, 1));
  });

  it('a long rest returns every slot; a short rest returns none to a full caster', () => {
    const spent = [{ level: 1, used: 4, max: 4 }, { level: 2, used: 2, max: 2 }];
    assert.deepEqual(Spellcasting.longRest(spent), [{ level: 1, used: 0, max: 4 }, { level: 2, used: 0, max: 2 }]);
    assert.deepEqual(Spellcasting.shortRest(spent), spent);
  });
});

describe('damage specs', () => {
  it('scales a cantrip at the SRD tiers and nowhere else', () => {
    const fireBolt = SRD.spells['fire-bolt'];
    assert.equal(Spellcasting.scaledDamageSpec(fireBolt.damage, 1),  '1d10');
    assert.equal(Spellcasting.scaledDamageSpec(fireBolt.damage, 4),  '1d10');
    assert.equal(Spellcasting.scaledDamageSpec(fireBolt.damage, 5),  '2d10');
    assert.equal(Spellcasting.scaledDamageSpec(fireBolt.damage, 11), '3d10');
    assert.equal(Spellcasting.scaledDamageSpec(fireBolt.damage, 17), '4d10');
  });

  it('splits every damage and healing spec the registry ships', () => {
    for (const spell of Object.values(SRD.spells)) {
      for (const spec of [spell.damage, spell.healing]) {
        if (!spec) continue;
        const resolved = String(spec).replace(/\+\s*mod/i, '+3');
        const { damageDice, damageMod } = splitSpec(resolved);
        assert.equal(typeof damageMod, 'number');
        if (damageDice == null) {
          // A flat spec (Heal is "70") has nothing to roll.
          assert.ok(damageMod > 0, `${spell.id}: flat spec '${resolved}' resolved to ${damageMod}`);
          continue;
        }
        assert.match(damageDice, /^\d*d\d+$/, `${spell.id}: '${resolved}' → dice '${damageDice}'`);
        // And the engine's roller accepts what the split produced.
        const rolled = engine.Combat.damageRoll({ damageDice, damageMod, critical: false });
        assert.ok(rolled.total >= damageMod, `${spell.id} rolled ${rolled.total}`);
      }
    }
  });

  it('substitutes the ability modifier into a healing spec', () => {
    const cure = SRD.spells['cure-wounds'];
    assert.match(cure.healing, /mod/, 'the registry writes healing as "+mod"');
    assert.deepEqual(splitSpec(cure.healing.replace(/\+\s*mod/i, '+3')), { damageDice: '1d8', damageMod: 3 });
    assert.deepEqual(splitSpec(cure.healing.replace(/\+\s*mod/i, '-1')), { damageDice: '1d8', damageMod: -1 });
  });
});

describe('spell lists are the class lists, not a guess', () => {
  it('offers a wizard no healing and a cleric no fireball', () => {
    const wizard = spellsFor('wizard').map(s => s.id);
    const cleric = spellsFor('cleric').map(s => s.id);
    assert.ok(!wizard.includes('cure-wounds'));
    assert.ok(!wizard.includes('healing-word'));
    assert.ok(!cleric.includes('fireball'));
    assert.ok(cleric.includes('cure-wounds'));
    assert.ok(wizard.includes('fireball'));
  });

  it('every id a loadout produces resolves to a real spell record', () => {
    for (const cls of ['wizard', 'cleric']) {
      for (const level of [1, 5, 11, 20]) {
        const { record, sheet } = sheetFor(cls, level);
        const magic = defaultLoadout(record, sheet);
        for (const id of [...magic.cantrips, ...magic.prepared]) {
          assert.ok(SRD.spells[id], `${cls} L${level} prepared unknown spell '${id}'`);
        }
      }
    }
  });
});
