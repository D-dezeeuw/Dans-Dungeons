// Brassgear — the second setting pack (3.1.0): magitech-noir at
// city-state scope, with one defining twist: THE MAGIC IS DYING. The
// Last Concord War bled the world's arcane reserves; what's left runs
// the lifts and the streetlamps on a falling pressure gauge. PCs are
// scavengers in the wreckage of a magical-industrial peak — bankrupt
// talent-houses, decaying constructs, black-market schematics.
//
// Mounts through the same 3.0.0 setting slots Sundermark established.
// All names invented (docs/legal.md; swept by tests/legal.test.js).

// ── Five city-states (regions), each with its seat ──────────────────────

export const BRASSGEAR_REGIONS = Object.freeze({
  'the-brasswork': Object.freeze({
    id: 'the-brasswork', name: 'The Brasswork',
    biome: 'industrial-capital',
    summary: 'The old capital, still lit — barely. The great engines run at a sixth of pressure and the talent-houses bill each other for the difference.',
    cities: Object.freeze(['brasswork-city']),
    dangers: Object.freeze(['pressure-riots', 'house-bailiffs', 'engine-ghosts']),
  }),
  'gutterlight': Object.freeze({
    id: 'gutterlight', name: 'Gutterlight',
    biome: 'sprawl',
    summary: 'The city that grew in the capital\'s shadow to strip its scrap. Everything is for sale twice; the second buyer gets the real one.',
    cities: Object.freeze(['gutterlight-yards']),
    dangers: Object.freeze(['scrap-barons', 'salvage-gangs', 'counterfeit-charms']),
  }),
  'the-pale-exchange': Object.freeze({
    id: 'the-pale-exchange', name: 'The Pale Exchange',
    biome: 'freeport',
    summary: 'The neutral port where the war never officially happened. Schematics, talents and testimony trade in sealed envelopes.',
    cities: Object.freeze(['exchange-harbor']),
    dangers: Object.freeze(['envelope-men', 'tariff-cutters', 'the-neutrality-office']),
  }),
  'cinder-quay': Object.freeze({
    id: 'cinder-quay', name: 'Cinder Quay',
    biome: 'ruined-arsenal',
    summary: 'The war\'s arsenal, burned in the armistice hour by its own engineers. The quay still smoulders where the reserves went up.',
    cities: Object.freeze(['the-quay-camps']),
    dangers: Object.freeze(['unspent-ordnance', 'ash-lung', 'reclamation-crews']),
  }),
  'the-greenmist-fen': Object.freeze({
    id: 'the-greenmist-fen', name: 'The Greenmist Fen',
    biome: 'contaminated-wetland',
    summary: 'Where the spilled arcane reserves pooled. The mist grows things that remember being spells, and the fen-farms harvest them.',
    cities: Object.freeze(['fenworks']),
    dangers: Object.freeze(['the-greenmist', 'spell-blights', 'harvest-quotas']),
  }),
});

export const BRASSGEAR_CITIES = Object.freeze({
  'brasswork-city': Object.freeze({
    id: 'brasswork-city', name: 'Brasswork City', regionId: 'the-brasswork',
    size: 'city', ruler: 'the-house-concord',
    hooks: Object.freeze(['the-sixth-gauge', 'the-heirloom-audit']),
  }),
  'gutterlight-yards': Object.freeze({
    id: 'gutterlight-yards', name: 'The Gutterlight Yards', regionId: 'gutterlight',
    size: 'city', ruler: 'the-scrap-barons',
    hooks: Object.freeze(['the-honest-forgery', 'the-lift-that-fell']),
  }),
  'exchange-harbor': Object.freeze({
    id: 'exchange-harbor', name: 'Exchange Harbor', regionId: 'the-pale-exchange',
    size: 'city', ruler: 'the-neutrality-office',
    hooks: Object.freeze(['the-sealed-envelope', 'the-defectors-price']),
  }),
  'the-quay-camps': Object.freeze({
    id: 'the-quay-camps', name: 'The Quay Camps', regionId: 'cinder-quay',
    size: 'town', ruler: 'reclamation-warden-tache',
    hooks: Object.freeze(['the-unspent-shell', 'the-armistice-hour']),
  }),
  'fenworks': Object.freeze({
    id: 'fenworks', name: 'Fenworks', regionId: 'the-greenmist-fen',
    size: 'town', ruler: 'the-harvest-combine',
    hooks: Object.freeze(['the-greenmist-heist-hook', 'the-quota-riot']),
  }),
});

// ── The inherited-talent system ─────────────────────────────────────────
//
// Brassgear's dragonmark-equivalent: six bloodline talents, each owned
// by a bankrupt house that once ran an industry on it. A talent is DATA
// — `grants` uses the same structured-flag contract feats use; the
// host stamps `talentId` on an actor and reads the grants.

export const BRASSGEAR_TALENTS = Object.freeze({
  'the-kindling': Object.freeze({
    id: 'the-kindling', name: 'The Kindling', house: 'House Brandt',
    industry: 'engine-firing',
    grants: Object.freeze({ igniteWithATouch: true, resistFire: true }),
  }),
  'the-meridian': Object.freeze({
    id: 'the-meridian', name: 'The Meridian', house: 'House Voss',
    industry: 'navigation',
    grants: Object.freeze({ alwaysKnowNorth: true, advantageOnSkill: 'survival' }),
  }),
  'the-ledgerhand': Object.freeze({
    id: 'the-ledgerhand', name: 'The Ledgerhand', house: 'House Marrow',
    industry: 'contracts',
    grants: Object.freeze({ senseLiesInWriting: true, advantageOnSkill: 'investigation' }),
  }),
  'the-quiet-palm': Object.freeze({
    id: 'the-quiet-palm', name: 'The Quiet Palm', house: 'House Sable',
    industry: 'security',
    grants: Object.freeze({ openMundaneLocksByTouch: true, advantageOnSkill: 'sleight-of-hand' }),
  }),
  'the-green-thumbprint': Object.freeze({
    id: 'the-green-thumbprint', name: 'The Green Thumbprint', house: 'House Fenn',
    industry: 'fen-harvesting',
    grants: Object.freeze({ safePassageInGreenmist: true, advantageOnSkill: 'nature' }),
  }),
  'the-still-voice': Object.freeze({
    id: 'the-still-voice', name: 'The Still Voice', house: 'House Coyle',
    industry: 'construct-drovers',
    grants: Object.freeze({ commandInertConstructs: true, advantageOnSkill: 'persuasion' }),
  }),
});

// ── The Tinker: an artificer-equivalent via the Mechanics surface ───────
//
// The roadmap's promise: no new top-level class. The Tinker is a graft
// onto the wizard chassis through the Phase A.2 plugin surface —
// `extraMechanics` handlers + an `extraResources` charge pool:
//
//   createEngine({
//     extraMechanics: BRASSGEAR_TINKER.mechanics,
//     extraResources: BRASSGEAR_TINKER.resources,
//   })
//
// `infuseDevice` spends an infusion charge to stamp a device tag on an
// item id; `overclock` trades a charge for advantage-flavored payload
// the host applies. Handlers are pure (actor in, envelope out) like
// every class mechanic.

export const BRASSGEAR_TINKER = Object.freeze({
  classId: 'wizard',
  mechanics: Object.freeze({
    wizard: Object.freeze({
      infuseDevice(actor, { itemId } = {}) {
        if (!itemId) return { ok: false, reason: 'infuseDevice needs an itemId' };
        const pool = actor.resources?.['infusion-charges'];
        if (!pool || pool.used >= pool.max) {
          return { ok: false, reason: 'no infusion charges remaining' };
        }
        const infused = { ...(actor.infusedDevices ?? {}), [itemId]: true };
        return {
          ok: true,
          actor: {
            ...actor,
            infusedDevices: infused,
            resources: {
              ...actor.resources,
              'infusion-charges': { ...pool, used: pool.used + 1 },
            },
          },
        };
      },
      overclock(actor, { itemId } = {}) {
        if (!actor.infusedDevices?.[itemId]) {
          return { ok: false, reason: 'overclock requires an infused device' };
        }
        const pool = actor.resources?.['infusion-charges'];
        if (!pool || pool.used >= pool.max) {
          return { ok: false, reason: 'no infusion charges remaining' };
        }
        return {
          ok: true,
          effect: { advantageOnNextUse: itemId },
          actor: {
            ...actor,
            resources: {
              ...actor.resources,
              'infusion-charges': { ...pool, used: pool.used + 1 },
            },
          },
        };
      },
    }),
  }),
  resources: Object.freeze({
    wizard: Object.freeze({
      'infusion-charges': Object.freeze({ max: 3, refreshes: 'long' }),
    }),
  }),
});

// ── Origins ─────────────────────────────────────────────────────────────

const E = (e) => Object.freeze(e);

export const BRASSGEAR_SPECIES = Object.freeze({
  cogborn: {
    id: 'cogborn', name: 'Cogborn', size: 'medium', speed: 30,
    traits: ['Construct Ancestry', 'Does Not Breathe', 'Darkvision 60ft', 'Winding Down'],
    effects: E({
      darkvisionFt: 60,
      damageResistances: Object.freeze(['poison']),
      flags: E({ constructAncestry: true, doesNotBreathe: true, windingDown: true })
    })
  },
});

export const BRASSGEAR_BACKGROUNDS = Object.freeze({
  'salvage-broker': {
    id: 'salvage-broker', name: 'Salvage Broker',
    abilityScores: ['dex', 'int', 'cha'],
    skillProficiencies: ['investigation', 'persuasion'],
    toolProficiency: 'tinkers-tools',
    originFeat: { id: 'sparkwright' }
  },
  'talent-house-scion': {
    id: 'talent-house-scion', name: 'Talent-House Scion',
    abilityScores: ['int', 'wis', 'cha'],
    skillProficiencies: ['history', 'insight'],
    toolProficiency: 'calligrapher-supplies',
    originFeat: { id: 'house-remembered' }
  },
});

export const BRASSGEAR_FEATS = Object.freeze({
  'sparkwright': {
    id: 'sparkwright', name: 'Sparkwright', category: 'origin',
    grants: {
      repairConstructsAsHealersKit: true,
      advantageOnSkill: 'investigation'
    }
  },
  'house-remembered': {
    id: 'house-remembered', name: 'House-Remembered', category: 'origin',
    grants: {
      inheritedTalentSlot: true,
      advantageOnSkill: 'history'
    }
  },
});
