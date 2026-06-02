// src/ui/actionbar.js — three-zone footer action bar (compass, class, skills)
// and the floating tooltip system.

import { getSkills, classAbilities } from './chips.js';
import { fireChip } from './input.js';
import { t } from '../i18n/i18n.js';

// ─── Floating tooltip ─────────────────────────────────────────────────────────
// Single shared div appended to <body> so it's never clipped by overflow.

const _tip = document.createElement('div');
_tip.id = 'ab-tooltip';
document.body.appendChild(_tip);

document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  _tip.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect();
  _tip.style.left      = `${r.left + r.width / 2}px`;
  _tip.style.top       = `${r.top - 8}px`;
  _tip.style.transform = 'translate(-50%, -100%)';
  _tip.classList.add('visible');
});

document.addEventListener('mouseout', (e) => {
  if (!e.target.closest('[data-tip]')) return;
  _tip.classList.remove('visible');
});

// ─── Action bar renderer ──────────────────────────────────────────────────────
//
// Three zones: compass (movement), class abilities, skill word cloud.
// Called each turn when the action bar is enabled.

export function updateActionBar(exits, record, sheet, cooldowns) {
  // ── Compass ────────────────────────────────────────────────────────────────
  const DIRS = ['north', 'east', 'south', 'west'];
  for (const dir of DIRS) {
    const btn  = document.getElementById(`ab-${dir}`);
    if (!btn) continue;
    const exit = exits.find(e => e.dir === dir);
    const dirName = t(`directions.${dir}`);
    const cap = dirName.charAt(0).toUpperCase() + dirName.slice(1);
    btn.disabled = !exit;
    btn.classList.toggle('ab-locked', !!(exit?.locked));
    btn.onclick = exit
      ? () => fireChip(exit.locked ? t('chips.unlockCmd') : t('chips.goDir', { dir: dirName }))
      : null;
    if (exit?.locked) {
      btn.dataset.tip = `${cap} — ${t('actionbar.locked')}\n${t('actionbar.lockTip')}`;
    } else if (exit) {
      btn.dataset.tip = `${cap} — ${t('actionbar.passageOpen')}\n${exit.description ?? t('actionbar.moveTip')}`;
    } else {
      btn.dataset.tip = `${cap} — ${t('actionbar.noExit')}`;
    }
  }

  // ── Class abilities word cloud ─────────────────────────────────────────────
  const abEl = document.getElementById('ab-abilities-list');
  if (abEl) {
    abEl.innerHTML = '';
    if (record && sheet) {
      for (const atk of (sheet.attacks ?? [])) {
        const span = document.createElement('span');
        span.className = 'ab-word ab-available';
        span.dataset.tip = `${t('actionbar.attackTip')}\n+${atk.attackBonus} to hit · ${atk.damageDice} damage`;
        span.textContent = atk.name;
        abEl.appendChild(span);
      }
      for (const ability of classAbilities(record, sheet)) {
        const span = document.createElement('span');
        span.className = 'ab-word ab-available';
        span.dataset.tip = ability.note;
        span.textContent = ability.label;
        abEl.appendChild(span);
      }
    }
  }

  // ── Skills word cloud ──────────────────────────────────────────────────────
  const skEl = document.getElementById('ab-skills-list');
  if (skEl) {
    skEl.innerHTML = '';
    for (const skill of getSkills()) {
      const remaining = cooldowns[skill.id] ?? 0;
      const onCd = remaining > 0;
      const span = document.createElement('span');
      span.className = 'ab-word ' + (onCd ? 'ab-unavailable' : 'ab-available');
      span.dataset.tip = onCd
        ? `${skill.label} · ${skill.ab}\n${skill.desc}\n\n${t('actionbar.cooldown', { n: remaining, s: remaining > 1 ? 'en' : '' })}`
        : `${skill.label} · ${skill.ab}\n${skill.desc}`;
      span.textContent = skill.label + (onCd ? ` (${remaining})` : '');
      skEl.appendChild(span);
    }
  }
}
