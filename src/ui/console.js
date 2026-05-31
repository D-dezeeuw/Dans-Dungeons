// src/ui/console.js
//
// All DOM reads and writes live here. The loop calls these functions;
// this module never touches the AI or Spektrum directly.

// ─── Input history ────────────────────────────────────────────────────────────
// Stores player-submitted strings for UP/DOWN recall. Newest at the end.
// _historyCursor = -1 means "not browsing"; goes from len-1 (newest) down to 0.
const _history = [];
let   _historyCursor = -1;
let   _historyDraft  = ''; // preserves in-progress text when UP is first pressed

const transcriptEl  = () => document.getElementById('transcript');
const pcStatsEl     = () => document.getElementById('pc-stats');
const enemyStatsEl  = () => document.getElementById('enemy-stats');
const actionChipsEl = () => document.getElementById('action-chips');
const cmdEl         = () => document.getElementById('cmd');

let _resolveInput = null;

// ─── Input wiring ─────────────────────────────────────────────────────────────
// ES modules are deferred — the DOM is ready by the time this runs.

const inputRowEl = () => document.getElementById('input-row');

cmdEl().addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') {
    if (!_history.length || cmdEl().disabled) return;
    e.preventDefault();
    if (_historyCursor === -1) {
      _historyDraft  = cmdEl().value;   // save whatever is typed so far
      _historyCursor = _history.length - 1;
    } else if (_historyCursor > 0) {
      _historyCursor--;
    }
    cmdEl().value = _history[_historyCursor];
    cmdEl().setSelectionRange(cmdEl().value.length, cmdEl().value.length);
    return;
  }

  if (e.key === 'ArrowDown') {
    if (_historyCursor === -1 || cmdEl().disabled) return;
    e.preventDefault();
    if (_historyCursor < _history.length - 1) {
      _historyCursor++;
      cmdEl().value = _history[_historyCursor];
    } else {
      _historyCursor = -1;
      cmdEl().value  = _historyDraft;
    }
    cmdEl().setSelectionRange(cmdEl().value.length, cmdEl().value.length);
    return;
  }

  if (e.key !== 'Enter') return;
  const val = cmdEl().value.trim();
  cmdEl().value = '';
  _historyCursor = -1;
  _historyDraft  = '';
  if (val) _history.push(val);   // record non-empty submissions
  if (_resolveInput) {
    const fn  = _resolveInput;
    _resolveInput = null;
    setInputEnabled(false);
    fn(val);   // empty string is allowed — callers decide if it's valid
  }
});

// Toggle .active class on input-row to drive the blinking cursor CSS.
cmdEl().addEventListener('focus', () => inputRowEl()?.classList.add('active'));
cmdEl().addEventListener('blur',  () => inputRowEl()?.classList.remove('active'));

// Clicking the transcript focuses the input so typing always lands there.
transcriptEl().addEventListener('click', () => {
  if (!cmdEl().disabled) cmdEl().focus();
});

function setInputEnabled(on, placeholder = 'What do you do?') {
  const el = cmdEl();
  el.disabled = !on;
  if (on) {
    el.placeholder = placeholder;
    el.focus();
  } else {
    el.placeholder = '…';
  }
}

// ─── Transcript helpers ───────────────────────────────────────────────────────

export function clear() {
  // Preserve non-entry children (e.g. #scene-image-panel) — only remove entries.
  transcriptEl().querySelectorAll('.entry').forEach(e => e.remove());
}

export function appendEntry(role, text) {
  const el  = document.createElement('div');
  el.className = `entry entry-${role}`;
  el.textContent = text;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

// beginStreamEntry + appendStreamChunk: progressive GM narration display.
// beginStreamEntry creates an empty entry element; appendStreamChunk appends
// each arriving token so the text grows in place as the stream arrives.
export function beginStreamEntry(role) {
  const el = document.createElement('div');
  el.className = `entry entry-${role}`;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

export function appendStreamChunk(el, chunk) {
  el.textContent += chunk;
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

export function setThinking(on) {
  const ID = 'thinking-indicator';
  if (on) {
    if (document.getElementById(ID)) return;
    const el = appendEntry('thinking', '⏳ The Dungeon Master considers…');
    el.id = ID;
  } else {
    document.getElementById(ID)?.remove();
  }
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

export function prompt(message) {
  if (message) appendEntry('system', message);
  setInputEnabled(true, message || 'What do you do?');
  return new Promise((resolve) => { _resolveInput = resolve; });
}

export async function pickFrom(message, options, labelFn = (x) => x, defaultIdx = -1) {
  appendEntry('system', message);
  options.forEach((opt, i) => {
    const isDefault = i === defaultIdx;
    appendEntry(
      isDefault ? 'option-default' : 'option',
      `  ${i + 1}. ${labelFn(opt)}${isDefault ? '  ← default' : ''}`
    );
  });
  appendEntry('system', '');

  while (true) {
    const input = await prompt(defaultIdx >= 0 ? 'Enter a number, name, or press Enter for default:' : 'Enter a number or name:');
    if (input.trim() === '' && defaultIdx >= 0) return options[defaultIdx];
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) return options[num - 1];
    const match = options.find(
      (o) => o.toLowerCase() === input.toLowerCase() ||
             labelFn(o).toLowerCase() === input.toLowerCase()
    );
    if (match) return match;
    appendEntry('error', `Please enter 1–${options.length} or the option name.`);
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function updatePCHeaderStats(record, sheet) {
  const el = document.getElementById('pc-header-stats');
  if (!el) return;
  if (!record || !sheet) { el.innerHTML = ''; return; }
  const hp    = record.hpCurrent ?? sheet.hp.max;
  const maxHp = sheet.hp.max;
  const low   = hp <= Math.floor(maxHp / 4);
  const cap   = s => s.charAt(0).toUpperCase() + s.slice(1);
  el.innerHTML =
    `<span class="hs-name">${escHtml(record.name)}</span>` +
    `<span class="hs-sep">·</span>${escHtml(cap(record.classId))}` +
    `<span class="hs-sep">·</span>HP <span class="${low ? 'hs-hp-low' : 'hs-hp-ok'}">${hp}/${maxHp}</span>` +
    `<span class="hs-sep">·</span>AC ${sheet.ac.value}`;
}

export function updatePCStats(record, sheet, inventory = []) {
  if (!record || !sheet) { pcStatsEl().innerHTML = ''; return; }
  const hp    = record.hpCurrent ?? sheet.hp.max;
  const maxHp = sheet.hp.max;
  const low   = hp <= Math.floor(maxHp / 4);
  const bagRow = inventory.length
    ? `<div class="stat-row">Bag  ${inventory.map(i => i.name).join(', ')}</div>`
    : '';
  pcStatsEl().innerHTML = `
    <div class="stat-block">
      <div class="stat-name">${record.name}</div>
      <div class="stat-row">HP  <span class="hp${low ? ' low' : ''}">${hp}/${maxHp}</span></div>
      <div class="stat-row">AC  ${sheet.ac.value}</div>
      <div class="stat-row">${record.classId.charAt(0).toUpperCase() + record.classId.slice(1)} ${record.level}</div>
      <div class="stat-row">PB  +${sheet.proficiencyBonus}</div>
      ${bagRow}
    </div>`;
}

export function updateEnemyStats(npcs) {
  const alive = (Array.isArray(npcs) ? npcs : Object.values(npcs ?? {})).filter(n => n.alive);
  if (!alive.length) {
    enemyStatsEl().innerHTML = '<div class="muted">No enemies</div>';
    return;
  }
  enemyStatsEl().innerHTML = alive.map(n => {
    const low = n.hp <= Math.floor(n.maxHp / 4);
    return `<div class="stat-block enemy">
      <div class="stat-name">${n.name}</div>
      <div class="stat-row">HP <span class="hp${low ? ' low' : ''}">${n.hp}/${n.maxHp}</span></div>
    </div>`;
  }).join('');
}

// ─── Collapsibles (sidebar + debug panel) ────────────────────────────────────

const MOBILE_BREAKPOINT = 768;

// Shared toggle factory — handles collapse class, aria-expanded, localStorage.
// extraUpdate is called with the open state for element-specific side effects.
function makePanel(panel, storageKey, extraUpdate) {
  function set(open) {
    panel.classList.toggle('collapsed', !open);
    panel.setAttribute('aria-expanded', String(open));
    localStorage.setItem(storageKey, open ? 'open' : 'closed');
    extraUpdate?.(open);
  }
  function storedOrDefault() {
    const v = localStorage.getItem(storageKey);
    return v !== null ? v === 'open' : window.innerWidth >= MOBILE_BREAKPOINT;
  }
  return { set, storedOrDefault };
}

// Module-level reference so updateDebugPanel can call setDebug without window.*.
let _setDebug = null;
let _debugBar = null;
let _debugPanel = null;

// Wires the 🔑 copy-key button in the chrome bar.
// Reads the key from localStorage directly so it works even before Spektrum ticks.
export function initCopyKeyButton(getKey) {
  const btn = document.getElementById('copy-key-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getKey());
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '🔑'; }, 1200);
  });
}

export function initCollapsibles() {
  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar    = document.getElementById('sidebar');
  const sidebarBtn = document.getElementById('sidebar-toggle');

  if (sidebar && sidebarBtn) {
    const { set, storedOrDefault } = makePanel(sidebar, 'dg-sidebar', (open) => {
      sidebarBtn.textContent = open ? '◀' : '▶';
    });
    set(storedOrDefault());
    sidebarBtn.addEventListener('click', () => set(sidebar.classList.contains('collapsed')));
  }

  // ── Debug panel ───────────────────────────────────────────────────────────
  _debugPanel = document.getElementById('debug-panel');
  _debugBar   = document.getElementById('debug-bar');
  const chevron = _debugBar?.querySelector('.toggle-chevron');

  if (_debugPanel && _debugBar) {
    const { set, storedOrDefault } = makePanel(_debugBar, 'dg-debug', (open) => {
      _debugPanel.classList.toggle('collapsed', !open);
      if (chevron) chevron.textContent = open ? '▴' : '▾';
    });
    // setDebug drives both the bar's aria state and the panel visibility.
    _setDebug = set;
    // Applied on first real data — store initial preference now.
    _setDebug._initial = storedOrDefault();

    _debugBar.addEventListener('click', () =>
      _setDebug(_debugPanel.classList.contains('collapsed'))
    );
    _debugBar.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _debugBar.click(); }
    });
  }
}

// ─── Debug panel ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function updateDebugPanel(debug) {
  const el = _debugPanel;
  if (!el) return;
  if (!debug) { el.innerHTML = ''; return; }

  // Reveal the debug bar on first real data and apply stored preference.
  if (_debugBar && !_debugBar.classList.contains('visible')) {
    _debugBar.classList.add('visible');
    _setDebug?.(_setDebug._initial ?? true);
  }

  const { classified, resolved, goblinResult } = debug;

  // Each section becomes a flex column in the horizontal footer strip.
  const sections = [];
  function sec(label) { const s = { label, rows: [] }; sections.push(s); return s; }

  // ── Classifier ────────────────────────────────────────────────────────────
  const cs = sec('intent');
  cs.rows.push({ text: `${classified.intent}${classified.target_id ? ' → ' + classified.target_id : ''}` });
  if (classified.direction) cs.rows.push({ text: `dir: ${classified.direction}` });
  if (classified.skill)     cs.rows.push({ text: `skill: ${classified.skill}` });
  if (classified.dc != null) cs.rows.push({ text: `dc: ${classified.dc}` });
  if (classified.reason)    cs.rows.push({ text: classified.reason, cls: 'dim' });

  // Renders a d20 value with nat-1/nat-20 highlight if applicable.
  function d20Html(val) {
    if (val === 1)  return `d20  <strong class="nat-1">${val}</strong>`;
    if (val === 20) return `d20  <strong class="nat-20">${val}</strong>`;
    return escHtml(`d20  ${val}`);
  }

  // ── PC action ─────────────────────────────────────────────────────────────
  if (resolved.intent === 'attack') {
    const s = sec('pc attack');
    s.rows.push({ text: resolved.weaponName });
    const bonus = resolved.totalHit - resolved.d20;
    s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(resolved.totalHit))}` });
    const label = resolved.crit ? 'CRIT ✓' : resolved.fumble ? 'FUMBLE ✗' : resolved.hit ? 'HIT ✓' : 'MISS ✗';
    s.rows.push({ text: `AC   ${resolved.targetAC}  ${label}`, cls: resolved.hit && !resolved.fumble ? 'hit' : 'miss' });
    if (resolved.hit) {
      s.rows.push({ text: `dmg  ${resolved.damage}` });
      s.rows.push({ text: `${resolved.targetName}  ${resolved.targetPrevHp} → ${resolved.targetNewHp}${resolved.targetDead ? '  ✗' : ''}` });
    }
  } else if (resolved.intent === 'skill') {
    const s = sec(`skill: ${resolved.skill} (${resolved.ability})`);
    const bonus = resolved.abilMod + resolved.profBonus;
    s.rows.push({ html: `${d20Html(resolved.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(resolved.total))}` });
    s.rows.push({ text: `DC   ${resolved.dc}  ${resolved.success ? 'PASS ✓' : 'FAIL ✗'}`, cls: resolved.success ? 'hit' : 'miss' });
  } else {
    const s = sec('pc action');
    s.rows.push({ text: resolved.intent });
    if (resolved.reason) s.rows.push({ text: resolved.reason, cls: 'dim' });
  }

  // ── Enemy retaliation ─────────────────────────────────────────────────────
  if (goblinResult) {
    const s = sec(goblinResult.goblinName);
    const bonus = goblinResult.totalHit - goblinResult.d20;
    s.rows.push({ html: `${d20Html(goblinResult.d20)}  +${escHtml(String(bonus))}  → ${escHtml(String(goblinResult.totalHit))}` });
    const label = goblinResult.crit ? 'CRIT ✓' : goblinResult.fumble ? 'FUMBLE ✗' : goblinResult.hit ? 'HIT ✓' : 'MISS ✗';
    s.rows.push({ text: `AC   ${goblinResult.pcAC}  ${label}`, cls: goblinResult.hit && !goblinResult.fumble ? 'hit' : 'miss' });
    if (goblinResult.hit) {
      s.rows.push({ text: `dmg  ${goblinResult.damage}` });
      s.rows.push({ text: `you  ${goblinResult.pcPrevHp} → ${goblinResult.pcNewHp}${goblinResult.pcUnconscious ? '  (down)' : ''}` });
    }
  }

  el.innerHTML = sections.map(s => `<div class="dbg-section">
    <div class="dbg-sep">${escHtml(s.label)}</div>
    ${s.rows.map(r => `<div class="dbg-row${r.cls ? ' ' + r.cls : ''}">${r.html ?? escHtml(r.text)}</div>`).join('')}
  </div>`).join('');
}

// ─── Action chips ─────────────────────────────────────────────────────────────

const skillChipsEl     = () => document.getElementById('skill-chips');
const characterChipsEl = () => document.getElementById('character-chips');

// Class features that are NOT on the derived sheet — hardcoded for L1.
// notes and prefill text are computed from the live record + sheet.
function classAbilities(record, sheet) {
  const lvl       = record.level ?? 1;
  const sneakDice = Math.ceil(lvl / 2);
  const dc        = sheet.spellcasting?.saveDC    ?? '?';
  const spAtk     = sheet.spellcasting?.attackBonus ?? '?';

  return {
    fighter: [
      { label: 'Second Wind',  note: `Bonus action: regain 1d10+${lvl} HP.\nOnce per short rest.`,                         text: 'I use Second Wind to heal myself' },
      { label: 'Action Surge', note: 'Take one additional action this turn.\nOnce per short rest.',                         text: 'I use Action Surge for an extra action' },
    ],
    rogue: [
      { label: 'Sneak Attack',   note: `Deal ${sneakDice}d6 extra damage when you have advantage\nor an ally flanks your target.`, text: 'I make a Sneak Attack' },
      { label: 'Cunning Action', note: 'Bonus action: Dash, Disengage, or Hide.\nKeeps you mobile without spending your main action.', text: 'I use Cunning Action to ' },
    ],
    cleric: [
      { label: 'Turn Undead', note: `Channel Divinity: undead within 30 ft must flee.\nWIS save DC ${dc} or be turned for 1 minute.`, text: 'I use Channel Divinity: Turn Undead' },
      { label: 'Cast Spell',  note: `Cast a prepared spell. Targets resist with DC ${dc}.\nConcentration spells last until broken or you cast another.`, text: 'I cast a spell at ' },
    ],
    wizard: [
      { label: 'Arcane Recovery', note: `Short rest: regain spell slots up to level ${Math.ceil(lvl / 2)}.\nOnce per long rest.`, text: 'I use Arcane Recovery' },
      { label: 'Cast Spell',      note: `Cast a prepared spell. +${spAtk} to spell attack rolls.\nHigher spell slots deal more damage or last longer.`, text: 'I cast a spell at ' },
    ],
  }[record.classId] ?? [];
}

function prefillChip(text) {
  cmdEl().value = text;
  cmdEl().focus();
  cmdEl().setSelectionRange(text.length, text.length);
}

// Submit immediately if input is awaiting a response; otherwise prefill the field.
function fireChip(val) {
  if (_resolveInput) {
    const fn  = _resolveInput;
    _resolveInput = null;
    setInputEnabled(false);
    cmdEl().value = '';
    fn(val);
  } else {
    prefillChip(val);
  }
}

export function showCharacterChips(record, sheet) {
  const el = characterChipsEl();
  if (!el) return;
  el.innerHTML = '';
  if (!record || !sheet) return;

  // One chip per equipped weapon — shows real attack bonus and damage from the sheet.
  for (const atk of (sheet.attacks ?? [])) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.innerHTML =
      `<span class="skill-name">${atk.name}</span>` +
      `<span class="skill-ab">+${atk.attackBonus} ${atk.damageDice}</span>`;
    btn.addEventListener('click', () => prefillChip(`I attack with my ${atk.name}`));
    el.appendChild(btn);
  }

  // Spellcasting summary line for Cleric / Wizard.
  if (sheet.spellcasting) {
    const info = document.createElement('div');
    info.className = 'char-spell-info';
    info.textContent =
      `Spell save DC ${sheet.spellcasting.saveDC} · spell atk +${sheet.spellcasting.attackBonus}`;
    el.appendChild(info);
  }

  // Class feature chips.
  for (const ability of classAbilities(record, sheet)) {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.innerHTML =
      `<span class="skill-name">${ability.label}</span>` +
      `<span class="skill-ab">${ability.note}</span>`;
    btn.addEventListener('click', () => prefillChip(ability.text));
    el.appendChild(btn);
  }
}

const SKILLS = [
  { id: 'athletics',       label: 'Athletics',       ab: 'STR', desc: 'Climb, jump, swim, or grapple. Raw physical effort against resistance.' },
  { id: 'acrobatics',      label: 'Acrobatics',      ab: 'DEX', desc: 'Balance, tumble, or escape a grapple. Finesse and body control.' },
  { id: 'sleight-of-hand', label: 'Sleight of Hand', ab: 'DEX', desc: 'Pick pockets, plant objects, or perform manual trickery unseen.' },
  { id: 'stealth',         label: 'Stealth',         ab: 'DEX', desc: 'Move silently and stay hidden. Opposed by passive Perception.' },
  { id: 'arcana',          label: 'Arcana',          ab: 'INT', desc: 'Recall lore about spells, magic items, and the planes.' },
  { id: 'history',         label: 'History',         ab: 'INT', desc: 'Recall past events, legendary figures, and ancient civilisations.' },
  { id: 'investigation',   label: 'Investigation',   ab: 'INT', desc: 'Search for clues, find hidden doors, or deduce what happened.' },
  { id: 'nature',          label: 'Nature',          ab: 'INT', desc: 'Identify plants, animals, weather patterns, and natural hazards.' },
  { id: 'religion',        label: 'Religion',        ab: 'INT', desc: 'Recall lore about deities, rites, cults, and holy symbols.' },
  { id: 'animal-handling', label: 'Animal Handling', ab: 'WIS', desc: 'Calm, guide, or read the intent of beasts and mounts.' },
  { id: 'insight',         label: 'Insight',         ab: 'WIS', desc: "Read someone's true feelings or detect when they're lying." },
  { id: 'medicine',        label: 'Medicine',        ab: 'WIS', desc: 'Stabilise a dying creature, diagnose ailments, or tend wounds.' },
  { id: 'perception',      label: 'Perception',      ab: 'WIS', desc: 'Notice threats, spot hidden creatures, or hear distant sounds.' },
  { id: 'survival',        label: 'Survival',        ab: 'WIS', desc: 'Track prey, forage food, navigate terrain, or endure the wild.' },
  { id: 'deception',       label: 'Deception',       ab: 'CHA', desc: 'Lie convincingly, disguise your intent, or create a false impression.' },
  { id: 'intimidation',    label: 'Intimidation',    ab: 'CHA', desc: 'Coerce through threats, menace, or sheer force of presence.' },
  { id: 'performance',     label: 'Performance',     ab: 'CHA', desc: 'Entertain, impersonate, or captivate an audience.' },
  { id: 'persuasion',      label: 'Persuasion',      ab: 'CHA', desc: 'Win someone over through charm, reasoned argument, or diplomacy.' },
];

// Clicking a skill chip always prefills the input — the player edits and submits.
export function showSkillChips(cooldowns = {}) {
  const el = skillChipsEl();
  if (!el) return;
  el.innerHTML = '';

  for (const skill of SKILLS) {
    const remaining = cooldowns[skill.id] ?? 0;
    const onCooldown = remaining > 0;

    const btn = document.createElement('button');
    btn.className = 'chip skill-chip' + (onCooldown ? ' disabled' : '');
    btn.disabled = onCooldown;
    btn.innerHTML =
      `<span class="skill-name">${skill.label}</span>` +
      `<span class="skill-ab">${skill.ab}${onCooldown ? ` (${remaining})` : ''}</span>`;

    if (!onCooldown) {
      btn.addEventListener('click', () => prefillChip(`I use ${skill.label}`));
    }

    el.appendChild(btn);
  }
}

// Prepends a single chip to the top of #action-chips without clearing others.
// Used for the Retry chip after exhausted turn retries.
export function insertActionChip(label, value) {
  const el = actionChipsEl();
  if (!el) return;
  const btn = document.createElement('button');
  btn.className = 'chip chip-retry';
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (_resolveInput) {
      const fn = _resolveInput;
      _resolveInput = null;
      setInputEnabled(false);
      cmdEl().value = '';
      fn(value);
    } else {
      cmdEl().value = value;
      cmdEl().focus();
    }
  });
  el.insertBefore(btn, el.firstChild);
}

export function showActionChips(actions) {
  const el = actionChipsEl();
  if (!el) return;
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className   = 'chip';
    btn.textContent = action.label;
    btn.addEventListener('click', () => fireChip(action.value ?? action.label));
    el.appendChild(btn);
  }
}

export function clearChips() {
  const a = actionChipsEl(), c = characterChipsEl(), s = skillChipsEl();
  if (a) a.innerHTML = '';
  if (c) c.innerHTML = '';
  if (s) s.innerHTML = '';
}

// ─── Scene background image ───────────────────────────────────────────────────
// The generated sketch is used as the transcript background at low opacity.

const transcriptBgEl = () => document.getElementById('transcript-bg');

export function showSceneImageLoading() {
  // Nothing visible during load — the existing bg stays until the new one arrives.
}

export function setSceneImage(src) {
  const el = transcriptBgEl();
  if (el) el.style.backgroundImage = `url("${src}")`;
  try { localStorage.setItem('sketch-last-image', src); } catch { /* quota — skip */ }
}

export function restoreSceneImage() {
  const src = localStorage.getItem('sketch-last-image');
  if (!src) return false;
  const el = transcriptBgEl();
  if (el) el.style.backgroundImage = `url("${src}")`;
  return true;
}

export function hideSceneImage() {
  const el = transcriptBgEl();
  if (el) el.classList.add('sketch-off');
}

// Called by applySketchView to set the opacity tier.
export function setSketchOpacity(tier) {
  const el = transcriptBgEl();
  if (!el) return;
  el.classList.remove('sketch-off', 'sketch-hi');
  if (tier === 'off') el.classList.add('sketch-off');
  if (tier === 'hi')  el.classList.add('sketch-hi');
  // 'normal' = no class = 0.2 default
}

export function showRoomChips(exits, loot) {
  const ICON = { north: '↑', south: '↓', east: '→', west: '←' };
  const cap  = s => s.charAt(0).toUpperCase() + s.slice(1);
  const actions = [
    ...exits.map(e => ({
      label: `${ICON[e.dir] ?? '→'} ${cap(e.dir)}${e.locked ? ' 🔒' : ''}`,
      value: `I go ${e.dir}`,
    })),
    ...(loot.filter(i => !i.taken).map(i => ({
      label: `Take ${i.name}`,
      value: `I take the ${i.name}`,
    }))),
    ...(exits.some(e => e.locked) ? [{ label: '🔑 Unlock', value: 'I use the key to unlock the door' }] : []),
    { label: '⚔ Attack',       value: 'I attack' },
    { label: '👁 Look around', value: 'I look around carefully' },
    { label: '💬 Talk',        value: 'I try to talk' },
    { label: '⏳ Wait',        value: 'I wait and watch' },
  ];
  showActionChips(actions);
}

// ─── Action bar ───────────────────────────────────────────────────────────────
//
// Three-zone bar rendered in the footer: compass (movement), class abilities,
// skills. Updated each turn when the action bar is enabled.

export function updateActionBar(exits, record, sheet, cooldowns) {
  // ── Compass ────────────────────────────────────────────────────────────────
  const DIRS = ['north', 'east', 'south', 'west'];
  for (const dir of DIRS) {
    const btn  = document.getElementById(`ab-${dir}`);
    if (!btn) continue;
    const exit = exits.find(e => e.dir === dir);
    btn.disabled = !exit;
    btn.classList.toggle('ab-locked', !!(exit?.locked));
    btn.onclick = exit
      ? () => fireChip(exit.locked ? `I try to unlock the door to the ${dir}` : `I go ${dir}`)
      : null;
    if (exit?.locked) {
      btn.dataset.tip = `${dir.charAt(0).toUpperCase() + dir.slice(1)} — locked\nTry to force or unlock the door.`;
    } else if (exit) {
      btn.dataset.tip = `${dir.charAt(0).toUpperCase() + dir.slice(1)} — passage open\n${exit.description ?? 'Move in this direction.'}`;
    } else {
      btn.dataset.tip = `${dir.charAt(0).toUpperCase() + dir.slice(1)} — no exit`;
    }
  }

  // ── Class abilities word cloud ─────────────────────────────────────────────
  const abEl = document.getElementById('ab-abilities-list');
  if (abEl) {
    abEl.innerHTML = '';
    if (record && sheet) {
      for (const atk of (sheet.attacks ?? [])) {
        const btn = document.createElement('span');
        btn.className = 'ab-word ab-available';
        btn.dataset.tip = `Attack\n+${atk.attackBonus} to hit · ${atk.damageDice} damage`;
        btn.textContent = atk.name;
        abEl.appendChild(btn);
      }
      for (const ability of classAbilities(record, sheet)) {
        const btn = document.createElement('span');
        btn.className = 'ab-word ab-available';
        btn.dataset.tip = ability.note;
        btn.textContent = ability.label;
        abEl.appendChild(btn);
      }
    }
  }

  // ── Skills word cloud ──────────────────────────────────────────────────────
  const skEl = document.getElementById('ab-skills-list');
  if (skEl) {
    skEl.innerHTML = '';
    for (const skill of SKILLS) {
      const remaining = cooldowns[skill.id] ?? 0;
      const onCd = remaining > 0;
      const btn = document.createElement('span');
      btn.className = 'ab-word ' + (onCd ? 'ab-unavailable' : 'ab-available');
      btn.dataset.tip = onCd
        ? `${skill.label} · ${skill.ab}\n${skill.desc}\n\nCooldown: ${remaining} turn${remaining > 1 ? 's' : ''} remaining`
        : `${skill.label} · ${skill.ab}\n${skill.desc}`;
      btn.textContent = skill.label + (onCd ? ` (${remaining})` : '');
      skEl.appendChild(btn);
    }
  }
}
