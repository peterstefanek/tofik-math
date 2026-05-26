# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tofík a cesta ku hviezdam** is a Progressive Web App (PWA) — an educational math game for Slovak first-graders.

> **Game rules & mechanics are documented in [`RULES.md`](RULES.md). Keep it up to date whenever you change question types, scoring, sensors, sounds, or localStorage keys.**

## Running Locally

No build step. Serve as static files:

```bash
python -m http.server 8000
# or
npx http-server
```

Then open `http://localhost:8000/index.html`.

**HTTPS note:** Service Worker registration requires HTTPS on iOS. For local testing on a phone, use a tool like `ngrok` or deploy to a host with HTTPS.

## File Structure

| File | Purpose |
| --- | --- |
| `index.html` | HTML structure |
| `styles.css` | All CSS |
| `app.js` | Main app — state, screens, game loop, rendering |
| `manifest.json` | PWA manifest (name, icons, display mode, orientation) |
| `service-worker.js` | Cache-first offline strategy, current cache key `tofik-v44` |
| `icon.svg` | App icon (fox face, maskable, 512×512) |
| `RULES.md` | Game rules, mechanics, question types — keep in sync with code |
| `tests/` | Node.js unit tests (`node --test tests/*.test.js`) |

### `modules/` — JS modules imported by `app.js`

| File | Purpose |
| --- | --- |
| `modules/strings.js` | All Slovak UI strings — single source of truth for text |
| `modules/audio.js` | Audio engine (Tone.js wrapper, sound effects, mute toggle) |
| `modules/questions.js` | Question generation: all 12 types, `difficultyTier`, `makeOptions` |
| `modules/mechanics.js` | Interactive render helpers: compare scale, rozklad shake, peniaze scatter, word problem hints |

Inter-module imports use relative `'./...'` paths (siblings). `app.js` imports from `'./modules/...'`.

## Architecture

The app is a **screen-based SPA** with no client-side router. All state lives in a single `state` object in `app.js`; screens are CSS `display`-toggled via `showScreen()`.

### Key JavaScript Systems

#### State Management (`state` object)

- Tracks current screen, level index, question index
- Level metadata: 7 levels, each with `type`, `x`/`y` map position, `stars`, `done`
- Pet selection, difficulty mode (`do10` / `do20` / `pokrocile`), custom name

#### Persistence (localStorage only, no backend)

- `SAVE_KEY` — game progress (pet, mode, level completion)
- `STATS_KEY` — performance statistics (last 200 attempts, per-skill aggregates, daily activity)

#### Question Generation (`generateOne`, `generateQuestions`)

- 12 question types: `count`, `add5`, `rozklad`, `compare`, `add10`, `sequence`, `addsub20`, `rozklad20`, `seqstep`, `peniaze`, `wordproblem`, `magic`
- Per-mode type sequence defined in `LEVEL_TYPES`; `getLevelType(idx)` maps level index to type
- Smart distractor generation; deduplication within a level
- 4 questions per level

#### Sensor Integration

- `DeviceOrientationEvent` (gamma axis) for tilt-based answers
- `DeviceMotionEvent` for shake detection (800 ms debounce)
- iOS 13+ explicit permission request; graceful fallback to tap

#### Map Rendering (`renderMap`)

- SVG path drawn dynamically; level nodes positioned by percentage coordinates
- Visual states: locked (grayscale), current (pulsing), done (stars shown), bonus star badge

#### Parent Dashboard (`renderParentStats`)

- Reads `stats` from localStorage; no external analytics

### Difficulty Modes

- `do10` — 6 levels, addition within 10
- `do20` — 7 levels, adds subtraction/addition within 20
- `pokrocile` — 7 levels, advanced exercises (compare 1–18, rozklad 11–20, sequences with step, peniaze, word problems, magic square)

### Star Scoring

- 3 stars: 0 mistakes; 2 stars: 1–2 mistakes; 1 star: 3+ mistakes
- Bonus star: awarded for answering a harder bonus question within 15 s after a perfect level

## Updating the Service Worker Cache

When adding new files (images, fonts, etc.), add them to the `APP_SHELL` array in `service-worker.js`. Bump the `CACHE_NAME` version string (e.g. `tofik-v17` → `tofik-v18`) so old caches are cleared on next visit.

## Language

All UI text is in **Slovak**. Keep new strings consistent with the existing tone (child-friendly, encouraging).

---

## Design & Typography

### Fonts — NEVER change without explicit approval

Three fonts are used with specific roles. Do not swap, merge, or "improve" them.

| Font | Role | Why |
| --- | --- | --- |
| Andika | All readable text: questions, prompts, answer buttons, speech bubbles, labels | Designed for beginner readers. Simple single-story 'a' and 'g' matching Slovak school textbooks. Full Slovak diacritics. |
| Baloo 2 | Headings, numbers, titles, big UI elements: equation digits, map title, result title, navigation buttons | Rounded, playful, child-friendly. Full Slovak diacritics supported. |
| Caveat | Decorative accents only: `.super`, `.sub`, win screen subtitle | Handwritten feel for atmosphere. NOT used where child reads instructions. |

**Critical:** A first-grader learns to read alongside playing this game. Font shapes must match Slovak school textbooks. If a font is missing a Slovak character (š, ž, č, ť, ď, ľ, á, é, í, ó, ú, ô, ä, ŕ, ĺ, ň), find a compatible font with the same role — do NOT silently replace the entire font family with a generic alternative like Inter, Roboto, or system-ui.

### Color palette — defined in CSS variables, do not hardcode

All colors are in `:root` in `styles.css`. Always use variables, never hardcode hex values inline.

| Variable | Value | Usage |
| --- | --- | --- |
| `--c-accent` | #ff8c42 | Primary CTA, active elements |
| `--c-accent-2` | #f25c54 | Errors, danger |
| `--c-green` | #5ca85c | Correct answers, success |
| `--c-green-dk` | #3d7a3d | Button shadows, text on green |
| `--c-yellow` | #f2c94c | Stars, current map node |
| `--c-blue` | #5fb7d4 | Hints, compare groups |
| `--c-cream` | #fffaf0 | Card backgrounds |
| `--c-ink` | #3a2e1f | Primary text |
| `--c-ink-soft` | #6b5a45 | Secondary text, labels |

### Visual language — core principles

- **Border radius:** Cards 18–28px, buttons 20–28px, small elements 12–16px. Never sharp corners (0px) anywhere visible to the child.
- **Shadows:** Always use the layered pattern: `0 Npx 0 var(--c-shadow-soft), 0 Mpx Lpx var(--c-shadow)`. The first layer creates a 3D "press" effect. Never use a single flat drop-shadow.
- **Button press state:** All tappable elements must have `:active` with `translateY(3px)` and reduced shadow — gives physical feedback on touch.
- **Background:** Always the warm gradient (`--c-bg-top → --c-bg-mid → --c-bg-bot`). Never a solid white or solid color background.
- **No red ✗ feedback:** Wrong answers use shake animation + soft color (`--c-accent-2`), never a red X or the word "Zle". The tone is always "try again", never "you failed".

### Touch targets

Minimum tap area: **64×64px** for answer buttons, **44×44px** for navigation icons. This is a hard floor — first-graders have imprecise motor control. Do not reduce sizes to fit more elements on screen; instead simplify the layout.

### Animations — do not remove or shorten

Animations serve a pedagogical purpose (micro-rewards, attention direction). Key animations and their minimum durations:

| Animation | Element | Min duration | Purpose |
| --- | --- | --- | --- |
| answer-stamp | `.slot-blank.filled` | 500ms | Reinforces correct answer |
| star-pop | `.star-big.show` | 600ms | Reward moment |
| pulse | `.node.current` | 1600ms loop | Directs attention to next level |
| celebrate | `.answer-btn.correct` | 500ms | Positive reinforcement |
| shake | `.answer-btn.wrong` | 400ms | Non-punishing error signal |
| confetti fall | `.confetti` | 1500–2500ms | Level completion reward |

Do not remove animations for "performance" without profiling first. On mid-range Android phones (target device) CSS animations are GPU-accelerated and have negligible impact.

### Screen layout

The app is **portrait-only**, max-width 480px, centered. Never add landscape-specific styles or assume a wide viewport. Safe area insets (`env(safe-area-inset-*)`) are already handled in `.screen` padding — do not change this.

### What NOT to do

- Do not add new external CSS frameworks (Bootstrap, Tailwind, etc.)
- Do not introduce CSS-in-JS or style attributes for anything other than dynamically computed values (e.g. `style="width: ${pct}%"` is OK)
- Do not use system fonts as fallback for display text — always specify the full font stack with Google Fonts loaded
- Do not change font sizes globally — they are calibrated for a 6-year-old reading on a phone at arm's length (~38cm)
- Do not add new screens without following the `.screen` + `showScreen()` pattern
- Do not use `!important` except where already present
