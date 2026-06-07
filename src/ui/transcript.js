// src/ui/transcript.js — transcript DOM operations.
// Appends entries, manages streaming text, shows the thinking indicator,
// and hosts the floating speak-on-hover button for GM entries.

import { appState } from '../core/state.js';
import { t } from '../i18n/i18n.js';

const transcriptEl = () => document.getElementById('transcript');

export function clear() {
  transcriptEl().querySelectorAll('.entry').forEach(e => e.remove());
}

export function appendEntry(role, text) {
  const el  = document.createElement('div');
  el.className = `entry entry-${role}`;
  el.textContent = text;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

// Rebuild the transcript DOM from appState.transcript. The transcript is
// rendered imperatively, so a time-travel replay() (undo) reverts the
// underlying data but leaves the DOM stale — this re-syncs it. Mirrors the
// resume render in flow.js (player lines are prefixed with "> ").
export function rebuildTranscript() {
  clear();
  for (const e of (appState.transcript ?? [])) {
    if (e.role === 'player') appendEntry('player', `> ${e.text}`);
    else                     appendEntry(e.role, e.text);
  }
}

// beginStreamEntry + appendStreamChunk: progressive GM narration display.
// beginStreamEntry creates an empty entry; appendStreamChunk grows it as
// each token arrives so the player sees text appear in real time.

export function beginStreamEntry(role) {
  const el = document.createElement('div');
  el.className = `entry entry-${role}`;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

export function appendStreamChunk(el, chunk) {
  el.textContent += chunk;
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

export function setThinking(on) {
  const ID = 'thinking-indicator';
  if (on) {
    if (document.getElementById(ID)) return;
    const el = appendEntry('thinking', '…');
    el.id = ID;
  } else {
    document.getElementById(ID)?.remove();
  }
}

// ─── Floating hover-speak button ──────────────────────────────────────────────
// A single <button> appended to <body> (never clipped by overflow), shown when
// the mouse enters a .entry-gm element. Clicking it reads that entry aloud via TTS.
// Mirrors the tooltip pattern in actionbar.js.

export function showRoleplayOverlay(on) {
  document.getElementById('roleplay-overlay')?.classList.toggle('visible', on);
}

export function initSpeakHover() {
  const btn = document.createElement('button');
  btn.id = 'speak-hover-btn';
  btn.setAttribute('aria-label', t('transcript.readAloud'));
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>';
  document.body.appendChild(btn);

  let _hovered = null; // the .entry-gm currently under the pointer

  transcriptEl().addEventListener('mouseover', (e) => {
    const entry = e.target.closest('.entry-gm');
    if (!entry) return;
    _hovered = entry;
    const r = entry.getBoundingClientRect();
    btn.style.top   = `${r.top + window.scrollY}px`;
    btn.style.right = `${window.innerWidth - r.right + 8}px`;
    btn.classList.add('visible');
  });

  // Hide when leaving the transcript area — but not when moving onto the button itself.
  transcriptEl().addEventListener('mouseleave', (e) => {
    if (e.relatedTarget === btn) return;
    btn.classList.remove('visible');
    _hovered = null;
  });

  btn.addEventListener('mouseleave', () => {
    btn.classList.remove('visible');
    _hovered = null;
  });

  btn.addEventListener('click', async () => {
    if (!_hovered || !appState.ai?.key) return;
    const text = _hovered.textContent.trim();
    if (!text) return;

    // Dynamic import keeps TTS out of the initial module graph until first use.
    const { speakText } = await import('../ai/tts.js');
    btn.classList.add('speaking');
    try {
      await speakText(text);
    } finally {
      btn.classList.remove('speaking');
    }
  });
}
