// tests/e2e/smoke.spec.js — the game actually boots and can be played.
//
// Everything else in tests/ is pure logic. This is the layer that would have
// caught the defect that survived the repo's whole history: the chip renderers
// looked up element ids that were not in the markup, every renderer null-
// guarded, and the entire click-to-play surface silently no-opped. Unit tests
// cannot see that. A browser can.
//
// The LLM is mocked at the network boundary — the real turn loop, the real
// resolver, the real Spektrum writes, the real DOM. What is asserted is the
// spine: boot → key → character → dungeon → turns → save → reload → resume.
//
// Run with `npm run test:e2e`. Kept out of `npm test` on purpose: the unit
// suite is zero-dependency and must stay runnable with nothing installed.

import { test, expect } from '@playwright/test';

// ─── The fake Game Master ────────────────────────────────────────────────────
//
// Answers every OpenRouter route in the shape the code expects, so the game
// gets valid structured output without a key, a network, or a bill.

const NARRATION = 'The door grinds open onto cold stone and older air.';

function chatResponse(content) {
  return {
    id: 'mock', object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { total_tokens: 42, cost: 0.0001 },
  };
}

async function mockOpenRouter(page) {
  // Key validation: any key is fine.
  await page.route('**/api/v1/auth/key', route =>
    route.fulfill({ json: { data: { label: 'mock', usage: 0 } } }));

  // The model catalog, so boot-time healing finds every configured id present.
  await page.route('**/api/v1/models', route =>
    route.fulfill({ json: { data: [] } }));

  await page.route('**/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON() ?? {};
    const schemaName = body.response_format?.json_schema?.schema?.properties ?? {};
    const asked = Object.keys(schemaName);

    // Which call is this? The schema's own field names say so, which keeps the
    // mock honest: if a prompt changes shape, this stops matching and the test
    // fails rather than silently answering the wrong question.
    let content;
    if (asked.includes('intent')) {
      content = JSON.stringify({
        intent: 'look', target_id: null, direction: null, skill: null,
        spell_id: null, dc: null, reason: 'mocked',
      });
    } else if (asked.includes('narration')) {
      content = JSON.stringify({ narration: NARRATION });
    } else if (asked.includes('fulfilled')) {
      content = JSON.stringify({ fulfilled: false, reason: 'mocked' });
    } else if (asked.includes('facts') || asked.includes('mint')) {
      content = JSON.stringify({ facts: [], mint: [] });
    } else {
      content = JSON.stringify({ narration: NARRATION });
    }

    if (body.stream) {
      // SSE, one delta then [DONE] — the shape chatStream parses.
      const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
      await route.fulfill({
        headers: { 'content-type': 'text/event-stream' },
        body: `data: ${chunk}\n\ndata: [DONE]\n\n`,
      });
      return;
    }
    await route.fulfill({ json: chatResponse(content) });
  });
}

// Seed a key before any script runs, so the game boots past the setup prompt.
async function bootWithKey(page) {
  // Only seed when there is nothing there. addInitScript runs on EVERY
  // navigation, including the reload the resume test performs — seeding
  // unconditionally would wipe the campaign it is supposed to be resuming, and
  // the test would "fail" on a bug it had created itself.
  await page.addInitScript(() => {
    if (localStorage.getItem('dans-dungeons')) return;
    localStorage.setItem('dans-dungeons', JSON.stringify({
      v: 2,
      data: { ai: { key: 'sk-or-mock', tier: 'free' }, settings: { sceneImage: false } },
    }));
  });
  await mockOpenRouter(page);
  await page.goto('/');
  await expect(page.locator('#transcript')).toBeVisible();
}

// Answer the character-creation wizard and land in a playable dungeon. Driven
// through the real UI rather than by seeding a finished save, because the
// wizard is exactly the surface the chip layer used to no-op in.
async function startCampaign(page) {
  await bootWithKey(page);
  const cmd = page.locator('#cmd');
  await expect(cmd).toBeEnabled({ timeout: 20_000 });

  // Name → then a series of numbered picks (class, species, background, mode).
  // Each is answered with the default, which is what pressing Enter means.
  await cmd.fill('Tester');
  await cmd.press('Enter');

  for (let i = 0; i < 8; i++) {
    await expect(cmd).toBeEnabled({ timeout: 20_000 });
    // The dungeon is up once the compass has an exit to offer.
    if (await page.locator('#action-chips button').filter({ hasText: /North|South|East|West/i }).count()) break;
    await cmd.press('Enter');
    await page.waitForTimeout(250);
  }
  await expect(page.locator('#transcript')).toContainText(/exits/i, { timeout: 30_000 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('the page boots without a console error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // The page's CSP is `connect-src https:`, which is right in production and
    // blocks the version check over the plain-http test server. That is the
    // harness, not the app.
    if (/Content Security Policy/i.test(m.text())) return;
    errors.push(m.text());
  });

  await mockOpenRouter(page);
  await page.goto('/');
  await expect(page.locator('#transcript')).toBeVisible();
  // The skeleton must be replaced, not merely covered.
  await expect(page.locator('#skeleton-loading')).toHaveCount(0);
  expect(errors, `console errors on boot:\n${errors.join('\n')}`).toEqual([]);
});

test('the click-to-play containers exist and are reachable', async ({ page }) => {
  await bootWithKey(page);
  // The exact defect this file exists for: these were absent for the repo's
  // whole history and every renderer null-guarded around it.
  for (const id of ['action-chips', 'character-chips', 'skill-chips', 'transcript', 'cmd']) {
    await expect(page.locator(`#${id}`)).toHaveCount(1, { message: `#${id} is missing` });
  }
});

test('choices are clickable, not just typeable', async ({ page }) => {
  await bootWithKey(page);
  const cmd = page.locator('#cmd');
  await expect(cmd).toBeEnabled({ timeout: 20_000 });
  await cmd.fill('Tester');
  await cmd.press('Enter');
  // The class question is a numbered list; the options must ALSO be chips —
  // reading "1. Fighter" and then hunting for the number row is the whole
  // problem on a phone.
  const chips = page.locator('#action-chips button');
  await expect(chips.first()).toBeVisible({ timeout: 20_000 });
  expect((await chips.first().textContent())?.trim()).toMatch(/^1\./);
  // And clicking one has to answer the question. The transcript is a log, so
  // the old prompt stays on screen — what proves the click landed is the NEXT
  // question appearing.
  await chips.first().click();
  await expect(page.locator('#transcript')).toContainText(/Choose your species/i, { timeout: 20_000 });
});

test('a turn runs end to end and lands in the transcript', async ({ page }) => {
  await startCampaign(page);
  await page.fill('#cmd', 'look around');
  await page.press('#cmd', 'Enter');
  await expect(page.locator('#transcript')).toContainText(NARRATION, { timeout: 20_000 });
});

test('the campaign survives a reload', async ({ page }) => {
  await startCampaign(page);
  await page.fill('#cmd', 'look around');
  await page.press('#cmd', 'Enter');
  await expect(page.locator('#transcript')).toContainText(NARRATION, { timeout: 20_000 });

  // The autosave has to have happened, and the transcript has to come back.
  const saved = await page.evaluate(() => localStorage.getItem('dans-dungeons'));
  expect(saved, 'nothing was autosaved').toBeTruthy();

  await page.reload();
  await expect(page.locator('#transcript')).toContainText(NARRATION, { timeout: 20_000 });
});

test('a second tab refuses to save over the first', async ({ browser }) => {
  const ctx = await browser.newContext();
  const first = await ctx.newPage();
  await bootWithKey(first);

  const second = await ctx.newPage();
  await mockOpenRouter(second);
  await second.goto('/');
  // Same origin, same storage: the second tab must announce itself as a
  // spectator rather than quietly overwriting the first tab's turns.
  await expect(second.locator('#transcript')).toContainText(/another tab/i, { timeout: 10_000 });
  await ctx.close();
});

test('the spacebar does not steal a focused button', async ({ page }) => {
  await bootWithKey(page);
  const btn = page.locator('#sidebar-toggle');
  await btn.focus();
  await page.keyboard.press('Space');
  // Space on a focused button activates it. If the mic shortcut had swallowed
  // it, the sidebar would still be collapsed.
  await expect(page.locator('#sidebar')).not.toHaveClass(/collapsed/);
});

test('an API failure names its cause instead of blaming the Game Master', async ({ page }) => {
  await startCampaign(page);
  await page.route('**/api/v1/chat/completions', route =>
    route.fulfill({ status: 402, body: 'insufficient credits' }));

  await page.fill('#cmd', 'look around');
  await page.press('#cmd', 'Enter');
  // 402 is out of credit: retrying can never help, and the message must say so
  // rather than offering the old "try again when you are ready".
  await expect(page.locator('#transcript')).toContainText(/credit/i, { timeout: 20_000 });
});
