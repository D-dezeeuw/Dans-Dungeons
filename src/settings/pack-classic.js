// src/settings/pack-classic.js — the game as it already was.
//
// Not a theme: the CURRENT game, restated as a pack. Every content field is
// null, which means "inherit" at each seam — the library's archetype tables,
// the library's dungeon overlays, the base locale bundles, and the narrator
// prompt with an empty voice slot. Mounting it must produce byte-identical
// output to not having packs at all, and a test asserts exactly that.
//
// That is what makes this file load-bearing rather than ceremonial: it is the
// proof that the seams are seams. If classic ever needs a special case
// somewhere, the pack mechanism has a hole in it at that spot.

export const PACK = Object.freeze({
  id: 'classic',
  packVersion: 1,
  era: 'medieval',

  card: {
    en: {
      name: 'Classic Fantasy',
      blurb: 'Crowns, crypts and honest steel. Swords, spells and something old under the hill.',
    },
    nl: {
      name: 'Klassieke Fantasy',
      blurb: 'Kronen, grafkelders en eerlijk staal. Zwaarden, spreuken en iets ouds onder de heuvel.',
    },
  },

  // Inherit everything the library ships.
  tables: null,
  themeClimates: null,
  bandSettlements: null,
  syllables: null,
  overlays: null,
  domainTreasures: null,
  domainKeys: null,
  classSkins: null,
  speciesSkins: null,
  i18n: null,

  // No voice block: the narrator and dialogue prompts render their voice slot
  // empty and read exactly as they did before packs existed.
  voice: null,
  promptLine: null,

  // The one field with content — moved here verbatim from src/ai/narrate.js,
  // which used to hold the sketch style as a literal. A cyberpunk campaign
  // asking that prompt for a scene would have got a castle.
  imageStyle:
    'Old hand-drawn journal sketch of a medieval fantasy scene. ' +
    'Black ink lines on sepia parchment paper. Rough, scratchy linework. ' +
    'No colour — only shades of sepia and black ink. Like an adventurer\'s field journal. ' +
    'No text, no labels, no writing of any kind. No borders, no frames, no decorative edges.',
});
