// src/main.js — Boot entry point only.
// Game lifecycle → flow.js  |  UI modules → ui/*  |  Reactive bindings → reactive.js

import { appState, setValue, bindDOM, initState, restoreState, loadFromStorage, saveToStorage, run, tick,
         onSaveHealthChange, storagePressure, hasCorruptSaveBackup, compactColdArchive } from './core/state.js';
import { registerReactiveSidebar }                                                           from './ui/reactive.js';
import { createJournal, exportScreenshot, exportAllSketches, exportSave, importSave, handleImportFile, exportWorldBible, manageSlots } from './ui/exports.js';
import { startNewGame, resumeGame, ensureKey, applySketchView, sketchThisScene, upgradeToDeluxe, requireDeluxe } from './game/flow.js';
import { reconcilePc }                                                                        from './game/character.js';
import { initSpeakHover }                                                                   from './ui/transcript.js';
import { initMicButton }                                                                    from './ui/input.js';
import { initTimeTravel, importTimeTravel }                                                 from './game/undo.js';
import { initTimeline }                                                                     from './ui/timeline.js';
import { verifyCombatLog }                                                                  from './game/rng.js';
import { getSpend, onSpendChange, budgetWarningDue, setBudget, getBudget, TIERS }           from './ai/spend.js';
import * as UI from './ui/console.js';
import { locale, setLocale, t } from './i18n/i18n.js';
import { claimTab, onPrimaryChange } from './core/tabs.js';
import { applyPackOverlay } from './settings/index.js';
import { onSchemaViolation } from './ai/validate.js';

async function boot() {
  // A provider quietly ignoring a schema is otherwise invisible: the turn just
  // comes out strange. Say it once, where a bug report can find it.
  onSchemaViolation((where, detail) => console.warn(`[ai] ${where} broke its schema: ${detail}`));

  // One campaign, one writer. Claimed before anything can autosave; a second
  // tab becomes a read-only spectator rather than overwriting the first.
  // Announced on the CHANGE, never on the initial value: the claim resolves a
  // beat after boot, so reading it immediately would accuse the only open tab
  // of being the second one.
  onPrimaryChange((primary) => {
    setValue('session.spectator', !primary);
    tick();
  });
  claimTab();

  // Expose game state for console debugging: game.world, game.party, etc.
  window.game = appState;
  // Audit the current epoch's seeded combat rolls from the console:
  // verifyRolls() → { ok } if every recorded roll replays from the seed.
  window.verifyRolls = verifyCombatLog;

  // Cost meter = real cumulative AI spend (src/ai/spend.js), updated imperatively
  // so undo can't rewind it (it lives outside Spektrum history).
  const renderSpend = (s) => {
    const el = document.getElementById('cost-meter');
    if (!el) return;
    // On a hosted table the money is the host's, not the player's. Showing them
    // a running dollar figure they do not owe — and warning them against a cap
    // that meters somebody else's account — would be worse than showing
    // nothing. Tokens are the number that still means something to them: it is
    // what their table's allowance is counted in.
    const hosted = appState.ai?.credential === 'tenant';
    const tokens = s.tokens.toLocaleString() + ' tok';
    el.textContent   = s.tokens > 0 ? (hosted ? tokens : '$' + s.costUsd.toFixed(4) + ' · ' + tokens) : '';
    el.style.display = s.tokens > 0 ? '' : 'none';
    // The per-tier split lives in the tooltip: the running total never showed
    // that a sketch costs many times the paragraph it illustrates.
    const parts = TIERS
      .filter(k => (s.byTier?.[k]?.tokens ?? 0) > 0 || (s.byTier?.[k]?.costUsd ?? 0) > 0)
      .map(k => hosted
        ? `${k}: ${(s.byTier[k].tokens ?? 0).toLocaleString()} tok`
        : `${k}: $${(s.byTier[k].costUsd).toFixed(4)}`);
    el.title = hosted
      ? [t('budget.hosted'), ...parts].join(' · ')
      : (parts.length ? parts.join(' · ') : '');

    // Soft budget cap: warn once per threshold, never interrupt a campaign.
    // Not on a hosted table — the cap is denominated in the player's money, and
    // there is none of it being spent here.
    const warn = hosted ? null : budgetWarningDue();
    if (warn) UI.appendEntry('system', t(warn.level >= 100 ? 'budget.over' : 'budget.near', {
      spent: warn.spentUsd.toFixed(2), cap: warn.capUsd.toFixed(2),
    }));
  };
  onSpendChange(renderSpend);
  renderSpend(getSpend());

  // Session budget: a soft cap the player sets, warned on at 80% and 100%.
  const budgetInput = document.getElementById('budget-cap');
  if (budgetInput) {
    const cap = getBudget().capUsd;
    if (cap > 0) budgetInput.value = String(cap);
    budgetInput.placeholder = t('budget.none');
    budgetInput.previousElementSibling && (budgetInput.previousElementSibling.textContent = t('budget.label'));
    budgetInput.addEventListener('change', () => setBudget(budgetInput.value));
  }

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
  // Sketches are rationed to room changes now, so the player needs a way to ask
  // for one of a scene they care about.
  document.getElementById('sketch-btn-now')?.addEventListener('click', () => sketchThisScene());

  const actionBarToggle = document.getElementById('action-bar-toggle');
  actionBarToggle?.addEventListener('click', () => {
    setValue('settings.actionBar', !(appState.settings?.actionBar ?? true));
    saveToStorage();
  });

  document.getElementById('debug-bar-toggle')?.addEventListener('click', () => {
    setValue('settings.debugBar', !(appState.settings?.debugBar ?? false));
    saveToStorage();
  });

  // Roll audit: replay this epoch's recorded combat rolls from the seed and
  // report whether they all reproduce (a "the dice were honest" check).
  document.getElementById('verify-rolls-btn')?.addEventListener('click', () => {
    const log = appState.session?.rollLog ?? [];
    if (!log.length) { UI.appendEntry('system', t('audit.empty')); return; }
    const res = verifyCombatLog();
    if (res.ok) UI.appendEntry('system', t('audit.ok', { n: log.length }));
    else        UI.appendEntry('error',  t('audit.diverged', { i: res.divergedAt }));
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
  document.getElementById('export-slots')?.addEventListener('click', manageSlots);
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
  const savedTimeTravel = save?._timeTravel ?? null;   // reconstructed after initTimeTravel (below)
  if (save) {
    restoreState(save);   // skips _timeTravel internally
    // Re-derive the sheet from the SAVE's record — never trust the persisted
    // sheet, which may have been produced by an older rules engine. Reading
    // appState here was a pre-tick no-op: restoreState defers until tick(),
    // so the re-derivation never ran for the repo's whole history (audit F2).
    if (save.party?.pc) setValue('party.pc', reconcilePc(save.party.pc));
    // Saves written before the archive watermark existed left a cold store
    // full of duplicated slices. One best-effort pass dedupes and rewrites it;
    // once `session.archived` exists this is a no-op forever.
    compactColdArchive().catch(() => {});
  }
  // Same pre-tick trap: these settings live in the save object, not in the
  // not-yet-ticked appState.
  if (save?.settings?.roleplayMode) document.body.classList.add('roleplay-mode');
  if (save?.settings?.autoplay) document.getElementById('autoplay-btn')?.classList.add('active');

  // Handle the OAuth callback (?code=).
  //
  // `?key=` used to be accepted here as a way to hand the game an API key
  // directly. A key in a URL is a key in browser history, in the referrer of
  // every outbound link, and in whatever chat window the link was pasted into —
  // and it survives there long after the tab is closed. It is gone; the
  // Settings field is the only way in.
  const params  = new URLSearchParams(location.search);
  const urlCode = params.get('code');

  if (urlCode) {
    const urlState = params.get('state');
    // Clear the address bar before anything else: even a code we refuse should
    // not sit in history.
    history.replaceState(null, '', location.pathname);
    const { exchangeCodeForKey, stateMatches } = await import('./ai/auth.js');
    if (!stateMatches(urlState)) {
      // Either this tab never started a sign-in, or someone planted the code.
      // Neither is a reason to redeem it.
      import('./ui/transcript.js').then(({ appendEntry }) =>
        appendEntry('error', t('setup.oauthStateFail'))
      );
    } else {
      try {
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
    }
  }

  tick();
  bindDOM(document.body);
  document.body.classList.add('spektrum-ready');

  // Autosave failures (a full quota) used to be a console.warn: play carried on
  // with nothing being written, and the loss only surfaced on the next reload.
  // Say it in the transcript, and tell the player how to rescue the run.
  onSaveHealthChange((ok) => {
    UI.appendEntry(ok ? 'system' : 'error',
      ok ? t('storage.autosaveRecovered') : t('storage.autosaveFailed'));
  });
  if (hasCorruptSaveBackup()) UI.appendEntry('error', t('storage.corruptSave'));
  storagePressure().then((used) => {
    if (used !== null && used > 0.8) {
      UI.appendEntry('system', t('storage.nearlyFull', { pct: Math.round(used * 100) }));
    }
  });

  // STT defaults to on when a key is present (mic button shows via data-if="settings.stt")
  if (!appState.settings?.hasOwnProperty('stt')) {
    setValue('settings.stt', true);
  }

  initSpeakHover();
  initMicButton();
  initTimeTravel();
  initTimeline();

  // Reconstruct the time-travel epoch (undo/redo + branches) from the save, so it
  // survives a reload. Failsafe: on any malformed/oversized blob, re-establish the
  // plain saved state — basic load is never blocked by time-travel.
  if (savedTimeTravel && appState.session?.phase === 'play') {
    if (!importTimeTravel(savedTimeTravel, save)) {
      restoreState(save);
      tick();
      if (appState.party?.pc) setValue('party.pc', reconcilePc(appState.party.pc));
    }
  }

  // The setting pack's content overlay is i18n module state, not Spektrum
  // state: `world.settingId` rides in the save, but the CONTENT it selects has
  // to be re-installed on every path that re-enters a running game. This is the
  // boot path; import, slot load and time-travel restore each re-apply too.
  // Miss one and the campaign silently reverts to base content halfway through.
  const mounted = applyPackOverlay();
  if (appState.world?.settingId && mounted.id !== appState.world.settingId) {
    UI.appendEntry('system', t('newgame.settingMissing', { id: appState.world.settingId }));
  }

  await ensureKey();

  if (save && appState.session?.phase === 'play') { await resumeGame(); return; }
  await startNewGame();
}

boot().catch((e) => {
  UI.appendEntry('error', `Fatal: ${e.message}`);
  console.error(e);
});
