// src/ai/validate.js — check what the model sent back against what we asked for.
//
// Every structured call ships a JSON schema and then trusts the answer. `strict`
// json_schema is a request, not a guarantee: providers vary, fallback models
// vary more, and a schema-bound call that walks the tier's fallback chain can
// land on a model that honours it loosely or not at all. When that happens the
// failure is silent and downstream — an intent outside the enum falls through
// every resolver branch to "impossible", a missing `narration` renders as
// `undefined`, a DC of null becomes NaN in a comparison — and it surfaces as a
// weird turn, not as an error anyone can trace back here.
//
// So: validate on receipt, coerce what can be coerced, and fall back to a value
// that is defined and safe. Never throw. A turn with a degraded classification
// is a worse turn; a turn that throws is no turn at all.
//
// Dependency-free: schemas in, object in, object out. Testable under node.

// Report, don't throw. The host wires this to console/telemetry; the tests
// assert on it, which is how a provider quietly breaking its contract becomes
// visible instead of becoming folklore.
let _onViolation = null;
export function onSchemaViolation(fn) { _onViolation = fn; }
function violation(where, detail) {
  try { _onViolation?.(where, detail); } catch { /* a reporter owns its errors */ }
}

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
// An array passes `typeof === 'object'` and would then read every field as
// undefined, quietly producing a "valid" result out of nothing.
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// Numbers arrive as strings often enough to be worth coercing rather than
// discarding — "15" is unambiguously the DC the model meant.
function asNumber(v) {
  if (isNum(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];      // a single object where a list was asked for is a common miss
}

// ─── Classifier ──────────────────────────────────────────────────────────────

// An intent outside the enum reaches no resolver branch and lands on the
// narrator to improvise — the exact fiction-versus-state drift the deterministic
// layer exists to prevent. `look` is the safe landing: it changes nothing, and
// the narrator describes the scene rather than inventing an outcome.
export function validateClassification(out, { intents, clampDc }) {
  const safe = {
    intent:    'look',
    target_id: null,
    direction: null,
    skill:     null,
    spell_id:  null,
    spellId:   null,
    dc:        null,
    reason:    'the classifier returned nothing usable',
    invalid:   true,
  };
  if (!isObj(out)) {
    violation('classifier', 'response was not an object');
    return safe;
  }

  let intent = isStr(out.intent) ? out.intent.trim().toLowerCase() : null;
  if (!intent || !intents.includes(intent)) {
    violation('classifier', `intent '${out.intent}' is not in the schema enum`);
    intent = 'look';
  }

  const DIRECTIONS = ['north', 'south', 'east', 'west'];
  let direction = isStr(out.direction) ? out.direction.trim().toLowerCase() : null;
  if (direction && !DIRECTIONS.includes(direction)) {
    violation('classifier', `direction '${out.direction}' is not a cardinal direction`);
    direction = null;
  }
  // A move with no direction cannot be resolved; it is a look at what is here.
  if (intent === 'move' && !direction) {
    violation('classifier', 'move without a direction');
    intent = 'look';
  }

  const spellId = isStr(out.spell_id) ? out.spell_id.trim() : (isStr(out.spellId) ? out.spellId.trim() : null);

  return {
    intent,
    target_id: isStr(out.target_id) ? out.target_id : null,
    direction,
    skill:     isStr(out.skill) ? out.skill.trim().toLowerCase() : null,
    spell_id:  spellId,
    spellId,
    dc:        clampDc ? clampDc(asNumber(out.dc)) : asNumber(out.dc),
    reason:    isStr(out.reason) ? out.reason : '',
  };
}

// ─── Narrator ────────────────────────────────────────────────────────────────

// The one field the UI cannot do without. A missing narration used to render
// the string "undefined" into the transcript and then into the save, where the
// journal and the world bible both read it back as if it were prose.
export function validateNarration(out, { fallback }) {
  if (!isObj(out) || !isStr(out.narration)) {
    violation('narrator', 'no narration field in the response');
    return { narration: fallback, invalid: true };
  }
  return { ...out, narration: out.narration };
}

// ─── Beat check ──────────────────────────────────────────────────────────────

// A non-boolean `fulfilled` used to be truthy for the string "false".
export function validateBeatCheck(out) {
  if (!isObj(out)) return { fulfilled: false, reason: '' };
  const raw = out.fulfilled;
  const fulfilled = raw === true || raw === 'true';
  if (typeof raw !== 'boolean' && raw != null) violation('beatCheck', `fulfilled was ${typeof raw} '${raw}'`);
  return { fulfilled, reason: isStr(out.reason) ? out.reason : '' };
}

// ─── Acts ────────────────────────────────────────────────────────────────────

// A generated act with no beats is not an act; adopting one would leave the
// campaign with a title, a premise, and nothing to do.
export function validateAct(out) {
  if (!isObj(out)) { violation('act', 'response was not an object'); return null; }
  const beats = asArray(out.beats)
    .filter(b => isObj(b) && isStr(b.id) && isStr(b.dramaticPurpose))
    .map(b => ({
      id:              b.id.trim(),
      title:           isStr(b.title) ? b.title : b.id,
      dramaticPurpose: b.dramaticPurpose,
      location:        isStr(b.location) ? b.location : null,
      requires:        asArray(b.requires).filter(isStr),
      completesOn:     asArray(b.completesOn).filter(isStr),
    }));

  if (!beats.length) { violation('act', 'act had no usable beats'); return null; }

  // Duplicate ids make `requires` ambiguous and completion non-deterministic.
  const seen = new Set();
  const unique = beats.filter(b => (seen.has(b.id) ? (violation('act', `duplicate beat id '${b.id}'`), false) : seen.add(b.id)));

  // Setups are optional foreshadowing; a paysInto that names no beat in THIS
  // act is kept (it may pay into a later act) but normalised to a string/null.
  const setups = asArray(out.setups)
    .filter(s => isObj(s) && isStr(s.clue))
    .map(s => ({ clue: s.clue, paysInto: isStr(s.paysInto) ? s.paysInto : null }))
    .slice(0, 4);

  return {
    title:   isStr(out.title)   ? out.title   : 'Untitled Act',
    premise: isStr(out.premise) ? out.premise : '',
    beats:   unique,
    setups,
  };
}

// ─── Journal / world bible ───────────────────────────────────────────────────

// Chapters with no text render as blank pages in an EPUB, which is worse than
// having one chapter fewer.
export function validateChapters(out, { fallbackTitle }) {
  if (!isObj(out)) { violation('journal', 'response was not an object'); return null; }
  const chapters = asArray(out.chapters)
    .filter(c => isObj(c) && isStr(c.text))
    .map((c, i) => ({ heading: isStr(c.heading) ? c.heading : `Chapter ${i + 1}`, text: c.text }));
  if (!chapters.length) { violation('journal', 'no usable chapters'); return null; }
  return { title: isStr(out.title) ? out.title : fallbackTitle, chapters };
}
