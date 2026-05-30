// SRD 5.2 species — size, speed, signature traits.
// Ability score increases come from backgrounds (see backgrounds.js),
// not species, per the 5.2 character-creation rules.

export default {
  human:      { id: 'human',      name: 'Human',      size: 'medium', speed: 30, traits: ['Resourceful', 'Skillful', 'Versatile'] },
  elf:        { id: 'elf',        name: 'Elf',        size: 'medium', speed: 30, traits: ['Darkvision 60ft', 'Fey Ancestry', 'Keen Senses', 'Trance'] },
  dwarf:      { id: 'dwarf',      name: 'Dwarf',      size: 'medium', speed: 30, traits: ['Darkvision 120ft', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'] },
  halfling:   { id: 'halfling',   name: 'Halfling',   size: 'small',  speed: 30, traits: ['Brave', 'Halfling Nimbleness', 'Luck', 'Naturally Stealthy'] },
  dragonborn: { id: 'dragonborn', name: 'Dragonborn', size: 'medium', speed: 30, traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance', 'Draconic Flight (L5)'] },
  gnome:      { id: 'gnome',      name: 'Gnome',      size: 'small',  speed: 30, traits: ['Darkvision 60ft', 'Gnomish Cunning'] },
  goliath:    { id: 'goliath',    name: 'Goliath',    size: 'medium', speed: 35, traits: ['Giant Ancestry', 'Powerful Build', 'Large Form (L5)'] },
  orc:        { id: 'orc',        name: 'Orc',        size: 'medium', speed: 30, traits: ['Adrenaline Rush', 'Darkvision 120ft', 'Powerful Build', 'Relentless Endurance'] },
  tiefling:   { id: 'tiefling',   name: 'Tiefling',   size: 'medium', speed: 30, traits: ['Darkvision 60ft', 'Fiendish Legacy', 'Otherworldly Presence'] }
};
