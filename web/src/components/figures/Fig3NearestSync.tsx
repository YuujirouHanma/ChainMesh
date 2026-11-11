import { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { fmt, type Strings } from '../../i18n';
import { FigureFrame } from './FigureFrame';

// Contoh: D tertinggal (tinggi 1). Urutan peer menurut _nearest_neighbours: B (11 ms), C (27 ms), A (42 ms).
const PEERS = [
  { id: 'B', ms: 11, x: 250, y: 50 },
  { id: 'C', ms: 27, x: 290, y: 160 },
  { id: 'A', ms: 42, x: 220, y: 250 },
];
const D = { x: 70, y: 150 };

export function Fig3NearestSync({ t }: { t: Strings }) {
  const f = t.figures.fig3;
  const [step, setStep] = useState(0);
  const total = f.steps.length;

  const peerState = (id: string): 'waiting' | 'asking' | 'rejected' | 'adopted' => {
    if (id === 'B') return step === 1 ? 'asking' : step >= 2 ? 'rejected' : 'waiting';
    if (id === 'C') return step === 3 ? 'asking' : step >= 4 ? 'adopted' : 'waiting';
    return 'waiting';
  };
  const color = { waiting: '#A89489', asking: '#FFA200', rejected: '#EF4444', adopted: '#10B981' } as const;
  const label = { waiting: f.waiting, asking: '…', rejected: f.rejected, adopted: f.adopted };
  const height = step >= 4 ? 3 : 1;

  return (
    <FigureFrame id="fig-3" caption={f.caption} desc={f.desc}>
      <p className="text-xs text-[#6B5A51] dark:text-[#C5B3A8] mb-4">{f.scenario}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="p-3 bg-[#FAF6F2]/70 dark:bg-[#0B0705]/80 rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14]">
          <svg viewBox="0 0 340 300" className="w-full h-auto">
            {PEERS.map(peer => {
              const state = peerState(peer.id);
              const highlighted = state !== 'waiting' || step === 0;
              return (
                <g key={peer.id}>
                  <line
                    x1={D.x}
                    y1={D.y}
                    x2={peer.x}
                    y2={peer.y}
                    stroke={state === 'waiting' ? 'currentColor' : color[state]}
                    strokeWidth={state === 'asking' ? 3 : 1.6}
                    strokeDasharray={state === 'rejected' ? '5 4' : undefined}
                    className={state === 'waiting' ? 'text-[#D1BEB4] dark:text-[#38261E]' : ''}
                    opacity={highlighted ? 1 : 0.6}
                  />
                  <text x={(D.x + peer.x) / 2} y={(D.y + peer.y) / 2 - 6} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" className="fill-[#6B5A51] dark:fill-[#D1BEB4]">
                    {peer.ms} ms
                  </text>
                  <g transform={`translate(${peer.x}, ${peer.y})`}>
                    <circle r="18" className="fill-white dark:fill-[#140D0A]" stroke={state === 'waiting' ? '#FF5500' : color[state]} strokeWidth="2.5" />
                    <text textAnchor="middle" dy="4.5" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)" className="fill-[#1A110C] dark:fill-[#FAF5F0]">
                      {peer.id}
                    </text>
                    <text textAnchor="middle" dy="32" fontSize="9" fontFamily="var(--font-mono)" fill={state === 'waiting' ? '#8D7B72' : color[state]}>
                      {label[state]}
                    </text>
                  </g>
                </g>
              );
            })}
            <g transform={`translate(${D.x}, ${D.y})`}>
              <circle r="22" className="fill-white dark:fill-[#140D0A]" stroke={step >= 4 ? '#10B981' : '#FF5500'} strokeWidth="3" />
              <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fontFamily="var(--font-mono)" className="fill-[#1A110C] dark:fill-[#FAF5F0]">
                D
              </text>
              <text textAnchor="middle" dy="40" fontSize="10" fontFamily="var(--font-mono)" className="fill-[#6B5A51] dark:fill-[#D1BEB4]">
                {f.state}: {height}
              </text>
            </g>
          </svg>
        </div>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8D7B72] mb-2 font-console">{f.order}</div>
          <ol className="flex gap-2 mb-4 font-console text-xs">
            {PEERS.map((peer, index) => (
              <li key={peer.id} className="px-2 py-1 rounded border border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]">
                {index + 1}. {peer.id} · {peer.ms} ms
              </li>
            ))}
          </ol>
          <ol className="space-y-2">
            {f.steps.map((text, index) => (
              <li
                key={index}
                className={`flex gap-2 text-xs p-2 rounded-md border transition-colors ${
                  index === step
                    ? 'border-[#FF5500] bg-orange-50 dark:bg-orange-950/40 text-[#1A110C] dark:text-[#FAF5F0]'
                    : index < step
                      ? 'border-[#EFE6DF] dark:border-[#2C1C14] text-[#6B5A51] dark:text-[#A89489]'
                      : 'border-transparent text-[#A89489] dark:text-[#6B5A51]'
                }`}
              >
                <span className="font-console font-bold">{index + 1}.</span>
                {text}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-[#EFE6DF] dark:border-[#2C1C14] disabled:opacity-40">
              <ChevronLeft className="w-3.5 h-3.5" />
              {f.prev}
            </button>
            {step < total - 1 ? (
              <button onClick={() => setStep(s => s + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white">
                {f.next}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button onClick={() => setStep(0)} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white">
                <RotateCcw className="w-3.5 h-3.5" />
                {f.restart}
              </button>
            )}
            <span className="ml-auto text-[11px] font-console text-[#8D7B72]">{fmt(f.step, { n: step + 1, total })}</span>
          </div>
          <p className="mt-4 text-xs text-[#6B5A51] dark:text-[#C5B3A8] leading-relaxed border-l-2 border-[#FF5500] pl-3">{f.note71}</p>
        </div>
      </div>
    </FigureFrame>
  );
}
