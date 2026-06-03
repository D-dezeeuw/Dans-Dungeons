// src/game/loop.js
//
// The turn engine. This is the ONLY thing that:
//   - calls the AI (via ai/classify.js, ai/narrate.js)
//   - writes to Spektrum (via resolver.js → state.js)
//
// The UI reads appState and renders; it never drives AI calls directly.
// flow.js calls checkApiKey() and generateTurnImage() here so those modules
// never import AI layers directly either.

import { appState, addValue, saveToStorage } from '../core/state.js';
import { classify }                          from '../ai/classify.js';
import { narrate, generateSceneImage }       from '../ai/narrate.js';
import { checkKey }                          from '../ai/client.js';
import { resolveRules, goblinRetaliates, commitAll, appendTranscript } from './resolver.js';

// ─── Scene context (pure snapshot for AI) ────────────────────────────────────

export function buildScene() {
  const { record, sheet } = appState.party?.pc ?? {};
  const roomId = appState.world?.currentRoom;
  const room   = appState.world?.rooms?.[roomId];
  const npcs   = Object.values(appState.world?.npcs ?? {}).filter(n => n.roomId === roomId);

  const scene = {
    room: room ? {
      name:        room.name,
      description: room.description,
      exits:       (room.exits ?? []).map(e => ({ direction: e.dir, locked: e.locked ?? false })),
      loot:        (room.loot  ?? []).filter(i => !i.taken).map(i => ({ id: i.id, name: i.name, description: i.description })),
    } : null,
    pc: record ? {
      name:       record.name,
      classId:    record.classId,
      hpCurrent:  record.hpCurrent,
      hpMax:      sheet?.hp.max,
      ac:         sheet?.ac.value,
      conditions: record.conditions,
      inventory:  (appState.party?.inventory ?? []).map(i => ({ id: i.id, name: i.name })),
    } : null,
    npcs: npcs.map(n => ({
      id:       n.id,
      name:     n.name,
      hp:       n.hp,
      maxHp:    n.maxHp,
      attitude: n.attitude,
      alive:    n.alive,
    })),
  };

  // Leaf-to-root digest path for world context (if campaign mode)
  const loc = appState.world?.location;
  if (loc && appState.world?.digest) {
    const digestPath = [];
    if (loc.dungeonId) {
      const d = appState.world.dungeons?.[loc.dungeonId];
      if (d?.digest) digestPath.push(d.digest);
    }
    if (loc.settlementId) {
      const s = appState.world.settlements?.[loc.settlementId];
      if (s?.digest) digestPath.push(s.digest);
    }
    if (loc.regionId) {
      const r = appState.world.regions?.[loc.regionId];
      if (r?.digest) digestPath.push(r.digest);
    }
    if (appState.world.digest) digestPath.push(appState.world.digest);
    if (digestPath.length) scene.worldContext = digestPath.join(' | ');
  }

  return scene;
}

// ─── Lifecycle AI helpers (called by flow.js — never by UI) ──────────────────

export async function checkApiKey()              { return checkKey(); }
export async function generateTurnImage(prompt)  { return generateSceneImage(prompt); }

// ─── Main turn ────────────────────────────────────────────────────────────────

export async function processTurn(playerInput, onNarrationChunk) {
  // Snapshot scene BEFORE any mutations.
  const scene = buildScene();

  // 1. Classify intent (AI).
  const classified = await classify(playerInput, scene);

  // 2. Resolve PC action (pure JS — reads pre-commit appState, no mutations).
  const resolved = resolveRules(classified);

  // 3. Compute goblin retaliation BEFORE committing PC's attack.
  //    A killed goblin must not retaliate.
  const goblinTurnTriggered = ['attack', 'skill', 'wait', 'look', 'talk', 'move', 'take', 'unlock'].includes(resolved.intent);
  const goblinSurvived      = resolved.intent !== 'attack' || !resolved.targetDead;
  const goblinResult        = (goblinTurnTriggered && goblinSurvived)
    ? goblinRetaliates()
    : null;

  // Outcome flags for narrator context and end-of-loop checks.
  const allEnemiesDead = resolved.targetDead === true &&
    Object.values(appState.world?.npcs ?? {}).filter(n => n.id !== resolved.targetId).every(n => !n.alive);
  const pcUnconscious  = goblinResult?.hit ? goblinResult.pcNewHp <= 0
                                           : (appState.party?.pc?.record?.hpCurrent ?? 1) <= 0;

  // 4. Narrate (AI, streaming).
  const narratorResp = await narrate(
    { playerAction: playerInput, pcAction: resolved, enemyRetaliation: goblinResult, allEnemiesDead, pcUnconscious },
    scene,
    appState.transcript ?? [],
    onNarrationChunk,
  );

  // 5. Commit everything to Spektrum.
  commitAll(resolved, goblinResult);
  appendTranscript(playerInput, narratorResp.narration);
  addValue('session.turnCount', 1);

  // 6. Autosave.
  saveToStorage();

  return { ...narratorResp, _debug: { classified, resolved, goblinResult } };
}
