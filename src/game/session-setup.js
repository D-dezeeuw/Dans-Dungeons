// src/game/session-setup.js — getting the player a working key, and keeping it working.
//
// Extracted from flow.js, which had grown to 1,817 lines and 39% of src/game.
// This is the most self-contained seam in it: everything here runs before the
// first turn or between campaigns, touches only appState.ai / settings, and has
// no relationship at all with the play loop it used to sit above.
//
// Three jobs: get a key (OAuth, paste, or a build-injected demo credential),
// apply the tier that key can afford, and heal model ids that the provider has
// since delisted — because `ai.models` is persisted, so a stale map outlives
// any fix to the defaults and surfaces as a failed turn.

import { appState, setValue, tick, commit } from '../core/state.js';
import * as UI from '../ui/console.js';
import { t } from '../i18n/i18n.js';
import { checkApiKey } from './loop.js';
import { aiConfig } from '../ai/client.js';
import { modelsForTier } from '../ai/tiers.js';
import { demoKey, demoBaseUrl, hasDemoTier } from '../ai/demo-key.js';
import { redirectToOpenRouter } from '../ai/auth.js';
import { fetchModelIds, healModels } from 'bag-of-holding-client';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

// Adopt the shared demo credential, if this build has one. Returns false when
// the build is BYOK-only (the default) so callers can prompt instead of silently
// leaving the player with no working key.
export function useDemoKey() {
  const key = demoKey();
  if (!key) return false;
  setValue('ai.key', key);
  const base = demoBaseUrl();
  if (base) setValue('ai.baseUrl', base);
  return true;
}

export function applyTier(tier) {
  setValue('ai.tier', tier);
  setValue('ai.models', modelsForTier(tier));
  if (tier === 'free') {
    setValue('settings.sceneImage', false);
    setValue('settings.tts', false);
    setValue('settings.stt', false);
  } else if (tier === 'deluxe') {
    setValue('settings.sceneImage', true);
    setValue('settings.tts', true);
    setValue('settings.stt', true);
  }
  commit();
}

export async function setupKey() {
  UI.clear();
  UI.appendEntry('gm',     t('setup.gameName'));
  UI.appendEntry('system', '');

  // Connect flow. The no-key "try it" option only appears when this build was
  // given a demo credential (DD_DEMO_KEY at build time) — a stock build is
  // BYOK-only, so we never offer a path that cannot work.
  const options = hasDemoTier() ? ['oauth', 'paste', 'try'] : ['oauth', 'paste'];
  const choice = await UI.pickFrom(
    t('setup.connectQuestion'),
    options,
    x => x === 'oauth' ? t('setup.connectOAuth')
       : x === 'paste' ? t('setup.connectPaste')
       : t('setup.connectTry'),
    0,
  );

  if (choice === 'oauth') {
    // Redirect to OpenRouter — page navigates away, returns with ?code=.
    UI.appendEntry('system', t('setup.connectingOAuth'));
    // Awaited: the PKCE challenge is derived with SubtleCrypto, so the redirect
    // is now asynchronous. Firing and forgetting would navigate before the
    // verifier was stashed and every sign-in would fail its state check.
    await redirectToOpenRouter();
    // Flow resumes on reload (main.js handles ?code=).
    return;
  }

  if (choice === 'paste') {
    // Manual key paste (existing flow).
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.needKey'));
    UI.appendEntry('system', t('setup.signUp'));
    UI.appendEntry('system', '');
    const key = await UI.prompt(t('setup.pasteKey'));
    setValue('ai.key', key.trim());

    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.defaultUrl', { url: DEFAULT_BASE_URL }));
    const customUrl = await UI.prompt(t('setup.customUrl'));
    if (customUrl.trim()) setValue('ai.baseUrl', customUrl.trim());
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.keySaved'));
  }

  if (choice === 'try') {
    // Shared demo credential — heavily rate-limited (the provider's free-model
    // caps are per ACCOUNT, so every demo player shares one budget).
    useDemoKey();
    UI.appendEntry('system', t('setup.demoNotice'));
    UI.appendEntry('system', '');
  }

  // Tier choice (for paste + try paths; OAuth returns later).
  if (choice !== 'oauth') {
    const tierChoice = await UI.pickFrom(
      t('tier.upgradeQuestion'),
      ['free', 'deluxe'],
      x => x === 'deluxe' ? t('tier.upgradeYes') : t('tier.upgradeNo'),
      0,
    );
    applyTier(tierChoice);
    if (tierChoice === 'deluxe') UI.appendEntry('system', t('tier.upgraded'));
  }
}

// Upgrade to deluxe from settings — prompts for key.
export async function upgradeToDeluxe() {
  const key = await UI.prompt(t('setup.pasteKey'));
  if (!key.trim()) return;

  // Validate against the candidate key, but keep the working one until it
  // proves out — a rejected paste must never leave the player keyless.
  const previous = appState.ai?.key ?? '';
  setValue('ai.key', key.trim());
  tick();
  if (await checkApiKey()) {
    applyTier('deluxe');
    UI.appendEntry('system', t('tier.upgraded'));
    return;
  }
  UI.appendEntry('error', t('tier.downgraded'));
  setValue('ai.key', previous);
  if (!previous) useDemoKey();
  applyTier('free');
}

async function reAuthKey() {
  // Try to re-auth; on failure fall back to free key.
  setValue('ai.key', '');
  tick();
  UI.appendEntry('system', '');
  UI.appendEntry('error', t('setup.keyRejected'));
  const key = await UI.prompt(t('setup.pasteValid'));
  if (key.trim()) {
    setValue('ai.key', key.trim());
    commit();
    UI.appendEntry('system', t('setup.keyUpdated'));
  } else if (useDemoKey()) {
    applyTier('free');
  } else {
    // BYOK-only build and no key given: run setup rather than leaving the
    // player in a state where every turn fails with an auth error.
    await setupKey();
    tick();
  }
}

export async function ensureKey() {
  // No key at all — first visit. Run setup.
  if (!appState.ai?.key) { await setupKey(); tick(); return; }

  // Returning player with deluxe key — validate it.
  if ((appState.ai?.tier ?? 'free') === 'deluxe') {
    const valid = await checkApiKey();
    if (!valid) {
      UI.appendEntry('error', t('tier.downgraded'));
      if (useDemoKey()) applyTier('free');
      else { setValue('ai.key', ''); await setupKey(); tick(); return; }
    }
  }

  // Model ids rot: a provider can delist the model a save was written with, and
  // ai.models is persisted, so a stale map outlives any fix to the defaults.
  // Heal it against the live catalog before the first turn (never destructive —
  // an unreachable catalog heals nothing).
  await healStaleModels();
}

// Swap any delisted model id back to this tier's default, and tell the player
// it happened rather than letting them discover it as a failed turn.
async function healStaleModels() {
  try {
    const live = await fetchModelIds(aiConfig());
    if (!live) return;
    const { models, healed } = healModels(
      appState.ai?.models ?? {}, live, modelsForTier(appState.ai?.tier ?? 'free'));
    if (!healed.length) return;
    setValue('ai.models', models);
    commit();
    for (const h of healed) {
      UI.appendEntry('system', t('setup.modelHealed', { tier: h.tier, from: h.from, to: h.to ?? '—' }));
    }
  } catch { /* healing is best-effort — never block boot on it */ }
}

// Helper: check if current tier allows a feature, show gate message if not.
export function requireDeluxe(featureKey) {
  if ((appState.ai?.tier ?? 'free') === 'deluxe') return true;
  UI.appendEntry('system', t('tier.featureGated', { feature: t(`tier.${featureKey}`) }));
  return false;
}
