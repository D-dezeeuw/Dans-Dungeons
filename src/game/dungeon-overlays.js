// src/game/dungeon-overlays.js — pure dungeon-theme → creature-pool data.
//
// Zero imports on purpose so the data is unit-testable in the node test runner
// (worldseed.js, which re-exports this, pulls in the `bag-of-holding` bare
// specifier and can't be imported there).
//
// Each of the 24 dungeon themes maps to an atmosphere sentence + a pool of
// creature IDs (from bestiary.js — SRD or custom). Pools are ordered ascending
// by challenge so the dungeon generator can place weaker creatures near the
// entrance and the highest-CR creature (the last entry) as the vault boss.
// Every id MUST exist in BESTIARY — the bestiary test enforces this.

export const DUNGEON_OVERLAYS = {
  'undead crypt':          { atmosphere: 'The air reeks of embalming salts and grave earth.',                    enemies: ['skeleton', 'zombie', 'ghoul', 'specter', 'wight'] },
  'goblin warren':         { atmosphere: 'Crude markings cover the walls. Something gnaws in the dark.',        enemies: ['kobold', 'goblin', 'worg', 'hobgoblin', 'bugbear'] },
  'cult sanctum':          { atmosphere: 'Candle wax pools on every surface. Chanting echoes from deeper within.', enemies: ['acolyte', 'cultist', 'shadow', 'specter', 'cult-fanatic'] },
  'beast lair':            { atmosphere: 'Claw marks gouge the stone. The stench of animal musk is overwhelming.', enemies: ['giant-rat', 'wolf', 'black-bear', 'dire-wolf', 'owlbear'] },
  'arcane ruin':           { atmosphere: 'Faint runes pulse along the walls. The air crackles with residual magic.', enemies: ['flying-sword', 'animated-armor', 'imp', 'specter', 'gibbering-mouther'] },
  'flooded cavern':        { atmosphere: 'Water drips from the ceiling. The floor is slick and treacherous.',     enemies: ['giant-rat', 'constrictor-snake', 'cave-spider', 'crocodile', 'giant-spider'] },
  'haunted manor':         { atmosphere: 'Dust motes drift through pale light. A door creaks on its own.',       enemies: ['zombie', 'shadow', 'specter', 'ghoul', 'wight'] },
  'abandoned mine':        { atmosphere: 'Rotting timber props sag under the weight of earth. Pickaxes rust in corners.', enemies: ['kobold', 'swarm-of-rats', 'giant-spider', 'ghoul', 'ogre'] },
  'dragon hoard':          { atmosphere: 'Scorch marks blacken the walls. The heat is unnatural.',               enemies: ['kobold', 'skeleton', 'magma-mephit', 'hell-hound', 'young-drake'] },
  'vampire castle':        { atmosphere: 'Velvet drapes hang in tatters. The scent of old blood lingers.',       enemies: ['zombie', 'shadow', 'specter', 'ghoul', 'vampire-spawn'] },
  'elemental nexus':       { atmosphere: 'Sparks of raw energy arc between the walls. The ground hums.',         enemies: ['flying-sword', 'magma-mephit', 'ice-mephit', 'imp', 'will-o-wisp'] },
  'fungal depths':         { atmosphere: 'Bioluminescent mushrooms cast an eerie glow. Spores drift lazily.',    enemies: ['violet-fungus', 'cave-spider', 'fungal-zombie', 'giant-spider', 'myconid-sovereign'] },
  'clockwork vault':       { atmosphere: 'Gears click and whir behind the walls. The floor vibrates rhythmically.', enemies: ['kobold', 'flying-sword', 'animated-armor', 'stone-sentinel'] },
  'planar rift':           { atmosphere: 'Reality shimmers at the edges. Colours that shouldn\'t exist bleed through.', enemies: ['shadow', 'imp', 'specter', 'will-o-wisp', 'gibbering-mouther'] },
  'sunken temple':         { atmosphere: 'Waterlogged stone and barnacle-crusted pillars. Fish bones crunch underfoot.', enemies: ['zombie', 'constrictor-snake', 'crocodile', 'specter', 'ghoul'] },
  'frozen tomb':           { atmosphere: 'Ice coats every surface. Your breath crystallizes instantly.',          enemies: ['skeleton', 'zombie', 'ice-mephit', 'specter', 'wight'] },
  'spider nest':           { atmosphere: 'Silk threads catch the light everywhere. Husks of drained prey line the walls.', enemies: ['spider', 'giant-rat', 'cave-spider', 'giant-spider', 'ankheg'] },
  'bandit fortress':       { atmosphere: 'Crude barricades and stolen goods are piled in every corner.',         enemies: ['bandit', 'scout', 'spy', 'bandit-captain', 'veteran'] },
  'fey glade gone wrong':  { atmosphere: 'Flowers bloom in impossible colours. The laughter you hear isn\'t human.', enemies: ['wolf', 'worg', 'dire-wolf', 'will-o-wisp', 'owlbear'] },
  'demonic hellgate':      { atmosphere: 'The stone is warm to the touch. Symbols of binding cover every surface.', enemies: ['cultist', 'imp', 'cult-fanatic', 'hell-hound', 'lesser-demon'] },
  'ancient library':       { atmosphere: 'Shelves of rotting tomes stretch into shadow. Pages flutter with no wind.', enemies: ['flying-sword', 'shadow', 'animated-armor', 'specter', 'gibbering-mouther'] },
  'petrified giant':       { atmosphere: 'The walls are organic — veins of stone pulse faintly. You\'re inside something.', enemies: ['swarm-of-rats', 'cave-spider', 'animated-armor', 'stone-sentinel'] },
  'living dungeon':        { atmosphere: 'The corridors shift when you\'re not looking. The dungeon is alive.',  enemies: ['violet-fungus', 'shadow', 'animated-armor', 'gibbering-mouther'] },
  'dream prison':          { atmosphere: 'The geometry is wrong. Stairs lead sideways. Gravity is a suggestion.', enemies: ['shadow', 'specter', 'will-o-wisp', 'gibbering-mouther', 'banshee'] },
};
