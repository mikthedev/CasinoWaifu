/**
 * character.js — Yuki reactions for all casino games
 * Covers: Roulette, Blackjack, Crash, Slots
 */
(function () {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const EMOTION = Object.freeze({
    IDLE:      "idle",
    HAPPY:     "happy",
    EXCITED:   "excited",
    SAD:       "sad",
    THINKING:  "thinking",
    TALKING:   "talking",
    LISTENING: "listening",
    WORRIED:   "worried",
  });

  // ── reaction lines ────────────────────────────────────────────────────────
  const LINES = {
    // Roulette
    WIN:           ["Nice win!",    "You got it!",  "Winner~",    "Let's go!"],
    BIG_WIN:       ["HUGE WIN!!",   "OMG!!",        "Jackpot!!",  "Insane!!"],
    LOSE:          ["Next one!",    "Almost~",      "I'm here!",  "Unlucky!"],
    IDLE:          ["Hey~",         "Spin?",        "Still there?","Hi hi~"],

    // Blackjack
    BJ_WIN:        ["You beat them!","Nice hand!",  "Smart play~", "Well done!"],
    BJ_BLACKJACK:  ["Blackjack!!!",  "21! 🎉",       "PERFECT!!",  "YES!!"],
    BJ_BUST:       ["Over 21…",      "So close!",   "Bust! Ouch.", "Bad luck~"],
    BJ_LOSE:       ["Dealer wins…",  "Next hand!",  "You'll get 'em!", "Ugh~"],
    BJ_PUSH:       ["Tie! At least no loss~", "Push!", "Even steven~", "Good save!"],

    // Crash
    CRASH_WIN:     ["Cashed out!",  "Smart move~", "Nice exit!",  "Good timing!"],
    CRASH_LOSE:    ["Crashed!!",    "So close!",   "Too slow…",   "Nooo~"],
    CRASH_HIGH:    ["Hold on!!",    "Don't crash!","So exciting!","Keep going!!"],

    // Slots
    SLOTS_WIN:     ["Nice match!",  "Cherries~",   "Ka-ching!",   "Score!"],
    SLOTS_JACKPOT: ["JACKPOT!!!",   "💎💎💎!!",     "YESSS!!",     "INCREDIBLE!!"],
    SLOTS_LOSE:    ["Try again~",   "Spin more!",  "Almost…",     "Next time!"],
  };

  // ── reactor ───────────────────────────────────────────────────────────────
  function reactToOutcome(type) {
    switch (type) {
      // Roulette
      case "BIG_WIN":       return { emotion: EMOTION.EXCITED, line: pick(LINES.BIG_WIN) };
      case "WIN":           return { emotion: EMOTION.HAPPY,   line: pick(LINES.WIN) };
      case "LOSE":          return { emotion: EMOTION.SAD,     line: pick(LINES.LOSE) };
      case "IDLE":          return { emotion: EMOTION.IDLE,    line: pick(LINES.IDLE) };

      // Blackjack
      case "BLACKJACK":     return { emotion: EMOTION.EXCITED, line: pick(LINES.BJ_BLACKJACK) };
      case "BJ_WIN":        return { emotion: EMOTION.HAPPY,   line: pick(LINES.BJ_WIN) };
      case "BUST":          return { emotion: EMOTION.WORRIED, line: pick(LINES.BJ_BUST) };
      case "BJ_LOSE":       return { emotion: EMOTION.SAD,     line: pick(LINES.BJ_LOSE) };
      case "PUSH":          return { emotion: EMOTION.IDLE,    line: pick(LINES.BJ_PUSH) };

      // Crash
      case "CRASH_WIN":     return { emotion: EMOTION.HAPPY,   line: pick(LINES.CRASH_WIN) };
      case "CRASH_LOSE":    return { emotion: EMOTION.SAD,     line: pick(LINES.CRASH_LOSE) };
      case "HIGH":          return { emotion: EMOTION.EXCITED, line: pick(LINES.CRASH_HIGH) };

      // Slots
      case "SLOTS_WIN":     return { emotion: EMOTION.HAPPY,   line: pick(LINES.SLOTS_WIN) };
      case "SLOTS_JACKPOT": return { emotion: EMOTION.EXCITED, line: pick(LINES.SLOTS_JACKPOT) };
      case "SLOTS_LOSE":    return { emotion: EMOTION.SAD,     line: pick(LINES.SLOTS_LOSE) };

      default:              return { emotion: EMOTION.IDLE,    line: pick(LINES.IDLE) };
    }
  }

  window.Character = { EMOTION, name: "Yuki", reactToOutcome };
})();
