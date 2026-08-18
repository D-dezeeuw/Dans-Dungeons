// tests/e2e/tenant.spec.js — pasting a tenant key into the setup wizard.
//
// The complaint this exists for: a player whose table is hosted was asked for
// an openrouter.ai key they had no reason to own, and the tenant key they DID
// own was rejected, because it authenticates to a deployment rather than to a
// provider. The fix lives across three modules and two repos, and the only
// place its seams meet is here — a real browser, the real wizard, the real
// prompts — with the deployment mocked at the network boundary.

import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page }, use) => {
    const fatals = [];
    page.on('pageerror', e => fatals.push(e.message));
    await use(page);
    expect(fatals, `uncaught page errors:\n${fatals.join('\n')}`).toEqual([]);
  },
});

const TOKEN = 'a3f2'.repeat(16);            // 64 hex, the shape the panel mints
const SERVER = 'https://boh.example.test';

/**
 * A deployment that answers `/v1/status`. `relayEnabled: false` is the other
 * legitimate deployment: a valid token on a server that sells no inference.
 */
async function mockDeployment(page, { enabled = true, tier = 'patron', status = 200 } = {}) {
  await page.route(`${SERVER}/mcp/*/v1/status`, route => route.fulfill({
    status,
    json: status === 200
      ? {
        relay: 'bag-of-holding-mcp',
        version: '0.17.0',
        relayEnabled: enabled,
        tier,
        models: enabled ? { tiny: 'x/tiny', medium: 'x/medium', large: 'x/large', image: 'x/image', tts: null, stt: null } : null,
        budget: enabled ? { v: 1, tier, budget: 2_000_000, windowMs: 86_400_000, spent: 1_000, windowStart: 1, calls: 1, tokens: 1_000 } : null,
      }
      : { error: 'Not found' },
  }));
}

/** OpenRouter says no to everything — which is what it does with a tenant key. */
async function mockProviderRejects(page) {
  await page.route('**/openrouter.ai/api/v1/auth/key', route =>
    route.fulfill({ status: 401, json: { error: { message: 'No auth credentials found' } } }));
  await page.route('**/openrouter.ai/api/v1/**', route =>
    route.fulfill({ status: 401, json: { error: { message: 'No auth credentials found' } } }));
}

/** Boot with no credential at all, so the wizard runs for real. */
async function bootFresh(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.locator('#transcript')).toBeVisible();
}

/** Answer the "how would you like to connect?" pick with the paste option. */
async function choosePaste(page) {
  const cmd = page.locator('#cmd');
  await expect(cmd).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator('#transcript')).toContainText(/connect/i, { timeout: 20_000 });
  await cmd.fill('2');                       // 1 = OAuth, 2 = paste a credential
  await cmd.press('Enter');
}

async function answer(page, text) {
  const cmd = page.locator('#cmd');
  await expect(cmd).toBeEnabled({ timeout: 20_000 });
  await cmd.fill(text);
  await cmd.press('Enter');
}

test('a tenant key is accepted where only a provider key used to be', async ({ page }) => {
  await mockProviderRejects(page);
  await mockDeployment(page, { enabled: true, tier: 'patron' });
  await bootFresh(page);

  await choosePaste(page);
  await answer(page, TOKEN);                 // the credential the player owns
  await answer(page, SERVER);                // which table it belongs to

  await expect(page.locator('#transcript')).toContainText(/Connected to your table/i, { timeout: 20_000 });
  await expect(page.locator('#transcript')).toContainText(/patron/i);

  // The session now points at the relay, with the tier's models adopted and no
  // provider key anywhere.
  const ai = await page.evaluate(() => JSON.parse(localStorage.getItem('dans-dungeons')).data.ai);
  expect(ai.credential).toBe('tenant');
  expect(ai.baseUrl).toBe(`${SERVER}/mcp/${TOKEN}/v1`);
  expect(ai.key).toBe(TOKEN);
  expect(ai.relayTier).toBe('patron');
  expect(ai.tier).toBe('deluxe');            // patron unlocks the gated features…
  expect(ai.models.medium).toBe('x/medium'); // …on the models the relay named
});

test('a hosted table never offers speech, whatever the tier', async ({ page }) => {
  // Both model tables leave tts/stt null — the provider hosts no speech models —
  // so a switch the relay could never serve must not be turned on by a tier.
  await mockProviderRejects(page);
  await mockDeployment(page, { enabled: true, tier: 'studio' });
  await bootFresh(page);

  await choosePaste(page);
  await answer(page, TOKEN);
  await answer(page, SERVER);
  await expect(page.locator('#transcript')).toContainText(/Connected to your table/i, { timeout: 20_000 });

  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('dans-dungeons')).data.settings);
  expect(settings.tts).toBe(false);
  expect(settings.stt).toBe(false);
  expect(settings.sceneImage).toBe(true);    // images the relay CAN serve
});

test('a token the deployment does not know says so, and asks again', async ({ page }) => {
  await mockProviderRejects(page);
  await mockDeployment(page, { status: 404 });
  await bootFresh(page);

  await choosePaste(page);
  await answer(page, TOKEN);
  await answer(page, SERVER);

  await expect(page.locator('#transcript')).toContainText(/does not recognise that tenant key/i, { timeout: 20_000 });
  // …and the wizard restarts rather than leaving the player at a dead prompt.
  await expect(page.locator('#transcript')).toContainText(/connect/i);
});

test('a valid token on a table with no AI points at the other credential', async ({ page }) => {
  // The distinction a player cannot draw for themselves: the token is FINE, the
  // deployment simply sells no inference, and a provider key is the way in.
  await mockProviderRejects(page);
  await mockDeployment(page, { enabled: false, tier: 'free' });
  await bootFresh(page);

  await choosePaste(page);
  await answer(page, TOKEN);
  await answer(page, SERVER);

  await expect(page.locator('#transcript')).toContainText(/does not provide the AI/i, { timeout: 20_000 });
  await expect(page.locator('#transcript')).toContainText(/OpenRouter key/i);
});

test('a provider key still takes the short path, with no questions about tables', async ({ page }) => {
  // The regression that would matter most: the common case must not have grown
  // a "which server hosts your table?" prompt.
  await page.route('**/api/v1/auth/key', route => route.fulfill({ json: { data: { label: 'mock' } } }));
  await page.route('**/api/v1/models', route => route.fulfill({ json: { data: [] } }));
  await bootFresh(page);

  await choosePaste(page);
  await answer(page, 'sk-or-v1-realkey');

  await expect(page.locator('#transcript')).toContainText(/Key saved/i, { timeout: 20_000 });
  // The paste prompt now mentions both credentials, which is the point — what
  // must NOT appear is any of the tenant flow's own questions.
  await expect(page.locator('#transcript')).not.toContainText(/Address of your table/i);
  await expect(page.locator('#transcript')).not.toContainText(/Connecting to your table/i);

  const ai = await page.evaluate(() => JSON.parse(localStorage.getItem('dans-dungeons')).data.ai);
  expect(ai.credential).toBe('openrouter');
  expect(ai.baseUrl).toBe('https://openrouter.ai/api/v1');
});
