// src/game/flow.js — game lifecycle FSM.
//
// Owns: new game, resume, play loop, end states, key setup, scene images.
// All AI calls go through loop.js (checkApiKey, generateTurnImage, processTurn).

import { appState, setValue, tick, saveToStorage, clearSave, restoreState } from '../core/state.js';
import { generateWorld }   from './world.js';
import { createCharacter } from './character.js';
import { processTurn, checkApiKey, generateTurnImage } from './loop.js';
import * as UI from '../ui/console.js';

// TTS helper — imported lazily so the audio module is a no-op when TTS is off.
function _speak(text) {
  if (!appState.settings?.tts || !appState.ai?.key || !text?.trim()) return;
  import('../ai/tts.js').then(({ speakText }) => speakText(text)).catch(() => {});
}
function _cancelSpeech() {
  import('../ai/tts.js').then(({ cancelSpeech }) => cancelSpeech()).catch(() => {});
}

// ─── Journal log ──────────────────────────────────────────────────────────────
// Accumulates {turn, narration, imageSrc} entries for the current session.
// Exported so exports.js can generate the journal and sketch gallery.

const journalLog = [];
export function getJournalLog() { return journalLog; }

// ─── Sketch view state ────────────────────────────────────────────────────────

export function applySketchView(view) {
  setValue('settings.sketchView', view);
  UI.setSketchOpacity(view === 'minimized' ? 'off' : view === 'maximized' ? 'hi' : 'normal');
  if (view !== 'minimized') UI.restoreSceneImage();
}

// ─── Scene image helpers ──────────────────────────────────────────────────────

function buildImagePrompt(narration) {
  const roomId = appState.world?.currentRoom;
  const room   = appState.world?.rooms?.[roomId];
  const npcs   = Object.values(appState.world?.npcs ?? {})
    .filter(n => n.roomId === roomId && n.alive)
    .map(n => n.name);
  const base = narration || room?.description || 'A dark dungeon corridor';
  return npcs.length ? `${base} ${npcs.join(', ')} present.` : base;
}

function requestSceneImage(narration, journalEntry = null) {
  if ((appState.settings?.sketchView ?? 'windowed') === 'minimized') return Promise.resolve(null);
  UI.showSceneImageLoading();
  return generateTurnImage(buildImagePrompt(narration))
    .then(src => {
      src ? UI.setSceneImage(src) : UI.hideSceneImage();
      if (src && journalEntry) journalEntry.imageSrc = src;
      return src;
    })
    .catch(() => { UI.hideSceneImage(); return null; });
}

// ─── Key / settings setup ────────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export async function setupKey() {
  UI.clear();
  UI.appendEntry('gm',     "Dan's Dungeons");
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

async function reAuthKey() {
  setValue('ai.key', '');
  tick();
  UI.appendEntry('system', '');
  UI.appendEntry('error', 'API key rejected — Missing Authentication header (401).');
  const key = await UI.prompt('Paste a valid OpenRouter API key to continue:');
  if (key.trim()) {
    setValue('ai.key', key.trim());
    tick();
    saveToStorage();
    UI.appendEntry('system', 'Key updated — retrying…');
  }
}

// ─── Key guard ────────────────────────────────────────────────────────────────

export async function ensureKey() {
  if (!appState.ai?.key) {
    await setupKey();
    tick();
    return;
  }
  const valid = await checkApiKey();
  if (!valid) {
    setValue('ai.key', '');
    tick();
    saveToStorage();
    await setupKey();
    tick();
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

// ─── Start a new adventure ────────────────────────────────────────────────────

export async function startNewGame() {
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

  UI.appendEntry('system', '');
  UI.appendEntry('system', '(black ink on sepia parchment — costs a few extra credits per turn)');
  const sketchChoice = await UI.pickFrom(
    'Generate an AI scene sketch after each turn?',
    ['yes', 'no'],
    x => x === 'yes' ? '🖼 Yes, sketch each scene' : '✗ No thanks',
    1,
  );
  setValue('settings.sceneImage', sketchChoice === 'yes');

  const ttsChoice = await UI.pickFrom(
    'Enable voice narration?',
    ['yes', 'no'],
    x => x === 'yes' ? '🔊 Yes, read the story aloud' : '🔇 No thanks',
    1,
  );
  setValue('settings.tts', ttsChoice === 'yes');

  setValue('session.phase', 'play');
  tick();
  saveToStorage();

  await beginAdventure();
}

// ─── Intro scene ─────────────────────────────────────────────────────────────

export async function beginAdventure() {
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

  const openingEntry = { turn: 0, narration: room.description, imageSrc: null };
  journalLog.push(openingEntry);
  if (appState.settings?.sceneImage) requestSceneImage(room.description, openingEntry);
  if (appState.settings?.actionBar)  UI.updateActionBar(room.exits ?? [], pc.record, pc.sheet, {});
  _speak(room.description);

  await playLoop();
}

// ─── Main play loop ───────────────────────────────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000];

export async function playLoop() {
  let pendingRetry = null;

  while (true) {
    if (appState.session.phase !== 'play') break;

    const inExitRoom = appState.world?.currentRoom === appState.world?.exitRoomId;
    if (inExitRoom) { await doVictory(); break; }

    const pcHp = appState.party?.pc?.record?.hpCurrent ?? 1;
    if (pcHp <= 0) { await doDefeat(); break; }

    _cancelSpeech(); // stop any leftover narration before awaiting player input

    const room = appState.world?.rooms?.[appState.world?.currentRoom];
    UI.showRoomChips(room?.exits ?? [], room?.loot ?? []);
    UI.showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
    UI.showSkillChips(appState.session?.skillCooldowns ?? {});
    if (appState.settings?.actionBar) {
      UI.updateActionBar(room?.exits ?? [], appState.party?.pc?.record, appState.party?.pc?.sheet, appState.session?.skillCooldowns ?? {});
    }

    if (pendingRetry) {
      UI.insertActionChip('↺ Retry', pendingRetry);
      pendingRetry = null;
    }

    const raw = await UI.prompt('');
    if (!raw.trim()) continue;

    if (raw.startsWith('/')) { await handleMeta(raw); continue; }

    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true);

    let streamEl = null;
    function onChunk(text) {
      if (!streamEl) {
        UI.setThinking(false);
        streamEl = UI.beginStreamEntry('gm');
      }
      UI.appendStreamChunk(streamEl, text);
    }

    let result    = null;
    let caughtErr = null;
    let reauthed  = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        streamEl?.remove();
        streamEl = null;
        UI.setThinking(false);
        UI.appendEntry('system', `⏳ Retrying… (${attempt}/${RETRY_DELAYS.length})`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
        UI.setThinking(true);
      }
      try {
        result    = await processTurn(raw, onChunk);
        caughtErr = null;
        break;
      } catch (e) {
        caughtErr = e;
        if (/^AI 401:/.test(e.message) && !reauthed) {
          reauthed = true;
          streamEl?.remove();
          streamEl = null;
          UI.setThinking(false);
          await reAuthKey();
          UI.setThinking(true);
          attempt--;
          caughtErr = null;
          continue;
        }
        if (!/^AI 4\d\d:/.test(e.message) || attempt === RETRY_DELAYS.length) break;
      }
    }

    if (caughtErr) {
      UI.setThinking(false);
      streamEl?.remove();
      streamEl = null;
      UI.appendEntry('system', '');
      if (/^AI 401:/.test(caughtErr.message)) {
        UI.appendEntry('error', 'Still failing after re-authentication. Use /settings to update your API key.');
      } else if (/^AI 4\d\d:/.test(caughtErr.message)) {
        UI.appendEntry('gm', 'The Game Master was not available. Try again when you are ready.');
        pendingRetry = raw;
      } else {
        UI.appendEntry('error', `Error: ${caughtErr.message}`);
        UI.appendEntry('system', 'The turn was not resolved. Try again or type /restart.');
      }
      continue;
    }

    tick();

    UI.setThinking(false);
    if (!streamEl && result?.narration) UI.appendEntry('gm', result.narration);
    UI.appendEntry('system', '');

    const journalEntry = { turn: appState.session?.turnCount ?? 0, narration: result?.narration ?? '', imageSrc: null };
    journalLog.push(journalEntry);

    if (appState.settings?.sceneImage) requestSceneImage(result?.narration, journalEntry);
    _speak(result?.narration);
    UI.updateDebugPanel(result?._debug);
  }
}

// ─── End states ───────────────────────────────────────────────────────────────

async function doVictory() {
  setValue('session.phase', 'game-over');
  const room     = appState.world?.rooms?.[appState.world?.exitRoomId];
  const treasure = (room?.loot ?? []).find(i => i.type === 'treasure');
  const victoryText =
    `You have found ${treasure?.name ?? 'the treasure'} and made it out alive. ` +
    `The adventure ends in triumph — for now.`;
  UI.appendEntry('system', '');
  UI.appendEntry('system', '══ VICTORY ══════════════════════════════════');
  UI.appendEntry('gm', victoryText);
  UI.appendEntry('system', '');
  UI.appendEntry('system', 'Type /restart to play again.');
  _speak(victoryText);
  await awaitRestart();
}

async function doDefeat() {
  setValue('session.phase', 'game-over');
  const defeatText =
    'The world dims. Grizzik\'s mocking cackle echoes through the stone ' +
    'as you collapse to the cold floor. Your adventure ends here — for now.';
  UI.appendEntry('system', '');
  UI.appendEntry('system', '══ DEFEAT ════════════════════════════════════');
  UI.appendEntry('gm', defeatText);
  UI.appendEntry('system', '');
  UI.appendEntry('system', 'Type /restart to try again.');
  _speak(defeatText);
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

// ─── Resume a saved game ──────────────────────────────────────────────────────

export async function resumeGame() {
  UI.appendEntry('system', '── RESUMING ADVENTURE ────────────────────────');
  UI.appendEntry('system', '');

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

  await playLoop();
}
