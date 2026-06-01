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

  // Boolean flags that drive data-if visibility on the two chrome stat rows.
  computed('ui.pcStatsVisible',   ['party.pc'], (s) => !!(s.party?.pc?.record && s.party?.pc?.sheet));
  computed('ui.enemyStatsVisible', ['world.npcs', 'world.currentRoom'], (s) => {
    const room = s.world?.currentRoom;
    return Object.values(s.world?.npcs ?? {}).some(n => n.roomId === room && n.alive);
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

  // aria-pressed state for action bar toggle button.
  computed('ui.actionBarActive', ['settings.actionBar'], (s) => !!(s.settings?.actionBar ?? true));

  // aria-pressed states for the three sketch view buttons.
  computed('ui.sketchMinPressed', ['settings.sketchView'], (s) => (s.settings?.sketchView ?? 'windowed') === 'minimized');
  computed('ui.sketchWinPressed', ['settings.sketchView'], (s) => (s.settings?.sketchView ?? 'windowed') === 'windowed');
  computed('ui.sketchMaxPressed', ['settings.sketchView'], (s) => (s.settings?.sketchView ?? 'windowed') === 'maximized');

  // TTS state — drive icon on the toggle button.
  computed('ui.ttsActive',     ['settings.tts'],        s => !!(s.settings?.tts));
  computed('ui.ttsIcon',       ['settings.tts'],        s => s.settings?.tts ? '🔊' : '🔇');

  // Roleplay mode — drives aria-pressed on the roleplay button.
  computed('ui.roleplayActive', ['settings.roleplayMode'], s => !!(s.settings?.roleplayMode));
}
