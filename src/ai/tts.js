// src/ai/tts.js — Text-to-speech via OpenRouter.
//
// Fetches MP3 audio from /audio/speech and plays it through an HTMLAudioElement.
// Only one utterance plays at a time; a new speakText() call cancels the current one.

import { appState, addValue } from '../core/state.js';
import { modelFor, headers }  from './client.js';

// ─── Playback state ───────────────────────────────────────────────────────────

let _currentAudio = null;
let _currentUrl   = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function isSpeaking() {
  return !!(_currentAudio && !_currentAudio.ended && !_currentAudio.paused);
}

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

// Fetches TTS audio and plays it. Returns a Promise that resolves when
// playback ends (or rejects on network / API error).
export async function speakText(text) {
  if (!text?.trim()) return;

  const ai   = appState.ai || {};
  const base = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  cancelSpeech(); // stop any ongoing audio before fetching new

  const body = JSON.stringify({
    model:           modelFor('tts', ai),
    input:           text,
    voice:           'alloy',
    response_format: 'mp3',
  });

  // OpenRouter routes TTS to OpenAI which can 429 on capacity even for a first
  // request. One retry after a short backoff is enough to clear transient spikes.
  let res = await fetch(`${base}/audio/speech`, {
    method: 'POST', headers: headers(ai.key || '', location.origin), body,
  });
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 3000));
    res = await fetch(`${base}/audio/speech`, {
      method: 'POST', headers: headers(ai.key || '', location.origin), body,
    });
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${err.slice(0, 200)}`);
  }

  // Rough cost estimate: ~$0.015 per 1 000 characters (openai/gpt-4o-mini-tts pricing)
  const charCount = text.length;
  addValue('ai.totalCostUsd', parseFloat((charCount * 0.000015).toFixed(6)));

  const blob = await res.blob();
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
