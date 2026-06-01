// src/main.js — Boot entry point only.
// Game lifecycle → flow.js  |  UI modules → ui/*  |  Reactive bindings → reactive.js

import { appState, setValue, bindDOM, initState, restoreState, loadFromStorage, saveToStorage, run, tick } from './core/state.js';
import { registerReactiveSidebar }                                                           from './ui/reactive.js';
import { createJournal, exportScreenshot, exportAllSketches, importSave, handleImportFile } from './ui/exports.js';
import { startNewGame, resumeGame, ensureKey, applySketchView }                             from './game/flow.js';
import * as UI from './ui/console.js';

async function boot() {
  document.getElementById('skeleton-loading')?.remove();
  document.documentElement.classList.add('styles-loaded');

  UI.initCollapsibles();
  UI.initCopyKeyButton(() => appState.ai?.key ?? '');

  document.getElementById('sketch-btn-min')?.addEventListener('click', () => applySketchView('minimized'));
  document.getElementById('sketch-btn-win')?.addEventListener('click', () => applySketchView('windowed'));
  document.getElementById('sketch-btn-max')?.addEventListener('click', () => applySketchView('maximized'));

  const actionBarToggle = document.getElementById('action-bar-toggle');
  actionBarToggle?.addEventListener('click', () => {
    const next = !(appState.settings?.actionBar ?? true);
    setValue('settings.actionBar', next);
    actionBarToggle.setAttribute('aria-pressed', String(next));
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

  const urlKey = new URLSearchParams(location.search).get('key');
  if (urlKey) {
    setValue('ai.key', urlKey.trim());
    history.replaceState(null, '', location.pathname);
  }

  tick();
  bindDOM(document.body);
  document.body.classList.add('spektrum-ready');

  if (actionBarToggle) {
    actionBarToggle.setAttribute('aria-pressed', String(appState.settings?.actionBar ?? true));
  }

  await ensureKey();

  if (save && appState.session?.phase === 'play') { await resumeGame(); return; }
  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
