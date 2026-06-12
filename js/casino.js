/**
 * casino.js — shared state, navigation, Yuki slot management
 *
 * Exposes window.Casino:
 *   Casino.getBalance()
 *   Casino.adjustBalance(delta)   → returns new balance, emits "casino:balance"
 *   Casino.activeGame             → "roulette" | "blackjack" | "crash" | "slots"
 */
(function () {
  const bus = window.EventBus;

  // ── shared balance ────────────────────────────────────────────────────────
  let _balance = 1_000;

  const balanceEl = document.getElementById("balance");

  function renderBalance() {
    if (balanceEl) balanceEl.textContent = _balance.toLocaleString();
  }

  function getBalance() { return _balance; }

  function adjustBalance(delta) {
    _balance = Math.max(0, _balance + delta);
    renderBalance();
    bus && bus.emit("casino:balance", { balance: _balance, delta });
    return _balance;
  }

  // ── navigation ────────────────────────────────────────────────────────────
  const GAME_ORDER = ["roulette", "blackjack", "crash", "slots", "sports"];
  let _active = "roulette";

  const screens   = document.querySelectorAll(".game-screen");
  const navBtns   = document.querySelectorAll(".nav-btn[data-goto]");
  const yukiWidget = document.getElementById("yuki-widget");

  function isMobileViewport() {
    return window.matchMedia("(max-width: 480px)").matches;
  }

  function placeYuki(game) {
    if (!yukiWidget) return;

    if (isMobileViewport()) {
      // On mobile Yuki lives in the fixed #yuki-widget-host overlay so she
      // stays visible above any fullscreen game or iframe. Mark the body so
      // CSS can hide the now-empty in-flow slots.
      document.body.classList.add("yuki-overlay-mode");
      return;
    }

    document.body.classList.remove("yuki-overlay-mode");
    const slot = document.querySelector(`.yuki-slot[data-game="${game}"]`);
    if (slot && slot !== yukiWidget.parentElement) {
      slot.appendChild(yukiWidget);
    }
  }

  function goTo(game, direction) {
    if (!GAME_ORDER.includes(game) || game === _active) return;
    const prev = _active;
    _active = game;

    screens.forEach(s => {
      const isNext = s.dataset.screen === game;
      const isPrev = s.dataset.screen === prev;
      s.classList.remove("active", "slide-in-right", "slide-in-left");
      if (isNext) {
        s.classList.add("active");
        if (direction) s.classList.add(direction === "right" ? "slide-in-right" : "slide-in-left");
      }
    });

    navBtns.forEach(b => b.classList.toggle("active", b.dataset.goto === game));

    placeYuki(game);
    bus && bus.emit("casino:game", { game, prev });
  }

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.goto;
      const from   = GAME_ORDER.indexOf(_active);
      const to     = GAME_ORDER.indexOf(target);
      goTo(target, to > from ? "right" : "left");
    });
  });

  // ── init ──────────────────────────────────────────────────────────────────
  function init() {
    renderBalance();
    // Activate first screen
    screens.forEach(s => s.classList.toggle("active", s.dataset.screen === _active));
    navBtns.forEach(b => b.classList.toggle("active", b.dataset.goto === _active));
    placeYuki(_active);

    // Re-evaluate overlay vs slot placement on orientation / resize changes
    window.addEventListener("resize", () => placeYuki(_active));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Casino = { getBalance, adjustBalance, goTo, get activeGame() { return _active; } };
})();
