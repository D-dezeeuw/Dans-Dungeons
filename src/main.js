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

// ─── Sketch view state ────────────────────────────────────────────────────────
// 'minimized' | 'windowed' | 'maximized'  — local UI preference, not persisted.

let sketchView = 'windowed';

function applySketchView(view) {
  sketchView = view;
  // min = hidden (off), win = 20% opacity (normal), max = 45% opacity (hi)
  UI.setSketchOpacity(view === 'minimized' ? 'off' : view === 'maximized' ? 'hi' : 'normal');
  if (view !== 'minimized') UI.restoreSceneImage();
  ['min', 'win', 'max'].forEach(id => {
    const map = { min: 'minimized', win: 'windowed', max: 'maximized' };
    document.getElementById(`sketch-btn-${id}`)
      ?.setAttribute('aria-pressed', String(map[id] === view));
  });
}

// ─── Journal log ──────────────────────────────────────────────────────────────
// Accumulates {turn, narration, imageSrc} entries for the current session.

const journalLog = [];

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
    UI.updatePCHeaderStats(pc?.record, pc?.sheet);
    const currentRoom = appState.world?.currentRoom;
    const roomNpcs = Object.values(appState.world?.npcs ?? {}).filter(n => n.roomId === currentRoom);
    UI.updateEnemyHeaderStats(roomNpcs);
  });
}

// ─── Scene image helpers ──────────────────────────────────────────────────────

// Builds a concise scene description for the image generation prompt.
function buildImagePrompt(narration) {
  const roomId = appState.world?.currentRoom;
  const room   = appState.world?.rooms?.[roomId];
  const npcs   = Object.values(appState.world?.npcs ?? {})
    .filter(n => n.roomId === roomId && n.alive)
    .map(n => n.name);
  const base = narration || room?.description || 'A dark dungeon corridor';
  return npcs.length ? `${base} ${npcs.join(', ')} present.` : base;
}

// Generates a scene image, updates the panel, and returns a Promise<string|null>.
// Pass a journalEntry object to backfill imageSrc when the image resolves.
function requestSceneImage(narration, journalEntry = null) {
  if (sketchView === 'minimized') return Promise.resolve(null);
  UI.showSceneImageLoading();
  return generateSceneImage(buildImagePrompt(narration))
    .then(src => {
      console.log('[scene-image] generateSceneImage resolved:', src ? `data URI ${src.length} chars` : 'null');
      src ? UI.setSceneImage(src) : UI.hideSceneImage();
      if (src && journalEntry) journalEntry.imageSrc = src;
      return src;
    })
    .catch(e => { console.warn('[scene-image] uncaught error', e); UI.hideSceneImage(); return null; });
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

  // Ask about scene sketches inside the transcript, no sidebar chips.
  UI.appendEntry('system', '');
  UI.appendEntry('system', '(black ink on sepia parchment — costs a few extra credits per turn)');
  const sketchChoice = await UI.pickFrom(
    'Generate an AI scene sketch after each turn?',
    ['yes', 'no'],
    x => x === 'yes' ? '🖼 Yes, sketch each scene' : '✗ No thanks',
    1,  // default: no
  );
  const wantsSketch = sketchChoice === 'yes';
  setValue('settings.sceneImage', wantsSketch);
  const sketchControls = document.getElementById('sketch-controls');
  if (sketchControls) sketchControls.style.display = wantsSketch ? '' : 'none';

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

  // Opening journal entry — the scene description is the first narration.
  const openingEntry = { turn: 0, narration: room.description, imageSrc: null };
  journalLog.push(openingEntry);
  if (appState.settings?.sceneImage) requestSceneImage(room.description, openingEntry);
  if (appState.settings?.actionBar)  UI.updateActionBar(room.exits ?? [], appState.party?.pc?.record, appState.party?.pc?.sheet, {});

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
    if (appState.settings?.actionBar) {
      UI.updateActionBar(room?.exits ?? [], appState.party?.pc?.record, appState.party?.pc?.sheet, appState.session?.skillCooldowns ?? {});
    }

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

    // Journal entry — accumulate narration now; image backfilled when it resolves.
    const journalEntry = { turn: appState.session?.turnCount ?? 0, narration: result?.narration ?? '', imageSrc: null };
    journalLog.push(journalEntry);

    // Scene sketch — non-blocking; fires after narration is visible.
    if (appState.settings?.sceneImage) requestSceneImage(result?.narration, journalEntry);

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

// ─── Action bar ───────────────────────────────────────────────────────────────

function applyActionBarState(on) {
  document.getElementById('action-bar').style.display = on ? '' : 'none';
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// Export the current scene sketch as a PNG.
function exportScreenshot() {
  const src = localStorage.getItem('sketch-last-image');
  if (!src?.startsWith('data:image')) {
    UI.appendEntry('system', 'No scene sketch to export yet.');
    return;
  }
  const [header, b64] = src.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: mime });
  const name  = appState.party?.pc?.record?.name ?? 'adventurer';
  triggerDownload(blob, `dans-dungeons-sketch-${name.toLowerCase().replace(/\s+/g, '-')}.png`);
}

// Export all session sketches as a self-contained HTML page.
function exportAllSketches() {
  const sketches = journalLog.filter(e => e.imageSrc);
  if (!sketches.length) {
    UI.appendEntry('system', 'No sketches generated this session yet.');
    return;
  }
  const pcName = appState.party?.pc?.record?.name ?? 'Adventurer';
  const rows   = sketches.map((e, i) =>
    `<figure>
  <figcaption>${i === 0 ? 'Opening scene' : 'Turn ' + e.turn}</figcaption>
  <img src="${e.imageSrc}" alt="Scene sketch turn ${e.turn}">
</figure>`
  ).join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Sketches — ${pcName}</title>
<style>
  body{background:#f5e6c8;color:#3a2a1a;font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:2rem}
  h1{text-align:center;color:#5c3d1a;margin-bottom:2rem}
  figure{margin:0 0 2rem;border-top:1px solid #c8a878;padding-top:1.5rem}
  figcaption{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#8c6a3a;margin-bottom:.6rem}
  img{width:100%;border:1px solid #c8a878;border-radius:2px}
</style></head>
<body><h1>Sketches of ${pcName}</h1>${rows}</body></html>`;
  triggerDownload(new Blob([html], { type: 'text/html' }),
    `dans-dungeons-sketches-${pcName.toLowerCase().replace(/\s+/g, '-')}.html`);
}

// Import a .dnd.json save file.
function importSave() {
  document.getElementById('import-file-input').click();
}

function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = ''; // reset so same file can be picked again
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const snap = JSON.parse(ev.target.result);
      restoreState(snap);
      tick();
      saveToStorage();
      UI.appendEntry('system', `Imported save: ${file.name}`);
    } catch {
      UI.appendEntry('error', 'Failed to import — file is not a valid save.');
    }
  };
  reader.readAsText(file);
}

// ─── Journal generator ────────────────────────────────────────────────────────
// Builds a standalone HTML file from journalLog and triggers a download.
// No dependencies — everything is inline: CSS, base64 images, text.

function createJournal() {
  if (!journalLog.length) return;
  const pcName  = appState.party?.pc?.record?.name ?? 'Adventurer';
  const pcClass = appState.party?.pc?.record?.classId ?? '';

  const entriesHtml = journalLog.map((entry, i) => {
    const heading = i === 0 ? 'The Adventure Begins' : `Turn ${entry.turn}`;
    const img = entry.imageSrc
      ? `<img src="${entry.imageSrc}" alt="Scene sketch" style="width:100%;display:block;margin-bottom:1.2rem;border-radius:2px;">`
      : '';
    const text = entry.narration
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<div class="entry">
  <div class="turn-label">${heading}</div>
  ${img}
  <p>${text}</p>
</div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Journal of ${pcName.replace(/</g, '&lt;')}</title>
<style>
  body { background:#f5e6c8; color:#3a2a1a; font-family:Georgia,'Times New Roman',serif; max-width:700px; margin:0 auto; padding:2rem 1.5rem; line-height:1.8; }
  h1 { text-align:center; font-size:2rem; margin-bottom:0.3rem; color:#5c3d1a; letter-spacing:0.04em; }
  .subtitle { text-align:center; color:#8c6a3a; font-style:italic; margin-bottom:2.5rem; font-size:1rem; }
  .entry { border-top:1px solid #c8a878; padding-top:1.5rem; margin-top:1.5rem; }
  .entry:first-child { border-top:none; margin-top:0; }
  .turn-label { font-size:0.75rem; text-transform:uppercase; letter-spacing:0.1em; color:#8c6a3a; margin-bottom:0.8rem; }
  p { margin:0; }
  img { border:1px solid #c8a878; }
</style>
</head>
<body>
<h1>Journal of ${pcName.replace(/</g, '&lt;')}</h1>
<div class="subtitle">A ${pcClass} — Dan's Dungeons</div>
${entriesHtml}
</body>
</html>`;

  triggerDownload(new Blob([html], { type: 'text/html' }),
    `dans-dungeons-journal-${pcName.toLowerCase().replace(/\s+/g, '-')}.html`);
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
  // Remove the static skeleton now that JS is running
  document.getElementById('skeleton-loading')?.remove();

  UI.initCollapsibles();
  UI.initCopyKeyButton(() => appState.ai?.key ?? '');

  // Sketch opacity controls are shown reactively via sketch-controls visibility.

  // Sketch size buttons.
  document.getElementById('sketch-btn-min')?.addEventListener('click', () => applySketchView('minimized'));
  document.getElementById('sketch-btn-win')?.addEventListener('click', () => applySketchView('windowed'));
  document.getElementById('sketch-btn-max')?.addEventListener('click', () => applySketchView('maximized'));

  // Action bar toggle.
  const actionBarToggle = document.getElementById('action-bar-toggle');
  actionBarToggle?.addEventListener('click', () => {
    const next = !(appState.settings?.actionBar ?? true);
    setValue('settings.actionBar', next);
    actionBarToggle.setAttribute('aria-pressed', String(next));
    actionBarToggle.textContent = next ? 'ON' : 'OFF';
    applyActionBarState(next);
    saveToStorage();
  });

  // Export / import tiles.
  document.getElementById('export-journal')?.addEventListener('click', createJournal);
  document.getElementById('export-screenshot')?.addEventListener('click', exportScreenshot);
  document.getElementById('export-sketches')?.addEventListener('click', exportAllSketches);
  document.getElementById('export-import')?.addEventListener('click', importSave);
  document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);

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

  // Sync sketch controls to restored setting.
  const sketchOn = appState.settings?.sceneImage ?? false;
  const sketchControls = document.getElementById('sketch-controls');
  if (sketchControls) sketchControls.style.display = sketchOn ? '' : 'none';

  // Sync action bar toggle to restored setting.
  const abOn = appState.settings?.actionBar ?? true;
  if (actionBarToggle) {
    actionBarToggle.setAttribute('aria-pressed', String(abOn));
    actionBarToggle.textContent = abOn ? 'ON' : 'OFF';
  }
  applyActionBarState(abOn);

  await ensureKey();

  if (save && appState.session?.phase === 'play') { await resumeGame(); return; }

  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
