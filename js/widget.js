/**
 * widget.js — Yuki companion UI
 *
 * Casino modes:
 *   Visible — character + voice, no text bubbles
 *   Hidden  — text toasts only, styled by casino event
 *   Muted   — voice workflow paused until unmuted
 */

(function () {
  const cfg = window.YUKI_CONFIG || {};
  const bus = window.EventBus;
  const sprites = (cfg.CHARACTER && cfg.CHARACTER.sprites) || {};
  const E = window.Character.EMOTION;
  const isCompanion = cfg.MODE === "companion";
  const autoVoice = !isCompanion && cfg.AUTO_VOICE !== false;

  const ui = {};
  let bubbleTimer = null;
  let returnEmotion = E.IDLE;
  let voiceActive = false;
  let micEnabled = false;
  let connecting = false;
  let userMuted = false;
  let isHidden = false;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let idleTimer = null;
  let talkPromptTimer = null;
  let reactionUntil = 0;

  function inGameReaction() {
    return Date.now() < reactionUntil;
  }

  function getBar() {
    return document.getElementById("yuki-widget");
  }

  function build() {
    const mount = document.getElementById("yuki-widget");
    if (!mount) return;

    if (isCompanion) {
      buildCompanion(mount);
    } else {
      buildCasinoWidget(mount);
    }

    ui.root = document.getElementById("yuki-root");
    ui.char = document.getElementById("yuki-char");
    ui.toast = document.getElementById("yuki-toast");
    ui.talk = document.getElementById("btn-talk");
    ui.mute = document.getElementById("btn-mute");
    ui.hide = document.getElementById("btn-hide");
    ui.ring = document.getElementById("listen-ring");
    ui.charWrap = document.getElementById("yuki-char-wrap");

    bindUI();
    wireEvents();
    bootVoice();
  }

  async function bootVoice() {
    if (window.YUKI_loadRuntime) await window.YUKI_loadRuntime();

    if (isCompanion) {
      setEmotion(E.HAPPY);
      toast("Hey! Tap Talk~", "info", 4000);
      startCompanionIdle();
    } else {
      setEmotion(E.IDLE);
      if (autoVoice && !userMuted) {
        initCasinoVoice();
        checkVoiceAvailability();
      }
    }
  }

  function voiceConfigHint(status) {
    if (window.YUKI_isVoiceConfigured?.()) return null;
    if (status?.mode === "webrtc" || status?.hasInworldKey) return null;
    return "Add INWORLD_API_KEY on Vercel → Settings → Environment Variables → redeploy";
  }

  async function checkVoiceAvailability() {
    if (!window.Voice?.checkVoiceServer) return;
    let config = {};
    if (window.YUKI_isHosted?.()) {
      try {
        const r = await fetch("/api/voice-config", { cache: "no-store" });
        if (r.ok) config = await r.json();
      } catch (_) {}
    }
    const status = await window.Voice.checkVoiceServer();
    const hosted = window.YUKI_isHosted?.() ?? false;
    const configured = window.YUKI_isVoiceConfigured?.() ?? !!config.voiceBackend;

    if (hosted && !configured) {
      toast(voiceConfigHint(config) || "Add INWORLD_API_KEY on Vercel, then redeploy", "info", 9000);
    } else if (hosted && configured && config.mode === "proxy" && !status.reachable) {
      toast("Voice server unreachable — check Railway is running", "info", 6000);
    } else if (hosted && configured && config.mode === "webrtc" && !status.reachable) {
      // WebRTC health is checked via webrtc-config on connect
    } else if (!status.reachable && !hosted) {
      toast("Voice server offline — run npm start", "info", 5000);
    }
  }

  function buildCompanion(mount) {
    mount.innerHTML = `
      <div class="yuki-root companion" id="yuki-root" data-emotion="idle">
        <div class="yuki-stage">
          <div class="yuki-toast" id="yuki-toast" role="status" aria-live="polite"></div>
          <div class="yuki-body">
            <div class="yuki-char-wrap" id="yuki-char-wrap">
              <div class="yuki-glow"></div>
              <div class="listen-ring" id="listen-ring"></div>
              <img class="yuki-char" id="yuki-char" src="${sprites.idle}" alt="Yuki" />
            </div>
          </div>
          <div class="yuki-controls">
            <button class="yc-btn talk" id="btn-talk"><span class="ic">🎤</span><span class="lbl">Talk</span></button>
            <button class="yc-btn mute" id="btn-mute" aria-label="Mute">🔊 Mute</button>
          </div>
        </div>
      </div>`;
  }

  function buildCasinoWidget(mount) {
    mount.innerHTML = `
      <div class="yuki-root casino-widget" id="yuki-root" data-emotion="idle">
        <div class="yuki-stage">
          <div class="yuki-toast" id="yuki-toast" role="status" aria-live="polite"></div>
          <div class="yuki-row">
            <button class="yc-btn mute side" id="btn-mute" aria-label="Mute Yuki">🔊</button>
            <button type="button" class="yuki-body yuki-char-wrap yuki-tap-target" id="yuki-char-wrap" title="Tap to enable mic">
              <div class="yuki-glow"></div>
              <div class="listen-ring" id="listen-ring"></div>
              <img class="yuki-char" id="yuki-char" src="${sprites.idle}" alt="Yuki" draggable="false" />
            </button>
            <button class="yc-btn hide side" id="btn-hide" aria-label="Hide Yuki">Hide</button>
          </div>
        </div>
      </div>`;
  }

  function bindUI() {
    if (ui.talk) ui.talk.addEventListener("click", onTalk);
    if (ui.mute) ui.mute.addEventListener("click", toggleMute);
    if (ui.hide) ui.hide.addEventListener("click", toggleHide);
    if (ui.charWrap && !isCompanion) {
      ui.charWrap.addEventListener("click", onCharTap);
    }
  }

  async function initCasinoVoice() {
    if (userMuted) return;
    if (window.YUKI_isHosted?.() && !window.YUKI_isVoiceConfigured?.()) return;

    try {
      await window.Voice.ensureRuntimeConfig();
      window.Voice.warmSession().catch((err) => {
        console.warn("[Widget] voice warm failed:", err);
        scheduleReconnect();
      });
      voiceActive = true;
      reconnectAttempt = 0;
      document.body.classList.add("voice-live");
      if (ui.charWrap) ui.charWrap.title = "Tap Yuki to speak";
    } catch (err) {
      console.warn("[Widget] voice init failed:", err);
      scheduleReconnect();
    }
  }

  async function queryMicGranted() {
    if (!navigator.permissions?.query) return false;
    try {
      const s = await navigator.permissions.query({ name: "microphone" });
      return s.state === "granted";
    } catch (_) {
      return false;
    }
  }

  async function onCharTap() {
    if (isHidden || userMuted || connecting) return;
    connecting = true;
    setEmotion(E.LISTENING);
    try {
      await window.Voice.ensureRuntimeConfig();
      await window.Voice.startSession();
      micEnabled = true;
      voiceActive = true;
      if (ui.charWrap) ui.charWrap.title = "Talking with Yuki";
    } catch (err) {
      console.warn("[Widget] char tap voice failed:", err);
      setEmotion(E.WORRIED);
      const hosted = window.YUKI_isHosted?.() ?? false;
      const msg = String(err?.message || err);
      if (hosted && !window.YUKI_isVoiceConfigured?.()) {
        toast(voiceConfigHint() || "Add INWORLD_API_KEY on Vercel", "info", 7000);
      } else if (msg.includes("microphone")) {
        toast("Allow mic: click lock icon in address bar → Microphone", "info", 5500);
      } else if (msg.includes("INWORLD_API_KEY") || msg.includes("not configured")) {
        toast("Add INWORLD_API_KEY on Vercel → redeploy", "info", 6000);
      } else if (msg.includes("unreachable") || msg.includes("WebRTC") || msg.includes("Inworld")) {
        toast(msg.length > 70 ? msg.slice(0, 68) + "…" : msg, "info", 6000);
      } else {
        toast(msg.length > 60 ? msg.slice(0, 58) + "…" : msg, "info", 5000);
      }
    } finally {
      connecting = false;
    }
  }

  async function enableMicSilently() {
    if (micEnabled || userMuted) return;
    const ok = await window.Voice.requestMic();
    if (!ok) return;
    await window.Voice.attachMicCapture();
    micEnabled = true;
    setEmotion(E.LISTENING);
  }

  function toggleMute() {
    if (isCompanion) {
      const muted = window.Voice.setMuted(!window.Voice.isMuted());
      ui.mute.textContent = muted ? "🔇 Muted" : "🔊 Mute";
      ui.mute.classList.toggle("is-muted", muted);
      return;
    }

    userMuted = !userMuted;

    if (userMuted) {
      clearReconnect();
      window.Voice.disconnect();
      voiceActive = false;
      micEnabled = false;
      document.body.classList.remove("voice-live");
      ui.mute.textContent = "🔇";
      ui.mute.classList.add("is-muted");
      setEmotion(E.IDLE);
      if (isHidden) toast("Yuki paused", "info", 2500);
    } else {
      ui.mute.textContent = "🔊";
      ui.mute.classList.remove("is-muted");
      reconnectAttempt = 0;
      initCasinoVoice().then(async () => {
        if (!micEnabled) {
          await window.Voice.unlockAudio();
          const micOk = await window.Voice.requestMic();
          if (micOk) {
            await window.Voice.attachMicCapture();
            micEnabled = true;
            setEmotion(E.LISTENING);
          }
        }
      });
      if (isHidden) toast("Yuki back~", "info", 2500);
    }
  }

  function toggleHide() {
    const bar = getBar();

    if (!isHidden) {
      isHidden = true;
      ui.root.classList.remove("yuki-pop");
      ui.root.classList.add("yuki-hidden");
      if (bar) bar.classList.add("is-collapsed");
      ui.hide.textContent = "Show";
      ui.hide.classList.add("is-hidden-mode");
      startTalkPrompt();
    } else {
      isHidden = false;
      ui.root.classList.remove("yuki-hidden");
      if (bar) bar.classList.remove("is-collapsed");
      ui.hide.textContent = "Hide";
      ui.hide.classList.remove("is-hidden-mode");
      stopTalkPrompt();
      clearToast();

      ui.root.classList.add("yuki-pop");
      setEmotion(E.HAPPY);
      setTimeout(() => {
        ui.root.classList.remove("yuki-pop");
        setEmotion(voiceActive && micEnabled ? E.LISTENING : E.IDLE);
      }, 560);
    }
  }

  function startTalkPrompt() {
    stopTalkPrompt();
    if (!userMuted) toast("Talk to me", "talk", 8000);
    talkPromptTimer = setInterval(() => {
      if (isHidden && !userMuted) toast("Talk to me", "talk", 6000);
    }, 16000);
  }

  function stopTalkPrompt() {
    if (talkPromptTimer) clearInterval(talkPromptTimer);
    talkPromptTimer = null;
  }

  function scheduleReconnect() {
    if (userMuted || (voiceActive && micEnabled)) return;
    clearReconnect();
    const delay = Math.min(20000, 3000 + reconnectAttempt * 2000);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => initCasinoVoice(), delay);
  }

  function clearReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  async function onTalk() {
    if (voiceActive && micEnabled) {
      userMuted = true;
      toggleMute();
      ui.talk.classList.remove("active");
      ui.talk.querySelector(".lbl").textContent = "Talk";
      return;
    }
    if (connecting) return;

    connecting = true;
    userMuted = false;
    ui.talk.classList.add("active");
    ui.talk.disabled = true;
    setEmotion(E.THINKING);

    try {
      await window.Voice.unlockAudio();
      const micOk = await window.Voice.requestMic();
      if (!micOk) throw new Error("microphone-unavailable");
      await window.Voice.ensureSession();
      await window.Voice.attachMicCapture();
      voiceActive = true;
      micEnabled = true;
      ui.talk.disabled = false;
      ui.talk.querySelector(".lbl").textContent = "End";
      setEmotion(E.LISTENING);
    } catch (_) {
      voiceActive = false;
      micEnabled = false;
      ui.talk.disabled = false;
      ui.talk.classList.remove("active");
      ui.talk.querySelector(".lbl").textContent = "Talk";
      setEmotion(E.WORRIED);
      toast("Allow mic in browser", "info", 4000);
    } finally {
      connecting = false;
    }
  }

  function eventClass(type) {
    const wins = new Set(["WIN","BIG_WIN","BJ_WIN","BLACKJACK","CRASH_WIN","SLOTS_WIN"]);
    const jacks= new Set(["BIG_WIN","BLACKJACK","SLOTS_JACKPOT"]);
    const loses= new Set(["LOSE","BJ_LOSE","BUST","CRASH_LOSE","SLOTS_LOSE"]);
    if (type === "TALK") return "talk";
    if (jacks.has(type))  return "big_win";
    if (wins.has(type))   return "win";
    if (loses.has(type))  return "lose";
    if (type === "HIGH")  return "win";
    return "info";
  }

  function showReaction(reaction, eventType, payload = {}) {
    reactionUntil = Date.now() + 3400;
    returnEmotion = reaction.emotion;
    setEmotion(reaction.emotion);
    if (window.CharacterMemory) window.CharacterMemory.setMood(reaction.emotion);

    const canVoice = !userMuted && voiceActive && window.Voice.isConnected();
    let voiceReacted = false;
    if (canVoice && eventType !== "IDLE") {
      voiceReacted = window.Voice.reactToGameEvent(eventType, payload);
    } else if (canVoice) {
      window.Voice.notifyGameEvent(eventType, payload);
    }

    if (isHidden) {
      if (eventType === "IDLE") {
        toast("Talk to me", "talk", 5000);
      } else {
        toast(reaction.line, eventClass(eventType), eventType === "BIG_WIN" ? 4500 : 3500);
      }
    } else if (isCompanion) {
      toast(reaction.line, eventClass(eventType), 3500);
    } else if (eventType !== "IDLE" && !voiceReacted) {
      const bigEvent = ["BIG_WIN","BLACKJACK","SLOTS_JACKPOT"].includes(eventType);
      toast(reaction.line, eventClass(eventType), bigEvent ? 3600 : 2600);
    }

    if (!isHidden && eventType !== "IDLE") nudge();
    const bigEvents = ["BIG_WIN","BLACKJACK","SLOTS_JACKPOT"];
    if (bigEvents.includes(eventType) && !isHidden) burstConfetti();

    setTimeout(() => {
      if (inGameReaction()) return;
      if (voiceActive && !userMuted) {
        if (ui.root.classList.contains("speaking")) setEmotion(E.TALKING);
        else if (micEnabled) setEmotion(E.LISTENING);
        else setEmotion(E.IDLE);
      } else if (!isHidden) {
        setEmotion(E.IDLE);
      }
    }, 3400);
  }

  function wireEvents() {
    if (!isCompanion) {
      // Roulette
      bus.onRoulette(({ type, payload }) => {
        if (window.CharacterMemory) window.CharacterMemory.recordOutcome(type, payload);
        const reaction = window.Character.reactToOutcome(type, payload);
        showReaction(reaction, type, payload);
      });

      // Blackjack
      bus.on("blackjack:event", ({ type, payload }) => {
        const key = type === "WIN" ? "BJ_WIN" : type === "LOSE" ? "BJ_LOSE" : type;
        const reaction = window.Character.reactToOutcome(key);
        showReaction(reaction, key, payload);
      });

      // Crash
      bus.on("crash:event", ({ type, payload }) => {
        const key = type === "WIN" ? "CRASH_WIN" : type === "LOSE" ? "CRASH_LOSE" : type;
        const reaction = window.Character.reactToOutcome(key);
        showReaction(reaction, key, payload);
      });

      // Slots
      bus.on("slots:event", ({ type, payload }) => {
        const key = type === "JACKPOT" ? "SLOTS_JACKPOT" : type === "WIN" ? "SLOTS_WIN" : "SLOTS_LOSE";
        const reaction = window.Character.reactToOutcome(key);
        showReaction(reaction, key, payload);
      });

      // Sports betting events
      bus.on("sports:event", ({ type, payload }) => {
        const key = type === "WIN" ? "WIN" : "LOSE";
        const reaction = window.Character.reactToOutcome(key, payload);
        showReaction(reaction, key, payload);
      });

      // Widget reaction passthrough (from sports.js)
      bus.on("widget:reaction", ({ reaction, type, payload }) => {
        showReaction(reaction, type, payload);
      });

      // Game switch — greet on arrival
      bus.on("casino:game", ({ game }) => {
        const greets = {
          roulette:  () => showReaction({ emotion: E.HAPPY,    line: "Let's spin~" },     "IDLE", {}),
          blackjack: () => showReaction({ emotion: E.THINKING, line: "Blackjack!" },      "IDLE", {}),
          crash:     () => showReaction({ emotion: E.EXCITED,  line: "Don't crash!" },    "IDLE", {}),
          slots:     () => showReaction({ emotion: E.HAPPY,    line: "Lucky reels~" },    "IDLE", {}),
          sports:    () => showReaction({ emotion: E.EXCITED,  line: "Tennis time! 🎾" }, "IDLE", {}),
        };
        if (greets[game]) greets[game]();
      });
    }

    bus.on("voice:connecting", () => {
      if (connecting && !isHidden && !inGameReaction()) setEmotion(E.THINKING);
    });

    bus.on("voice:ready", () => {
      connecting = false;
      voiceActive = true;
      reconnectAttempt = 0;
      document.body.classList.add("voice-live");
      if (ui.charWrap && !micEnabled) ui.charWrap.title = "Tap Yuki to speak";
      if (micEnabled && !isHidden && !inGameReaction()) setEmotion(E.LISTENING);
    });

    bus.on("voice:closed", () => {
      voiceActive = false;
      micEnabled = false;
      connecting = false;
      document.body.classList.remove("voice-live");
      if (!userMuted && autoVoice) scheduleReconnect();
      else if (!isHidden) setEmotion(E.IDLE);
    });

    bus.on("voice:error", ({ message }) => {
      connecting = false;
      if (!userMuted && autoVoice) scheduleReconnect();
      const msg = message || "Voice unavailable";
      const hosted = window.YUKI_isHosted?.() ?? false;
      if (msg.includes("not configured") || msg.includes("VOICE_BACKEND")) {
        toast(voiceConfigHint() || "Voice not configured", "info", 7000);
      } else if (hosted && (msg.includes("unreachable") || msg.includes("closed") || msg.includes("timed out"))) {
        toast("Voice server offline — check Railway deploy", "info", 6000);
      } else if (msg.includes("unreachable") || msg.includes("closed") || msg.includes("timed out")) {
        toast("Voice server offline — run npm start locally", "info", 5000);
      } else {
        toast(msg, "info", 4000);
      }
    });

    bus.on("voice:listening:start", () => {
      ui.root.classList.add("listening");
      if (!isHidden && !inGameReaction()) setEmotion(E.LISTENING);
    });

    bus.on("voice:listening:stop", () => {
      ui.root.classList.remove("listening");
      if (ui.ring) ui.ring.style.setProperty("--lvl", 0);
    });

    bus.on("voice:thinking:start", () => {
      if (!isHidden && !inGameReaction()) setEmotion(E.THINKING);
    });

    bus.on("voice:level", ({ level }) => {
      if (ui.ring) ui.ring.style.setProperty("--lvl", level.toFixed(3));
    });

    bus.on("voice:speaking:start", () => {
      ui.root.classList.add("speaking");
      if (!isHidden && !inGameReaction()) setEmotion(E.TALKING);
    });

    bus.on("voice:speaking:stop", () => {
      ui.root.classList.remove("speaking");
      if (!isHidden && voiceActive && micEnabled && !inGameReaction()) setEmotion(E.LISTENING);
    });

    // Process user speech for betting intents (no bubbles in casino visible mode)
    bus.on("voice:transcript", ({ text, role } = {}) => {
      if (role !== "user" || !text || isCompanion) return;
      const t = text.toLowerCase();

      // Bet intent — anywhere in the app
      const hasBetWord = /\b(bet|betting|wager|place a bet|sports bet|make a bet)\b/.test(t);
      const hasNegation = /\b(no|don't|not|cancel|stop)\b/.test(t);
      if (hasBetWord && !hasNegation && window.Sports) {
        if (window.Casino?.activeGame !== "sports") {
          window.Sports.handleBetIntent();
        }
        return;
      }

      // Best-player intent — only on sports page
      if (window.Casino?.activeGame === "sports" && window.Sports) {
        const isBestQuery = /\b(best|recommend|top|who|suggest|favorite|favourite|pick|choice)\b/.test(t);
        const isBetContext = /\b(bet|player|win|pick|odds|choice)\b/.test(t);
        if (isBestQuery && isBetContext && window.Sports.flowState === "idle") {
          window.Sports.handleBestPlayerIntent();
          return;
        }

        // Confirm intent — after Yuki has suggested a player
        const isConfirm = /\b(yes|sure|ok|okay|go ahead|do it|confirm|fill|yep|yeah)\b/.test(t);
        if (isConfirm && window.Sports.flowState === "awaiting_pick_confirm") {
          window.Sports.handleConfirmIntent();
          return;
        }
      }
    });

    bus.on("voice:mic:denied", ({ code }) => {
      micEnabled = false;
      setEmotion(E.WORRIED);
      if (code === "denied") {
        toast("Mic blocked — allow in browser site settings (Arc: lock icon → Microphone)", "info", 6000);
      } else if (code === "insecure") {
        toast("Mic needs HTTPS or localhost", "info", 4000);
      } else {
        toast("Mic unavailable — check browser permissions", "info", 4500);
      }
    });

    bus.on("voice:mic:granted", () => {
      micEnabled = true;
    });

    bus.on("voice:mic:streaming", () => {
      micEnabled = true;
      connecting = false;
      if (!isHidden && !inGameReaction()) setEmotion(E.LISTENING);
    });
  }

  function startCompanionIdle() {
    const ms = (cfg.EVENT_SYSTEM && cfg.EVENT_SYSTEM.idleTimeoutMs) || 22000;
    const tick = () => {
      if (!voiceActive) {
        nudge();
        showReaction(window.Character.reactToOutcome("IDLE"), "IDLE");
      }
      idleTimer = setTimeout(tick, ms);
    };
    idleTimer = setTimeout(tick, ms);
  }

  function setEmotion(emotion) {
    if (!sprites[emotion]) emotion = E.IDLE;
    if (ui.char) ui.char.src = sprites[emotion];
    ui.root.dataset.emotion = emotion;
    returnEmotion = emotion;
  }

  function toast(text, kind = "info", ms = 3500) {
    if (!ui.toast) return;
    clearTimeout(bubbleTimer);
    const short = text.length > 48 ? text.slice(0, 46).trim() + "…" : text;
    ui.toast.textContent = short;
    ui.toast.className = "yuki-toast show event-" + kind;
    bubbleTimer = setTimeout(clearToast, ms);
  }

  function clearToast() {
    if (!ui.toast) return;
    ui.toast.classList.remove("show");
  }

  function nudge() {
    if (!ui.charWrap || isHidden) return;
    ui.charWrap.classList.remove("nudge");
    void ui.charWrap.offsetWidth;
    ui.charWrap.classList.add("nudge");
  }

  function burstConfetti() {
    if (!ui.charWrap) return;
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    const colors = ["#7ad7ff", "#ffd166", "#ff7ab6", "#9b8cff", "#7CFFB2"];
    for (let i = 0; i < 24; i++) {
      const c = document.createElement("i");
      c.style.left = Math.random() * 100 + "%";
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.4 + "s";
      layer.appendChild(c);
    }
    ui.charWrap.appendChild(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
