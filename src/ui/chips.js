// src/ui/chips.js — action chips, character chips, skill chips, room chips.
// Also exports SKILLS (shared with actionbar.js) and classAbilities().

import { prefillChip, fireChip } from './input.js';

const actionChipsEl    = () => document.getElementById('action-chips');
const characterChipsEl = () => document.getElementById('character-chips');
const skillChipsEl     = () => document.getElementById('skill-chips');

// ─── Class abilities ──────────────────────────────────────────────────────────
// Level-1 class features not on the derived sheet. Returns display data only.

export function classAbilities(record, sheet) {
  const lvl       = record.level ?? 1;
  const sneakDice = Math.ceil(lvl / 2);
  const dc        = sheet.spellcasting?.saveDC     ?? '?';
  const spAtk     = sheet.spellcasting?.attackBonus ?? '?';

  return {
    fighter: [
      { label: 'Second Wind',  note: `Bonus action: regain 1d10+${lvl} HP.\nOnce per short rest.`,                         text: 'I use Second Wind to heal myself' },
      { label: 'Action Surge', note: 'Take one additional action this turn.\nOnce per short rest.',                         text: 'I use Action Surge for an extra action' },
    ],
    rogue: [
      { label: 'Sneak Attack',   note: `Deal ${sneakDice}d6 extra damage when you have advantage\nor an ally flanks your target.`, text: 'I make a Sneak Attack' },
      { label: 'Cunning Action', note: 'Bonus action: Dash, Disengage, or Hide.\nKeeps you mobile without spending your main action.', text: 'I use Cunning Action to ' },
    ],
    cleric: [
      { label: 'Turn Undead', note: `Channel Divinity: undead within 30 ft must flee.\nWIS save DC ${dc} or be turned for 1 minute.`, text: 'I use Channel Divinity: Turn Undead' },
      { label: 'Cast Spell',  note: `Cast a prepared spell. Targets resist with DC ${dc}.\nConcentration spells last until broken or you cast another.`, text: 'I cast a spell at ' },
    ],
    wizard: [
      { label: 'Arcane Recovery', note: `Short rest: regain spell slots up to level ${Math.ceil(lvl / 2)}.\nOnce per long rest.`, text: 'I use Arcane Recovery' },
      { label: 'Cast Spell',      note: `Cast a prepared spell. +${spAtk} to spell attack rolls.\nHigher spell slots deal more damage or last longer.`, text: 'I cast a spell at ' },
    ],
  }[record.classId] ?? [];
}

// ─── Skills data ──────────────────────────────────────────────────────────────
// Shared with actionbar.js for the word clouds.

export const SKILLS = [
  { id: 'athletics',       label: 'Athletics',       ab: 'STR', desc: 'Climb, jump, swim, or grapple. Raw physical effort against resistance.' },
  { id: 'acrobatics',      label: 'Acrobatics',      ab: 'DEX', desc: 'Balance, tumble, or escape a grapple. Finesse and body control.' },
  { id: 'sleight-of-hand', label: 'Sleight of Hand', ab: 'DEX', desc: 'Pick pockets, plant objects, or perform manual trickery unseen.' },
  { id: 'stealth',         label: 'Stealth',         ab: 'DEX', desc: 'Move silently and stay hidden. Opposed by passive Perception.' },
  { id: 'arcana',          label: 'Arcana',          ab: 'INT', desc: 'Recall lore about spells, magic items, and the planes.' },
  { id: 'history',         label: 'History',         ab: 'INT', desc: 'Recall past events, legendary figures, and ancient civilisations.' },
  { id: 'investigation',   label: 'Investigation',   ab: 'INT', desc: 'Search for clues, find hidden doors, or deduce what happened.' },
  { id: 'nature',          label: 'Nature',          ab: 'INT', desc: 'Identify plants, animals, weather patterns, and natural hazards.' },
  { id: 'religion',        label: 'Religion',        ab: 'INT', desc: 'Recall lore about deities, rites, cults, and holy symbols.' },
  { id: 'animal-handling', label: 'Animal Handling', ab: 'WIS', desc: 'Calm, guide, or read the intent of beasts and mounts.' },
  { id: 'insight',         label: 'Insight',         ab: 'WIS', desc: "Read someone's true feelings or detect when they're lying." },
  { id: 'medicine',        label: 'Medicine',        ab: 'WIS', desc: 'Stabilise a dying creature, diagnose ailments, or tend wounds.' },
  { id: 'perception',      label: 'Perception',      ab: 'WIS', desc: 'Notice threats, spot hidden creatures, or hear distant sounds.' },
  { id: 'survival',        label: 'Survival',        ab: 'WIS', desc: 'Track prey, forage food, navigate terrain, or endure the wild.' },
  { id: 'deception',       label: 'Deception',       ab: 'CHA', desc: 'Lie convincingly, disguise your intent, or create a false impression.' },
  { id: 'intimidation',    label: 'Intimidation',    ab: 'CHA', desc: 'Coerce through threats, menace, or sheer force of presence.' },
  { id: 'performance',     label: 'Performance',     ab: 'CHA', desc: 'Entertain, impersonate, or captivate an audience.' },
  { id: 'persuasion',      label: 'Persuasion',      ab: 'CHA', desc: 'Win someone over through charm, reasoned argument, or diplomacy.' },
];

// ─── Chip renderers ───────────────────────────────────────────────────────────

export function showActionChips(actions) {
  const el = actionChipsEl();
  if (!el) return;
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className   = 'chip';
    btn.textContent = action.label;
    if (action.ariaLabel) btn.setAttribute('aria-label', action.ariaLabel);
    btn.addEventListener('click', () => fireChip(action.value ?? action.label));
    el.appendChild(btn);
  }
}

export function showCharacterChips(record, sheet) {
  const el = characterChipsEl();
  if (!el) return;
  el.innerHTML = '';
  if (!record || !sheet) return;

  for (const atk of (sheet.attacks ?? [])) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.innerHTML =
      `<span class="skill-name">${atk.name}</span>` +
      `<span class="skill-ab">+${atk.attackBonus} ${atk.damageDice}</span>`;
    btn.addEventListener('click', () => prefillChip(`I attack with my ${atk.name}`));
    el.appendChild(btn);
  }

  if (sheet.spellcasting) {
    const info = document.createElement('div');
    info.className = 'char-spell-info';
    info.textContent =
      `Spell save DC ${sheet.spellcasting.saveDC} · spell atk +${sheet.spellcasting.attackBonus}`;
    el.appendChild(info);
  }

  for (const ability of classAbilities(record, sheet)) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.innerHTML =
      `<span class="skill-name">${ability.label}</span>` +
      `<span class="skill-ab">${ability.note}</span>`;
    btn.addEventListener('click', () => prefillChip(ability.text));
    el.appendChild(btn);
  }
}

export function showSkillChips(cooldowns = {}) {
  const el = skillChipsEl();
  if (!el) return;
  el.innerHTML = '';

  for (const skill of SKILLS) {
    const remaining  = cooldowns[skill.id] ?? 0;
    const onCooldown = remaining > 0;
    const btn = document.createElement('button');
    btn.className = 'chip skill-chip' + (onCooldown ? ' disabled' : '');
    btn.disabled = onCooldown;
    btn.innerHTML =
      `<span class="skill-name">${skill.label}</span>` +
      `<span class="skill-ab">${skill.ab}${onCooldown ? ` (${remaining})` : ''}</span>`;
    if (!onCooldown) {
      btn.addEventListener('click', () => prefillChip(`I use ${skill.label}`));
    }
    el.appendChild(btn);
  }
}

export function insertActionChip(label, value) {
  const el = actionChipsEl();
  if (!el) return;
  const btn = document.createElement('button');
  btn.className = 'chip chip-retry';
  btn.textContent = label;
  btn.addEventListener('click', () => fireChip(value));
  el.insertBefore(btn, el.firstChild);
}

export function clearChips() {
  const a = actionChipsEl(), c = characterChipsEl(), s = skillChipsEl();
  if (a) a.innerHTML = '';
  if (c) c.innerHTML = '';
  if (s) s.innerHTML = '';
}

export function showRoomChips(exits, loot) {
  const ICON = { north: '↑', south: '↓', east: '→', west: '←' };
  const cap  = s => s.charAt(0).toUpperCase() + s.slice(1);
  const actions = [
    ...exits.map(e => ({
      label:     `${ICON[e.dir] ?? '→'} ${cap(e.dir)}${e.locked ? ' 🔒' : ''}`,
      ariaLabel: `Go ${e.dir}${e.locked ? ' (locked)' : ''}`,
      value:     `I go ${e.dir}`,
    })),
    ...(loot.filter(i => !i.taken).map(i => ({
      label: `Take ${i.name}`,
      value: `I take the ${i.name}`,
    }))),
    ...(exits.some(e => e.locked) ? [{ label: '🔑 Unlock', value: 'I use the key to unlock the door' }] : []),
    { label: '⚔ Attack',       value: 'I attack' },
    { label: '👁 Look around', value: 'I look around carefully' },
    { label: '💬 Talk',        value: 'I try to talk' },
    { label: '⏳ Wait',        value: 'I wait and watch' },
  ];
  showActionChips(actions);
}
