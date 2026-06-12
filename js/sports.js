/**
 * sports.js — Multi-tournament Tennis Sports Betting
 *
 * Public API on window.Sports:
 *   Sports.handleBetIntent()
 *   Sports.handleBestPlayerIntent()
 *   Sports.handleNamedPlayerIntent(matchId, playerId)
 *   Sports.handleConfirmIntent()
 */
(function () {
  const bus = window.EventBus;

  // ── Match data ──────────────────────────────────────────────────────────────
  const MATCHES = [
    // ── Wimbledon 2025 ──────────────────────────────────────────────────────
    {
      id: "wim_sf1",
      tournament: "Wimbledon",
      round: "Semi-Final",
      surface: "Grass",
      status: "live",
      time: null,
      score: "2-1 (7-5, 4-6, 3-2)",
      stats: { p1: { aces: 12, firstServe: 71, breakPts: 3 }, p2: { aces: 8, firstServe: 64, breakPts: 1 } },
      players: [
        { id: "alcaraz",  name: "C. Alcaraz",  fullName: "Carlos Alcaraz",    flag: "🇪🇸", rank: 3, form: [1,1,1,1,0], baseOdds: 1.72, odds: 1.72, perf: 78 },
        { id: "djokovic", name: "N. Djokovic", fullName: "Novak Djokovic",    flag: "🇷🇸", rank: 6, form: [1,1,0,1,1], baseOdds: 2.15, odds: 2.15, perf: 68 },
      ],
    },
    {
      id: "wim_sf2",
      tournament: "Wimbledon",
      round: "Semi-Final",
      surface: "Grass",
      status: "live",
      time: null,
      score: "1-1 (6-3, 4-6, 0-0)",
      stats: { p1: { aces: 14, firstServe: 68, breakPts: 2 }, p2: { aces: 5, firstServe: 73, breakPts: 4 } },
      players: [
        { id: "sinner",  name: "J. Sinner",  fullName: "Jannik Sinner",      flag: "🇮🇹", rank: 1, form: [1,1,1,0,1], baseOdds: 1.58, odds: 1.58, perf: 85 },
        { id: "zverev",  name: "A. Zverev",  fullName: "Alexander Zverev",   flag: "🇩🇪", rank: 2, form: [1,0,1,1,1], baseOdds: 2.40, odds: 2.40, perf: 65 },
      ],
    },
    {
      id: "wim_qf1",
      tournament: "Wimbledon",
      round: "Quarter-Final",
      surface: "Grass",
      status: "upcoming",
      time: "Today, 13:00",
      score: null,
      stats: null,
      players: [
        { id: "fritz",    name: "T. Fritz",   fullName: "Taylor Fritz",       flag: "🇺🇸", rank: 4, form: [1,1,0,1,0], baseOdds: 2.80, odds: 2.80, perf: 58 },
        { id: "medvedev", name: "D. Medvedev",fullName: "Daniil Medvedev",    flag: "🇷🇺", rank: 5, form: [0,1,1,0,1], baseOdds: 1.45, odds: 1.45, perf: 72 },
      ],
    },
    {
      id: "wim_qf2",
      tournament: "Wimbledon",
      round: "Quarter-Final",
      surface: "Grass",
      status: "upcoming",
      time: "Today, 15:30",
      score: null,
      stats: null,
      players: [
        { id: "rune",    name: "H. Rune",    fullName: "Holger Rune",         flag: "🇩🇰", rank: 15, form: [1,0,1,1,0], baseOdds: 2.20, odds: 2.20, perf: 55 },
        { id: "shelton", name: "B. Shelton", fullName: "Ben Shelton",          flag: "🇺🇸", rank: 14, form: [0,1,0,1,1], baseOdds: 1.70, odds: 1.70, perf: 60 },
      ],
    },

    // ── ATP 1000 Cincinnati ──────────────────────────────────────────────────
    {
      id: "cin_qf1",
      tournament: "Cincinnati",
      round: "Quarter-Final",
      surface: "Hard",
      status: "live",
      time: null,
      score: "1-0 (6-4, 3-3*)",
      stats: { p1: { aces: 6, firstServe: 62, breakPts: 2 }, p2: { aces: 9, firstServe: 70, breakPts: 1 } },
      players: [
        { id: "tsitsipas",  name: "S. Tsitsipas",  fullName: "Stefanos Tsitsipas", flag: "🇬🇷", rank: 9,  form: [0,1,1,0,1], baseOdds: 2.10, odds: 2.10, perf: 62 },
        { id: "deminaur",   name: "A. de Minaur",  fullName: "Alex de Minaur",    flag: "🇦🇺", rank: 8,  form: [1,1,0,1,1], baseOdds: 1.80, odds: 1.80, perf: 69 },
      ],
    },
    {
      id: "cin_qf2",
      tournament: "Cincinnati",
      round: "Quarter-Final",
      surface: "Hard",
      status: "upcoming",
      time: "Tomorrow, 18:00",
      score: null,
      stats: null,
      players: [
        { id: "rublev", name: "A. Rublev", fullName: "Andrey Rublev",           flag: "🇷🇺", rank: 7,  form: [1,0,1,1,0], baseOdds: 1.90, odds: 1.90, perf: 66 },
        { id: "draper", name: "J. Draper", fullName: "Jack Draper",             flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rank: 12, form: [1,1,1,0,1], baseOdds: 2.00, odds: 2.00, perf: 71 },
      ],
    },
    {
      id: "cin_qf3",
      tournament: "Cincinnati",
      round: "Quarter-Final",
      surface: "Hard",
      status: "upcoming",
      time: "Tomorrow, 20:30",
      score: null,
      stats: null,
      players: [
        { id: "tiafoe",  name: "F. Tiafoe", fullName: "Frances Tiafoe",        flag: "🇺🇸", rank: 18, form: [0,1,1,0,1], baseOdds: 3.20, odds: 3.20, perf: 48 },
        { id: "musetti", name: "L. Musetti", fullName: "Lorenzo Musetti",      flag: "🇮🇹", rank: 16, form: [1,1,0,0,1], baseOdds: 1.35, odds: 1.35, perf: 74 },
      ],
    },

    // ── Davis Cup ────────────────────────────────────────────────────────────
    {
      id: "dc_r1",
      tournament: "Davis Cup",
      round: "Group Stage",
      surface: "Clay",
      status: "upcoming",
      time: "Fri, 14:00",
      score: null,
      stats: null,
      players: [
        { id: "norrie",   name: "C. Norrie",  fullName: "Cameron Norrie",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rank: 22, form: [1,0,1,0,1], baseOdds: 2.60, odds: 2.60, perf: 50 },
        { id: "hurkacz",  name: "H. Hurkacz", fullName: "Hubert Hurkacz",      flag: "🇵🇱", rank: 10, form: [1,1,0,1,1], baseOdds: 1.52, odds: 1.52, perf: 73 },
      ],
    },
  ];

  // ── State ────────────────────────────────────────────────────────────────────
  let selectedMatchId  = null;
  let selectedPlayerId = null;
  let selectedChip     = 25;
  let activeTournament = "all";
  let activeBetType    = "winner"; // winner | handicap | ou
  let oddsTickInterval = null;

  let yukiFlowState   = "idle";
  let yukiPendingMatch  = null;
  let yukiPendingPlayer = null;

  let matchesEl = null;
  let betSlipEl = null;
  let placeBtnEl = null;

  // ── Odds drift ───────────────────────────────────────────────────────────────
  function driftOdds() {
    MATCHES.forEach(m => {
      // Also drift live stats for live matches
      if (m.status === "live" && m.stats) {
        m.stats.p1.aces     = Math.max(0, m.stats.p1.aces + (Math.random() > 0.7 ? 1 : 0));
        m.stats.p1.firstServe = Math.min(85, Math.max(50, m.stats.p1.firstServe + Math.round((Math.random()-0.5)*3)));
        m.stats.p2.aces     = Math.max(0, m.stats.p2.aces + (Math.random() > 0.7 ? 1 : 0));
        m.stats.p2.firstServe = Math.min(85, Math.max(50, m.stats.p2.firstServe + Math.round((Math.random()-0.5)*3)));

        // Update stats row if rendered
        const statsRow = document.querySelector(`#card-${m.id} .match-live-stats`);
        if (statsRow) {
          statsRow.innerHTML = buildStatsRowHTML(m);
        }
      }

      m.players.forEach(p => {
        const drift  = (Math.random() - 0.5) * 0.06;
        const newOdds = Math.max(1.10, Math.min(9.99, p.odds + drift));
        const dir    = newOdds > p.odds ? "up" : newOdds < p.odds ? "down" : "";
        p.odds = Math.round(newOdds * 100) / 100;

        const perfDrift = (Math.random() - 0.5) * 4;
        p.perf = Math.max(20, Math.min(98, p.perf + perfDrift));

        const btnEl = document.querySelector(`[data-match="${m.id}"][data-player="${p.id}"] .player-odds-val`);
        if (btnEl) {
          btnEl.textContent = p.odds.toFixed(2);
          btnEl.classList.remove("odds-up", "odds-down");
          if (dir) {
            btnEl.classList.add(`odds-${dir}`);
            setTimeout(() => btnEl.classList.remove(`odds-${dir}`), 1200);
          }
        }
      });

      if (m.id === selectedMatchId) updateReturns();
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    matchesEl = document.getElementById("sports-matches");
    if (!matchesEl) return;

    renderTournamentTabs();
    renderMatches();
    bindBetSlip();
    updateBetTypeUI();
  }

  function renderTournamentTabs() {
    const tabsEl = document.getElementById("sports-tournament-tabs");
    if (!tabsEl) return;
    const tournaments = ["all", ...new Set(MATCHES.map(m => m.tournament))];
    tabsEl.innerHTML = tournaments.map(t =>
      `<button class="tour-tab${t === activeTournament ? " active" : ""}" data-tour="${t}">
        ${t === "all" ? "All Tournaments" : t}
      </button>`
    ).join("");
    tabsEl.querySelectorAll(".tour-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        activeTournament = btn.dataset.tour;
        tabsEl.querySelectorAll(".tour-tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderMatches();
      });
    });
  }

  function renderMatches() {
    if (!matchesEl) return;
    const visible = activeTournament === "all"
      ? MATCHES
      : MATCHES.filter(m => m.tournament === activeTournament);
    matchesEl.innerHTML = visible.map(m => renderMatchCard(m)).join("");

    matchesEl.querySelectorAll(".player-odds-btn").forEach(btn => {
      btn.addEventListener("click", () => selectOdds(btn.dataset.match, btn.dataset.player));
    });
  }

  function buildStatsRowHTML(m) {
    const { p1, p2 } = m.stats;
    return `
      <span class="stat-item"><span class="stat-val">${p1.aces}</span><span class="stat-key">ACE</span><span class="stat-val">${p2.aces}</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item"><span class="stat-val">${p1.firstServe}%</span><span class="stat-key">1ST SRV</span><span class="stat-val">${p2.firstServe}%</span></span>
      <span class="stat-divider"></span>
      <span class="stat-item"><span class="stat-val">${p1.breakPts}</span><span class="stat-key">BRK PTS</span><span class="stat-val">${p2.breakPts}</span></span>
    `;
  }

  function renderMatchCard(m) {
    const [p1, p2] = m.players;
    const bestPerfPlayer = p1.perf >= p2.perf ? p1 : p2;

    const badge = m.status === "live"
      ? `<span class="live-badge"><span class="live-dot"></span>LIVE</span>`
      : `<span class="upcoming-badge">UPCOMING</span>`;

    const scoreOrTime = m.score
      ? `<span class="match-score">${m.score}</span>`
      : m.time
      ? `<span class="match-time">${m.time}</span>`
      : "";

    const sel1 = selectedMatchId === m.id && selectedPlayerId === p1.id ? " selected" : "";
    const sel2 = selectedMatchId === m.id && selectedPlayerId === p2.id ? " selected" : "";

    const formDots = p => p.form.map(w =>
      `<span class="form-dot ${w ? "w" : "l"}"></span>`
    ).join("");

    const perfBar = p => {
      const pct = Math.round(p.perf);
      return `<span class="perf-bar"><span class="perf-fill" style="width:${pct}%"></span></span>`;
    };

    const statsRowHTML = (m.status === "live" && m.stats)
      ? `<div class="match-live-stats">${buildStatsRowHTML(m)}</div>`
      : "";

    // Handicap / O/U odds are derived from base odds
    const p1HandicapOdds = (p1.odds * 0.72).toFixed(2);
    const p2HandicapOdds = (p2.odds * 0.72).toFixed(2);
    const ouOverOdds  = "1.85";
    const ouUnderOdds = "1.95";

    const oddsSection = activeBetType === "winner" ? `
      <button class="player-odds-btn${sel1}" data-match="${m.id}" data-player="${p1.id}">
        ${bestPerfPlayer.id === p1.id ? '<span class="best-pick-badge">⭐ Best</span>' : ""}
        <span class="player-flag">${p1.flag}</span>
        <span class="player-name">${p1.name}</span>
        <span class="player-rank">#${p1.rank}</span>
        <span class="player-odds-val">${p1.odds.toFixed(2)}</span>
        <span class="player-form">${formDots(p1)}</span>
        ${perfBar(p1)}
      </button>
      <div class="match-vs-col"><span class="match-vs">VS</span>${scoreOrTime}</div>
      <button class="player-odds-btn${sel2}" data-match="${m.id}" data-player="${p2.id}">
        ${bestPerfPlayer.id === p2.id ? '<span class="best-pick-badge">⭐ Best</span>' : ""}
        <span class="player-flag">${p2.flag}</span>
        <span class="player-name">${p2.name}</span>
        <span class="player-rank">#${p2.rank}</span>
        <span class="player-odds-val">${p2.odds.toFixed(2)}</span>
        <span class="player-form">${formDots(p2)}</span>
        ${perfBar(p2)}
      </button>
    ` : activeBetType === "handicap" ? `
      <button class="player-odds-btn handicap${sel1}" data-match="${m.id}" data-player="${p1.id}">
        <span class="player-flag">${p1.flag}</span>
        <span class="player-name">${p1.name} +1.5</span>
        <span class="player-odds-val">${p1HandicapOdds}</span>
      </button>
      <div class="match-vs-col"><span class="match-vs">HC</span></div>
      <button class="player-odds-btn handicap${sel2}" data-match="${m.id}" data-player="${p2.id}">
        <span class="player-flag">${p2.flag}</span>
        <span class="player-name">${p2.name} +1.5</span>
        <span class="player-odds-val">${p2HandicapOdds}</span>
      </button>
    ` : `
      <button class="player-odds-btn ou${sel1}" data-match="${m.id}" data-player="${p1.id}">
        <span class="player-name">Over 3.5 Sets</span>
        <span class="player-odds-val">${ouOverOdds}</span>
      </button>
      <div class="match-vs-col"><span class="match-vs">O/U</span></div>
      <button class="player-odds-btn ou${sel2}" data-match="${m.id}" data-player="${p2.id}">
        <span class="player-name">Under 3.5 Sets</span>
        <span class="player-odds-val">${ouUnderOdds}</span>
      </button>
    `;

    return `
<div class="match-card" id="card-${m.id}">
  <div class="match-header">
    <span class="match-tournament">${m.tournament} <span class="match-surface ${m.surface.toLowerCase()}">${m.surface}</span></span>
    <span class="match-round">${m.round}</span>
    ${badge}
  </div>
  <div class="match-players">${oddsSection}</div>
  ${statsRowHTML}
</div>`;
  }

  // ── Bet type tabs ─────────────────────────────────────────────────────────────
  function updateBetTypeUI() {
    const tabsEl = document.getElementById("sports-bet-type-tabs");
    if (!tabsEl) return;
    tabsEl.querySelectorAll(".bet-type-tab").forEach(b => {
      b.classList.toggle("active", b.dataset.betType === activeBetType);
    });
    tabsEl.querySelectorAll(".bet-type-tab").forEach(b => {
      b.addEventListener("click", () => {
        activeBetType = b.dataset.betType;
        updateBetTypeUI();
        renderMatches();
      });
    });
  }

  // ── Selection & bet slip ─────────────────────────────────────────────────────
  function selectOdds(matchId, playerId, { animate = false } = {}) {
    selectedMatchId  = matchId;
    selectedPlayerId = playerId;

    document.querySelectorAll(".player-odds-btn").forEach(btn => {
      const isThis = btn.dataset.match === matchId && btn.dataset.player === playerId;
      btn.classList.toggle("selected", isThis);
      if (isThis && animate) {
        btn.classList.remove("yuki-fill");
        void btn.offsetWidth;
        btn.classList.add("yuki-fill");
      }
    });
    document.querySelectorAll(".match-card").forEach(card => {
      card.classList.toggle("has-selection", card.id === `card-${matchId}`);
    });
    updateBetSlip(matchId, playerId);
  }

  function updateBetSlip(matchId, playerId) {
    betSlipEl = betSlipEl || document.getElementById("bet-slip");
    if (!betSlipEl) return;
    const match = MATCHES.find(m => m.id === matchId);
    const player = match?.players.find(p => p.id === playerId);
    if (!match || !player) return;

    const opponent = match.players.find(p => p.id !== playerId);
    const selEl = document.getElementById("bet-slip-selection");
    if (selEl) {
      selEl.innerHTML = `
        <div class="bet-slip-player">${player.flag} ${player.fullName}</div>
        <div class="bet-slip-match">${match.tournament} · ${match.round}</div>
        <div class="bet-slip-vs">vs ${opponent?.fullName || ""}</div>
        <div class="bet-slip-odds">@ <strong>${player.odds.toFixed(2)}</strong></div>
      `;
    }
    updateReturns();
    betSlipEl.classList.add("open");
    if (placeBtnEl) placeBtnEl.disabled = false;
  }

  function updateReturns() {
    const match  = MATCHES.find(m => m.id === selectedMatchId);
    const player = match?.players.find(p => p.id === selectedPlayerId);
    const retEl  = document.getElementById("bet-returns");
    if (!retEl || !player) return;
    retEl.textContent = (selectedChip * player.odds).toFixed(2);
  }

  function clearSelection() {
    selectedMatchId = selectedPlayerId = null;
    document.querySelectorAll(".player-odds-btn").forEach(b => b.classList.remove("selected"));
    document.querySelectorAll(".match-card").forEach(c => c.classList.remove("has-selection"));
    betSlipEl = betSlipEl || document.getElementById("bet-slip");
    if (betSlipEl) betSlipEl.classList.remove("open");
    if (placeBtnEl) placeBtnEl.disabled = true;
  }

  function bindBetSlip() {
    betSlipEl  = document.getElementById("bet-slip");
    placeBtnEl = document.getElementById("sports-place-btn");
    document.getElementById("bet-slip-clear")?.addEventListener("click", clearSelection);
    placeBtnEl?.addEventListener("click", placeBet);
    document.querySelectorAll("#sports-chips .chip-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#sports-chips .chip-pill").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedChip = Number(btn.dataset.chip);
        updateReturns();
      });
    });
  }

  function placeBet() {
    if (!selectedMatchId || !selectedPlayerId) return;
    const balance = window.Casino?.getBalance?.() ?? 0;
    if (balance < selectedChip) { showFlashMsg("Not enough balance!", "lose"); return; }

    const match  = MATCHES.find(m => m.id === selectedMatchId);
    const player = match?.players.find(p => p.id === selectedPlayerId);
    if (!match || !player) return;

    window.Casino?.adjustBalance(-selectedChip);

    const winChance = 1 / player.odds;
    const won = Math.random() < winChance;
    const net = won
      ? Math.round(selectedChip * player.odds * 100) / 100 - selectedChip
      : -selectedChip;

    if (won) {
      window.Casino?.adjustBalance(Math.round(selectedChip * player.odds * 100) / 100);
      showFlashMsg(`+${net.toFixed(0)} 🎾 ${player.fullName} wins!`, "win");
      bus?.emit("sports:event", { type: "WIN", payload: { net, player: player.fullName, odds: player.odds } });
    } else {
      showFlashMsg(`−${selectedChip} ${player.fullName} lost 😔`, "lose");
      bus?.emit("sports:event", { type: "LOSE", payload: { chip: selectedChip, player: player.fullName } });
    }

    clearSelection();
    yukiFlowState = "idle";
  }

  function showFlashMsg(text, type) {
    let el = document.getElementById("sports-flash");
    if (!el) {
      el = document.createElement("div");
      el.id = "sports-flash";
      el.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:12px;font-size:13px;font-weight:800;z-index:999;pointer-events:none;transition:opacity 0.4s;";
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.background = type === "win" ? "rgba(29,185,106,0.92)" : "rgba(239,68,68,0.85)";
    el.style.color = "#fff";
    el.style.opacity = "1";
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = "0"; }, 2800);
  }

  // ── Best player ──────────────────────────────────────────────────────────────
  function getBestPlayer() {
    let best = null, bestScore = -1;
    MATCHES.forEach(m => {
      m.players.forEach(p => {
        if (p.perf > bestScore) { bestScore = p.perf; best = { match: m, player: p }; }
      });
    });
    return best;
  }

  // ── Player name map ──────────────────────────────────────────────────────────
  const NAME_MAP = (() => {
    const map = {};
    MATCHES.forEach(m => {
      m.players.forEach(p => {
        [p.id, p.fullName.toLowerCase(), p.name.toLowerCase(), p.fullName.split(" ").pop().toLowerCase()]
          .forEach(tok => { map[tok] = { matchId: m.id, playerId: p.id }; });
      });
    });
    return map;
  })();

  function findPlayerByName(text) {
    for (const [key, val] of Object.entries(NAME_MAP)) {
      if (text.includes(key)) return val;
    }
    return null;
  }

  // ── Yuki voice flow ──────────────────────────────────────────────────────────
  function handleBetIntent() {
    if (yukiFlowState !== "idle") return;
    navigateToSports();
    window.Voice?.sendContext?.(
      "System: The player wants to place a sports bet. You just took them to the Sports Betting section with live Wimbledon, Cincinnati and Davis Cup tennis matches. Greet them briefly and invite them to pick a match or ask for a recommendation."
    );
    yukiFlowState = "idle";
  }

  function handleBestPlayerIntent() {
    const best = getBestPlayer();
    if (!best) return;
    const { match, player } = best;
    const opponent = match.players.find(p => p.id !== player.id);
    yukiPendingMatch  = match;
    yukiPendingPlayer = player;
    yukiFlowState = "awaiting_pick_confirm";
    showSuggestionBanner(match, player, opponent);
    window.Voice?.sendContext?.(
      `System: The player asked for the best tennis pick. Best bet right now: ${player.fullName} (${player.flag} Rank #${player.rank}, perf ${Math.round(player.perf)}%) vs ${opponent?.fullName || "opponent"} in ${match.tournament} ${match.round}. Odds: ${player.odds.toFixed(2)}. Recommend and ask if they want you to fill the bet slip.`
    );
  }

  function handleNamedPlayerIntent(matchId, playerId) {
    const match  = MATCHES.find(m => m.id === matchId);
    const player = match?.players.find(p => p.id === playerId);
    if (!match || !player) return;
    const opponent = match.players.find(p => p.id !== playerId);
    yukiPendingMatch  = match;
    yukiPendingPlayer = player;
    yukiFlowState = "awaiting_pick_confirm";
    showSuggestionBanner(match, player, opponent);
    window.Voice?.sendContext?.(
      `System: Player wants to bet on ${player.fullName} in ${match.tournament} ${match.round} vs ${opponent?.fullName || "opponent"}. Odds: ${player.odds.toFixed(2)}. Confirm with enthusiasm and ask if they want the bet slip filled.`
    );
  }

  function handleConfirmIntent() {
    if (yukiFlowState !== "awaiting_pick_confirm" || !yukiPendingMatch || !yukiPendingPlayer) return;
    removeSuggestionBanner();
    autofillBet(yukiPendingMatch.id, yukiPendingPlayer.id, selectedChip);
    yukiFlowState   = "idle";
    yukiPendingMatch  = null;
    yukiPendingPlayer = null;
  }

  function autofillBet(matchId, playerId, amount) {
    const card = document.getElementById(`card-${matchId}`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => { card?.classList.add("yuki-highlight"); setTimeout(() => card?.classList.remove("yuki-highlight"), 1200); }, 200);
    setTimeout(() => selectOdds(matchId, playerId, { animate: true }), 500);
    setTimeout(() => {
      document.querySelectorAll("#sports-chips .chip-pill").forEach(b => {
        const isMatch = Number(b.dataset.chip) === amount;
        b.classList.toggle("active", isMatch);
        if (isMatch) selectedChip = amount;
      });
      updateReturns();
    }, 900);
    setTimeout(() => {
      window.Voice?.sendContext?.(`System: Bet slip filled for ${playerId} at ${matchId}, ${amount} chip. Tell the player the form is ready and they must tap PLACE BET to confirm.`);
    }, 1100);
  }

  // ── Suggestion banner ────────────────────────────────────────────────────────
  function showSuggestionBanner(match, player, opponent) {
    removeSuggestionBanner();
    const card = document.getElementById(`card-${match.id}`);
    if (!card) return;
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
    document.getElementById("suggest-yes-btn")?.addEventListener("click", handleConfirmIntent);
    document.getElementById("suggest-no-btn")?.addEventListener("click", () => {
      removeSuggestionBanner();
      yukiFlowState = "idle";
      yukiPendingMatch = yukiPendingPlayer = null;
    });
  }

  function removeSuggestionBanner() {
    document.getElementById("yuki-suggest-banner")?.remove();
  }

  function navigateToSports() {
    if (window.Casino?.activeGame !== "sports") window.Casino?.goTo?.("sports", "right");
  }

  // ── Screen lifecycle ─────────────────────────────────────────────────────────
  function onEnterSports() {
    if (!matchesEl) render();
    if (!oddsTickInterval) oddsTickInterval = setInterval(driftOdds, 7000);
  }

  function onLeaveSports() {
    clearInterval(oddsTickInterval);
    oddsTickInterval = null;
    removeSuggestionBanner();
  }

  // ── Bus wiring ───────────────────────────────────────────────────────────────
  bus?.on("casino:game", ({ game, prev }) => {
    if (game === "sports") onEnterSports();
    if (prev === "sports") onLeaveSports();
  });

  bus?.on("sports:event", ({ type, payload }) => {
    const r = { WIN: { emotion: "excited", line: `${payload.player} won! 🎾` }, LOSE: { emotion: "worried", line: "Unlucky…" } }[type];
    if (!r) return;
    window.Character?.reactToOutcome?.(type === "WIN" ? "WIN" : "LOSE", payload);
    window.Voice?.notifyGameEvent?.(type === "WIN" ? "WIN" : "LOSE", { amount: payload.net || payload.chip, color: "tennis", number: payload.player });
  });

  function init() {
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
    handleNamedPlayerIntent,
    handleConfirmIntent,
    autofillBet,
    navigateToSports,
    getBestPlayer,
    findPlayerByName,
    get flowState() { return yukiFlowState; },
  };
})();
