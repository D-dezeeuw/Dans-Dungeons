// src/ui/input.js — player input: keyboard history, prompt/pickFrom,
// prefillChip/fireChip for chip-to-input wiring.

import { appendEntry } from './transcript.js';

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
  const val = cmdEl().value.trim();
  cmdEl().value = '';
  _historyCursor = -1;
  _historyDraft  = '';
  if (val) _history.push(val);
  if (_resolveInput) {
    const fn  = _resolveInput;
    _resolveInput = null;
    setInputEnabled(false);
    fn(val);
  }
});

cmdEl().addEventListener('focus', () => inputRowEl()?.classList.add('active'));
cmdEl().addEventListener('blur',  () => inputRowEl()?.classList.remove('active'));

transcriptEl().addEventListener('click', () => {
  if (!cmdEl().disabled) cmdEl().focus();
});

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
