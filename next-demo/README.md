# Real-Time Game UI Demo

## Why I built this

I built this as a pilot project for the **Evolution Frontend Engineer — Graphics & Rendering** role.  
The goal was to demonstrate that I understand the environment: real-time canvas animation, frame budget awareness, and compositing a React UI on top of a live rendering surface.

## Tech used

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Graphics | PixiJS v8 (WebGL/WebGPU renderer) |
| Animation | `requestAnimationFrame` via PixiJS Ticker |
| Styling | Tailwind CSS v4 |

## What I focused on

- **Real-time animation loop** — PixiJS Ticker drives all motion (wheel spin, floating chips, burst particles) at 60 fps via `requestAnimationFrame`. Delta-time scaling keeps animation speed frame-rate independent.
- **Canvas rendering** — the roulette wheel is drawn entirely with the PixiJS `Graphics` API (no image assets). Segment arcs, labels, glow filter, and the centre hub are all GPU-rendered.
- **React / PixiJS boundary** — the canvas lives in a single `useEffect` with a stable `ref` handle for imperative control (`spin()`). This keeps React re-renders completely out of the hot animation path.
- **Performance panel** — live FPS counter and stage object count are overlaid on the canvas so the frame budget is always visible.
- **Mobile responsive** — layout adapts from desktop to narrow mobile viewports.

## What was hard

Keeping React state updates (balance, result) decoupled from the PixiJS ticker without causing stale closures. The solution is passing callbacks through a stable `MutableRefObject<GameCanvasHandle>` so the ticker never captures stale React state, and state updates fire only on spin completion — not every frame.

## What I would improve next

- Object pooling for the particle system (pre-allocate, re-use, avoid GC spikes)
- WebGL shader pass for the glow effect instead of `BlurFilter`
- Chrome DevTools flame-chart profiling to measure JS frame time vs GPU rasterisation time
- Babylon.js 3D track version to compare WebGL overhead models
- CI performance budget gate (Lighthouse + custom FPS threshold)

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## How to play

1. Select a bet size (€10 / €25 / €50 / €100).
2. Click **SPIN**.
3. Green (0) pays 35×. Red pays 2×. Black pays nothing.
4. Click **Reset** to restore the starting balance.

---

*Game UI prototype — no real money involved.*
