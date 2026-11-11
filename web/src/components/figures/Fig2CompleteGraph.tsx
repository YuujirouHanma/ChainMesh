import { useState } from 'react';
import type { Strings } from '../../i18n';
import { circlePositions } from '../../lib/graph';
import { FigureFrame } from './FigureFrame';

// Nilai contoh (ms). Di demo live, bobot diukur oleh node sendiri.
const LATENCY: Record<string, number> = {
  'A-B': 38, 'A-C': 29, 'A-D': 42, 'A-E': 18, 'A-F': 45,
  'B-C': 14, 'B-D': 11, 'B-E': 31, 'B-F': 22,
  'C-D': 27, 'C-E': 35, 'C-F': 19,
  'D-E': 40, 'D-F': 16,
  'E-F': 28,
};
const weight = (u: string, v: string) => (u === v ? 0 : LATENCY[u < v ? `${u}-${v}` : `${v}-${u}`]);

export function Fig2CompleteGraph({ t }: { t: Strings }) {
  const f = t.figures.fig2;
  const [n, setN] = useState(4);
  const [hovered, setHovered] = useState<string | null>(null);
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
  const positions = circlePositions(n, 160, 140, 95);
  const edges: Array<{ u: string; v: string; i: number; j: number }> = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ u: labels[i], v: labels[j], i, j });

  return (
    <FigureFrame id="fig-2" caption={f.caption} desc={f.desc} formula={`K${n} · |V| = ${n} · ${f.formula}`}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#4A3930] dark:text-[#D1BEB4]">{f.choose}</span>
          <div className="inline-flex rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14] p-0.5 bg-[#FAF6F2] dark:bg-[#0B0705]">
            {[3, 4, 5, 6].map(value => (
              <button
                key={value}
                onClick={() => setN(value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  n === value
                    ? 'bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white font-semibold'
                    : 'text-[#7C695F] dark:text-[#A89489] hover:text-[#FF5500]'
                }`}
              >
                K{value}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-[#8D7B72] font-console flex flex-wrap gap-x-3">
          <span>
            {f.edges}: <b className="text-[#1A110C] dark:text-[#FAF5F0]">{(n * (n - 1)) / 2}</b>
          </span>
          <span>
            {f.degree}: <b className="text-[#1A110C] dark:text-[#FAF5F0]">{n - 1}</b>
          </span>
          <span>
            {f.arcs}: <b className="text-[#1A110C] dark:text-[#FAF5F0]">{n * (n - 1)}</b>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="flex flex-col items-center p-4 bg-[#FAF6F2]/70 dark:bg-[#0B0705]/80 rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14]">
          <svg viewBox="0 0 320 280" className="w-full max-w-[320px] h-auto overflow-visible">
            {edges.map(({ u, v, i, j }) => {
              const p = positions[i], q = positions[j];
              const key = `${u}-${v}`;
              const active = hovered === key;
              const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
              return (
                <g key={key} onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
                  <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={active ? '#FF5500' : 'currentColor'} strokeWidth={active ? 2.5 : 1.25} className={active ? '' : 'text-[#D1BEB4] dark:text-[#38261E]'} />
                  <rect x={mx - 13} y={my - 8} width="26" height="16" rx="4" className={active ? 'fill-[#FF5500]' : 'fill-white dark:fill-[#140D0A]'} stroke="currentColor" strokeWidth="0.6" />
                  <text x={mx} y={my + 3.5} textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fontWeight="600" className={active ? 'fill-white' : 'fill-[#6B5A51] dark:fill-[#D1BEB4]'}>
                    {weight(u, v)}
                  </text>
                </g>
              );
            })}
            {labels.map((label, i) => (
              <g key={label} transform={`translate(${positions[i].x}, ${positions[i].y})`}>
                <circle r="18" className="fill-white dark:fill-[#140D0A] stroke-[#FF5500]" strokeWidth="2.5" />
                <text textAnchor="middle" dy="4.5" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)" className="fill-[#1A110C] dark:fill-[#FAF5F0]">
                  {label}
                </text>
              </g>
            ))}
          </svg>
          <div className="mt-2 text-[11px] text-[#8D7B72] font-academic italic">{f.weightNote}</div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1A110C] dark:text-[#FAF5F0] font-console">{f.matrix}</span>
            <span className="text-[11px] text-[#8D7B72]">{f.symmetric}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14]">
            <table className="w-full text-center text-xs font-console">
              <thead className="bg-[#FAF6F2] dark:bg-[#0B0705] text-[#7C695F] dark:text-[#A89489]">
                <tr>
                  <th className="p-2 border-b border-r border-[#EFE6DF] dark:border-[#2C1C14]">W</th>
                  {labels.map(label => (
                    <th key={label} className="p-2 border-b border-[#EFE6DF] dark:border-[#2C1C14]">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE6DF] dark:divide-[#2C1C14] bg-white dark:bg-[#140D0A]">
                {labels.map(u => (
                  <tr key={u}>
                    <td className="p-2 bg-[#FAF6F2] dark:bg-[#0B0705] font-bold border-r border-[#EFE6DF] dark:border-[#2C1C14] text-[#1A110C] dark:text-[#FAF5F0]">{u}</td>
                    {labels.map(v => {
                      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
                      const self = u === v;
                      const active = hovered === key;
                      return (
                        <td
                          key={v}
                          onMouseEnter={() => !self && setHovered(key)}
                          onMouseLeave={() => setHovered(null)}
                          className={`p-2 tabular-nums ${
                            self
                              ? 'text-[#8D7B72] bg-[#FAF6F2] dark:bg-[#0B0705]'
                              : active
                                ? 'bg-orange-100 dark:bg-orange-950/80 text-[#C93300] dark:text-[#FF6B1A] font-bold'
                                : 'text-[#4A3930] dark:text-[#D1BEB4]'
                          }`}
                        >
                          {weight(u, v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#8D7B72] leading-relaxed">{f.hint}</p>
          <p className="text-xs text-[#6B5A51] dark:text-[#C5B3A8] leading-relaxed border-l-2 border-[#FF5500] pl-3">{f.seed}</p>
        </div>
      </div>
    </FigureFrame>
  );
}
