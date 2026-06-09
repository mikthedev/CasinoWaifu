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

    if (isCompanion) {
      setEmotion(E.HAPPY);
      toast("Hey! Tap Talk~", "info", 4000);
      startCompanionIdle();
    } else {
      setEmotion(E.IDLE);
      if (autoVoice && !userMuted) initCasinoVoice();
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
            <div class="yuki-body">
              <div class="yuki-char-wrap" id="yuki-char-wrap" title="Tap to enable mic">
                <div class="yuki-glow"></div>
                <div class="listen-ring" id="listen-ring"></div>
                <img class="yuki-char" id="yuki-char" src="${sprites.idle}" alt="Yuki" />
              </div>
            </div>
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

    try {
      await window.Voice.ensureSession();
      voiceActive = true;
      reconnectAttempt = 0;
      document.body.classList.add("voice-live");

      const granted = await queryMicGranted();
      if (granted) await enableMicSilently();
    } catch (_) {
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
    if (isHidden || userMuted || micEnabled || connecting) return;
    connecting = true;
    setEmotion(E.THINKING);
    try {
      const micOk = await window.Voice.requestMic();
      if (!micOk) throw new Error("microphone-unavailable");
      if (!window.Voice.isConnected()) await window.Voice.ensureSession();
      await window.Voice.attachMicCapture();
      micEnabled = true;
      voiceActive = true;
      setEmotion(E.LISTENING);
    } catch (_) {
      setEmotion(E.WORRIED);
      if (isHidden) toast("Allow mic in browser", "info", 4000);
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
      initCasinoVoice();
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
    const map = { WIN: "win", BIG_WIN: "big_win", LOSE: "lose", IDLE: "idle", TALK: "talk" };
    return map[type] || "info";
  }

  function showReaction(reaction, eventType, payload = {}) {
    returnEmotion = reaction.emotion;
    setEmotion(reaction.emotion);
    if (window.CharacterMemory) window.CharacterMemory.setMood(reaction.emotion);

    if (isHidden) {
      if (eventType === "IDLE") {
        toast("Talk to me", "talk", 5000);
      } else {
        toast(reaction.line, eventClass(eventType), eventType === "BIG_WIN" ? 4500 : 3500);
      }
    } else if (isCompanion) {
      toast(reaction.line, eventClass(eventType), 3500);
    }

    if (!userMuted && voiceActive && window.Voice.isConnected() && eventType !== "IDLE") {
      window.Voice.reactToGameEvent(eventType, payload);
    } else if (!userMuted && window.Voice.isConnected()) {
      window.Voice.notifyGameEvent(eventType, payload);
    }

    const restoreMs = 3200;
    setTimeout(() => {
      if (voiceActive && !userMuted) {
        if (ui.root.classList.contains("speaking")) setEmotion(E.TALKING);
        else if (micEnabled) setEmotion(E.LISTENING);
        else setEmotion(E.IDLE);
      } else if (!isHidden) {
        setEmotion(E.IDLE);
      }
    }, restoreMs);
  }

  function wireEvents() {
    if (!isCompanion) {
      bus.onRoulette(({ type, payload }) => {
        if (window.CharacterMemory) window.CharacterMemory.recordOutcome(type, payload);
        const reaction = window.Character.reactToOutcome(type, payload);
        if (type === "BIG_WIN" && !isHidden) burstConfetti();
        if (type === "IDLE" && !isHidden) nudge();
        showReaction(reaction, type, payload);
      });
    }

    bus.on("voice:connecting", () => {
      if (!isHidden) setEmotion(E.THINKING);
    });

    bus.on("voice:ready", () => {
      connecting = false;
      voiceActive = true;
      reconnectAttempt = 0;
      document.body.classList.add("voice-live");
      if (micEnabled && !isHidden) setEmotion(E.LISTENING);
    });

    bus.on("voice:closed", () => {
      voiceActive = false;
      micEnabled = false;
      connecting = false;
      document.body.classList.remove("voice-live");
      if (!userMuted && autoVoice) scheduleReconnect();
      else if (!isHidden) setEmotion(E.IDLE);
    });

    bus.on("voice:error", () => {
      connecting = false;
      if (!userMuted && autoVoice) scheduleReconnect();
    });

    bus.on("voice:listening:start", () => {
      ui.root.classList.add("listening");
      if (!isHidden) setEmotion(E.LISTENING);
    });

    bus.on("voice:listening:stop", () => {
      ui.root.classList.remove("listening");
      if (ui.ring) ui.ring.style.setProperty("--lvl", 0);
    });

    bus.on("voice:thinking:start", () => {
      if (!isHidden) setEmotion(E.THINKING);
    });

    bus.on("voice:level", ({ level }) => {
      if (ui.ring) ui.ring.style.setProperty("--lvl", level.toFixed(3));
    });

    bus.on("voice:speaking:start", () => {
      ui.root.classList.add("speaking");
      if (!isHidden) setEmotion(E.TALKING);
    });

    bus.on("voice:speaking:stop", () => {
      ui.root.classList.remove("speaking");
      if (!isHidden && voiceActive && micEnabled) setEmotion(E.LISTENING);
    });

    // No transcript bubbles in casino visible mode
    bus.on("voice:transcript", () => {});

    bus.on("voice:mic:granted", () => {
      micEnabled = true;
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
