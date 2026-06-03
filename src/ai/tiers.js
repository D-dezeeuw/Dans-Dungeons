// src/ai/tiers.js
//
// Named model tiers. The player maps each tier to a real model id in settings.
// Defaults are sensible OpenRouter models; the player can override in the UI.

// It was only DEFAULT_MODELS before, but I want to be able to have different defaults for free vs. paid users, so I'm splitting it out.

// All slots achievable at $0 on OpenRouter.
// Audio slots fall through to PAID_MODELS — no free TTS/STT exists.
export const FREE_MODELS = {
  tiny:   'google/gemma-4-26b-a4b-it:free',          // classifier — 26B/3.8B-active, light & fast
  medium: 'openai/gpt-oss-120b:free',                // narrator — best free reasoning, 131K ctx
  large:  'nvidia/nemotron-3-super-120b-a12b:free',  // world gen — 120B/12B-active, 1M ctx
  image:  'bytedance-seed/seedream-4.5',             // image gen — listed $0 in free collection (verify on model page)
  tts:    null,                                      // no free TTS on OpenRouter
  stt:    null,                                      // no free STT on OpenRouter
};

// Default models — used by state.js and client.js.
// Falls back to free for text, paid for audio.
export const DEFAULT_MODELS = {
  tiny:   'google/gemma-4-26b-a4b-it:free',
  medium: 'openai/gpt-oss-120b:free',
  large:  'nvidia/nemotron-3-super-120b-a12b:free',
  image:  'bytedance-seed/seedream-4.5',
  tts:    'openai/gpt-4o-mini-tts-2025-12-15',
  stt:    'openai/gpt-4o-mini-transcribe',
};

// Paid tier overrides when quality matters over cost.
export const PAID_MODELS = {
  tiny:   'google/gemini-2.5-flash-lite',            // your original — $0.10/$0.40 per M
  medium: 'deepseek/deepseek-v4-pro',                // your original — $0.44/$0.87 per M
  large:  'deepseek/deepseek-v4-pro',                // your original
  image:  'google/gemini-2.5-flash-image',           // your original — $0.30/M + image cost
  tts:    'openai/gpt-4o-mini-tts-2025-12-15',       // cheapest TTS — $0.60/M in, $0 out
  stt:    'openai/gpt-4o-mini-transcribe',           // cheapest token-priced STT — $1.25/$5 per M
};