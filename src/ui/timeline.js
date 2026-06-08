// src/ui/timeline.js — Phase 3 time-travel panel.
//
// A popup over the input row that visualises the current run's timeline: the
// spine of committed turns (click any to scrub there) plus the abandoned
// alternative timelines captured on divergence (click any to swap onto it). It
// replaces the Phase 2 branch dropdown — one affordance for the whole tree. All
// the logic lives in game/undo.js; this module renders and forwards clicks,
// re-rendering on every time-travel change via onTimeTravelChange (so undo.js
// never imports the UI).

import { listTimeline, listBranches, jumpToStop, jumpToBranch, onTimeTravelChange } from '../game/undo.js';
import { t } from '../i18n/i18n.js';

let _open = false;

const btnEl   = () => document.getElementById('timeline-btn');
const panelEl = () => document.getElementById('timeline-panel');
const countEl = () => document.getElementById('timeline-count');

export function initTimeline() {
  const btn = btnEl();
  if (!btn) return;
  btn.setAttribute('aria-label', t('timeline.label'));   // localized (HTML carries an English fallback)
  btn.title = t('timeline.title');
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', (e) => {
    if (_open && !panelEl()?.contains(e.target) && !btn.contains(e.target)) close();
  });
  onTimeTravelChange(render);
  render();
}

function toggle() { _open ? close() : open(); }
function open()   { _open = true;  render(); panelEl()?.classList.add('open'); }
function close()  { _open = false; panelEl()?.classList.remove('open'); }

// Refresh the button (visible once there's anything to navigate; badge = branch
// count) and rebuild the panel: the turn spine, then the alternative timelines.
function render() {
  const btn = btnEl();
  if (!btn) return;
  const nodes    = listTimeline();
  const branches = listBranches();

  // Divergence cue: when scrubbed back from the head, a new action branches a
  // fresh path (re-runs the AI), so hint that before the player types.
  const scrubbedBack = nodes.length > 0 && !nodes[nodes.length - 1].current;
  const hint = document.getElementById('branch-hint');
  if (hint) {
    hint.textContent   = scrubbedBack ? t('timeline.branchHint') : '';
    hint.style.display = scrubbedBack ? '' : 'none';
  }

  const show = nodes.length > 1 || branches.length > 0;
  btn.style.display = show ? '' : 'none';

  const badge = countEl();
  if (badge) {
    badge.textContent   = branches.length ? String(branches.length) : '';
    badge.style.display = branches.length ? '' : 'none';
  }
  if (!show) { close(); return; }

  const panel = panelEl();
  if (!panel) return;
  const children = [];

  for (const n of nodes) {
    const node = document.createElement('button');
    node.type        = 'button';
    node.className   = 'tl-node' + (n.current ? ' tl-current' : '');
    node.textContent = n.label === null ? t('timeline.start') : truncate(n.label);
    if (n.label) node.title = n.label;
    node.addEventListener('click', (e) => { e.stopPropagation(); jumpToStop(n.index); });
    children.push(node);
  }

  if (branches.length) {
    const hdr = document.createElement('div');
    hdr.className   = 'tl-section';
    hdr.textContent = t('timeline.others', { n: branches.length });
    children.push(hdr);
    for (const b of branches) {
      const item = document.createElement('button');
      item.type        = 'button';
      // Richer label: the divergent action + branch length + when it was taken,
      // so multiple same-action branches stay distinguishable.
      const meta       = [turnsLabel(b.turns), relTime(b.ts)].filter(Boolean).join(' · ');
      item.textContent = `${truncate(b.label)} · ${meta}`;
      item.title       = b.label;
      item.addEventListener('click', (e) => { e.stopPropagation(); jumpToBranch(b.id); });
      children.push(item);
    }
  }

  panel.replaceChildren(...children);
}

function turnsLabel(n) {
  return t(n === 1 ? 'timeline.turnsOne' : 'timeline.turns', { n });
}

// Coarse relative time for a branch's capture timestamp (just now / Nm / Nh).
// Recomputed on each render (a render fires on every time-travel change).
function relTime(ts) {
  if (!ts) return '';
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return t('timeline.justNow');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t('timeline.minutesAgo', { n: mins });
  return t('timeline.hoursAgo', { n: Math.floor(mins / 60) });
}

function truncate(s, n = 36) {
  s = String(s ?? '').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
