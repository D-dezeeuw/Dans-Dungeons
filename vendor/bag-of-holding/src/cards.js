// === Reference card generator (4.3.0 row) ===
//
// Printable reference material as PURE DATA — the roadmap's explicit
// boundary: "no rendering library bake-in; the host runs the layout
// pass." Every function returns the same shape, a Card:
//
//   { kind, id, title, subtitle?, sections: [{ heading?, lines: string[] }],
//     footer? }
//
// so one host-side card layout renders all of them — spell cards, item
// cards, monster cards, class feature cards, and the one-page combat
// cheat-sheet. Lines are plain strings, pre-formatted from registry
// fields; a host that wants richer layout still has the raw records.

const card = (kind, id, title, sections, extra = {}) =>
  Object.freeze({ kind, id, title, sections: Object.freeze(sections.map((s) => Object.freeze({
    ...s, lines: Object.freeze([...s.lines]),
  }))), ...extra });

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A per-spell card from a spell record. */
export function spellCard(spell) {
  if (!spell?.id) throw new Error('spellCard: a spell record with an id is required');
  const head = [];
  head.push(`Level ${spell.level === 0 ? 'Cantrip' : spell.level} · ${cap(spell.school)}`);
  if (spell.range) head.push(`Range: ${spell.range}`);
  if (spell.duration) head.push(`Duration: ${spell.duration}${spell.concentration ? ' (concentration)' : ''}`);
  const c = spell.components ?? {};
  const comps = [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(', ');
  if (comps) head.push(`Components: ${comps}`);

  const mech = [];
  if (spell.damage) mech.push(`Damage: ${spell.damage}${spell.damageType ? ` ${spell.damageType}` : ''}`);
  if (spell.healing) mech.push(`Healing: ${spell.healing}`);
  if (spell.save) mech.push(`Save: ${spell.save.toUpperCase()}${spell.halfOnSave ? ' (half on success)' : ''}`);
  if (spell.area) mech.push(`Area: ${spell.area}`);
  if (spell.projectiles) mech.push(`Projectiles: ${spell.projectiles}`);
  if (spell.acBonus) mech.push(`AC bonus: +${spell.acBonus}`);

  const tags = [];
  if (spell.ritual) tags.push('Ritual');
  if (spell.reaction) tags.push('Reaction');
  if (spell.bonusAction) tags.push('Bonus action');
  if (typeof spell.upcast === 'function') tags.push('Upcastable');

  const sections = [{ lines: head }];
  if (mech.length) sections.push({ heading: 'Effect', lines: mech });
  if (tags.length) sections.push({ heading: 'Tags', lines: [tags.join(' · ')] });
  if (spell.classes?.length) sections.push({ heading: 'Classes', lines: [spell.classes.join(', ')] });
  return card('spell', spell.id, spell.name, sections);
}

/** A per-item card from an item record. */
export function itemCard(item) {
  if (!item?.id) throw new Error('itemCard: an item record with an id is required');
  const head = [`${cap(item.type)}${item.rarity ? ` · ${cap(item.rarity)}` : ''}`];
  if (item.attunement) {
    const req = item.requiresAttunement;
    const detail = req?.classId ? ` (${req.classId})`
      : req?.spellcaster ? ' (spellcaster)'
      : req?.abilityMin ? ` (${Object.entries(req.abilityMin).map(([a, v]) => `${a.toUpperCase()} ${v}+`).join(', ')})`
      : '';
    head.push(`Requires attunement${detail}`);
  }
  const mech = [];
  if (item.damage) mech.push(`Damage: ${item.damage}${item.damageType ? ` ${item.damageType}` : ''}`);
  if (item.ac) mech.push(`AC: ${item.ac}${item.addsDex ? ' + DEX' + (item.maxDex ? ` (max ${item.maxDex})` : '') : ''}`);
  if (item.acBonus) mech.push(`AC bonus: +${item.acBonus}`);
  if (item.heals) mech.push(`Heals: ${item.heals}`);
  if (item.charges) {
    mech.push(`Charges: ${item.charges.max}, recovers ${item.charges.recovers} on ${item.charges.rechargesOn}`);
  }
  if (item.savingThrow?.bonus !== undefined) mech.push(`Item save: +${item.savingThrow.bonus}`);
  const tags = [];
  if (item.cursed) tags.push('Cursed');
  if (item.sentient) tags.push(`Sentient (conflict DC ${item.sentient.conflictDc ?? '—'})`);
  const sections = [{ lines: head }];
  if (mech.length) sections.push({ heading: 'Mechanics', lines: mech });
  if (tags.length) sections.push({ heading: 'Tags', lines: [tags.join(' · ')] });
  return card('item', item.id, item.name, sections);
}

/** A per-monster card from a stat block. */
export function monsterCard(monster) {
  if (!monster?.id) throw new Error('monsterCard: a monster record with an id is required');
  const head = [
    `CR ${monster.cr} · AC ${monster.ac} · HP ${monster.hp} · Speed ${monster.speed ?? 30} ft`,
  ];
  const a = monster.abilityScores ?? {};
  head.push(['str', 'dex', 'con', 'int', 'wis', 'cha']
    .map((k) => `${k.toUpperCase()} ${a[k] ?? 10}`).join('  '));
  const attacks = (monster.attacks ?? []).map(
    (atk) => `${atk.name}: +${atk.attackBonus} to hit, ${atk.damage}${atk.damageType ? ` ${atk.damageType}` : ''}`);
  const traits = [...(monster.traits ?? [])];
  const special = [];
  if (monster.multiattack) special.push('Multiattack');
  if (monster.legendaryActions) special.push(`Legendary actions (${monster.legendaryActions.options.length})`);
  if (monster.legendaryResistance) special.push(`Legendary resistance (${monster.legendaryResistance.uses})`);
  if (monster.lairActions) special.push('Lair actions');
  if (monster.mythicActions) special.push('Mythic actions');
  if (monster.innateSpellcasting) special.push('Innate spellcasting');
  const sections = [{ lines: head }];
  if (attacks.length) sections.push({ heading: 'Attacks', lines: attacks });
  if (special.length) sections.push({ heading: 'Special', lines: [special.join(' · ')] });
  if (traits.length) sections.push({ heading: 'Traits', lines: traits });
  return card('monster', monster.id, monster.name, sections);
}

/** A per-class feature card: hit die, saves, spellcasting, features by level. */
export function classCard(classDef) {
  if (!classDef?.id) throw new Error('classCard: a class def with an id is required');
  const head = [
    `Hit die: d${classDef.hitDie}`,
    `Primary: ${classDef.primaryAbility?.toUpperCase?.() ?? '—'}`,
    `Saves: ${(classDef.savingThrowProficiencies ?? []).map((s) => s.toUpperCase()).join(', ')}`,
  ];
  if (classDef.spellcasting) {
    head.push(`Spellcasting: ${classDef.spellcasting.ability.toUpperCase()} (${classDef.spellcasting.progression}, ${classDef.spellcasting.preparation})`);
  }
  const features = Object.entries(classDef.features ?? {})
    .filter(([, list]) => list.length)
    .map(([level, list]) => `L${level}: ${list.join(', ')}`);
  const sections = [{ lines: head }];
  if (features.length) sections.push({ heading: 'Features', lines: features });
  const subclasses = Object.values(classDef.subclasses ?? {}).map((s) => s.name);
  if (subclasses.length) sections.push({ heading: 'Subclasses', lines: [subclasses.join(', ')] });
  return card('class', classDef.id, classDef.name, sections);
}

/**
 * The one-page combat cheat-sheet, generated from the engine so the
 * numbers on the page are the numbers in play (crit faces, death-save
 * DC and counts, attunement cap, rest pacing all read from the LIVE
 * rules — a gritty table prints a gritty sheet).
 */
export function combatCheatSheet(engine) {
  if (!engine?.rules) throw new Error('combatCheatSheet: an engine instance is required');
  const r = engine.rules;
  const durations = engine.Rest.restDurations();
  return card('cheat-sheet', 'combat', 'Combat Reference', [
    {
      heading: 'Your turn',
      lines: [
        'Move up to your speed (split freely around actions)',
        'One action: Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search, Shove, Grapple, Influence',
        'One bonus action (if a feature grants one) · One reaction per round',
        'One free object interaction',
      ],
    },
    {
      heading: 'Attacks',
      lines: [
        'Attack roll: d20 + attack bonus vs AC',
        `Critical hit on ${r.critOn.join(', ')} · Fumble on ${r.fumbleOn.join(', ')}`,
        'Advantage/disadvantage: roll two d20, take higher/lower (never stacks)',
        `Minimum damage on a hit: ${r.damageFloor}`,
      ],
    },
    {
      heading: 'Dropping to 0',
      lines: [
        `Death saves: DC ${r.deathSaveDC}, ${r.deathSaveSuccessesRequired} successes stabilise, ${r.deathSaveSuccessesRequired} failures kill`,
        'Nat 20: back up on 1 hp · Nat 1: two failures',
        'Damage at 0: one failure (two if critical)',
      ],
    },
    {
      heading: 'Conditions to remember',
      lines: [
        'Prone: melee attackers advantaged, ranged disadvantaged; costs half speed to stand',
        'Grappled/Restrained: speed 0 · Restrained also: attacks against advantaged, yours disadvantaged',
        'Unconscious: attacks advantaged, melee hits crit',
        'Exhaustion: -5 ft speed per level, death at 6',
      ],
    },
    {
      heading: 'Resting',
      lines: [
        `Short rest: ${durations.shortRestHours} h — spend Hit Dice, short-rest features refresh`,
        `Long rest: ${durations.longRestHours} h — ${r.longRestHpRecovery === 'none' ? 'NO free hp (slow natural healing)' : 'hp to max'}, ${r.longRestHitDiceRecovery} Hit Dice back, one exhaustion level off`,
        'Attunement: 3 items maximum, attune over a short rest',
      ],
    },
  ]);
}
