// src/ui/actionbar.js — three-zone footer action bar (compass, class, skills)
// and the floating tooltip system.

import { fireChip } from './input.js';
import { t } from '../i18n/i18n.js';

// ─── Floating tooltip ─────────────────────────────────────────────────────────
// Single shared div appended to <body> so it's never clipped by overflow.

const _tip = document.createElement('div');
_tip.id = 'ab-tooltip';
document.body.appendChild(_tip);

// Shown on hover AND on focus. Hover-only meant a keyboard user never saw a
// compass button's lock hint. The word-cloud items are spans and not focusable
// on purpose — putting twenty read-only labels in the tab order to reach their
// descriptions would be worse than the problem — so they carry the same text as
// a `title`, which assistive tech reads without a tab stop.
function showTip(el) {
  if (!el) return;
  _tip.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect();
  _tip.style.left      = `${r.left + r.width / 2}px`;
  _tip.style.top       = `${r.top - 8}px`;
  _tip.style.transform = 'translate(-50%, -100%)';
  _tip.classList.add('visible');
}

function hideTip() { _tip.classList.remove('visible'); }

document.addEventListener('mouseover', (e) => showTip(e.target.closest('[data-tip]')));
document.addEventListener('mouseout',  (e) => { if (e.target.closest('[data-tip]')) hideTip(); });
document.addEventListener('focusin',   (e) => showTip(e.target.closest('[data-tip]')));
document.addEventListener('focusout',  (e) => { if (e.target.closest('[data-tip]')) hideTip(); });
// Escape dismisses it, the way every tooltip should.
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });

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
