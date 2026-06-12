/**
 * roulette.js — European roulette with hot/cold numbers + expanded bet types
 */
(function () {
  const bus  = window.EventBus;
  const cfg  = (window.YUKI_CONFIG && window.YUKI_CONFIG.EVENT_SYSTEM) || {};
  const IDLE_MS = cfg.idleTimeoutMs || 18000;

  const WHEEL = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,
                 23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const REDS  = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const SEG   = 360 / WHEEL.length;
  const colorOf = n => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");

  let chip = 25;
  let betType = "red";
  let betNumber = 7;
  let spinning = false;
  let wheelRotation = 0;
  let idleTimer = null;
  let history = [];      // recent results (max 20)
  let spinLog = [];      // for hot/cold (max 50)

  const el = {};

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    el.wheel       = document.getElementById("wheel");
    el.result      = document.getElementById("result");
    el.resultLabel = document.getElementById("result-label");
    el.spinBtn     = document.getElementById("spin-btn");
    el.numberWrap  = document.getElementById("number-wrap");
    el.numberInput = document.getElementById("bet-number");
    el.history     = document.getElementById("history");
    el.hotColdEl   = document.getElementById("roulette-hot-cold");

    const screen = document.querySelector('[data-screen="roulette"]');
    el.chips     = [...screen.querySelectorAll("[data-chip]")];
    el.betBtns   = [...screen.querySelectorAll("[data-bet]")];

    buildWheel();
    bindControls();
    syncBetUI();
    resetIdleTimer();
    renderHotCold();
  }

  function buildWheel() {
    const stops = WHEEL.map((n, i) => {
      const start = (i * SEG).toFixed(3);
      const end   = ((i + 1) * SEG).toFixed(3);
      const c = colorOf(n) === "red" ? "#c0263a" : colorOf(n) === "black" ? "#1a2534" : "#1db96a";
      return `${c} ${start}deg ${end}deg`;
    });
    el.wheel.style.background = `conic-gradient(${stops.join(",")})`;

    const radius = 42;
    WHEEL.forEach((n, i) => {
      const angle = i * SEG + SEG / 2;
      const label = document.createElement("span");
      label.className = "wheel-num";
      label.textContent = n;
      const rad = (angle - 90) * (Math.PI / 180);
      label.style.left      = `${50 + radius * Math.cos(rad)}%`;
      label.style.top       = `${50 + radius * Math.sin(rad)}%`;
      label.style.transform = `translate(-50%,-50%) rotate(${angle}deg)`;
      el.wheel.appendChild(label);
    });
  }

  function bindControls() {
    el.spinBtn.addEventListener("click", spin);
    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
      noteActivity();
    }));
    el.betBtns.forEach(b => b.addEventListener("click", () => {
      betType = b.dataset.bet;
      markActive(el.betBtns, b);
      el.numberWrap.classList.toggle("show", betType === "number");
      noteActivity();
    }));
    el.numberInput.addEventListener("input", () => {
      let v = parseInt(el.numberInput.value, 10);
      if (isNaN(v)) v = 0;
      betNumber = Math.max(0, Math.min(36, v));
      noteActivity();
    });
  }

  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function syncBetUI() {
    el.chips.forEach(b => b.classList.toggle("active", Number(b.dataset.chip) === chip));
    el.betBtns.forEach(b => b.classList.toggle("active", b.dataset.bet === betType));
    el.numberInput.value = betNumber;
  }

  // ── Spin ─────────────────────────────────────────────────────────────────────
  function spin() {
    if (spinning) return;
    const balance = window.Casino.getBalance();
    if (balance < chip) { flashResult("Not enough!", "lose"); return; }

    noteActivity();
    spinning = true;
    el.spinBtn.disabled = true;
    window.Casino.adjustBalance(-chip);

    el.resultLabel.textContent = "Spinning…";
    el.result.className = "result spinning";
    el.result.textContent = "";

    const resultIndex  = Math.floor(Math.random() * WHEEL.length);
    const resultNumber = WHEEL[resultIndex];
    const targetAngle  = 360 - (resultIndex * SEG + SEG / 2);
    const fullSpins    = 5 + Math.floor(Math.random() * 3);
    wheelRotation += fullSpins * 360 + ((targetAngle - (wheelRotation % 360)) + 360) % 360;
    el.wheel.style.transform = `rotate(${wheelRotation}deg)`;

    setTimeout(() => settle(resultNumber), 4200);
  }

  function settle(n) {
    const color = colorOf(n);
    let payout = 0, big = false;

    if      (betType === "number") {
      if (n === betNumber) { payout = chip * 36; big = true; }
    } else if (betType === "red" || betType === "black") {
      if (color === betType) payout = chip * 2;
    } else if (betType === "even") {
      if (n !== 0 && n % 2 === 0) payout = chip * 2;
    } else if (betType === "odd") {
      if (n !== 0 && n % 2 !== 0) payout = chip * 2;
    } else if (betType === "low") {
      if (n >= 1 && n <= 18) payout = chip * 2;
    } else if (betType === "high") {
      if (n >= 19 && n <= 36) payout = chip * 2;
    } else if (betType === "dozen1") {
      if (n >= 1 && n <= 12) payout = chip * 3;
    } else if (betType === "dozen2") {
      if (n >= 13 && n <= 24) payout = chip * 3;
    } else if (betType === "dozen3") {
      if (n >= 25 && n <= 36) payout = chip * 3;
    }

    const newBal = window.Casino.adjustBalance(payout);
    el.result.className = `result ${color}`;
    el.result.textContent = n;
    el.resultLabel.textContent = `${n} — ${color.toUpperCase()}`;

    pushHistory(n, color);
    spinLog.push(n);
    if (spinLog.length > 50) spinLog.shift();
    renderHotCold();

    if (payout > 0) {
      const net = payout - chip;
      flashResult(`+${net.toLocaleString()}`, "win");
      bus.emitRoulette(big ? "BIG_WIN" : "WIN", { number: n, color, amount: net, balance: newBal, betType });
    } else {
      flashResult(`−${chip.toLocaleString()}`, "lose");
      bus.emitRoulette("LOSE", { number: n, color, amount: chip, balance: newBal, betType });
    }

    spinning = false;
    el.spinBtn.disabled = false;
    resetIdleTimer();
  }

  function flashResult(text, kind) {
    const tag = document.createElement("div");
    tag.className = `flash ${kind}`;
    tag.textContent = text;
    el.spinBtn.parentElement.appendChild(tag);
    setTimeout(() => tag.remove(), 1600);
  }

  function pushHistory(n, color) {
    history.unshift({ n, color });
    history = history.slice(0, 20);
    el.history.innerHTML = history.map(h => `<span class="chip-dot ${h.color}">${h.n}</span>`).join("");
  }

  // ── Hot / cold numbers ───────────────────────────────────────────────────────
  function renderHotCold() {
    if (!el.hotColdEl) return;
    if (spinLog.length < 5) {
      el.hotColdEl.innerHTML = '<span class="hc-hint">Spin to build statistics…</span>';
      return;
    }

    const freq = {};
    spinLog.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const hot  = sorted.slice(0, 5);
    const cold = sorted.slice(-5).reverse();

    const pill = ([n, cnt]) => {
      const c = colorOf(Number(n));
      return `<span class="hc-pill hc-${c}" title="${cnt} hits">${n}</span>`;
    };

    el.hotColdEl.innerHTML = `
      <div class="hc-group">
        <span class="hc-label">🔥 Hot</span>
        ${hot.map(pill).join("")}
      </div>
      <div class="hc-group">
        <span class="hc-label">❄ Cold</span>
        ${cold.map(pill).join("")}
      </div>
    `;
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!spinning && window.Casino.activeGame === "roulette")
        bus.emitRoulette("IDLE", { reason: "inactive" });
      resetIdleTimer();
    }, IDLE_MS);
  }
  function noteActivity() { resetIdleTimer(); }

  window.Roulette = { init, spin };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
