// src/ai/stt.js — Speech-to-text via OpenRouter.
//
// Records audio with MediaRecorder (outputs webm/ogg depending on browser),
// then POSTs the blob to /audio/transcriptions and returns the transcript string.

import { appState } from '../core/state.js';
import { modelFor } from './client.js';

// ─── Recording state ──────────────────────────────────────────────────────────

let _recorder = null;
let _chunks   = [];
let _stream   = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export function isRecording() {
  return _recorder?.state === 'recording';
}

// Starts microphone recording. Returns a Promise<Blob> that resolves
// when stopRecording() is called.
export async function startRecording() {
  if (isRecording()) return;

  _stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Pick a supported MIME type; prefer webm/opus, fall back to whatever is available.
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']
    .find(t => MediaRecorder.isTypeSupported(t)) || '';

  _recorder = new MediaRecorder(_stream, mimeType ? { mimeType } : {});
  _chunks   = [];

  _recorder.addEventListener('dataavailable', e => {
    if (e.data.size > 0) _chunks.push(e.data);
  });

  return new Promise((resolve) => {
    _recorder.addEventListener('stop', () => {
      const blob = new Blob(_chunks, { type: _recorder.mimeType || 'audio/webm' });
      _stream.getTracks().forEach(t => t.stop());
      _stream    = null;
      _recorder  = null;
      _chunks    = [];
      resolve(blob);
    });

    _recorder.start();
  });
}

// Stops an active recording. The Promise from startRecording() resolves with the Blob.
export function stopRecording() {
  if (_recorder?.state === 'recording') {
    _recorder.stop();
  }
}

// Sends an audio Blob to OpenRouter for transcription.
// Returns the transcript string or throws on API error.
export async function transcribeAudio(blob) {
  const ai   = appState.ai || {};
  const base = (ai.baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

  // Derive a filename extension from the blob's MIME type.
  const ext  = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const file = new File([blob], `clip.${ext}`, { type: blob.type });

  const form = new FormData();
  form.append('model', modelFor('stt', ai));
  form.append('file', file);

  const res = await fetch(`${base}/audio/transcriptions`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${ai.key || ''}`,
      'HTTP-Referer':  location.origin,
      'X-Title':       "Dan's Dungeons",
    },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.text ?? '').trim();
}
