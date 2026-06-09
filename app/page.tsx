'use client';

import { useState, useCallback, useRef, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import PerformancePanel from './components/PerformancePanel';
import HelpModal from './components/HelpModal';
import type { GameCanvasHandle } from './components/GameCanvas';

const GameCanvas = dynamic(() => import('./components/GameCanvas'), { ssr: false });

const RED_NUMS = new Set([32, 19, 21, 25, 34, 27, 36, 30, 23, 5, 16, 1, 14, 9, 18, 7, 12, 3]);

type BetColor = 'red' | 'black' | 'green';
type Phase    = 'betting' | 'no-more-bets' | 'spinning' | 'result';

interface HistoryEntry { num: string; color: 'red' | 'black' | 'green' }

const CHIPS: number[] = [5, 10, 25, 50];

const BET_ZONES: { color: BetColor; label: string; sub: string; mult: string; bg: string; activeBorder: string }[] = [
  { color: 'red',   label: '● Red',    sub: '18 numbers', mult: '2×',  bg: 'bg-red-900/50',   activeBorder: 'border-red-400   shadow-[0_0_14px_rgba(239,68,68,0.35)]'   },
  { color: 'black', label: '● Black',  sub: '18 numbers', mult: '2×',  bg: 'bg-zinc-800/60',  activeBorder: 'border-zinc-300  shadow-[0_0_14px_rgba(200,200,200,0.2)]'  },
  { color: 'green', label: '◆ 0',      sub: 'Green only', mult: '35×', bg: 'bg-green-900/50', activeBorder: 'border-green-400 shadow-[0_0_14px_rgba(74,222,128,0.35)]'  },
];

export default function Home() {
  const [balance,   setBalance]   = useState(1000);
  const [bet,       setBet]       = useState(10);
  const [betColor,  setBetColor]  = useState<BetColor>('red');
  const [phase,     setPhase]     = useState<Phase>('betting');
  const [result,    setResult]    = useState<{ num: string; color: 'red' | 'black' | 'green'; win: number } | null>(null);
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [showHelp,  setShowHelp]  = useState(false);
  const [fps,       setFps]       = useState(60);
  const [objects,   setObjects]   = useState(0);

  const canvasHandle = useRef<GameCanvasHandle | null>(null) as RefObject<GameCanvasHandle | null>;

  const handleSpinDone = useCallback((num: string, color: BetColor) => {
    const n        = parseInt(num, 10);
    const numColor: 'red' | 'black' | 'green' = n === 0 ? 'green' : RED_NUMS.has(n) ? 'red' : 'black';
    const won      = numColor === color;
    const mult     = color === 'green' ? 35 : 2;
    const winAmt   = won ? bet * mult : 0;

    if (winAmt > 0) setBalance(b => b + winAmt);
    setHistory(h => [{ num, color: numColor }, ...h].slice(0, 12));
    setResult({ num, color: numColor, win: winAmt });
    setPhase('result');

    setTimeout(() => setPhase('betting'), 3200);
  }, [bet]);

  const handleSpin = useCallback(() => {
    if (phase !== 'betting' || balance < bet) return;
    const snappedColor = betColor; // capture before state update

    setBalance(b => b - bet);
    setResult(null);
    setPhase('no-more-bets');

    setTimeout(() => {
      setPhase('spinning');
      canvasHandle.current?.spin((num) => handleSpinDone(num, snappedColor));
    }, 700);
  }, [phase, balance, bet, betColor, handleSpinDone]);

  const handleReset = useCallback(() => {
    if (phase === 'spinning' || phase === 'no-more-bets') return;
    setBalance(1000);
    setBet(10);
    setBetColor('red');
    setResult(null);
    setPhase('betting');
  }, [phase]);

  const onFpsUpdate    = useCallback((f: number) => setFps(f), []);
  const onObjectCount  = useCallback((n: number) => setObjects(n), []);

  const isBusy  = phase === 'spinning' || phase === 'no-more-bets';
  const canSpin = phase === 'betting' && balance >= bet;

  return (
    <div className="min-h-screen bg-[#060e1a] flex flex-col items-center justify-center px-3 py-5 select-none">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="w-full max-w-xl mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500 text-lg">◆</span>
          <h1 className="text-white font-bold tracking-[0.15em] uppercase text-sm">Royal Roulette</h1>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/80 text-xs border border-white/15 hover:border-white/30 rounded-full px-3 py-1 transition-colors"
        >
          <span className="text-base leading-none">?</span>
          <span>Help</span>
        </button>
      </header>

      {/* ── History strip ──────────────────────────────────────────────── */}
      <div className="w-full max-w-xl mb-3 flex items-center gap-1.5 min-h-7 flex-wrap">
        {history.length === 0 ? (
          <span className="text-white/20 text-xs italic">No results yet — spin to start</span>
        ) : (
          history.map((h, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0
                ${h.color === 'red'   ? 'bg-red-700 ring-1 ring-red-500/60'
                : h.color === 'green' ? 'bg-green-700 ring-1 ring-green-500/60'
                :                       'bg-zinc-700 ring-1 ring-zinc-500/60'}`}
            >
              {h.num}
            </div>
          ))
        )}
      </div>

      {/* ── Main card ──────────────────────────────────────────────────── */}
      <div className="w-full max-w-xl bg-[#0a1628] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

        {/* Canvas */}
        <div className="relative" style={{ height: 360 }}>
          <GameCanvas
            onFpsUpdate={onFpsUpdate}
            onObjectCount={onObjectCount}
            canvasRef={canvasHandle}
          />
          <PerformancePanel fps={fps} objectCount={objects} />

          {/* No More Bets overlay */}
          {phase === 'no-more-bets' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/65 border border-yellow-500/50 rounded-xl px-7 py-2.5 animate-pulse">
                <span className="text-yellow-400 font-bold tracking-[0.2em] uppercase text-sm">No More Bets</span>
              </div>
            </div>
          )}

          {/* Result overlay */}
          {phase === 'result' && result && (
            <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
              <div className={`flex flex-col items-center gap-0.5 rounded-2xl px-6 py-3 border backdrop-blur-sm bg-black/70
                ${result.win > 0 ? 'border-yellow-500/70' : 'border-white/15'}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full shrink-0
                    ${result.color === 'red' ? 'bg-red-500' : result.color === 'green' ? 'bg-green-500' : 'bg-zinc-400'}`} />
                  <span className="text-white font-bold text-3xl leading-none">{result.num}</span>
                  <span className={`text-sm font-medium capitalize
                    ${result.color === 'red' ? 'text-red-400' : result.color === 'green' ? 'text-green-400' : 'text-zinc-400'}`}>
                    {result.color}
                  </span>
                </div>
                {result.win > 0
                  ? <span className="text-green-400 font-bold text-sm">+€{result.win} Won!</span>
                  : <span className="text-white/35 text-xs">Better luck next time</span>
                }
              </div>
            </div>
          )}
        </div>

        {/* ── Betting controls ────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-3 border-t border-white/10 space-y-3">

          {/* Color bet zones */}
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">Bet on</p>
            <div className="grid grid-cols-3 gap-2">
              {BET_ZONES.map(({ color, label, sub, mult, bg, activeBorder }) => (
                <button
                  key={color}
                  disabled={isBusy}
                  onClick={() => setBetColor(color)}
                  className={`py-3 px-2 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95
                    ${bg}
                    ${betColor === color ? activeBorder : 'border-white/10 hover:border-white/25'}
                    disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}
                >
                  <div className={betColor === color ? 'text-white' : 'text-white/60'}>{label}</div>
                  <div className="text-[10px] font-normal mt-0.5 text-white/35">{sub}</div>
                  <div className={`text-xs font-bold mt-0.5 ${betColor === color ? 'text-yellow-400' : 'text-white/30'}`}>{mult}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chip selector */}
          <div>
            <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">Chip</p>
            <div className="flex gap-2">
              {CHIPS.map((amount) => (
                <button
                  key={amount}
                  disabled={isBusy || balance < amount}
                  onClick={() => setBet(amount)}
                  className={`flex-1 py-2 rounded-full text-sm font-bold border transition-all active:scale-95
                    ${bet === amount
                      ? 'bg-yellow-500 text-black border-yellow-400'
                      : 'bg-transparent text-white/55 border-white/20 hover:border-yellow-400/40 hover:text-white/80'}
                    disabled:opacity-25 disabled:cursor-not-allowed disabled:active:scale-100`}
                >
                  €{amount}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom action bar ───────────────────────────────────────── */}
        <div className="px-4 py-3 bg-black/25 border-t border-white/10 flex items-center gap-3">
          {/* Balance */}
          <div className="flex-1">
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Balance</p>
            <p className="text-yellow-400 font-bold text-xl leading-tight">€{balance.toLocaleString()}</p>
          </div>

          {/* Spin */}
          <button
            onClick={handleSpin}
            disabled={!canSpin}
            className="px-8 py-3.5 rounded-xl font-bold text-base tracking-wider transition-all active:scale-95
              bg-linear-to-br from-yellow-500 to-amber-700 text-black
              hover:from-yellow-400 hover:to-amber-600
              shadow-lg shadow-amber-900/40
              disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isBusy ? 'Spinning…' : 'SPIN'}
          </button>

          {/* Bet + reset */}
          <div className="flex-1 text-right">
            <p className="text-white/30 text-[10px] uppercase tracking-widest">Bet</p>
            <p className="text-white font-semibold">€{bet}</p>
            <button
              onClick={handleReset}
              disabled={isBusy}
              className="text-white/25 text-[10px] hover:text-white/50 transition-colors disabled:opacity-20 mt-0.5"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-4 text-white/15 text-xs text-center">
        Game UI prototype · No real money · React + PixiJS v8
      </p>

      {/* Help modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
