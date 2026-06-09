/**
 * slots.js — 3-reel, 3-row slot machine, middle row payline
 * EventBus emits:
 *   "slots:event"  { type: "WIN"|"JACKPOT"|"LOSE", payload }
 */
(function () {
  const bus = window.EventBus;

  // Symbols: weight determines probability (higher = more common)
  const SYMBOLS = [
    { id: "cherry",  emoji: "🍒", weight: 30, payout: { 3: 2,  2: 0.5 } },
    { id: "lemon",   emoji: "🍋", weight: 25, payout: { 3: 3 } },
    { id: "orange",  emoji: "🍊", weight: 20, payout: { 3: 4 } },
    { id: "bell",    emoji: "🔔", weight: 12, payout: { 3: 6 } },
    { id: "diamond", emoji: "💎", weight: 8,  payout: { 3: 12 } },
    { id: "seven",   emoji: "7️⃣", weight: 5,  payout: { 3: 25 } }, // jackpot
  ];

  // Build weighted pool
  const POOL = [];
  SYMBOLS.forEach(s => { for (let i = 0; i < s.weight; i++) POOL.push(s); });

  function randomSymbol() { return POOL[Math.floor(Math.random() * POOL.length)]; }

  // ── state ─────────────────────────────────────────────────────────────────
  let chip     = 25;
  let spinning = false;

  const REEL_COUNT = 3;
  const VISIBLE    = 3;   // visible rows
  const STRIP_SIZE = 30;  // symbols in reel strip (for animation)

  const reelStates = Array.from({ length: REEL_COUNT }, () => ({
    symbols: [],     // full strip
    offset: 0,       // current top index (which symbol is at top)
  }));

  const el = {};

  function init() {
    const screen   = document.querySelector('[data-screen="slots"]');
    el.spinBtn     = document.getElementById("slots-spin-btn");
    el.resultEl    = document.getElementById("slots-result");
    el.chips       = [...screen.querySelectorAll("[data-chip]")];
    el.strips      = [
      document.getElementById("strip-0"),
      document.getElementById("strip-1"),
      document.getElementById("strip-2"),
    ];

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));
    el.spinBtn.addEventListener("click", spinReels);
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));

    // Build initial strips
    for (let r = 0; r < REEL_COUNT; r++) {
      buildStrip(r);
      renderStrip(r);
    }
  }

  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function buildStrip(r) {
    reelStates[r].symbols = Array.from({ length: STRIP_SIZE }, () => randomSymbol());
    reelStates[r].offset  = 0;
  }

  function renderStrip(r) {
    const strip  = el.strips[r];
    const state  = reelStates[r];
    const CELL_H = 78;
    strip.innerHTML = "";
    // Render STRIP_SIZE + 3 extra for wrapping illusion
    const total = STRIP_SIZE + VISIBLE;
    for (let i = 0; i < total; i++) {
      const sym = state.symbols[i % STRIP_SIZE];
      const div = document.createElement("div");
      div.className = "reel-symbol";
      div.textContent = sym.emoji;
      strip.appendChild(div);
    }
    strip.style.transform = `translateY(-${state.offset * CELL_H}px)`;
  }

  // ── spin logic ─────────────────────────────────────────────────────────────
  function spinReels() {
    if (spinning) return;
    const bal = window.Casino.getBalance();
    if (bal < chip) {
      el.resultEl.textContent = "Not enough credits!";
      el.resultEl.className   = "slots-result lose";
      return;
    }

    spinning = true;
    window.Casino.adjustBalance(-chip);
    el.spinBtn.disabled    = true;
    el.resultEl.textContent = "";
    el.resultEl.className   = "slots-result";

    // Generate target symbols for middle row (payline)
    const targets = Array.from({ length: REEL_COUNT }, () => randomSymbol());

    const CELL_H   = 78;
    const delays   = [0, 180, 360];    // stagger start
    const durations= [1200, 1500, 1800]; // different stop times

    let settled = 0;

    for (let r = 0; r < REEL_COUNT; r++) {
      const state = reelStates[r];
      const strip = el.strips[r];

      // Pick a landing offset so middle row = target
      // middle row index = 1 (0-indexed: top=0, mid=1, bot=2)
      const targetIdx    = Math.floor(Math.random() * STRIP_SIZE);
      state.symbols[targetIdx] = targets[r];
      // top row is targetIdx - 1
      const topIdx       = (targetIdx - 1 + STRIP_SIZE) % STRIP_SIZE;
      const spinExtraLen = STRIP_SIZE * 3 + topIdx; // at least 3 full rotations
      const finalOffset  = topIdx;

      // Rebuild strip with target in place
      strip.innerHTML = "";
      const total = STRIP_SIZE + VISIBLE;
      for (let i = 0; i < total; i++) {
        const sym = state.symbols[i % STRIP_SIZE];
        const div = document.createElement("div");
        div.className = "reel-symbol";
        div.textContent = sym.emoji;
        strip.appendChild(div);
      }

      // Animate: snap to spinExtraLen * CELL_H then ease to finalOffset
      const startOffset = state.offset;
      const totalTravel = (spinExtraLen - startOffset + STRIP_SIZE * 10) % (STRIP_SIZE * CELL_H);

      strip.style.transition = "none";
      strip.style.transform  = `translateY(-${startOffset * CELL_H}px)`;

      setTimeout(() => {
        strip.style.transition = `transform ${durations[r]}ms cubic-bezier(0.14, 0.9, 0.35, 1)`;
        strip.style.transform  = `translateY(-${spinExtraLen * CELL_H}px)`;
      }, delays[r]);

      setTimeout(() => {
        strip.style.transition = "none";
        strip.style.transform  = `translateY(-${finalOffset * CELL_H}px)`;
        state.offset = finalOffset;
        settled++;
        if (settled === REEL_COUNT) resolveResult(targets);
      }, delays[r] + durations[r] + 60);
    }
  }

  function resolveResult(targets) {
    const ids = targets.map(s => s.id);
    let payout = 0;
    let type   = "LOSE";
    let message = "";

    // 3 matching = win
    if (ids[0] === ids[1] && ids[1] === ids[2]) {
      const sym  = targets[0];
      const mult = sym.payout[3] || 0;
      payout = Math.floor(chip * mult);
      type   = sym.id === "seven" || sym.id === "diamond" ? "JACKPOT" : "WIN";
      message = type === "JACKPOT"
        ? `JACKPOT! ${sym.emoji}${sym.emoji}${sym.emoji}  +${payout - chip}`
        : `${sym.emoji}${sym.emoji}${sym.emoji}  +${payout - chip}`;
    }
    // 2 cherries = small win
    else if (ids.filter(id => id === "cherry").length >= 2 && SYMBOLS[0].payout[2]) {
      payout  = Math.floor(chip * SYMBOLS[0].payout[2]);
      type    = "WIN";
      message = `🍒🍒  +${payout - chip}`;
    }
    else {
      message = `${targets.map(s => s.emoji).join(" ")}  –${chip}`;
    }

    const newBal = window.Casino.adjustBalance(payout);

    el.resultEl.textContent = message;
    el.resultEl.className   = `slots-result ${type === "JACKPOT" ? "jackpot" : type === "WIN" ? "win" : "lose"}`;

    bus && bus.emit("slots:event", {
      type,
      payload: { symbols: targets.map(s => s.id), net: payout - chip, chip, balance: newBal },
    });

    spinning = false;
    el.spinBtn.disabled = false;
  }

  window.Slots = { init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
