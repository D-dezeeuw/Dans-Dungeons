// src/main.js — Boot entry point only.
// Game lifecycle → flow.js  |  UI modules → ui/*  |  Reactive bindings → reactive.js

import { appState, setValue, bindDOM, initState, restoreState, loadFromStorage, saveToStorage, run, tick } from './core/state.js';
import { registerReactiveSidebar }                                                           from './ui/reactive.js';
import { createJournal, exportScreenshot, exportAllSketches, importSave, handleImportFile } from './ui/exports.js';
import { startNewGame, resumeGame, ensureKey, applySketchView }                             from './game/flow.js';
import { initSpeakHover }                                                                   from './ui/transcript.js';
import { initMicButton }                                                                    from './ui/input.js';
import * as UI from './ui/console.js';
import { locale, setLocale, t } from './i18n/i18n.js';

async function boot() {
  document.getElementById('skeleton-loading')?.remove();
  document.documentElement.classList.add('styles-loaded');

  UI.initCollapsibles();
  UI.initCopyKeyButton(() => appState.ai?.key ?? '');

  // Locale toggle — switches language and reloads to apply.
  const localeBtn   = document.getElementById('locale-toggle');
  const localeLabel = document.getElementById('locale-label');
  function syncLocaleUI() {
    if (localeBtn) localeBtn.textContent = locale().toUpperCase();
    if (localeLabel) localeLabel.textContent = t('sidebar.language');
    document.documentElement.lang = locale();
  }
  syncLocaleUI();
  localeBtn?.addEventListener('click', () => {
    setLocale(locale() === 'nl' ? 'en' : 'nl');
    location.reload();
  });

  document.getElementById('sketch-btn-min')?.addEventListener('click', () => applySketchView('minimized'));
  document.getElementById('sketch-btn-win')?.addEventListener('click', () => applySketchView('windowed'));
  document.getElementById('sketch-btn-max')?.addEventListener('click', () => applySketchView('maximized'));

  const actionBarToggle = document.getElementById('action-bar-toggle');
  actionBarToggle?.addEventListener('click', () => {
    setValue('settings.actionBar', !(appState.settings?.actionBar ?? true));
    saveToStorage();
  });

  document.getElementById('sketch-toggle')?.addEventListener('click', () => {
    setValue('settings.sceneImage', !(appState.settings?.sceneImage ?? false));
    saveToStorage();
  });

  // TTS toggle — 🔊/🔇 button inside #transcript
  const ttsToggle = document.getElementById('tts-toggle');
  ttsToggle?.addEventListener('click', () => {
    setValue('settings.tts', !(appState.settings?.tts ?? false));
    saveToStorage();
  });

  // Roleplay mode — immersive view with forced TTS; restores TTS state on exit.
  const roleplayBtn = document.getElementById('roleplay-btn');
  roleplayBtn?.addEventListener('click', () => {
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

  document.getElementById('export-journal')?.addEventListener('click', createJournal);
  document.getElementById('export-screenshot')?.addEventListener('click', exportScreenshot);
  document.getElementById('export-sketches')?.addEventListener('click', exportAllSketches);
  document.getElementById('export-import')?.addEventListener('click', importSave);
  document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);

  run();
  registerReactiveSidebar();
  initState();

  const save = loadFromStorage();
  if (save) restoreState(save);
  if (appState.settings?.roleplayMode) document.body.classList.add('roleplay-mode');

  const urlKey = new URLSearchParams(location.search).get('key');
  if (urlKey) {
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

  await ensureKey();

  if (save && appState.session?.phase === 'play') { await resumeGame(); return; }
  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
