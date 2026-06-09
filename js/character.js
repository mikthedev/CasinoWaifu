/**
 * character.js — Yuki visual reactions for roulette (text bubbles only, no TTS)
 */

(function () {
  const mem = window.CharacterMemory;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const EMOTION = Object.freeze({
    IDLE: "idle",
    HAPPY: "happy",
    EXCITED: "excited",
    SAD: "sad",
    THINKING: "thinking",
    TALKING: "talking",
    LISTENING: "listening",
    WORRIED: "worried",
  });

  const LINES = {
    WIN: ["Nice win!", "You got it!", "Winner~", "Let's go!"],
    BIG_WIN: ["HUGE WIN!!", "OMG!!", "Jackpot!!", "Insane!!"],
    LOSE: ["Next one!", "Almost~", "I'm here!", "Unlucky!"],
    IDLE: ["Hey~", "Spin?", "Still there?", "Hi hi~"],
  };

  function reactToOutcome(type) {
    switch (type) {
      case "BIG_WIN":
        return { emotion: EMOTION.EXCITED, line: pick(LINES.BIG_WIN) };
      case "WIN":
        return { emotion: EMOTION.HAPPY, line: pick(LINES.WIN) };
      case "LOSE":
        return { emotion: EMOTION.SAD, line: pick(LINES.LOSE) };
      case "IDLE":
      default:
        return { emotion: EMOTION.IDLE, line: pick(LINES.IDLE) };
    }
  }

  window.Character = {
    EMOTION,
    name: "Yuki",
    reactToOutcome,
  };
})();
