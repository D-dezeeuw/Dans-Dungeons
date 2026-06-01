// src/ai/tiers.js
//
// Named model tiers. The player maps each tier to a real model id in settings.
// Defaults are sensible OpenRouter models; the player can override in the UI.

export const DEFAULT_MODELS = {
  tiny:   'google/gemini-2.5-flash-lite',          // classifier — runs every turn (cheap, fast)
  medium: 'deepseek/deepseek-v4-pro',              // narrator — quality matters
  large:  'deepseek/deepseek-v4-pro',              // world gen — not used in Phase 3
  image:  'google/gemini-2.5-flash-image',         // scene sketch — optional, fires after each turn
  tts:    'openai/gpt-4o-mini-tts-2025-12-15',     // text-to-speech narration
  stt:    'nvidia/parakeet-tdt-0.6b-v3',           // speech-to-text player input
};
