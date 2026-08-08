// playwright.config.js — the browser layer.
//
// Deliberately separate from `npm test`: the unit suite is zero-dependency and
// has to stay runnable with an empty node_modules. This one needs a browser, so
// it is opt-in (`npm run test:e2e`) and its own CI job.

import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;

export default defineConfig({
  testDir: './tests/e2e',
  // A game turn goes through a mocked network round trip and a Spektrum commit;
  // generous enough not to be flaky, tight enough to catch a hang.
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,     // every test shares one origin's localStorage
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // The service worker caches aggressively and would serve a stale bundle
    // between tests; the game works without it and this is not what we're
    // testing here.
    serviceWorkers: 'block',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // Escape hatch for environments that ship a browser Playwright did not
      // download itself (sandboxes, air-gapped runners). CI leaves it unset and
      // uses `playwright install chromium` like everyone else.
      ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
    },
  }],
  webServer: {
    // Serves the repo root exactly as GitHub Pages does — the committed bundle,
    // not a dev-time rebuild, which is the thing players actually get.
    command: `python3 -m http.server ${PORT}`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
