// src/ai/tts.js — Text-to-speech via OpenRouter.
//
// Fetches MP3 audio from /audio/speech and plays it through an HTMLAudioElement.
// Only one utterance plays at a time; a new speakText() call cancels the current one.

import { appState, addValue } from '../core/state.js';
import { modelFor, headers }  from './client.js';

// ─── Fallback model chain ─────────────────────────────────────────────────────
// Tried in order when the primary model returns 429 (capacity exceeded).
// All use the same /audio/speech endpoint; format differs per model.

const TTS_FALLBACKS = [
  'openai/gpt-4o-mini-tts-2025-12-15',
  'x-ai/grok-voice-tts-1.0',
  'mistralai/voxtral-mini-tts-2603',
];

// Models that require response_format "pcm" instead of "mp3".
// PCM responses are wrapped in a WAV header before playback.
const PCM_MODELS = new Set([
  'google/gemini-3.1-flash-tts-preview',
]);

// Wraps a raw PCM buffer in a RIFF/WAV header so HTMLAudioElement can play it.
// Gemini TTS outputs 16-bit linear PCM at 24 000 Hz, mono.
function _pcmToWav(pcmBuffer, sampleRate = 24000, bits = 16, channels = 1) {
  const byteRate   = sampleRate * channels * bits / 8;
  const blockAlign = channels * bits / 8;
  const dataLen    = pcmBuffer.byteLength;
  const out = new ArrayBuffer(44 + dataLen);
  const v   = new DataView(out);
  const str = (off, s) => [...s].forEach((c, i) => v.setUint8(off + i, c.charCodeAt(0)));
  str(0,  'RIFF'); v.setUint32(4,  36 + dataLen,  true);
  str(8,  'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1,           true); v.setUint16(22, channels,    true);
  v.setUint32(24, sampleRate,  true); v.setUint32(28, byteRate,    true);
  v.setUint16(32, blockAlign,  true); v.setUint16(34, bits,        true);
  str(36, 'data'); v.setUint32(40, dataLen, true);
  new Uint8Array(out).set(new Uint8Array(pcmBuffer), 44);
  return out;
}

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

// Fetches TTS audio and plays it. Returns a Promise that resolves when
// playback ends (or rejects on network / API error).
export async function speakText(text) {
  if (!text?.trim()) return;

  const ai   = appState.ai || {};
  const primary = modelFor('tts', ai);
  if (!primary) return; // no TTS model available (free tier)

  const base = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  cancelSpeech(); // stop any ongoing audio before fetching new

  const reqHeaders = headers(ai.key || '', location.origin);

  const models = [primary, ...TTS_FALLBACKS];
  let res;
  let usedModel;
  for (const model of models) {
    const fmt   = PCM_MODELS.has(model) ? 'pcm' : 'mp3';
    const voice = PCM_MODELS.has(model) ? 'Umbriel' : 'alloy';
    const body  = JSON.stringify({ model, input: text, voice, response_format: fmt });
    res = await fetch(`${base}/audio/speech`, {
      method:  'POST',
      headers: reqHeaders,
      body,
    });
    if (res.status !== 429) { usedModel = model; break; }
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${err.slice(0, 200)}`);
  }

  // Rough cost estimate: ~$0.015 per 1 000 characters (openai/gpt-4o-mini-tts pricing)
  const charCount = text.length;
  addValue('ai.totalCostUsd', parseFloat((charCount * 0.000015).toFixed(6)));

  // PCM models (e.g. Gemini) return raw samples — wrap in WAV before playback.
  let blob;
  if (PCM_MODELS.has(usedModel)) {
    const pcmBuf = await res.arrayBuffer();
    blob = new Blob([_pcmToWav(pcmBuf)], { type: 'audio/wav' });
  } else {
    blob = await res.blob();
  }
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
