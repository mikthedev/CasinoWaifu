/**
 * crash.js — Crash multiplier game
 * EventBus: "crash:event" { type: "WIN"|"LOSE"|"HIGH", payload }
 */
(function () {
  const bus = window.EventBus;

  let chip = 25;
  let phase = "idle"; // idle | flying | cashed | crashed
  let multiplier = 1.0;
  let crashAt = 2.0;
  let autoOut = 2.0;
  let betPlaced = false;
  let animId = null;
  let startTime = null;
  let points = [];

  let canvas, ctx, dpr = 1;
  const el = {};

  function init() {
    const screen = document.querySelector('[data-screen="crash"]');
    canvas = document.getElementById("crash-canvas");
    ctx = canvas.getContext("2d");
    el.multEl = document.getElementById("crash-multiplier");
    el.statusEl = document.getElementById("crash-status");
    el.betBtn = document.getElementById("crash-btn");
    el.cashoutBtn = document.getElementById("crash-cashout-btn");
    el.autoInput = document.getElementById("crash-auto-input");
    el.chips = [...screen.querySelectorAll("[data-chip]")];

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));

    el.betBtn.addEventListener("click", onBetClick);
    el.cashoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onCashout();
    });
    el.autoInput.addEventListener("change", () => {
      autoOut = Math.max(1.1, parseFloat(el.autoInput.value) || 2);
      el.autoInput.value = autoOut.toFixed(1);
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    setUIIdle();
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));
  }

  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (phase !== "flying") drawIdle();
    else drawGraph();
  }

  function generateCrashPoint() {
    const r = Math.random();
    // Min 1.12× so player always has time to cash out
    const point = Math.max(1.12, 0.97 / (1 - r));
    return Math.min(parseFloat(point.toFixed(2)), 100);
  }

  function setCashoutEnabled(on) {
    el.cashoutBtn.disabled = !on;
    el.cashoutBtn.classList.toggle("ready", on);
  }

  function setUIIdle() {
    phase = "idle";
    el.betBtn.textContent = "BET";
    el.betBtn.disabled = false;
    setCashoutEnabled(false);
    el.multEl.className = "crash-multiplier";
    el.multEl.textContent = "1.00×";
    drawIdle();
    setStatus("Place bet, then cash out before crash");
  }

  function onBetClick() {
    if (phase === "flying") return;
    if (phase !== "idle" && phase !== "crashed" && phase !== "cashed") return;

    const bal = window.Casino.getBalance();
    if (bal < chip) { setStatus("Not enough credits!"); return; }

    window.Casino.adjustBalance(-chip);
    betPlaced = true;
    autoOut = Math.max(1.1, parseFloat(el.autoInput.value) || 2);
    el.autoInput.value = autoOut.toFixed(1);
    startRound();
  }

  function startRound() {
    crashAt = generateCrashPoint();
    multiplier = 1.0;
    phase = "flying";
    points = [{ t: 0, m: 1 }];
    startTime = performance.now();

    el.betBtn.textContent = "FLYING…";
    el.betBtn.disabled = true;
    setCashoutEnabled(true);
    el.multEl.className = "crash-multiplier flying";
    el.multEl.textContent = "1.00×";
    setStatus(`Bet ${chip} — tap CASH OUT!`);

    loop();
  }

  function loop() {
    if (phase !== "flying") return;

    const elapsed = (performance.now() - startTime) / 1000;
    multiplier = parseFloat(Math.exp(0.065 * elapsed).toFixed(2));
    points.push({ t: elapsed, m: multiplier });

    drawGraph();
    el.multEl.textContent = multiplier.toFixed(2) + "×";
    el.multEl.classList.toggle("danger", multiplier > 2.5);

    if (betPlaced && multiplier >= autoOut) {
      onCashout();
      return;
    }

    if (multiplier >= crashAt) {
      crash();
      return;
    }

    if (betPlaced && [2, 3, 5].includes(Math.floor(multiplier))) {
      const frac = multiplier - Math.floor(multiplier);
      if (frac < 0.08) {
        bus && bus.emit("crash:event", { type: "HIGH", payload: { multiplier, chip } });
      }
    }

    animId = requestAnimationFrame(loop);
  }

  function onCashout() {
    if (phase !== "flying" || !betPlaced) return;

    cancelAnimationFrame(animId);
    animId = null;

    const payout = Math.floor(chip * multiplier);
    const net = payout - chip;
    window.Casino.adjustBalance(payout);

    phase = "cashed";
    betPlaced = false;
    el.multEl.className = "crash-multiplier cashout";
    setStatus(`+${net} at ${multiplier.toFixed(2)}×`);
    setCashoutEnabled(false);
    el.betBtn.textContent = "BET AGAIN";
    el.betBtn.disabled = false;

    bus && bus.emit("crash:event", {
      type: "WIN",
      payload: { multiplier, net, chip, balance: window.Casino.getBalance() },
    });

    setTimeout(setUIIdle, 2200);
  }

  function crash() {
    cancelAnimationFrame(animId);
    animId = null;

    phase = "crashed";
    el.multEl.className = "crash-multiplier crashed";
    el.multEl.textContent = crashAt.toFixed(2) + "× 💥";
    setCashoutEnabled(false);
    el.betBtn.textContent = "BET AGAIN";
    el.betBtn.disabled = false;

    if (betPlaced) {
      setStatus(`Crashed — lost ${chip}`);
      bus && bus.emit("crash:event", {
        type: "LOSE",
        payload: { crashAt, chip, balance: window.Casino.getBalance() },
      });
    } else {
      setStatus(`Crashed at ${crashAt.toFixed(2)}×`);
    }
    betPlaced = false;
    setTimeout(setUIIdle, 2400);
  }

  function setStatus(text) {
    if (el.statusEl) el.statusEl.textContent = text;
  }

  const W = () => canvas.width / dpr;
  const H = () => canvas.height / dpr;

  function drawIdle() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W(), H());
    drawGrid();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = "600 11px Outfit,sans-serif";
    ctx.fillText("1.00×", 8, H() - 10);
  }

  function drawGraph() {
    if (!ctx || points.length < 2) { drawIdle(); return; }
    ctx.clearRect(0, 0, W(), H());
    drawGrid();

    const maxT = Math.max(points[points.length - 1].t, 0.1);
    const maxM = Math.max(multiplier * 1.2, 2);
    const pad = { l: 8, r: 10, t: 16, b: 16 };
    const gW = W() - pad.l - pad.r;
    const gH = H() - pad.t - pad.b;
    const tx = t => pad.l + (t / maxT) * gW;
    const ty = m => pad.t + gH - ((m - 1) / (maxM - 1)) * gH;

    const color = phase === "cashed" ? "#fcd34d" : phase === "crashed" ? "#ff4d6d" : "#6ee7ff";

    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + gH);
    grad.addColorStop(0, color.replace(")", ",0.22)").replace("rgb", "rgba").replace("#6ee7ff", "rgba(110,231,255,0.22)"));
    grad.addColorStop(1, "rgba(110,231,255,0.02)");

    ctx.beginPath();
    ctx.moveTo(tx(points[0].t), ty(points[0].m));
    for (const p of points) ctx.lineTo(tx(p.t), ty(p.m));
    ctx.lineTo(tx(points[points.length - 1].t), pad.t + gH);
    ctx.lineTo(tx(points[0].t), pad.t + gH);
    ctx.closePath();
    ctx.fillStyle = phase === "cashed" ? "rgba(252,211,77,0.18)" :
                    phase === "crashed" ? "rgba(255,77,109,0.15)" : "rgba(110,231,255,0.18)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(tx(points[0].t), ty(points[0].m));
    for (const p of points) ctx.lineTo(tx(p.t), ty(p.m));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(tx(last.t), ty(last.m), 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (H() / 4) * i;
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
