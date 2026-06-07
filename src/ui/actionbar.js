// src/ui/actionbar.js — three-zone footer action bar (compass, class, skills)
// and the floating tooltip system.

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

export function updateActionBar(exits) {
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

  // The class-ability and skill word clouds (#ab-abilities-list /
  // #ab-skills-list) now render declaratively via `data-each` bound to the
  // `ui.classWords` / `ui.skillWords` computeds (see ui/reactive.js). They
  // update reactively as the character and skill cooldowns change, so the
  // action bar only owns the compass here.
}
