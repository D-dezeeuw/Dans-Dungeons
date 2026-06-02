// src/ui/chips.js — action chips, character chips, skill chips, room chips.
// Also exports SKILLS (shared with actionbar.js) and classAbilities().

import { prefillChip, fireChip } from './input.js';
import { t, tRaw } from '../i18n/i18n.js';

const actionChipsEl    = () => document.getElementById('action-chips');
const characterChipsEl = () => document.getElementById('character-chips');
const skillChipsEl     = () => document.getElementById('skill-chips');

// ─── Skill IDs (order stable; labels come from locale) ──────────────────────

const SKILL_IDS = [
  'athletics', 'acrobatics', 'sleight-of-hand', 'stealth',
  'arcana', 'history', 'investigation', 'nature', 'religion',
  'animal-handling', 'insight', 'medicine', 'perception', 'survival',
  'deception', 'intimidation', 'performance', 'persuasion',
];

const SKILL_AB = {
  'athletics': 'STR',
  'acrobatics': 'DEX', 'sleight-of-hand': 'DEX', 'stealth': 'DEX',
  'arcana': 'INT', 'history': 'INT', 'investigation': 'INT', 'nature': 'INT', 'religion': 'INT',
  'animal-handling': 'WIS', 'insight': 'WIS', 'medicine': 'WIS', 'perception': 'WIS', 'survival': 'WIS',
  'deception': 'CHA', 'intimidation': 'CHA', 'performance': 'CHA', 'persuasion': 'CHA',
};

// Build SKILLS array dynamically from locale.
export function getSkills() {
  return SKILL_IDS.map(id => ({
    id,
    label: t(`skills.${id}.label`),
    ab:    SKILL_AB[id],
    desc:  t(`skills.${id}.desc`),
  }));
}

// Legacy export for actionbar.js compatibility.
export const SKILLS = SKILL_IDS.map(id => ({ id, ab: SKILL_AB[id] }));

// ─── Class abilities ──────────────────────────────────────────────────────────

export function classAbilities(record, sheet) {
  const lvl       = record.level ?? 1;
  const sneakDice = Math.ceil(lvl / 2);
  const dc        = sheet.spellcasting?.saveDC     ?? '?';
  const spAtk     = sheet.spellcasting?.attackBonus ?? '?';
  const slotLvl   = Math.ceil(lvl / 2);

  const ca = {
    fighter: [
      { label: t('classAbilities.fighter.secondWind.label'),  note: t('classAbilities.fighter.secondWind.note', { lvl }),  text: t('classAbilities.fighter.secondWind.text') },
      { label: t('classAbilities.fighter.actionSurge.label'), note: t('classAbilities.fighter.actionSurge.note'),          text: t('classAbilities.fighter.actionSurge.text') },
    ],
    rogue: [
      { label: t('classAbilities.rogue.sneakAttack.label'),   note: t('classAbilities.rogue.sneakAttack.note', { dice: sneakDice }),   text: t('classAbilities.rogue.sneakAttack.text') },
      { label: t('classAbilities.rogue.cunningAction.label'), note: t('classAbilities.rogue.cunningAction.note'),                      text: t('classAbilities.rogue.cunningAction.text') },
    ],
    cleric: [
      { label: t('classAbilities.cleric.turnUndead.label'), note: t('classAbilities.cleric.turnUndead.note', { dc }), text: t('classAbilities.cleric.turnUndead.text') },
      { label: t('classAbilities.cleric.castSpell.label'),  note: t('classAbilities.cleric.castSpell.note', { dc }),  text: t('classAbilities.cleric.castSpell.text') },
    ],
    wizard: [
      { label: t('classAbilities.wizard.arcaneRecovery.label'), note: t('classAbilities.wizard.arcaneRecovery.note', { slotLvl }), text: t('classAbilities.wizard.arcaneRecovery.text') },
      { label: t('classAbilities.wizard.castSpell.label'),      note: t('classAbilities.wizard.castSpell.note', { atk: spAtk }),    text: t('classAbilities.wizard.castSpell.text') },
    ],
  };
  return ca[record.classId] ?? [];
}

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
    btn.addEventListener('click', () => prefillChip(t('chips.attackWith', { name: atk.name })));
    el.appendChild(btn);
  }

  if (sheet.spellcasting) {
    const info = document.createElement('div');
    info.className = 'char-spell-info';
    info.textContent = t('chips.spellInfo', { dc: sheet.spellcasting.saveDC, bonus: sheet.spellcasting.attackBonus });
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

  for (const skill of getSkills()) {
    const remaining  = cooldowns[skill.id] ?? 0;
    const onCooldown = remaining > 0;
    const btn = document.createElement('button');
    btn.className = 'chip skill-chip' + (onCooldown ? ' disabled' : '');
    btn.disabled = onCooldown;
    btn.innerHTML =
      `<span class="skill-name">${skill.label}</span>` +
      `<span class="skill-ab">${skill.ab}${onCooldown ? ` (${remaining})` : ''}</span>`;
    if (!onCooldown) {
      btn.addEventListener('click', () => prefillChip(t('chips.useSkill', { name: skill.label })));
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
  const actions = [
    ...exits.map(e => ({
      label:     `${ICON[e.dir] ?? '→'} ${t(`directions.${e.dir}`).charAt(0).toUpperCase() + t(`directions.${e.dir}`).slice(1)}${e.locked ? ' 🔒' : ''}`,
      ariaLabel: `${t(`actionbar.go${e.dir.charAt(0).toUpperCase() + e.dir.slice(1)}`)}${e.locked ? ` (${t('actionbar.locked')})` : ''}`,
      value:     t('chips.goDir', { dir: t(`directions.${e.dir}`) }),
    })),
    ...(loot.filter(i => !i.taken).map(i => ({
      label: t('chips.takeItem', { name: i.name }),
      value: t('chips.takeCmd', { name: i.name }),
    }))),
    ...(exits.some(e => e.locked) ? [{ label: t('chips.unlock'), value: t('chips.unlockCmd') }] : []),
    { label: t('chips.attack'),  value: t('chips.attackCmd') },
    { label: t('chips.look'),    value: t('chips.lookCmd') },
    { label: t('chips.talk'),    value: t('chips.talkCmd') },
    { label: t('chips.wait'),    value: t('chips.waitCmd') },
  ];
  showActionChips(actions);
}
