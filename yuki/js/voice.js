/**
 * voice.js — Inworld Realtime speech-to-speech (no browser TTS)
 * -----------------------------------------------------------------------------
 * Connects to the local WebSocket proxy (server/index.js), which forwards to
 * Inworld's Realtime API. Handles mic capture, PCM16 streaming, and agent audio
 * playback.
 *
 * Public API:
 *   Voice.connect()              start voice session (mic + WebSocket)
 *   Voice.disconnect()           end session
 *   Voice.toggleSession()        connect / disconnect
 *   Voice.isConnected()
 *   Voice.setMuted(bool)         mute agent audio output only
 *   Voice.isMuted()
 *   Voice.notifyGameEvent(type, payload)  inject roulette context (silent)
 *
 * EventBus events:
 *   voice:connecting / voice:ready / voice:closed / voice:error
 *   voice:listening:start / voice:listening:stop
 *   voice:thinking:start / voice:thinking:stop
 *   voice:speaking:start / voice:speaking:stop
 *   voice:transcript  { text, role }
 *   voice:level  { level }
 *   voice:muted  { muted }
 */

(function () {
  const cfg = window.YUKI_CONFIG || {};
  const bus = window.EventBus;
  const SAMPLE_RATE = 24000;
  const CHUNK_MS = 80;

  let ws = null;
  let connected = false;
  let sessionReady = false;
  let muted = false;
  let micStream = null;
  let captureCtx = null;
  let playbackCtx = null;
  let processor = null;
  let analyser = null;
  let levelRAF = null;
  let agentSpeaking = false;
  let userSpeaking = false;

  // Scheduled playback nodes for interrupt support
  let scheduledSources = [];
  let nextPlayTime = 0;

  const emit = (name, data) => bus && bus.emit(name, data);

  function wsUrl() {
    if (cfg.REALTIME && cfg.REALTIME.wsUrl) return cfg.REALTIME.wsUrl;

    const voicePort = Number(cfg.REALTIME?.port) || 8787;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const pagePort = window.location.port ? Number(window.location.port) : null;

    // Preview servers (8123, 5500, etc.) serve static files only — voice proxy is on REALTIME.port
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host);
    const onVoicePort = pagePort === voicePort || pagePort === 80 || pagePort === 443;

    if (local && pagePort && !onVoicePort) {
      return `${proto}//${host}:${voicePort}/realtime`;
    }

    return `${proto}//${window.location.host}/realtime`;
  }

  function voiceServerHealthUrl() {
    const voicePort = Number(cfg.REALTIME?.port) || 8787;
    const host = window.location.hostname;
    const pagePort = window.location.port ? Number(window.location.port) : null;
    const voiceOnSameHost =
      !pagePort || pagePort === voicePort || pagePort === 80 || pagePort === 443;
    const base = voiceOnSameHost
      ? `${window.location.protocol}//${window.location.host}`
      : `${window.location.protocol}//${host}:${voicePort}`;
    return `${base}/health`;
  }

  // ---------------------------------------------------------------------------
  // WebSocket session
  // ---------------------------------------------------------------------------
  function connect() {
    if (connected && sessionReady) return Promise.resolve();
    cleanupWs();
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = null;

      const succeed = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      };
      const fail = (msg) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        cleanupWs();
        emit("voice:error", { message: msg });
        reject(new Error(msg));
      };

      emit("voice:connecting");
      if (window.location.protocol === "file:") {
        fail("Open via npm start at http://localhost:8787 — voice does not work from file://");
        return;
      }
      const url = wsUrl();
      console.info("[Voice] connecting to", url);
      ws = new WebSocket(url);

      ws.onopen = () => {
        connected = true;
      };

      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (_) {
          return;
        }
        if (cfg.EVENT_SYSTEM?.debug) console.log("[Voice] ←", msg.type);
        handleServerMessage(msg, succeed, fail);
      };

      ws.onerror = () => fail("Voice server unreachable");
      ws.onclose = () => {
        const wasLive = sessionReady;
        cleanupWs();
        if (wasLive) emit("voice:closed");
        cleanupSession(false);
        if (!settled) fail("Voice connection closed");
      };

      timeoutId = setTimeout(() => {
        if (!settled) fail("Connection timed out");
      }, 20000);
    });
  }

  async function handleServerMessage(msg, onReady, onFail) {
    switch (msg.type) {
      case "error":
        onFail(msg.error?.message || "Inworld error");
        break;

      case "session.created":
        ws.send(JSON.stringify(window.YUKI_SESSION_UPDATE || buildDefaultSessionUpdate()));
        break;

      case "session.updated":
        sessionReady = true;
        emit("voice:ready");
        promptGreeting();
        onReady();
        break;

      case "input_audio_buffer.speech_started":
        userSpeaking = true;
        interruptPlayback();
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "response.cancel" }));
        }
        emit("voice:listening:start");
        emit("voice:thinking:stop");
        break;

      case "input_audio_buffer.committed":
        userSpeaking = false;
        emit("voice:listening:stop");
        emit("voice:thinking:start");
        break;

      case "response.output_audio.delta":
        if (!agentSpeaking) {
          agentSpeaking = true;
          emit("voice:thinking:stop");
          emit("voice:transcript:reset");
          emit("voice:speaking:start");
        }
        const audioB64 = msg.delta || msg.audio;
        if (!muted && audioB64) playAudioDelta(audioB64);
        break;

      case "response.output_audio_transcript.delta":
      case "response.output_text.delta":
        if (msg.delta) {
          emit("voice:transcript", { text: msg.delta, role: "yuki", partial: true });
        }
        break;

      case "response.done":
        agentSpeaking = false;
        emit("voice:speaking:stop");
        emit("voice:thinking:stop");
        if (!userSpeaking) emit("voice:listening:stop");
        break;

      default:
        break;
    }
  }

  function promptGreeting() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const casino = cfg.MODE !== "companion";
    const text = casino
      ? "Hey Yuki! I'm at the roulette table — say a quick friendly hello!"
      : "Hey Yuki! I just tapped Talk — say a quick friendly hello.";
    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      })
    );
    ws.send(JSON.stringify({ type: "response.create" }));
  }

  function buildDefaultSessionUpdate() {
    // Fallback if sessionConfig wasn't loaded — minimal config.
    return {
      type: "session.update",
      session: {
        type: "realtime",
        model: "inworld/llm-playground-export-2026-06-09",
        instructions: "You are Yuki, a friendly cheerful companion on a voice call.",
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: { model: "assemblyai/u3-rt-pro" },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              create_response: true,
              interrupt_response: true,
            },
          },
          output: { model: "inworld-tts-2", voice: "Abby" },
        },
      },
    };
  }

  function disconnect() {
    stopMicCapture();
    interruptPlayback();
    cleanupWs();
    cleanupSession(true);
  }

  function cleanupWs() {
    if (ws) {
      try { ws.close(); } catch (_) {}
    }
    ws = null;
    connected = false;
    sessionReady = false;
  }

  function cleanupSession(emitClosed) {
    stopLevelLoop();
    agentSpeaking = false;
    userSpeaking = false;
    if (emitClosed) emit("voice:closed");
  }

  async function ensureSession() {
    if (connected && sessionReady) return;
    await connect();
    emit("voice:session:live");
  }

  async function enableMicCapture() {
    if (processor && micStream) return true;

    emit("voice:mic:requesting");
    const micOk = await requestMic();
    if (!micOk) return false;

    return attachMicCapture();
  }

  /** Wire mic stream to WebSocket — call after requestMic() when stream already exists. */
  async function attachMicCapture() {
    if (!micStream) return false;

    captureCtx = captureCtx || new (window.AudioContext || window.webkitAudioContext)();
    playbackCtx = playbackCtx || captureCtx;
    if (playbackCtx.state === "suspended") await playbackCtx.resume();
    if (captureCtx.state === "suspended") await captureCtx.resume();

    if (!processor) await startMicCapture();
    return true;
  }

  async function startSession() {
    await ensureSession();
    const micOk = await enableMicCapture();
    if (!micOk) throw new Error("microphone-unavailable");
    return true;
  }

  async function toggleSession() {
    if (connected && sessionReady) {
      disconnect();
      return false;
    }
    return startSession();
  }

  // ---------------------------------------------------------------------------
  // Microphone capture → PCM16 24kHz → input_audio_buffer.append
  // ---------------------------------------------------------------------------
  async function requestMic() {
    if (micStream) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      emit("voice:mic:denied", { error: "getUserMedia unavailable" });
      return false;
    }
    const host = location.hostname;
    const local = host === "localhost" || host === "127.0.0.1";
    if (!window.isSecureContext && !local) {
      emit("voice:mic:denied", {
        error: "Microphone requires HTTPS when not on localhost. Use https or test on this computer.",
      });
      return false;
    }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      emit("voice:mic:granted");
      return true;
    } catch (err) {
      console.warn("[Voice] Mic denied/failed:", err);
      emit("voice:mic:denied", {
        error: String(err),
        name: err?.name || "Error",
      });
      return false;
    }
  }

  async function startMicCapture() {
    if (!micStream || !ws) return;
    captureCtx = captureCtx || new (window.AudioContext || window.webkitAudioContext)();
    playbackCtx = playbackCtx || captureCtx;

    if (captureCtx.state === "suspended") await captureCtx.resume();

    const source = captureCtx.createMediaStreamSource(micStream);
    analyser = captureCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferSize = 4096;
    processor = captureCtx.createScriptProcessor(bufferSize, 1, 1);
    let pending = new Float32Array(0);
    const samplesPerChunk = Math.floor((SAMPLE_RATE * CHUNK_MS) / 1000);

    processor.onaudioprocess = (e) => {
      if (!sessionReady || ws?.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const resampled = resample(input, captureCtx.sampleRate, SAMPLE_RATE);
      const merged = mergeFloat32(pending, resampled);
      pending = merged;
      while (pending.length >= samplesPerChunk) {
        const chunk = pending.slice(0, samplesPerChunk);
        pending = pending.slice(samplesPerChunk);
        const pcm = floatTo16BitPCM(chunk);
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: arrayBufferToBase64(pcm),
          })
        );
      }
    };

    source.connect(processor);
    const silent = captureCtx.createGain();
    silent.gain.value = 0;
    processor.connect(silent);
    silent.connect(captureCtx.destination);
    startLevelLoop();
  }

  function stopMicCapture() {
    if (processor) {
      try { processor.disconnect(); } catch (_) {}
      processor = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    stopLevelLoop();
  }

  function startLevelLoop() {
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!analyser) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      emit("voice:level", { level: Math.min(1, Math.sqrt(sum / data.length) * 3.2) });
      levelRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopLevelLoop() {
    if (levelRAF) cancelAnimationFrame(levelRAF);
    levelRAF = null;
    emit("voice:level", { level: 0 });
  }

  // ---------------------------------------------------------------------------
  // Agent audio playback (PCM16 24kHz mono)
  // ---------------------------------------------------------------------------
  function playAudioDelta(base64) {
    if (!playbackCtx) playbackCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (playbackCtx.state === "suspended") playbackCtx.resume();

    const pcm = base64ToArrayBuffer(base64);
    const samples = pcm16ToFloat32(pcm);
    applyEdgeFade(samples, 48);

    const buffer = playbackCtx.createBuffer(1, samples.length, SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const src = playbackCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(playbackCtx.destination);

    const now = playbackCtx.currentTime;
    if (nextPlayTime < now) nextPlayTime = now + 0.02;
    src.start(nextPlayTime);
    nextPlayTime += buffer.duration;
    scheduledSources.push(src);
    src.onended = () => {
      scheduledSources = scheduledSources.filter((s) => s !== src);
    };
  }

  function interruptPlayback() {
    scheduledSources.forEach((s) => {
      try { s.stop(); } catch (_) {}
    });
    scheduledSources = [];
    nextPlayTime = 0;
    if (agentSpeaking) {
      agentSpeaking = false;
      emit("voice:speaking:stop");
    }
  }

  // ---------------------------------------------------------------------------
  // Roulette integration — context + spoken reactions when voice is live
  // ---------------------------------------------------------------------------
  function notifyGameEvent(type, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReady) return;
    const lines = {
      WIN: `System: The player just won a roulette spin (+${payload.amount || "?"} credits, ${payload.color} ${payload.number}).`,
      LOSE: `System: The player just lost a roulette spin (-${payload.amount || "?"} credits, ${payload.color} ${payload.number}).`,
      BIG_WIN: `System: The player just hit a BIG WIN on roulette (+${payload.amount || "?"} credits, number ${payload.number})!`,
      IDLE: `System: The player has been quiet at the roulette table for a while.`,
    };
    const text = lines[type] || `System: Roulette event ${type}.`;
    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [{ type: "input_text", text }],
        },
      })
    );
  }

  /** When voice is live, Yuki speaks a brief reaction to a spin outcome. */
  function reactToGameEvent(type, payload = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReady) return false;

    notifyGameEvent(type, payload);

    if (type === "IDLE" || muted || userSpeaking || agentSpeaking) return false;

    const prompts = {
      WIN: `[Roulette win! +${payload.amount} credits on ${payload.color} ${payload.number}. React out loud — brief, happy, hyped!]`,
      LOSE: `[Roulette loss — lost ${payload.amount} credits. React supportively out loud — brief, warm, no criticism.]`,
      BIG_WIN: `[BIG WIN!! +${payload.amount} credits on number ${payload.number}! Celebrate out loud — super excited!]`,
    };
    const text = prompts[type];
    if (!text) return false;

    ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      })
    );
    ws.send(JSON.stringify({ type: "response.create" }));
    return true;
  }

  function setMuted(value) {
    muted = !!value;
    if (muted) interruptPlayback();
    emit("voice:muted", { muted });
    return muted;
  }

  // ---------------------------------------------------------------------------
  // Audio helpers
  // ---------------------------------------------------------------------------
  function resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input.slice();
    const ratio = fromRate / toRate;
    const outLen = Math.floor(input.length / ratio);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = input[idx] ?? 0;
      const b = input[idx + 1] ?? a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  }

  function mergeFloat32(a, b) {
    const out = new Float32Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  function floatTo16BitPCM(float32) {
    const buf = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  function pcm16ToFloat32(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const out = new Float32Array(arrayBuffer.byteLength / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = view.getInt16(i * 2, true) / 0x8000;
    }
    return out;
  }

  function applyEdgeFade(samples, fadeLen) {
    const n = Math.min(fadeLen, Math.floor(samples.length / 2));
    for (let i = 0; i < n; i++) {
      const g = i / n;
      samples[i] *= g;
      samples[samples.length - 1 - i] *= g;
    }
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToArrayBuffer(base64) {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  async function checkVoiceServer() {
    try {
      const res = await fetch(voiceServerHealthUrl(), { cache: "no-store" });
      if (!res.ok) return false;
      const data = await res.json();
      return data && data.ok === true;
    } catch (_) {
      return false;
    }
  }

  window.Voice = {
    connect,
    disconnect,
    ensureSession,
    enableMicCapture,
    attachMicCapture,
    startSession,
    toggleSession,
    isConnected: () => connected && sessionReady,
    hasMic: () => !!micStream,
    checkVoiceServer,
    voiceServerHealthUrl,
    wsUrl,
    setMuted,
    isMuted: () => muted,
    notifyGameEvent,
    reactToGameEvent,
    requestMic,
  };
})();
