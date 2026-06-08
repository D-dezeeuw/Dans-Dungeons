// src/main.js — Boot entry point only.
// Game lifecycle → flow.js  |  UI modules → ui/*  |  Reactive bindings → reactive.js

import { appState, setValue, bindDOM, initState, restoreState, loadFromStorage, saveToStorage, run, tick } from './core/state.js';
import { registerReactiveSidebar }                                                           from './ui/reactive.js';
import { createJournal, exportScreenshot, exportAllSketches, exportSave, importSave, handleImportFile, exportWorldBible } from './ui/exports.js';
import { startNewGame, resumeGame, ensureKey, applySketchView, upgradeToDeluxe, requireDeluxe } from './game/flow.js';
import { reconcilePc }                                                                        from './game/character.js';
import { initSpeakHover }                                                                   from './ui/transcript.js';
import { initMicButton }                                                                    from './ui/input.js';
import { initUndoButton }                                                                   from './game/undo.js';
import * as UI from './ui/console.js';
import { locale, setLocale, t } from './i18n/i18n.js';

async function boot() {
  // Expose game state for console debugging: game.world, game.party, etc.
  window.game = appState;

  document.getElementById('skeleton-loading')?.remove();
  document.documentElement.classList.add('styles-loaded');

  UI.initCollapsibles();

  // Locale switcher — two buttons, active class on the current one.
  const localeLabel = document.getElementById('locale-label');
  if (localeLabel) localeLabel.textContent = t('sidebar.language');
  document.documentElement.lang = locale();

  for (const btn of document.querySelectorAll('.locale-opt')) {
    const code = btn.dataset.locale;
    btn.classList.toggle('active', code === locale());
    btn.title = code === 'en' ? 'English' : 'Nederlands';
    btn.addEventListener('click', () => {
      if (code === locale()) return;
      setLocale(code);
      location.reload();
    });
  }

  document.getElementById('sketch-btn-min')?.addEventListener('click', () => applySketchView('minimized'));
  document.getElementById('sketch-btn-win')?.addEventListener('click', () => applySketchView('windowed'));
  document.getElementById('sketch-btn-max')?.addEventListener('click', () => applySketchView('maximized'));

  const actionBarToggle = document.getElementById('action-bar-toggle');
  actionBarToggle?.addEventListener('click', () => {
    setValue('settings.actionBar', !(appState.settings?.actionBar ?? true));
    saveToStorage();
  });

  document.getElementById('debug-bar-toggle')?.addEventListener('click', () => {
    setValue('settings.debugBar', !(appState.settings?.debugBar ?? false));
    saveToStorage();
  });

  document.getElementById('sketch-toggle')?.addEventListener('click', () => {
    if (!requireDeluxe('imageLabel')) return;
    setValue('settings.sceneImage', !(appState.settings?.sceneImage ?? false));
    saveToStorage();
  });

  // TTS toggle — volume on/off button inside #transcript
  const ttsToggle = document.getElementById('tts-toggle');
  ttsToggle?.addEventListener('click', () => {
    if (!requireDeluxe('ttsLabel')) return;
    setValue('settings.tts', !(appState.settings?.tts ?? false));
    saveToStorage();
  });

  // Roleplay mode — immersive view with forced TTS; restores TTS state on exit.
  const roleplayBtn = document.getElementById('roleplay-btn');
  roleplayBtn?.addEventListener('click', () => {
    if (!requireDeluxe('ttsLabel')) return;
    const next = !(appState.settings?.roleplayMode ?? false);
    if (next) {
      setValue('settings._preTts', appState.settings?.tts ?? false);
      setValue('settings.tts', true);
    } else {
      setValue('settings.tts', appState.settings?._preTts ?? false);
    }
    setValue('settings.roleplayMode', next);
    document.body.classList.toggle('roleplay-mode', next);
    saveToStorage();
  });

  // Autoplay toggle (Deluxe only)
  const autoplayBtn = document.getElementById('autoplay-btn');
  autoplayBtn?.addEventListener('click', () => {
    if (!requireDeluxe('autoplayLabel')) return;
    const next = !(appState.settings?.autoplay ?? false);
    setValue('settings.autoplay', next);
    autoplayBtn.classList.toggle('active', next);
    saveToStorage();
  });

  document.getElementById('export-journal')?.addEventListener('click', () => {
    createJournal().catch(e => {
      console.error('Journal export error:', e);
      import('./ui/transcript.js').then(({ appendEntry }) =>
        appendEntry('error', `Journal export failed: ${e.message}`)
      );
    });
  });
  document.getElementById('export-screenshot')?.addEventListener('click', exportScreenshot);
  document.getElementById('export-sketches')?.addEventListener('click', exportAllSketches);
  document.getElementById('export-save')?.addEventListener('click', exportSave);
  document.getElementById('export-import')?.addEventListener('click', importSave);
  document.getElementById('export-world-bible')?.addEventListener('click', () => {
    exportWorldBible().catch(e => {
      console.error('World Bible error:', e);
      import('./ui/transcript.js').then(({ appendEntry }) =>
        appendEntry('error', `World Bible failed: ${e.message}`)
      );
    });
  });
  document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);

  // Deluxe upgrade button
  document.getElementById('deluxe-upgrade')?.addEventListener('click', () => {
    upgradeToDeluxe().catch(e => console.error('Upgrade failed:', e));
  });

  run();
  registerReactiveSidebar();
  initState();

  const save = loadFromStorage();
  if (save) {
    restoreState(save);
    // Re-derive the sheet from the record — never trust the persisted sheet,
    // which may have been produced by an older rules engine.
    if (appState.party?.pc) setValue('party.pc', reconcilePc(appState.party.pc));
  }
  if (appState.settings?.roleplayMode) document.body.classList.add('roleplay-mode');
  if (appState.settings?.autoplay) document.getElementById('autoplay-btn')?.classList.add('active');

  // Handle OAuth callback (?code=) or direct key (?key=) from URL.
  const params = new URLSearchParams(location.search);
  const urlKey  = params.get('key');
  const urlCode = params.get('code');

  if (urlCode) {
    history.replaceState(null, '', location.pathname);
    try {
      const { exchangeCodeForKey } = await import('./ai/auth.js');
      const key = await exchangeCodeForKey(urlCode);
      setValue('ai.key', key);
      saveToStorage();
      import('./ui/transcript.js').then(({ appendEntry }) =>
        appendEntry('system', t('setup.oauthSuccess'))
      );
    } catch (e) {
      console.error('OAuth key exchange failed:', e);
      import('./ui/transcript.js').then(({ appendEntry }) =>
        appendEntry('error', t('setup.oauthFail'))
      );
    }
  } else if (urlKey) {
    setValue('ai.key', urlKey.trim());
    history.replaceState(null, '', location.pathname);
  }

  tick();
  bindDOM(document.body);
  document.body.classList.add('spektrum-ready');

  // STT defaults to on when a key is present (mic button shows via data-if="settings.stt")
  if (!appState.settings?.hasOwnProperty('stt')) {
    setValue('settings.stt', true);
  }

  initSpeakHover();
  initMicButton();
  initUndoButton();

  await ensureKey();

  if (save && appState.session?.phase === 'play') { await resumeGame(); return; }
  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
