/**
 * crash.js — Crash multiplier game with canvas graph
 * EventBus emits on window.EventBus:
 *   "crash:event"  { type: "WIN"|"LOSE"|"HIGH", payload }
 */
(function () {
  const bus = window.EventBus;

  // ── state ─────────────────────────────────────────────────────────────────
  let chip        = 25;
  let phase       = "idle";    // "idle" | "betting" | "flying" | "cashed" | "crashed"
  let multiplier  = 1.00;
  let crashAt     = 1.00;
  let autoOut     = 2.00;
  let betPlaced   = false;
  let animId      = null;
  let startTime   = null;
  let points      = [];        // {t, m} for canvas

  // ── DOM ───────────────────────────────────────────────────────────────────
  let canvas, ctx;
  const el = {};

  function init() {
    const screen     = document.querySelector('[data-screen="crash"]');
    canvas           = document.getElementById("crash-canvas");
    ctx              = canvas.getContext("2d");
    el.multEl        = document.getElementById("crash-multiplier");
    el.statusEl      = document.getElementById("crash-status");
    el.betBtn        = document.getElementById("crash-btn");
    el.cashoutBtn    = document.getElementById("crash-cashout-btn");
    el.autoInput     = document.getElementById("crash-auto-input");
    el.chips         = [...screen.querySelectorAll("[data-chip]")];

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));

    el.betBtn.addEventListener("click", onBetClick);
    el.cashoutBtn.addEventListener("click", onCashout);
    el.autoInput.addEventListener("change", () => {
      autoOut = Math.max(1.01, parseFloat(el.autoInput.value) || 2);
      el.autoInput.value = autoOut.toFixed(2);
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    drawIdle();
    setStatus("Place your bet to join");
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));
  }

  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    canvas.width  = wrap.clientWidth  * devicePixelRatio;
    canvas.height = wrap.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    if (phase !== "flying") drawIdle();
  }

  // ── crash point generation ────────────────────────────────────────────────
  function generateCrashPoint() {
    const r = Math.random();
    if (r < 0.01) return 1.00;                          // 1% instant crash
    return parseFloat(Math.max(1.00, 1 / (1 - r)).toFixed(2));
  }

  // ── game flow ─────────────────────────────────────────────────────────────
  function onBetClick() {
    if (phase === "flying") {
      // Lock bet in while flying
      if (!betPlaced) {
        const bal = window.Casino.getBalance();
        if (bal < chip) { setStatus("Not enough credits!"); return; }
        window.Casino.adjustBalance(-chip);
        betPlaced = true;
        el.betBtn.textContent = "BET IN";
        el.betBtn.disabled = true;
        el.cashoutBtn.disabled = false;
        setStatus(`In for ${chip} — cash out anytime!`);
      }
      return;
    }
    if (phase !== "idle" && phase !== "crashed" && phase !== "cashed") return;

    // Start new round
    const bal = window.Casino.getBalance();
    if (bal < chip) { setStatus("Not enough credits!"); return; }
    window.Casino.adjustBalance(-chip);
    betPlaced = true;
    autoOut   = Math.max(1.01, parseFloat(el.autoInput.value) || 2);
    startRound();
  }

  function startRound() {
    crashAt    = generateCrashPoint();
    multiplier = 1.00;
    phase      = "flying";
    points     = [];
    startTime  = performance.now();

    el.betBtn.textContent  = "BET IN";
    el.betBtn.disabled     = true;
    el.cashoutBtn.disabled = !betPlaced;
    el.multEl.className    = "crash-multiplier";
    el.multEl.textContent  = "1.00×";
    setStatus(betPlaced ? `In for ${chip} — cash out!` : "Flying…");

    loop();
  }

  function loop() {
    const now     = performance.now();
    const elapsed = (now - startTime) / 1000; // seconds

    // Multiplier grows exponentially: m = e^(0.06 * t)
    multiplier = parseFloat(Math.exp(0.06 * elapsed).toFixed(2));

    points.push({ t: elapsed, m: multiplier });

    drawGraph();
    el.multEl.textContent = `${multiplier.toFixed(2)}×`;
    if (multiplier > 3) el.multEl.classList.add("danger");

    // Auto cash-out
    if (betPlaced && multiplier >= autoOut) { onCashout(); return; }

    // Crash check
    if (multiplier >= crashAt) { crash(); return; }

    // Emit high-multiplier excitement to Yuki
    if (betPlaced && [2, 3, 5, 10].includes(Math.floor(multiplier)) &&
        multiplier - Math.floor(multiplier) < 0.05) {
      bus && bus.emit("crash:event", { type: "HIGH", payload: { multiplier, chip } });
    }

    animId = requestAnimationFrame(loop);
  }

  function onCashout() {
    if (phase !== "flying" || !betPlaced) return;
    cancelAnimationFrame(animId);
    const payout = Math.floor(chip * multiplier);
    const net    = payout - chip;
    window.Casino.adjustBalance(payout);
    phase = "cashed";
    el.multEl.className = "crash-multiplier cashout";
    setStatus(`Cashed out at ${multiplier.toFixed(2)}× · +${net}`);
    el.cashoutBtn.disabled = true;
    el.betBtn.textContent  = "BET AGAIN";
    el.betBtn.disabled     = false;
    betPlaced = false;

    bus && bus.emit("crash:event", {
      type: "WIN",
      payload: { multiplier, net, chip, balance: window.Casino.getBalance() },
    });

    setTimeout(resetIdle, 2200);
  }

  function crash() {
    cancelAnimationFrame(animId);
    phase = "crashed";
    el.multEl.className = "crash-multiplier crashed";
    el.multEl.textContent = `${multiplier.toFixed(2)}× 💥`;
    el.cashoutBtn.disabled = true;
    el.betBtn.textContent  = "BET AGAIN";
    el.betBtn.disabled     = false;

    if (betPlaced) {
      setStatus(`Crashed at ${crashAt.toFixed(2)}× — lost ${chip}`);
      bus && bus.emit("crash:event", {
        type: "LOSE",
        payload: { crashAt, chip, balance: window.Casino.getBalance() },
      });
    } else {
      setStatus(`Crashed at ${crashAt.toFixed(2)}×`);
    }
    betPlaced = false;
    setTimeout(resetIdle, 2500);
  }

  function resetIdle() {
    phase  = "idle";
    points = [];
    drawIdle();
    setStatus("Place your bet to join");
  }

  function setStatus(text) {
    if (el.statusEl) el.statusEl.textContent = text;
  }

  // ── canvas drawing ────────────────────────────────────────────────────────
  const W = () => canvas.width  / devicePixelRatio;
  const H = () => canvas.height / devicePixelRatio;

  function drawIdle() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W(), H());
    // grid
    drawGrid();
    // baseline label
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "bold 12px Outfit, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("1.00×", 8, H() - 8);
  }

  function drawGraph() {
    if (!ctx || points.length < 2) { drawIdle(); return; }
    ctx.clearRect(0, 0, W(), H());
    drawGrid();

    const maxT = points[points.length - 1].t;
    const maxM = Math.max(multiplier * 1.15, 2);
    const padL = 6, padR = 12, padT = 20, padB = 20;
    const gW   = W() - padL - padR;
    const gH   = H() - padT - padB;

    const tx = t => padL + (t / maxT) * gW;
    const ty = m => padT + gH - ((m - 1) / (maxM - 1)) * gH;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + gH);
    grad.addColorStop(0, "rgba(110,231,255,0.25)");
    grad.addColorStop(1, "rgba(110,231,255,0.02)");

    ctx.beginPath();
    ctx.moveTo(tx(points[0].t), ty(points[0].m));
    for (const p of points) ctx.lineTo(tx(p.t), ty(p.m));
    ctx.lineTo(tx(points[points.length - 1].t), padT + gH);
    ctx.lineTo(tx(points[0].t), padT + gH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(tx(points[0].t), ty(points[0].m));
    for (const p of points) ctx.lineTo(tx(p.t), ty(p.m));
    ctx.strokeStyle = phase === "cashed" ? "#fcd34d" :
                      phase === "crashed" ? "#ff4d6d" : "#6ee7ff";
    ctx.lineWidth = 2.5;
    ctx.lineJoin  = "round";
    ctx.stroke();

    // Dot at head
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(tx(last.t), ty(last.m), 5, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  function drawGrid() {
    const lines = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth   = 1;
    for (let i = 1; i < lines; i++) {
      const y = (H() / lines) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W(), y);
      ctx.stroke();
    }
  }

  window.Crash = { init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
