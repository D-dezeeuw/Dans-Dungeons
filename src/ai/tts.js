// src/ai/tts.js — Text-to-speech playback.
//
// The fetch + model-fallback + PCM→WAV decode live in the client library
// (synthesizeSpeech); this module owns only the browser playback: it wraps the
// returned audio bytes in a Blob and plays them through an HTMLAudioElement.
// Only one utterance plays at a time; a new speakText() call cancels the current.

import { synthesizeSpeech } from 'bag-of-holding-client';
import { aiConfig } from './client.js';

// ─── Playback state ───────────────────────────────────────────────────────────

let _currentAudio = null;
let _currentUrl   = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function cancelSpeech() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio = null;
  }
  if (_currentUrl) {
    URL.revokeObjectURL(_currentUrl);
    _currentUrl = null;
  }
}

// Synthesizes TTS audio (via the library) and plays it. Returns a Promise that
// resolves when playback ends (or rejects on network / API error).
export async function speakText(text) {
  if (!text?.trim()) return;

  cancelSpeech(); // stop any ongoing audio before fetching new

  // Library does the fetch + model fallback + PCM→WAV; cost is metered via the
  // config's onCost sink. Returns null when no TTS model is configured.
  const result = await synthesizeSpeech(aiConfig(), text);
  if (!result) return;

  const blob = new Blob([result.audio], { type: result.mimeType });
  const url  = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    _currentAudio = audio;
    _currentUrl   = url;

    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url);
      if (_currentUrl === url) _currentUrl = null;
      if (_currentAudio === audio) _currentAudio = null;
      resolve();
    });

    audio.addEventListener('error', (e) => {
      URL.revokeObjectURL(url);
      if (_currentUrl === url) _currentUrl = null;
      if (_currentAudio === audio) _currentAudio = null;
      reject(new Error(`Audio playback error: ${e.message ?? 'unknown'}`));
    });

    audio.play().catch(reject);
  });
}
