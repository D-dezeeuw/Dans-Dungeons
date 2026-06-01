// src/ai/openrouter.js — re-export barrel (backward compatibility).
// Import from the specific modules directly for new code.

export { CLASSIFIER_SCHEMA, NARRATOR_SCHEMA } from './schemas.js';
export { checkKey, chatCompletion }           from './client.js';
export { classify }                           from './classify.js';
export { narrate, generateSceneImage }        from './narrate.js';
