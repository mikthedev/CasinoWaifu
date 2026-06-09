'use client';

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#0d1f3c] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-yellow-400 font-bold text-base tracking-wide">How to Play</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 text-sm">
          {/* Steps */}
          <section>
            <h3 className="text-white/50 text-[10px] uppercase tracking-widest mb-2">Steps</h3>
            <ol className="space-y-2">
              {[
                'Pick a chip value — €5, €10, €25, or €50.',
                <>Choose a betting zone: <span className="text-red-400 font-medium">RED</span>, <span className="text-white/70 font-medium">BLACK</span>, or <span className="text-green-400 font-medium">GREEN (0)</span>.</>,
                'Press SPIN. The ball orbits the wheel, then drops into a pocket.',
                'Win if the ball lands on your colour.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-white/70 leading-snug">
                  <span className="w-5 h-5 flex-shrink-0 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Payouts */}
          <section>
            <h3 className="text-white/50 text-[10px] uppercase tracking-widest mb-2">Payouts</h3>
            <div className="rounded-xl overflow-hidden border border-white/10">
              {[
                { label: 'Red', dot: 'bg-red-600', numbers: '18 numbers', mult: '2×' },
                { label: 'Black', dot: 'bg-zinc-600', numbers: '18 numbers', mult: '2×' },
                { label: 'Green (0)', dot: 'bg-green-700', numbers: '1 number', mult: '35×' },
              ].map(({ label, dot, numbers, mult }, i, arr) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? 'border-b border-white/10' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span className="text-white/80 font-medium">{label}</span>
                    <span className="text-white/30 text-xs">{numbers}</span>
                  </div>
                  <span className="text-yellow-400 font-bold">{mult}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section className="text-white/30 text-xs leading-relaxed">
            You start with €1,000. Click <span className="text-white/50">Reset</span> at any time to restore your balance.
            This is a game UI prototype — no real money is involved.
          </section>
        </div>

        <div className="px-5 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-semibold text-sm hover:bg-yellow-500/30 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
