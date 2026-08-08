// src/game/preclassify.js — deterministic intent recognition.
//
// Every turn paid a tiny-tier LLM call to answer "what did the player mean",
// including the turns where the player did not type anything: a chip fires a
// generated command string ("I go north"), and we sent that string to a model
// to be told, at latency and cost, that it meant `move north`. The compass and
// the room chips are ALREADY structured — the classifier was re-deriving what
// the UI knew when it built the button.
//
// preClassify returns a classifier-shaped object when the input is
// unambiguous against THIS scene, and null when it is not. Null is the normal
// case for real prose; the LLM still owns everything interesting. The scene
// check is what keeps it honest — "I go north" is only a move when north is an
// exit that actually exists, otherwise the model gets to explain why not.
//
// Pure: no Spektrum, no DOM, no AI, and no i18n import. `{ t, locale }` is
// passed in by the one caller (ai/classify.js). That is not ceremony — the
// locale bundle imports JSON and reads localStorage, so importing it here
// would have made the matcher untestable under `node --test` and it would have
// been mirrored into a copy of itself instead, which tests nothing.

const DIRECTIONS = ['north', 'south', 'east', 'west'];

// Direction words the player might type, per locale, plus the single-letter
// shorthands every text adventure has trained them to expect.
const DIR_WORDS = {
  en: {
    north: ['north', 'n'], south: ['south', 's'],
    east:  ['east', 'e'],  west:  ['west', 'w'],
  },
  nl: {
    north: ['noord', 'n'], south: ['zuid', 'z'],
    east:  ['oost', 'o'],  west:  ['west', 'w'],
  },
};

// Verbs that mean "move" when followed by a direction.
const GO_VERBS = {
  en: ['go', 'walk', 'head', 'move', 'travel', 'i go', 'i walk', 'i head', 'i move'],
  nl: ['ga', 'loop', 'ik ga', 'ik loop'],
};

const BARE = {
  en: {
    look:      ['look', 'look around', 'observe'],
    wait:      ['wait', 'hold', 'do nothing'],
    inventory: ['inventory', 'inv', 'i'],
    // A long rest is the only thing that returns a caster's slots, so the
    // distinction is mechanical, not flavour. These phrasings are unambiguous
    // enough to recognise here rather than growing the classifier's schema
    // with a field every non-resting turn would still pay for.
    longRest:  ['long rest', 'make camp', 'camp for the night', 'sleep', 'rest for the night'],
    shortRest: ['rest', 'short rest', 'catch my breath'],
  },
  nl: {
    look:      ['kijk', 'kijk rond', 'rondkijken'],
    wait:      ['wacht', 'niets doen'],
    inventory: ['inventaris', 'rugzak'],
    longRest:  ['lange rust', 'kamp opslaan', 'overnachten', 'slapen'],
    shortRest: ['rust', 'korte rust', 'op adem komen'],
  },
};

// Punctuation and case are noise here; a chip's string and a typed string
// should reach the same place.
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[.!?,;:'"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classified(intent, extra = {}) {
  return {
    intent,
    target_id: null,
    direction: null,
    skill:     null,
    dc:        null,
    reason:    'recognized without a model call',
    ...extra,
    // Marks the turn as having skipped the classifier — the debug panel shows
    // it, and a test can assert the bypass actually fired.
    preClassified: true,
  };
}

// The locale tables, falling back to English for a locale we have no words for
// (the chip strings still match exactly, so the bypass keeps working).
function tables(lang) {
  return {
    dirs: DIR_WORDS[lang] ?? DIR_WORDS.en,
    gos:  GO_VERBS[lang]  ?? GO_VERBS.en,
    bare: BARE[lang]      ?? BARE.en,
  };
}

// A direction named anywhere in the input, or null. Requires a whole-word
// match so "northern" and the single-letter forms behave.
function directionIn(text, dirs) {
  const words = text.split(' ');
  for (const dir of DIRECTIONS) {
    for (const word of dirs[dir]) {
      if (words.includes(word)) return dir;
    }
  }
  return null;
}

export function preClassify(input, scene, i18n) {
  const t      = i18n?.t;
  const locale = i18n?.locale;
  if (typeof t !== 'function' || typeof locale !== 'function') {
    throw new TypeError('preClassify requires { t, locale }');
  }

  const text = normalize(input);
  if (!text) return null;

  const { dirs, gos, bare } = tables(locale());
  const exits = scene?.room?.exits ?? [];
  const loot  = (scene?.room?.loot ?? []).filter(i => !i.taken);

  // ── Movement ──────────────────────────────────────────────────────────────
  // Either the compass chip's exact string, a bare direction, or a go-verb plus
  // a direction. The exit has to exist: "I go north" in a room with no north
  // wall is a genuine question for the model, not a move to reject silently.
  for (const dir of DIRECTIONS) {
    if (text === normalize(t('chips.goDir', { dir: t(`directions.${dir}`) }))) {
      if (exits.some(e => e.direction === dir)) return classified('move', { direction: dir });
    }
  }
  const dir = directionIn(text, dirs);
  if (dir && exits.some(e => e.direction === dir)) {
    const words = text.split(' ');
    const isBareDirection = words.length === 1;
    const hasGoVerb = gos.some(v => text.startsWith(`${v} `) || text === v);
    if (isBareDirection || hasGoVerb) return classified('move', { direction: dir });
  }

  // ── Take ──────────────────────────────────────────────────────────────────
  // Matched against the items actually in the room, so the target id is known
  // exactly rather than guessed from a name the model had to echo back.
  for (const item of loot) {
    if (text === normalize(t('chips.takeCmd', { name: item.name }))) {
      return classified('take', { target_id: item.id });
    }
  }

  // ── Unlock ────────────────────────────────────────────────────────────────
  if (text === normalize(t('chips.unlockCmd')) && exits.some(e => e.locked)) {
    return classified('unlock');
  }

  // ── Attack ────────────────────────────────────────────────────────────────
  // Only when there is exactly one living hostile to mean. Two goblins and a
  // bare "I attack" is ambiguous, and ambiguity is what the model is for.
  const hostiles = (scene?.npcs ?? []).filter(n => n.alive && n.attitude === 'hostile');
  if (text === normalize(t('chips.attackCmd')) && hostiles.length === 1) {
    return classified('attack', { target_id: hostiles[0].id });
  }

  // ── Look / wait / inventory ───────────────────────────────────────────────
  // These change nothing a model could get wrong.
  if (text === normalize(t('chips.lookCmd')) || bare.look.includes(text)) return classified('look');
  if (text === normalize(t('chips.waitCmd')) || bare.wait.includes(text)) return classified('wait');
  if (bare.inventory.includes(text)) return classified('inventory');

  // ── Rest ──────────────────────────────────────────────────────────────────
  if (bare.longRest?.includes(text))  return classified('rest', { long: true });
  if (bare.shortRest?.includes(text)) return classified('rest', { long: false });

  return null;
}
