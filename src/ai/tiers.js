// src/ai/tiers.js — named model tiers for the app.
//
// The model tables themselves live in bag-of-holding-client (one owner, one
// place to fix when a provider delists a model). This module only maps the
// app's PRICING tiers ('free' | 'deluxe') onto the library's QUALITY tiers
// (tiny/medium/large/image/tts/stt).
//
// No credentials live here. The optional demo key is build-injected — see
// ./demo-key.js — so nothing secret is ever committed or bundled by default.

import { FREE_MODELS, PAID_MODELS, FREE_FALLBACKS } from 'bag-of-holding-client';

export { FREE_FALLBACKS };

// Default models for a fresh state — the free set until the player picks a tier.
export const DEFAULT_MODELS = { ...FREE_MODELS };

// Returns the model set for a pricing tier.
export function modelsForTier(tier) {
  return tier === 'deluxe' ? { ...PAID_MODELS } : { ...FREE_MODELS };
}
