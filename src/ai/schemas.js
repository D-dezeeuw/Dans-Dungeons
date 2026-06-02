// src/ai/schemas.js — JSON schema constants for structured AI outputs.

export const CLASSIFIER_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['attack', 'skill', 'talk', 'move', 'take', 'unlock', 'look', 'inventory', 'wait', 'impossible', 'meta'],
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
