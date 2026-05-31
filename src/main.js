// src/main.js
//
// Boot sequence. Decides whether to start fresh or resume a save,
// then hands off to the character creation wizard or the play loop.

import {
  appState,
  setValue,
  addValue,
  watch,
  addSystem,
  computed,
  bindDOM,
  initState,
  restoreState,
  loadFromStorage,
  saveToStorage,
  clearSave,
  run,
  tick,
} from './core/state.js';

import { generateWorld }      from './game/world.js';
import { createCharacter }    from './game/character.js';
import { processTurn }        from './game/loop.js';
import { generateSceneImage, checkKey } from './ai/openrouter.js';
import * as UI from './ui/console.js';

// ─── Reactive sidebar (subscribes to appState) ────────────────────────────────

// Registered in boot() before the first tick so the initial state fires them.
function registerReactiveSidebar() {
  computed('ui.costDisplay', ['ai.totalTokens', 'ai.totalCostUsd'], (s) => {
    const tokens = s.ai?.totalTokens ?? 0;
    const cost   = s.ai?.totalCostUsd ?? 0;
    return tokens > 0 ? '$' + cost.toFixed(4) + ' · ' + tokens.toLocaleString() + ' tok' : '';
  });

  addSystem(['party.pc', 'party.inventory', 'world.currentRoom', 'world.npcs'], () => {
    const pc = appState.party?.pc;
    UI.updatePCStats(pc?.record, pc?.sheet, appState.party?.inventory ?? []);
    const currentRoom = appState.world?.currentRoom;
    const roomNpcs = Object.values(appState.world?.npcs ?? {}).filter(n => n.roomId === currentRoom);
    UI.updateEnemyStats(roomNpcs);
  });
}

// ─── Scene image helpers ──────────────────────────────────────────────────────

// Builds a concise scene description for the image generation prompt.
function buildImagePrompt() {
  const roomId = appState.world?.currentRoom;
  const room   = appState.world?.rooms?.[roomId];
  const npcs   = Object.values(appState.world?.npcs ?? {})
    .filter(n => n.roomId === roomId && n.alive)
    .map(n => n.name);
  const desc = room?.description ?? 'A dark dungeon corridor';
  return npcs.length ? `${desc} ${npcs.join(', ')} present.` : desc;
}

// Fire-and-forget: generates a scene image and updates the panel when ready.
function requestSceneImage() {
  UI.showSceneImageLoading();
  generateSceneImage(buildImagePrompt())
    .then(src => { src ? UI.setSceneImage(src) : UI.hideSceneImage(); })
    .catch(() => UI.hideSceneImage());
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

// ─── Mid-game re-authentication (401 recovery) ───────────────────────────────

async function reAuthKey() {
  // Clear the invalid key immediately — hides the 🔑 icon via data-if.
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

  // Ask about scene sketches before starting.
  UI.appendEntry('system', '');
  UI.appendEntry('system', 'Generate an AI journal-sketch of each scene after your turn?');
  UI.appendEntry('system', '(black ink on sepia parchment — costs a few extra credits per turn)');
  UI.showActionChips([
    { label: '🖼 Yes, sketch each scene', value: 'yes' },
    { label: '✗ No thanks',              value: 'no'  },
  ]);
  const sketchChoice = await UI.prompt('');
  const wantsSketch  = sketchChoice.toLowerCase().startsWith('y');
  setValue('settings.sceneImage', wantsSketch);
  document.getElementById('scene-image-toggle')?.setAttribute('aria-pressed', String(wantsSketch));
  UI.clearChips();

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

  await playLoop();
}

// ─── Main play loop ───────────────────────────────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000]; // ms between attempts 1→2, 2→3, 3→4

async function playLoop() {
  let pendingRetry = null; // raw input to surface as a Retry chip after exhausted retries

  while (true) {
    if (appState.session.phase !== 'play') break;

    const inExitRoom = appState.world?.currentRoom === appState.world?.exitRoomId;
    if (inExitRoom) { await doVictory(); break; }

    const pcHp = appState.party?.pc?.record?.hpCurrent ?? 1;
    if (pcHp <= 0) { await doDefeat(); break; }

    const room = appState.world?.rooms?.[appState.world?.currentRoom];
    UI.showRoomChips(room?.exits ?? [], room?.loot ?? []);
    UI.showCharacterChips(appState.party?.pc?.record, appState.party?.pc?.sheet);
    UI.showSkillChips(appState.session?.skillCooldowns ?? {});

    // Surface a Retry chip if the previous turn failed after all retries.
    if (pendingRetry) {
      UI.insertActionChip('↺ Retry', pendingRetry);
      pendingRetry = null;
    }

    // Wait for player input (chips or typed)
    const raw = await UI.prompt('');
    if (!raw.trim()) continue;

    // ── Meta commands ────────────────────────────────────────────────────────
    if (raw.startsWith('/')) { await handleMeta(raw); continue; }

    // ── Regular turn ─────────────────────────────────────────────────────────
    UI.appendEntry('player', `> ${raw}`);
    UI.clearChips();
    UI.setThinking(true);

    // Set up streaming: first chunk hides the "thinking" indicator and creates
    // the GM entry that subsequent chunks append into.
    // streamEl is reset to null before each retry so a fresh entry is created.
    let streamEl = null;
    function onChunk(text) {
      if (!streamEl) {
        UI.setThinking(false);
        streamEl = UI.beginStreamEntry('gm');
      }
      UI.appendStreamChunk(streamEl, text);
    }

    // Attempt the turn up to 4 times (initial + 3 retries) on 4XX errors.
    // 401 is handled separately: re-auth once, then retry immediately (no delay).
    let result    = null;
    let caughtErr = null;
    let reauthed  = false;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        streamEl?.remove();  // discard any partial stream from the failed attempt
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

        // 401: bad/missing key — prompt once, then retry immediately without delay.
        if (/^AI 401:/.test(e.message) && !reauthed) {
          reauthed = true;
          streamEl?.remove();
          streamEl = null;
          UI.setThinking(false);
          await reAuthKey();
          UI.setThinking(true);
          attempt--;   // don't consume a delay-retry slot
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
        // Re-auth was attempted but still failing — tell them to check settings.
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

    // Flush commitAll delta → appState so win/defeat checks below see
    // the updated NPC alive status and PC HP immediately.
    tick();

    UI.setThinking(false);
    // If streaming rendered the narration progressively, skip the static append.
    if (!streamEl && result?.narration) UI.appendEntry('gm', result.narration);
    UI.appendEntry('system', '');

    // Scene sketch — non-blocking; fires after narration is visible.
    if (appState.settings?.sceneImage) requestSceneImage();

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

  await playLoop();
}

// ─── Key guard ────────────────────────────────────────────────────────────────
// Called once in boot after state is restored. Ensures a working key exists
// before any gameplay begins. If the stored key is present but invalid (401)
// it is cleared so the icon hides, then setupKey() runs.

async function ensureKey() {
  if (!appState.ai?.key) {
    await setupKey();
    tick();
    return;
  }
  // Validate the stored key — only blocks on a definitive 401.
  const valid = await checkKey();
  if (!valid) {
    setValue('ai.key', '');
    tick();
    saveToStorage();
    await setupKey();
    tick();
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  UI.initCollapsibles();
  UI.initCopyKeyButton(() => appState.ai?.key ?? '');

  // Scene-image toggle — reads/writes settings.sceneImage in Spektrum.
  const sceneToggle = document.getElementById('scene-image-toggle');
  sceneToggle?.addEventListener('click', () => {
    const next = !(appState.settings?.sceneImage ?? false);
    setValue('settings.sceneImage', next);
    sceneToggle.setAttribute('aria-pressed', String(next));
    if (!next) UI.hideSceneImage();
    saveToStorage();
  });

  run();

  // Register reactive subscriptions before first tick so they fire with initial state.
  registerReactiveSidebar();

  initState();
  const save = loadFromStorage();
  if (save) restoreState(save);

  // ?key= URL param seeds the key for the session without touching the save.
  // Useful after a hard browser reset — share the URL with your key pre-filled.
  const urlKey = new URLSearchParams(location.search).get('key');
  if (urlKey) {
    setValue('ai.key', urlKey.trim());
    // Strip the key from the address bar so it isn't leaked in browser history.
    history.replaceState(null, '', location.pathname);
  }

  tick();

  // Bind declarative {{expr}} / data-if to live appState after first tick.
  bindDOM(document.getElementById('chrome'));
  bindDOM(document.getElementById('sidebar-header'));

  // Sync toggle button to restored setting.
  sceneToggle?.setAttribute('aria-pressed', String(appState.settings?.sceneImage ?? false));

  await ensureKey();

  if (save && appState.session?.phase === 'play') { await resumeGame(); return; }

  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
