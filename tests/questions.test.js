import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bindContext,
  LEVEL_TYPES, QUESTIONS_PER_LEVEL, getLevelType,
  rand, pick, shuffle,
  makeOptions, difficultyTier,
  generateOne, generateQuestions,
} from '../questions.js';

const mockState = { mode: 'do10' };
const mockStats = { perType: {} };
bindContext(mockState, mockStats);

function withMode(mode, fn) {
  const prev = mockState.mode;
  mockState.mode = mode;
  try { fn(); } finally { mockState.mode = prev; }
}

function withStats(perType, fn) {
  const prev = mockStats.perType;
  mockStats.perType = perType;
  try { fn(); } finally { mockStats.perType = prev; }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

describe('rand', () => {
  test('returns integer in [0, n)', () => {
    for (let i = 0; i < 200; i++) {
      const r = rand(10);
      assert.ok(Number.isInteger(r));
      assert.ok(r >= 0 && r < 10, `${r} out of [0,10)`);
    }
  });

  test('covers full range across many draws', () => {
    const seen = new Set();
    for (let i = 0; i < 600; i++) seen.add(rand(6));
    assert.equal(seen.size, 6);
  });
});

describe('pick', () => {
  test('always returns an element from the array', () => {
    const arr = ['a', 'b', 'c', 'd'];
    for (let i = 0; i < 50; i++) assert.ok(arr.includes(pick(arr)));
  });

  test('covers all elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(pick(arr));
    assert.equal(seen.size, arr.length);
  });
});

describe('shuffle', () => {
  test('returns array with identical elements', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    const result = shuffle(arr);
    assert.equal(result.length, arr.length);
    assert.deepEqual([...result].sort((a, b) => a - b), [...arr].sort((a, b) => a - b));
  });

  test('does not mutate the original', () => {
    const arr = [10, 20, 30];
    const copy = [...arr];
    shuffle(arr);
    assert.deepEqual(arr, copy);
  });

  test('produces varied orderings', () => {
    const arr = [1, 2, 3, 4, 5];
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(shuffle(arr).join(','));
    assert.ok(seen.size > 10);
  });
});

// ─── makeOptions ─────────────────────────────────────────────────────────────

describe('makeOptions', () => {
  test('always contains the correct answer', () => {
    for (let i = 0; i < 50; i++) {
      const opts = makeOptions(7, 0, 20);
      assert.ok(opts.includes(7), `answer missing from ${opts}`);
    }
  });

  test('returns exactly 4 distinct options', () => {
    for (let i = 0; i < 50; i++) {
      const opts = makeOptions(5, 0, 20);
      assert.equal(opts.length, 4);
      assert.equal(new Set(opts).size, 4);
    }
  });

  test('all options within [min, max]', () => {
    for (let i = 0; i < 50; i++) {
      makeOptions(6, 1, 10).forEach(o =>
        assert.ok(o >= 1 && o <= 10, `${o} out of [1,10]`));
    }
  });

  test('works at range boundaries', () => {
    assert.ok(makeOptions(0, 0, 10).includes(0));
    assert.ok(makeOptions(10, 0, 10).includes(10));
  });

  test('works on narrow range', () => {
    const opts = makeOptions(5, 3, 7);
    assert.ok(opts.includes(5));
    assert.equal(opts.length, 4);
  });
});

// ─── difficultyTier ──────────────────────────────────────────────────────────

describe('difficultyTier', () => {
  test('returns 0 with no stats', () =>
    withStats({}, () => assert.equal(difficultyTier('count'), 0)));

  test('returns 0 when count < 4', () =>
    withStats({ count: { count: 3, mistakes: 0 } }, () =>
      assert.equal(difficultyTier('count'), 0)));

  test('returns -1 when accuracy < 0.50', () =>
    // acc = 1 - 11/(10+11) ≈ 0.476
    withStats({ count: { count: 10, mistakes: 11 } }, () =>
      assert.equal(difficultyTier('count'), -1)));

  test('returns 0 when accuracy in [0.50, 0.70)', () =>
    // acc = 1 - 5/(10+5) ≈ 0.667
    withStats({ count: { count: 10, mistakes: 5 } }, () =>
      assert.equal(difficultyTier('count'), 0)));

  test('returns 0 when accuracy in [0.70, 0.85) but count < 6', () =>
    // acc = 1 - 1/(5+1) ≈ 0.833, count=5 < 6
    withStats({ count: { count: 5, mistakes: 1 } }, () =>
      assert.equal(difficultyTier('count'), 0)));

  test('returns 1 when accuracy in [0.70, 0.85) and count >= 6', () =>
    // acc = 1 - 2/(10+2) ≈ 0.833
    withStats({ count: { count: 10, mistakes: 2 } }, () =>
      assert.equal(difficultyTier('count'), 1)));

  test('returns 2 when accuracy >= 0.85 and count >= 10', () =>
    // acc = 1 - 1/(10+1) ≈ 0.909
    withStats({ count: { count: 10, mistakes: 1 } }, () =>
      assert.equal(difficultyTier('count'), 2)));

  test('returns 0 when accuracy >= 0.85 but count < 10', () =>
    // acc = 1.0, count=8 < 10
    withStats({ count: { count: 8, mistakes: 0 } }, () =>
      assert.equal(difficultyTier('count'), 0)));
});

// ─── generateOne ─────────────────────────────────────────────────────────────

const ALL_TYPES = [
  'count', 'add5', 'add10', 'compare', 'sequence', 'rozklad',
  'addsub20', 'seqstep', 'rozklad20', 'peniaze', 'wordproblem', 'magic',
];

describe('generateOne — structure', () => {
  for (const type of ALL_TYPES) {
    test(`${type}: type field, prompt, answer in options`, () => {
      const modes = type === 'compare' ? ['do10', 'do20', 'pokrocile'] : ['do10'];
      for (const mode of modes) {
        withMode(mode, () => {
          for (let tier = -1; tier <= 2; tier++) {
            for (let i = 0; i < 10; i++) {
              const q = generateOne(type, tier);
              assert.equal(q.type, type);
              assert.ok(q.prompt, `${type} t=${tier}: missing prompt`);
              if (type !== 'compare') {
                assert.equal(q.options.length, 4, `${type} t=${tier}: wrong options count`);
                assert.ok(q.options.includes(q.answer),
                  `${type} t=${tier}: answer ${q.answer} ∉ [${q.options}]`);
              }
            }
          }
        });
      }
    });
  }
});

describe('generateOne — domain', () => {
  const N = 50;

  test('count: answer in range per tier', () => {
    const ranges = [[-1, 2, 5], [0, 2, 8], [1, 3, 10], [2, 5, 12]];
    for (const [tier, lo, hi] of ranges) {
      for (let i = 0; i < N; i++) {
        const { answer } = generateOne('count', tier);
        assert.ok(answer >= lo && answer <= hi, `count t=${tier}: ${answer} ∉ [${lo},${hi}]`);
      }
    }
  });

  test('add5: a+b=sum, sum ≤ 5', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('add5', 0);
      assert.equal(q.a + q.b, q.sum);
      assert.ok(q.sum <= 5, `add5 sum=${q.sum}`);
    }
  });

  test('add10: a+b=sum, sum ≤ 10', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('add10', 0);
      assert.equal(q.a + q.b, q.sum);
      assert.ok(q.sum <= 10, `add10 sum=${q.sum}`);
    }
  });

  test('add5/add10: slot answer matches operand', () => {
    for (const type of ['add5', 'add10']) {
      for (let i = 0; i < N; i++) {
        const q = generateOne(type, 0);
        const expected = q.slot === 'result' ? q.sum : q.slot === 'a' ? q.a : q.b;
        assert.equal(q.answer, expected, `${type} slot=${q.slot}`);
      }
    }
  });

  test('compare: L/R answer matches larger side, a≠b', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('compare', 0);
      assert.ok(q.answer === 'L' || q.answer === 'R');
      assert.notEqual(q.a, q.b);
      if (q.answer === 'L') assert.ok(q.a > q.b);
      else assert.ok(q.b > q.a);
    }
  });

  test('compare do20: numbers reach above 10', () => {
    withMode('do20', () => {
      let sawLarge = false;
      for (let i = 0; i < 100; i++) {
        const q = generateOne('compare', 2);
        if (q.a > 10 || q.b > 10) sawLarge = true;
      }
      assert.ok(sawLarge, 'do20 compare t=2 should produce numbers >10');
    });
  });

  test('sequence: seq[pos]=answer, length=5, arithmetic', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('sequence', 0);
      assert.equal(q.seq.length, 5);
      assert.equal(q.seq[q.pos], q.answer);
      const step = q.seq[1] - q.seq[0];
      for (let j = 1; j < q.seq.length; j++)
        assert.equal(q.seq[j] - q.seq[j - 1], step);
    }
  });

  test('seqstep: seq[pos]=answer, arithmetic with step>1', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('seqstep', 0);
      assert.equal(q.seq[q.pos], q.answer);
      const step = q.seq[1] - q.seq[0];
      for (let j = 1; j < q.seq.length; j++)
        assert.equal(q.seq[j] - q.seq[j - 1], step);
      assert.ok(step >= 2, `seqstep step=${step} should be ≥ 2`);
    }
  });

  test('rozklad: part+answer=total', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('rozklad', 0);
      assert.equal(q.part + q.answer, q.total);
      assert.ok(q.answer >= 1);
    }
  });

  test('rozklad20: part+answer=total, total in [11,20]', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('rozklad20', 0);
      assert.equal(q.part + q.answer, q.total);
      assert.ok(q.total >= 11 && q.total <= 20, `rozklad20 total=${q.total}`);
    }
  });

  test('addsub20: sum in [0,20] for all tiers', () => {
    for (let tier = -1; tier <= 2; tier++) {
      for (let i = 0; i < N; i++) {
        const q = generateOne('addsub20', tier);
        assert.ok(q.sum >= 0 && q.sum <= 20, `addsub20 t=${tier} sum=${q.sum}`);
      }
    }
  });

  test('addsub20: slot answer matches operand', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('addsub20', 0);
      const expected = q.slot === 'result' ? q.sum : q.slot === 'a' ? q.a : q.b;
      assert.equal(q.answer, expected);
    }
  });

  test('peniaze: items sum = total ≤ 20, at least 2 items', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('peniaze', 0);
      const sum = q.items.reduce((s, it) => s + it.val, 0);
      assert.equal(sum, q.total);
      assert.equal(q.answer, q.total);
      assert.ok(q.total <= 20);
      assert.ok(q.items.length >= 2);
    }
  });

  test('magic: grid[blankPos]=answer, grid length=9', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('magic', 0);
      assert.equal(q.grid[q.blankPos], q.answer);
      assert.equal(q.grid.length, 9);
      assert.ok(q.blankPos >= 0 && q.blankPos < 9);
    }
  });

  test('magic easy (tier -1): sum ≤ 9', () => {
    for (let i = 0; i < 30; i++)
      assert.ok(generateOne('magic', -1).sum <= 9);
  });

  test('magic expert (tier 2): sum >= 15', () => {
    for (let i = 0; i < 30; i++)
      assert.ok(generateOne('magic', 2).sum >= 15);
  });

  test('wordproblem: op result in [0,20]', () => {
    for (let i = 0; i < N; i++) {
      const q = generateOne('wordproblem', 0);
      const expected = q.op === '+' ? q.a + q.b : q.a - q.b;
      assert.equal(q.sum, expected);
      assert.ok(q.sum >= 0 && q.sum <= 20, `wordproblem sum=${q.sum}`);
    }
  });
});

// ─── generateQuestions ───────────────────────────────────────────────────────

describe('generateQuestions', () => {
  test('returns QUESTIONS_PER_LEVEL for each type', () => {
    for (const type of ALL_TYPES) {
      assert.equal(generateQuestions(type).length, QUESTIONS_PER_LEVEL, type);
    }
  });

  test('all questions have correct type field', () => {
    for (const type of ALL_TYPES) {
      generateQuestions(type).forEach(q => assert.equal(q.type, type));
    }
  });

  test('generates without error under non-trivial stats', () => {
    withStats({ add5: { count: 20, mistakes: 0 } }, () => {
      const qs = generateQuestions('add5');
      assert.equal(qs.length, QUESTIONS_PER_LEVEL);
    });
  });
});

// ─── LEVEL_TYPES / getLevelType ──────────────────────────────────────────────

describe('LEVEL_TYPES', () => {
  test('do10 has 6 levels', () => assert.equal(LEVEL_TYPES.do10.length, 6));
  test('do20 has 7 levels', () => assert.equal(LEVEL_TYPES.do20.length, 7));
  test('pokrocile has 7 levels', () => assert.equal(LEVEL_TYPES.pokrocile.length, 7));
  test('do20[0] is compare (not count)', () => assert.equal(LEVEL_TYPES.do20[0], 'compare'));
  test('pokrocile[6] is magic', () => assert.equal(LEVEL_TYPES.pokrocile[6], 'magic'));
});

describe('getLevelType', () => {
  test('do10 level 0 → count', () =>
    withMode('do10', () => assert.equal(getLevelType(0), 'count')));
  test('do20 level 0 → compare', () =>
    withMode('do20', () => assert.equal(getLevelType(0), 'compare')));
  test('pokrocile level 6 → magic', () =>
    withMode('pokrocile', () => assert.equal(getLevelType(6), 'magic')));
  test('null mode falls back to do20', () =>
    withMode(null, () => assert.equal(getLevelType(0), 'compare')));
});
