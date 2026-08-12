// tests/e2e/campaign.spec.js — the campaign plays: world → city → sea → dungeon.
//
// The quick-dungeon smoke proves the spine; this scenario proves the CAMPAIGN
// — the mode every layered-world feature lives in. The LLM is mocked at the
// network boundary with schema-shaped answers (the same dispatch-on-schema
// honesty rule as smoke.spec.js: if a prompt changes shape, the mock stops
// matching and the test fails loudly). Math.random is seeded so worldgen,
// dungeon layout, and travel are reproducible run to run.
//
// The journey: character wizard → campaign worldgen (with the continent
// outline call) → city (talk to an NPC) → /story → set sail across the sea
// lane (province outlined on approach, landfall generated on arrival) →
// second city on the far continent → travel to its dungeon → play a turn.

import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page }, use) => {
    const fatals = [];
    page.on('pageerror', e => fatals.push(e.message));
    await use(page);
    expect(fatals, `uncaught page errors:\n${fatals.join('\n')}`).toEqual([]);
  },
});

// ─── The fake Game Master, campaign edition ──────────────────────────────────

const NARRATION = 'The lantern gutters; something older than the room breathes back.';

function chatResponse(content) {
  return {
    id: 'mock', object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { total_tokens: 42, cost: 0.0001 },
  };
}

function makeCampaignMock() {
  const counters = { settlement: 0, region: 0 };

  return function answer(body) {
    const schema = body.response_format?.json_schema?.schema;
    if (!schema) return 'The tale threads onward.';
    const asked = Object.keys(schema.properties ?? {});
    const sys = body.messages?.find(m => m.role === 'system')?.content ?? '';
    const user = body.messages?.filter(m => m.role === 'user').map(m => m.content).join('\n') ?? '';

    // Worldgen layers, in dispatch order of most-specific first.
    if (asked.includes('creation')) {
      return JSON.stringify({
        name: 'Thalassa', tone: 'heroic',
        creation: 'The sea dreamed the land, and the land forgot to thank it.',
        gods: [{ name: 'Nerath', domain: 'tides' }, { name: 'Ilm', domain: 'lanterns' }],
        redThread: { premise: 'The tide-bell of Thalassa has gone silent and the sea is rising.', hook: 'A drowned courier carries a dry letter.' },
        digest: 'Thalassa — heroic sea-world; the tide-bell is silent, the water rises, two gods watch.',
      });
    }
    if (asked.includes('continents')) {
      const ids = [...sys.matchAll(/id "([^"]+)", working name/g)].map(m => m[1]);
      const names = ['Meridia', 'Karkos', 'Ossel', 'Vhance'];
      return JSON.stringify({
        continents: ids.map((id, i) => ({
          id, name: names[i] ?? `Far-${i}`,
          digest: i === 0
            ? 'Meridia — terraced harbours and salt-monasteries; the tide-bell hung here, and its silence is a wound the whole coast feels.'
            : 'Karkos — black-sand shores under ash-fig orchards; grudges are kept in ledgers, and the Saltborn Compact collects on them.',
          factionHomelands: [
            { factionId: 'fac-tide', presence: i === 0 ? 'homeland' : 'contested' },
            { factionId: 'fac-salt', presence: i === 0 ? 'contested' : 'homeland' },
          ],
        })),
      });
    }
    if (asked.includes('conflicts')) {
      const id = (sys.match(/id "([^"]+)"/) ?? [])[1] ?? 'province-unknown';
      return JSON.stringify({
        id, name: 'the Ashen Strand',
        digest: 'The Ashen Strand — Karkos’s port province, where ash-fig wine buys silence and the harbour master answers to nobody living.',
        conflicts: ['The Compact taxes the docks the crown thinks it owns.', 'Something under the breakwater sings at low tide.'],
        landmarks: ['the Breakwater Bell', 'the Orchard of Ledgers'],
        dominantFactionId: 'fac-salt', factionStance: 'dominant',
      });
    }
    if (asked.includes('factions')) {
      return JSON.stringify({
        factions: [
          { id: 'fac-tide', name: 'the Bellwardens', description: 'Keepers of the silent tide-bell.',
            values: ['duty'], allies: [], enemies: ['fac-salt'], territory: 'Meridia', digest: 'Bellwardens — bell keepers, grieving and proud.' },
          { id: 'fac-salt', name: 'the Saltborn Compact', description: 'Merchant oath-ring of the far shore.',
            values: ['profit'], allies: [], enemies: ['fac-tide'], territory: 'Karkos', digest: 'Saltborn Compact — ledgers, grudges, harbours.' },
        ],
      });
    }
    if (asked.includes('setups')) {
      return JSON.stringify({
        title: 'The Silent Bell', premise: 'Find why the tide-bell stopped.',
        beats: [
          { id: 'reach-the-deep', title: 'Reach the Echoing Deep', dramaticPurpose: 'The party enters the drowned vault below the coast.', location: null, requires: [], completesOn: ['boss-slain'] },
          { id: 'read-the-ledger', title: 'Read the drowned ledger', dramaticPurpose: 'The party learns who silenced the bell.', location: null, requires: ['beat-done-reach-the-deep'], completesOn: [] },
        ],
        setups: [{ clue: 'A bell-clapper wrapped in merchant cloth.', paysInto: 'read-the-ledger' }],
      });
    }
    if (asked.includes('beats')) {
      return JSON.stringify({
        beats: [
          { id: 'beat.01.hear-the-silence', dramaticPurpose: 'Learn the tide-bell has stopped.', targetPlaytimeMinutes: 45,
            prerequisites: [], setRequiredFlags: ['heard-silence'], preferredLocation: null,
            requiredArchetypes: [{ role: 'informant', notes: 'harbour folk' }], successors: [] },
          { id: 'beat.02.cross-the-sea', dramaticPurpose: 'Cross to the far shore where the answer waits.', targetPlaytimeMinutes: 60,
            prerequisites: ['heard-silence'], setRequiredFlags: ['crossed-sea'], preferredLocation: null,
            requiredArchetypes: [{ role: 'fixer', notes: 'a captain' }], successors: [] },
        ],
      });
    }
    if (asked.includes('settlementName')) {
      counters.region++;
      const first = counters.region === 1;
      return JSON.stringify({
        id: first ? 'region-brine' : 'region-strand',
        name: first ? 'the Brinemoor' : 'the Ashen Strand',
        climate: first ? 'coastal' : 'volcanic',
        description: first ? 'Salt flats and bell-less chapels.' : 'Black sand under ash-fig orchards.',
        settlementName: first ? 'Brinemarket' : 'Farport',
        dungeonName: first ? 'the Bell Cistern' : 'the Echoing Deep',
        rumor: first ? 'They say the bell was taken, not broken.' : 'The breakwater sings at low tide.',
        adjacentHints: ['a grey coast'], digest: first
          ? 'The Brinemoor — coastal salt flats, grieving chapels.'
          : 'The Ashen Strand — volcanic shore, orchards over black sand.',
      });
    }
    if (asked.includes('exits')) {
      counters.settlement++;
      const first = counters.settlement === 1;
      const name = first ? 'Brinemarket' : 'Farport';
      return JSON.stringify({
        id: first ? 'settlement-brine' : 'settlement-farport',
        name,
        description: first
          ? 'Brinemarket hangs its nets between bell-less towers.'
          : 'Farport stacks its wine barrels against the black wind.',
        regionId: first ? 'region-brine' : 'region-strand',
        npcs: [
          { id: `${name}-mara`, name: 'Mara', role: 'innkeeper', attitude: 'friendly',
            greeting: 'Salt in your cup, stranger?', personality: 'dry', secret: null, factionId: 'fac-tide',
            relationships: [], inventory: null, questHook: null },
          { id: `${name}-odo`, name: 'Odo', role: 'merchant', attitude: 'neutral',
            greeting: 'Coin first, questions after.', personality: 'brisk', secret: null, factionId: 'fac-salt',
            relationships: [], inventory: [{ name: 'hempen rope', price: 2, description: '50 feet, barely used.' }], questHook: null },
        ],
        exits: [
          { direction: 'north', targetName: first ? 'the Bell Cistern' : 'the Echoing Deep',
            targetType: 'dungeon', targetId: first ? 'dungeon-cistern' : 'dungeon-echo' },
          { direction: 'east', targetName: 'the Old Road', targetType: 'road', targetId: null },
        ],
        digest: `${name} — Mara, Odo.`,
      });
    }

    // Turn-loop calls.
    if (asked.includes('direction')) {   // dungeon classifier
      const hostile = user.match(/"id":"([^"]+)","name":"[^"]+","hp":\d+[^}]*"attitude":"hostile"/);
      if (hostile) return JSON.stringify({ intent: 'attack', target_id: hostile[1], direction: null, skill: null, spell_id: null, dc: null, reason: 'mock: hostiles first' });
      return JSON.stringify({ intent: 'look', target_id: null, direction: null, skill: null, spell_id: null, dc: null, reason: 'mock' });
    }
    if (asked.includes('intent')) {      // settlement classifier
      const text = user.toLowerCase();
      const to = (text.match(/(?:travel to|to)\s+(.+)$/) ?? [])[1] ?? null;
      if (/travel|road|deep|cistern/.test(text)) return JSON.stringify({ intent: 'travel', target: to, reason: 'mock' });
      if (/talk|speak/.test(text))               return JSON.stringify({ intent: 'talk', target: to, reason: 'mock' });
      return JSON.stringify({ intent: 'look', target: null, reason: 'mock' });
    }
    if (asked.includes('reply'))       return JSON.stringify({ reply: 'The bell did not crack, friend — it was carried east across the water. Ask in Farport.', revealsSecret: false });
    if (asked.includes('fulfilled'))   return JSON.stringify({ fulfilled: false, reason: 'mock' });
    if (asked.includes('facts') || asked.includes('mint')) return JSON.stringify({ facts: [], mint: [] });
    if (asked.includes('combat_ended')) return JSON.stringify({ narration: NARRATION, combat_ended: true, outcome: 'victory' });
    if (asked.includes('action'))      return JSON.stringify({ action: 'look' });
    return JSON.stringify({ narration: NARRATION });
  };
}

async function mockOpenRouter(page) {
  await page.route('**/api/v1/auth/key', route => route.fulfill({ json: { data: { label: 'mock', usage: 0 } } }));
  await page.route('**/api/v1/models', route => route.fulfill({ json: { data: [] } }));
  const answer = makeCampaignMock();
  await page.route('**/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON() ?? {};
    // Ground truth for 'this action was free': every completion the app asks
    // for is counted in the page, where the test can read it.
    await page.evaluate(() => { window.__ddCalls = (window.__ddCalls ?? 0) + 1; }).catch(() => {});
    // Keep the system prompts the app actually sent, so a test can assert the
    // pack's voice reached the model rather than only that the pack loaded.
    const sysText = (body.messages ?? []).filter(m => m.role === 'system').map(m => m.content).join('\n');
    await page.evaluate((text) => {
      window.__ddPrompts = (window.__ddPrompts ?? []);
      window.__ddPrompts.push(text);
    }, sysText).catch(() => {});
    const content = answer(body);
    if (body.stream) {
      const chunk = JSON.stringify({ choices: [{ delta: { content } }] });
      await route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: `data: ${chunk}\n\ndata: [DONE]\n\n` });
      return;
    }
    await route.fulfill({ json: chatResponse(content) });
  });
}

async function bootDeluxe(page) {
  await page.addInitScript(() => {
    // Deterministic world: seed Math.random before any app script runs.
    let s = 1337 >>> 0;
    Math.random = () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    if (localStorage.getItem('dans-dungeons')) return;
    localStorage.setItem('dans-dungeons', JSON.stringify({
      v: 2, data: { ai: { key: 'sk-or-mock', tier: 'deluxe' }, settings: { sceneImage: false } },
    }));
  });
  await mockOpenRouter(page);
  await page.goto('/');
  await expect(page.locator('#transcript')).toBeVisible();
}

// Answer the wizard. Deluxe asks the MODE first ("1" = campaign), then the
// SETTING (doc 19 — packs), then the character wizard (name, then numbered
// picks). The first driver typed the name into the mode prompt and the hero
// ended up christened "1"; the setting question is inserted at the same seam,
// so it gets the same care.
//
// The setting is answered BY NAME rather than by number: pickFrom matches an
// option's id or label, and pinning 'classic' by index would couple this test
// to the order packs happen to be registered in. Classic inherits everything,
// so this scenario keeps testing the campaign rather than a pack.
async function driveWizardIntoCampaign(page, settingId = 'classic') {
  const cmd = page.locator('#cmd');
  await expect(cmd).toBeEnabled({ timeout: 30_000 });
  await cmd.fill('1');            // campaign mode
  await cmd.press('Enter');
  await expect(cmd).toBeEnabled({ timeout: 30_000 });
  await cmd.fill(settingId);      // the setting pack
  await cmd.press('Enter');
  await expect(cmd).toBeEnabled({ timeout: 30_000 });
  await cmd.fill('Tessa');        // the character's name
  await cmd.press('Enter');
  for (let i = 0; i < 10; i++) {
    await expect(cmd).toBeEnabled({ timeout: 30_000 });
    const text = await page.locator('#transcript').innerText();
    // Stop the moment worldgen begins OR the town has already rendered (the
    // town render clears the transcript, so the worldgen marker can vanish
    // between iterations — sending another "1" would play a stray turn).
    if (/Blueprint:|Brinemarket/i.test(text)) break;
    await cmd.fill('1');
    await cmd.press('Enter');
    await page.waitForTimeout(300);
  }
  // Genesis is many mocked calls; the town banner is the arrival signal.
  await expect(page.locator('#transcript')).toContainText('Brinemarket', { timeout: 60_000 });
}

// ─── The run ─────────────────────────────────────────────────────────────────

test('a campaign crosses the sea: city, factions, far continent, dungeon', async ({ page }) => {
  test.setTimeout(240_000);
  const transcript = page.locator('#transcript');
  const cmd = page.locator('#cmd');
  const type = async (s) => {
    await expect(cmd).toBeEnabled({ timeout: 30_000 });
    await cmd.fill(s);
    await cmd.press('Enter');
  };

  await bootDeluxe(page);
  await driveWizardIntoCampaign(page);

  // The city: banner, description, chips alive. (The continent outline ran
  // during genesis — its player-visible proof comes later, when the crossing
  // sights "the Ashen Strand" only an outlined skeleton could name.)
  await expect(transcript).toContainText('Brinemarket hangs its nets');
  await expect(page.locator('#action-chips button').filter({ hasText: /Set sail/ })).toHaveCount(1);

  // Factions and story exist before we leave.
  await type('/story');
  await expect(transcript).toContainText('── Story ──');

  // ── The dictionary is free (doc 19, Part II) ────────────────────────────
  // The player asks about a name the narrator has been using. It is answered
  // from stored knowledge: no thinking indicator, no model call, no turn.
  const turnCount = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('dans-dungeons')).data.session.turnCount ?? null; }
    catch { return null; }
  });
  const turnsBefore = await turnCount();
  const callsBefore = await page.evaluate(() => window.__ddCalls ?? 0);
  await type('what is Brinemarket?');
  await expect(transcript).toContainText('Brinemarket —', { timeout: 10_000 });
  expect(await page.evaluate(() => window.__ddCalls ?? 0), 'a dictionary lookup must not call the model').toBe(callsBefore);
  if (turnsBefore !== null) {
    expect(await turnCount(), 'a dictionary lookup must not cost a turn').toBe(turnsBefore);
  }

  // Bare /what suggests what is worth asking about, and an unknown name is
  // refused rather than invented.
  await type('/what');
  await expect(transcript).toContainText('Things you could ask about:');
  await type('/what the Obsidian Parliament');
  await expect(transcript).toContainText('means nothing to you yet');

  // A question the index CANNOT answer is not swallowed: it flows on to the
  // Game Master as an ordinary turn, which is what keeps false positives at
  // zero for questions about the live scene.
  const callsBeforeMiss = await page.evaluate(() => window.__ddCalls ?? 0);
  await type('what is that sound?');
  await expect.poll(() => page.evaluate(() => window.__ddCalls ?? 0), { timeout: 20_000 })
    .toBeGreaterThan(callsBeforeMiss);

  // Talk to a citizen — the conversation points across the sea.
  await type('talk to Mara');
  await expect(transcript).toContainText('Salt in your cup', { timeout: 20_000 });
  await type('what happened to the tide-bell?');
  await expect(transcript).toContainText('carried east across the water', { timeout: 20_000 });
  await type('leave');   // leave the conversation loop
  await expect(page.locator('#action-chips button').filter({ hasText: /Set sail/ })).toHaveCount(1, { timeout: 20_000 });

  // Set sail: the crossing outlines the far province on approach and
  // generates the landfall on arrival.
  await page.locator('#action-chips button').filter({ hasText: /Set sail/ }).click();
  await expect(transcript).toContainText('days of open sea', { timeout: 30_000 });
  // The crossing prose (sighting the outlined province, putting in at the far
  // port) streams and is then CLEARED by the arrival render — towns own the
  // screen. Capture what the poll can see for the run record, and assert the
  // stable end state: the far city, rendered, with the home port remembered.
  const crossingSeen = new Set();
  await expect(async () => {
    const text = await transcript.innerText();
    for (const line of ['Land rises on the horizon', 'the Ashen Strand', 'puts in at Farport']) {
      if (text.includes(line)) crossingSeen.add(line);
    }
    expect(text).toContain('Farport stacks its wine barrels');
  }).toPass({ timeout: 60_000 });
  console.log('crossing lines observed before the town cleared them:', [...crossingSeen].join(' | ') || '(cleared too fast to poll)');
  await expect(transcript).toContainText('Brinemarket');   // the home port stays known
  // The arrival note SURVIVES the town's screen clear now.
  await expect(transcript).toContainText('days at sea');

  // /map shows the layers: both continents, their homelands, the port marks.
  await type('/map');
  await expect(transcript).toContainText('Meridia — homeland of the Bellwardens');
  await expect(transcript).toContainText('Karkos — homeland of the Saltborn Compact');
  await expect(transcript).toContainText('the Ashen Strand');

  // The far city is a real settlement: its dungeon is one travel away.
  await type('travel to the Echoing Deep');
  await expect(transcript).toContainText(/exits/i, { timeout: 60_000 });

  // Play a dungeon turn on the far continent.
  await type('look around');
  await expect(transcript).toContainText(NARRATION, { timeout: 30_000 });

  // The full run, for the record.
  const finalText = await transcript.innerText();
  console.log('===== CAMPAIGN RUN TRANSCRIPT =====');
  console.log(finalText);
  console.log('===== END TRANSCRIPT =====');
});


// ─── A pack changes the world's clothes and nothing else (doc 19, Part I) ────
//
// classic is asserted to be a no-op by the unit suite; this is the other
// direction, in a real browser: pick the far reskin and prove its content
// reaches the three places a player meets it — the room prose, the creature
// names, and the voice the model is briefed in. The mock answers the same
// schemas either way, so anything that changes here changed because the pack
// changed it.

test('a setting pack re-skins the game it is playing', async ({ page }) => {
  test.setTimeout(240_000);
  const transcript = page.locator('#transcript');
  const cmd = page.locator('#cmd');
  const type = async (s) => {
    await expect(cmd).toBeEnabled({ timeout: 30_000 });
    await cmd.fill(s);
    await cmd.press('Enter');
  };

  await bootDeluxe(page);
  await driveWizardIntoCampaign(page, 'neon-stacks');

  // The world was generated under the pack. The wizard's confirmation line is
  // gone by now — the town render owns the screen and clears it — so the honest
  // read is the save: the id rides in `world`, which is what makes it survive
  // export, slots and every time-travel branch.
  const settingId = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('dans-dungeons')).data.world.settingId ?? null; }
    catch { return null; }
  });
  expect(settingId).toBe('neon-stacks');

  // Genesis has run, so the setting statement has already had to constrain
  // every worldgen prompt. (The voice block rides on the prompts that SPEAK —
  // narrator, dialogue, travel — so it cannot be asserted until a turn plays.)
  const genesisPrompts = await page.evaluate(() => window.__ddPrompts ?? []);
  expect(genesisPrompts.filter(p => /vertical mega-city/i.test(p)).length,
    'the setting statement must constrain the generators').toBeGreaterThan(0);

  // Travel into the dungeon: room prose and creature names are the pack's.
  await type('travel to the Bell Cistern');
  await expect(transcript).toContainText(/exits/i, { timeout: 60_000 });
  const dungeonText = await transcript.innerText();
  expect(dungeonText, 'room prose comes from the pack overlay, not the base bundle')
    .toMatch(/gate landing|lift lobby|cage door|turnstile|stair head/i);
  expect(dungeonText, 'a fantasy room description would mean the overlay never applied')
    .not.toMatch(/tapestries|mildew and hay/i);

  // Play a turn: now the narrator has been briefed, and the brief carries the
  // pack's register. This is the assertion that would catch a {{voice}} slot
  // added to a template but never filled by a call site.
  await type('look around');
  await expect(transcript).toContainText(NARRATION, { timeout: 30_000 });
  const prompts = await page.evaluate(() => window.__ddPrompts ?? []);
  expect(prompts.filter(p => /choom/.test(p)).length,
    'the pack voice must reach the prompts that speak').toBeGreaterThan(0);

  // The dictionary speaks the pack's vocabulary too: /map relabels the layers.
  await type('/map');
  await expect(transcript).toContainText('Known sprawl');

  const finalText = await transcript.innerText();
  console.log('===== NEON-STACKS RUN =====');
  console.log(finalText.slice(-2500));
  console.log('===== END =====');
});
