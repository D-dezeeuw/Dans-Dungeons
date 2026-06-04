// src/ai/tiers.js
//
// Named model tiers and the embedded free-tier API key.
// Free tier uses zero-cost models on OpenRouter.
// Deluxe tier uses higher-quality paid models (player provides their own key).

// ─── Runtime config bootstrap ────────────────────────────────────────────────
//
// SECURITY NOTE — this is NOT a secret. The free-tier OpenRouter key below ships
// in the client bundle, so it must be treated as fully public: anyone can extract
// it from app.bundle.js. The XOR encode is only obfuscation to deter casual
// scraping/key-logging crawlers — it provides zero real protection.
//
// To ship this safely the embedded key MUST be provisioned on OpenRouter with
// hard guards that assume it will be abused:
//   - a low credit limit / hard spend cap on the key,
//   - restricted to free (`:free`) models only, and
//   - rotated if abuse is observed.
// Players who want paid models use BYOK (Deluxe), which never touches this key.

const _a = [55,10,67,28,54,88,24,86,72,93,93,22,4,83,81,85,116,80,90,69,38,16,89,84,85,90,90,22,87,3,2,80,117,86,89,21,32,76,94,83,0,89,12,74,83,83,4,14,33,89,94,71,124,65,13,80,3,95,15,16,11,8,81,83,39,2,12,23,114,68,89,81,81];
const _b = 'DansDungeons2026';
export const _cfg = () => { let r = ''; for (let i = 0; i < _a.length; i++) r += String.fromCharCode(_a[i] ^ _b.charCodeAt(i % _b.length)); return r; };

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

// Fallback chains for 429 rate-limit retries.
// Each tier slot maps to an ordered list of alternative models.
// On 429, the client tries the next model in the chain.
export const FREE_FALLBACKS = {
  tiny:   ['qwen/qwen3-72b:free', 'meta-llama/llama-4-scout:free'],
  medium: ['deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-4-maverick:free'],
  large:  ['deepseek/deepseek-chat-v3-0324:free', 'meta-llama/llama-4-maverick:free'],
};
