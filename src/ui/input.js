// src/ui/input.js — player input: keyboard history, prompt/pickFrom,
// prefillChip/fireChip for chip-to-input wiring, and mic-button STT wiring.

import { appendEntry } from './transcript.js';
import { appState } from '../core/state.js';
import { t } from '../i18n/i18n.js';

// ─── Input history ────────────────────────────────────────────────────────────
// Stores submitted strings for UP/DOWN recall. Newest at the end.
// _historyCursor = -1 means "not browsing".

const _history = [];
let   _historyCursor = -1;
let   _historyDraft  = '';  // preserves in-progress text when UP is first pressed

const cmdEl      = () => document.getElementById('cmd');
const transcriptEl      = () => document.getElementById('transcript');
const actionChipsEl     = () => document.getElementById('action-chips');
const inputRowEl        = () => document.getElementById('input-row');

let _resolveInput = null;

// ─── Keyboard wiring ──────────────────────────────────────────────────────────
// ES modules are deferred — the DOM is ready by the time this runs.

cmdEl().addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    if (!_history.length || cmdEl().disabled) return;
    e.preventDefault();
    if (_historyCursor === -1) {
      _historyDraft  = cmdEl().value;
      _historyCursor = _history.length - 1;
    } else if (_historyCursor > 0) {
      _historyCursor--;
    }
    cmdEl().value = _history[_historyCursor];
    cmdEl().setSelectionRange(cmdEl().value.length, cmdEl().value.length);
    return;
  }

  if (e.key === 'ArrowDown') {
    if (_historyCursor === -1 || cmdEl().disabled) return;
    e.preventDefault();
    if (_historyCursor < _history.length - 1) {
      _historyCursor++;
      cmdEl().value = _history[_historyCursor];
    } else {
      _historyCursor = -1;
      cmdEl().value  = _historyDraft;
    }
    cmdEl().setSelectionRange(cmdEl().value.length, cmdEl().value.length);
    return;
  }

  if (e.key !== 'Enter') return;
  _submit(cmdEl().value.trim());
});

cmdEl().addEventListener('focus', () => inputRowEl()?.classList.add('active'));
cmdEl().addEventListener('blur',  () => inputRowEl()?.classList.remove('active'));

transcriptEl().addEventListener('click', () => {
  if (!cmdEl().disabled) cmdEl().focus();
});

// Internal submit — clears input, pushes history, resolves the pending promise.
// Also cancels any in-progress TTS so old narration doesn't overlap the next turn.
function _submit(val) {
  cmdEl().value  = '';
  _historyCursor = -1;
  _historyDraft  = '';
  if (val) _history.push(val);

  // Stop narration audio when the player takes an action (dynamic import so
  // tts.js stays out of the critical path when TTS is not in use).
  import('../ai/tts.js').then(({ cancelSpeech }) => cancelSpeech()).catch(() => {});

  if (_resolveInput) {
    const fn  = _resolveInput;
    _resolveInput = null;
    setInputEnabled(false);
    fn(val);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function setInputEnabled(on, placeholder) {
  const el = cmdEl();
  el.disabled = !on;
  if (on) {
    el.placeholder = placeholder || t('input.placeholder');
    el.focus();
  } else {
    el.placeholder = t('input.disabled');
  }
}

export function prefillChip(text) {
  cmdEl().value = text;
  cmdEl().focus();
  cmdEl().setSelectionRange(text.length, text.length);
}

// Submit immediately if input is awaiting a response; otherwise prefill the field.
export function fireChip(val) {
  if (_resolveInput) {
    const fn  = _resolveInput;
    _resolveInput = null;
    setInputEnabled(false);
    cmdEl().value = '';

    import('../ai/tts.js').then(({ cancelSpeech }) => cancelSpeech()).catch(() => {});

    fn(val);
  } else {
    prefillChip(val);
  }
}

// ─── Prompt API ───────────────────────────────────────────────────────────────

export function prompt(message) {
  if (message) appendEntry('system', message);
  setInputEnabled(true, message || t('input.placeholder'));
  return new Promise((resolve) => { _resolveInput = resolve; });
}

export async function pickFrom(message, options, labelFn = (x) => x, defaultIdx = -1) {
  appendEntry('system', message);
  options.forEach((opt, i) => {
    const isDefault = i === defaultIdx;
    appendEntry(
      isDefault ? 'option-default' : 'option',
      `  ${i + 1}. ${labelFn(opt)}${isDefault ? '  ' + t('charCreate.default') : ''}`
    );
  });
  appendEntry('system', '');

  // The numbered list is the whole of character creation, and it was
  // keyboard-only: on a phone the player read "1. Fighter" and then had to
  // find the number row. The same options are now chips, which submit the
  // number they stand for — so typing still works exactly as it did.
  renderPickChips(options, labelFn, defaultIdx);

  try {
    return await pickLoop(options, labelFn, defaultIdx);
  } finally {
    // Whatever happened — a pick, or a caller that gave up — the options are
    // no longer answerable, so they must not stay on screen as if they were.
    const el = actionChipsEl();
    if (el) el.innerHTML = '';
  }
}

// Rendered here rather than through chips.js: that module imports this one, and
// a cycle between them is not worth a shared helper this small.
function renderPickChips(options, labelFn, defaultIdx) {
  const el = actionChipsEl();
  if (!el) return;
  el.innerHTML = '';
  const group = document.createElement('div');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('input.pickGroupLabel'));
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'chip' + (i === defaultIdx ? ' chip-default' : '');
    btn.textContent = `${i + 1}. ${labelFn(opt)}`;
    btn.setAttribute('aria-label',
      `${labelFn(opt)}${i === defaultIdx ? `, ${t('charCreate.default')}` : ''}`);
    // Submits the number, so a click and a typed "2" travel the identical path.
    btn.addEventListener('click', () => fireChip(String(i + 1)));
    group.appendChild(btn);
  });
  el.appendChild(group);
}

async function pickLoop(options, labelFn, defaultIdx) {
  while (true) {
    const input = await prompt(defaultIdx >= 0 ? t('input.pickDefault') : t('input.pickNoDefault'));
    if (input.trim() === '' && defaultIdx >= 0) return options[defaultIdx];
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) return options[num - 1];
    const match = options.find(
      (o) => o.toLowerCase() === input.toLowerCase() ||
             labelFn(o).toLowerCase() === input.toLowerCase()
    );
    if (match) return match;
    appendEntry('error', t('input.pickError', { n: options.length }));
  }
}

// ─── Mic button (STT) ─────────────────────────────────────────────────────────
// initMicButton() is called once in boot(). The button toggles recording state:
// first click → start recording; second click → stop, transcribe, submit.

export function initMicButton() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    // Gate on Deluxe tier — STT is a paid feature.
    if ((appState.ai?.tier ?? 'free') !== 'deluxe') {
      appendEntry('system', t('tier.featureGated', { feature: t('tier.sttLabel') }));
      return;
    }

    const { isRecording, startRecording, stopRecording, transcribeAudio } =
      await import('../ai/stt.js');

    if (isRecording()) {
      stopRecording();
      return;
    }

    btn.classList.add('recording');

    try {
      const blob = await startRecording();
      btn.classList.remove('recording');
      const transcript = await transcribeAudio(blob);
      if (transcript) fireChip(transcript);
    } catch (e) {
      appendEntry('error', t('input.micError', { msg: e.message }));
    } finally {
      btn.classList.remove('recording');
    }
  });

  // Spacebar toggles recording — but only when the player is not interacting
  // with something else. It used to fire whenever focus was anywhere but the
  // input, which meant tabbing to any chip or button and pressing space (the
  // standard way to activate a control) started a recording instead, and
  // swallowed the activation. Anything focusable owns its own spacebar.
  const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el && el !== document.body) {
      if (TYPING.has(el.tagName)) return;
      if (el.isContentEditable) return;
      // A focused button, link, or anything with a tabindex is being operated
      // by the player; space belongs to it.
      if (el.closest('button, a, [role="button"], [tabindex]')) return;
    }
    if (!appState.ai?.key) return;
    e.preventDefault();
    btn.click();
  });
}
