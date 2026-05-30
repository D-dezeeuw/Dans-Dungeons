// src/ui/console.js
//
// All DOM reads and writes live here. The loop calls these functions;
// this module never touches the AI or Spektrum directly.

const transcriptEl  = () => document.getElementById('transcript');
const pcStatsEl     = () => document.getElementById('pc-stats');
const enemyStatsEl  = () => document.getElementById('enemy-stats');
const actionChipsEl = () => document.getElementById('action-chips');
const costMeterEl   = () => document.getElementById('cost-meter');
const turnCounterEl = () => document.getElementById('turn-counter');
const cmdEl         = () => document.getElementById('cmd');

let _resolveInput = null;

// ─── Input wiring ─────────────────────────────────────────────────────────────
// ES modules are deferred — the DOM is ready by the time this runs.

cmdEl().addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const val = cmdEl().value.trim();
  cmdEl().value = '';
  if (_resolveInput) {
    const fn  = _resolveInput;
    _resolveInput = null;
    setInputEnabled(false);
    fn(val);   // empty string is allowed — callers decide if it's valid
  }
});

function setInputEnabled(on) {
  const el = cmdEl();
  el.disabled = !on;
  if (on) {
    el.placeholder = 'What do you do?';
    el.focus();
  } else {
    el.placeholder = '…';
  }
}

// ─── Transcript helpers ───────────────────────────────────────────────────────

export function clear() {
  transcriptEl().innerHTML = '';
}

export function appendEntry(role, text) {
  const el  = document.createElement('div');
  el.className = `entry entry-${role}`;
  el.textContent = text;
  transcriptEl().appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
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
  setInputEnabled(true);
  return new Promise((resolve) => { _resolveInput = resolve; });
}

export async function pickFrom(message, options, labelFn = (x) => x) {
  appendEntry('system', message);
  options.forEach((opt, i) => {
    appendEntry('option', `  ${i + 1}. ${labelFn(opt)}`);
  });
  appendEntry('system', '');

  while (true) {
    const input = await prompt('Enter a number or name:');
    const num   = parseInt(input, 10);
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
  const alive = Object.values(npcs ?? {}).filter(n => n.alive);
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

export function updateCostMeter(tokens, costUsd) {
  costMeterEl().textContent =
    tokens > 0 ? `$${costUsd.toFixed(4)} · ${tokens.toLocaleString()} tok` : '';
}

export function updateTurnCounter(n) {
  turnCounterEl().textContent = n > 0 ? `Turn ${n}` : '';
}

// ─── Collapsibles (sidebar + debug panel) ────────────────────────────────────

export function initCollapsibles() {
  const MOBILE = 768;
  const isMobile = () => window.innerWidth < MOBILE;

  function storedOrDefault(key, desktopDefault) {
    const v = localStorage.getItem(key);
    return v !== null ? v === 'open' : (isMobile() ? false : desktopDefault);
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────
  const sidebar    = document.getElementById('sidebar');
  const sidebarBtn = document.getElementById('sidebar-toggle');

  function setSidebar(open) {
    sidebar?.classList.toggle('collapsed', !open);
    if (sidebarBtn) {
      sidebarBtn.textContent      = open ? '◀' : '▶';
      sidebarBtn.setAttribute('aria-expanded', String(open));
    }
    localStorage.setItem('dg-sidebar', open ? 'open' : 'closed');
  }

  setSidebar(storedOrDefault('dg-sidebar', true));
  sidebarBtn?.addEventListener('click', () =>
    setSidebar(sidebar.classList.contains('collapsed'))
  );

  // ── Debug panel ───────────────────────────────────────────────────────────
  const debugPanel = document.getElementById('debug-panel');
  const debugBar   = document.getElementById('debug-bar');

  function setDebug(open) {
    debugPanel?.classList.toggle('collapsed', !open);
    if (debugBar) {
      debugBar.setAttribute('aria-expanded', String(open));
      const chevron = debugBar.querySelector('.toggle-chevron');
      if (chevron) chevron.textContent = open ? '▴' : '▾';
    }
    localStorage.setItem('dg-debug', open ? 'open' : 'closed');
  }

  // Initial debug state applied once bar becomes visible (see updateDebugPanel)
  window._debugOpen = storedOrDefault('dg-debug', true);

  debugBar?.addEventListener('click', () =>
    setDebug(debugPanel.classList.contains('collapsed'))
  );
  debugBar?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); debugBar.click(); }
  });

  // expose setDebug so updateDebugPanel can use it
  window._setDebug = setDebug;
}

// ─── Debug panel ─────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function updateDebugPanel(debug) {
  const el  = document.getElementById('debug-panel');
  const bar = document.getElementById('debug-bar');
  if (!el) return;
  if (!debug) { el.innerHTML = ''; return; }

  // Reveal the debug bar on first real data and apply stored preference.
  if (bar && !bar.classList.contains('visible')) {
    bar.classList.add('visible');
    if (typeof window._setDebug === 'function') {
      window._setDebug(window._debugOpen ?? true);
    }
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

  // ── PC action ─────────────────────────────────────────────────────────────
  if (resolved.intent === 'attack') {
    const s = sec('pc attack');
    s.rows.push({ text: resolved.weaponName });
    const bonus = resolved.totalHit - resolved.d20;
    s.rows.push({ text: `d20  ${resolved.d20}  +${bonus}  → ${resolved.totalHit}` });
    const label = resolved.crit ? 'CRIT ✓' : resolved.fumble ? 'FUMBLE ✗' : resolved.hit ? 'HIT ✓' : 'MISS ✗';
    s.rows.push({ text: `AC   ${resolved.targetAC}  ${label}`, cls: resolved.hit && !resolved.fumble ? 'hit' : 'miss' });
    if (resolved.hit) {
      s.rows.push({ text: `dmg  ${resolved.damage}` });
      s.rows.push({ text: `${resolved.targetName}  ${resolved.targetPrevHp} → ${resolved.targetNewHp}${resolved.targetDead ? '  ✗' : ''}` });
    }
  } else if (resolved.intent === 'skill') {
    const s = sec(`skill: ${resolved.skill} (${resolved.ability})`);
    const bonus = resolved.abilMod + resolved.profBonus;
    s.rows.push({ text: `d20  ${resolved.d20}  +${bonus}  → ${resolved.total}` });
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
    s.rows.push({ text: `d20  ${goblinResult.d20}  +${bonus}  → ${goblinResult.totalHit}` });
    const label = goblinResult.crit ? 'CRIT ✓' : goblinResult.fumble ? 'FUMBLE ✗' : goblinResult.hit ? 'HIT ✓' : 'MISS ✗';
    s.rows.push({ text: `AC   ${goblinResult.pcAC}  ${label}`, cls: goblinResult.hit && !goblinResult.fumble ? 'hit' : 'miss' });
    if (goblinResult.hit) {
      s.rows.push({ text: `dmg  ${goblinResult.damage}` });
      s.rows.push({ text: `you  ${goblinResult.pcPrevHp} → ${goblinResult.pcNewHp}${goblinResult.pcUnconscious ? '  (down)' : ''}` });
    }
  }

  el.innerHTML = sections.map(s => `<div class="dbg-section">
    <div class="dbg-sep">${escHtml(s.label)}</div>
    ${s.rows.map(r => `<div class="dbg-row${r.cls ? ' ' + r.cls : ''}">${escHtml(r.text)}</div>`).join('')}
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
      { label: 'Second Wind',  note: `1d10+${lvl} HP`,  text: 'I use Second Wind to heal myself' },
      { label: 'Action Surge', note: 'extra action',     text: 'I use Action Surge for an extra action' },
    ],
    rogue: [
      { label: 'Sneak Attack',   note: `${sneakDice}d6 extra`, text: 'I make a Sneak Attack' },
      { label: 'Cunning Action', note: 'bonus action',          text: 'I use Cunning Action to ' },
    ],
    cleric: [
      { label: 'Turn Undead', note: 'channel divinity', text: 'I use Channel Divinity: Turn Undead' },
      { label: 'Cast Spell',  note: `DC ${dc}`,         text: 'I cast a spell at ' },
    ],
    wizard: [
      { label: 'Arcane Recovery', note: 'short rest',     text: 'I use Arcane Recovery' },
      { label: 'Cast Spell',      note: `+${spAtk} atk`, text: 'I cast a spell at ' },
    ],
  }[record.classId] ?? [];
}

function prefillChip(text) {
  cmdEl().value = text;
  cmdEl().focus();
  cmdEl().setSelectionRange(text.length, text.length);
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
  { id: 'athletics',       label: 'Athletics',        ab: 'STR' },
  { id: 'acrobatics',      label: 'Acrobatics',       ab: 'DEX' },
  { id: 'sleight-of-hand', label: 'Sleight of Hand',  ab: 'DEX' },
  { id: 'stealth',         label: 'Stealth',          ab: 'DEX' },
  { id: 'arcana',          label: 'Arcana',           ab: 'INT' },
  { id: 'history',         label: 'History',          ab: 'INT' },
  { id: 'investigation',   label: 'Investigation',    ab: 'INT' },
  { id: 'nature',          label: 'Nature',           ab: 'INT' },
  { id: 'religion',        label: 'Religion',         ab: 'INT' },
  { id: 'animal-handling', label: 'Animal Handling',  ab: 'WIS' },
  { id: 'insight',         label: 'Insight',          ab: 'WIS' },
  { id: 'medicine',        label: 'Medicine',         ab: 'WIS' },
  { id: 'perception',      label: 'Perception',       ab: 'WIS' },
  { id: 'survival',        label: 'Survival',         ab: 'WIS' },
  { id: 'deception',       label: 'Deception',        ab: 'CHA' },
  { id: 'intimidation',    label: 'Intimidation',     ab: 'CHA' },
  { id: 'performance',     label: 'Performance',      ab: 'CHA' },
  { id: 'persuasion',      label: 'Persuasion',       ab: 'CHA' },
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

export function showActionChips(actions) {
  const el = actionChipsEl();
  el.innerHTML = '';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className   = 'chip';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      const val = action.value ?? action.label;
      if (_resolveInput) {
        const fn  = _resolveInput;
        _resolveInput = null;
        setInputEnabled(false);
        cmdEl().value = '';
        appendEntry('player', `> ${val}`);
        fn(val);
      } else {
        cmdEl().value = val;
        cmdEl().focus();
      }
    });
    el.appendChild(btn);
  }
}

export function clearChips() {
  actionChipsEl().innerHTML = '';
  characterChipsEl().innerHTML = '';
  skillChipsEl().innerHTML = '';
}

// Dynamic room chips — exits, loot, and standard actions.
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
