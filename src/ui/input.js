// src/ui/input.js — player input: keyboard history, prompt/pickFrom,
// prefillChip/fireChip for chip-to-input wiring, and mic-button STT wiring.

import { appendEntry } from './transcript.js';
import { appState, setValue } from '../core/state.js';

// ─── Input history ────────────────────────────────────────────────────────────
// Stores submitted strings for UP/DOWN recall. Newest at the end.
// _historyCursor = -1 means "not browsing".

const _history = [];
let   _historyCursor = -1;
let   _historyDraft  = '';  // preserves in-progress text when UP is first pressed

export const cmdEl      = () => document.getElementById('cmd');
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

export function setInputEnabled(on, placeholder = 'What do you do?') {
  const el = cmdEl();
  el.disabled = !on;
  if (on) {
    el.placeholder = placeholder;
    el.focus();
  } else {
    el.placeholder = '…';
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
  setInputEnabled(true, message || 'What do you do?');
  return new Promise((resolve) => { _resolveInput = resolve; });
}

export async function pickFrom(message, options, labelFn = (x) => x, defaultIdx = -1) {
  appendEntry('system', message);
  options.forEach((opt, i) => {
    const isDefault = i === defaultIdx;
    appendEntry(
      isDefault ? 'option-default' : 'option',
      `  ${i + 1}. ${labelFn(opt)}${isDefault ? '  ← default' : ''}`
    );
  });
  appendEntry('system', '');

  while (true) {
    const input = await prompt(defaultIdx >= 0 ? 'Enter a number, name, or press Enter for default:' : 'Enter a number or name:');
    if (input.trim() === '' && defaultIdx >= 0) return options[defaultIdx];
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) return options[num - 1];
    const match = options.find(
      (o) => o.toLowerCase() === input.toLowerCase() ||
             labelFn(o).toLowerCase() === input.toLowerCase()
    );
    if (match) return match;
    appendEntry('error', `Please enter 1–${options.length} or the option name.`);
  }
}

// ─── Mic button (STT) ─────────────────────────────────────────────────────────
// initMicButton() is called once in boot(). The button toggles recording state:
// first click → start recording; second click → stop, transcribe, submit.

export function initMicButton() {
  const btn = document.getElementById('mic-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const { isRecording, startRecording, stopRecording, transcribeAudio } =
      await import('../ai/stt.js');

    if (isRecording()) {
      stopRecording();
      return;
    }

    setValue('ui.recording', true);

    try {
      const blob       = await startRecording();
      setValue('ui.recording', false);
      const transcript = await transcribeAudio(blob);
      if (transcript) fireChip(transcript);
    } catch (e) {
      appendEntry('error', `Microphone error: ${e.message}`);
    } finally {
      setValue('ui.recording', false);
    }
  });

  // Spacebar toggles recording when not typing in the input field.
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ') return;
    if (document.activeElement === cmdEl()) return;
    if (!appState.settings?.stt || !appState.ai?.key) return;
    e.preventDefault();
    btn.click();
  });
}
