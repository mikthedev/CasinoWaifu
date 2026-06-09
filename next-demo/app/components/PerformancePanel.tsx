'use client';

interface Props {
  fps: number;
  objectCount: number;
}

export default function PerformancePanel({ fps, objectCount }: Props) {
  const fpsColor = fps >= 55 ? 'text-green-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 text-xs font-mono space-y-0.5 pointer-events-none select-none">
      <div className="text-white/50 uppercase tracking-widest text-[10px] mb-1">Perf</div>
      <div className="flex justify-between gap-4">
        <span className="text-white/60">FPS</span>
        <span className={fpsColor}>{fps}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-white/60">Objects</span>
        <span className="text-cyan-400">{objectCount}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-white/60">Renderer</span>
        <span className="text-purple-400">PixiJS</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-white/60">Loop</span>
        <span className="text-purple-400">rAF</span>
      </div>
    </div>
  );
}
