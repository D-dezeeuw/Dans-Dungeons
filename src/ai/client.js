// src/ai/client.js — app adapter: binds Spektrum state to @zeeuw/bag-of-holding-client.
//
// The transport, retry, fallback, streaming, JSON-repair, and structured-output
// logic now live in the reusable client library. This thin shim builds an
// LlmConfig from appState.ai (plus the app's model defaults + token sink) and
// preserves the historical export surface so the rest of src/ai/* is unchanged.

import { appState, addValue } from '../core/state.js';
import { resolveModel, authHeaders, checkKey as libCheckKey,
         call as libCall, chatStream, repairJson as libRepair, chatCompletion as libChat } from 'bag-of-holding-client';
import { DEFAULT_MODELS, FREE_FALLBACKS } from './tiers.js';

const APP_TITLE = "Dan's Dungeons";

// Build the immutable transport config from current state. Re-derived per call
// so a mid-game tier/key change (Deluxe upgrade) propagates without rebuilds.
function cfg() {
  const ai = appState.ai || {};
  return {
    key:           ai.key,
    baseUrl:       ai.baseUrl,
    models:        ai.models,
    defaultModels: DEFAULT_MODELS,
    fallbacks:     FREE_FALLBACKS,
    appTitle:      APP_TITLE,
    referer:       location.origin,
    onTokens:      (n) => addValue('ai.totalTokens', n),
  };
}

// ─── Historical surface (kept stable for the other ai/* + game modules) ───────

export function modelFor(tier, ai = appState.ai || {}) {
  return resolveModel(tier, { models: ai.models }, DEFAULT_MODELS);
}

export function headers(key, origin) {
  return authHeaders({ key, referer: origin, appTitle: APP_TITLE });
}

export function checkKey()                  { return libCheckKey(cfg()); }
export function _call(opts)                 { return libCall(cfg(), opts); }
export function _callStream(opts, onChunk)  { return chatStream(cfg(), opts, onChunk, { field: 'narration' }); }
export function repairJson(raw, baseOpts, messages) { return libRepair(cfg(), raw, { ...baseOpts, messages }); }
export function chatCompletion(opts)        { return libChat(cfg(), opts); }
