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
    const el = appendEntry('thinking', '⏳');
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
  btn.textContent = '🔊';
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
