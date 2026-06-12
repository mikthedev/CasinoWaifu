/**
 * slots.js — 3-reel slot machine with jackpot meter, paytable, recent-wins ticker
 */
(function () {
  const bus = window.EventBus;

  const SYMBOLS = [
    { id: "cherry",   emoji: "🍒", weight: 30, payout: { 3: 2,  2: 0.5 } },
    { id: "lemon",    emoji: "🍋", weight: 25, payout: { 3: 3  } },
    { id: "orange",   emoji: "🍊", weight: 20, payout: { 3: 4  } },
    { id: "bell",     emoji: "🔔", weight: 12, payout: { 3: 6  } },
    { id: "diamond",  emoji: "💎", weight: 8,  payout: { 3: 12 } },
    { id: "seven",    emoji: "7️⃣", weight: 5,  payout: { 3: 25 } },
  ];

  const POOL = [];
  SYMBOLS.forEach(s => { for (let i = 0; i < s.weight; i++) POOL.push(s); });
  const randSym = () => POOL[Math.floor(Math.random() * POOL.length)];

  const REELS    = 3;
  const STRIP_LEN = 24;
  let chip = 25;
  let spinning = false;
  let cellH = 64;

  // Jackpot pool: grows 5% of each losing bet
  let jackpotPool = 850;
  const JP_CONTRIB = 0.05; // 5% of bet
  const JP_BASE    = 500;

  // Recent wins ring buffer
  const recentWins = [];
  const MAX_WINS   = 12;

  const reels = [];
  const el = {};

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    const screen = document.querySelector('[data-screen="slots"]');
    el.spinBtn   = document.getElementById("slots-spin-btn");
    el.resultEl  = document.getElementById("slots-result");
    el.machine   = document.querySelector(".slots-machine");
    el.chips     = [...screen.querySelectorAll("[data-chip]")];
    el.jackpotEl = document.getElementById("slots-jackpot-val");
    el.jackpotBar= document.getElementById("slots-jackpot-bar");
    el.winTicker = document.getElementById("slots-win-ticker");
    el.paytableBtn = document.getElementById("slots-paytable-btn");
    el.paytableOverlay = document.getElementById("slots-paytable-overlay");

    cellH = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--slot-cell")) || 64;

    for (let i = 0; i < REELS; i++) {
      const reelEl  = document.getElementById(`reel-${i}`);
      const stripEl = document.getElementById(`strip-${i}`);
      const symbols = Array.from({ length: STRIP_LEN }, () => randSym());
      reels.push({ stripEl, reelEl, symbols, offset: 0, velocity: 0, target: 0, spinning: false });
      renderReel(i);
    }

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));
    el.spinBtn.addEventListener("click", spin);
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));

    if (el.paytableBtn) {
      el.paytableBtn.addEventListener("click", () => togglePaytable(true));
    }
    if (el.paytableOverlay) {
      el.paytableOverlay.addEventListener("click", e => {
        if (e.target === el.paytableOverlay) togglePaytable(false);
      });
    }

    updateJackpot();
    renderWinTicker();
  }

  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  // ── Jackpot ─────────────────────────────────────────────────────────────────
  function updateJackpot() {
    if (!el.jackpotEl) return;
    el.jackpotEl.textContent = Math.floor(jackpotPool).toLocaleString();
    if (el.jackpotBar) {
      const pct = Math.min(((jackpotPool - JP_BASE) / (JP_BASE * 4)) * 100, 100);
      el.jackpotBar.style.width = pct + "%";
    }
  }

  // ── Recent wins ticker ────────────────────────────────────────────────────────
  function addWin(emoji, net) {
    recentWins.unshift({ emoji, net });
    if (recentWins.length > MAX_WINS) recentWins.pop();
    renderWinTicker();
  }

  function renderWinTicker() {
    if (!el.winTicker) return;
    if (!recentWins.length) {
      el.winTicker.innerHTML = '<span class="ticker-empty">No wins yet — spin to start!</span>';
      return;
    }
    el.winTicker.innerHTML = recentWins.map(w =>
      `<span class="ticker-item"><span class="ticker-emoji">${w.emoji}</span> +${w.net}</span>`
    ).join("");
  }

  // ── Paytable overlay ─────────────────────────────────────────────────────────
  function togglePaytable(open) {
    if (!el.paytableOverlay) return;
    el.paytableOverlay.classList.toggle("open", open);
    if (open) {
      el.paytableOverlay.innerHTML = `
        <div class="paytable-card">
          <h3>Paytable</h3>
          <table class="paytable-table">
            <thead><tr><th>Combo</th><th>Multiplier</th></tr></thead>
            <tbody>
              ${SYMBOLS.slice().reverse().map(s => {
                const p3 = s.payout[3];
                const p2 = s.payout[2];
                return `<tr>
                  <td>${s.emoji}${s.emoji}${s.emoji}</td>
                  <td class="pt-mult">${p3}×</td>
                </tr>` + (p2 ? `<tr class="pt-partial">
                  <td>${s.emoji}${s.emoji} —</td>
                  <td class="pt-mult">${p2}×</td>
                </tr>` : "");
              }).join("")}
            </tbody>
          </table>
          <p class="pt-note">Jackpot: 7️⃣7️⃣7️⃣ or 💎💎💎 pays accumulated pool</p>
          <button class="pt-close" onclick="this.closest('.paytable-overlay').classList.remove('open')">Close</button>
        </div>`;
    }
  }

  // ── Reel rendering ───────────────────────────────────────────────────────────
  function renderReel(i) {
    const r = reels[i];
    r.stripEl.innerHTML = "";
    const total = STRIP_LEN * 3;
    for (let j = 0; j < total; j++) {
      const sym = r.symbols[j % STRIP_LEN];
      const div = document.createElement("div");
      div.className = "reel-symbol";
      div.textContent = sym.emoji;
      r.stripEl.appendChild(div);
    }
    r.stripEl.style.transform = `translateY(-${r.offset * cellH}px)`;
  }

  // ── Spin ─────────────────────────────────────────────────────────────────────
  function spin() {
    if (spinning) return;
    const bal = window.Casino.getBalance();
    if (bal < chip) {
      el.resultEl.textContent = "Not enough credits!";
      el.resultEl.className   = "slots-result lose";
      return;
    }

    spinning = true;
    window.Casino.adjustBalance(-chip);
    // Contribute to jackpot pool
    jackpotPool += chip * JP_CONTRIB;
    updateJackpot();

    el.spinBtn.disabled = true;
    el.resultEl.textContent = "";
    el.resultEl.className   = "slots-result";
    el.machine.classList.add("spinning");

    const targets    = Array.from({ length: REELS }, () => randSym());
    const stopDelays = [1800, 2400, 3000];
    let stopped = 0;

    for (let i = 0; i < REELS; i++) {
      const r       = reels[i];
      const landIdx = Math.floor(Math.random() * STRIP_LEN);
      r.symbols[landIdx] = targets[i];
      const topIdx  = (landIdx - 1 + STRIP_LEN) % STRIP_LEN;
      r.target      = topIdx;
      r.spinning    = true;
      r.velocity    = 28 + i * 4;
      r.reelEl.classList.add("reel-spinning");
      renderReel(i);

      setTimeout(() => {
        r.spinning  = false;
        r.velocity  = 0;
        r.offset    = r.target;
        r.stripEl.style.transition = "transform 0.35s cubic-bezier(0.2,1.4,0.4,1)";
        r.stripEl.style.transform  = `translateY(-${r.offset * cellH}px)`;
        r.reelEl.classList.remove("reel-spinning");
        r.reelEl.classList.add("reel-landed");
        setTimeout(() => r.reelEl.classList.remove("reel-landed"), 400);
        stopped++;
        if (stopped === REELS) {
          el.machine.classList.remove("spinning");
          resolveResult(targets);
        }
      }, stopDelays[i]);
    }

    animateReels();
  }

  function animateReels() {
    if (!spinning) return;
    let anySpinning = false;
    for (let i = 0; i < REELS; i++) {
      const r = reels[i];
      if (!r.spinning) continue;
      anySpinning = true;
      r.offset += r.velocity / 60;
      if (r.offset >= STRIP_LEN) r.offset -= STRIP_LEN;
      r.stripEl.style.transition = "none";
      r.stripEl.style.transform  = `translateY(-${r.offset * cellH}px)`;
    }
    if (anySpinning) requestAnimationFrame(animateReels);
  }

  function resolveResult(targets) {
    const ids = targets.map(s => s.id);
    let payout = 0, type = "LOSE", message = "";

    if (ids[0] === ids[1] && ids[1] === ids[2]) {
      const sym  = targets[0];
      const isJP = sym.id === "seven" || sym.id === "diamond";

      if (isJP) {
        payout  = Math.floor(jackpotPool);
        jackpotPool = JP_BASE;
        updateJackpot();
        type    = "JACKPOT";
        message = `JACKPOT! ${sym.emoji.repeat(3)} +${payout - chip}`;
        el.machine.classList.add("jackpot-flash");
        setTimeout(() => el.machine.classList.remove("jackpot-flash"), 1600);
      } else {
        const mult = sym.payout[3] || 0;
        payout  = Math.floor(chip * mult);
        type    = "WIN";
        message = `${sym.emoji.repeat(3)} +${payout - chip}`;
      }
      addWin(sym.emoji.repeat(3), payout - chip);
    } else if (ids.filter(id => id === "cherry").length >= 2) {
      payout  = Math.floor(chip * 0.5);
      type    = "WIN";
      message = `🍒🍒 +${payout - chip}`;
      addWin("🍒🍒", payout - chip);
    } else {
      message = targets.map(s => s.emoji).join(" ") + ` −${chip}`;
    }

    const newBal = window.Casino.adjustBalance(payout);
    el.resultEl.textContent = message;
    el.resultEl.className   = `slots-result ${type === "JACKPOT" ? "jackpot" : type === "WIN" ? "win" : "lose"}`;

    bus && bus.emit("slots:event", {
      type,
      payload: { symbols: ids, net: payout - chip, chip, balance: newBal },
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
