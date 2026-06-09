# Yuki — AI Companion Widget (Roulette POC)

A mobile-first floating anime companion named **Yuki** on top of a simple roulette game. Built with **plain HTML, CSS, and JavaScript** — no React, no build step.

Yuki's voice is powered by **Inworld Realtime** (speech-to-speech over WebSocket). There is **no browser TTS** — all spoken conversation goes through Inworld.

---

## Quick start

### 1. Install & configure

```bash
cd yuki
npm install
cp .env.example .env
```

Edit `.env` and set your Inworld credential:

```env
INWORLD_API_KEY=your_base64_credential_here
PORT=8787
```

The key is the Base64 string used after `Basic` in the `Authorization` header. **Never commit `.env` or hardcode the key in source.**

### 2. Run

```bash
npm start
```

Open **http://localhost:8787** on your phone, or use the browser device toolbar on desktop.

**Companion-only view (no casino):** [http://localhost:8787/companion.html](http://localhost:8787/companion.html)

The Node server serves the static site **and** proxies the WebSocket to Inworld:

```
Browser (mic/speaker) ←WebSocket→ Node server ←WebSocket→ Inworld API
```

### 3. Try it

- **SPIN** the roulette — Yuki reacts with emotion + text bubble (no voice for game events).
- Tap **Talk** — grants mic, opens Inworld Realtime session. Yuki will say a quick hello, then listen.
- Tap **End** — closes the voice session.
- **Mute** silences Yuki's audio output only.
- **Hide** tucks Yuki to the screen edge; tap her peek tab to bring her back.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| "WebSocket connection failed" | Run `npm start` in the `yuki/` folder — don't open `index.html` directly or use `python -m http.server` alone |
| "Connection timed out" | Check `.env` has `INWORLD_API_KEY` set, then restart with `npm start` |
| No voice / mic error | Allow microphone in browser; use Chrome or Safari on mobile |
| Page loads but Talk does nothing | Must use **http://localhost:8787** (the Node server), not port 8000 or `file://` |

Verify the backend:
```bash
npm run test:greeting   # should print SUCCESS
```

---

## Emotions (sprite set)

Sprites match `assets/Yuki_*.png` and map to **interaction states**:

| Emotion | When |
|---------|------|
| `idle` | Default, between turns |
| `listening` | User is speaking |
| `thinking` | Processing / connecting |
| `talking` | Yuki is speaking (Inworld audio) |
| `happy` | Roulette win |
| `excited` | Roulette big win |
| `sad` | Roulette loss (supportive) |
| `worried` | Mic denied / connection error |

---

## Architecture

```
roulette.js  ──emits──▶  EventBus  ──▶  widget.js  ──▶  character.js (visual reactions)
                              │
                              └──▶  voice.js  ──WebSocket──▶  server/index.js  ──▶  Inworld
```

- **Game** and **companion** are fully decoupled via `EventBus`.
- **No API keys in the browser** — the proxy in `server/index.js` reads `INWORLD_API_KEY` from the environment.
- **No TTS** — `voice.js` streams PCM16 audio to/from Inworld only.

### Files

| File | Role |
|------|------|
| `server/index.js` | Static host + Inworld WebSocket proxy |
| `server/sessionConfig.js` | Server-side session config reference |
| `js/sessionConfig.js` | Client `session.update` sent after `session.created` |
| `js/voice.js` | Mic capture, audio playback, Realtime protocol |
| `js/widget.js` | Floating overlay + emotion state machine |
| `js/character.js` | Roulette reaction lines (bubbles only) |
| `js/config.js` | Sprites, proxy port, tuning (no secrets) |
| `assets/Yuki_*.png` | Character sprites (8 emotions) |

---

## Inworld Realtime protocol

1. Browser opens `ws://localhost:8787/realtime`
2. Proxy connects to `wss://api.inworld.ai/api/v1/realtime/session?...` with `Authorization: Basic $INWORLD_API_KEY`
3. Client receives `session.created` → sends `session.update` (Yuki personality in `js/sessionConfig.js`)
4. Client receives `session.updated` → starts streaming mic as `input_audio_buffer.append` (PCM16, 24 kHz, mono)
5. Agent audio arrives as `response.output_audio.delta` → played via Web Audio API
6. On `input_audio_buffer.speech_started` → interrupt playback + `response.cancel`

Roulette outcomes are injected as silent system messages via `Voice.notifyGameEvent()` so Yuki can reference them in conversation.

---

## Deploy

- **Static-only** (no voice): host the `yuki/` folder on any static server — game + visual reactions work, Talk will not connect.
- **Full experience**: deploy the Node server (`npm start`) with `INWORLD_API_KEY` set in the hosting environment (Railway, Fly.io, Render, etc.).

---

## References

- [Inworld Realtime overview](https://docs.inworld.ai/realtime/overview)
- [WebSocket quickstart](https://docs.inworld.ai/realtime/quickstart-websocket)
- [JS examples](https://github.com/inworld-ai/inworld-api-examples/tree/main/realtime/js)
