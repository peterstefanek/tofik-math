import { S } from './strings.js';
import { audio } from './audio.js';
import {
  bindContext as bindQuestions,
  LEVEL_TYPES, QUESTIONS_PER_LEVEL, getLevelType,
  generateQuestions, generateOne, difficultyTier,
  pick,
} from './questions.js';
import {
  bindContext as bindMechanics,
  renderCompareScale, renderRozkladShake, renderPeniazeScatter,
  buildWpHint, makeGroupedDots,
} from './mechanics.js';

// ========== GAME STATE ==========
const state = {
  current: 'welcome',
  levelIdx: 0,
  questionIdx: 0,
  mistakesInLevel: 0,
  wrongOnQuestion: 0,
  totalStars: 0,
  inBonus: false,
  bonusTimerInterval: null,
  bonusTimeLeft: 0,
  pet: { species: 'fox', name: 'Tofík' },
  mode: null, // 'do10' | 'do20' — null until chosen
  levels: [
    { id: 0, name: S.levelNames[0], icon: '🌼', x: 20, y: 92, type: 'count',    done: false, stars: 0, bonus: false },
    { id: 1, name: S.levelNames[1], icon: '🍎', x: 72, y: 80, type: 'add5',     done: false, stars: 0, bonus: false },
    { id: 2, name: S.levelNames[2], icon: '💧', x: 24, y: 67, type: 'rozklad',  done: false, stars: 0, bonus: false },
    { id: 3, name: S.levelNames[3], icon: '🐟', x: 72, y: 54, type: 'compare',  done: false, stars: 0, bonus: false },
    { id: 4, name: S.levelNames[4], icon: '🐻', x: 24, y: 41, type: 'add10',    done: false, stars: 0, bonus: false },
    { id: 5, name: S.levelNames[5], icon: '⛰️', x: 72, y: 28, type: 'sequence', done: false, stars: 0, bonus: false },
    { id: 6, name: S.levelNames[6], icon: '🌟', x: 32, y: 12, type: 'addsub20', done: false, stars: 0, bonus: false },
  ],
  currentQuestions: [],
};

// ========== PETS ==========
const PETS = [
  { id: 'fox',      emoji: '🦊', defaultName: S.petNames.fox,      useSvg: true  },
  { id: 'bear',     emoji: '🐻', defaultName: S.petNames.bear,     useSvg: false },
  { id: 'rabbit',   emoji: '🐰', defaultName: S.petNames.rabbit,   useSvg: false },
  { id: 'owl',      emoji: '🦉', defaultName: S.petNames.owl,      useSvg: false },
  { id: 'hedgehog', emoji: '🦔', defaultName: S.petNames.hedgehog, useSvg: false },
  { id: 'cat',      emoji: '🐱', defaultName: S.petNames.cat,      useSvg: false },
];

function getPet(id) { return PETS.find(p => p.id === id) || PETS[0]; }

// ========== STATISTICS ==========
const stats = {
  attempts: [],          // capped at 200 most recent
  perType: {},           // { type: { count, correct, totalTimeMs, mistakes } }
  daysActive: [],        // array of YYYY-MM-DD strings
  startedAt: Date.now(),
};
const STATS_KEY = 'tofik-stats-v1';
const STATS_CAP = 200;

const SKILL_INFO = {
  count:      { icon: '🌼', name: S.skillNames.count },
  add5:       { icon: '🍎', name: S.skillNames.add5 },
  rozklad:    { icon: '💧', name: S.skillNames.rozklad },
  compare:    { icon: '🐟', name: S.skillNames.compare },
  add10:      { icon: '🐻', name: S.skillNames.add10 },
  sequence:   { icon: '⛰️', name: S.skillNames.sequence },
  addsub20:   { icon: '🌟', name: S.skillNames.addsub20 },
  rozklad20:  { icon: '💧', name: S.skillNames.rozklad20 },
  seqstep:    { icon: '🔢', name: S.skillNames.seqstep },
  peniaze:    { icon: '🪙', name: S.skillNames.peniaze },
  wordproblem:{ icon: '📖', name: S.skillNames.wordproblem },
  magic:      { icon: '✨', name: S.skillNames.magic },
};

// Live tracking of current question
let currentAttempt = null;

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function questionLabel(q) {
  switch (q.type) {
    case 'count':    return `${S.prompts.countLabel} ${q.answer}`;
    case 'add5':
    case 'add10': {
      const slot = q.slot || 'result';
      if (slot === 'result') return `${q.a} + ${q.b} = ?`;
      if (slot === 'a')      return `? + ${q.b} = ${q.sum}`;
      return `${q.a} + ? = ${q.sum}`;
    }
    case 'addsub20': {
      const slot = q.slot || 'result';
      if (slot === 'result') return `${q.a} ${q.op} ${q.b} = ?`;
      if (slot === 'a')      return `? ${q.op} ${q.b} = ${q.sum}`;
      return `${q.a} ${q.op} ? = ${q.sum}`;
    }
    case 'compare':      return `${q.a} ⚖ ${q.b}`;
    case 'rozklad':      return `${q.part} + ? = ${q.total}`;
    case 'sequence':     return q.seq.map((n, i) => i === q.pos ? '?' : n).join(', ');
    case 'rozklad20':    return `${q.part} + ? = ${q.total}`;
    case 'seqstep':      return q.seq.map((n, i) => i === q.pos ? '?' : n).join(', ');
    case 'peniaze':      return `Prasiatko: ${q.items.map(i=>i.val+'€').join('+')} = ${q.total}€`;
    case 'wordproblem':  return q.prompt;
    case 'magic':        return 'Magický štvorec';
  }
  return q.type;
}

function startAttempt(q) {
  currentAttempt = {
    type: q.type,
    variant: q.variant || null,
    label: questionLabel(q),
    correct: q.type === 'compare' ? (q.answer === 'L' ? `vľavo (${q.a})` : `vpravo (${q.b})`) : String(q.answer),
    given: [],
    mistakes: 0,
    startedAt: Date.now(),
  };
}

function recordWrongInAttempt(given) {
  if (!currentAttempt) return;
  currentAttempt.mistakes++;
  currentAttempt.given.push(String(given));
}

function finalizeAttempt(givenCorrect) {
  if (!currentAttempt) return;
  const timeMs = Date.now() - currentAttempt.startedAt;
  const a = currentAttempt;
  a.timeMs = timeMs;
  a.ts = Date.now();
  if (givenCorrect !== undefined) a.given.push(String(givenCorrect));

  // Push & cap
  stats.attempts.push(a);
  if (stats.attempts.length > STATS_CAP) stats.attempts.shift();

  // Aggregate per type
  const t = stats.perType[a.type] || { count: 0, correct: 0, totalTimeMs: 0, mistakes: 0 };
  t.count++;
  t.correct++;
  t.totalTimeMs += timeMs;
  t.mistakes += a.mistakes;
  stats.perType[a.type] = t;

  // Days active
  const day = todayKey();
  if (!stats.daysActive.includes(day)) stats.daysActive.push(day);
  // Keep daysActive bounded
  if (stats.daysActive.length > 365) stats.daysActive = stats.daysActive.slice(-365);

  currentAttempt = null;
  saveStats();
}

function saveStats() {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch (e) {}
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.attempts)) stats.attempts = data.attempts.slice(-STATS_CAP);
    if (data.perType && typeof data.perType === 'object') stats.perType = data.perType;
    if (Array.isArray(data.daysActive)) stats.daysActive = data.daysActive;
  } catch (e) {}
}

function clearStats() {
  stats.attempts = [];
  stats.perType = {};
  stats.daysActive = [];
  try { localStorage.removeItem(STATS_KEY); } catch (e) {}
}

function totalQuestionsAnswered() {
  return stats.attempts.length > STATS_CAP - 1
    ? Object.values(stats.perType).reduce((s, t) => s + t.count, 0)
    : Object.values(stats.perType).reduce((s, t) => s + t.count, 0);
}

function totalTimeMs() {
  return Object.values(stats.perType).reduce((s, t) => s + t.totalTimeMs, 0);
}

function totalMistakes() {
  return Object.values(stats.perType).reduce((s, t) => s + t.mistakes, 0);
}

function overallAccuracy() {
  const total = totalQuestionsAnswered();
  if (total === 0) return null;
  const m = totalMistakes();
  // Accuracy = correct first-try / total
  const firstTryCorrect = total - stats.attempts.filter(a => a.mistakes > 0).length
    - (Math.max(0, m - stats.attempts.reduce((s,a) => s + a.mistakes, 0))); // safety
  // Simpler formula: 1 - (mistakes / (total + mistakes))
  return 1 - (m / Math.max(1, total + m));
}

function streakDays() {
  if (!stats.daysActive.length) return 0;
  const set = new Set(stats.daysActive);
  let streak = 0;
  const d = new Date();
  while (true) {
    const k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    if (set.has(k)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      // allow today to be missing only if streak >0
      if (streak === 0) {
        d.setDate(d.getDate() - 1);
        const k2 = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        if (set.has(k2)) { streak = 1; d.setDate(d.getDate() - 1); continue; }
      }
      break;
    }
  }
  return streak;
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return S.time.seconds(s);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? S.time.minSec(m, rs) : S.time.minOnly(m);
  const h = Math.floor(m / 60);
  return S.time.hourMin(h, m % 60);
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return S.time.justNow;
  if (diff < 3600000) return S.time.minutes(Math.floor(diff/60000));
  if (diff < 86400000) return S.time.hours(Math.floor(diff/3600000));
  const d = Math.floor(diff / 86400000);
  if (d === 1) return S.time.yesterday;
  return S.time.days(d);
}

// Returns the fox SVG markup
function foxSvg() {
  return `<svg class="fox" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="155" rx="48" ry="32" fill="#d97a3c"/>
    <ellipse cx="100" cy="158" rx="32" ry="20" fill="#fff5e6"/>
    <path d="M 145 150 Q 175 130 168 100 Q 158 115 150 135 Z" fill="#d97a3c"/>
    <path d="M 162 108 Q 172 102 170 95 Q 162 100 160 110 Z" fill="#fff5e6"/>
    <ellipse cx="100" cy="95" rx="52" ry="46" fill="#e88a4a"/>
    <path d="M 60 65 L 50 25 L 80 55 Z" fill="#d97a3c"/>
    <path d="M 140 65 L 150 25 L 120 55 Z" fill="#d97a3c"/>
    <path d="M 62 60 L 58 35 L 75 55 Z" fill="#3a2e1f"/>
    <path d="M 138 60 L 142 35 L 125 55 Z" fill="#3a2e1f"/>
    <ellipse cx="100" cy="110" rx="32" ry="28" fill="#fff5e6"/>
    <circle cx="72" cy="115" r="8" fill="#ffb8a0" opacity="0.7"/>
    <circle cx="128" cy="115" r="8" fill="#ffb8a0" opacity="0.7"/>
    <circle cx="82" cy="92" r="6" fill="#3a2e1f"/>
    <circle cx="118" cy="92" r="6" fill="#3a2e1f"/>
    <circle cx="84" cy="89" r="2" fill="white"/>
    <circle cx="120" cy="89" r="2" fill="white"/>
    <ellipse cx="100" cy="108" rx="5" ry="4" fill="#3a2e1f"/>
    <path d="M 100 113 Q 92 122 86 118" stroke="#3a2e1f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M 100 113 Q 108 122 114 118" stroke="#3a2e1f" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function petMarkup(species) {
  const pet = getPet(species);
  if (pet.useSvg) return foxSvg();
  return `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:140px;line-height:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,0.15));">${pet.emoji}</div>`;
}

function applyPet() {
  const w = document.getElementById('welcome-pet');
  const r = document.getElementById('result-pet');
  if (w) w.innerHTML = petMarkup(state.pet.species);
  if (r) r.innerHTML = petMarkup(state.pet.species);
  // Title and speech use pet name (gender-neutral phrasing to work for all pets)
  const title = document.getElementById('welcome-title');
  if (title) title.innerHTML = S.welcome.title(state.pet.name);
  const speech = document.getElementById('welcome-speech');
  if (speech) speech.innerHTML = S.welcome.speech(state.pet.name);
  document.title = S.welcome.docTitle(state.pet.name);
  updateWelcomeStars();
}

function updateWelcomeStars() {
  const el = document.getElementById('welcome-stars');
  if (!el) return;
  if (state.totalStars > 0) {
    el.textContent = `⭐ ${state.totalStars}`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// ========== PERSISTENCE ==========
const SAVE_KEY = 'tofik-game-v1';

function saveState() {
  const data = {
    version: 1,
    pet: state.pet,
    mode: state.mode,
    totalStars: state.totalStars,
    levels: state.levels.map(l => ({ id: l.id, done: l.done, stars: l.stars, bonus: l.bonus })),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    // Storage not available (sandboxed preview, private mode) — game continues in memory
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return false;
    if (data.pet && typeof data.pet.species === 'string' && typeof data.pet.name === 'string') {
      state.pet = data.pet;
    }
    if (data.mode === 'do10' || data.mode === 'do20' || data.mode === 'pokrocile') state.mode = data.mode;
    if (typeof data.totalStars === 'number') state.totalStars = data.totalStars;
    if (Array.isArray(data.levels)) {
      data.levels.forEach((saved, i) => {
        if (state.levels[i]) {
          state.levels[i].done = !!saved.done;
          state.levels[i].stars = saved.stars || 0;
          state.levels[i].bonus = !!saved.bonus;
        }
      });
    }
    return true;
  } catch (e) {
    return false;
  }
}

function clearSavedState() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

// Storage Persistence API — prevents browser from evicting data under storage pressure
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    const already = await navigator.storage.persisted();
    if (!already) await navigator.storage.persist();
  } catch (e) { /* API blocked or unavailable */ }
}

async function getStoragePersisted() {
  if (!navigator.storage?.persisted) return null;
  try { return await navigator.storage.persisted(); } catch (e) { return null; }
}

// Number of active levels in current mode
function activeLevelCount() {
  return state.mode === 'do10' ? 6 : 7;
}
function activeLevels() {
  return state.levels.slice(0, activeLevelCount());
}
function maxStars() {
  return activeLevelCount() * 3;
}

// ========== SCREEN NAVIGATION ==========
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  state.current = name;
}

// Called from the Start button — branches based on whether user is new or returning
function onStartClick() {
  audio.play('pet-greet');
  if (!state.mode) {
    // First time → choose difficulty
    showScreen('difficulty');
  } else {
    // Returning → go straight to map
    showScreen('map');
    renderMap();
  }
}

function selectMode(mode) {
  state.mode = mode;
  // If do10, ensure the unused 7th level is reset & not "done" from a previous do20 session
  if (mode === 'do10' && state.levels[6]) {
    state.levels[6].done = false;
    state.levels[6].stars = 0;
  }
  saveState();
  // Go to character selection
  renderPetGrid();
  showScreen('character');
}

function renderPetGrid() {
  const grid = document.getElementById('pet-grid');
  grid.innerHTML = '';
  PETS.forEach(pet => {
    const card = document.createElement('button');
    card.className = 'pet-card' + (pet.id === state.pet.species ? ' selected' : '');
    card.dataset.id = pet.id;
    if (pet.useSvg) {
      card.innerHTML = `<div class="fox-mini">${foxSvg()}</div>`;
    } else {
      card.textContent = pet.emoji;
    }
    card.addEventListener('click', () => selectPet(pet.id));
    grid.appendChild(card);
  });
  // Pre-fill name input with current pet's default if name still matches a default
  const input = document.getElementById('pet-name-input');
  if (input) {
    input.value = state.pet.name || getPet(state.pet.species).defaultName;
    input.placeholder = getPet(state.pet.species).defaultName;
  }
}

function selectPet(id) {
  state.pet.species = id;
  // Update name to new default IF current name matches any default (so kid sees the new default)
  const allDefaults = PETS.map(p => p.defaultName);
  if (!state.pet.name || allDefaults.includes(state.pet.name)) {
    state.pet.name = getPet(id).defaultName;
  }
  renderPetGrid();
}

function confirmPet() {
  const input = document.getElementById('pet-name-input');
  let name = (input && input.value || '').trim();
  if (!name) name = getPet(state.pet.species).defaultName;
  state.pet.name = name.slice(0, 16);
  saveState();
  applyPet();
  showScreen('map');
  renderMap();
}

function startGame() { showScreen('map'); renderMap(); }
function goWelcome() { showScreen('welcome'); updateWelcomeStars(); }
function goMap() { stopAllSensors(); stopBonusTimer(); state.inBonus = false; showScreen('map'); renderMap(); checkWin(); }

// Jump straight into the next undone level (primary action from the map)
function continueToCurrentLevel() {
  const firstUndoneIdx = activeLevels().findIndex(l => !l.done);
  if (firstUndoneIdx >= 0) {
    startLevel(firstUndoneIdx);
  }
  // If all done, checkWin() in goMap() already handles the win screen
}

// ========== PARENT SCREEN ==========
let parentReturnTo = 'welcome';

function openParent() {
  parentReturnTo = state.current;
  stopAllSensors();
  renderParentStats();
  showScreen('parent');
}

function closeParent() {
  showScreen(parentReturnTo);
  if (parentReturnTo === 'map') renderMap();
}

function renderParentStats() {
  const root = document.getElementById('parent-content');
  const total = totalQuestionsAnswered();

  const audioHtml = `
    <div class="parent-audio">
      <div class="parent-audio-row">
        <label>${S.parent.audio}</label>
        <button class="audio-toggle ${audio.isMuted() ? 'muted' : ''}" id="parent-audio-toggle"
                onclick="audio.setMuted(!audio.isMuted()); this.textContent=audio.isMuted()?'${S.parent.audioOff}':'${S.parent.audioOn}'; this.classList.toggle('muted',audio.isMuted()); document.getElementById('vol-slider').disabled=audio.isMuted(); const mb=document.getElementById('map-mute-btn'); if(mb) mb.textContent=audio.isMuted()?'🔇':'🔊';">
          ${audio.isMuted() ? S.parent.audioOff : S.parent.audioOn}
        </button>
      </div>
      <div class="parent-audio-row">
        <label>${S.parent.volume}</label>
        <input type="range" id="vol-slider" min="0" max="100"
               value="${Math.round(audio.getVolume() * 100)}"
               ${audio.isMuted() ? 'disabled' : ''}
               oninput="audio.setVolume(this.value / 100)">
      </div>
    </div>
    <div class="storage-status-wrap" id="storage-status">
      <span class="storage-status-icon">⏳</span>
      <span class="storage-status-text">${S.parent.storageChecking}</span>
    </div>
  `;
  // Async: fill in real storage persistence status after render
  getStoragePersisted().then(persisted => {
    const el = document.getElementById('storage-status');
    if (!el) return;
    if (persisted === null) {
      el.innerHTML = `<span class="storage-status-icon">ℹ️</span><span class="storage-status-text">${S.parent.storageUnavailable}</span>`;
    } else if (persisted) {
      el.innerHTML = `<span class="storage-status-icon">🔒</span><span class="storage-status-text">${S.parent.storageProtected}</span>`;
      el.classList.add('storage-ok');
    } else {
      el.innerHTML = `<span class="storage-status-icon">⚠️</span><span class="storage-status-text">${S.parent.storageUnprotected}</span><button class="storage-persist-btn" onclick="requestPersistentStorage().then(()=>renderParentStats())">${S.parent.storageBtn}</button>`;
      el.classList.add('storage-warn');
    }
  });

  if (total === 0) {
    root.innerHTML = audioHtml + `
      <div class="parent-empty">${S.parent.noStats}</div>
      <div class="parent-actions">
        <button class="btn-danger" onclick="confirmRestart()">${S.parent.restartBtn}</button>
        <button class="btn-secondary" id="check-update-btn" onclick="checkForUpdate()">${S.parent.updateCheck}</button>
      </div>
    `;
    return;
  }

  const acc = overallAccuracy();
  const time = totalTimeMs();
  const avgTime = time / total;
  const streak = streakDays();
  const mistakes = totalMistakes();

  // Per-skill aggregates with accuracy + average time
  const skills = Object.keys(stats.perType).map(type => {
    const t = stats.perType[type];
    const acc = 1 - (t.mistakes / Math.max(1, t.count + t.mistakes));
    const avgMs = t.totalTimeMs / t.count;
    return { type, ...t, accuracy: acc, avgMs };
  }).sort((a, b) => a.accuracy - b.accuracy); // worst first → "needs practice" at top

  // Recent mistakes (last 10 with mistakes > 0)
  const wrongAttempts = stats.attempts
    .filter(a => a.mistakes > 0)
    .slice(-10)
    .reverse();

  root.innerHTML = audioHtml + `
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">${total}</div>
        <div class="stat-label">${S.parent.statTotal}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num ${acc >= 0.85 ? 'green' : (acc >= 0.65 ? 'orange' : '')}">${Math.round(acc * 100)}%</div>
        <div class="stat-label">${S.parent.statAccuracy}</div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">${formatDuration(time)}</div>
        <div class="stat-label">${S.parent.statTime}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${(avgTime/1000).toFixed(1)} s</div>
        <div class="stat-label">${S.parent.statAvgTime}</div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num orange">🔥 ${streak}</div>
        <div class="stat-label">${S.parent.statStreak}</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${mistakes}</div>
        <div class="stat-label">${S.parent.statMistakes}</div>
      </div>
    </div>

    <div class="parent-h3">${S.parent.bySkill}</div>
    ${renderSkillRows(skills)}

    <div class="parent-h3">${S.parent.recentMistakes}</div>
    ${renderRecentMistakes(wrongAttempts)}

    <div class="parent-actions">
      <button class="btn-danger" onclick="confirmRestart()">${S.parent.restartBtn}</button>
      <button class="btn-danger" onclick="confirmResetStats()">${S.parent.resetStatsBtn}</button>
      <button class="btn-secondary" id="check-update-btn" onclick="checkForUpdate()">${S.parent.updateCheck}</button>
    </div>

    <div style="text-align:center; font-size:11px; color:var(--c-ink-soft); margin-top:14px; padding:0 12px;">
      ${S.parent.privacy}
    </div>
  `;
}

function renderSkillRows(skills) {
  if (!skills.length) return `<div class="parent-empty">${S.parent.noSkillData}</div>`;
  return skills.map(s => {
    const info = SKILL_INFO[s.type] || { icon: '•', name: s.type };
    const pct = Math.round(s.accuracy * 100);
    const cls = s.accuracy >= 0.85 ? 'good' : (s.accuracy >= 0.65 ? 'mid' : 'low');
    const color = s.accuracy >= 0.85 ? 'var(--c-green)' : (s.accuracy >= 0.65 ? 'var(--c-accent)' : 'var(--c-accent-2)');
    return `
      <div class="skill-row">
        <div class="skill-icon">${info.icon}</div>
        <div class="skill-info">
          <div class="skill-name">${info.name}</div>
          <div class="skill-meta">${S.parent.skillMeta(s.count, (s.avgMs/1000).toFixed(1), s.mistakes)}</div>
          <div class="skill-bar"><div class="skill-bar-fill" style="width:${pct}%; background:${color};"></div></div>
        </div>
        <div class="skill-acc ${cls}">${pct}%</div>
      </div>
    `;
  }).join('');
}

function renderRecentMistakes(wrongs) {
  if (!wrongs.length) return `<div class="parent-empty">${S.parent.noMistakes}</div>`;
  return wrongs.map(a => {
    const wrongAnswers = a.given.slice(0, a.given.length - 1); // last is correct
    const given = wrongAnswers.slice(0, 2).join(', '); // show up to 2 wrong attempts
    const info = SKILL_INFO[a.type] || { icon: '•', name: a.type };
    return `
      <div class="mistake-item">
        <span style="margin-right:4px;">${info.icon}</span>
        <span class="mistake-problem">${a.label}</span>
        <span class="mistake-given">${given || '—'}</span>
        <span class="mistake-correct">${a.correct}</span>
        <span class="mistake-time">${formatRelative(a.ts)}</span>
      </div>
    `;
  }).join('');
}

function confirmResetStats() {
  if (confirm(S.confirm.resetStats)) {
    clearStats();
    renderParentStats();
  }
}

function confirmChangeDifficulty() {
  if (confirm(S.confirm.changeDifficulty)) restartGame();
}

function restartGame() {
  // Full reset: clear progress and stored state, return to difficulty choice
  state.totalStars = 0;
  state.inBonus = false;
  state.levels.forEach(l => { l.done = false; l.stars = 0; l.bonus = false; });
  state.mode = null;
  clearSavedState();
  showScreen('difficulty');
}

function resetProgressOnly() {
  // Keep pet + mode, reset only progress
  state.totalStars = 0;
  state.inBonus = false;
  state.levels.forEach(l => { l.done = false; l.stars = 0; l.bonus = false; });
  saveState();
  renderMap();
}

function checkWin() {
  if (activeLevels().every(l => l.done)) {
    setTimeout(() => {
      document.getElementById('final-stars').textContent = state.totalStars;
      document.getElementById('final-stars-max').textContent = maxStars();
      const winSpeech = document.querySelector('#screen-win .speech');
      if (winSpeech) winSpeech.textContent = S.win.speech;
      audio.play('game-complete');
      showScreen('win');
    }, 600);
  }
}

// ========== MAP RENDERING ==========
function renderMap() {
  const canvas = document.getElementById('map-canvas');
  // remove old nodes
  canvas.querySelectorAll('.node').forEach(n => n.remove());

  const active = activeLevels();
  const firstUndone = active.findIndex(l => !l.done);

  active.forEach((lvl, idx) => {
    const node = document.createElement('div');
    node.className = 'node';
    if (lvl.done) node.classList.add('done');
    else if (idx === firstUndone) node.classList.add('current');
    else node.classList.add('locked');

    node.style.left = lvl.x + '%';
    node.style.top = lvl.y + '%';

    node.innerHTML = `
      <div class="node-icon">${lvl.icon}</div>
      <div class="node-num">${lvl.name}</div>
      ${lvl.done ? `<div class="node-stars">${'⭐'.repeat(lvl.stars)}${lvl.bonus ? '<span class="node-bonus-star">🌟</span>' : ''}</div>` : ''}
    `;

    if (!node.classList.contains('locked')) {
      node.addEventListener('click', () => startLevel(idx));
    }
    canvas.appendChild(node);
  });

  // Update SVG path to match active node count (shorter path in do10 mode)
  const pathEl = canvas.querySelector('.path-svg path');
  if (pathEl) {
    pathEl.setAttribute('d', state.mode === 'do10'
      ? 'M 20 92 Q 90 86 72 80 Q 5 74 24 67 Q 95 60 72 54 Q 5 47 24 41 Q 95 35 72 28'
      : 'M 20 92 Q 90 86 72 80 Q 5 74 24 67 Q 95 60 72 54 Q 5 47 24 41 Q 95 35 72 28 Q 5 22 32 12');
  }

  document.getElementById('total-stars').textContent = state.totalStars;
  const modeBtn = document.getElementById('map-mode-btn');
  if (modeBtn) modeBtn.textContent = S.modeLabels[state.mode] ?? '';
}

// ========== SENSOR HELPERS ==========
// Sensor permission state: null = untried, 'granted', 'denied', 'unavailable'
const sensors = {
  permission: null,
  tiltHandler: null,
  motionHandler: null,
};

async function requestSensorPermission() {
  if (sensors.permission) return sensors.permission;
  // iOS 13+: explicit user-gesture permission needed
  try {
    const needsOrient = typeof DeviceOrientationEvent !== 'undefined' &&
                        typeof DeviceOrientationEvent.requestPermission === 'function';
    const needsMotion = typeof DeviceMotionEvent !== 'undefined' &&
                       typeof DeviceMotionEvent.requestPermission === 'function';
    if (needsOrient) {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') { sensors.permission = 'denied'; return 'denied'; }
    }
    if (needsMotion) {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== 'granted') { sensors.permission = 'denied'; return 'denied'; }
    }
    if (typeof DeviceOrientationEvent === 'undefined' && typeof DeviceMotionEvent === 'undefined') {
      sensors.permission = 'unavailable';
      return 'unavailable';
    }
    sensors.permission = 'granted';
    return 'granted';
  } catch (e) {
    sensors.permission = 'denied';
    return 'denied';
  }
}

function startTiltListener(callback) {
  stopTiltListener();
  sensors.tiltHandler = (ev) => {
    // gamma: rotation around the y-axis [-90 .. 90], + = phone tilted right
    if (typeof ev.gamma === 'number') callback(ev.gamma);
  };
  window.addEventListener('deviceorientation', sensors.tiltHandler, true);
}

function stopTiltListener() {
  if (sensors.tiltHandler) {
    window.removeEventListener('deviceorientation', sensors.tiltHandler, true);
    sensors.tiltHandler = null;
  }
}

function startShakeListener(callback, threshold = 18) {
  stopShakeListener();
  let lastShakeAt = 0;
  sensors.motionHandler = (ev) => {
    const acc = ev.accelerationIncludingGravity || ev.acceleration;
    if (!acc) return;
    const mag = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
    // accelerationIncludingGravity has ~9.8 baseline; subtract gravity baseline
    const peak = ev.accelerationIncludingGravity ? Math.abs(mag - 9.8) : mag;
    if (peak > threshold) {
      const now = Date.now();
      if (now - lastShakeAt > 800) {
        lastShakeAt = now;
        callback();
      }
    }
  };
  window.addEventListener('devicemotion', sensors.motionHandler, true);
}

function stopShakeListener() {
  if (sensors.motionHandler) {
    window.removeEventListener('devicemotion', sensors.motionHandler, true);
    sensors.motionHandler = null;
  }
}

function stopAllSensors() {
  stopTiltListener();
  stopShakeListener();
  audio.tiltStop();
}

// ========== LEVEL FLOW ==========
function startLevel(idx) {
  state.levelIdx = idx;
  state.questionIdx = 0;
  state.mistakesInLevel = 0;
  state.inBonus = false;
  state.currentQuestions = generateQuestions(getLevelType(idx));
  showScreen('level');
  renderQuestion();
}

function maybeRevealHelp() {
  if (state.wrongOnQuestion >= 3) {
    document.getElementById('help-btn')?.removeAttribute('hidden');
  }
}

function renderQuestion() {
  const q = state.currentQuestions[state.questionIdx];
  const prompt = document.getElementById('q-prompt');
  const visual = document.getElementById('q-visual');
  const grid = document.getElementById('answer-grid');
  const progress = document.getElementById('progress-fill');

  state.wrongOnQuestion = 0;
  prompt.textContent = q.prompt;
  visual.innerHTML = '';
  grid.innerHTML = '';

  progress.style.width = ((state.questionIdx) / QUESTIONS_PER_LEVEL * 100) + '%';

  // Start tracking this attempt. For shake rozklad variant, the question text
  // changes after scatter, so the renderRozkladShake will (re)start the timer
  // when the actual ask is shown.
  startAttempt(q);

  switch (q.type) {
    case 'count': {
      // Stagger animation
      [...q.visual].forEach((char, i) => {
        const span = document.createElement('span');
        span.className = 'visual-item';
        span.textContent = char;
        span.style.animationDelay = (i * 60) + 'ms';
        visual.appendChild(span);
      });
      renderAnswerButtons(q.options, q.answer);
      break;
    }
    case 'add5':
    case 'add10': {
      const slot = q.slot || 'result';
      const lhs = slot === 'a' ? '<span class="blank slot-blank" data-slot="a">&nbsp;</span>' : `<span>${q.a}</span>`;
      const rhs = slot === 'b' ? '<span class="blank slot-blank" data-slot="b">&nbsp;</span>' : `<span>${q.b}</span>`;
      const res = slot === 'result' ? '<span class="blank slot-blank" data-slot="result">&nbsp;</span>' : `<span>${q.sum}</span>`;
      visual.innerHTML = `<div class="equation">${lhs}<span class="op">+</span>${rhs}<span class="op">=</span>${res}</div>`;
      // Visual hint below equation
      {
        const hint = document.createElement('div');
        hint.className = 'addend-hint';
        const makeEmoji = (count, offset) => {
          const wrap = document.createElement('span');
          wrap.className = 'addend-known';
          for (let i = 0; i < count; i++) {
            const sp = document.createElement('span');
            sp.className = 'addend-emoji';
            sp.style.animationDelay = ((offset + i) * 70) + 'ms';
            sp.textContent = q.emoji;
            wrap.appendChild(sp);
          }
          return wrap;
        };
        const makeSep = () => {
          const sp = document.createElement('span');
          sp.className = 'addend-sep';
          sp.textContent = '+';
          return sp;
        };
        const makeMystery = () => {
          const sp = document.createElement('span');
          sp.className = 'addend-mystery';
          sp.textContent = '?';
          return sp;
        };
        if (slot === 'result') {
          hint.appendChild(makeEmoji(q.a, 0));
          hint.appendChild(makeSep());
          hint.appendChild(makeEmoji(q.b, q.a));
        } else if (slot === 'a') {
          hint.appendChild(makeMystery());
          hint.appendChild(makeSep());
          hint.appendChild(makeEmoji(q.b, 0));
        } else {
          hint.appendChild(makeEmoji(q.a, 0));
          hint.appendChild(makeSep());
          hint.appendChild(makeMystery());
        }
        visual.appendChild(hint);
      }
      renderAnswerButtons(q.options, q.answer);
      break;
    }
    case 'compare': {
      if (q.variant === 'scale') {
        renderCompareScale(q, visual);
      } else {
        const wrap = document.createElement('div');
        wrap.className = 'compare-groups';
        const L = document.createElement('div');
        L.className = 'compare-group';
        // For large numbers (pokrocile) show just the numeral, not an emoji grid
        if (q.a > 10) {
          L.innerHTML = `<span class="compare-big-num">${q.a}</span>`;
        } else {
          L.innerHTML = q.emoji.repeat(q.a);
        }
        L.addEventListener('click', () => handleCompare(L, 'L', q.answer));
        const R = document.createElement('div');
        R.className = 'compare-group right';
        if (q.b > 10) {
          R.innerHTML = `<span class="compare-big-num">${q.b}</span>`;
        } else {
          R.innerHTML = q.emoji.repeat(q.b);
        }
        R.addEventListener('click', () => handleCompare(R, 'R', q.answer));
        wrap.appendChild(L); wrap.appendChild(R);
        visual.appendChild(wrap);
      }
      // No answer buttons (compare uses groups themselves)
      break;
    }
    case 'seqstep':
    case 'sequence': {
      const row = document.createElement('div');
      row.className = 'sequence-row';
      q.seq.forEach((n, i) => {
        const cell = document.createElement('div');
        cell.className = 'seq-cell' + (i === q.pos ? ' blank' : '');
        cell.textContent = i === q.pos ? '?' : n;
        row.appendChild(cell);
      });
      visual.appendChild(row);
      renderAnswerButtons(q.options, q.answer);
      break;
    }
    case 'rozklad20':
    case 'rozklad': {
      if (q.variant === 'shake') {
        renderRozkladShake(q, visual);
      } else {
        const tree = document.createElement('div');
        tree.className = 'rozklad-tree';
        const dotCountLeft = Math.min(10, q.part);
        tree.innerHTML = `
          <div class="rozklad-top">${q.total}</div>
          <svg class="rozklad-lines" viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden="true">
            <line x1="100" y1="2" x2="50"  y2="28" stroke="#6b5a45" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>
            <line x1="100" y1="2" x2="150" y2="28" stroke="#6b5a45" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>
          </svg>
          <div class="rozklad-branches">
            <div class="rozklad-part">
              <div class="part-num">${q.part}</div>
              <div class="part-dots">${q.emoji.repeat(dotCountLeft)}</div>
            </div>
            <div class="rozklad-part unknown">
              <div class="part-num">?</div>
            </div>
          </div>
        `;
        visual.appendChild(tree);
        renderAnswerButtons(q.options, q.answer);
      }
      break;
    }
    case 'addsub20': {
      const slot = q.slot || 'result';
      const lhs = slot === 'a' ? '<span class="blank slot-blank" data-slot="a">&nbsp;</span>' : `<span>${q.a}</span>`;
      const rhs = slot === 'b' ? '<span class="blank slot-blank" data-slot="b">&nbsp;</span>' : `<span>${q.b}</span>`;
      const res = slot === 'result' ? '<span class="blank slot-blank" data-slot="result">&nbsp;</span>' : `<span>${q.sum}</span>`;
      visual.innerHTML = `<div class="equation">${lhs}<span class="op">${q.op}</span>${rhs}<span class="op">=</span>${res}</div>`;
      // Show dot hints only when result is unknown — otherwise hints would reveal the answer
      if (slot === 'result') {
        const dots = document.createElement('div');
        dots.className = 'big-num-hint';
        if (q.isAdd) {
          dots.innerHTML = makeGroupedDots(q.a, q.emoji) +
                           '<span class="dot-sep">+</span>' +
                           makeGroupedDots(q.b, q.emoji);
        } else {
          let html = '';
          for (let i = 0; i < q.a; i++) {
            const faded = i >= (q.a - q.b);
            html += `<span class="${faded ? 'dot-faded' : ''}">${q.emoji}</span>`;
          }
          dots.innerHTML = html;
        }
        visual.appendChild(dots);
      }
      renderAnswerButtons(q.options, q.answer);
      break;
    }
    case 'peniaze': {
      renderPeniazeScatter(q, visual);
      // answer buttons rendered after scatter completes
      break;
    }
    case 'wordproblem': {
      prompt.classList.add('wordproblem-prompt');
      const wpHelpWrap = document.createElement('div');
      wpHelpWrap.className = 'wp-help-wrap';
      const wpHelpBtn = document.createElement('button');
      wpHelpBtn.id = 'help-btn';
      wpHelpBtn.className = 'btn secondary wp-help-btn';
      wpHelpBtn.textContent = S.help.show;
      wpHelpBtn.hidden = true;
      const wpHelpPanel = document.createElement('div');
      wpHelpPanel.className = 'wp-help-panel';
      wpHelpPanel.hidden = true;
      buildWpHint(wpHelpPanel, q);
      wpHelpBtn.addEventListener('click', () => {
        wpHelpPanel.hidden = !wpHelpPanel.hidden;
        wpHelpBtn.textContent = wpHelpPanel.hidden ? S.help.show : S.help.hide;
        audio.play('tap');
      });
      wpHelpWrap.appendChild(wpHelpBtn);
      wpHelpWrap.appendChild(wpHelpPanel);
      visual.appendChild(wpHelpWrap);
      renderAnswerButtons(q.options, q.answer);
      break;
    }
    case 'magic': {
      // Sparkle decoration
      const sparkles = document.createElement('div');
      sparkles.className = 'magic-sparkles';
      sparkles.innerHTML = '✨ 🌟 ✨';
      visual.appendChild(sparkles);

      const grid = document.createElement('div');
      grid.className = 'magic-grid';
      q.grid.forEach((num, i) => {
        const cell = document.createElement('div');
        cell.className = 'magic-cell' + (i === q.blankPos ? ' magic-blank' : '');
        cell.textContent = i === q.blankPos ? '?' : num;
        grid.appendChild(cell);
      });
      visual.appendChild(grid);

      // Help button + collapsible panel
      const helpWrap = document.createElement('div');
      helpWrap.className = 'magic-help-wrap';
      const helpBtn = document.createElement('button');
      helpBtn.id = 'help-btn';
      helpBtn.className = 'btn secondary magic-help-btn';
      helpBtn.textContent = S.help.needHelp;
      helpBtn.hidden = true;
      const helpPanel = document.createElement('div');
      helpPanel.className = 'magic-help-panel';
      helpPanel.hidden = true;
      helpPanel.innerHTML = `
        <div class="magic-help-icon">🔮</div>
        <div class="magic-help-text">
          ${S.help.magicRule}
        </div>
        <div class="magic-help-sum">${S.help.magicSum(q.sum)}</div>
      `;
      helpBtn.addEventListener('click', () => {
        helpPanel.hidden = !helpPanel.hidden;
        helpBtn.textContent = helpPanel.hidden ? S.help.needHelp : S.help.hide;
        audio.play('tap');
      });
      helpWrap.appendChild(helpBtn);
      helpWrap.appendChild(helpPanel);
      visual.appendChild(helpWrap);

      renderAnswerButtons(q.options, q.answer);
      break;
    }
  }
}

function renderAnswerButtons(options, correct) {
  const grid = document.getElementById('answer-grid');
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => handleAnswer(btn, opt, correct));
    grid.appendChild(btn);
  });
}

function fillAnswerVisual(chosen) {
  audio.play('pop');
  const visual = document.getElementById('q-visual');
  if (!visual) return;
  // Equation-based (add5, add10, addsub20): fill the slot-blank
  const blank = visual.querySelector('.slot-blank');
  if (blank) {
    blank.textContent = chosen;
    blank.innerHTML = blank.textContent; // strip any &nbsp;
    blank.classList.add('filled');
    return;
  }
  // Sequence: fill the blank cell
  const seqBlank = visual.querySelector('.seq-cell.blank');
  if (seqBlank) {
    seqBlank.textContent = chosen;
    seqBlank.classList.add('filled');
    return;
  }
  // Rozklad tree: fill the unknown part-num
  const unknown = visual.querySelector('.rozklad-part.unknown');
  if (unknown) {
    const num = unknown.querySelector('.part-num');
    const dots = unknown.querySelector('.part-dots');
    if (num) { num.textContent = chosen; num.classList.add('filled'); }
    if (dots) { dots.textContent = '✓'; }
    unknown.classList.add('filled-host');
    return;
  }
  // Rozklad shake: fill the hidden basket label
  const hidden = visual.querySelector('.basket-label.hidden-q');
  if (hidden) {
    hidden.textContent = chosen;
    hidden.classList.add('filled');
    return;
  }
  // Magic square: fill the blank cell
  const magicBlank = visual.querySelector('.magic-blank');
  if (magicBlank) {
    magicBlank.textContent = chosen;
    magicBlank.classList.add('filled');
    return;
  }
}

function handleAnswer(btn, chosen, correct) {
  if (btn.disabled) return;
  if (chosen === correct) {
    audio.play('correct');
    finalizeAttempt(chosen);
    btn.classList.add('correct');
    document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
    fillAnswerVisual(chosen);
    showFeedback(pick(S.feedback.correct));
    setTimeout(advance, 1200);
  } else {
    audio.play('wrong');
    recordWrongInAttempt(chosen);
    btn.classList.add('wrong');
    if (state.inBonus) {
      setTimeout(() => {
        btn.classList.remove('wrong');
        state.inBonus = false;
        finishLevel();
      }, 700);
      showFeedback(S.feedback.bonusTimeout, true);
    } else {
      state.mistakesInLevel++;
      state.wrongOnQuestion++;
      maybeRevealHelp();
      setTimeout(() => { btn.classList.remove('wrong'); btn.disabled = false; }, 600);
      showFeedback(S.feedback.wrong, true);
      highlightHint();
    }
  }
}

function handleCompare(group, side, correct) {
  if (group.classList.contains('correct') || group.classList.contains('wrong')) return;
  if (side === correct) {
    audio.play('correct');
    finalizeAttempt(side === 'L' ? 'vľavo' : 'vpravo');
    group.classList.add('correct');
    document.querySelectorAll('.compare-group').forEach(g => g.style.pointerEvents = 'none');
    showFeedback(pick(S.feedback.correctShort));
    setTimeout(advance, 1000);
  } else {
    audio.play('wrong');
    recordWrongInAttempt(side === 'L' ? 'vľavo' : 'vpravo');
    group.classList.add('wrong');
    if (state.inBonus) {
      setTimeout(() => {
        group.classList.remove('wrong');
        state.inBonus = false;
        finishLevel();
      }, 700);
      showFeedback(S.feedback.bonusTimeout, true);
    } else {
      state.mistakesInLevel++;
      state.wrongOnQuestion++;
      maybeRevealHelp();
      setTimeout(() => group.classList.remove('wrong'), 600);
      showFeedback(S.feedback.wrong, true);
    }
  }
}

function highlightHint() {
  document.querySelectorAll('.visual-item').forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 800);
    }, i * 120);
  });
}

function showFeedback(text, isError = false) {
  const f = document.getElementById('feedback');
  f.textContent = text;
  f.style.color = isError ? 'var(--c-blue)' : 'var(--c-accent)';
  f.classList.remove('show');
  void f.offsetWidth; // restart animation
  f.classList.add('show');
}

function advance() {
  stopAllSensors();
  if (state.inBonus) {
    stopBonusTimer();
    state.levels[state.levelIdx].bonus = true;
    state.inBonus = false;
    finishLevel();
    return;
  }
  state.questionIdx++;
  if (state.questionIdx >= QUESTIONS_PER_LEVEL) {
    if (state.mistakesInLevel === 0) {
      showBonusPrompt();
    } else {
      finishLevel();
    }
  } else {
    renderQuestion();
  }
}

function showBonusPrompt() {
  document.getElementById('progress-fill').style.width = '100%';
  document.getElementById('q-prompt').textContent = S.bonus.label;
  document.getElementById('q-visual').innerHTML = '';
  const grid = document.getElementById('answer-grid');
  grid.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'bonus-prompt';
  wrap.innerHTML = `
    <div class="bonus-text">${S.bonus.question}</div>
    <button class="btn green" onclick="startBonusQuestion()">${S.bonus.accept}</button>
    <button class="btn secondary" style="font-size:16px;padding:12px 22px;" onclick="finishLevel()">${S.bonus.skip}</button>
  `;
  grid.appendChild(wrap);
  audio.play('pop');
}

function startBonusQuestion() {
  // Pick the type from this level's mode sequence; use tier 2 (hardest) for the bonus
  const currentType = getLevelType(state.levelIdx);
  const allTypes = LEVEL_TYPES[state.mode] ?? LEVEL_TYPES.do20;
  let bonusType = currentType;
  let minTier = difficultyTier(currentType);
  for (const t of allTypes) {
    if (t === currentType) continue;
    const tier = difficultyTier(t);
    if (tier < minTier) { minTier = tier; bonusType = t; }
  }
  const q = generateOne(bonusType, 2); // always tier 2 — hardest variant
  q.prompt = '⭐ ' + q.prompt;
  state.currentQuestions.push(q);
  state.questionIdx = QUESTIONS_PER_LEVEL;
  state.inBonus = true;
  renderQuestion();
  startBonusTimer();
}

const BONUS_SECONDS = 15;

function startBonusTimer() {
  stopBonusTimer();
  state.bonusTimeLeft = BONUS_SECONDS;
  const timerEl = document.getElementById('bonus-timer');
  timerEl.textContent = state.bonusTimeLeft;
  timerEl.className = 'bonus-timer';
  timerEl.hidden = false;

  state.bonusTimerInterval = setInterval(() => {
    if (!state.inBonus) { stopBonusTimer(); return; }
    state.bonusTimeLeft--;
    timerEl.textContent = state.bonusTimeLeft;
    if (state.bonusTimeLeft <= 5) timerEl.classList.add('urgent');
    if (state.bonusTimeLeft <= 0) {
      stopBonusTimer();
      state.inBonus = false;
      showFeedback(S.bonus.timeout, true);
      setTimeout(() => finishLevel(), 1400);
    }
  }, 1000);
}

function stopBonusTimer() {
  clearInterval(state.bonusTimerInterval);
  state.bonusTimerInterval = null;
  const timerEl = document.getElementById('bonus-timer');
  if (timerEl) timerEl.hidden = true;
}

function finishLevel() {
  stopAllSensors();
  const lvl = state.levels[state.levelIdx];
  lvl.done = true;
  // Stars: 3 perfect, 2 if 1-2 mistakes, 1 otherwise (scaled to 4 questions)
  const m = state.mistakesInLevel;
  lvl.stars = m === 0 ? 3 : (m <= 2 ? 2 : 1);
  state.totalStars += lvl.stars;

  saveState();

  // Update progress to 100% briefly
  document.getElementById('progress-fill').style.width = '100%';

  // Confetti
  launchConfetti();

  setTimeout(() => {
    audio.play('level-complete');
    showResultScreen(lvl.stars);
  }, 700);
}

function showResultScreen(stars) {
  const lvl = state.levels[state.levelIdx];
  showScreen('result');
  document.getElementById('result-title').textContent =
    lvl.bonus ? S.result.bonusTitle : (stars === 3 ? S.result.stars3 : (stars === 2 ? S.result.stars2 : S.result.stars1));
  const petName = state.pet.name;
  document.getElementById('result-speech').textContent = lvl.bonus
    ? pick(S.result.bonusSpeeches(petName))
    : pick(S.result.normalSpeeches(petName));
  const starsDisplay = document.getElementById('stars-display');
  const existingBonus = starsDisplay.querySelector('.star-bonus');
  if (existingBonus) existingBonus.remove();
  const starEls = document.querySelectorAll('.star-big');
  starEls.forEach((s, i) => {
    s.classList.remove('show', 'dim');
    if (i >= stars) s.classList.add('dim');
  });
  starEls.forEach((s, i) => {
    setTimeout(() => {
      s.classList.add('show');
      if (i < stars) audio.play('star', i);
    }, 200 + i * 300);
  });
  if (lvl.bonus) {
    const bonusStar = document.createElement('div');
    bonusStar.className = 'star-bonus';
    bonusStar.innerHTML = '<svg viewBox="0 0 24 24" fill="#f2c94c"><path d="M12 2 L15 9 L22 10 L17 15 L18 22 L12 18 L6 22 L7 15 L2 10 L9 9 Z" stroke="#d4a017" stroke-width="0.8"/></svg>';
    starsDisplay.appendChild(bonusStar);
    setTimeout(() => {
      bonusStar.classList.add('show');
      audio.play('star', 3);
    }, 200 + 3 * 300);
  }
}

// ========== CONFETTI ==========
function launchConfetti() {
  const colors = ['#ff8c42','#f2c94c','#5ca85c','#5fb7d4','#f25c54','#ffffff'];
  const app = document.querySelector('.app');
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = (Math.random() * 100) + '%';
    c.style.background = pick(colors);
    c.style.animation = `fall ${1.5 + Math.random()}s linear ${Math.random() * 0.5}s forwards`;
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    app.appendChild(c);
    setTimeout(() => c.remove(), 3500);
  }
}

// ========== RESTART CONFIRMATION ==========
function confirmRestart() {
  if (confirm(S.confirm.restart)) {
    restartGame();
  }
}

function toggleMute() {
  audio.setMuted(!audio.isMuted());
  const icon = audio.isMuted() ? '🔇' : '🔊';
  const muteBtn = document.getElementById('map-mute-btn');
  if (muteBtn) muteBtn.textContent = icon;
}

// ========== INITIALIZATION ==========
function init() {
  bindQuestions(state, stats);
  bindMechanics({
    requestSensorPermission, startTiltListener, stopTiltListener,
    startShakeListener, stopShakeListener,
    finalizeAttempt,
    setCurrentAttempt: (a) => { currentAttempt = a; },
    handleAnswer, handleCompare,
    showFeedback, advance,
    renderAnswerButtons,
  });
  audio.init();
  loadState();
  loadStats();
  applyPet();
  requestPersistentStorage();

  // Long-press on stars counter (map screen) opens parent stats
  const starsCounter = document.querySelector('.stars-total');
  if (starsCounter) {
    setupLongPress(starsCounter, openParent, 1000);
  }

  // If returning user (has progress), update start button label
  const hasProgress = state.mode && (state.totalStars > 0 || state.levels.some(l => l.done));
  const startBtn = document.getElementById('start-btn');
  if (hasProgress && startBtn) {
    startBtn.textContent = S.welcome.continueBtn;
    const speech = document.getElementById('welcome-speech');
    if (speech) speech.innerHTML = S.welcome.speechReturn;
  }
}

// Long-press gesture helper
function setupLongPress(el, callback, ms = 1000) {
  let timer = null;
  let startX = 0, startY = 0;
  const fire = () => { timer = null; callback(); };
  const start = (x, y) => {
    startX = x; startY = y;
    cancel();
    timer = setTimeout(fire, ms);
  };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  const move = (x, y) => {
    if (Math.abs(x - startX) > 12 || Math.abs(y - startY) > 12) cancel();
  };
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    start(t.clientX, t.clientY);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    move(t.clientX, t.clientY);
  }, { passive: true });
  el.addEventListener('touchend', cancel);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
  el.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
  el.addEventListener('mouseup', cancel);
  el.addEventListener('mouseleave', cancel);
}

// ========== SERVICE WORKER (for PWA install + update detection) ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      window._swReg = reg;
      const onWaiting = () => showUpdateBanner(reg);

      // New SW waiting right after registration (page refreshed while update pending)
      if (reg.waiting) onWaiting();

      // Periodic update check every 60 min — catches updates while app stays open
      setInterval(() => reg.update(), 60 * 60 * 1000);

      // New SW found during this session
      reg.addEventListener('updatefound', () => {
        reg.installing.addEventListener('statechange', function () {
          if (this.state === 'installed' && navigator.serviceWorker.controller) onWaiting();
        });
      });

      // After SKIP_WAITING the controller changes — reload to get new assets
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    }).catch(() => {
      // SW only works when served over http(s); fails silently in file:// or sandboxed previews
    });
  });
}

function showUpdateBanner(reg) {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span>${S.update.available}</span>
    <button class="btn" onclick="applyUpdate()">${S.update.btn}</button>
  `;
  document.querySelector('.app').appendChild(banner);
  window._swReg = reg;
}

function applyUpdate() {
  const reg = window._swReg;
  if (reg?.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else {
    location.reload();
  }
}

async function checkForUpdate() {
  const btn = document.getElementById('check-update-btn');
  const reg = window._swReg;
  if (!reg || !btn) return;
  btn.disabled = true;
  btn.textContent = S.parent.updateChecking;
  try {
    await reg.update();
    // Give the updatefound event 3 s to fire and show the banner
    setTimeout(() => {
      if (!document.getElementById('update-banner')) {
        btn.textContent = S.parent.updateCurrent;
        btn.disabled = false;
      }
    }, 3000);
  } catch {
    btn.textContent = S.parent.updateCheck;
    btn.disabled = false;
  }
}

// Unlock AudioContext pri prvom user gesture
document.addEventListener('click', function _unlock() {
  audio.unlock();
  document.removeEventListener('click', _unlock, true);
}, { capture: true, once: true });

// Globálny tap zvuk
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn, .answer-btn, .node, .pet-card, .diff-card, .icon-btn, .map-mute-btn, .shake-prompt, .audio-toggle')) {
    audio.play('tap');
  }
}, { capture: true });

// Pauza zvuku keď je tab skrytý
document.addEventListener('visibilitychange', () => {
  if (typeof Tone === 'undefined') return;
  try {
    const ctx = Tone.getContext().rawContext;
    document.hidden ? ctx.suspend() : ctx.resume();
  } catch(e) {}
});

// Boot
init();

// Expose functions to global scope for HTML inline event handlers
// (required when app.js is loaded as an ES module)
Object.assign(window, {
  onStartClick, selectMode, showScreen, confirmPet,
  goWelcome, goMap, continueToCurrentLevel,
  openParent, closeParent,
  toggleMute, restartGame,
  startBonusQuestion, finishLevel,
  confirmRestart, confirmResetStats, confirmChangeDifficulty,
  requestPersistentStorage, renderParentStats,
  applyUpdate, checkForUpdate,
  audio,
});
