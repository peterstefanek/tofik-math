# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tofík a cesta ku hviezdam** is a single-file Progressive Web App (PWA) — an educational math game for Slovak first-graders. All application code lives in one file: `tofik-matematika.html`.

## Running Locally

No build step. Serve as static files:

```bash
python -m http.server 8000
# or
npx http-server
```

Then open `http://localhost:8000/tofik-matematika.html`.

**HTTPS note:** Service Worker registration requires HTTPS on iOS. For local testing on a phone, use a tool like `ngrok` or deploy to a host with HTTPS.

## File Structure

| File | Purpose |
|------|---------|
| `tofik-matematika.html` | Entire application (HTML + CSS + JS, ~3,000 lines) |
| `manifest.json` | PWA manifest (name, icons, display mode, orientation) |
| `service-worker.js` | Cache-first offline strategy, cache key `tofik-v1` |
| `icon.svg` | App icon (fox face, maskable, 512×512) |

## Architecture

The app is a **screen-based SPA** with no client-side router. All state lives in a single `state` object; screens are CSS `display`-toggled via `showScreen()`.

### Key JavaScript Systems

**State Management** (`state` object)
- Tracks current screen, level index, question index
- Level metadata: 7 levels, each with `type`, `x`/`y` map position, `stars`, `done`
- Pet selection, difficulty mode (`do10` / `do20`), custom name

**Persistence** (localStorage only, no backend)
- `SAVE_KEY` — game progress (pet, mode, level completion)
- `STATS_KEY` — performance statistics (last 200 attempts, per-skill aggregates, daily activity)

**Question Generation** (`generateOne`, `generateQuestions`)
- 7 question types: `count`, `add5`, `rozklad`, `compare`, `add10`, `sequence`, `addsub20`
- Smart distractor generation; deduplication within a level
- 4 questions per level

**Sensor Integration**
- `DeviceOrientationEvent` (gamma axis) for tilt-based answers
- `DeviceMotionEvent` for shake detection (800 ms debounce)
- iOS 13+ explicit permission request; graceful fallback to tap

**Map Rendering** (`renderMap`)
- SVG path drawn dynamically; level nodes positioned by percentage coordinates
- Visual states: locked (grayscale), current (pulsing), done (stars shown)

**Parent Dashboard** (`renderParentStats`)
- Reads `stats` from localStorage; no external analytics

### Difficulty Modes
- `do10` — 6 levels, addition within 10
- `do20` — 7 levels, adds subtraction/addition within 20

### Star Scoring
- 3 stars: 0 mistakes; 2 stars: 1 mistake; 1 star: 2 mistakes; 0 stars: 3+ mistakes

## Updating the Service Worker Cache

When adding new files (images, fonts, etc.), add them to the `CACHE_FILES` array in `service-worker.js`. Bump the `CACHE_NAME` version string (`tofik-v1` → `tofik-v2`) so old caches are cleared on next visit.

## Language

All UI text is in **Slovak**. Keep new strings consistent with the existing tone (child-friendly, encouraging).
