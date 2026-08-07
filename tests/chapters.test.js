// Chapter structure and the narrator's memory window (Epic E4).
//
// session.chapterId sat hardcoded at 'ch-1' for the repo's whole history: there
// was no session layer, and the Game Master's entire recall was three transcript
// entries — one and a half turns, while the prompt claimed "the last 3 turns".
// That was the first thing to fail on the road to 80 hours, and it failed inside
// the first hour of play.
//
// Mirrors the pure shape rather than importing chapters.js, which binds the
// Spektrum singleton at import time (the repo's mirror-testing convention).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const TRANSCRIPT_WINDOW = 14;

function memoryContext({ chapters = [], rolling = null, events = [] }) {
  const ctx = {};
  if (chapters.length) ctx.chapters = chapters.map(c => `${c.title}: ${c.digest}`);
  if (rolling)         ctx.thisChapter = rolling;
  if (events.length)   ctx.recently = events;
  return Object.keys(ctx).length ? ctx : null;
}
const windowOf = (t) => t.slice(-TRANSCRIPT_WINDOW);

function cut(session, reason, digest) {
  const closed = {
    id: `ch-${session.chapters.length + 1}`,
    title: `Chapter ${session.chapters.length + 1}`,
    digest, startTurn: session.chapterStartTurn, endTurn: session.turnCount, reason,
  };
  return {
    ...session,
    chapters: [...session.chapters, closed],
    chapterId: `ch-${session.chapters.length + 2}`,
    chapterStartTurn: session.turnCount,
    rollingDigest: null,
  };
}

describe('the narrator memory window', () => {
  const transcript = Array.from({ length: 120 }, (_, i) => ({ role: i % 2 ? 'gm' : 'player', text: `line ${i}` }));

  it('feeds far more than the 3 entries it used to', () => {
    assert.equal(windowOf(transcript).length, TRANSCRIPT_WINDOW);
    assert.ok(TRANSCRIPT_WINDOW > 3);
  });

  it('covers whole turns, not half of one', () => {
    assert.equal(TRANSCRIPT_WINDOW % 2, 0, 'a turn is a player entry plus a GM entry');
    assert.ok(TRANSCRIPT_WINDOW / 2 >= 7, 'at least seven complete exchanges');
  });

  it('degrades gracefully on a short transcript', () => {
    assert.equal(windowOf([{ role: 'player', text: 'hi' }]).length, 1);
    assert.deepEqual(windowOf([]), []);
  });
});

describe('memory context', () => {
  const chapters = [
    { title: 'The Vault of Ash', digest: 'You cleared the vault and freed the smith.' },
    { title: 'The Road South',   digest: 'You travelled to Saltmarch and met Mara.' },
  ];

  it('carries every earlier chapter, oldest first', () => {
    const ctx = memoryContext({ chapters, rolling: 'You are searching the chapel.' });
    assert.equal(ctx.chapters.length, 2);
    assert.match(ctx.chapters[0], /Vault of Ash/);
    assert.match(ctx.chapters[1], /Saltmarch/);
    assert.equal(ctx.thisChapter, 'You are searching the chapel.');
  });

  it('orders frozen digests before live memory so the prefix stays cacheable', () => {
    const keys = Object.keys(memoryContext({ chapters, rolling: 'now', events: ['a thing'] }));
    assert.deepEqual(keys, ['chapters', 'thisChapter', 'recently']);
  });

  it('is null before anything has happened', () => {
    assert.equal(memoryContext({}), null);
  });

  it('remembers an hour-2 event at hour 9 — the M1 gate', () => {
    // Nine chapters later, the first chapter's facts are still in the prompt.
    const many = Array.from({ length: 9 }, (_, i) => ({
      title: `Chapter ${i + 1}`,
      digest: i === 0 ? 'Mara the smith told you her brother died in the mine.' : `Events of chapter ${i + 1}.`,
    }));
    const ctx = memoryContext({ chapters: many, rolling: 'You return to the forge.' });
    assert.ok(ctx.chapters.some(c => /brother died in the mine/.test(c)),
      'the GM must still be able to reference what an NPC said hours ago');
  });
});

describe('chapter boundaries', () => {
  const session = { turnCount: 40, chapterStartTurn: 0, chapters: [], chapterId: 'ch-1', rollingDigest: 'so far…' };

  it('freezes the rolling digest into the closed chapter', () => {
    const next = cut(session, 'dungeon-cleared', 'You cleared the vault.');
    assert.equal(next.chapters[0].digest, 'You cleared the vault.');
    assert.equal(next.chapters[0].reason, 'dungeon-cleared');
    assert.equal(next.rollingDigest, null, 'the next chapter starts with a clean slate');
  });

  it('advances the chapter id and start turn', () => {
    const next = cut(session, 'region-changed', 'd');
    assert.equal(next.chapterId, 'ch-2');
    assert.equal(next.chapterStartTurn, 40);
  });

  it('records a contiguous span with no gaps', () => {
    let s = session;
    for (const turn of [40, 90, 130]) {
      s = cut({ ...s, turnCount: turn }, 'safe-rest', `digest ${turn}`);
    }
    assert.equal(s.chapters.length, 3);
    for (let i = 1; i < s.chapters.length; i++) {
      assert.equal(s.chapters[i].startTurn, s.chapters[i - 1].endTurn,
        'chapters must tile the campaign without losing turns');
    }
  });

  it('keeps memory bounded: digests grow per chapter, not per turn', () => {
    let s = { ...session, chapters: [] };
    for (let n = 1; n <= 80; n++) s = cut({ ...s, turnCount: n * 40 }, 'safe-rest', 'x'.repeat(150));
    const bytes = JSON.stringify(memoryContext({ chapters: s.chapters })).length;
    assert.equal(s.chapters.length, 80, '3200 turns of play');
    assert.ok(bytes < 20_000, `80 chapters of memory is ${bytes} bytes — must stay promptable`);
  });
});
