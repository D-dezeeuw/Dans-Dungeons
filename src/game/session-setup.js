// src/game/session-setup.js — getting the player a working key, and keeping it working.
//
// Extracted from flow.js, which had grown to 1,817 lines and 39% of src/game.
// This is the most self-contained seam in it: everything here runs before the
// first turn or between campaigns, touches only appState.ai / settings, and has
// no relationship at all with the play loop it used to sit above.
//
// Three jobs: get a credential (OAuth, paste, or a build-injected demo key),
// apply the tier that credential can afford, and heal model ids that the
// provider has since delisted — because `ai.models` is persisted, so a stale
// map outlives any fix to the defaults and surfaces as a failed turn.
//
// "A credential" is doing more work than it used to. There are two kinds now,
// and the wizard used to only know one:
//
//   • a provider key — the player's own OpenRouter key. Their account pays.
//   • a tenant token — issued by a hosted bag-of-holding-mcp deployment. The
//     operator's account pays, inside the token's tier budget.
//
// A player handed a tenant token by whoever runs their table was previously
// asked for an openrouter.ai key they had no reason to own, and pasting the
// token they DID own failed with an auth error, because it authenticates to the
// deployment rather than to a provider. So the paste step now takes either: it
// checks the string as a provider key first and, failing that, tries it as a
// tenant token against the deployment. See ../ai/relay.js for the two shapes.

import { appState, setValue, tick, commit } from '../core/state.js';
import * as UI from '../ui/console.js';
import { t } from '../i18n/i18n.js';
import { checkApiKey } from './loop.js';
import { aiConfig, connectTenant } from '../ai/client.js';
import { modelsForTier } from '../ai/tiers.js';
import { demoKey, demoBaseUrl, hasDemoTier } from '../ai/demo-key.js';
import { redirectToOpenRouter } from '../ai/auth.js';
import {
  defaultTenantUrl, looksLikeTenantToken, looksLikeProviderKey,
  pricingTierFor, relayServesImages,
} from '../ai/relay.js';
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

/** Is this session playing on a hosted table rather than the player's own key? */
export function isTenantSession() {
  return appState.ai?.credential === 'tenant';
}

/**
 * Adopt a live tenant connection: where to call, what to call it with, which
 * models that tier may use, and which features it can actually serve.
 *
 * The model map comes from the relay rather than from our own tier table. The
 * deployment decides which ids a tier may reach, and spending a turn to
 * discover that our default was refused is a turn the player waited for.
 *
 * Speech stays off whatever the tier: the relay carries completions, not
 * `audio/*`. A Text-to-Speech switch that 404s on every press is worse than one
 * that was never offered.
 */
function applyTenantConnection({ serverUrl, token, baseUrl, tier, models }) {
  setValue('ai.credential', 'tenant');
  setValue('ai.tenantUrl', serverUrl);
  setValue('ai.relayTier', tier);
  setValue('ai.baseUrl', baseUrl);
  setValue('ai.key', token);
  setValue('ai.tier', pricingTierFor(tier));
  setValue('ai.models', { ...models });
  setValue('settings.sceneImage', relayServesImages(tier));
  setValue('settings.tts', false);
  setValue('settings.stt', false);
  commit();
}

/** Back to BYOK: a provider key, the provider's URL, and no tenant left over. */
function applyProviderKey(key) {
  setValue('ai.credential', 'openrouter');
  setValue('ai.tenantUrl', null);
  setValue('ai.relayTier', null);
  setValue('ai.key', key);
  if (appState.ai?.baseUrl?.includes('/mcp/')) setValue('ai.baseUrl', DEFAULT_BASE_URL);
  commit();
}

/**
 * Where a tenant token is a tenant OF. A build can name a deployment
 * (DD_TENANT_URL); otherwise the player is asked, because the token alone says
 * nothing about which host issued it.
 */
async function askTenantUrl() {
  const built = defaultTenantUrl();
  if (built) return built;
  UI.appendEntry('system', t('setup.tenantUrlWhy'));
  const typed = await UI.prompt(t('setup.tenantUrlAsk'));
  return typed.trim();
}

/**
 * Take one pasted string and work out what it is.
 *
 * Order matters and follows the two failure costs. A provider key is checked
 * first because it is the common case and the check is one request that cannot
 * spend anything. A tenant token needs a deployment URL, so asking for one
 * before we know the string even IS a token would be a question most players
 * should never see.
 *
 * The shape test only reorders those two checks — a 64-hex string is a minted
 * tenant token and is never a provider key, so trying OpenRouter first would
 * mean a guaranteed-useless round trip and, offline, a false positive:
 * `checkApiKey` answers "not obviously rejected" when it cannot reach anyone.
 *
 * Returns true when the session is now playable.
 */
async function adoptCredential(pasted) {
  const value = pasted.trim();
  if (value === '') return false;

  const tenantFirst = looksLikeTenantToken(value) && !looksLikeProviderKey(value);

  if (!tenantFirst) {
    // Try it as a provider key: point at the provider and ask.
    setValue('ai.baseUrl', DEFAULT_BASE_URL);
    setValue('ai.key', value);
    tick();
    if (await checkApiKey()) {
      applyProviderKey(value);
      UI.appendEntry('system', t('setup.keySaved'));
      return true;
    }
    UI.appendEntry('system', t('setup.notAProviderKey'));
  }

  const serverUrl = await askTenantUrl();
  if (serverUrl === '') {
    UI.appendEntry('error', t('setup.tenantNoUrl'));
    return false;
  }

  UI.appendEntry('system', t('setup.tenantConnecting'));
  const live = await connectTenant(serverUrl, value);
  if (live.ok) {
    applyTenantConnection({ serverUrl, token: value, baseUrl: live.baseUrl, tier: live.tier, models: live.models });
    UI.appendEntry('system', t('setup.tenantConnected', { tier: live.tier }));
    if (!relayServesImages(live.tier)) UI.appendEntry('system', t('setup.tenantFreeTier'));
    return true;
  }

  // Every refusal names what to do next, because "that did not work" on a setup
  // screen with one input is a dead end.
  UI.appendEntry('error', t(`setup.tenant.${live.reason === 'not-a-relay' ? 'notARelay'
    : live.reason === 'unreachable' ? 'unreachable'
    : live.reason === 'relay-off' ? 'relayOff'
    : live.reason === 'bad-url' ? 'badUrl'
    : 'rejected'}`));
  if (tenantFirst) {
    // A 64-hex string that no deployment claims is not a provider key either,
    // so there is nothing left to try and saying so beats a silent retry.
    setValue('ai.key', '');
    commit();
  }
  return false;
}

/**
 * `clear: false` keeps the transcript when the wizard runs itself again after a
 * refusal. Clearing there wiped the one line that said what was wrong — the
 * player saw their credential vanish and the opening question return, which
 * reads as the wizard breaking rather than as an answer.
 */
export async function setupKey({ clear = true } = {}) {
  if (clear) UI.clear();
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
    // One field, either credential. The wizard works out which — see
    // `adoptCredential`: provider key first, tenant token second.
    UI.appendEntry('system', '');
    UI.appendEntry('system', t('setup.needKey'));
    UI.appendEntry('system', t('setup.signUp'));
    UI.appendEntry('system', '');
    const pasted = await UI.prompt(t('setup.pasteCredential'));
    const adopted = await adoptCredential(pasted);
    tick();

    // A tenant connection brought its own base URL, its own tier and its own
    // model list — asking about any of those would be asking the player to
    // second-guess their operator.
    if (adopted && isTenantSession()) return;

    if (adopted) {
      UI.appendEntry('system', '');
      UI.appendEntry('system', t('setup.defaultUrl', { url: DEFAULT_BASE_URL }));
      const customUrl = await UI.prompt(t('setup.customUrl'));
      if (customUrl.trim()) setValue('ai.baseUrl', customUrl.trim());
    } else {
      // Nothing usable was pasted. Leaving the player at a "now what" prompt is
      // the one outcome this screen must not produce, so ask again — below the
      // refusal, not on a screen wiped clean of it.
      UI.appendEntry('system', '');
      UI.appendEntry('system', t('setup.reRunSetup'));
      await setupKey({ clear: false });
      return;
    }
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

/**
 * Re-check a tenant connection against its deployment.
 *
 * Worth doing on every boot, not just when something looks wrong: this is the
 * only way the app learns that the operator suspended the table, revoked the
 * token, or moved it to a tier that now includes pictures. Returns the verdict
 * so a caller can decide whether to keep playing.
 */
async function refreshTenantConnection() {
  const serverUrl = appState.ai?.tenantUrl;
  const token = appState.ai?.key;
  if (!serverUrl || !token) return { ok: false, reason: 'rejected' };

  const live = await connectTenant(serverUrl, token);
  if (!live.ok) return live;

  const previous = appState.ai?.relayTier ?? null;
  applyTenantConnection({ serverUrl, token, baseUrl: live.baseUrl, tier: live.tier, models: live.models });
  if (previous && previous !== live.tier) {
    UI.appendEntry('system', t('setup.tenantTierChanged', { from: previous, to: live.tier }));
  }
  return live;
}

// Upgrade to deluxe from settings — prompts for key.
export async function upgradeToDeluxe() {
  // On a hosted table the tier is not the player's to buy: it is whatever the
  // operator's registry says, and pasting a provider key here would silently
  // swap the whole campaign onto a different account. Re-check instead — an
  // upgrade the operator has already made lands right here.
  if (isTenantSession()) {
    const live = await refreshTenantConnection();
    if (!live.ok) { UI.appendEntry('error', t('setup.tenant.rejected')); return; }
    UI.appendEntry('system', pricingTierFor(live.tier) === 'deluxe'
      ? t('tier.upgraded')
      : t('setup.tenantUpgradeAsk', { tier: live.tier }));
    return;
  }

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

  // Returning player on a hosted table: ask the deployment, because the answer
  // can have changed without them touching anything. A suspended or revoked
  // token is the case that matters — every turn would otherwise fail with a
  // 404 the player cannot interpret.
  if (isTenantSession()) {
    const live = await refreshTenantConnection();
    tick();
    if (!live.ok) {
      UI.appendEntry('error', t(live.reason === 'unreachable'
        ? 'setup.tenant.unreachable'
        : 'setup.tenant.rejected'));
      // Unreachable is probably the player's own connection, and dropping a
      // working token over one failed probe would be its own outage. Only a
      // refusal sends them back to setup.
      if (live.reason !== 'unreachable') { setValue('ai.key', ''); await setupKey(); tick(); }
      return;
    }
    await healStaleModels();
    return;
  }

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
