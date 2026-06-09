// Local default — Vercel build + /api/voice-config can override on hosted deploys
window.YUKI_RUNTIME = window.YUKI_RUNTIME || {
  wsUrl: null,
  voiceBackend: false,
  voiceBackendUrl: null,
};

function yukiIsLocalHost() {
  const h = location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    /^192\.168\./.test(h) ||
    /^10\./.test(h)
  );
}

/** Load voice backend URL from Vercel API (works even if build-time env was missed). */
window.YUKI_loadRuntime = async function yukiLoadRuntime() {
  if (window.YUKI_RUNTIME.__loaded) return window.YUKI_RUNTIME;

  if (!yukiIsLocalHost()) {
    try {
      const res = await fetch("/api/voice-config", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        Object.assign(window.YUKI_RUNTIME, data);
      }
    } catch (err) {
      console.warn("[YUKI] voice-config fetch failed:", err);
    }
  }

  window.YUKI_RUNTIME.__loaded = true;
  return window.YUKI_RUNTIME;
};

window.YUKI_isLocalHost = yukiIsLocalHost;

window.YUKI_isHosted = function yukiIsHosted() {
  return !yukiIsLocalHost() && location.protocol.startsWith("http");
};

window.YUKI_isVoiceConfigured = function yukiIsVoiceConfigured() {
  const rt = window.YUKI_RUNTIME || {};
  return !!(rt.wsUrl || rt.voiceBackendUrl || rt.voiceBackend);
};
