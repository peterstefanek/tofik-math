// ========== GAME STATE ==========
const state = {
  current: 'welcome',
  levelIdx: 0,
  questionIdx: 0,
  mistakesInLevel: 0,
  totalStars: 0,
  pet: { species: 'fox', name: 'Tofík' },
  mode: null, // 'do10' | 'do20' — null until chosen
  levels: [
    { id: 0, name: 'Lúka',     icon: '🌼', x: 20, y: 92, type: 'count',    done: false, stars: 0 },
    { id: 1, name: 'Sad',      icon: '🍎', x: 72, y: 80, type: 'add5',     done: false, stars: 0 },
    { id: 2, name: 'Vodopád',  icon: '💧', x: 24, y: 67, type: 'rozklad',  done: false, stars: 0 },
    { id: 3, name: 'Jazierko', icon: '🐟', x: 72, y: 54, type: 'compare',  done: false, stars: 0 },
    { id: 4, name: 'Jaskyňa',  icon: '🐻', x: 24, y: 41, type: 'add10',    done: false, stars: 0 },
    { id: 5, name: 'Vrchol',   icon: '⛰️', x: 72, y: 28, type: 'sequence', done: false, stars: 0 },
    { id: 6, name: 'Hviezdy',  icon: '🌟', x: 32, y: 12, type: 'addsub20', done: false, stars: 0 },
  ],
  currentQuestions: [],
};

const QUESTIONS_PER_LEVEL = 4;

// ========== PETS ==========
const PETS = [
  { id: 'fox',      emoji: '🦊', defaultName: 'Tofík',  useSvg: true  },
  { id: 'bear',     emoji: '🐻', defaultName: 'Maco',   useSvg: false },
  { id: 'rabbit',   emoji: '🐰', defaultName: 'Hopko',  useSvg: false },
  { id: 'owl',      emoji: '🦉', defaultName: 'Sovka',  useSvg: false },
  { id: 'hedgehog', emoji: '🦔', defaultName: 'Ferko',  useSvg: false },
  { id: 'cat',      emoji: '🐱', defaultName: 'Mica',   useSvg: false },
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
const AUDIO_KEY = 'tofik-audio-v1';
const STATS_CAP = 200;

const SKILL_INFO = {
  count:    { icon: '🌼', name: 'Počítanie' },
  add5:     { icon: '🍎', name: 'Sčítanie do 5' },
  rozklad:  { icon: '💧', name: 'Rozklad čísel' },
  compare:  { icon: '🐟', name: 'Porovnávanie' },
  add10:    { icon: '🐻', name: 'Sčítanie do 10' },
  sequence: { icon: '⛰️', name: 'Postupnosti' },
  addsub20: { icon: '🌟', name: '+ a − do 20' },
};

// Live tracking of current question
let currentAttempt = null;

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function questionLabel(q) {
  switch (q.type) {
    case 'count':    return `Spočítaj ${q.answer}`;
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
    case 'compare':  return `${q.a} ⚖ ${q.b}`;
    case 'rozklad':  return `${q.part} + ? = ${q.total}`;
    case 'sequence': return q.seq.map((n, i) => i === q.pos ? '?' : n).join(', ');
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
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m} m ${rs} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

function formatRelative(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'pred chvíľou';
  if (diff < 3600000) return Math.floor(diff/60000) + ' min';
  if (diff < 86400000) return Math.floor(diff/3600000) + ' h';
  const d = Math.floor(diff / 86400000);
  if (d === 1) return 'včera';
  return d + ' dní';
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
  if (title) title.innerHTML = `${state.pet.name} a<br>cesta ku hviezdam`;
  const speech = document.getElementById('welcome-speech');
  if (speech) speech.innerHTML = `Ahoj! Som <b>${state.pet.name}</b>. Snívam o hviezdach. Pomôžeš mi vyjsť na vrchol?`;
  document.title = `${state.pet.name} a cesta ku hviezdam`;
}

// ========== PERSISTENCE ==========
const SAVE_KEY = 'tofik-game-v1';

function saveState() {
  const data = {
    version: 1,
    pet: state.pet,
    mode: state.mode,
    totalStars: state.totalStars,
    levels: state.levels.map(l => ({ id: l.id, done: l.done, stars: l.stars })),
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
    if (data.mode === 'do10' || data.mode === 'do20') state.mode = data.mode;
    if (typeof data.totalStars === 'number') state.totalStars = data.totalStars;
    if (Array.isArray(data.levels)) {
      data.levels.forEach((saved, i) => {
        if (state.levels[i]) {
          state.levels[i].done = !!saved.done;
          state.levels[i].stars = saved.stars || 0;
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
function goWelcome() { showScreen('welcome'); }
function goMap() { stopAllSensors(); showScreen('map'); renderMap(); checkWin(); }

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
        <label>Zvuky</label>
        <button class="audio-toggle ${audio.isMuted() ? 'muted' : ''}" id="parent-audio-toggle"
                onclick="audio.setMuted(!audio.isMuted()); this.textContent=audio.isMuted()?'🔇 Vypnuté':'🔊 Zapnuté'; this.classList.toggle('muted',audio.isMuted()); document.getElementById('vol-slider').disabled=audio.isMuted(); const mb=document.getElementById('map-mute-btn'); if(mb) mb.textContent=audio.isMuted()?'🔇':'🔊';">
          ${audio.isMuted() ? '🔇 Vypnuté' : '🔊 Zapnuté'}
        </button>
      </div>
      <div class="parent-audio-row">
        <label>Hlasitosť</label>
        <input type="range" id="vol-slider" min="0" max="100"
               value="${Math.round(audio.getVolume() * 100)}"
               ${audio.isMuted() ? 'disabled' : ''}
               oninput="audio.setVolume(this.value / 100)">
      </div>
    </div>
  `;

  if (total === 0) {
    root.innerHTML = audioHtml + `
      <div class="parent-empty">
        Zatiaľ tu nie sú žiadne údaje.<br>
        Štatistiky sa začnú zbierať, keď dieťa odpovie na prvé otázky.
      </div>
      <div class="parent-actions">
        <button class="btn-danger" onclick="confirmRestart()">↺ Začať hru odznova</button>
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
        <div class="stat-label">otázok celkovo</div>
      </div>
      <div class="stat-card">
        <div class="stat-num ${acc >= 0.85 ? 'green' : (acc >= 0.65 ? 'orange' : '')}">${Math.round(acc * 100)}%</div>
        <div class="stat-label">úspešnosť na prvý pokus</div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">${formatDuration(time)}</div>
        <div class="stat-label">celkový čas hrania</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${(avgTime/1000).toFixed(1)} s</div>
        <div class="stat-label">priemerne na otázku</div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num orange">🔥 ${streak}</div>
        <div class="stat-label">dní v rade</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${mistakes}</div>
        <div class="stat-label">chýb spolu</div>
      </div>
    </div>

    <div class="parent-h3">Podľa zručnosti</div>
    ${renderSkillRows(skills)}

    <div class="parent-h3">Posledné chyby</div>
    ${renderRecentMistakes(wrongAttempts)}

    <div class="parent-actions">
      <button class="btn-danger" onclick="confirmRestart()">↺ Začať hru odznova</button>
      <button class="btn-danger" onclick="confirmResetStats()">Vymazať štatistiky</button>
    </div>

    <div style="text-align:center; font-size:11px; color:var(--c-ink-soft); margin-top:14px; padding:0 12px;">
      Štatistiky sa ukladajú len v tomto zariadení. Nikam sa neodosielajú.
    </div>
  `;
}

function renderSkillRows(skills) {
  if (!skills.length) return '<div class="parent-empty">Nič tu zatiaľ nie je.</div>';
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
          <div class="skill-meta">${s.count} otázok · ⌀ ${(s.avgMs/1000).toFixed(1)} s · ${s.mistakes} chýb</div>
          <div class="skill-bar"><div class="skill-bar-fill" style="width:${pct}%; background:${color};"></div></div>
        </div>
        <div class="skill-acc ${cls}">${pct}%</div>
      </div>
    `;
  }).join('');
}

function renderRecentMistakes(wrongs) {
  if (!wrongs.length) return '<div class="parent-empty">Žiadne chyby — paráda! 🎉</div>';
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
  if (confirm('Naozaj vymazať všetky štatistiky? Pokrok v hre ostane zachovaný.')) {
    clearStats();
    renderParentStats();
  }
}

function restartGame() {
  // Full reset: clear progress and stored state, return to difficulty choice
  state.totalStars = 0;
  state.levels.forEach(l => { l.done = false; l.stars = 0; });
  state.mode = null;
  clearSavedState();
  showScreen('difficulty');
}

function resetProgressOnly() {
  // Keep pet + mode, reset only progress
  state.totalStars = 0;
  state.levels.forEach(l => { l.done = false; l.stars = 0; });
  saveState();
  renderMap();
}

function checkWin() {
  if (activeLevels().every(l => l.done)) {
    setTimeout(() => {
      document.getElementById('final-stars').textContent = state.totalStars;
      document.getElementById('final-stars-max').textContent = maxStars();
      const winSpeech = document.querySelector('#screen-win .speech');
      if (winSpeech) winSpeech.textContent = `Ďakujem ti, kamarát! Zahráme si znova?`;
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
      ${lvl.done ? `<div class="node-stars">${'⭐'.repeat(lvl.stars)}</div>` : ''}
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
}

// ========== QUESTION GENERATION ==========
const EMOJI_BY_LEVEL = {
  count: ['🍎','🌻','🐝','🍓','⭐','🦋','🍄','🌸'],
  add5: ['🍎','🐝','🌻','🍓'],
  rozklad: ['💧','🌟','🍓','🐝'],
  compare: ['🐟','🐸','🦆','🐢'],
  add10: ['🍪','🌰','🍇','🥕'],
  sequence: [],
  addsub20: ['🌟','💎','🍒','🍬'],
};

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
}

function generateQuestions(type) {
  const qs = [];
  // Generate with mild deduplication so kid doesn't see same problem twice in a row
  let lastSig = '';
  let safety = 0;
  while (qs.length < QUESTIONS_PER_LEVEL && safety < 40) {
    const q = generateOne(type);
    const sig = JSON.stringify({ a: q.a, b: q.b, answer: q.answer, pos: q.pos, total: q.total, part: q.part });
    if (sig !== lastSig) {
      qs.push(q);
      lastSig = sig;
    }
    safety++;
  }
  while (qs.length < QUESTIONS_PER_LEVEL) qs.push(generateOne(type));
  return qs;
}

function generateOne(type) {
  const emoji = pick(EMOJI_BY_LEVEL[type] || ['⭐']);
  switch (type) {
    case 'count': {
      const n = 2 + rand(7); // 2-8
      return {
        type, answer: n, emoji,
        prompt: `Koľko ${pluralize(emoji)} vidíš?`,
        visual: emoji.repeat(n),
        options: makeOptions(n, 1, 10),
      };
    }
    case 'add5': {
      const a = 1 + rand(4);
      const b = 1 + rand(5 - a);
      const sum = a + b;
      // 60% standard (find result), 40% missing addend (split between a and b)
      const slot = rand(10) < 6 ? 'result' : (rand(2) === 0 ? 'a' : 'b');
      const answer = slot === 'result' ? sum : (slot === 'a' ? a : b);
      return {
        type, slot, answer, emoji,
        prompt: slot === 'result' ? 'Koľko spolu?' : 'Doplň chýbajúce číslo:',
        a, b, sum, op: '+',
        options: makeOptions(answer, 0, 10),
      };
    }
    case 'compare': {
      let a, b;
      do {
        a = 1 + rand(8);
        b = 1 + rand(8);
      } while (a === b);
      // 50/50 between tap variant and scale (tilt) variant
      const variant = rand(2) === 0 ? 'tap' : 'scale';
      return {
        type, variant, answer: a > b ? 'L' : 'R', emoji,
        prompt: variant === 'scale' ? 'Nakloň telefón k ťažšej strane!' : 'Kde je viac?',
        a, b,
      };
    }
    case 'add10': {
      const a = 1 + rand(8);
      const b = 1 + rand(Math.min(9, 10 - a));
      const sum = a + b;
      const slot = rand(10) < 6 ? 'result' : (rand(2) === 0 ? 'a' : 'b');
      const answer = slot === 'result' ? sum : (slot === 'a' ? a : b);
      return {
        type, slot, answer, emoji,
        prompt: slot === 'result' ? 'Spočítaj:' : 'Doplň chýbajúce číslo:',
        a, b, sum, op: '+',
        options: makeOptions(answer, 0, 14),
      };
    }
    case 'sequence': {
      const start = 1 + rand(5);
      const pos = 1 + rand(3); // which one is blank (0..3, but not first)
      const seq = [start, start+1, start+2, start+3, start+4];
      const answer = seq[pos];
      return {
        type, answer,
        prompt: 'Aké číslo chýba?',
        seq, pos,
        options: makeOptions(answer, 1, 10),
      };
    }
    case 'rozklad': {
      // total 5..10, split into known part + missing part
      const total = 5 + rand(6); // 5..10
      const part = 1 + rand(total - 1); // 1..total-1
      const answer = total - part;
      // 50/50 between tree and shake (beans) variant
      const variant = rand(2) === 0 ? 'tree' : 'shake';
      return {
        type, variant, answer, emoji,
        prompt: variant === 'shake'
          ? `Zatras telefónom a rozhoď ${total} fazuľ!`
          : `Koľko chýba do ${total}?`,
        total, part,
        options: makeOptions(answer, 0, 10),
      };
    }
    case 'addsub20': {
      // mix of add and subtract within 0..20, often crossing 10
      const isAdd = rand(2) === 0;
      // 65% standard, 35% missing slot (more conservative — these are harder)
      const slot = rand(20) < 13 ? 'result' : (rand(2) === 0 ? 'a' : 'b');
      let a, b, sum;
      if (isAdd) {
        // bias toward sums that cross 10
        a = 5 + rand(11); // 5..15
        const maxB = Math.min(9, 20 - a);
        b = 2 + rand(Math.max(1, maxB - 1));
        sum = a + b;
      } else {
        // a (minuend) 11..20, b (subtrahend) 2..9
        a = 11 + rand(10); // 11..20
        b = 2 + rand(8);   // 2..9
        sum = a - b;       // result
      }
      const answer = slot === 'result' ? sum : (slot === 'a' ? a : b);
      const promptStandard = isAdd ? 'Spočítaj:' : 'Odpočítaj:';
      return {
        type, slot, answer, isAdd,
        prompt: slot === 'result' ? promptStandard : 'Doplň chýbajúce číslo:',
        a, b, sum, op: isAdd ? '+' : '−', emoji,
        options: makeOptions(answer, 0, 20),
      };
    }
  }
}

function pluralize(emoji) {
  // friendly Slovak descriptors per emoji
  const map = {
    '🍎':'jabĺčok', '🌻':'kvietkov', '🐝':'včielok', '🍓':'jahôd',
    '⭐':'hviezdičiek', '🦋':'motýľov', '🍄':'hríbov', '🌸':'kvietkov',
    '💧':'kvapiek', '🌟':'hviezdičiek', '💎':'klenotov', '🍒':'čerešní', '🍬':'cukríkov',
  };
  return map[emoji] || 'vecí';
}

function makeOptions(correct, min, max) {
  const set = new Set([correct]);
  // spread proportional to range so distractors aren't all stuck right next to correct
  const range = max - min;
  const spread = Math.max(3, Math.min(6, Math.floor(range / 3)));
  let attempts = 0;
  while (set.size < 4 && attempts < 60) {
    const candidate = Math.max(min, Math.min(max, correct + (rand(spread * 2 + 1) - spread)));
    if (candidate !== correct) set.add(candidate);
    attempts++;
  }
  // Fallback if we somehow couldn't fill (very narrow ranges)
  while (set.size < 4) {
    const c = min + rand(range + 1);
    set.add(c);
  }
  return shuffle([...set]);
}

// ========== LEVEL FLOW ==========
function startLevel(idx) {
  state.levelIdx = idx;
  state.questionIdx = 0;
  state.mistakesInLevel = 0;
  state.currentQuestions = generateQuestions(state.levels[idx].type);
  showScreen('level');
  renderQuestion();
}

function renderQuestion() {
  const q = state.currentQuestions[state.questionIdx];
  const prompt = document.getElementById('q-prompt');
  const visual = document.getElementById('q-visual');
  const grid = document.getElementById('answer-grid');
  const progress = document.getElementById('progress-fill');

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
      // Dot hint only when finding the result (otherwise it would give away the answer)
      if (slot === 'result') {
        const dots = document.createElement('div');
        dots.style.fontSize = '22px';
        dots.style.marginTop = '8px';
        dots.innerHTML = q.emoji.repeat(q.a) + '<span style="opacity:0.4;margin:0 6px">+</span>' + q.emoji.repeat(q.b);
        visual.appendChild(dots);
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
        L.innerHTML = q.emoji.repeat(q.a);
        L.addEventListener('click', () => handleCompare(L, 'L', q.answer));
        const R = document.createElement('div');
        R.className = 'compare-group right';
        R.innerHTML = q.emoji.repeat(q.b);
        R.addEventListener('click', () => handleCompare(R, 'R', q.answer));
        wrap.appendChild(L); wrap.appendChild(R);
        visual.appendChild(wrap);
      }
      // No answer buttons (compare uses groups themselves)
      break;
    }
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
    case 'rozklad': {
      if (q.variant === 'shake') {
        renderRozkladShake(q, visual);
      } else {
        const tree = document.createElement('div');
        tree.className = 'rozklad-tree';
        tree.innerHTML = `
          <div class="rozklad-top">${q.total}</div>
          <svg class="rozklad-lines" viewBox="0 0 200 30" preserveAspectRatio="none" aria-hidden="true">
            <line x1="100" y1="2" x2="50"  y2="28" stroke="#6b5a45" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>
            <line x1="100" y1="2" x2="150" y2="28" stroke="#6b5a45" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>
          </svg>
          <div class="rozklad-branches">
            <div class="rozklad-part">
              <div class="part-num">${q.part}</div>
              <div class="part-dots">${q.emoji.repeat(q.part)}</div>
            </div>
            <div class="rozklad-part unknown">
              <div class="part-num">?</div>
              <div class="part-dots">${'❓'.repeat(Math.min(3, q.total - q.part))}</div>
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

// ========== SCALE (TILT) MECHANIC ==========
async function renderCompareScale(q, visual) {
  // Build scale DOM
  const wrap = document.createElement('div');
  wrap.className = 'scale-wrap';
  const heavySide = q.a > q.b ? 'L' : 'R'; // q.answer
  const itemsL = q.emoji.repeat(q.a);
  const itemsR = q.emoji.repeat(q.b);
  wrap.innerHTML = `
    <div class="scale-instruction" id="scale-instruction">Nakloň telefón k ťažšej strane!</div>
    <div class="scale-stage">
      <div class="scale-base"></div>
      <div class="scale-stand"></div>
      <div class="scale-pivot"></div>
      <div class="scale-beam-wrap" id="scale-beam-wrap">
        <div class="scale-beam"></div>
        <div class="scale-pan left">
          <div class="scale-pan-rope"></div>
          ${[...itemsL].map(e => `<span class="item">${e}</span>`).join('')}
          <div class="count-badge">${q.a}</div>
        </div>
        <div class="scale-pan right">
          <div class="scale-pan-rope"></div>
          ${[...itemsR].map(e => `<span class="item">${e}</span>`).join('')}
          <div class="count-badge">${q.b}</div>
        </div>
      </div>
      <div class="scale-arrow left ${heavySide === 'L' ? 'show' : ''}">⬅️</div>
      <div class="scale-arrow right ${heavySide === 'R' ? 'show' : ''}">➡️</div>
    </div>
    <div class="scale-progress"><div class="scale-progress-fill" id="scale-progress-fill"></div></div>
    <div class="scale-fallback" id="scale-fallback">
      <button id="scale-tilt-left">⬅️</button>
      <button id="scale-tilt-right">➡️</button>
    </div>
  `;
  visual.appendChild(wrap);

  const beamWrap = document.getElementById('scale-beam-wrap');
  const instruction = document.getElementById('scale-instruction');
  const progressFill = document.getElementById('scale-progress-fill');
  const fallback = document.getElementById('scale-fallback');

  let done = false;
  let holdMs = 0;
  let lastTick = Date.now();
  const HOLD_TARGET = 1200; // ms tilted correctly to win
  const TILT_THRESHOLD = 15; // degrees

  function setBeamTilt(deg) {
    // Clamp so the visual doesn't go crazy
    const clamped = Math.max(-30, Math.min(30, deg));
    beamWrap.style.transform = `rotate(${clamped}deg)`;
  }

  function tick(tiltDeg) {
    if (done) return;
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    // Correct direction: negative gamma = phone tilted left = heavy side should be L
    const goingLeft = tiltDeg < -TILT_THRESHOLD;
    const goingRight = tiltDeg > TILT_THRESHOLD;
    const correctDir = (heavySide === 'L' && goingLeft) || (heavySide === 'R' && goingRight);
    const wrongDir   = (heavySide === 'L' && goingRight) || (heavySide === 'R' && goingLeft);

    if (correctDir) {
      holdMs = Math.min(HOLD_TARGET, holdMs + dt);
      audio.tiltUpdate(holdMs / HOLD_TARGET);
      instruction.textContent = 'Skvelé, drž to!';
      instruction.classList.add('success');
    } else if (wrongDir) {
      holdMs = Math.max(0, holdMs - dt * 0.5);
      instruction.textContent = 'Opačná strana!';
      instruction.classList.remove('success');
    } else {
      holdMs = Math.max(0, holdMs - dt * 0.3);
      instruction.textContent = 'Nakloň telefón k ťažšej strane!';
      instruction.classList.remove('success');
    }
    progressFill.style.width = (holdMs / HOLD_TARGET * 100) + '%';

    if (holdMs >= HOLD_TARGET) {
      done = true;
      audio.play('correct');
      audio.tiltStop();
      stopTiltListener();
      finalizeAttempt(heavySide === 'L' ? 'vľavo' : 'vpravo');
      instruction.textContent = 'Výborne!';
      instruction.classList.add('success');
      if (navigator.vibrate) navigator.vibrate(60);
      showFeedback(pick(['Super!', 'Skvelé!', 'Výborne!', 'Bravo!']));
      setTimeout(advance, 900);
    }
  }

  // Wire up fallback buttons (always present - works alongside sensors)
  let simulated = 0;
  const tiltTo = (deg) => {
    simulated = deg;
    setBeamTilt(deg);
    tick(deg);
  };
  const btnL = document.getElementById('scale-tilt-left');
  const btnR = document.getElementById('scale-tilt-right');
  btnL.addEventListener('mousedown',  () => { audio.tiltStart(); tiltTo(-25); });
  btnL.addEventListener('touchstart', (e) => { e.preventDefault(); audio.tiltStart(); tiltTo(-25); }, { passive: false });
  btnL.addEventListener('mouseup',    () => { audio.tiltStop(); tiltTo(0); });
  btnL.addEventListener('touchend',   () => { audio.tiltStop(); tiltTo(0); });
  btnR.addEventListener('mousedown',  () => { audio.tiltStart(); tiltTo(25); });
  btnR.addEventListener('touchstart', (e) => { e.preventDefault(); audio.tiltStart(); tiltTo(25); }, { passive: false });
  btnR.addEventListener('mouseup',    () => { audio.tiltStop(); tiltTo(0); });
  btnR.addEventListener('touchend',   () => { audio.tiltStop(); tiltTo(0); });
  // Continuous tick while button held
  const fallbackTick = setInterval(() => {
    if (done) { clearInterval(fallbackTick); return; }
    if (simulated !== 0) tick(simulated);
  }, 100);

  // Try sensors in parallel
  const perm = await requestSensorPermission();
  if (perm === 'granted') {
    audio.tiltStart();
    startTiltListener((gamma) => {
      // Visualize phone tilt directly (gamma negative = left)
      const weightBias = (heavySide === 'L' ? -4 : 4) * 0.3;
      setBeamTilt(gamma * 0.4 + weightBias);
      tick(gamma);
    });
  }
}

// ========== ROZKLAD SHAKE (BEAN SCATTER) MECHANIC ==========
async function renderRozkladShake(q, visual) {
  const wrap = document.createElement('div');
  wrap.className = 'bean-wrap';
  wrap.innerHTML = `
    <div class="bean-instruction" id="bean-instruction">Zatras telefónom a rozhoď ${q.total} fazuľ!</div>
    <div class="bean-stage" id="bean-stage">
      <div class="basket left"><div class="basket-floor"></div><div class="basket-label" id="basket-label-l">?</div></div>
      <div class="basket right"><div class="basket-floor"></div><div class="basket-label" id="basket-label-r">?</div></div>
    </div>
    <div class="bean-shake-btn">
      <button class="shake-prompt" id="manual-shake"><span class="shake-icon">📱</span> Alebo kliknite tu</button>
    </div>
  `;
  visual.appendChild(wrap);

  const stage = document.getElementById('bean-stage');
  const instr = document.getElementById('bean-instruction');
  const manualBtn = document.getElementById('manual-shake');
  let scattered = false;

  // Create beans clustered at top center
  const beans = [];
  const stageW = () => stage.clientWidth;
  const stageH = () => stage.clientHeight;
  setTimeout(() => placeBeansAtStart(), 0); // wait for layout
  function placeBeansAtStart() {
    const cx = stageW() / 2;
    for (let i = 0; i < q.total; i++) {
      const b = document.createElement('div');
      b.className = 'bean';
      const ang = (i / q.total) * Math.PI * 2;
      const r = 24;
      const x = cx + Math.cos(ang) * r;
      const y = 30 + Math.sin(ang) * r * 0.6;
      b.style.left = x + 'px';
      b.style.top = y + 'px';
      stage.appendChild(b);
      beans.push({ el: b, x, y, vx: 0, vy: 0, settled: false });
    }
  }

  function scatter() {
    if (scattered) return;
    scattered = true;
    stopShakeListener();
    audio.play('shake-rattle');
    instr.textContent = 'Padajú...';
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    // Give each bean a random velocity
    beans.forEach(b => {
      b.vx = (Math.random() - 0.5) * 14;
      b.vy = -(Math.random() * 4 + 2); // pop up a bit
    });
    animateBeans();
  }

  function animateBeans() {
    const W = stageW();
    const H = stageH();
    const FLOOR = H - 12;
    const BASKET_TOP = H - 70;
    const GRAVITY = 0.55;
    const FRICTION = 0.92;
    const RESTITUTION = 0.45;
    const MIDLINE = W / 2;

    function step() {
      let activeCount = 0;
      beans.forEach(b => {
        if (b.settled) return;
        b.vy += GRAVITY;
        b.x += b.vx;
        b.y += b.vy;

        // Wall bounces
        if (b.x < 12) { b.x = 12; b.vx = -b.vx * RESTITUTION; }
        if (b.x > W - 12) { b.x = W - 12; b.vx = -b.vx * RESTITUTION; }

        // Floor / basket bottom
        if (b.y >= FLOOR) {
          b.y = FLOOR;
          b.vy = -b.vy * RESTITUTION;
          b.vx *= FRICTION;
          if (Math.abs(b.vy) < 1 && Math.abs(b.vx) < 0.5) {
            b.settled = true;
            b.vx = 0; b.vy = 0;
            audio.play('bean-drop');
            // Nudge into nearest basket horizontally
            const dest = b.x < MIDLINE ? 'L' : 'R';
            b.basket = dest;
          }
        }
        b.el.style.left = b.x + 'px';
        b.el.style.top = b.y + 'px';
        if (!b.settled) activeCount++;
      });
      if (activeCount > 0) {
        requestAnimationFrame(step);
      } else {
        onSettled();
      }
    }
    requestAnimationFrame(step);
  }

  function onSettled() {
    // Count per basket
    let countL = beans.filter(b => b.basket === 'L').length;
    let countR = beans.filter(b => b.basket === 'R').length;
    // Avoid the all-in-one-basket case (boring math). If extreme split, move 1 over.
    if (countL === 0 && countR > 1) {
      const move = beans.find(b => b.basket === 'R');
      if (move) {
        move.basket = 'L';
        // Animate it shifting left
        move.el.style.transition = 'left 0.4s ease, top 0.4s ease';
        move.el.style.left = (stageW() * 0.15) + 'px';
        countL = 1; countR--;
      }
    } else if (countR === 0 && countL > 1) {
      const move = beans.find(b => b.basket === 'L');
      if (move) {
        move.basket = 'R';
        move.el.style.transition = 'left 0.4s ease, top 0.4s ease';
        move.el.style.left = (stageW() * 0.85) + 'px';
        countR = 1; countL--;
      }
    }

    // Decide which basket to show ("known") and which to ask ("unknown")
    // Bias toward asking for the unknown that matches q.answer when possible,
    // but ultimately the question is built from actual outcome.
    setTimeout(() => {
      const lblL = document.getElementById('basket-label-l');
      const lblR = document.getElementById('basket-label-r');
      // Randomly choose which side is the "known" one shown
      const showLeft = Math.random() < 0.5;
      const knownCount = showLeft ? countL : countR;
      const unknownCount = showLeft ? countR : countL;
      lblL.textContent = showLeft ? countL : '?';
      lblR.textContent = showLeft ? '?'    : countR;
      if (!showLeft) lblL.classList.add('hidden-q'); else lblR.classList.add('hidden-q');

      instr.innerHTML = `V <b>${showLeft ? 'ľavom' : 'pravom'}</b> košíku je <b>${knownCount}</b>. Koľko je v druhom?`;

      // Re-start attempt with the actual problem (post-scatter); the question
      // really begins now, not when the scatter animation started.
      currentAttempt = {
        type: 'rozklad',
        variant: 'shake',
        label: `${knownCount} + ? = ${q.total}`,
        correct: String(unknownCount),
        given: [],
        mistakes: 0,
        startedAt: Date.now(),
      };

      // Build new answer options based on actual outcome
      const options = makeOptions(unknownCount, 0, q.total);
      const grid = document.getElementById('answer-grid');
      grid.innerHTML = '';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleAnswer(btn, opt, unknownCount));
        grid.appendChild(btn);
      });
    }, 700);
  }

  // Manual fallback button (always present and visible — works even without sensors)
  manualBtn.addEventListener('click', scatter);

  // Try sensors
  const perm = await requestSensorPermission();
  if (perm === 'granted') {
    startShakeListener(scatter);
  }
}

function makeGroupedDots(n, emoji) {
  // Group by 5 for visual readability (helps with crossing-10 strategy)
  let html = '<span class="dot-group">';
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 5 === 0) html += '</span><span class="dot-group">';
    html += emoji;
  }
  return html + '</span>';
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
}

function handleAnswer(btn, chosen, correct) {
  if (btn.disabled) return;
  if (chosen === correct) {
    audio.play('correct');
    finalizeAttempt(chosen);
    btn.classList.add('correct');
    document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
    fillAnswerVisual(chosen);
    showFeedback(pick(['Super!', 'Skvelé!', 'Výborne!', 'Wow!', 'Bravo!']));
    setTimeout(advance, 1200);
  } else {
    audio.play('wrong');
    recordWrongInAttempt(chosen);
    btn.classList.add('wrong');
    state.mistakesInLevel++;
    setTimeout(() => { btn.classList.remove('wrong'); btn.disabled = false; }, 600);
    showFeedback('Skús ešte raz!', true);
    // Hint: highlight the visual on count questions
    highlightHint();
  }
}

function handleCompare(group, side, correct) {
  if (group.classList.contains('correct') || group.classList.contains('wrong')) return;
  if (side === correct) {
    audio.play('correct');
    finalizeAttempt(side === 'L' ? 'vľavo' : 'vpravo');
    group.classList.add('correct');
    document.querySelectorAll('.compare-group').forEach(g => g.style.pointerEvents = 'none');
    showFeedback(pick(['Super!', 'Skvelé!', 'Výborne!']));
    setTimeout(advance, 1000);
  } else {
    audio.play('wrong');
    recordWrongInAttempt(side === 'L' ? 'vľavo' : 'vpravo');
    group.classList.add('wrong');
    state.mistakesInLevel++;
    setTimeout(() => group.classList.remove('wrong'), 600);
    showFeedback('Skús ešte raz!', true);
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
  state.questionIdx++;
  if (state.questionIdx >= QUESTIONS_PER_LEVEL) {
    finishLevel();
  } else {
    renderQuestion();
  }
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
  showScreen('result');
  document.getElementById('result-title').textContent =
    stars === 3 ? 'Perfektné!' : (stars === 2 ? 'Skvelá práca!' : 'Dobre!');
  const petName = state.pet.name;
  document.getElementById('result-speech').textContent = pick([
    `Si super matematik!`,
    `${petName} sa teší!`,
    'Ideme ďalej!',
    'Skvelý postup!',
    `${petName} ďakuje!`,
    'O krok bližšie k hviezdam!',
  ]);
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
  if (confirm('Naozaj začať odznova? Stratíš všetok pokrok.')) {
    restartGame();
  }
}

// ========== AUDIO ==========
const audio = (() => {
  let _initialized = false;
  let _muted = false;
  let _volume = 0.6;
  let poly, membrane, metal, noise;
  let tiltOsc, tiltGain;

  function _load() {
    try {
      const d = JSON.parse(localStorage.getItem(AUDIO_KEY) || '{}');
      if (typeof d.muted  === 'boolean') _muted  = d.muted;
      if (typeof d.volume === 'number')  _volume = d.volume;
    } catch(e) {}
  }
  function _save() {
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify({ muted: _muted, volume: _volume })); } catch(e) {}
  }
  function _applyVolume(v) {
    const db = 20 * Math.log10(Math.max(v, 0.0001));
    if (poly)     poly.volume.value     = db;
    if (membrane) membrane.volume.value = db;
    if (metal)    metal.volume.value    = db;
    if (noise)    noise.volume.value    = db;
    // tiltGain is intentionally not touched here — it is controlled only by tiltStart/tiltStop
  }

  const _sounds = {
    tap()           { poly.triggerAttackRelease('C5', '64n'); },
    pop()           { const t = Tone.now(); poly.triggerAttackRelease('E5', '32n', t); poly.triggerAttackRelease('A5', '32n', t + 0.04); },
    correct()       { const t = Tone.now(); poly.triggerAttackRelease('C5','8n',t); poly.triggerAttackRelease('E5','8n',t+0.1); poly.triggerAttackRelease('G5','8n',t+0.2); },
    wrong()         { const t = Tone.now(); poly.triggerAttackRelease('G4','8n',t); poly.triggerAttackRelease('E4','8n',t+0.15); },
    star(idx)       { const freqs=[400,500,630]; metal.triggerAttackRelease(freqs[idx??0]??400,'16n'); },
    'level-complete'() { const t=Tone.now(); ['C5','E5','G5','C6'].forEach((n,i)=>poly.triggerAttackRelease(n,'8n',t+i*0.15)); },
    'game-complete'()  {
      const t=Tone.now();
      ['C5','E5','G5','C6','E6','G6'].forEach((n,i)=>poly.triggerAttackRelease(n,'8n',t+i*0.12));
      ['C7','E7','G7','C8'].forEach((n,i)=>poly.triggerAttackRelease(n,'32n',t+0.8+i*0.06));
    },
    'pet-greet'()   { const t=Tone.now(); poly.triggerAttackRelease('D4','8n',t); poly.triggerAttackRelease('F4','8n',t+0.15); },
    'shake-rattle'(){ noise.triggerAttackRelease('16n'); },
    'bean-drop'()   { membrane.triggerAttackRelease('C2','16n'); },
  };

  return {
    init() { _load(); },

    unlock() {
      if (_initialized) return;
      if (typeof Tone === 'undefined') return;
      Tone.start().then(() => {
        poly = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.3 },
        }).toDestination();
        membrane = new Tone.MembraneSynth({
          pitchDecay: 0.05, octaves: 4,
          envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
        }).toDestination();
        metal = new Tone.MetalSynth({
          frequency: 400,
          envelope: { attack: 0.001, decay: 0.15, release: 0.1 },
          harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
        }).toDestination();
        noise = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.15, sustain: 0, release: 0.05 },
        }).toDestination();
        tiltOsc  = new Tone.Oscillator({ type: 'sine', frequency: 220 });
        tiltGain = new Tone.Gain(0).toDestination();
        tiltOsc.connect(tiltGain);
        tiltOsc.start();
        _applyVolume(_volume);
        _initialized = true;
      }).catch(() => {});
    },

    play(name, param) {
      if (_muted || !_initialized || _volume === 0) return;
      const fn = _sounds[name];
      if (fn) { try { fn(param); } catch(e) {} }
    },

    tiltStart()          { if (!tiltGain || _muted) return; tiltGain.gain.rampTo(_volume * 0.25, 0.1); },
    tiltUpdate(progress) { if (!tiltOsc  || _muted) return; tiltOsc.frequency.rampTo(220 + progress * 220, 0.05); },
    tiltStop()           { if (!tiltGain) return; tiltGain.gain.rampTo(0, 0.1); },

    isMuted:   () => _muted,
    getVolume: () => _volume,
    setMuted(b)  { _muted = b; _save(); },
    setVolume(v) { _volume = v; _applyVolume(v); _save(); },
  };
})();

function toggleMute() {
  audio.setMuted(!audio.isMuted());
  const icon = audio.isMuted() ? '🔇' : '🔊';
  const muteBtn = document.getElementById('map-mute-btn');
  if (muteBtn) muteBtn.textContent = icon;
}

// ========== INITIALIZATION ==========
function init() {
  audio.init();
  loadState();
  loadStats();
  applyPet();

  // Long-press on stars counter (map screen) opens parent stats
  const starsCounter = document.querySelector('.stars-total');
  if (starsCounter) {
    setupLongPress(starsCounter, openParent, 1000);
  }

  // If returning user (has progress), update start button label
  const hasProgress = state.mode && (state.totalStars > 0 || state.levels.some(l => l.done));
  const startBtn = document.getElementById('start-btn');
  if (hasProgress && startBtn) {
    startBtn.textContent = 'Pokračovať →';
    const speech = document.getElementById('welcome-speech');
    if (speech) {
      speech.innerHTML = `<b>${state.pet.name}</b> ťa znova víta! Pokračujeme k hviezdam.`;
    }
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

// ========== SERVICE WORKER (for PWA install) ==========
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // SW only works when served over http(s); fails silently in file:// or sandboxed previews
    });
  });
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
