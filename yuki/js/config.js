/**
 * config.js — client configuration (no secrets here)
 */

window.YUKI_CONFIG = {
  // ---------------------------------------------------------------------------
  // INWORLD REALTIME — WebSocket proxy (API key lives on the server only)
  // ---------------------------------------------------------------------------
  REALTIME: {
    // null = auto-detect from page host + port below
    wsUrl: null,
    port: 8787,
  },

  // ---------------------------------------------------------------------------
  // EVENT_SYSTEM
  // ---------------------------------------------------------------------------
  EVENT_SYSTEM: {
    channel: "casino-waifu",
    debug: true,
    idleTimeoutMs: 18000,
  },

  // ---------------------------------------------------------------------------
  // CHARACTER_MEMORY
  // ---------------------------------------------------------------------------
  CHARACTER_MEMORY: {
    persist: false,
    maxTurns: 12,
    maxTopics: 6,
  },

  // ---------------------------------------------------------------------------
  // Character sprites — keyed by interaction emotion (matches asset filenames)
  // ---------------------------------------------------------------------------
  CHARACTER: {
    name: "Yuki",
    sprites: {
      idle: "assets/Yuki_idle.png",
      happy: "assets/Yuki_happy.png",
      excited: "assets/Yuki_excited.png",
      sad: "assets/Yuki_sad.png",
      talking: "assets/Yuki_talking.png",
      thinking: "assets/Yuki_thinking.png",
      listening: "assets/Yuki_listening.png",
      worried: "assets/Yuki_worried.png",
    },
  },

  // "overlay" = floating on roulette (index.html) | "companion" = Yuki-only (companion.html)
  MODE: "overlay",

  // Casino mode: connect voice automatically and keep reconnecting until Stop
  AUTO_VOICE: true,
};
