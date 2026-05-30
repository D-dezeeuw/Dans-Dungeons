// src/main.js
//
// Boot sequence. Decides whether to start fresh or resume a save,
// then hands off to the character creation wizard or the play loop.

import {
  appState,
  setValue,
  addValue,
  watch,
  initState,
  restoreState,
  loadFromStorage,
  saveToStorage,
  clearSave,
  run,
  tick,
} from './core/state.js';

import { generateWorld }   from './game/world.js';
import { createCharacter } from './game/character.js';
import { processTurn }     from './game/loop.js';
import * as UI from './ui/console.js';

// ─── Reactive sidebar (subscribes to appState) ────────────────────────────────

function syncSidebar() {
  const pc = appState.party?.pc;
  UI.updatePCStats(pc?.record, pc?.sheet, appState.party?.inventory ?? []);
  const currentRoom = appState.world?.currentRoom;
  const roomNpcs = Object.values(appState.world?.npcs ?? {}).filter(n => n.roomId === currentRoom);
  UI.updateEnemyStats(roomNpcs);
  UI.updateCostMeter(
    appState.ai?.totalTokens ?? 0,
    appState.ai?.totalCostUsd ?? 0
  );
  UI.updateTurnCounter(appState.session?.turnCount ?? 0);
}

// ─── Key / settings setup ────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

async function setupKey() {
  UI.clear();
  UI.appendEntry('gm',     '⚔  DUNGEONS & DANS  ⚔');
  UI.appendEntry('system', '');
  UI.appendEntry('system', 'To play, you need a free OpenRouter API key.');
  UI.appendEntry('system', 'Sign up at openrouter.ai → API Keys.');
  UI.appendEntry('system', '');

  const key = await UI.prompt('Paste your OpenRouter API key:');
  setValue('ai.key', key.trim());

  UI.appendEntry('system', '');
  UI.appendEntry('system', `Default base URL: ${DEFAULT_BASE_URL}`);
  const customUrl = await UI.prompt('Custom base URL (press Enter to use the default):');
  if (customUrl.trim()) setValue('ai.baseUrl', customUrl.trim());

  UI.appendEntry('system', '');
  UI.appendEntry('system', 'Key saved. You can change it later with /settings.');
  saveToStorage();
}

// ─── Start a new adventure ────────────────────────────────────────────────────

async function startNewGame() {
  const world = generateWorld();
  setValue('world',  world);
  setValue('party',  { pc: null, inventory: [] });
  setValue('flags',       {});
  setValue('transcript',  []);
  setValue('session.turnCount', 0);
  setValue('session.phase', 'char-create');

  const result = await createCharacter(UI);
  if (!result) {
    UI.appendEntry('error', 'Character creation cancelled. Refresh to try again.');
    return;
  }

  setValue('party.pc', result);
  setValue('session.phase', 'play');
  tick(); // Flush delta → appState before beginAdventure reads it (rAF hasn't fired yet)
  saveToStorage();

  await beginAdventure();
}

// ─── Intro scene ─────────────────────────────────────────────────────────────

async function beginAdventure() {
  const room = appState.world.rooms[appState.world.currentRoom];
  const pc   = appState.party.pc;

  UI.clear();
  UI.appendEntry('system', '── THE ADVENTURE BEGINS ──────────────────────');
  UI.appendEntry('system', '');
  UI.appendEntry('gm', room.description);
  UI.appendEntry('system', '');
  const exits = room.exits.map(e => e.dir).join(', ');
  UI.appendEntry('system', `Exits: ${exits}`);
  UI.appendEntry('system', '');
  UI.appendEntry('system',
    `You are ${pc.record.name}, a level 1 ${pc.record.classId}. ` +
    `HP: ${pc.record.hpCurrent}/${pc.sheet.hp.max}  AC: ${pc.sheet.ac.value}`
  );
  UI.appendEntry('system', '');

  syncSidebar();
  await playLoop();
}

// ─── Main play loop ───────────────────────────────────────────────────────────

async function playLoop() {
  while (true) {
    if (appState.session.phase !== 'play') break;

    const inExitRoom = appState.world?.currentRoom === appState.world?.exitRoomId;
    if (inExitRoom) { await doVictory(); break; }

    const pcHp = appState.party?.pc?.record?.hpCurrent ?? 1;
    if (pcHp <= 0) { await doDefeat(); break; }

    syncSidebar();
    const room = appState.world?.rooms?.[appState.world?.currentRoom];
    UI.showRoomChips(room?.exits ?? [], room?.loot ?? []);
    UI.showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
    UI.showSkillChips(appState.session?.skillCooldowns ?? {});

    // Wait for player input (chips or typed)
    const raw = await UI.prompt('');
    if (!raw.trim()) continue;

    // ── Meta commands ────────────────────────────────────────────────────────
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }

    // ── Regular turn ─────────────────────────────────────────────────────────
    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true);

    let result;
    try {
      result = await processTurn(raw);
    } catch (e) {
      UI.setThinking(false);
      UI.appendEntry('error', `Error: ${e.message}`);
      UI.appendEntry('system', 'The turn was not resolved. Try again or type /restart.');
      continue;
    }

    // Flush commitAll delta → appState so win/defeat checks below see
    // the updated NPC alive status and PC HP immediately.
    tick();

    UI.setThinking(false);
    if (result?.narration) UI.appendEntry('gm', result.narration);
    UI.appendEntry('system', '');

    syncSidebar();
    UI.updateDebugPanel(result?._debug);
  }
}

// ─── End states ───────────────────────────────────────────────────────────────

async function doVictory() {
  setValue('session.phase', 'game-over');
  const room     = appState.world?.rooms?.[appState.world?.exitRoomId];
  const treasure = (room?.loot ?? []).find(i => i.type === 'treasure');
  UI.appendEntry('system', '');
  UI.appendEntry('system', '══ VICTORY ══════════════════════════════════');
  UI.appendEntry('gm',
    `You have found ${treasure?.name ?? 'the treasure'} and made it out alive. ` +
    `The adventure ends in triumph — for now.`
  );
  UI.appendEntry('system', '');
  UI.appendEntry('system', 'Type /restart to play again.');
  await awaitRestart();
}

async function doDefeat() {
  setValue('session.phase', 'game-over');
  UI.appendEntry('system', '');
  UI.appendEntry('system', '══ DEFEAT ════════════════════════════════════');
  UI.appendEntry('gm',
    'The world dims. Grizzik\'s mocking cackle echoes through the stone ' +
    'as you collapse to the cold floor. Your adventure ends here — for now.'
  );
  UI.appendEntry('system', '');
  UI.appendEntry('system', 'Type /restart to try again.');
  await awaitRestart();
}

async function awaitRestart() {
  UI.showActionChips([{ label: '🔄 Restart', value: '/restart' }]);
  while (true) {
    const input = await UI.prompt('');
    if (input.toLowerCase().startsWith('/restart')) {
      clearSave();
      location.reload();
      return;
    }
  }
}

// ─── Meta commands ────────────────────────────────────────────────────────────

async function handleMeta(raw) {
  const cmd = raw.slice(1).toLowerCase().trim();

  if (cmd === 'restart') { clearSave(); location.reload(); return; }

  if (cmd === 'save') {
    saveToStorage();
    UI.appendEntry('system', 'Game saved to localStorage.');
    return;
  }

  if (cmd === 'status') {
    const pc = appState.party?.pc;
    if (pc) {
      UI.appendEntry('system', `${pc.record.name} — HP ${pc.record.hpCurrent}/${pc.sheet.hp.max}, AC ${pc.sheet.ac.value}`);
    }
    return;
  }

  if (cmd === 'settings') {
    UI.appendEntry('system', 'Re-running key setup…');
    await setupKey();
    return;
  }

  if (cmd === 'help') {
    UI.appendEntry('system', '/save · /status · /settings · /restart · /help');
    return;
  }

  UI.appendEntry('system', `Unknown command: ${raw}  (try /help)`);
}

// ─── Resume a saved game ──────────────────────────────────────────────────────

async function resumeGame() {
  UI.appendEntry('system', '── RESUMING ADVENTURE ────────────────────────');
  UI.appendEntry('system', '');

  // Replay the last 6 transcript entries for context
  const entries = (appState.transcript ?? []).slice(-6);
  for (const e of entries) {
    if (e.role === 'player') UI.appendEntry('player', `> ${e.text}`);
    else                     UI.appendEntry(e.role, e.text);
  }

  UI.appendEntry('system', '');
  UI.appendEntry('system',
    `HP: ${appState.party?.pc?.record?.hpCurrent}/${appState.party?.pc?.sheet?.hp?.max}  ` +
    `Turn: ${appState.session?.turnCount}`
  );
  UI.appendEntry('system', '');

  syncSidebar();
  await playLoop();
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  UI.initCollapsibles();

  // Start Spektrum's rAF-driven tick loop (it only runs on rAF, never
  // automatically). We also call tick() explicitly wherever we need
  // appState to reflect a setValue before the next rAF fires.
  run();

  initState();
  const save = loadFromStorage();
  if (save) restoreState(save);
  tick(); // Flush initState + optional restore → appState before any reads.

  if (save) {
    if (!appState.ai?.key) { await setupKey(); tick(); }
    if (appState.session?.phase === 'play') { await resumeGame(); return; }
  }

  if (!appState.ai?.key) { await setupKey(); tick(); }

  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
