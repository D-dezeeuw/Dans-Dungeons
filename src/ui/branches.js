// src/ui/branches.js — Phase 2 branch picker.
//
// A small popup over the input row that lists the abandoned timelines captured
// when the player diverged after an undo (the paths not taken). Selecting one
// swaps the live game state onto that branch. The branch logic lives in
// game/undo.js; this module only renders the list and forwards clicks, listening
// for changes via setBranchListener (so undo.js never imports the UI).

import { listBranches, jumpToBranch, setBranchListener } from '../game/undo.js';

let _open = false;

const btnEl   = () => document.getElementById('branch-btn');
const menuEl  = () => document.getElementById('branch-menu');
const countEl = () => document.getElementById('branch-count');

export function initBranchUI() {
  const btn = btnEl();
  if (!btn) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  // Click anywhere else closes the menu.
  document.addEventListener('click', (e) => {
    if (_open && !menuEl()?.contains(e.target) && !btn.contains(e.target)) close();
  });
  setBranchListener(render);
  render(listBranches());
}

function toggle() { _open ? close() : open(); }
function open()   { _open = true;  menuEl()?.classList.add('open'); }
function close()  { _open = false; menuEl()?.classList.remove('open'); }

// Refresh the button (visibility + count) and rebuild the menu items. Called on
// init and whenever the branch set changes (capture, swap, epoch reset).
function render(branches) {
  const btn = btnEl();
  if (!btn) return;
  btn.style.display = branches.length ? '' : 'none';
  const c = countEl();
  if (c) c.textContent = String(branches.length);
  if (!branches.length) { close(); return; }

  const menu = menuEl();
  if (!menu) return;
  menu.replaceChildren(...branches.map((b) => {
    const item = document.createElement('button');
    item.type        = 'button';
    item.className   = 'branch-item';
    item.textContent = truncate(b.label);
    item.title       = b.label;
    item.addEventListener('click', (e) => { e.stopPropagation(); jumpToBranch(b.id); close(); });
    return item;
  }));
}

function truncate(s, n = 48) {
  s = String(s ?? '').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
