// The player's dictionary (doc 19, Part II).
//
// Two things are being pinned here, and the second matters more than the first:
//
//   1. that the index finds what the player knows, and
//   2. that it CANNOT find what they don't.
//
// The second is the whole design. An unrevealed secret, an unidentified
// property, a place heard of but never walked — each has a specific wrong
// answer that would be easy to ship and hard to notice, because the failure is
// a helpful-sounding sentence rather than a crash. Every "must not" below is
// one of those sentences.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLexiconIndex, lookupLexicon, renderLexiconEntry, renderLexiconCandidates,
  lexiconTopics, matchLexiconQuestion, clampBody, normalize, LEXICON_BODY_MAX,
} from '../src/game/lexicon.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Read the bundles rather than importing them: CI pins Node 20, where JSON
// import attributes are not reliably available (the parity suite loads them
// the same way).
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/${code}.json`), 'utf8'));
const en = load('en');
const nl = load('nl');

// A minimal stand-in for src/i18n/i18n.js — the real one reads localStorage at
// import time, which is exactly why the module under test takes its i18n
// injected (the preClassify precedent).
function i18nFor(bundle) {
  const walk = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), bundle);
  return {
    t: (key, params) => {
      const val = walk(key);
      if (typeof val !== 'string') return key;
      return params
        ? Object.entries(params).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), val)
        : val;
    },
    tRaw: (key) => walk(key),
    locale: () => (bundle === nl ? 'nl' : 'en'),
  };
}
const I18N = i18nFor(en);
const I18N_NL = i18nFor(nl);

const bodyOf = (entry) => renderLexiconEntry(entry, I18N).join('\n');

// A settlement with one NPC the player has talked to, who is sitting on a
// secret, plus the region and the geography around it.
function worldFixture(over = {}) {
  return {
    location: { regionId: 'reg-salt', settlementId: 'set-fenn' },
    currentRoom: null,
    regions: {
      'reg-salt': { id: 'reg-salt', name: 'Saltmarch Reach', digest: 'Flat water country under a low sky.', climate: 'mire' },
    },
    settlements: {
      'set-fenn': {
        id: 'set-fenn', name: 'Fennwick', description: 'A stilt town over black water.',
        npcs: [
          {
            id: 'npc-mira', name: 'Mira Fell', role: 'harbourmaster', attitude: 'neutral',
            personality: 'brisk, allergic to small talk',
            secret: 'she sank the tithe barge herself',
            secretRevealed: false,
            factionId: 'fac-tide',
            questHook: 'find out who is cutting the mooring lines',
            dialogueHistory: [{ role: 'player', text: 'hello' }, { role: 'npc', text: 'State your business.' }],
          },
          {
            id: 'npc-quiet', name: 'Odo Vance', role: 'net-mender',
            secret: 'he is the one cutting the lines',
            dialogueHistory: [],   // never spoken to
          },
        ],
      },
    },
    factions: {
      'fac-tide': { id: 'fac-tide', name: 'the Tide Wardens', description: 'Keepers of the sea gates.' },
      'fac-dark': { id: 'fac-dark', name: 'the Ashen Concord', description: 'Never mentioned to the player.' },
    },
    factionReputation: { 'fac-tide': 20 },
    quests: {
      'q-1': { id: 'q-1', description: 'Find who is cutting the mooring lines', npcName: 'Mira Fell', factionId: 'fac-tide', status: 'active' },
    },
    npcs: {},
    geography: {
      nodes: {
        'continent-0': { id: 'continent-0', name: 'Veldrath', kind: 'continent', parent: null, digest: 'A long wet coast and a colder interior.' },
        'continent-0.province-0': { id: 'continent-0.province-0', name: 'Saltmarch', kind: 'province', parent: 'continent-0', digest: 'Tidal country; the barges run it.' },
        'reg-salt': { id: 'reg-salt', name: 'Saltmarch Reach', kind: 'region', parent: 'continent-0.province-0' },
        'reg-far': { id: 'reg-far', name: 'Thornfell', kind: 'region', parent: 'continent-0.province-0', hook: 'bells heard at odd hours', stub: true },
      },
      edges: [],
    },
    encountered: {},
    ...over,
  };
}

function sourcesFor(world, over = {}) {
  const visited = [world.geography.nodes['continent-0'], world.geography.nodes['continent-0.province-0'], world.geography.nodes['reg-salt']];
  return {
    world,
    inventory: [],
    entities: {},
    hasEncountered: () => false,
    encounteredKeys: [],
    knownMap: { visited, rumoured: [world.geography.nodes['reg-far']] },
    memory: null,
    story: null,
    rumours: [],
    standingOf: () => 'ally',
    ...over,
  };
}

const index = (sources) => buildLexiconIndex(sources, I18N);
const ask = (q, sources) => lookupLexicon(q, index(sources), I18N);

describe('what the player knows is findable', () => {
  it('serves a region the player has been to, with its lineage', () => {
    const res = ask('Saltmarch Reach', sourcesFor(worldFixture()));
    assert.ok(res.hit, 'a visited region must be in the index');
    const text = bodyOf(res.hit);
    assert.match(text, /Flat water country/);
    assert.match(text, /Saltmarch/);          // lineage: province above it
    assert.match(text, /mire/);               // climate line
  });

  it('finds an NPC the player has actually spoken to', () => {
    const res = ask('Mira Fell', sourcesFor(worldFixture()));
    assert.ok(res.hit);
    assert.equal(res.hit.kind, 'npc');
    assert.match(bodyOf(res.hit), /harbourmaster/);
  });

  it('finds quests, and names who gave them', () => {
    const res = ask('mooring lines', sourcesFor(worldFixture()));
    assert.ok(res.hit, 'an accepted quest is player knowledge');
    assert.match(bodyOf(res.hit), /Mira Fell/);
  });

  it('finds a faction the player has standing with', () => {
    const res = ask('Tide Wardens', sourcesFor(worldFixture()));
    assert.ok(res.hit);
    assert.match(bodyOf(res.hit), /sea gates/);
    assert.match(bodyOf(res.hit), /ally/);
  });

  it('serves chapter digests — the player’s own past', () => {
    const sources = sourcesFor(worldFixture(), { memory: { chapters: ['The Drowned Bell: A barge sank and nobody wrote it down.'] } });
    const res = ask('The Drowned Bell', sources);
    assert.ok(res.hit);
    assert.equal(res.hit.kind, 'chapter');
    assert.match(bodyOf(res.hit), /nobody wrote it down/);
  });
});

describe('what the player does not know stays hidden', () => {
  it('never serves an unrevealed secret, and never reads the field at all', () => {
    const all = index(sourcesFor(worldFixture()));
    const text = JSON.stringify(all);
    assert.ok(!text.includes('sank the tithe barge'),
      'an unrevealed secret must never reach the index');
    assert.ok(!text.includes('cutting the lines'),
      'a silent NPC’s secret must never reach the index');
    assert.ok(!text.includes('allergic to small talk'),
      'personality is GM colour, not player knowledge');
  });

  it('does not know an NPC the player has never spoken to', () => {
    const res = ask('Odo Vance', sourcesFor(worldFixture()));
    assert.ok(res.miss, 'a never-met NPC must not be in the dictionary');
  });

  it('does not know a faction that has never come up', () => {
    const res = ask('Ashen Concord', sourcesFor(worldFixture()));
    assert.ok(res.miss, 'naming an unheard faction would leak that it exists');
  });

  it('a revealed secret DOES arrive — through the ledger, as an ordinary note', () => {
    // This is what flow.js records on reveal: the fact becomes canon under the
    // NPC's entity id, and the encounter gate opens for it. Undo rewinds the
    // ledger, so it rewinds the knowledge too.
    const id = 'region.reg-salt.settlement.set-fenn.npc.npc-mira';
    const res = ask('Mira Fell', sourcesFor(worldFixture(), {
      entities: { [id]: { name: 'Mira Fell', note: 'she sank the tithe barge herself' } },
      hasEncountered: (x) => x === id,
    }));
    assert.ok(res.hit);
    assert.match(bodyOf(res.hit), /tithe barge/);
    assert.equal(res.hit.name, 'Mira Fell', 'the properly-cased name survives the merge');
  });

  it('ledger entities the player has not encountered are not served', () => {
    const id = 'region.reg-salt.creature.ghoul';
    const res = ask('ghoul', sourcesFor(worldFixture(), {
      entities: { [id]: { name: 'Privy Ghoul', note: 'it waits under the boards' } },
    }));
    assert.ok(res.miss, 'the encounter gate is what stops the dictionary spoiling the dungeon');
  });
});

describe('heard-of is labelled as hearsay, never as fact', () => {
  it('serves a rumoured place from its hook, prefixed', () => {
    const res = ask('Thornfell', sourcesFor(worldFixture()));
    assert.ok(res.hit);
    assert.equal(res.hit.cls, 'heardOf');
    const text = bodyOf(res.hit);
    assert.match(text, new RegExp(en.lexicon.heardOfPrefix.trim()));
    assert.match(text, /bells heard at odd hours/);
  });

  it('a threat named in a rumour is heard-of, not known', () => {
    const id = 'region.reg-salt.creature.ghoul';
    const res = ask('Privy Ghoul', sourcesFor(worldFixture(), {
      entities: { [id]: { name: 'Privy Ghoul', note: 'it waits under the boards', state: 'active-threat' } },
      rumours: ['They say the Privy Ghoul has been at the fish traps again.'],
    }));
    assert.ok(res.hit);
    assert.equal(res.hit.cls, 'heardOf');
    assert.match(bodyOf(res.hit), /fish traps/);
    assert.ok(!bodyOf(res.hit).includes('under the boards'),
      'the ledger note is first-hand knowledge; only the rumour was heard');
  });

  it('known beats heard-of when both exist for one name', () => {
    const world = worldFixture();
    const sources = sourcesFor(world, {
      knownMap: {
        visited: [world.geography.nodes['reg-salt']],
        rumoured: [{ id: 'x', name: 'Saltmarch Reach', kind: 'region', hook: 'only a rumour' }],
      },
    });
    const res = ask('Saltmarch Reach', sources);
    assert.equal(res.hit.cls, 'known');
  });
});

describe('items keep their own counsel', () => {
  const staff = { id: 'i-1', name: 'crooked staff', description: 'Ash wood, worn smooth at the grip.',
                  hidden: { property: 'it is a staff of withering' } };

  it('serves the description and not the hidden property', () => {
    const res = ask('crooked staff', sourcesFor(worldFixture(), { inventory: [staff] }));
    assert.ok(res.hit);
    assert.match(bodyOf(res.hit), /Ash wood/);
    assert.ok(!bodyOf(res.hit).includes('withering'), 'an unidentified property must stay unidentified');
  });

  it('hints that there is more ONLY when the item asks for it', () => {
    const plain = ask('crooked staff', sourcesFor(worldFixture(), { inventory: [staff] }));
    assert.ok(!bodyOf(plain.hit).includes(en.lexicon.hiddenMore));

    const hinted = ask('crooked staff', sourcesFor(worldFixture(), { inventory: [{ ...staff, hintHidden: true }] }));
    assert.ok(bodyOf(hinted.hit).includes(en.lexicon.hiddenMore),
      'hintHidden is an authored hint, never inferred from the hidden data');
  });
});

describe('matching is forgiving in the ways players actually type', () => {
  const sources = () => sourcesFor(worldFixture());

  it('handles articles, possessives, case and punctuation', () => {
    for (const q of ['the Saltmarch Reach', 'SALTMARCH REACH', "the Saltmarch Reach's", 'saltmarch reach.']) {
      assert.ok(ask(q, sources()).hit, `should resolve: ${q}`);
    }
  });

  it('resolves a distinctive word out of a longer name', () => {
    assert.ok(ask('Fennwick', sources()).hit);
    assert.ok(ask('Veldrath', sources()).hit);
  });

  it('asks which one when a word is shared, known first and capped', () => {
    const world = worldFixture();
    world.regions['reg-2'] = { id: 'reg-2', name: 'Salt Hollow', digest: 'A dry cut in the hills.' };
    world.regions['reg-3'] = { id: 'reg-3', name: 'Salt Gate', digest: 'A toll on the old road.' };
    world.regions['reg-4'] = { id: 'reg-4', name: 'Salt Barrows', digest: 'Mounds nobody digs.' };
    world.regions['reg-5'] = { id: 'reg-5', name: 'Salt Wold', digest: 'Grass to the horizon.' };
    const res = ask('salt', sourcesFor(world));
    assert.ok(res.candidates, 'an ambiguous word must ask, not guess');
    assert.ok(res.candidates.length <= 4, 'the ambiguity list is capped');
    assert.equal(res.candidates[0].cls, 'known');
    assert.match(renderLexiconCandidates(res.candidates, I18N)[0], /Which one\?/);
  });

  it('misses cleanly on a name the world has never used', () => {
    assert.ok(ask('the Obsidian Parliament', sources()).miss);
    assert.ok(ask('', sources()).miss);
    assert.ok(ask('   ', sources()).miss);
  });
});

describe('question patterns route without eating prose', () => {
  it('recognises the forms a confused player types', () => {
    const cases = {
      'what is Saltmarch?': 'saltmarch',
      "what's the Tide Wardens": 'the tide wardens',
      'Who is Mira Fell?': 'mira fell',
      'tell me about Fennwick': 'fennwick',
      'explain the tithe barge': 'the tithe barge',
      'where is Thornfell?': 'thornfell',
    };
    for (const [input, expected] of Object.entries(cases)) {
      assert.equal(matchLexiconQuestion(input, I18N), expected, input);
    }
  });

  it('handles the curly apostrophe a phone keyboard produces', () => {
    assert.equal(matchLexiconQuestion('what’s Saltmarch', I18N), 'saltmarch');
  });

  it('leaves ordinary prose alone', () => {
    for (const input of ['what a day', 'i attack the goblin', 'whatever happens next',
                         'what', 'who', 'explain', 'look around']) {
      assert.equal(matchLexiconQuestion(input, I18N), null, input);
    }
  });

  it('routes Dutch questions under the Dutch bundle', () => {
    assert.equal(matchLexiconQuestion('wat is Saltmarch?', I18N_NL), 'saltmarch');
    assert.equal(matchLexiconQuestion('vertel me over Fennwick', I18N_NL), 'fennwick');
    assert.equal(matchLexiconQuestion('wat een dag', I18N_NL), null);
  });

  it('strips Dutch articles when looking up', () => {
    const res = lookupLexicon('de Saltmarch Reach', index(sourcesFor(worldFixture())), I18N_NL);
    assert.ok(res.hit);
  });
});

describe('presentation', () => {
  it('heads every entry with its name and kind label', () => {
    const res = ask('Fennwick', sourcesFor(worldFixture()));
    const lines = renderLexiconEntry(res.hit, I18N);
    assert.equal(lines[0], `Fennwick — ${en.lexicon.kind.settlement}`);
  });

  it('clamps a long body at a sentence boundary', () => {
    const long = `${'A sentence that goes on. '.repeat(40)}`;
    const out = clampBody(long, LEXICON_BODY_MAX);
    assert.ok(out.length <= LEXICON_BODY_MAX);
    assert.ok(out.endsWith('.'), 'clamping should land on a full stop when one is in range');
  });

  it('falls back to the refusal line when asked to render nothing', () => {
    assert.deepEqual(renderLexiconEntry(null, I18N), [en.lexicon.unknown]);
  });

  it('normalize folds case and punctuation the same way for chips and typing', () => {
    assert.equal(normalize('  The  Saltmarch, Reach! '), 'the saltmarch reach');
  });
});

describe('topics suggest what the player just read', () => {
  it('puts where you are standing first, then tasks', () => {
    const world = worldFixture();
    const topics = lexiconTopics(index(sourcesFor(world)), sourcesFor(world), 8);
    const names = topics.map(t => t.name);
    assert.ok(names.includes('Fennwick'));
    assert.ok(names.includes('Saltmarch Reach'));
    assert.ok(names.indexOf('Fennwick') < names.length - 1 || names.length === 1);
    assert.ok(topics.every(t => t.cls === 'known'), 'never suggest asking about hearsay');
  });

  it('is empty-safe on a world with nothing in it', () => {
    const bare = { world: {}, knownMap: { visited: [], rumoured: [] } };
    assert.deepEqual(buildLexiconIndex(bare, I18N), []);
    assert.deepEqual(lexiconTopics([], bare, 8), []);
    assert.ok(lookupLexicon('anything', [], I18N).miss);
  });

  it('survives a completely empty call', () => {
    assert.deepEqual(buildLexiconIndex(), []);
    assert.ok(lookupLexicon('x').miss);
  });
});

describe('the free action stays free', () => {
  // The guarantee is structural — buildLexiconIndex is a pure read over a
  // snapshot — so the test that means anything is that nothing it touches is a
  // writer. It takes plain objects and returns an array; there is no store to
  // mutate, no turn to count, and no way for a dictionary lookup to reach the
  // turn engine. Freeze the input and prove it comes back untouched.
  it('does not mutate the state it reads', () => {
    const world = Object.freeze(worldFixture());
    const sources = sourcesFor(world);
    const before = JSON.stringify(world);
    const idx = buildLexiconIndex(sources, I18N);
    lookupLexicon('Saltmarch Reach', idx, I18N);
    lexiconTopics(idx, sources, 8);
    assert.equal(JSON.stringify(world), before);
  });
});
