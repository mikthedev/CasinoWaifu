/**
 * sports.js — Tennis Sports Betting (Wimbledon 2025, dummy)
 *
 * Public API on window.Sports:
 *   Sports.handleBetIntent()       — called when user says "bet" to Yuki anywhere
 *   Sports.handleBestPlayerIntent()— called when on sports page + user asks for best pick
 *   Sports.handleConfirmIntent()   — called when user says yes/confirm while awaiting
 */
(function () {
  const bus = window.EventBus;

  // ── Dummy Wimbledon 2025 data ──────────────────────────────────────────────
  // Players: real current top ATP players as of mid-2025
  const MATCHES = [
    {
      id: "wim_sf1",
      tournament: "Wimbledon",
      round: "Semi-Final",
      surface: "Grass",
      status: "live",
      time: null,
      score: "1-0 (6-4)",
      players: [
        {
          id: "alcaraz",
          name: "C. Alcaraz",
          fullName: "Carlos Alcaraz",
          flag: "🇪🇸",
          rank: 3,
          form: [1, 1, 1, 1, 0],
          baseOdds: 1.72,
          odds: 1.72,
          perf: 78,
        },
        {
          id: "djokovic",
          name: "N. Djokovic",
          fullName: "Novak Djokovic",
          flag: "🇷🇸",
          rank: 6,
          form: [1, 1, 0, 1, 1],
          baseOdds: 2.15,
          odds: 2.15,
          perf: 68,
        },
      ],
    },
    {
      id: "wim_sf2",
      tournament: "Wimbledon",
      round: "Semi-Final",
      surface: "Grass",
      status: "upcoming",
      time: "Today, 17:30",
      score: null,
      players: [
        {
          id: "sinner",
          name: "J. Sinner",
          fullName: "Jannik Sinner",
          flag: "🇮🇹",
          rank: 1,
          form: [1, 1, 1, 0, 1],
          baseOdds: 1.58,
          odds: 1.58,
          perf: 85,
        },
        {
          id: "zverev",
          name: "A. Zverev",
          fullName: "Alexander Zverev",
          flag: "🇩🇪",
          rank: 2,
          form: [1, 0, 1, 1, 1],
          baseOdds: 2.40,
          odds: 2.40,
          perf: 65,
        },
      ],
    },
    {
      id: "wim_qf3",
      tournament: "Wimbledon",
      round: "Quarter-Final",
      surface: "Grass",
      status: "upcoming",
      time: "Today, 13:00",
      score: null,
      players: [
        {
          id: "fritz",
          name: "T. Fritz",
          fullName: "Taylor Fritz",
          flag: "🇺🇸",
          rank: 4,
          form: [1, 1, 0, 1, 0],
          baseOdds: 2.80,
          odds: 2.80,
          perf: 58,
        },
        {
          id: "medvedev",
          name: "D. Medvedev",
          fullName: "Daniil Medvedev",
          flag: "🇷🇺",
          rank: 5,
          form: [0, 1, 1, 0, 1],
          baseOdds: 1.45,
          odds: 1.45,
          perf: 72,
        },
      ],
    },
    {
      id: "wim_qf4",
      tournament: "Wimbledon",
      round: "Quarter-Final",
      surface: "Grass",
      status: "upcoming",
      time: "Yesterday, 19:00",
      score: null,
      players: [
        {
          id: "rune",
          name: "H. Rune",
          fullName: "Holger Rune",
          flag: "🇩🇰",
          rank: 15,
          form: [1, 0, 1, 1, 0],
          baseOdds: 2.20,
          odds: 2.20,
          perf: 55,
        },
        {
          id: "shelton",
          name: "B. Shelton",
          fullName: "Ben Shelton",
          flag: "🇺🇸",
          rank: 14,
          form: [0, 1, 0, 1, 1],
          baseOdds: 1.70,
          odds: 1.70,
          perf: 60,
        },
      ],
    },
  ];

  // ── State ──────────────────────────────────────────────────────────────────
  let selectedMatchId = null;
  let selectedPlayerId = null;
  let selectedChip = 25;
  let oddsTickInterval = null;

  // Yuki-guided flow states
  let yukiFlowState = "idle"; // idle | awaiting_sports_confirm | awaiting_pick_confirm
  let yukiPendingMatch = null;
  let yukiPendingPlayer = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────
  let matchesEl = null;
  let betSlipEl = null;
  let placeBtnEl = null;

  // ── Odds drift simulation ──────────────────────────────────────────────────
  function driftOdds() {
    MATCHES.forEach((m) => {
      m.players.forEach((p) => {
        const drift = (Math.random() - 0.5) * 0.06;
        const newOdds = Math.max(1.10, Math.min(9.99, p.odds + drift));
        const dir = newOdds > p.odds ? "up" : newOdds < p.odds ? "down" : "";
        p.odds = Math.round(newOdds * 100) / 100;

        // Drift perf score too
        const perfDrift = (Math.random() - 0.5) * 4;
        p.perf = Math.max(20, Math.min(98, p.perf + perfDrift));

        const btnEl = document.querySelector(
          `[data-match="${m.id}"][data-player="${p.id}"] .player-odds-val`
        );
        if (btnEl) {
          btnEl.textContent = p.odds.toFixed(2);
          btnEl.classList.remove("odds-up", "odds-down");
          if (dir) {
            btnEl.classList.add(`odds-${dir}`);
            setTimeout(() => btnEl.classList.remove(`odds-${dir}`), 1200);
          }
        }
      });

      // If this match has the current selection, refresh returns
      if (m.id === selectedMatchId) updateReturns();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    matchesEl = document.getElementById("sports-matches");
    if (!matchesEl) return;

    matchesEl.innerHTML = MATCHES.map((m) => renderMatchCard(m)).join("");

    // Bind odds buttons
    matchesEl.querySelectorAll(".player-odds-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mid = btn.dataset.match;
        const pid = btn.dataset.player;
        selectOdds(mid, pid);
      });
    });

    // Bind bet slip
    betSlipEl = document.getElementById("bet-slip");
    placeBtnEl = document.getElementById("sports-place-btn");

    document.getElementById("bet-slip-clear")?.addEventListener("click", clearSelection);
    placeBtnEl?.addEventListener("click", placeBet);

    // Chip buttons inside bet slip
    document.querySelectorAll("#sports-chips .chip-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#sports-chips .chip-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedChip = Number(btn.dataset.chip);
        updateReturns();
      });
    });
  }

  function renderMatchCard(m) {
    const [p1, p2] = m.players;
    const bestPerfPlayer = p1.perf >= p2.perf ? p1 : p2;

    const badge =
      m.status === "live"
        ? `<span class="live-badge"><span class="live-dot"></span>LIVE</span>`
        : `<span class="upcoming-badge">UPCOMING</span>`;

    const scoreOrTime =
      m.score
        ? `<span class="match-score">${m.score}</span>`
        : m.time
        ? `<span class="match-time">${m.time}</span>`
        : "";

    const sel1 = selectedMatchId === m.id && selectedPlayerId === p1.id ? " selected" : "";
    const sel2 = selectedMatchId === m.id && selectedPlayerId === p2.id ? " selected" : "";

    return `
<div class="match-card" id="card-${m.id}">
  <div class="match-header">
    <span class="match-tournament">${m.tournament} · ${m.surface}</span>
    <span class="match-round">${m.round}</span>
    ${badge}
  </div>
  <div class="match-body">
    <div class="match-players">
      <button class="player-odds-btn${sel1}" data-match="${m.id}" data-player="${p1.id}">
        ${bestPerfPlayer.id === p1.id ? '<span class="best-pick-badge">⭐ Best Pick</span>' : ""}
        <span class="player-flag">${p1.flag}</span>
        <span class="player-name">${p1.name}</span>
        <span class="player-rank">Rank #${p1.rank}</span>
        <span class="player-odds-val">${p1.odds.toFixed(2)}</span>
        <span class="player-form">${p1.form.map((w) => `<span class="form-dot ${w ? "w" : "l"}"></span>`).join("")}</span>
      </button>
      <div style="display:flex;align-items:center;flex-shrink:0;padding:0 2px">
        <span class="match-vs">VS</span>
      </div>
      <button class="player-odds-btn${sel2}" data-match="${m.id}" data-player="${p2.id}">
        ${bestPerfPlayer.id === p2.id ? '<span class="best-pick-badge">⭐ Best Pick</span>' : ""}
        <span class="player-flag">${p2.flag}</span>
        <span class="player-name">${p2.name}</span>
        <span class="player-rank">Rank #${p2.rank}</span>
        <span class="player-odds-val">${p2.odds.toFixed(2)}</span>
        <span class="player-form">${p2.form.map((w) => `<span class="form-dot ${w ? "w" : "l"}"></span>`).join("")}</span>
      </button>
    </div>
    <div class="match-footer">
      ${scoreOrTime}
    </div>
  </div>
</div>`;
  }

  // ── Selection & bet slip ───────────────────────────────────────────────────
  function selectOdds(matchId, playerId, { animate = false } = {}) {
    selectedMatchId = matchId;
    selectedPlayerId = playerId;

    // Update button states
    document.querySelectorAll(".player-odds-btn").forEach((btn) => {
      const isThis = btn.dataset.match === matchId && btn.dataset.player === playerId;
      btn.classList.toggle("selected", isThis);
      if (isThis && animate) {
        btn.classList.remove("yuki-fill");
        void btn.offsetWidth;
        btn.classList.add("yuki-fill");
      }
    });

    // Update card border
    document.querySelectorAll(".match-card").forEach((card) => {
      card.classList.toggle("has-selection", card.id === `card-${matchId}`);
    });

    updateBetSlip(matchId, playerId);
  }

  function updateBetSlip(matchId, playerId) {
    betSlipEl = betSlipEl || document.getElementById("bet-slip");
    if (!betSlipEl) return;

    const match = MATCHES.find((m) => m.id === matchId);
    const player = match?.players.find((p) => p.id === playerId);
    if (!match || !player) return;

    const opponent = match.players.find((p) => p.id !== playerId);
    const selEl = document.getElementById("bet-slip-selection");
    if (selEl) {
      selEl.innerHTML = `
        <div class="bet-slip-player">${player.flag} ${player.fullName}</div>
        <div class="bet-slip-match">${match.tournament} ${match.round} vs ${opponent?.fullName || ""}</div>
        <div class="bet-slip-odds">Odds: ${player.odds.toFixed(2)}</div>
      `;
    }

    updateReturns();
    betSlipEl.classList.add("open");
    if (placeBtnEl) placeBtnEl.disabled = false;
  }

  function updateReturns() {
    const match = MATCHES.find((m) => m.id === selectedMatchId);
    const player = match?.players.find((p) => p.id === selectedPlayerId);
    const retEl = document.getElementById("bet-returns");
    if (!retEl || !player) return;
    const ret = (selectedChip * player.odds).toFixed(2);
    retEl.textContent = ret;
  }

  function clearSelection() {
    selectedMatchId = null;
    selectedPlayerId = null;

    document.querySelectorAll(".player-odds-btn").forEach((b) => b.classList.remove("selected"));
    document.querySelectorAll(".match-card").forEach((c) => c.classList.remove("has-selection"));

    betSlipEl = betSlipEl || document.getElementById("bet-slip");
    if (betSlipEl) betSlipEl.classList.remove("open");
    if (placeBtnEl) placeBtnEl.disabled = true;
  }

  function placeBet() {
    if (!selectedMatchId || !selectedPlayerId) return;
    const balance = window.Casino?.getBalance?.() ?? 0;
    if (balance < selectedChip) {
      showFlashMsg("Not enough balance!", "lose");
      return;
    }

    const match = MATCHES.find((m) => m.id === selectedMatchId);
    const player = match?.players.find((p) => p.id === selectedPlayerId);
    if (!match || !player) return;

    window.Casino?.adjustBalance(-selectedChip);

    // Fake result: coin flip weighted by odds (lower odds = more likely to win)
    const winChance = 1 / player.odds;
    const won = Math.random() < winChance;
    const net = won ? Math.round(selectedChip * player.odds * 100) / 100 - selectedChip : -selectedChip;

    if (won) {
      window.Casino?.adjustBalance(Math.round(selectedChip * player.odds * 100) / 100);
      showFlashMsg(`+${net.toFixed(0)} 🎾 ${player.fullName} wins!`, "win");
      bus?.emit("sports:event", { type: "WIN", payload: { net, player: player.fullName, odds: player.odds } });
    } else {
      showFlashMsg(`-${selectedChip} ${player.fullName} lost 😔`, "lose");
      bus?.emit("sports:event", { type: "LOSE", payload: { chip: selectedChip, player: player.fullName } });
    }

    clearSelection();
    yukiFlowState = "idle";
  }

  function showFlashMsg(text, type) {
    let msgEl = document.getElementById("sports-flash");
    if (!msgEl) {
      msgEl = document.createElement("div");
      msgEl.id = "sports-flash";
      msgEl.style.cssText =
        "position:fixed;top:60px;left:50%;transform:translateX(-50%);padding:10px 20px;" +
        "border-radius:12px;font-size:13px;font-weight:800;z-index:999;" +
        "pointer-events:none;transition:opacity 0.4s;";
      document.body.appendChild(msgEl);
    }
    msgEl.textContent = text;
    msgEl.style.background = type === "win" ? "rgba(52,211,153,0.9)" : "rgba(239,68,68,0.85)";
    msgEl.style.color = "#fff";
    msgEl.style.opacity = "1";
    clearTimeout(msgEl._timer);
    msgEl._timer = setTimeout(() => { msgEl.style.opacity = "0"; }, 2800);
  }

  // ── Best player logic ──────────────────────────────────────────────────────
  function getBestPlayer() {
    let best = null;
    let bestScore = -1;
    MATCHES.forEach((m) => {
      m.players.forEach((p) => {
        if (p.perf > bestScore) {
          bestScore = p.perf;
          best = { match: m, player: p };
        }
      });
    });
    return best;
  }

  // ── Yuki voice flow ────────────────────────────────────────────────────────

  /** User said something with "bet" intent while not on sports page */
  function handleBetIntent() {
    if (yukiFlowState !== "idle") return;

    // Navigate to sports
    navigateToSports();

    // Inject context for Yuki to speak
    window.Voice?.sendContext?.(
      "System: The player wants to place a sports bet. You just took them to the Sports Betting section showing live Wimbledon tennis matches. Greet them briefly and tell them to pick a match or ask you for a recommendation."
    );

    yukiFlowState = "idle"; // let them explore; next intent triggers best-pick
  }

  /** User said something like "who should I bet on" / "best player" on sports page */
  function handleBestPlayerIntent() {
    const best = getBestPlayer();
    if (!best) return;

    const { match, player } = best;
    const opponent = match.players.find((p) => p.id !== player.id);
    yukiPendingMatch = match;
    yukiPendingPlayer = player;
    yukiFlowState = "awaiting_pick_confirm";

    // Show Yuki suggestion banner in the match card
    showSuggestionBanner(match, player, opponent);

    // Yuki speaks the recommendation
    window.Voice?.sendContext?.(
      `System: The player asked for the best tennis pick. Based on current performance and odds, the best bet right now is ${player.fullName} (${player.flag} Rank #${player.rank}, perf score ${Math.round(player.perf)}%) to beat ${opponent?.fullName || "their opponent"} in the ${match.tournament} ${match.round}. Odds: ${player.odds.toFixed(2)}. Recommend this to the player and ask if they'd like you to fill in the bet slip for them.`
    );
  }

  /** User confirms the Yuki suggestion */
  function handleConfirmIntent() {
    if (yukiFlowState !== "awaiting_pick_confirm" || !yukiPendingMatch || !yukiPendingPlayer) return;

    removeSuggestionBanner();
    autofillBet(yukiPendingMatch.id, yukiPendingPlayer.id, selectedChip);

    yukiFlowState = "idle";
    yukiPendingMatch = null;
    yukiPendingPlayer = null;
  }

  function autofillBet(matchId, playerId, amount) {
    // Scroll match into view
    const card = document.getElementById(`card-${matchId}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Pulse the card
    setTimeout(() => {
      card?.classList.add("yuki-highlight");
      setTimeout(() => card?.classList.remove("yuki-highlight"), 1200);
    }, 200);

    // Animate odds button fill after slight delay
    setTimeout(() => {
      selectOdds(matchId, playerId, { animate: true });
    }, 500);

    // Select chip
    setTimeout(() => {
      document.querySelectorAll("#sports-chips .chip-pill").forEach((b) => {
        const isMatch = Number(b.dataset.chip) === amount;
        b.classList.toggle("active", isMatch);
        if (isMatch) selectedChip = amount;
      });
      updateReturns();
    }, 900);

    // Notify Yuki to confirm the fill
    setTimeout(() => {
      window.Voice?.sendContext?.(
        `System: You just automatically filled out the bet slip for ${playerId} at ${matchId} with a ${amount} chip bet. Tell the player the form is ready and they just need to tap PLACE BET to confirm — you can't click it for them.`
      );
    }, 1100);
  }

  // ── Suggestion banner ──────────────────────────────────────────────────────
  function showSuggestionBanner(match, player, opponent) {
    removeSuggestionBanner();
    const card = document.getElementById(`card-${match.id}`);
    if (!card) return;

    card.style.position = "relative";
    const banner = document.createElement("div");
    banner.className = "yuki-suggest-banner";
    banner.id = "yuki-suggest-banner";
    banner.innerHTML = `
      <span class="suggest-text">✦ Yuki suggests: <strong>${player.fullName}</strong> (${player.odds.toFixed(2)}×)</span>
      <button class="suggest-confirm" id="suggest-yes-btn">Yes, fill it!</button>
      <button class="suggest-dismiss" id="suggest-no-btn">✕</button>
    `;
    card.appendChild(banner);
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });

    document.getElementById("suggest-yes-btn")?.addEventListener("click", () => {
      handleConfirmIntent();
    });
    document.getElementById("suggest-no-btn")?.addEventListener("click", () => {
      removeSuggestionBanner();
      yukiFlowState = "idle";
      yukiPendingMatch = null;
      yukiPendingPlayer = null;
    });
  }

  function removeSuggestionBanner() {
    document.getElementById("yuki-suggest-banner")?.remove();
  }

  // ── Navigation helper ──────────────────────────────────────────────────────
  function navigateToSports() {
    if (window.Casino?.activeGame !== "sports") {
      window.Casino?.goTo?.("sports", "right");
    }
  }

  // ── Game screen lifecycle ──────────────────────────────────────────────────
  function onEnterSports() {
    if (!matchesEl) render();
    if (!oddsTickInterval) {
      oddsTickInterval = setInterval(driftOdds, 9000);
    }
  }

  function onLeaveSports() {
    clearInterval(oddsTickInterval);
    oddsTickInterval = null;
    removeSuggestionBanner();
  }

  // ── Bus wiring ─────────────────────────────────────────────────────────────
  bus?.on("casino:game", ({ game, prev }) => {
    if (game === "sports") onEnterSports();
    if (prev === "sports") onLeaveSports();
  });

  // React to sports bets for Yuki
  bus?.on("sports:event", ({ type, payload }) => {
    const reactions = {
      WIN:  { emotion: "excited", line: `${payload.player} won! 🎾` },
      LOSE: { emotion: "worried", line: "Unlucky…" },
    };
    const r = reactions[type];
    if (!r) return;
    const reaction = window.Character?.reactToOutcome?.(type === "WIN" ? "WIN" : "LOSE", payload);
    if (reaction) {
      bus.emit("widget:reaction", { reaction, type, payload });
    }
    window.Voice?.notifyGameEvent?.(
      type === "WIN" ? "WIN" : "LOSE",
      { amount: payload.net || payload.chip, color: "tennis", number: payload.player }
    );
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Render if sports screen is already active (unlikely on first load, but safe)
    if (window.Casino?.activeGame === "sports") onEnterSports();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.Sports = {
    handleBetIntent,
    handleBestPlayerIntent,
    handleConfirmIntent,
    autofillBet,
    navigateToSports,
    getBestPlayer,
    get flowState() { return yukiFlowState; },
  };
})();
