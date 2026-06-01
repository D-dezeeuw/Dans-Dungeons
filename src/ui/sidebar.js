// src/ui/sidebar.js — sidebar, debug panel, copy-key button, collapsible logic.

import { escHtml } from '../core/utils.js';

const MOBILE_BREAKPOINT = 768;

// ─── Collapsible panel factory ────────────────────────────────────────────────
// Manages collapse class, aria-expanded, and localStorage persistence.
// extraUpdate(open) is called on every toggle for element-specific side effects.

function makePanel(panel, storageKey, extraUpdate) {
  function set(open) {
    panel.classList.toggle('collapsed', !open);
    panel.setAttribute('aria-expanded', String(open));
    localStorage.setItem(storageKey, open ? 'open' : 'closed');
    extraUpdate?.(open);
  }
  function storedOrDefault() {
    const v = localStorage.getItem(storageKey);
    return v !== null ? v === 'open' : window.innerWidth >= MOBILE_BREAKPOINT;
  }
  return { set, storedOrDefault };
}

// Module-level refs so updateDebugPanel can call _setDebug without globals.
let _setDebug   = null;
let _debugBar   = null;
let _debugPanel = null;

// ─── Copy-key button ──────────────────────────────────────────────────────────

export function initCopyKeyButton(getKey) {
  const btn = document.getElementById('copy-key-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getKey());
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '🔑'; }, 1200);
  });
}

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
    });
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
  _debugPanel = document.getElementById('debug-panel');
  _debugBar   = document.getElementById('debug-bar');
  const chevron = _debugBar?.querySelector('.toggle-chevron');

  if (_debugPanel && _debugBar) {
    const { set, storedOrDefault } = makePanel(_debugBar, 'dg-debug', (open) => {
      _debugPanel.classList.toggle('collapsed', !open);
      if (chevron) chevron.textContent = open ? '▴' : '▾';
    });
    _setDebug = set;
    _setDebug._initial = storedOrDefault();

    _debugBar.addEventListener('click', () =>
      _setDebug(_debugPanel.classList.contains('collapsed'))
    );
    _debugBar.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _debugBar.click(); }
    });
  }
}

// ─── Debug panel renderer ─────────────────────────────────────────────────────

export function updateDebugPanel(debug) {
  const el = _debugPanel;
  if (!el) return;
  if (!debug) { el.innerHTML = ''; return; }

  // Reveal the debug bar on first real data; apply stored open/closed preference.
  if (_debugBar && !_debugBar.classList.contains('visible')) {
    _debugBar.classList.add('visible');
    _setDebug?.(_setDebug._initial ?? true);
  }

  const { classified, resolved, goblinResult } = debug;
  const sections = [];
  function sec(label) { const s = { label, rows: [] }; sections.push(s); return s; }

  function d20Html(val) {
    if (val === 1)  return `d20  <strong class="nat-1">${val}</strong>`;
    if (val === 20) return `d20  <strong class="nat-20">${val}</strong>`;
    return escHtml(`d20  ${val}`);
  }

  // ── Classifier ────────────────────────────────────────────────────────────
  const cs = sec('intent');
  cs.rows.push({ text: `${classified.intent}${classified.target_id ? ' → ' + classified.target_id : ''}` });
  if (classified.direction) cs.rows.push({ text: `dir: ${classified.direction}` });
  if (classified.skill)     cs.rows.push({ text: `skill: ${classified.skill}` });
  if (classified.dc != null) cs.rows.push({ text: `dc: ${classified.dc}` });
  if (classified.reason)    cs.rows.push({ text: classified.reason, cls: 'dim' });

  // ── PC action ─────────────────────────────────────────────────────────────
  if (resolved.intent === 'attack') {
    const s = sec('pc attack');
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
    const s = sec(`skill: ${resolved.skill} (${resolved.ability})`);
    const bonus = resolved.abilMod + resolved.profBonus;
    s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(resolved.total))}` });
    s.rows.push({ text: `DC   ${resolved.dc}  ${resolved.success ? 'PASS ✓' : 'FAIL ✗'}`, cls: resolved.success ? 'hit' : 'miss' });
  } else {
    const s = sec('pc action');
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
