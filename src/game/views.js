// src/game/views.js — the read-only screens: /story, the region map, quests, inventory.
//
// Extracted from flow.js as part of taking it apart. These share a shape nothing
// else in flow.js has: they read state, print to the transcript, and return. No
// AI call, no dice, no await on the player. That makes them the safest thing to
// lift out and the easiest to reason about once lifted — a bug in here can
// misinform a player but cannot corrupt a campaign.
//
// `resolveDungeonQuests` is the one exception and travels with them anyway: it
// writes quest status, but it is quest bookkeeping and belongs beside the log
// that displays it rather than beside the dungeon that triggers it.

import { appState, setValue } from '../core/state.js';
import * as UI from '../ui/console.js';
import { t } from '../i18n/i18n.js';
import { progress as storyProgress, actNumber, gmDirective } from './acts-runtime.js';
import { reputationStanding, awardReputation } from './story.js';
import { mapView } from './atlas.js';
import { rumours } from './world-clocks.js';
import { xpProgress } from './progression.js';
import { setQuestStatus, activeQuests } from 'bag-of-holding-client';


// A 10-cell reputation bar from -100 (empty) to +100 (full).
export function repBar(rep) {
  const filled = Math.max(0, Math.min(10, Math.round((rep + 100) / 20)));
  return '█'.repeat(filled) + '·'.repeat(10 - filled);
}

export function renderStoryView() {
  UI.appendEntry('system', t('story.header'));

  const p = storyProgressNow(); // { done, total, current }
  if (p.total) {
    UI.appendEntry('system', t('story.progress', { done: p.done, total: p.total }));
    UI.appendEntry('system', p.current ? t('story.nextHint') : t('story.complete'));
  } else {
    UI.appendEntry('system', t('story.noThread'));
  }

  const repMap = appState.world?.factionReputation ?? {};
  const facEntries = Object.entries(repMap);
  if (facEntries.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.factionsHeader'));
    for (const [id, rep] of facEntries) {
      const name = appState.world?.factions?.[id]?.name ?? id;
      const stand = standing(rep);
      UI.appendEntry('system', t('story.factionLine', { name, bar: repBar(rep), rep, standing: t(`story.standing.${stand}`) }));
    }
  }

  const aq = activeQuests(appState.world?.quests ?? {});
  if (aq.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.questsHeader'));
    for (const q of aq) {
      UI.appendEntry('system', t('settlement.questLine', { desc: q.description, status: t('settlement.status.active'), npc: q.npcName }));
    }
  }

  const flags = Object.keys(appState.world?.redThread?.flags ?? {}).filter(f => !f.startsWith('beat-done-'));
  if (flags.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('story.flagsHeader'));
    UI.appendEntry('system', '  ' + flags.slice(-8).join('  ·  '));
  }
  UI.appendEntry('system', '');
}

// ─── Region map (Phase 3.6) ───────────────────────────────────────────────────

export function renderRegionMap() {
  const regions = Object.values(appState.world?.regions ?? {});
  if (!regions.length) { UI.appendEntry('system', t('map.empty')); return; }
  const curRegionId = appState.world?.location?.regionId;
  const curSettlementId = appState.world?.location?.settlementId;
  UI.appendEntry('system', t('map.header'));
  for (const r of regions) {
    const here = r.id === curRegionId ? t('map.youAreHere') : '';
    UI.appendEntry('system', t('map.regionLine', { name: r.name, climate: r.climate ?? '?', here }));
    for (const sid of (r.settlements ?? [])) {
      const s = appState.world.settlements?.[sid];
      if (s) UI.appendEntry('system', t('map.settlementLine', { name: s.name, here: sid === curSettlementId ? t('map.youAreHere') : '' }));
    }
    if (r.adjacentRegions?.length) {
      UI.appendEntry('system', t('map.connectsLine', { names: r.adjacentRegions.join(', ') }));
    }
  }

  // Places the map knows about but the player has never walked to. These are
  // real destinations with their own seeds, not scenery — going there hydrates
  // exactly the place that was always promised.
  const rumoured = mapView().rumoured;
  if (rumoured.length) {
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('map.rumouredHeader'));
    for (const n of rumoured) {
      UI.appendEntry('system', t('map.rumouredLine', { name: n.name, hook: n.hook ?? '' }));
    }
  }
  UI.appendEntry('system', '');
}

// Compact world snapshot for the settlement classifier.


// Phase 4.3/4.7: clearing a dungeon completes the player's active quests, raises
// quest-done flags (beat prerequisites), and rewards the quest-givers' factions.
export function resolveDungeonQuests() {
  const quests = appState.world?.quests ?? {};
  const active = activeQuests(quests);
  if (!active.length) return;
  let map = quests;
  for (const q of active) map = setQuestStatus(map, q.id, 'completed');
  setValue('world', { ...appState.world, quests: map });
  tick();
  for (const q of active) {
    setStoryFlag(`quest-${q.id}-done`);
    if (q.factionId) awardReputation(q.factionId, 15);
    UI.appendEntry('system', t('settlement.questCompleted', { desc: q.description }));
    for (const line of announcementFor(awardMilestone('quest-completed', t('progress.questReason')))) {
      UI.appendEntry('system', line);
    }
  }
  saveToStorage();
}

export function showQuests() {
  const quests = Object.values(appState.world?.quests ?? {});
  if (!quests.length) { UI.appendEntry('system', t('settlement.questsEmpty')); return; }
  UI.appendEntry('system', t('settlement.questsHeader'));
  for (const q of quests) {
    UI.appendEntry('system', t('settlement.questLine', { desc: q.description, status: t(`settlement.status.${q.status}`), npc: q.npcName }));
  }
}

export function showInventory() {
  const pc = appState.party?.pc;
  const items = appState.party?.inventory ?? [];
  UI.appendEntry('system', t('settlement.goldLine', { gold: goldOf(pc?.record) }));
  if (!items.length) { UI.appendEntry('system', t('settlement.inventoryEmpty')); return; }
  UI.appendEntry('system', t('settlement.inventoryHeader'));
  for (const it of items) {
    const qty = (it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : '';
    UI.appendEntry('system', t('settlement.invLine', { name: it.name, qty }));
  }
}
