# CasinoWaifu — Yuki AI Companion + Roulette

Mobile-first roulette game with **Yuki**, an anime AI companion powered by **Inworld Realtime** voice. Plain HTML, CSS, and JavaScript — no React, no build step.

```
npm install
cp .env.example .env   # add INWORLD_API_KEY
npm start              # http://localhost:8787
```

**Companion-only:** [http://localhost:8787/companion.html](http://localhost:8787/companion.html)

---

## What you get

- European roulette with chip betting and spin history
- Yuki widget above bet controls — **Mute** (left), **Hide/Show** (right)
- **Visible mode:** character + live voice, no text bubbles
- **Hidden mode:** Yuki slides under the controls; text toasts for game events + **"Talk to me"** prompt
- Inworld Realtime speech-to-speech (no browser TTS)

---

## Quick start

### 1. Install & configure

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
INWORLD_API_KEY=your_base64_credential_here
PORT=8787
```

Never commit `.env` or hardcode the API key.

### 2. Run

```bash
npm start
```

Open **http://localhost:8787** (must use the Node server — not `file://` or a static-only host).

### 3. Controls

| Control | Action |
|---------|--------|
| **SPIN** | Play roulette; Yuki reacts (voice when visible, toasts when hidden) |
| **🔊 / 🔇** | Mute or resume voice session |
| **Hide / Show** | Slide Yuki under controls; Show pops her back |
| **Tap Yuki** | Grant mic + connect voice (if not auto-connected) |

### Troubleshooting

| Problem | Fix |
|---------|-----|
| WebSocket failed | Run `npm start` from repo root |
| Connection timed out | Check `INWORLD_API_KEY` in `.env`, restart server |
| No mic | Allow microphone in browser; use Chrome or Safari |
| Preview port (8123) | Voice proxy auto-routes to port 8787 |

```bash
npm run test:greeting   # should print SUCCESS
```

---

## Architecture

```
roulette.js  ──▶  EventBus  ──▶  widget.js  ──▶  character.js
                     │
                     └──▶  voice.js  ──▶  server/index.js  ──▶  Inworld
```

| Path | Role |
|------|------|
| `server/index.js` | Static host + WebSocket proxy |
| `js/voice.js` | Mic, playback, Realtime protocol |
| `js/widget.js` | UI, mute/hide, emotions |
| `js/character.js` | Reaction lines |
| `assets/Yuki_*.png` | 8 emotion sprites |

---

## Deploy

### Vercel (game + UI)

This repo includes `vercel.json` so Vercel deploys the **static Yuki app**, not the Next.js demo in `next-demo/`.

1. Import the GitHub repo on [vercel.com](https://vercel.com)
2. **Framework Preset:** Other (or leave as auto — `vercel.json` overrides Next.js)
3. **Root Directory:** `.` (repo root)
4. **Build Command:** `node scripts/vercel-build.mjs` (already in `vercel.json`)
5. **Install Command:** leave empty
6. Redeploy

The roulette game, Yuki widget, hide/mute UI, and sprites all work on Vercel.

**Voice on Vercel:** Vercel cannot host persistent WebSocket proxies. For Inworld voice in production:

1. Deploy `server/index.js` to **Railway**, **Render**, or **Fly.io** with `INWORLD_API_KEY` set
2. In Vercel → Settings → Environment Variables, add:
   ```
   VOICE_PROXY_URL=wss://your-voice-service.example.com/realtime
   ```
3. Redeploy Vercel so `scripts/vercel-build.mjs` injects that URL into the client

Without `VOICE_PROXY_URL`, the site works but Talk/voice will not connect.

### Local / full stack

```bash
npm install
cp .env.example .env
npm start
```

### Static-only (no voice)

Host the repo root on any static host — game + visual reactions work; voice needs the Node proxy.

### Next.js demo

The older PixiJS prototype lives in `next-demo/` (`cd next-demo && npm install && npm run dev`).

---

*Game prototype — no real money involved.*
