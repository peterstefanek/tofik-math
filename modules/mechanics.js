import { S } from './strings.js';
import { audio } from './audio.js';
import { makeOptions, pick } from './questions.js';

let _cb = {};

export function bindContext(callbacks) {
  _cb = callbacks;
}

// ========== SCALE (TILT) MECHANIC ==========
export async function renderCompareScale(q, visual) {
  // Build scale DOM
  const wrap = document.createElement('div');
  wrap.className = 'scale-wrap';
  const heavySide = q.a > q.b ? 'L' : 'R'; // q.answer
  const itemsL = q.emoji.repeat(q.a);
  const itemsR = q.emoji.repeat(q.b);
  // Items are heaped on the pan (uniform size, slight overlap) so big counts
  // stay inside the bowl instead of spilling out — the count badge is the
  // authoritative value, the pile is just a size cue.
  const pile = (items) => [...items].map(e => `<span class="item">${e}</span>`).join('');
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
          <div class="scale-pan-items">${pile(itemsL)}</div>
          <div class="count-badge">${q.a}</div>
        </div>
        <div class="scale-pan right">
          <div class="scale-pan-rope"></div>
          <div class="scale-pan-items">${pile(itemsR)}</div>
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
      instruction.textContent = S.feedback.scaleGood;
      instruction.classList.add('success');
    } else if (wrongDir) {
      holdMs = Math.max(0, holdMs - dt * 0.5);
      instruction.textContent = S.feedback.scaleWrong;
      instruction.classList.remove('success');
    } else {
      holdMs = Math.max(0, holdMs - dt * 0.3);
      instruction.textContent = S.prompts.compareScale;
      instruction.classList.remove('success');
    }
    progressFill.style.width = (holdMs / HOLD_TARGET * 100) + '%';

    if (holdMs >= HOLD_TARGET) {
      done = true;
      audio.play('correct');
      audio.tiltStop();
      _cb.stopTiltListener();
      _cb.finalizeAttempt(heavySide === 'L' ? 'vľavo' : 'vpravo');
      instruction.textContent = S.feedback.scaleSuccess;
      instruction.classList.add('success');
      if (navigator.vibrate) navigator.vibrate(60);
      _cb.showFeedback(pick(S.feedback.correctShort));
      setTimeout(_cb.advance, 900);
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
  const perm = await _cb.requestSensorPermission();
  // Guard: user may have already answered via fallback buttons while we awaited permission
  if (perm === 'granted' && !done) {
    audio.tiltStart();
    _cb.startTiltListener((gamma) => {
      // Visualize phone tilt directly (gamma negative = left)
      const weightBias = (heavySide === 'L' ? -4 : 4) * 0.3;
      setBeamTilt(gamma * 0.4 + weightBias);
      tick(gamma);
    });
  }
}

// ========== ROZKLAD SHAKE (BEAN SCATTER) MECHANIC ==========
export async function renderRozkladShake(q, visual) {
  const wrap = document.createElement('div');
  wrap.className = 'bean-wrap';
  wrap.innerHTML = `
    <div class="bean-count-badge">${q.total}</div>
    <div class="bean-instruction" id="bean-instruction">${S.beans.shake}</div>
    <div class="bean-stage" id="bean-stage">
      <div class="basket left"><div class="basket-floor"></div><div class="basket-label" id="basket-label-l">?</div></div>
      <div class="basket right"><div class="basket-floor"></div><div class="basket-label" id="basket-label-r">?</div></div>
    </div>
    <div class="bean-shake-btn">
      <button class="shake-prompt" id="manual-shake">${S.beans.manualBtn}</button>
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
    _cb.stopShakeListener();
    audio.play('shake-rattle');
    instr.textContent = S.beans.falling;
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
            const dest = b.x < MIDLINE ? 'L' : 'R';
            b.basket = dest;
            // Clamp bean inside its basket's visual bounds (baskets: 45% wide, left@2%, right@2%)
            const HALF_BEAN = 13;
            const safeL = { min: W * 0.04 + HALF_BEAN, max: W * 0.47 - HALF_BEAN };
            const safeR = { min: W * 0.53 + HALF_BEAN, max: W * 0.94 - HALF_BEAN };
            const bounds = dest === 'L' ? safeL : safeR;
            b.x = Math.max(bounds.min, Math.min(bounds.max, b.x));
            b.el.style.transition = 'left 0.15s ease';
            b.el.style.left = b.x + 'px';
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

      instr.innerHTML = S.beans.question(showLeft ? S.beans.sideLeft : S.beans.sideRight, knownCount);

      // Re-start attempt with the actual problem (post-scatter); the question
      // really begins now, not when the scatter animation started.
      _cb.setCurrentAttempt({
        type: 'rozklad',
        variant: 'shake',
        label: `${knownCount} + ? = ${q.total}`,
        correct: String(unknownCount),
        given: [],
        mistakes: 0,
        startedAt: Date.now(),
      });

      // Build new answer options based on actual outcome
      const options = makeOptions(unknownCount, 0, q.total);
      const grid = document.getElementById('answer-grid');
      grid.innerHTML = '';
      options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => _cb.handleAnswer(btn, opt, unknownCount));
        grid.appendChild(btn);
      });
    }, 700);
  }

  // Manual fallback button (always present and visible — works even without sensors)
  manualBtn.addEventListener('click', scatter);

  // Try sensors
  const perm = await _cb.requestSensorPermission();
  if (perm === 'granted') {
    _cb.startShakeListener(scatter);
  }
}

// ========== PENIAZE PIGGY BANK SCATTER ==========
export function renderPeniazeScatter(q, visual) {
  const wrap = document.createElement('div');
  wrap.className = 'peniaze-scatter-wrap';
  wrap.innerHTML = `
    <div class="piggy-stage" id="piggy-stage">
      <div class="piggy-bank" id="piggy-bank">🐷</div>
    </div>
    <div class="piggy-instruction" id="piggy-instruction">${S.peniaze.click}</div>
  `;
  visual.appendChild(wrap);

  const stage     = document.getElementById('piggy-stage');
  const piggyEl   = document.getElementById('piggy-bank');
  const instrEl   = document.getElementById('piggy-instruction');
  let broken = false;

  piggyEl.addEventListener('click', () => {
    if (broken) return;
    broken = true;
    audio.play('pop');
    if (navigator.vibrate) navigator.vibrate([30, 60, 80]);
    piggyEl.classList.add('piggy-breaking');
    setTimeout(() => {
      piggyEl.textContent = '💥';
      piggyEl.classList.remove('piggy-breaking');
      instrEl.textContent = S.peniaze.count;
      setTimeout(() => {
        piggyEl.style.display = 'none';
        scatterCoins();
      }, 320);
    }, 380);
  });

  function scatterCoins() {
    const W = stage.clientWidth  || 300;
    const H = stage.clientHeight || 210;
    const cx = W / 2, cy = H / 2;

    // Half-dimensions (width/2, height/2) matching CSS sizes
    const HDIMS = {
      coin1:  { hw: 20, hh: 20 },
      coin2:  { hw: 27, hh: 27 },
      note5:  { hw: 38, hh: 21 },
      note10: { hw: 46, hh: 25 },
    };
    const GAP = 10; // minimum gap between edges of any two items
    const PAD = 10; // distance from stage border
    const placed = [];

    function overlaps(x, y, hw, hh) {
      return placed.some(p =>
        Math.abs(x - p.x) < hw + p.hw + GAP &&
        Math.abs(y - p.y) < hh + p.hh + GAP
      );
    }

    function findPos(hw, hh) {
      const minX = hw + PAD, maxX = W - hw - PAD;
      const minY = hh + PAD, maxY = H - hh - PAD;
      for (let i = 0; i < 120; i++) {
        const x = minX + Math.random() * (maxX - minX);
        const y = minY + Math.random() * (maxY - minY);
        if (!overlaps(x, y, hw, hh)) return { x, y };
      }
      return { x: minX + Math.random() * (maxX - minX), y: minY + Math.random() * (maxY - minY) };
    }

    let buttonsShown = false;
    const showButtons = () => { if (!buttonsShown) { buttonsShown = true; _cb.renderAnswerButtons(q.options, q.answer); } };
    const fallback = setTimeout(showButtons, 3000);

    q.items.forEach((item, idx) => {
      const key = item.isNote ? `note${item.val}` : `coin${item.val}`;
      const { hw, hh } = HDIMS[key] ?? { hw: 25, hh: 25 };
      const pos = findPos(hw, hh);
      placed.push({ x: pos.x, y: pos.y, hw, hh });

      const el = document.createElement('div');
      el.className = `peniaze-fly ${item.isNote ? `note-fly note-val-${item.val}` : `coin-fly coin-val-${item.val}`}`;
      el.textContent = item.val + '€';
      el.style.left = cx + 'px';
      el.style.top  = cy + 'px';
      stage.appendChild(el);

      // Fly to final position with springy ease, staggered per item
      const delay = 40 + idx * 80;
      setTimeout(() => {
        el.style.transition = `left 0.45s cubic-bezier(0.22,1.3,0.36,1) ${idx * 0.04}s, top 0.45s cubic-bezier(0.22,1.3,0.36,1) ${idx * 0.04}s`;
        el.style.left = pos.x + 'px';
        el.style.top  = pos.y + 'px';
        audio.play('bean-drop');
      }, delay);
    });

    const totalMs = 40 + q.items.length * 80 + 500;
    setTimeout(() => { clearTimeout(fallback); showButtons(); }, totalMs);
  }
}

export function buildWpHint(panel, q) {
  const cap = 20;
  if (q.op === '+') {
    const rowA = document.createElement('div');
    rowA.className = 'wp-hint-row';
    for (let i = 0; i < Math.min(q.a, cap); i++) {
      const s = document.createElement('span'); s.textContent = q.emoji; rowA.appendChild(s);
    }
    const opEl = document.createElement('div');
    opEl.className = 'wp-hint-op'; opEl.textContent = '+';
    const rowB = document.createElement('div');
    rowB.className = 'wp-hint-row';
    for (let i = 0; i < Math.min(q.b, cap); i++) {
      const s = document.createElement('span'); s.textContent = q.emoji; rowB.appendChild(s);
    }
    panel.appendChild(rowA);
    panel.appendChild(opEl);
    panel.appendChild(rowB);
  } else {
    // subtraction: first (a-b) items normal, last b items crossed out
    const row = document.createElement('div');
    row.className = 'wp-hint-row';
    const keep = q.a - q.b;
    for (let i = 0; i < Math.min(q.a, cap); i++) {
      const s = document.createElement('span');
      s.textContent = q.emoji;
      if (i >= keep) s.className = 'wp-crossed';
      row.appendChild(s);
    }
    panel.appendChild(row);
  }
}

export function makeGroupedDots(n, emoji) {
  // Group by 5 for visual readability (helps with crossing-10 strategy)
  let html = '<span class="dot-group">';
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 5 === 0) html += '</span><span class="dot-group">';
    html += emoji;
  }
  return html + '</span>';
}
