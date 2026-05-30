// src/ai/tiers.js
//
// Named model tiers. The player maps each tier to a real model id in settings.
// Defaults are sensible OpenRouter models; the player can override in the UI.

export const DEFAULT_MODELS = {
  tiny:   'openai/gpt-4o-mini',    // classifier — runs every turn (cheap, fast)
  medium: 'anthropic/claude-sonnet-4-5', // narrator — quality matters
  large:  'anthropic/claude-opus-4',     // world gen — not used in Phase 3
};
