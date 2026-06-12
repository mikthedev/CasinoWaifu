/**
 * blackjack.js — Blackjack with streak counter, shoe indicator, insurance
 */
(function () {
  const bus = window.EventBus;

  const SUITS  = ["♠","♣","♦","♥"];
  const RANKS  = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  const RED_S  = new Set(["♦","♥"]);

  function buildDeck() {
    const deck = [];
    for (let d = 0; d < 6; d++)
      for (const s of SUITS)
        for (const r of RANKS)
          deck.push({ rank: r, suit: s });
    return deck;
  }

  function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function cardValue(rank) {
    if (rank === "A") return 11;
    if (["J","Q","K"].includes(rank)) return 10;
    return parseInt(rank, 10);
  }

  function handTotal(hand) {
    let total = 0, aces = 0;
    for (const c of hand) { total += cardValue(c.rank); if (c.rank === "A") aces++; }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function isSoft(hand) {
    let total = 0, aces = 0;
    for (const c of hand) { total += cardValue(c.rank); if (c.rank === "A") aces++; }
    return aces > 0 && total <= 21 && (total - 10) >= 0;
  }

  // ── State ────────────────────────────────────────────────────────────────────
  let deck = shuffle(buildDeck());
  let playerHand = [], dealerHand = [];
  let chip = 25;
  let phase = "bet"; // "bet" | "player" | "insurance" | "dealer" | "done"

  // Session stats
  let streak = 0;           // positive = W streak, negative = L streak
  let wins = 0, losses = 0, pushes = 0;
  let handHistory = [];     // last 8 outcomes: "W","L","P","BJ"
  let insuranceBet = 0;

  const el = {};

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    const screen    = document.querySelector('[data-screen="blackjack"]');
    el.dealerCards  = document.getElementById("bj-dealer-cards");
    el.playerCards  = document.getElementById("bj-player-cards");
    el.dealerScore  = document.getElementById("bj-dealer-score");
    el.playerScore  = document.getElementById("bj-player-score");
    el.message      = document.getElementById("bj-message");
    el.btnRow       = document.getElementById("bj-btn-row");
    el.streakEl     = document.getElementById("bj-streak");
    el.shoeEl       = document.getElementById("bj-shoe");
    el.historyEl    = document.getElementById("bj-hand-history");
    el.statsEl      = document.getElementById("bj-session-stats");
    el.chips        = [...screen.querySelectorAll("[data-chip]")];

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));

    renderBetPhase();
    updateShoe();
    renderStreak();
  }

  // ── Rendering ────────────────────────────────────────────────────────────────
  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function cardHTML(card, faceDown = false) {
    const div = document.createElement("div");
    if (faceDown) { div.className = "bj-card face-down"; return div; }
    const red = RED_S.has(card.suit);
    div.className = `bj-card${red ? " red-card" : ""}`;
    div.innerHTML = `<span>${card.rank}</span><span class="card-suit">${card.suit}</span>`;
    return div;
  }

  function renderHands(revealDealer = false) {
    el.dealerCards.innerHTML = "";
    el.playerCards.innerHTML = "";

    dealerHand.forEach((c, i) => {
      const fd = document.createElement("div");
      fd.style.animation = "cardDeal 0.25s ease forwards";
      el.dealerCards.appendChild(cardHTML(c, i === 1 && !revealDealer));
    });
    playerHand.forEach(c => {
      el.playerCards.appendChild(cardHTML(c));
    });

    const pTotal = handTotal(playerHand);
    el.playerScore.textContent = pTotal;
    el.playerScore.className   = "bj-score" + (pTotal > 21 ? " bust" : pTotal === 21 && playerHand.length === 2 ? " bj" : "");

    const dTotal = revealDealer ? handTotal(dealerHand) : handTotal([dealerHand[0]]);
    el.dealerScore.textContent = revealDealer ? dTotal : `${dTotal}+`;
    el.dealerScore.className   = "bj-score" + (revealDealer && dTotal > 21 ? " bust" : "");
  }

  function setMessage(text, cls = "") {
    el.message.textContent = text;
    el.message.className = `bj-message${cls ? " " + cls : ""}`;
  }

  function renderBetPhase() {
    phase = "bet";
    setMessage("Place your bet and deal");
    el.btnRow.innerHTML = `<button type="button" class="action-btn bj-action" id="bj-deal-btn">DEAL</button>`;
    document.getElementById("bj-deal-btn").addEventListener("click", deal);
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));
  }

  function renderPlayerPhase() {
    const canDouble = window.Casino.getBalance() >= chip;
    const canSplit  = playerHand.length === 2 &&
                      cardValue(playerHand[0].rank) === cardValue(playerHand[1].rank) &&
                      window.Casino.getBalance() >= chip;
    el.btnRow.innerHTML = `
      <button type="button" class="action-btn bj-action" id="bj-hit">HIT</button>
      <button type="button" class="action-btn bj-action secondary" id="bj-stand">STAND</button>
      ${canDouble ? `<button type="button" class="action-btn bj-action secondary" id="bj-double">2×</button>` : ""}
    `;
    document.getElementById("bj-hit").addEventListener("click", hit);
    document.getElementById("bj-stand").addEventListener("click", stand);
    if (canDouble) document.getElementById("bj-double").addEventListener("click", doubleDown);
    setMessage("");
  }

  function renderInsurancePhase() {
    phase = "insurance";
    const maxIns = Math.floor(chip / 2);
    el.btnRow.innerHTML = `
      <button type="button" class="action-btn bj-action" id="bj-ins-yes">Insurance ${maxIns}</button>
      <button type="button" class="action-btn bj-action secondary" id="bj-ins-no">No Thanks</button>
    `;
    document.getElementById("bj-ins-yes").addEventListener("click", () => takeInsurance(maxIns));
    document.getElementById("bj-ins-no").addEventListener("click", declineInsurance);
    setMessage("Dealer shows Ace — Insurance?", "ins");
  }

  function renderDone() {
    phase = "done";
    setTimeout(() => {
      el.btnRow.innerHTML = `<button type="button" class="action-btn bj-action" id="bj-deal-btn">DEAL AGAIN</button>`;
      document.getElementById("bj-deal-btn").addEventListener("click", deal);
    }, 1400);
  }

  // ── Shoe indicator ────────────────────────────────────────────────────────────
  function updateShoe() {
    if (!el.shoeEl) return;
    const total = 312; // 6 decks
    const pct   = Math.round((deck.length / total) * 100);
    el.shoeEl.innerHTML = `
      <div class="shoe-track">
        <div class="shoe-fill" style="width:${pct}%"></div>
      </div>
      <span class="shoe-label">Shoe ${pct}%</span>
    `;
  }

  // ── Streak + history ──────────────────────────────────────────────────────────
  function recordOutcome(outcome) {
    const code = { win: "W", blackjack: "BJ", push: "P", bust: "L", lose: "L" }[outcome] || "L";
    handHistory.unshift(code);
    if (handHistory.length > 8) handHistory.pop();

    if (code === "W" || code === "BJ") {
      wins++;
      streak = streak > 0 ? streak + 1 : 1;
    } else if (code === "P") {
      pushes++;
      streak = 0;
    } else {
      losses++;
      streak = streak < 0 ? streak - 1 : -1;
    }
    renderStreak();
  }

  function renderStreak() {
    if (el.streakEl) {
      if (streak === 0) {
        el.streakEl.textContent = "—";
        el.streakEl.className = "bj-streak-val";
      } else if (streak > 0) {
        el.streakEl.textContent = `🔥 ${streak}W`;
        el.streakEl.className = "bj-streak-val hot";
      } else {
        el.streakEl.textContent = `❄ ${Math.abs(streak)}L`;
        el.streakEl.className = "bj-streak-val cold";
      }
    }

    if (el.historyEl) {
      el.historyEl.innerHTML = handHistory.map(c => {
        const cls = c === "BJ" ? "bj" : c === "W" ? "win" : c === "P" ? "push" : "lose";
        return `<span class="bj-hist-pill ${cls}">${c}</span>`;
      }).join("");
    }

    if (el.statsEl) {
      const total = wins + losses + pushes;
      const rate  = total ? Math.round((wins / total) * 100) : 0;
      el.statsEl.innerHTML = `
        <span class="bj-stat"><b class="green">${wins}</b>W</span>
        <span class="bj-stat"><b class="red">${losses}</b>L</span>
        <span class="bj-stat"><b>${pushes}</b>P</span>
        <span class="bj-stat"><b>${rate}%</b>WR</span>
      `;
    }
  }

  // ── Game logic ────────────────────────────────────────────────────────────────
  function drawCard() {
    if (deck.length < 30) deck = shuffle(buildDeck());
    return deck.pop();
  }

  function deal() {
    const bal = window.Casino.getBalance();
    if (bal < chip) { setMessage("Not enough credits!", "lose"); return; }

    window.Casino.adjustBalance(-chip);
    insuranceBet = 0;

    playerHand = [drawCard(), drawCard()];
    dealerHand = [drawCard(), drawCard()];

    renderHands(false);
    updateShoe();
    setMessage("");

    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dealerHand);

    // Insurance offered when dealer face-up card is Ace
    if (dealerHand[0].rank === "A" && window.Casino.getBalance() >= Math.floor(chip / 2)) {
      renderInsurancePhase();
      return;
    }

    if (pTotal === 21) {
      if (dTotal === 21) { endRound("push"); return; }
      endRound("blackjack"); return;
    }

    phase = "player";
    renderPlayerPhase();
  }

  function takeInsurance(amount) {
    window.Casino.adjustBalance(-amount);
    insuranceBet = amount;
    continueAfterInsurance();
  }

  function declineInsurance() {
    insuranceBet = 0;
    continueAfterInsurance();
  }

  function continueAfterInsurance() {
    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dealerHand);

    if (pTotal === 21) {
      if (dTotal === 21) {
        // Insurance pays 2:1, player blackjack pushes (return original bet)
        if (insuranceBet) window.Casino.adjustBalance(insuranceBet * 3);
        endRound("push"); return;
      }
      endRound("blackjack"); return;
    }

    // Check dealer blackjack
    if (dTotal === 21) {
      if (insuranceBet) window.Casino.adjustBalance(insuranceBet * 3);
      endRound("lose"); return;
    }

    phase = "player";
    renderPlayerPhase();
  }

  function hit() {
    if (phase !== "player") return;
    playerHand.push(drawCard());
    updateShoe();
    renderHands(false);
    if (handTotal(playerHand) > 21) endRound("bust");
  }

  function stand() {
    if (phase !== "player") return;
    dealerPlay();
  }

  function doubleDown() {
    if (phase !== "player") return;
    window.Casino.adjustBalance(-chip);
    chip *= 2;
    playerHand.push(drawCard());
    updateShoe();
    renderHands(false);
    if (handTotal(playerHand) > 21) { endRound("bust"); chip /= 2; return; }
    dealerPlay();
  }

  function dealerPlay() {
    phase = "dealer";
    renderHands(true);

    function step() {
      const dTotal = handTotal(dealerHand);
      const soft   = isSoft(dealerHand);
      if (dTotal < 17 || (dTotal === 17 && soft)) {
        dealerHand.push(drawCard());
        updateShoe();
        renderHands(true);
        setTimeout(step, 420);
      } else {
        const pTotal = handTotal(playerHand);
        if      (dTotal > 21)       endRound("win");
        else if (pTotal > dTotal)   endRound("win");
        else if (pTotal === dTotal) endRound("push");
        else                        endRound("lose");
      }
    }
    setTimeout(step, 320);
  }

  function endRound(outcome) {
    renderHands(true);
    let payout = 0, event = "";

    switch (outcome) {
      case "blackjack": payout = Math.floor(chip * 2.5); setMessage("Blackjack! 🎉", "bj");    event = "BLACKJACK"; break;
      case "win":       payout = chip * 2;               setMessage("You win! 🙌", "win");      event = "WIN";       break;
      case "push":      payout = chip;                   setMessage("Push — Tie", "push");      event = "PUSH";      break;
      case "bust":                                        setMessage("Bust! Over 21 💀", "lose"); event = "BUST";     break;
      case "lose":                                        setMessage("Dealer wins", "lose");     event = "LOSE";      break;
    }

    const newBal = window.Casino.adjustBalance(payout);
    const net    = payout - chip;

    bus && bus.emit("blackjack:event", { type: event, payload: { net, chip, pTotal: handTotal(playerHand), balance: newBal } });

    recordOutcome(outcome);

    chip = el.chips.reduce((best, b) => {
      const v = Number(b.dataset.chip);
      return b.classList.contains("active") ? v : best;
    }, chip);

    renderDone();
  }

  window.Blackjack = { init };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
