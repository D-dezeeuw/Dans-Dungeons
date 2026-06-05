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
      enum: ['attack', 'skill', 'talk', 'move', 'take', 'unlock', 'look', 'inventory', 'wait', 'travel', 'rest', 'buy', 'impossible', 'meta'],
    },
    target_id:  { type: ['string', 'null'] },
    direction:  { type: ['string', 'null'] },
    skill:      { type: ['string', 'null'] },
    dc:         { type: ['number', 'null'] },
    reason:     { type: 'string' },
  },
  required: ['intent', 'target_id', 'direction', 'skill', 'dc', 'reason'],
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
