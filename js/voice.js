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
  let transport = "ws"; // "ws" | "webrtc"
  let pc = null;
  let dc = null;
  let remoteAudioEl = null;
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
  let audioUnlocked = false;
  let greetingSent = false;

  // Scheduled playback nodes for interrupt support
  let scheduledSources = [];
  let nextPlayTime = 0;

  const emit = (name, data) => bus && bus.emit(name, data);

  function backendWsUrl(base) {
    if (!base) return null;
    const wsBase = base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:").replace(/\/$/, "");
    return `${wsBase}/realtime`;
  }

  function wsUrl() {
    const rt = window.YUKI_RUNTIME || {};
    if (rt.wsUrl) return rt.wsUrl;
    if (rt.voiceBackendUrl) return backendWsUrl(rt.voiceBackendUrl);

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

    // Same-origin only works with `npm start` (Node serves static + WS). Vercel cannot proxy WS.
    if (local || !window.location.protocol.startsWith("http")) {
      return `${proto}//${window.location.host}/realtime`;
    }

    return null;
  }

  function voiceServerHealthUrl() {
    const rt = window.YUKI_RUNTIME || {};
    if (rt.voiceBackendUrl) {
      return `${rt.voiceBackendUrl.replace(/\/$/, "")}/health`;
    }

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

  function isVoiceConfigured() {
    return window.YUKI_isVoiceConfigured?.() ?? !!(wsUrl());
  }

  async function ensureRuntimeConfig() {
    if (window.YUKI_loadRuntime) await window.YUKI_loadRuntime();
  }

  function useWebRTC() {
    if (window.YUKI_isLocalHost?.()) return false;
    const rt = window.YUKI_RUNTIME || {};
    if (rt.mode === "webrtc") return true;
    if (rt.mode === "proxy") return false;
    return !!(rt.hasInworldKey && !rt.wsUrl);
  }

  function sendJson(obj) {
    const text = JSON.stringify(obj);
    if (transport === "webrtc") {
      if (dc?.readyState === "open") dc.send(text);
    } else if (ws?.readyState === WebSocket.OPEN) {
      ws.send(text);
    }
  }

  function isTransportOpen() {
    if (transport === "webrtc") return dc?.readyState === "open";
    return ws?.readyState === WebSocket.OPEN;
  }

  function waitForIceComplete(peer) {
    if (peer.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        if (peer.iceGatheringState === "complete") {
          peer.removeEventListener("icegatheringstatechange", done);
          resolve();
        }
      };
      peer.addEventListener("icegatheringstatechange", done);
      setTimeout(resolve, 4000);
    });
  }

  // ---------------------------------------------------------------------------
  // WebRTC session (Vercel — browser connects direct to Inworld, no Railway)
  // ---------------------------------------------------------------------------
  async function connectWebRTC() {
    if (connected && sessionReady) return;
    cleanupTransport();

    transport = "webrtc";
    emit("voice:connecting");

    const cfgRes = await fetch("/api/webrtc-config", { cache: "no-store" });
    if (!cfgRes.ok) {
      const err = await cfgRes.json().catch(() => ({}));
      throw new Error(err.error || "Voice API not configured — set INWORLD_API_KEY on Vercel");
    }
    const cfgData = await cfgRes.json();
    console.info("[Voice] WebRTC mode → Inworld Realtime");

    if (!micStream) {
      const micOk = await requestMic();
      if (!micOk) throw new Error("microphone-unavailable");
    }

    await unlockAudio();

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = setTimeout(() => {
        if (!settled) fail("Connection timed out");
      }, 25000);

      const succeed = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve();
      };
      const fail = (msg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        cleanupTransport();
        emit("voice:error", { message: msg });
        reject(new Error(msg));
      };

      pc = new RTCPeerConnection({ iceServers: cfgData.ice_servers || [] });
      dc = pc.createDataChannel("oai-events", { ordered: true });

      micStream.getAudioTracks().forEach((t) => pc.addTrack(t, micStream));

      pc.ontrack = (e) => {
        if (!remoteAudioEl) {
          remoteAudioEl = document.createElement("audio");
          remoteAudioEl.autoplay = true;
          remoteAudioEl.playsInline = true;
          remoteAudioEl.setAttribute("playsinline", "");
          document.body.appendChild(remoteAudioEl);
        }
        remoteAudioEl.srcObject = new MediaStream([e.track]);
        if (remoteAudioEl.paused) remoteAudioEl.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") fail("WebRTC connection failed");
      };

      dc.onopen = () => {
        connected = true;
        audioUnlocked = true;
      };

      dc.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch (_) {
          return;
        }
        if (cfg.EVENT_SYSTEM?.debug) console.log("[Voice] ←", msg.type);
        handleServerMessage(msg, succeed, fail);
      };

      dc.onclose = () => {
        if (!settled && !sessionReady) fail("WebRTC data channel closed");
      };

      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await waitForIceComplete(pc);

          const res = await fetch(cfgData.callsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/sdp",
              Authorization: `Bearer ${cfgData.token}`,
            },
            body: pc.localDescription.sdp,
          });

          if (!res.ok) {
            const t = await res.text();
            fail(`Inworld WebRTC failed (${res.status}): ${t.slice(0, 120)}`);
            return;
          }

          await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
        } catch (err) {
          fail(err.message || "WebRTC setup failed");
        }
      })();
    });
  }

  // ---------------------------------------------------------------------------
  // WebSocket session (local npm start or legacy Railway proxy)
  // ---------------------------------------------------------------------------
  function connectWs() {
    if (connected && sessionReady) return Promise.resolve();
    cleanupTransport();
    transport = "ws";
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
        cleanupTransport();
        emit("voice:error", { message: msg });
        reject(new Error(msg));
      };

      emit("voice:connecting");
      if (window.location.protocol === "file:") {
        fail("Open via npm start at http://localhost:8787 — voice does not work from file://");
        return;
      }
      const url = wsUrl();
      if (!url) {
        fail("Voice not configured — set INWORLD_API_KEY on Vercel or run npm start locally");
        return;
      }
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

      ws.onerror = () => fail(`Voice server unreachable (${url})`);
      ws.onclose = (ev) => {
        const wasLive = sessionReady;
        cleanupTransport();
        if (wasLive) emit("voice:closed");
        cleanupSession(false);
        if (!settled) {
          const detail = ev.code ? ` code ${ev.code}` : "";
          fail(`Voice connection closed${detail}`);
        }
      };

      timeoutId = setTimeout(() => {
        if (!settled) fail("Connection timed out");
      }, 20000);
    });
  }

  function connect() {
    if (connected && sessionReady) return Promise.resolve();
    return ensureRuntimeConfig().then(() => {
      if (useWebRTC()) return connectWebRTC();
      transport = "ws";
      return connectWs();
    });
  }

  async function handleServerMessage(msg, onReady, onFail) {
    switch (msg.type) {
      case "error":
        onFail(msg.error?.message || "Inworld error");
        break;

      case "session.created":
        sendJson(window.YUKI_SESSION_UPDATE || buildDefaultSessionUpdate());
        break;

      case "session.updated":
        sessionReady = true;
        emit("voice:ready");
        resumeMicPipeline();
        maybeStartConversation();
        onReady();
        break;

      case "input_audio_buffer.speech_started":
        userSpeaking = true;
        interruptPlayback();
        if (isTransportOpen()) {
          sendJson({ type: "response.cancel" });
        }
        emit("voice:listening:start");
        emit("voice:thinking:stop");
        break;

      case "input_audio_buffer.committed":
        userSpeaking = false;
        emit("voice:listening:stop");
        emit("voice:thinking:start");
        break;

      case "response.created":
        if (transport === "webrtc" && !agentSpeaking) {
          agentSpeaking = true;
          emit("voice:thinking:stop");
          emit("voice:speaking:start");
        }
        break;

      case "response.output_audio.delta":
        if (transport === "webrtc") break;
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

  function maybeStartConversation() {
    if (!sessionReady || !audioUnlocked || !micStream || greetingSent) return;
    greetingSent = true;
    promptGreeting();
  }

  function promptGreeting() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const casino = cfg.MODE !== "companion";
    const text = casino
      ? "Hey Yuki! I'm at the roulette table — say a quick friendly hello!"
      : "Hey Yuki! I just tapped Talk — say a quick friendly hello.";
    sendJson({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendJson({ type: "response.create" });
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
    cleanupTransport();
    cleanupSession(true);
  }

  function cleanupTransport() {
    if (ws) {
      try { ws.close(); } catch (_) {}
    }
    ws = null;
    if (pc) {
      try { pc.close(); } catch (_) {}
    }
    pc = null;
    dc = null;
    if (remoteAudioEl) {
      try { remoteAudioEl.remove(); } catch (_) {}
      remoteAudioEl = null;
    }
    connected = false;
    sessionReady = false;
    transport = "ws";
  }

  function cleanupWs() {
    cleanupTransport();
  }

  function cleanupSession(emitClosed) {
    stopLevelLoop();
    agentSpeaking = false;
    userSpeaking = false;
    greetingSent = false;
    if (emitClosed) emit("voice:closed");
  }

  /** Must run inside a user gesture (tap/click) to unlock browser audio + mic. */
  async function unlockAudio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;

    captureCtx = captureCtx || new Ctx({ latencyHint: "interactive" });
    // Separate playback context — Arc/Chromium forks can suspend shared contexts
    playbackCtx = playbackCtx || new Ctx({ latencyHint: "playback" });

    try {
      if (captureCtx.state === "suspended") await captureCtx.resume();
      if (playbackCtx.state === "suspended") await playbackCtx.resume();
      audioUnlocked = captureCtx.state === "running" || playbackCtx.state === "running";
      maybeStartConversation();
      return audioUnlocked;
    } catch (err) {
      console.warn("[Voice] unlockAudio failed:", err);
      return false;
    }
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
    if (transport === "webrtc") {
      await unlockAudio();
      maybeStartConversation();
      return true;
    }
    await unlockAudio();
    await resumeMicPipeline();

    if (!processor) await startMicCapture();
    maybeStartConversation();
    return true;
  }

  /** Keep AudioContext + mic tracks alive (required on mobile Chrome/Safari). */
  async function resumeMicPipeline() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    captureCtx = captureCtx || new Ctx({ latencyHint: "interactive" });
    playbackCtx = playbackCtx || new Ctx({ latencyHint: "playback" });

    if (captureCtx.state === "suspended") {
      try { await captureCtx.resume(); } catch (err) {
        console.warn("[Voice] captureCtx resume failed:", err);
      }
    }
    if (playbackCtx.state === "suspended") {
      try { await playbackCtx.resume(); } catch (_) {}
    }
    audioUnlocked = captureCtx.state === "running";

    if (micStream) {
      micStream.getAudioTracks().forEach((track) => {
        if (!track.enabled) track.enabled = true;
      });
    }
    return audioUnlocked;
  }

  async function startSession() {
    await unlockAudio();
    const micOk = await requestMic();
    if (!micOk) throw new Error("microphone-unavailable");
    await ensureSession();
    await attachMicCapture();
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
      emit("voice:mic:denied", { error: "getUserMedia unavailable", code: "unsupported" });
      return false;
    }
    const local = window.YUKI_isLocalHost?.() ?? (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    if (!window.isSecureContext && !local) {
      emit("voice:mic:denied", {
        error: "Microphone requires HTTPS when not on localhost.",
        code: "insecure",
      });
      return false;
    }

    const attempts = [
      {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      },
      { audio: true },
    ];

    for (const constraints of attempts) {
      try {
        micStream = await navigator.mediaDevices.getUserMedia(constraints);
        emit("voice:mic:granted");
        return true;
      } catch (err) {
        console.warn("[Voice] getUserMedia failed:", constraints, err?.name, err?.message);
        if (constraints.audio === true) {
          emit("voice:mic:denied", {
            error: err?.message || String(err),
            name: err?.name || "Error",
            code: err?.name === "NotAllowedError" ? "denied" : "failed",
          });
        }
      }
    }
    return false;
  }

  async function startMicCapture() {
    if (!micStream || !ws) return;
    await resumeMicPipeline();

    const source = captureCtx.createMediaStreamSource(micStream);
    analyser = captureCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferSize = 4096;
    processor = captureCtx.createScriptProcessor(bufferSize, 1, 1);
    let pending = new Float32Array(0);
    const samplesPerChunk = Math.floor((SAMPLE_RATE * CHUNK_MS) / 1000);

    let chunksSent = 0;
    processor.onaudioprocess = (e) => {
      if (transport === "webrtc") return;
      if (!sessionReady || !isTransportOpen()) return;
      if (captureCtx?.state === "suspended") {
        captureCtx.resume().catch(() => {});
        return;
      }
      const input = e.inputBuffer.getChannelData(0);
      const resampled = resample(input, captureCtx.sampleRate, SAMPLE_RATE);
      const merged = mergeFloat32(pending, resampled);
      pending = merged;
      while (pending.length >= samplesPerChunk) {
        const chunk = pending.slice(0, samplesPerChunk);
        pending = pending.slice(samplesPerChunk);
        const pcm = floatTo16BitPCM(chunk);
        sendJson({
          type: "input_audio_buffer.append",
          audio: arrayBufferToBase64(pcm),
        });
        chunksSent += 1;
        if (chunksSent === 1) emit("voice:mic:streaming");
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
    if (!audioUnlocked) return;
    if (!playbackCtx) playbackCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (playbackCtx.state === "suspended") {
      playbackCtx.resume().catch(() => {});
      return;
    }

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
    if (!isTransportOpen() || !sessionReady) return;
    const lines = {
      // Roulette
      WIN:          `System: Roulette — player won +${payload.amount || "?"} credits (${payload.color} ${payload.number}).`,
      LOSE:         `System: Roulette — player lost ${payload.amount || "?"} credits (${payload.color} ${payload.number}).`,
      BIG_WIN:      `System: Roulette — player hit a BIG WIN! +${payload.amount || "?"} credits on number ${payload.number}.`,
      IDLE:         `System: The player is idle at the casino.`,
      // Blackjack
      BJ_WIN:       `System: Blackjack — player won +${payload.net || "?"} credits.`,
      BLACKJACK:    `System: Blackjack — player got a Blackjack! +${payload.net || "?"} credits.`,
      BJ_LOSE:      `System: Blackjack — player lost to the dealer.`,
      BUST:         `System: Blackjack — player busted (over 21).`,
      PUSH:         `System: Blackjack — push, tie with dealer.`,
      // Crash
      CRASH_WIN:    `System: Crash — player cashed out at ${payload.multiplier || "?"}×! +${payload.net || "?"} credits.`,
      CRASH_LOSE:   `System: Crash — game crashed at ${payload.crashAt || "?"}×, player lost ${payload.chip || "?"} credits.`,
      HIGH:         `System: Crash — multiplier at ${payload.multiplier || "?"}×, player is still in!`,
      // Slots
      SLOTS_WIN:    `System: Slots — player won +${payload.net || "?"} credits!`,
      SLOTS_JACKPOT:`System: Slots — JACKPOT! Player won +${payload.net || "?"} credits!`,
      SLOTS_LOSE:   `System: Slots — player didn't match.`,
    };
    const text = lines[type] || `System: Casino event ${type}.`;
    sendJson({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [{ type: "input_text", text }],
      },
    });
  }

  /** When voice is live, Yuki speaks a brief reaction to a spin outcome. */
  function reactToGameEvent(type, payload = {}) {
    if (!isTransportOpen() || !sessionReady) return false;

    notifyGameEvent(type, payload);

    if (type === "IDLE" || muted) return false;

    // Casino outcomes take priority over ambient mic / ongoing speech
    if (agentSpeaking) {
      interruptPlayback();
      if (isTransportOpen()) {
        sendJson({ type: "response.cancel" });
      }
    }
    userSpeaking = false;

    const prompts = {
      // Roulette
      WIN:          `[Roulette win! +${payload.amount} credits on ${payload.color} ${payload.number}. Brief happy hype!]`,
      LOSE:         `[Roulette loss — lost ${payload.amount}. Brief supportive reaction, warm, no criticism.]`,
      BIG_WIN:      `[BIG ROULETTE WIN!! +${payload.amount} on number ${payload.number}! Super excited celebration!]`,
      // Blackjack
      BJ_WIN:       `[Blackjack win! Player beat the dealer. Brief happy cheer!]`,
      BLACKJACK:    `[BLACKJACK!! Perfect 21 on the deal! Extremely excited!]`,
      BJ_LOSE:      `[Blackjack loss, dealer won. Brief sympathetic support.]`,
      BUST:         `[Player busted in Blackjack — over 21! Brief sympathetic reaction.]`,
      PUSH:         `[Blackjack push — tied with dealer. Mildly relieved reaction.]`,
      // Crash
      CRASH_WIN:    `[Player cashed out of Crash at ${payload.multiplier}×! Nice profit! Happy reaction.]`,
      CRASH_LOSE:   `[Crash game crashed at ${payload.crashAt}×! Player lost. Brief sad/funny reaction.]`,
      HIGH:         `[Crash multiplier at ${payload.multiplier}×! Getting exciting! Encouraging reaction!]`,
      // Slots
      SLOTS_WIN:    `[Slots win! Brief happy cheer!]`,
      SLOTS_JACKPOT:`[SLOTS JACKPOT!! Triple match! Absolute explosion of excitement!]`,
      SLOTS_LOSE:   `[Slots no match. Brief encouraging spin-again reaction.]`,
    };
    const text = prompts[type];
    if (!text) return false;

    sendJson({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    sendJson({ type: "response.create" });
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
    await ensureRuntimeConfig();
    try {
      const res = await fetch(voiceServerHealthUrl(), { cache: "no-store" });
      if (!res.ok) return { reachable: false, hasBackend: false, configured: isVoiceConfigured() };
      const data = await res.json();
      const configured = isVoiceConfigured();
      const hasBackend = !!(data?.inworld || data?.voiceProxy || configured);
      return { reachable: true, hasBackend, configured, ...data };
    } catch (_) {
      return { reachable: false, hasBackend: false, configured: isVoiceConfigured() };
    }
  }

  window.Voice = {
    connect,
    disconnect,
    ensureSession,
    ensureRuntimeConfig,
    unlockAudio,
    enableMicCapture,
    attachMicCapture,
    startSession,
    toggleSession,
    isConnected: () => connected && sessionReady,
    hasMic: () => !!micStream,
    isVoiceConfigured,
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
