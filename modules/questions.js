import { S } from './strings.js';

let _state = { mode: null };
let _stats = { perType: {} };

export function bindContext(state, stats) {
  _state = state;
  _stats = stats;
}

// Per-mode ordered question types (index = level index)
export const LEVEL_TYPES = {
  do10:     ['count','add5','rozklad','compare','add10','sequence'],
  do20:     ['compare','add5','rozklad','compare','add10','sequence','addsub20'],
  pokrocile:['compare','rozklad20','seqstep','addsub20','peniaze','wordproblem','magic'],
};
export function getLevelType(idx) {
  return (LEVEL_TYPES[_state.mode] ?? LEVEL_TYPES.do20)[idx];
}

export const QUESTIONS_PER_LEVEL = 4;

const EMOJI_BY_LEVEL = {
  count:       ['🍎','🌻','🐝','🍓','⭐','🦋','🍄','🌸'],
  add5:        ['🍎','🐝','🌻','🍓'],
  rozklad:     ['💧','🌟','🍓','🐝'],
  compare:     ['🐟','🐸','🦆','🐢'],
  add10:       ['🍪','🌰','🍇','🥕'],
  sequence:    [],
  addsub20:    ['🌟','💎','🍒','🍬'],
  rozklad20:   ['🍓','🌟','💧','🐝'],
  seqstep:     [],
  peniaze:     [],
  wordproblem: [],
  magic:       [],
};

export function rand(n) { return Math.floor(Math.random() * n); }
export function pick(arr) { return arr[rand(arr.length)]; }
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ========== WORD PROBLEMS BANK ==========
// text/emoji/op from strings.js; number generators here
const WORD_PROBLEM_GENERATORS = [
  { a: () => 5+rand(7),  b: () => 2+rand(6) },
  { a: () => 8+rand(8),  b: () => 2+rand(6) },
  { a: () => 5+rand(7),  b: () => 3+rand(7) },
  { a: () => 10+rand(8), b: () => 3+rand(7) },
  { a: () => 10+rand(7), b: () => 2+rand(6) },
  { a: () => 6+rand(9),  b: () => 2+rand(6) },
  { a: () => 10+rand(8), b: () => 2+rand(7) },
  { a: () => 5+rand(9),  b: () => 2+rand(7) },
];
const WORD_PROBLEMS = S.wordProblems.map((wp, i) => ({ ...wp, ...WORD_PROBLEM_GENERATORS[i] }));

// ========== MAGIC SQUARES BANK (row-major, all rows+cols sum to `sum`) ==========
// Tiered by difficulty — used by generateOne('magic', tier)
const MAGIC_EASY = [   // sum 6–9, small numbers
  { grid: [1,2,3, 2,2,2, 3,2,1], sum: 6 },
  { grid: [2,1,3, 3,2,1, 1,3,2], sum: 6 },
  { grid: [3,2,1, 1,2,3, 2,2,2], sum: 6 },
  { grid: [2,4,3, 4,1,4, 3,4,2], sum: 9 },
  { grid: [3,2,4, 2,5,2, 4,2,3], sum: 9 },
  { grid: [1,5,3, 5,1,3, 3,3,3], sum: 9 },
];
const MAGIC_MEDIUM = [ // sum 12
  { grid: [1,6,5, 8,4,0, 3,2,7], sum: 12 },
  { grid: [4,3,5, 6,4,2, 2,5,5], sum: 12 },
  { grid: [2,6,4, 7,3,2, 3,3,6], sum: 12 },
];
const MAGIC_HARD = [   // sum 15, classic 1–9 squares
  { grid: [2,7,6, 9,5,1, 4,3,8], sum: 15 },
  { grid: [6,1,8, 7,5,3, 2,9,4], sum: 15 },
  { grid: [4,9,2, 3,5,7, 8,1,6], sum: 15 },
  { grid: [8,3,4, 1,5,9, 6,7,2], sum: 15 },
];
const MAGIC_EXPERT = [ // sum 18, larger numbers
  { grid: [12,4,2, 1,3,14, 5,11,2], sum: 18 },
  { grid: [8,4,6, 6,6,6, 4,8,6],    sum: 18 },
  { grid: [9,3,6, 3,9,6, 6,6,6],    sum: 18 },
];

// Difficulty tiers run 1..4 (1 = easiest, 2 = baseline/default, 3 = harder, 4 = hardest).
// The value is shown directly to the player as a badge on the question card.
export function difficultyTier(type) {
  const t = _stats.perType[type];
  if (!t || t.count < 4) return 2;                  // not enough data → baseline
  const acc = 1 - t.mistakes / (t.count + t.mistakes);
  if (acc < 0.50) return 1;                          // struggling → easiest
  if (acc < 0.70) return 2;                          // baseline
  if (acc < 0.85 && t.count >= 6)  return 3;         // doing well → harder
  if (acc >= 0.85 && t.count >= 10) return 4;        // mastered → hardest
  return 2;
}

export function makeOptions(correct, min, max) {
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
  // Fallback: extend range if needed to reach 4 distinct values
  let ext = 1;
  while (set.size < 4) {
    for (let v = min - ext; v <= max + ext; v++) {
      if (!set.has(v)) { set.add(v); if (set.size === 4) break; }
    }
    ext++;
  }
  return shuffle([...set]);
}

function pluralize(emoji) {
  return S.emojiNames[emoji] || S.emojiNameDefault;
}

export function generateOne(type, tier = null) {
  if (tier === null) tier = difficultyTier(type);
  const q = buildQuestion(type, tier);
  if (q) q.tier = tier;                 // stamp tier so the UI can show a difficulty badge
  return q;
}

function buildQuestion(type, tier) {
  const emoji = pick(EMOJI_BY_LEVEL[type] || ['⭐']);
  switch (type) {
    case 'count': {
      const isDo10 = _state.mode === 'do10' || !_state.mode;
      const lo = tier <= 1 ? 2 : tier === 2 ? 2 : tier === 3 ? 3 : 5;
      const hi = isDo10 ? (tier <= 1 ? 5 : tier === 2 ? 8 : 10)
                        : (tier <= 1 ? 5 : tier === 2 ? 8 : tier === 3 ? 10 : 12);
      const n = lo + rand(hi - lo + 1);
      return {
        type, answer: n, emoji,
        prompt: S.prompts.countQ(pluralize(emoji)),
        visual: emoji.repeat(n),
        options: makeOptions(n, 1, hi + 2),
      };
    }
    case 'add5': {
      const a = tier <= 1 ? 1 + rand(2) : 1 + rand(4);
      const b = tier <= 1 ? 1 + rand(2) : 1 + rand(5 - a);
      const sum = a + b;
      const resultChance = tier <= 1 ? 8 : tier === 2 ? 6 : tier === 3 ? 4 : 2;
      const slot = rand(10) < resultChance ? 'result' : (rand(2) === 0 ? 'a' : 'b');
      const answer = slot === 'result' ? sum : (slot === 'a' ? a : b);
      return {
        type, slot, answer, emoji,
        prompt: slot === 'result' ? S.prompts.addResult : S.prompts.addMissing,
        a, b, sum, op: '+',
        options: makeOptions(answer, 0, 10),
      };
    }
    case 'compare': {
      let a, b;
      const isPokrocile = _state.mode === 'pokrocile';
      const isDo20 = _state.mode === 'do20';
      if (tier <= 1 && !isPokrocile && !isDo20) {
        do { a = 1 + rand(6); b = 1 + rand(6); } while (a === b || Math.abs(a - b) < 3);
        return { type, variant: 'tap', answer: a > b ? 'L' : 'R', emoji, prompt: S.prompts.compareTap, a, b };
      }
      let minN = 1, maxN;
      if (isPokrocile) { minN = 11; maxN = 18; }   // always above 10 — comparing from 1 is too easy
      else if (isDo20) maxN = tier <= 1 ? 10 : tier === 2 ? 15 : tier === 3 ? 18 : 20;
      else maxN = tier === 2 ? 8 : tier === 3 ? 9 : 10;
      do { a = minN + rand(maxN - minN + 1); b = minN + rand(maxN - minN + 1); } while (a === b);
      // for large-number modes mostly tap; scale works best with small emoji groups
      const tapChance = (isPokrocile || isDo20) ? 6 : (tier === 3 ? 3 : tier >= 4 ? 0 : 5);
      const variant = rand(10) < tapChance ? 'tap' : 'scale';
      return {
        type, variant, answer: a > b ? 'L' : 'R', emoji,
        prompt: variant === 'scale' ? S.prompts.compareScale : S.prompts.compareTap,
        a, b,
      };
    }
    case 'add10': {
      const a = tier <= 1 ? 1 + rand(4) : 1 + rand(8);
      const maxB = tier <= 1 ? Math.min(5, 10 - a) : Math.min(9, 10 - a);
      const b = 1 + rand(Math.max(1, maxB));
      const sum = a + b;
      const resultChance = tier <= 1 ? 8 : tier === 2 ? 6 : tier === 3 ? 4 : 2;
      const slot = rand(10) < resultChance ? 'result' : (rand(2) === 0 ? 'a' : 'b');
      const answer = slot === 'result' ? sum : (slot === 'a' ? a : b);
      return {
        type, slot, answer, emoji,
        prompt: slot === 'result' ? S.prompts.add10Result : S.prompts.addMissing,
        a, b, sum, op: '+',
        options: makeOptions(answer, 0, 14),
      };
    }
    case 'sequence': {
      const step = tier <= 2 ? 1 : tier === 3 ? (rand(2) === 0 ? 1 : 2) : (rand(2) === 0 ? 2 : 5);
      const maxStart = tier <= 1 ? 3 : tier === 2 ? 5 : tier === 3 ? 8 : 10;
      const start = 1 + rand(maxStart);
      const pos = tier <= 1 ? 2 : 1 + rand(3);
      const seq = [start, start+step, start+step*2, start+step*3, start+step*4];
      const answer = seq[pos];
      return {
        type, answer,
        prompt: S.prompts.missingNum,
        seq, pos,
        options: makeOptions(answer, 1, Math.max(20, seq[4] + step)),
      };
    }
    case 'rozklad': {
      const isDo10 = _state.mode === 'do10' || !_state.mode;
      const minT = tier <= 1 ? 4 : tier === 2 ? 5 : tier === 3 ? 7 : 10;
      const maxT = isDo10 ? 10 : (tier <= 1 ? 6 : tier === 2 ? 10 : tier === 3 ? 12 : 15);
      const total = minT + rand(maxT - minT + 1);
      const part = 1 + rand(total - 1);
      const answer = total - part;
      const variant = tier <= 1 ? 'tree' : (rand(2) === 0 ? 'tree' : 'shake');
      return {
        type, variant, answer, emoji,
        prompt: variant === 'shake'
          ? S.prompts.rozkladShake(total)
          : S.prompts.rozkladTree(total),
        total, part,
        options: makeOptions(answer, 0, total),
      };
    }
    case 'addsub20': {
      const addChance = tier <= 1 ? 10 : tier === 2 ? 5 : tier === 3 ? 3 : 2;
      const isAdd = rand(10) < addChance;
      const slot = rand(20) < 13 ? 'result' : (rand(2) === 0 ? 'a' : 'b');
      let a, b, sum;
      if (isAdd) {
        // All tiers ≥ 2: sum must cross 10 (that's the whole point of do20)
        const minA = tier <= 1 ? 5 : 8;
        const maxA = tier <= 1 ? 12 : tier === 2 ? 12 : tier === 3 ? 14 : 17;
        a = minA + rand(maxA - minA + 1);
        const minB = tier <= 1 ? 2 : Math.max(3, 11 - a); // ensures sum > 10
        const maxB = Math.min(9, 20 - a);
        b = minB + rand(Math.max(1, maxB - minB + 1));
        sum = a + b;
      } else {
        a = 12 + rand(9);                          // a ∈ [12..20]
        b = 3 + rand(Math.min(a - 4, 7));          // b ∈ [3..min(a-2, 9)]
        sum = a - b;
      }
      const answer = slot === 'result' ? sum : (slot === 'a' ? a : b);
      const promptStandard = isAdd ? S.prompts.add10Result : S.prompts.subResult;
      return {
        type, slot, answer, isAdd,
        prompt: slot === 'result' ? promptStandard : S.prompts.addMissing,
        a, b, sum, op: isAdd ? '+' : '−', emoji,
        options: makeOptions(answer, 0, 20),
      };
    }
    case 'seqstep': {
      const step = tier <= 2 ? 2 : tier === 3 ? 2 + rand(2) : 3 + rand(2); // tier ≤2→2, tier 3→2-3, tier 4→3-4
      const maxStart = 20 - 4 * step;
      const start = 1 + rand(Math.max(1, maxStart));
      const pos = 1 + rand(3); // gap at index 1, 2, or 3 (never 0)
      const seq = [start, start+step, start+2*step, start+3*step, start+4*step];
      const answer = seq[pos];
      return {
        type, answer,
        prompt: S.prompts.missingNum,
        seq, pos, step,
        options: makeOptions(answer, 1, 20),
      };
    }
    case 'rozklad20': {
      const total = 11 + rand(10); // 11..20
      // answer ∈ [1..min(10, total-1)] — keeps right branch ≤ 10 dots; part varies naturally
      const maxAnswer = Math.min(10, total - 1);
      const answer = 1 + rand(maxAnswer);
      const part = total - answer;
      return {
        type, variant: 'tree', answer, emoji,
        prompt: S.prompts.rozkladTree(total),
        total, part,
        options: makeOptions(answer, 0, 10),
      };
    }
    case 'peniaze': {
      const COINS = [1, 2];
      const NOTES = [5, 10];
      let items = [];
      let total = 0;
      const count = 2 + rand(3); // 2-4 items
      let safety = 0;
      while (items.length < count && safety < 30) {
        const isNote = rand(2) === 0 && items.length > 0; // at least one coin first
        const pool = isNote ? NOTES : COINS;
        const val = pool[rand(pool.length)];
        if (total + val <= 20) { items.push({ val, isNote }); total += val; }
        safety++;
      }
      if (items.length < 2) { items = [{ val:2, isNote:false }, { val:5, isNote:true }]; total = 7; }
      return {
        type, answer: total,
        prompt: S.prompts.peniaze,
        items, total,
        options: makeOptions(total, 1, 20),
      };
    }
    case 'wordproblem': {
      const t = WORD_PROBLEMS[rand(WORD_PROBLEMS.length)];
      let a, b;
      let safety = 0;
      do {
        a = t.a(); b = t.b();
        safety++;
      } while (safety < 20 && (t.op === '+' ? a + b > 20 : a - b < 0 || a - b > 20));
      const sum = t.op === '+' ? a + b : a - b;
      return {
        type, answer: sum,
        prompt: t.text(a, b, t.emoji),
        emoji: t.emoji,
        a, b, sum, op: t.op,
        options: makeOptions(sum, 0, 20),
      };
    }
    case 'magic': {
      const magicPools = [MAGIC_EASY, MAGIC_MEDIUM, MAGIC_HARD, MAGIC_EXPERT];
      const pool = magicPools[Math.max(0, Math.min(3, tier - 1))]; // tier 1→EASY … 4→EXPERT
      const ms = pool[rand(pool.length)];
      const blankPos = rand(9);
      const answer = ms.grid[blankPos];
      const maxVal = Math.max(...ms.grid);
      return {
        type, answer,
        prompt: S.prompts.magicPrompt,
        grid: ms.grid, blankPos, sum: ms.sum,
        options: makeOptions(answer, 0, maxVal + 2),
      };
    }
  }
}

export function generateQuestions(type) {
  const baseTier = difficultyTier(type);
  const qs = [];
  for (let i = 0; i < QUESTIONS_PER_LEVEL; i++) {
    const tier = i === QUESTIONS_PER_LEVEL - 1 ? Math.min(4, baseTier + 1) : baseTier;
    let q, safety = 0;
    const prevSig = qs.length > 0
      ? JSON.stringify({ a: qs[qs.length-1].a, b: qs[qs.length-1].b, answer: qs[qs.length-1].answer, pos: qs[qs.length-1].pos, total: qs[qs.length-1].total, part: qs[qs.length-1].part })
      : '';
    do {
      q = generateOne(type, tier);
      safety++;
    } while (
      safety < 15 &&
      prevSig === JSON.stringify({ a: q.a, b: q.b, answer: q.answer, pos: q.pos, total: q.total, part: q.part })
    );
    qs.push(q);
  }
  return qs;
}
