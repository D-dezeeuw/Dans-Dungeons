// Beat shape supports linear walking today and branching tomorrow.
// `successors[]` is present in the schema but ignored by the v1
// runtime — having the field already accepted by the validator
// means authoring tools can populate it now without later schema
// migrations.

/**
 * The vocabulary of NPC functional roles a beat can request. Kept
 * deliberately short so an author doesn't need a dramaturgy degree
 * to describe a beat — each role names *what the NPC does to the
 * story*, not who they are.
 */
export const ARCHETYPE_ROLES = Object.freeze([
  'authority',
  'antagonist',
  'informant',
  'mentor',
  'fixer',
  'muscle',
  'herald'
]);

const REQUIRED_FIELDS = ['id', 'dramaticPurpose', 'targetPlaytimeMinutes', 'setRequiredFlags'];

/**
 * Hand-rolled validator instead of a schema library because the
 * engine ships zero runtime deps — 30 lines of validation are
 * cheaper than depending on Zod or Joi.
 *
 * Returns `{ valid, errors[] }` so authoring tools can render every
 * problem at once; throwing on the first error would force authors
 * into a fix-one-at-a-time loop and would surface in the UI as a
 * cryptic crash rather than an actionable error list.
 */
export function validateBeat(beat) {
  const errors = [];
  if (beat === null || typeof beat !== 'object') {
    return { valid: false, errors: ['beat must be an object'] };
  }
  for (const key of REQUIRED_FIELDS) {
    if (beat[key] === undefined) errors.push(`Missing required field: ${key}`);
  }
  if (beat.id !== undefined && typeof beat.id !== 'string') {
    errors.push('id must be a string');
  }
  if (beat.targetPlaytimeMinutes !== undefined && typeof beat.targetPlaytimeMinutes !== 'number') {
    errors.push('targetPlaytimeMinutes must be a number');
  }
  for (const arrayField of ['prerequisites', 'setRequiredFlags', 'fallbackLocations', 'requiredArchetypes', 'successors']) {
    if (beat[arrayField] !== undefined && !Array.isArray(beat[arrayField])) {
      errors.push(`${arrayField} must be an array`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Factory with predictable defaults. The returned object is fresh
 * each call so authoring tools and tests can mutate it freely
 * without worrying about shared-prototype contamination.
 *
 * `dramaticPurpose: ''` is intentionally falsy: it's a required
 * field per `validateBeat`, so a freshly-created beat fails
 * validation until the author writes one. That nudges the author
 * to articulate *why* a beat exists before the runtime accepts it.
 */
export function makeEmptyBeat(id) {
  return {
    id,
    dramaticPurpose: '',
    targetPlaytimeMinutes: 30,
    prerequisites: [],
    setRequiredFlags: [],
    preferredLocation: null,
    fallbackLocations: [],
    requiredArchetypes: [],
    boundEntities: {},
    successors: []
  };
}

// Re-export thread surface so beats/index.js gets pushSubThread
// and subThreadDepth without explicit listing here. The runtime
// pieces live in thread.js; schema.js stays the data shape.
