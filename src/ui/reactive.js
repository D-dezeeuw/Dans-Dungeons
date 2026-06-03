// src/ui/reactive.js — computed Spektrum bindings that drive the reactive DOM.
//
// All UI state (cost display, PC/enemy stats, action bar visibility) is derived
// here via computed() so the DOM always reflects the latest appState automatically.

import { computed, watch } from '../core/state.js';
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

  // Direct DOM writes — Spektrum :innerHTML binding doesn't reliably push
  // HTML into elements, so we use watch() to set innerHTML imperatively.
  watch(['ui.pcStats'], (s) => {
    const el = document.getElementById('pc-header-stats');
    if (el) el.innerHTML = s.ui?.pcStats ?? '';
  });
  watch(['ui.enemyStats'], (s) => {
    const el = document.getElementById('enemy-header-stats');
    if (el) el.innerHTML = s.ui?.enemyStats ?? '';
  });

  // Tier state — drives Deluxe section visibility.
  computed('ui.isFree',    ['ai.tier'], s => (s.ai?.tier ?? 'free') === 'free');
  computed('ui.isDeluxe',  ['ai.tier'], s => (s.ai?.tier ?? 'free') === 'deluxe');
  computed('ui.tierLabel', ['ai.tier'], s => (s.ai?.tier ?? 'free') === 'deluxe' ? 'Deluxe' : 'Free');

  // Action bar visibility — requires both an API key and the toggle enabled.
  computed('ui.actionBarVisible', ['settings.actionBar', 'ai.key'], (s) => {
    return !!(s.settings?.actionBar && s.ai?.key);
  });

  computed('ui.actionBarLabel',    ['settings.actionBar'],  (s) => (s.settings?.actionBar ?? true) ? 'ON' : 'OFF');

  // Debug bar (last turn) visibility — driven by settings toggle.
  computed('ui.debugBarVisible', ['settings.debugBar'], (s) => !!(s.settings?.debugBar ?? false));
  computed('ui.debugBarActive',  ['settings.debugBar'], (s) => !!(s.settings?.debugBar ?? false));
  computed('ui.debugBarLabel',   ['settings.debugBar'], (s) => (s.settings?.debugBar ?? false) ? 'ON' : 'OFF');
  computed('ui.sceneImageActive',  ['settings.sceneImage'], (s) => !!(s.settings?.sceneImage));
  computed('ui.sceneImageLabel',   ['settings.sceneImage'], (s) => (s.settings?.sceneImage) ? 'ON' : 'OFF');

  // aria-pressed state for action bar toggle button.
  computed('ui.actionBarActive', ['settings.actionBar'], (s) => !!(s.settings?.actionBar ?? true));

  // aria-pressed states for the three sketch view buttons.
  computed('ui.sketchMinPressed', ['settings.sketchView'], (s) => (s.settings?.sketchView ?? 'windowed') === 'minimized');
  computed('ui.sketchWinPressed', ['settings.sketchView'], (s) => (s.settings?.sketchView ?? 'windowed') === 'windowed');
  computed('ui.sketchMaxPressed', ['settings.sketchView'], (s) => (s.settings?.sketchView ?? 'windowed') === 'maximized');

  // TTS state — drive icon on the toggle button.
  computed('ui.ttsActive',     ['settings.tts'],        s => !!(s.settings?.tts));
  computed('ui.ttsIcon',       ['settings.tts'],        s => s.settings?.tts ? 'ON' : 'OFF');

  // TTS toggle icon — push SVG via watch since {{}} can't render HTML.
  const _volOn  = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>';
  const _volOff = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 9a5 5 0 0 1 .95 2.293"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="m7 7-2.187 2.187A1.4 1.4 0 0 1 3.816 9.6H2a1 1 0 0 0-1 1v4.8a1 1 0 0 0 1 1h1.815a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 9.4 19.702V15"/><path d="M9.4 4.702a.705.705 0 0 1 1.203-.498L13 6.6"/></svg>';
  watch(['settings.tts'], (s) => {
    const el = document.getElementById('tts-toggle');
    if (el) el.innerHTML = s.settings?.tts ? _volOn : _volOff;
  });

  // Roleplay mode — drives aria-pressed on the roleplay button.
  computed('ui.roleplayActive', ['settings.roleplayMode'], s => !!(s.settings?.roleplayMode));
}
