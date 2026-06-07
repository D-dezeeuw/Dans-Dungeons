// src/ai/stt.js — Speech-to-text capture.
//
// This module owns the browser capture (MediaRecorder → Blob). The HTTP call +
// base64 encode + model selection live in the client library (transcribeAudio);
// here we just hand it the recorded bytes and the locale.

import { transcribeAudio as libTranscribe } from 'bag-of-holding-client';
import { aiConfig } from './client.js';
import { locale } from '../i18n/i18n.js';

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

// Sends a recorded audio Blob to the library for transcription.
// Returns the transcript string or throws (ApiError) on failure.
export async function transcribeAudio(blob) {
  const format = blob.type.includes('ogg') ? 'ogg' : 'webm';
  const bytes  = await blob.arrayBuffer();
  return libTranscribe(aiConfig(), { bytes, format, language: locale() });
}
