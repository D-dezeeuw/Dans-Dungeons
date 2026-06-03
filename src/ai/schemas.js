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

// ─── Worldgen schemas ────────────────────────────────────────────────────────

export const WORLD_SEED_SCHEMA = {
  type: 'object',
  properties: {
    name:     { type: 'string' },
    tone:     { type: 'string', enum: ['grimdark', 'heroic', 'mysterious'] },
    creation: { type: 'string' },
    gods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name:   { type: 'string' },
          domain: { type: 'string' },
        },
        required: ['name', 'domain'],
        additionalProperties: false,
      },
    },
    redThread: {
      type: 'object',
      properties: {
        premise: { type: 'string' },
        hook:    { type: 'string' },
      },
      required: ['premise', 'hook'],
      additionalProperties: false,
    },
    digest: { type: 'string' },
  },
  required: ['name', 'tone', 'creation', 'gods', 'redThread', 'digest'],
  additionalProperties: false,
};

export const REGION_SCHEMA = {
  type: 'object',
  properties: {
    id:             { type: 'string' },
    name:           { type: 'string' },
    climate:        { type: 'string' },
    description:    { type: 'string' },
    settlementName: { type: 'string' },
    dungeonName:    { type: 'string' },
    rumor:          { type: 'string' },
    adjacentHints: {
      type: 'array',
      items: { type: 'string' },
    },
    digest: { type: 'string' },
  },
  required: ['id', 'name', 'climate', 'description', 'settlementName', 'dungeonName', 'rumor', 'adjacentHints', 'digest'],
  additionalProperties: false,
};

export const SETTLEMENT_SCHEMA = {
  type: 'object',
  properties: {
    id:          { type: 'string' },
    name:        { type: 'string' },
    description: { type: 'string' },
    npcs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:        { type: 'string' },
          name:      { type: 'string' },
          role:      { type: 'string', enum: ['innkeeper', 'questgiver', 'merchant', 'guard', 'elder'] },
          attitude:  { type: 'string', enum: ['friendly', 'neutral', 'suspicious'] },
          greeting:  { type: 'string' },
          questHook: { type: ['string', 'null'] },
        },
        required: ['id', 'name', 'role', 'attitude', 'greeting', 'questHook'],
        additionalProperties: false,
      },
    },
    exits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          direction:  { type: 'string' },
          targetName: { type: 'string' },
          targetType: { type: 'string', enum: ['dungeon', 'road', 'wilderness'] },
          targetId:   { type: ['string', 'null'] },
        },
        required: ['direction', 'targetName', 'targetType', 'targetId'],
        additionalProperties: false,
      },
    },
    digest: { type: 'string' },
  },
  required: ['id', 'name', 'description', 'npcs', 'exits', 'digest'],
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
