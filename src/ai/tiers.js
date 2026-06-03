// src/ai/tiers.js
//
// Named model tiers and the embedded free-tier API key.
// Free tier uses zero-cost models on OpenRouter.
// Deluxe tier uses higher-quality paid models (player provides their own key).

// ─── Obfuscated free-tier key ────────────────────────────────────────────────
// XOR + base64 — not cryptographic, just prevents casual grep for sk-or-v1-*.
// The key is free-tier only (zero cost on OpenRouter).

const _K = 'NwpDHDZYGFZIXV0WBFNRVXRQWkUmEFlUVVpaFlcDAlB1VlkVIExeUwBZDEpTUwQOIVleR3xBDVADXw8QCwhRUycCDBdyRFlRUQ==';
const _M = 'DansDungeons2026';

export function getFreeKey() {
  const bytes = atob(_K);
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes.charCodeAt(i) ^ _M.charCodeAt(i % _M.length));
  }
  return result;
}

// ─── Model sets ──────────────────────────────────────────────────────────────

// All slots achievable at $0 on OpenRouter.
export const FREE_MODELS = {
  tiny:   'google/gemma-4-26b-a4b-it:free',
  medium: 'openai/gpt-oss-120b:free',
  large:  'nvidia/nemotron-3-super-120b-a12b:free',
  image:  null,   // no free image gen
  tts:    null,   // no free TTS
  stt:    null,   // no free STT
};

// Default models — same as free for initial state.
export const DEFAULT_MODELS = { ...FREE_MODELS };

// Paid tier — higher quality, costs money.
export const PAID_MODELS = {
  tiny:   'google/gemini-2.5-flash-lite',
  medium: 'deepseek/deepseek-v4-pro',
  large:  'deepseek/deepseek-v4-pro',
  image:  'google/gemini-2.5-flash-image',
  tts:    'openai/gpt-4o-mini-tts-2025-12-15',
  stt:    'openai/gpt-4o-mini-transcribe',
};

// Returns the model set for a given tier.
export function modelsForTier(tier) {
  return tier === 'deluxe' ? { ...PAID_MODELS } : { ...FREE_MODELS };
}
