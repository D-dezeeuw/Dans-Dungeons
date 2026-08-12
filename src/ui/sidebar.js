// src/ui/sidebar.js — sidebar, debug panel, copy-key button, collapsible logic.

import { escHtml } from '../core/utils.js';
import { t } from '../i18n/i18n.js';
import { activePackCard } from '../settings/index.js';
import { icon } from './icons.js';

const MOBILE_BREAKPOINT = 768;

// ─── Collapsible panel factory ────────────────────────────────────────────────
// Manages collapse class, aria-expanded, and localStorage persistence.
// extraUpdate(open) is called on every toggle for element-specific side effects.

function makePanel(panel, storageKey, extraUpdate, control = null) {
  function set(open) {
    panel.classList.toggle('collapsed', !open);
    // aria-expanded belongs on the control, not on the thing it expands: a
    // screen reader announces the state when the user reaches the BUTTON, and
    // on the panel it was announced only after they had already got inside.
    control?.setAttribute('aria-expanded', String(open));
    // A collapsed panel is width:0, which still leaves every control inside it
    // in the tab order — so tabbing from the sidebar button walked invisibly
    // through a dozen settings. `inert` takes them out entirely.
    panel.inert = !open;
    panel.setAttribute('aria-hidden', String(!open));
    localStorage.setItem(storageKey, open ? 'open' : 'closed');
    extraUpdate?.(open);
  }
  function storedOrDefault() {
    const v = localStorage.getItem(storageKey);
    return v !== null ? v === 'open' : window.innerWidth >= MOBILE_BREAKPOINT;
  }
  return { set, storedOrDefault };
}

// Module-level refs for updateDebugPanel.
let _debugBar   = null;
let _debugPanel = null;

// ─── Collapsibles init ────────────────────────────────────────────────────────

export function initCollapsibles() {
  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar    = document.getElementById('sidebar');
  const sidebarBtn = document.getElementById('sidebar-toggle');
  const closeBtn   = document.getElementById('sidebar-close');
  const backdrop   = document.getElementById('sidebar-backdrop');

  if (sidebar && sidebarBtn) {
    const { set } = makePanel(sidebar, 'dg-sidebar', (open) => {
      // Backdrop: only active on mobile (CSS hides it on desktop)
      if (backdrop) backdrop.classList.toggle('active', open);
    }, sidebarBtn);
    sidebarBtn.setAttribute('aria-controls', sidebar.id);
    // Hand off from CSS pre-init (data attribute) to JS class-based control.
    document.documentElement.removeAttribute('data-sidebar-init');
    const stored = localStorage.getItem('dg-sidebar');
    set(stored === 'open');
    const closeSidebar = () => set(false);
    sidebarBtn.addEventListener('click', () => set(sidebar.classList.contains('collapsed')));
    closeBtn?.addEventListener('click', closeSidebar);
    backdrop?.addEventListener('click', closeSidebar);
  }

  // ── Footer height — keep transcript above fixed footer on mobile ──────────
  const footer = document.getElementById('footer');
  const game   = document.getElementById('game');
  if (footer && game && window.ResizeObserver) {
    new ResizeObserver(() => {
      if (getComputedStyle(footer).position === 'fixed') {
        game.style.paddingBottom = footer.offsetHeight + 'px';
      } else {
        game.style.paddingBottom = '';
      }
    }).observe(footer);
  }

  // ── Debug panel ───────────────────────────────────────────────────────────
  // Visibility is now driven by settings.debugBar via data-if in the HTML.
  // No collapsible logic needed — the toggle in the sidebar controls it.
  _debugPanel = document.getElementById('debug-panel');
  _debugBar   = document.getElementById('debug-bar');
}

// ─── Debug panel renderer ─────────────────────────────────────────────────────

export function updateDebugPanel(debug) {
  const el = _debugPanel;
  if (!el) return;
  if (!debug) { el.innerHTML = ''; return; }

  const { classified, resolved, goblinResult } = debug;
  const sections = [];
  function sec(label) { const s = { label, rows: [] }; sections.push(s); return s; }

  function d20Html(val) {
    if (val === 1)  return `d20  <strong class="nat-1">${val}</strong>`;
    if (val === 20) return `d20  <strong class="nat-20">${val}</strong>`;
    return escHtml(`d20  ${val}`);
  }

  // ── Setting ───────────────────────────────────────────────────────────────
  // Which pack this world was generated with. Read-only by design: the pack is
  // genesis-bound (names, overlays and canon are already minted in its
  // vocabulary), so there is nothing to switch mid-campaign.
  const setting = sec(t('sidebar.settingLabel'));
  setting.rows.push({ text: activePackCard().name });

  // ── Classifier ────────────────────────────────────────────────────────────
  const cs = sec(t('debug.intent'));
  cs.rows.push({ text: `${classified.intent}${classified.target_id ? ' → ' + classified.target_id : ''}` });
  if (classified.direction) cs.rows.push({ text: `dir: ${classified.direction}` });
  if (classified.skill)     cs.rows.push({ text: `skill: ${classified.skill}` });
  if (classified.dc != null) cs.rows.push({ text: `dc: ${classified.dc}` });
  if (classified.reason)    cs.rows.push({ text: classified.reason, cls: 'dim' });

  // ── PC action ─────────────────────────────────────────────────────────────
  if (resolved.intent === 'attack') {
    const s = sec(t('debug.pcAttack'));
    s.rows.push({ text: resolved.weaponName });
    const bonus = resolved.totalHit - resolved.d20;
    s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(resolved.totalHit))}` });
    const label = resolved.crit ? 'CRIT ✓' : resolved.fumble ? 'FUMBLE ✗' : resolved.hit ? 'HIT ✓' : 'MISS ✗';
    s.rows.push({ text: `AC   ${resolved.targetAC}  ${label}`, cls: resolved.hit && !resolved.fumble ? 'hit' : 'miss' });
    if (resolved.hit) {
      s.rows.push({ text: `dmg  ${resolved.damage}` });
      s.rows.push({ text: `${resolved.targetName}  ${resolved.targetPrevHp} → ${resolved.targetNewHp}${resolved.targetDead ? '  ✗' : ''}` });
    }
  } else if (resolved.intent === 'skill') {
    const s = sec(t('debug.skill', { name: resolved.skill, ab: resolved.ability }));
    const bonus = resolved.abilMod + resolved.profBonus;
    s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(resolved.total))}` });
    s.rows.push({ text: `DC   ${resolved.dc}  ${resolved.success ? 'PASS ✓' : 'FAIL ✗'}`, cls: resolved.success ? 'hit' : 'miss' });
  } else {
    const s = sec(t('debug.pcAction'));
    s.rows.push({ text: resolved.intent });
    if (resolved.reason) s.rows.push({ text: resolved.reason, cls: 'dim' });
  }

  // ── Enemy retaliation ─────────────────────────────────────────────────────
  if (goblinResult) {
    const s = sec(goblinResult.goblinName);
    const bonus = goblinResult.totalHit - goblinResult.d20;
    s.rows.push({ html: `${d20Html(goblinResult.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(goblinResult.totalHit))}` });
    const label = goblinResult.crit ? 'CRIT ✓' : goblinResult.fumble ? 'FUMBLE ✗' : goblinResult.hit ? 'HIT ✓' : 'MISS ✗';
    s.rows.push({ text: `AC   ${goblinResult.pcAC}  ${label}`, cls: goblinResult.hit && !goblinResult.fumble ? 'hit' : 'miss' });
    if (goblinResult.hit) {
      s.rows.push({ text: `dmg  ${goblinResult.damage}` });
      s.rows.push({ text: `you  ${goblinResult.pcPrevHp} → ${goblinResult.pcNewHp}${goblinResult.pcUnconscious ? '  (down)' : ''}` });
    }
  }

  el.innerHTML = sections.map(s => `<div class="dbg-section">
    <div class="dbg-sep">${escHtml(s.label)}</div>
    ${s.rows.map(r => `<div class="dbg-row${r.cls ? ' ' + r.cls : ''}">${r.html ?? escHtml(r.text)}</div>`).join('')}
  </div>`).join('');
}
