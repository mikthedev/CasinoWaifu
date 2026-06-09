/**
 * blackjack.js — standard Blackjack (6-deck, dealer stands on soft 17)
 * EventBus emits on window.EventBus:
 *   "blackjack:event"  { type: "WIN"|"LOSE"|"PUSH"|"BLACKJACK"|"BUST", payload }
 */
(function () {
  const bus = window.EventBus;

  // ── deck ──────────────────────────────────────────────────────────────────
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
    for (const c of hand) {
      total += cardValue(c.rank);
      if (c.rank === "A") aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function isSoft(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
      total += cardValue(c.rank);
      if (c.rank === "A") aces++;
    }
    return aces > 0 && total <= 21 && (total - 10) >= 0;
  }

  // ── state ─────────────────────────────────────────────────────────────────
  let deck = shuffle(buildDeck());
  let playerHand = [], dealerHand = [];
  let chip = 25;
  let phase = "bet"; // "bet" | "player" | "dealer" | "done"

  const el = {};

  function init() {
    const screen   = document.querySelector('[data-screen="blackjack"]');
    el.dealerCards = document.getElementById("bj-dealer-cards");
    el.playerCards = document.getElementById("bj-player-cards");
    el.dealerScore = document.getElementById("bj-dealer-score");
    el.playerScore = document.getElementById("bj-player-score");
    el.message     = document.getElementById("bj-message");
    el.btnRow      = document.getElementById("bj-btn-row");
    el.chips       = [...screen.querySelectorAll("[data-chip]")];

    el.chips.forEach(b => b.addEventListener("click", () => {
      chip = Number(b.dataset.chip);
      markActive(el.chips, b);
    }));

    renderBetPhase();
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  function markActive(group, active) {
    group.forEach(b => b.classList.toggle("active", b === active));
  }

  function cardHTML(card, faceDown = false) {
    const div = document.createElement("div");
    if (faceDown) {
      div.className = "bj-card face-down";
      return div;
    }
    const red = RED_S.has(card.suit);
    div.className = `bj-card${red ? " red-card" : ""}`;
    div.innerHTML = `<span>${card.rank}</span><span class="card-suit">${card.suit}</span>`;
    return div;
  }

  function renderHands(revealDealer = false) {
    el.dealerCards.innerHTML = "";
    el.playerCards.innerHTML = "";

    dealerHand.forEach((c, i) => {
      el.dealerCards.appendChild(cardHTML(c, i === 1 && !revealDealer));
    });
    playerHand.forEach(c => el.playerCards.appendChild(cardHTML(c)));

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
    el.btnRow.innerHTML = `<button class="action-btn bj-action" id="bj-deal-btn">DEAL</button>`;
    document.getElementById("bj-deal-btn").addEventListener("click", deal);
    markActive(el.chips, el.chips.find(b => Number(b.dataset.chip) === chip));
  }

  function renderPlayerPhase() {
    const pTotal = handTotal(playerHand);
    const canDouble = window.Casino.getBalance() >= chip;
    el.btnRow.innerHTML = `
      <button class="action-btn bj-action" id="bj-hit">HIT</button>
      <button class="action-btn bj-action secondary" id="bj-stand">STAND</button>
      ${canDouble ? `<button class="action-btn bj-action secondary" id="bj-double">2×</button>` : ""}
    `;
    document.getElementById("bj-hit").addEventListener("click", hit);
    document.getElementById("bj-stand").addEventListener("click", stand);
    if (canDouble) document.getElementById("bj-double").addEventListener("click", doubleDown);
    setMessage("");
  }

  function renderDone() {
    phase = "done";
    setTimeout(() => {
      el.btnRow.innerHTML = `<button class="action-btn bj-action" id="bj-deal-btn">DEAL AGAIN</button>`;
      document.getElementById("bj-deal-btn").addEventListener("click", deal);
    }, 1400);
  }

  // ── game logic ────────────────────────────────────────────────────────────
  function drawCard() {
    if (deck.length < 30) deck = shuffle(buildDeck());
    return deck.pop();
  }

  function deal() {
    const bal = window.Casino.getBalance();
    if (bal < chip) { setMessage("Not enough credits!", "lose"); return; }

    window.Casino.adjustBalance(-chip);

    playerHand = [drawCard(), drawCard()];
    dealerHand = [drawCard(), drawCard()];

    renderHands(false);
    setMessage("");

    const pTotal = handTotal(playerHand);
    const dTotal = handTotal(dealerHand);

    if (pTotal === 21) {
      if (dTotal === 21) { endRound("push"); return; }
      endRound("blackjack"); return;
    }

    phase = "player";
    renderPlayerPhase();
  }

  function hit() {
    if (phase !== "player") return;
    playerHand.push(drawCard());
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
    chip *= 2; // double the stake
    playerHand.push(drawCard());
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
        renderHands(true);
        setTimeout(step, 420);
      } else {
        const pTotal = handTotal(playerHand);
        if      (dTotal > 21)        endRound("win");
        else if (pTotal > dTotal)    endRound("win");
        else if (pTotal === dTotal)  endRound("push");
        else                         endRound("lose");
      }
    }
    setTimeout(step, 320);
  }

  function endRound(outcome) {
    renderHands(true);
    const pTotal = handTotal(playerHand);
    let payout = 0, event = "";

    switch (outcome) {
      case "blackjack":
        payout = Math.floor(chip * 2.5); // 3:2 payout
        setMessage("Blackjack! 🎉", "bj");
        event = "BLACKJACK";
        break;
      case "win":
        payout = chip * 2;
        setMessage("You win!", "win");
        event = "WIN";
        break;
      case "push":
        payout = chip;
        setMessage("Push — tie", "push");
        event = "PUSH";
        break;
      case "bust":
        setMessage("Bust! Over 21", "lose");
        event = "BUST";
        break;
      case "lose":
        setMessage("Dealer wins", "lose");
        event = "LOSE";
        break;
    }

    const newBal = window.Casino.adjustBalance(payout);
    const net    = payout - chip;

    bus && bus.emit("blackjack:event", {
      type: event,
      payload: { net, chip, pTotal, balance: newBal },
    });

    // Reset chip if doubled
    if (chip % 2 !== 0) {/* leave as is */} else { /* normal chip stays */ }
    // Restore chip if it was doubled (2× bet)
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
