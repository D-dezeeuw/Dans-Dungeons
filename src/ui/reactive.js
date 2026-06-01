// src/ui/reactive.js — computed Spektrum bindings that drive the reactive DOM.
//
// All UI state (cost display, PC/enemy stats, action bar visibility) is derived
// here via computed() so the DOM always reflects the latest appState automatically.

import { computed } from '../core/state.js';
import { escHtml } from '../core/utils.js';

export function registerReactiveSidebar() {
  computed('ui.costDisplay', ['ai.totalTokens', 'ai.totalCostUsd'], (s) => {
    const tokens = s.ai?.totalTokens ?? 0;
    const cost   = s.ai?.totalCostUsd ?? 0;
    return tokens > 0 ? '$' + cost.toFixed(4) + ' · ' + tokens.toLocaleString() + ' tok' : '';
  });

  // PC header stats — rendered as HTML so HP colour classes work.
  computed('ui.pcStats', ['party.pc'], (s) => {
    const pc = s.party?.pc;
    if (!pc?.record || !pc?.sheet) return '';
    const hp    = pc.record.hpCurrent ?? pc.sheet.hp.max;
    const maxHp = pc.sheet.hp.max;
    const low   = hp <= Math.floor(maxHp / 4);
    const cap   = str => str.charAt(0).toUpperCase() + str.slice(1);
    return `<span class="hs-name">${escHtml(pc.record.name)}</span>` +
           `<span class="hs-sep">·</span>${escHtml(cap(pc.record.classId))}` +
           `<span class="hs-sep">·</span>HP <span class="${low ? 'hs-hp-low' : 'hs-hp-ok'}">${hp}/${maxHp}</span>` +
           `<span class="hs-sep">·</span>AC ${pc.sheet.ac.value}`;
  });

  // Enemy header stats — alive enemies in current room.
  computed('ui.enemiesPresent', ['world.npcs', 'world.currentRoom'], (s) => {
    const room = s.world?.currentRoom;
    return Object.values(s.world?.npcs ?? {}).some(n => n.roomId === room && n.alive);
  });

  computed('ui.enemyStats', ['world.npcs', 'world.currentRoom'], (s) => {
    const room  = s.world?.currentRoom;
    const alive = Object.values(s.world?.npcs ?? {}).filter(n => n.roomId === room && n.alive);
    if (!alive.length) return '';
    return alive.map(n => {
      const low = n.hp <= Math.floor(n.maxHp / 4);
      return `<span class="hs-enemy-name">${escHtml(n.name)}</span>` +
             `<span class="hs-sep">·</span>HP <span class="${low ? 'hs-hp-low' : 'hs-hp-ok'}">${n.hp}/${n.maxHp}</span>`;
    }).join('<span class="hs-enemy-divider"> &nbsp; </span>');
  });

  // Action bar visibility — requires both an API key and the toggle enabled.
  computed('ui.actionBarVisible', ['settings.actionBar', 'ai.key'], (s) => {
    return !!(s.settings?.actionBar && s.ai?.key);
  });

  computed('ui.actionBarLabel', ['settings.actionBar'], (s) => {
    return (s.settings?.actionBar ?? true) ? 'ON' : 'OFF';
  });

  // TTS / STT state — drive aria-pressed on the chrome and input buttons.
  computed('ui.ttsActive', ['settings.tts'], s => !!(s.settings?.tts));
  computed('ui.ttsIcon',   ['settings.tts'], s => s.settings?.tts ? '🔊' : '🔇');
  computed('ui.recording', ['ui.recording'],  s => !!(s.ui?.recording));
}
