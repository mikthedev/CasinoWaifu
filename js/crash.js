/**
 * crash.js — Crash multiplier game with history strip + live players panel
 */
(function () {
  const bus = window.EventBus;

  let chip = 25;
  let phase = "idle";
  let multiplier = 1.0;
  let crashAt = 2.0;
  let autoOut = 2.0;
  let betPlaced = false;
  let animId = null;
  let startTime = null;
  let points = [];

  // Session stats
  let sessionHigh = 0;
  let roundCount = 0;
  let crashHistory = []; // last 10 crash points

  // Live players
  const PLAYER_NAMES = ["AceHunter", "LuckyDan", "HighRoller", "MoonShot", "QuickCash", "NeonBet", "StakeKing"];
  let livePlayers = [];
  let playerInterval = null;

  let canvas, ctx, dpr = 1;
  const el = {};

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    const screen = document.querySelector('[data-screen="crash"]');
    canvas   = document.getElementById("crash-canvas");
    ctx      = canvas.getContext("2d");
    el.multEl    = document.getElementById("crash-multiplier");
    el.statusEl  = document.getElementById("crash-status");
    el.betBtn    = document.getElementById("crash-btn");
    el.cashoutBtn= document.getElementById("crash-cashout-btn");
    el.autoInput = document.getElementById("crash-auto-input");
    el.historyEl = document.getElementById("crash-history");
    el.playersEl = document.getElementById("crash-live-players");
    el.statsEl   = document.getElementById("crash-session-stats");
    el.chips = [...screen.querySelectorAll("[data-chip]")];

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));
    el.betBtn.addEventListener("click", onBetClick);
    el.cashoutBtn.addEventListener("click", e => { e.preventDefault(); onCashout(); });
    el.autoInput.addEventListener("change", () => {
      autoOut = Math.max(1.1, parseFloat(el.autoInput.value) || 2);
      el.autoInput.value = autoOut.toFixed(1);
    });

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    setUIIdle();
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));
    renderHistory();
    renderStats();
  }

  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function resizeCanvas() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    canvas.width  = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (phase !== "flying") drawIdle(); else drawGraph();
  }

  // ── Round lifecycle ──────────────────────────────────────────────────────────
  function generateCrashPoint() {
    const r = Math.random();
    return Math.min(parseFloat(Math.max(1.12, 0.97 / (1 - r)).toFixed(2)), 100);
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
    setStatus("Place bet · Cash out before crash");
    clearLivePlayers();
  }

  function onBetClick() {
    if (phase === "flying") return;
    if (!["idle","crashed","cashed"].includes(phase)) return;
    const bal = window.Casino.getBalance();
    if (bal < chip) { setStatus("Not enough credits!"); return; }
    window.Casino.adjustBalance(-chip);
    betPlaced = true;
    autoOut = Math.max(1.1, parseFloat(el.autoInput.value) || 2);
    el.autoInput.value = autoOut.toFixed(1);
    startRound();
  }

  function startRound() {
    crashAt    = generateCrashPoint();
    multiplier = 1.0;
    phase      = "flying";
    points     = [{ t: 0, m: 1 }];
    startTime  = performance.now();
    roundCount++;

    el.betBtn.textContent = "FLYING…";
    el.betBtn.disabled    = true;
    setCashoutEnabled(true);
    el.multEl.className   = "crash-multiplier flying";
    el.multEl.textContent = "1.00×";
    setStatus(`Bet ${chip} · Tap CASH OUT!`);

    spawnLivePlayers();
    loop();
  }

  function loop() {
    if (phase !== "flying") return;
    const elapsed = (performance.now() - startTime) / 1000;
    multiplier = parseFloat(Math.exp(0.065 * elapsed).toFixed(2));
    points.push({ t: elapsed, m: multiplier });

    drawGraph();
    el.multEl.textContent = multiplier.toFixed(2) + "×";
    el.multEl.classList.toggle("danger", multiplier > 3);

    if (betPlaced && multiplier >= autoOut) { onCashout(); return; }
    if (multiplier >= crashAt)               { crash();     return; }

    if (betPlaced && [2,3,5].includes(Math.floor(multiplier))) {
      const frac = multiplier - Math.floor(multiplier);
      if (frac < 0.08) bus && bus.emit("crash:event", { type: "HIGH", payload: { multiplier, chip } });
    }

    updateLivePlayers();
    animId = requestAnimationFrame(loop);
  }

  function onCashout() {
    if (phase !== "flying" || !betPlaced) return;
    cancelAnimationFrame(animId); animId = null;
    const payout = Math.floor(chip * multiplier);
    const net    = payout - chip;
    window.Casino.adjustBalance(payout);
    phase = "cashed";
    betPlaced = false;
    el.multEl.className   = "crash-multiplier cashout";
    setStatus(`+${net} at ${multiplier.toFixed(2)}×`);
    setCashoutEnabled(false);
    el.betBtn.textContent = "BET AGAIN";
    el.betBtn.disabled    = false;
    bus && bus.emit("crash:event", { type: "WIN", payload: { multiplier, net, chip, balance: window.Casino.getBalance() } });
    setTimeout(setUIIdle, 2200);
  }

  function crash() {
    cancelAnimationFrame(animId); animId = null;
    phase = "crashed";
    el.multEl.className   = "crash-multiplier crashed";
    el.multEl.textContent = crashAt.toFixed(2) + "× 💥";
    setCashoutEnabled(false);
    el.betBtn.textContent = "BET AGAIN";
    el.betBtn.disabled    = false;
    if (betPlaced) {
      setStatus(`Crashed at ${crashAt.toFixed(2)}× — lost ${chip}`);
      bus && bus.emit("crash:event", { type: "LOSE", payload: { crashAt, chip, balance: window.Casino.getBalance() } });
    } else {
      setStatus(`Crashed at ${crashAt.toFixed(2)}×`);
    }
    betPlaced = false;

    // Record in history
    if (multiplier > sessionHigh) sessionHigh = multiplier;
    crashHistory.unshift(crashAt);
    if (crashHistory.length > 10) crashHistory.pop();
    renderHistory();
    renderStats();

    // Settle live players
    settleLivePlayers();
    setTimeout(setUIIdle, 2600);
  }

  function setStatus(text) { if (el.statusEl) el.statusEl.textContent = text; }

  // ── History strip ────────────────────────────────────────────────────────────
  function historyColor(v) {
    if (v >= 10) return "crash-hist-big";
    if (v >= 2)  return "crash-hist-mid";
    return "crash-hist-low";
  }

  function renderHistory() {
    if (!el.historyEl) return;
    if (!crashHistory.length) {
      el.historyEl.innerHTML = '<span class="crash-hist-empty">No history yet</span>';
      return;
    }
    el.historyEl.innerHTML = crashHistory.map(v =>
      `<span class="crash-hist-pill ${historyColor(v)}">${v.toFixed(2)}×</span>`
    ).join("");
  }

  // ── Session stats ────────────────────────────────────────────────────────────
  function renderStats() {
    if (!el.statsEl) return;
    const avg = crashHistory.length
      ? (crashHistory.reduce((a, b) => a + b, 0) / crashHistory.length).toFixed(2)
      : "—";
    el.statsEl.innerHTML = `
      <div class="crash-stat"><span class="crash-stat-label">High</span><span class="crash-stat-val green">${sessionHigh > 0 ? sessionHigh.toFixed(2) + "×" : "—"}</span></div>
      <div class="crash-stat"><span class="crash-stat-label">Avg</span><span class="crash-stat-val">${avg !== "—" ? avg + "×" : "—"}</span></div>
      <div class="crash-stat"><span class="crash-stat-label">Rounds</span><span class="crash-stat-val">${roundCount}</span></div>
    `;
  }

  // ── Live players ─────────────────────────────────────────────────────────────
  function spawnLivePlayers() {
    const count = 3 + Math.floor(Math.random() * 3);
    const shuffled = [...PLAYER_NAMES].sort(() => Math.random() - 0.5);
    livePlayers = shuffled.slice(0, count).map(name => ({
      name,
      bet: [10, 25, 50, 100][Math.floor(Math.random() * 4)],
      targetMult: 1.3 + Math.random() * 6, // when they cash out
      cashedOut: false,
      crashed: false,
      mult: null,
    }));
    renderLivePlayers();
  }

  function updateLivePlayers() {
    // Only re-render every ~10 frames to avoid thrash
    if (Math.random() > 0.15) return;
    livePlayers.forEach(p => {
      if (!p.cashedOut && !p.crashed && multiplier >= p.targetMult) {
        p.cashedOut = true;
        p.mult = multiplier;
      }
    });
    renderLivePlayers();
  }

  function settleLivePlayers() {
    livePlayers.forEach(p => {
      if (!p.cashedOut) { p.crashed = true; p.mult = crashAt; }
    });
    renderLivePlayers();
  }

  function clearLivePlayers() {
    livePlayers = [];
    if (el.playersEl) el.playersEl.innerHTML = "";
  }

  function renderLivePlayers() {
    if (!el.playersEl || !livePlayers.length) return;
    el.playersEl.innerHTML = livePlayers.map(p => {
      let statusHtml = "";
      if (p.cashedOut) {
        const net = Math.floor(p.bet * p.mult) - p.bet;
        statusHtml = `<span class="lp-status win">+${net} <em>${p.mult.toFixed(2)}×</em></span>`;
      } else if (p.crashed) {
        statusHtml = `<span class="lp-status lose">−${p.bet}</span>`;
      } else {
        statusHtml = `<span class="lp-status live">${multiplier.toFixed(2)}×</span>`;
      }
      return `
        <div class="lp-row">
          <span class="lp-avatar">${p.name[0]}</span>
          <span class="lp-name">${p.name}</span>
          <span class="lp-bet">${p.bet}</span>
          ${statusHtml}
        </div>`;
    }).join("");
  }

  // ── Canvas drawing ───────────────────────────────────────────────────────────
  const W = () => canvas.width / dpr;
  const H = () => canvas.height / dpr;

  function drawIdle() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W(), H());
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.font = "500 11px Outfit,sans-serif";
    ctx.fillText("1.00×", 10, H() - 10);
  }

  function drawGraph() {
    if (!ctx || points.length < 2) { drawIdle(); return; }
    ctx.clearRect(0, 0, W(), H());

    const maxT  = Math.max(points[points.length - 1].t, 0.1);
    const maxM  = Math.max(multiplier * 1.2, 2);
    const pad   = { l: 32, r: 12, t: 16, b: 22 };
    const gW    = W() - pad.l - pad.r;
    const gH    = H() - pad.t - pad.b;
    const tx    = t => pad.l + (t / maxT) * gW;
    const ty    = m => pad.t + gH - ((m - 1) / (maxM - 1)) * gH;

    const isWin     = phase === "cashed";
    const isCrashed = phase === "crashed";
    const lineColor = isCrashed ? "#ef4444" : isWin ? "#f59e0b" : "#1db96a";
    const fillAlpha = isCrashed ? "rgba(239,68,68,0.13)" : isWin ? "rgba(245,158,11,0.14)" : "rgba(29,185,106,0.14)";

    // Y-axis labels
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = "600 9px Outfit,sans-serif";
    ctx.textAlign = "right";
    const steps = [1, 2, 5, 10];
    steps.forEach(v => {
      if (v <= maxM) {
        const y = ty(v);
        ctx.fillText(v + "×", pad.l - 4, y + 3);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W() - pad.r, y); ctx.stroke();
      }
    });
    ctx.textAlign = "left";

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(tx(points[0].t), ty(points[0].m));
    for (const p of points) ctx.lineTo(tx(p.t), ty(p.m));
    ctx.lineTo(tx(points[points.length-1].t), pad.t + gH);
    ctx.lineTo(tx(points[0].t), pad.t + gH);
    ctx.closePath();
    ctx.fillStyle = fillAlpha;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(tx(points[0].t), ty(points[0].m));
    for (const p of points) ctx.lineTo(tx(p.t), ty(p.m));
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = "round";
    ctx.stroke();

    // Dot at tip
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(tx(last.t), ty(last.m), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();

    // Glow dot
    ctx.beginPath();
    ctx.arc(tx(last.t), ty(last.m), 9, 0, Math.PI * 2);
    ctx.fillStyle = lineColor.replace(")", ",0.2)").replace("rgb(", "rgba(") + (lineColor.startsWith("#") ? "33" : "");
    ctx.fill();
  }

  window.Crash = { init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
