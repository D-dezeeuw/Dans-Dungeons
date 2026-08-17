// === Conversion tools (5.2.0 row) ===
//
// Three converters the roadmap promised, in kernel-honest scope:
//
// 1. Third-party SRD-compatible content importers. A lot of CC/OGL
//    SRD data circulates as JSON with snake_case fields, textual CRs
//    ('1/4') and prose dice ('2d6+3'). `monsterFromJson` and
//    `spellFromJson` map that family of shapes onto kernel records,
//    validating on the way in and REPORTING what they had to guess —
//    an import is a claim about someone else's data, so the report
//    (`{ record, warnings }`) is part of the result, not a log line.
//
// 2. Character migrations across kernel majors. `migrateCharacter` is
//    the stable seam: it inspects a record, applies every migration
//    between its shape and the current one, and reports the changes.
//    As of 3.x NO breaking record change has shipped — the 2.x → 3.x
//    majors were additive — so today it validates and passes through
//    with `changes: []`. The seam exists so a future breaking change
//    lands as a migration HERE instead of a paragraph in release notes.
//
// 3. Save-format conversion: `sessionFromJson` re-validates a
//    serialized Session snapshot (JSON round-trip is the save format)
//    and reports fields it does not recognise, so a host can gate a
//    "load campaign" flow on structured feedback.

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const LONG_ABILITIES = Object.freeze({
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha',
});

/** '1/8' → 0.125, '1/4' → 0.25, '1/2' → 0.5, '3' → 3, 5 → 5. */
export function normalizeCr(cr) {
  if (typeof cr === 'number') return cr;
  if (typeof cr === 'string') {
    const frac = /^(\d+)\/(\d+)$/.exec(cr.trim());
    if (frac) return Number(frac[1]) / Number(frac[2]);
    const n = Number(cr);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const kebab = (s) => String(s).trim().toLowerCase()
  .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// '2d6+3', '2d6 + 3', '1d8' → kernel spec; anything else → null.
const diceSpec = (s) => {
  const m = /^(\d+)d(\d+)\s*([+-]\s*\d+)?$/.exec(String(s).trim());
  if (!m) return null;
  return `${m[1]}d${m[2]}${m[3] ? m[3].replace(/\s+/g, '') : ''}`;
};

/**
 * Import a third-party SRD-style monster JSON (snake_case fields,
 * textual CR, per-ability score fields). Returns `{ record, warnings }`
 * or `{ record: null, warnings }` when identity can't be established.
 */
export function monsterFromJson(json) {
  const warnings = [];
  if (json === null || typeof json !== 'object') {
    return { record: null, warnings: ['input must be an object'] };
  }
  const name = json.name;
  if (typeof name !== 'string' || !name) {
    return { record: null, warnings: ['a monster needs a name'] };
  }
  const id = json.id ?? json.slug ?? kebab(name);

  const cr = normalizeCr(json.cr ?? json.challenge_rating);
  if (cr === null) warnings.push(`unparseable challenge rating '${json.cr ?? json.challenge_rating}' — defaulted to 0`);

  const ac = typeof json.ac === 'number' ? json.ac
    : typeof json.armor_class === 'number' ? json.armor_class
    : Array.isArray(json.armor_class) ? json.armor_class[0]?.value : undefined;
  if (ac === undefined) warnings.push('no armor class — defaulted to 10');

  const hp = typeof json.hp === 'number' ? json.hp
    : typeof json.hit_points === 'number' ? json.hit_points : undefined;
  if (hp === undefined) warnings.push('no hit points — defaulted to 1');

  const abilityScores = {};
  for (const ability of ABILITIES) {
    const long = Object.entries(LONG_ABILITIES).find(([, short]) => short === ability)[0];
    const value = json.abilityScores?.[ability] ?? json[ability] ?? json[long];
    if (typeof value === 'number') abilityScores[ability] = value;
    else { abilityScores[ability] = 10; warnings.push(`no ${ability} score — defaulted to 10`); }
  }

  const speed = typeof json.speed === 'number' ? json.speed
    : typeof json.speed?.walk === 'number' ? json.speed.walk : 30;

  const attacks = [];
  for (const action of json.attacks ?? json.actions ?? []) {
    const bonus = action.attackBonus ?? action.attack_bonus;
    const damage = action.damage ?? diceSpec(action.damage_dice ?? '');
    if (typeof bonus === 'number' && damage) {
      attacks.push({
        name: action.name ?? 'Attack',
        attackBonus: bonus,
        damage,
        ...(action.damageType ?? action.damage_type
          ? { damageType: kebab(action.damageType ?? action.damage_type) } : {}),
      });
    } else if (action.name) {
      warnings.push(`action '${action.name}' skipped (no attack bonus + parseable damage)`);
    }
  }

  const record = {
    id, name, cr: cr ?? 0, ac: ac ?? 10, hp: hp ?? 1,
    size: kebab(json.size ?? 'medium'), speed, abilityScores,
    ...(attacks.length ? { attacks } : {}),
  };
  return { record, warnings };
}

/**
 * Import a third-party SRD-style spell JSON. Same contract:
 * `{ record, warnings }` with the guesses named.
 */
export function spellFromJson(json) {
  const warnings = [];
  if (json === null || typeof json !== 'object') {
    return { record: null, warnings: ['input must be an object'] };
  }
  if (typeof json.name !== 'string' || !json.name) {
    return { record: null, warnings: ['a spell needs a name'] };
  }
  const id = json.id ?? json.slug ?? kebab(json.name);
  let level = json.level;
  if (typeof level === 'string') {
    // 'Cantrip', '3rd-level', '3'
    level = /cantrip/i.test(level) ? 0 : Number(/\d+/.exec(level)?.[0]);
  }
  if (!Number.isInteger(level) || level < 0 || level > 9) {
    warnings.push(`unparseable level '${json.level}' — defaulted to 0`);
    level = 0;
  }
  const school = kebab(json.school?.name ?? json.school ?? '');
  if (!school) warnings.push('no school — left empty');

  const record = { id, name: json.name, level, school };
  const damage = json.damage ?? diceSpec(json.damage_dice ?? '');
  if (damage) record.damage = damage;
  if (json.save) record.save = String(json.save).toLowerCase().slice(0, 3);
  else if (json.dc_type?.name) record.save = LONG_ABILITIES[kebab(json.dc_type.name)] ?? kebab(json.dc_type.name).slice(0, 3);
  if (json.concentration === true || json.concentration === 'yes') record.concentration = true;
  if (json.ritual === true || json.ritual === 'yes') record.ritual = true;
  if (json.range) record.range = String(json.range);
  if (json.duration) record.duration = String(json.duration);
  return { record, warnings };
}

/**
 * Migrate a character record to the current kernel's shape. The
 * migration ledger is keyed by the breaking change that made it
 * necessary; as of 3.x the ledger is EMPTY (2.x → 3.x was additive),
 * so this validates identity and passes through with `changes: []`.
 * The seam is the deliverable: a future breaking change ships its
 * migration here.
 */
export function migrateCharacter(record) {
  if (record === null || typeof record !== 'object') {
    return { record: null, changes: [], errors: ['a character record must be an object'] };
  }
  const errors = [];
  if (typeof record.id !== 'string' || !record.id) errors.push('missing id');
  if (typeof record.speciesId !== 'string' || !record.speciesId) errors.push('missing speciesId');
  if (errors.length) return { record: null, changes: [], errors };
  return { record, changes: [], errors: [] };
}

/**
 * Re-validate a serialized Session snapshot (JSON round-trip IS the
 * save format). Reports unknown top-level fields so a host's load
 * flow can warn instead of silently dropping data from a newer save.
 */
export function sessionFromJson(json) {
  const KNOWN = ['id', 'campaign', 'party', 'encounter', 'clock', 'flags', 'log', 'seed', 'version'];
  if (json === null || typeof json !== 'object') {
    return { snapshot: null, warnings: ['input must be an object'] };
  }
  const warnings = Object.keys(json)
    .filter((k) => !KNOWN.includes(k))
    .map((k) => `unknown field '${k}' (newer save format?) — preserved but unused`);
  return { snapshot: json, warnings };
}
