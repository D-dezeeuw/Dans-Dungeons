// src/ai/schemas.js — JSON schema constants for structured gameplay AI outputs.
//
// The WORLDGEN schemas (world seed, region, NPC, faction, beat, settlement) now
// live in @zeeuw/bag-of-holding-client (worldgen/schemas.js) alongside the
// pipeline that consumes them; worldgen.js imports them from there. This file
// keeps the per-turn gameplay schemas (classifier, dialogue, narrator, journal).

export const CLASSIFIER_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      // 'flee' and 'use' are resolved mechanically (opposed check, consumables);
      // every intent here either changes the world or is marked noEffect by the
      // resolver, so the narrator is never left to improvise a state change.
      enum: ['attack', 'cast', 'skill', 'talk', 'move', 'take', 'unlock', 'look', 'inventory',
             'wait', 'travel', 'rest', 'buy', 'flee', 'use', 'impossible', 'meta'],
    },
    target_id:  { type: ['string', 'null'] },
    direction:  { type: ['string', 'null'] },
    skill:      { type: ['string', 'null'] },
    // The spell the player named, for `cast`. Matched against what they
    // actually have prepared — a spell they don't have comes back as a refusal
    // with the reason, not as an improvised success.
    spell_id:   { type: ['string', 'null'] },
    dc:         { type: ['number', 'null'] },
    reason:     { type: 'string' },
  },
  required: ['intent', 'target_id', 'direction', 'skill', 'spell_id', 'dc', 'reason'],
  additionalProperties: false,
};

// Settlement-mode intent classifier (Phase 2). Maps free-text town input to a
// structured action. `target` names an NPC, an exit, or an item depending on
// the intent (the resolver matches it by name/id/role).
export const SETTLEMENT_CLASSIFIER_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['talk', 'buy', 'travel', 'rest', 'look', 'quest', 'inventory', 'meta'],
    },
    target: { type: ['string', 'null'] },
    reason: { type: 'string' },
  },
  required: ['intent', 'target', 'reason'],
  additionalProperties: false,
};

// One NPC dialogue turn (Phase 2). `reply` is the in-character line; when the
// player has earned it (enough probing), the model may set `revealsSecret`.
export const DIALOGUE_SCHEMA = {
  type: 'object',
  properties: {
    reply:         { type: 'string' },
    revealsSecret: { type: 'boolean' },
  },
  required: ['reply', 'revealsSecret'],
  additionalProperties: false,
};

// Beat-completion check (Phase 4.4): did the latest narration fulfil the
// current story beat's dramatic purpose?
export const BEAT_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    fulfilled: { type: 'boolean' },
    reason:    { type: 'string' },
  },
  required: ['fulfilled', 'reason'],
  additionalProperties: false,
};

export const JOURNAL_SCHEMA = {
  type: 'object',
  properties: {
    title:    { type: 'string' },
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          heading: { type: 'string' },
          text:    { type: 'string' },
        },
        required: ['heading', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'chapters'],
  additionalProperties: false,
};

export const AUTOPLAY_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string' },
  },
  required: ['action'],
  additionalProperties: false,
};

export const NARRATOR_SCHEMA = {
  type: 'object',
  properties: {
    narration:     { type: 'string' },
    combat_ended:  { type: 'boolean' },
    outcome:       { type: 'string', enum: ['continue', 'victory', 'defeat', 'flee'] },
  },
  required: ['narration', 'combat_ended', 'outcome'],
  additionalProperties: false,
};

// Canon extraction (Epic E2). After each narration, the tiny tier pulls out the
// durable claims the GM just made so they become world facts instead of prose
// that scrolls away. Deliberately narrow: `target` must be an id the scene
// already knows, or the extractor must ask for a new entity via `mint`, which
// the host validates before anything is created.
export const CANON_SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target:  { type: 'string' },
          path:    { type: 'string', enum: ['condition', 'state', 'description', 'mood', 'attitude', 'note'] },
          value:   { type: 'string' },
          because: { type: 'string' },
          scope:   { type: 'string', enum: ['local', 'regional'] },
        },
        required: ['target', 'path', 'value', 'because', 'scope'],
        additionalProperties: false,
      },
    },
    mint: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind:     { type: 'string', enum: ['npc', 'creature', 'detail', 'site'] },
          name:     { type: 'string' },
          note:     { type: 'string' },
          threat:   { type: 'boolean' },
          creature: { type: 'string' },
        },
        required: ['kind', 'name', 'note', 'threat', 'creature'],
        additionalProperties: false,
      },
    },
  },
  required: ['facts', 'mint'],
  additionalProperties: false,
};

// Act generation (Epic E7.S2). The next act is generated at the transition,
// conditioned on what actually happened — so a memorable side thread can be
// promoted into the main line, and planted clues get paid off.
export const ACT_SCHEMA = {
  type: 'object',
  properties: {
    title:   { type: 'string' },
    premise: { type: 'string' },
    beats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:              { type: 'string' },
          title:           { type: 'string' },
          dramaticPurpose: { type: 'string' },
          location:        { type: ['string', 'null'] },
          requires:        { type: 'array', items: { type: 'string' } },
          // Mechanical flags that complete this beat outright. When the dice
          // already decided the beat happened, asking a model whether it did is
          // a paid call to confirm something the game knows — and a judge that
          // keeps answering "no" can freeze a campaign indefinitely.
          completesOn:     { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'dramaticPurpose', 'location', 'requires', 'completesOn'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'premise', 'beats'],
  additionalProperties: false,
};
