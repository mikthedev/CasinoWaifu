/**
 * memory.js  —  CHARACTER_MEMORY
 * -----------------------------------------------------------------------------
 * Lightweight, SESSION-ONLY memory for Yuki.
 *
 * It tracks:
 *   - recent conversation turns (who said what)
 *   - recent topics so Yuki can do callbacks ("ooh anime again? love that")
 *   - basic session context (spins, wins, losses, biggest win, mood, streaks)
 *
 * By design this never touches localStorage (config.persist === false), so the
 * companion forgets everything when the tab closes. Flip CHARACTER_MEMORY.persist
 * to true in config.js to opt into sessionStorage-backed memory instead.
 */

(function () {
  const cfg =
    (window.YUKI_CONFIG && window.YUKI_CONFIG.CHARACTER_MEMORY) || {
      persist: false,
      maxTurns: 12,
      maxTopics: 6,
    };

  const STORE_KEY = "yuki_session_memory_v1";

  const blank = () => ({
    turns: [], // { role: "user" | "yuki", text, at }
    topics: [], // { topic, count, lastAt }
    context: {
      startedAt: Date.now(),
      spins: 0,
      wins: 0,
      losses: 0,
      bigWins: 0,
      biggestWin: 0,
      currentStreak: 0, // + for win streak, - for loss streak
      lastOutcome: null,
      lastMood: "idle",
      userName: null,
    },
  });

  // Topics Yuki actively listens for so she can steer chit-chat naturally.
  const TOPIC_KEYWORDS = {
    games: ["game", "gaming", "play", "roulette", "bet", "casino", "spin"],
    anime: ["anime", "manga", "waifu", "otaku", "naruto", "onepiece", "ghibli"],
    music: ["music", "song", "playlist", "band", "kpop", "lofi", "listen"],
    movies: ["movie", "film", "cinema", "netflix", "show", "series"],
    hobbies: ["hobby", "draw", "paint", "code", "cook", "gym", "read"],
    "daily life": ["work", "school", "tired", "today", "weekend", "coffee", "sleep"],
  };

  let state = load();

  function load() {
    if (cfg.persist) {
      try {
        const raw = sessionStorage.getItem(STORE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
    }
    return blank();
  }

  function save() {
    if (!cfg.persist) return;
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function detectTopics(text) {
    const lower = (text || "").toLowerCase();
    const found = [];
    for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
      if (words.some((w) => lower.includes(w))) found.push(topic);
    }
    return found;
  }

  function rememberTopic(topic) {
    const existing = state.topics.find((t) => t.topic === topic);
    if (existing) {
      existing.count += 1;
      existing.lastAt = Date.now();
    } else {
      state.topics.push({ topic, count: 1, lastAt: Date.now() });
    }
    // Keep most-recent topics, capped.
    state.topics.sort((a, b) => b.lastAt - a.lastAt);
    state.topics = state.topics.slice(0, cfg.maxTopics);
  }

  /** Record a single conversation turn and auto-extract topics from user text. */
  function addTurn(role, text) {
    state.turns.push({ role, text, at: Date.now() });
    if (state.turns.length > cfg.maxTurns) {
      state.turns = state.turns.slice(-cfg.maxTurns);
    }
    if (role === "user") {
      detectTopics(text).forEach(rememberTopic);
      const name = extractName(text);
      if (name) state.context.userName = name;
    }
    save();
  }

  function extractName(text) {
    const m = (text || "").match(/\b(?:i am|i'm|im|my name is|call me)\s+([a-z][a-z'-]{1,20})/i);
    return m ? m[1].replace(/^\w/, (c) => c.toUpperCase()) : null;
  }

  /** Update rolling game context from a roulette outcome. */
  function recordOutcome(type, payload = {}) {
    const c = state.context;
    c.lastOutcome = type;
    if (type === "WIN" || type === "BIG_WIN" || type === "LOSE") c.spins += 1;

    const amount = Number(payload.amount) || 0;
    if (type === "WIN" || type === "BIG_WIN") {
      c.wins += 1;
      c.currentStreak = c.currentStreak >= 0 ? c.currentStreak + 1 : 1;
      if (amount > c.biggestWin) c.biggestWin = amount;
      if (type === "BIG_WIN") c.bigWins += 1;
    } else if (type === "LOSE") {
      c.losses += 1;
      c.currentStreak = c.currentStreak <= 0 ? c.currentStreak - 1 : -1;
    }
    save();
  }

  function setMood(mood) {
    state.context.lastMood = mood;
    save();
  }

  const getContext = () => ({ ...state.context });
  const getRecentTurns = (n = 4) => state.turns.slice(-n);
  const getTopTopic = () => (state.topics.length ? state.topics[0].topic : null);
  const getTopics = () => state.topics.map((t) => t.topic);
  const getUserName = () => state.context.userName;

  function reset() {
    state = blank();
    save();
  }

  window.CharacterMemory = {
    addTurn,
    recordOutcome,
    setMood,
    detectTopics,
    getContext,
    getRecentTurns,
    getTopTopic,
    getTopics,
    getUserName,
    reset,
  };
})();
