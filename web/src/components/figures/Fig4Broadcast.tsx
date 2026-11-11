import { useEffect, useMemo, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { Strings } from '../../i18n';
import { FigureFrame } from './FigureFrame';

const POS: Record<string, { x: number; y: number }> = {
  A: { x: 80, y: 50 },
  B: { x: 270, y: 50 },
  C: { x: 270, y: 185 },
  D: { x: 80, y: 185 },
  E: { x: 175, y: 280 },
};
const K4: Record<string, string[]> = { A: ['B', 'C', 'D'], B: ['A', 'C', 'D'], C: ['A', 'B', 'D'], D: ['A', 'B', 'C'] };
const WITH_E: Record<string, string[]> = { ...K4, D: [...K4.D, 'E'], E: ['D'] };

type Message = [string, string];
interface Level {
  accepted: Message[];
  duplicates: Message[];
}

/** Broadcast level-order seperti di kode: node yang MENERIMA blok baru meneruskannya ke semua koneksinya. */
function simulate(adjacency: Record<string, string[]>, root: string): Level[] {
  const levels: Level[] = [];
  const has = new Set([root]);
  let senders = [root];
  while (senders.length) {
    const level: Level = { accepted: [], duplicates: [] };
    const fresh: string[] = [];
    for (const u of senders) {
      for (const v of adjacency[u]) {
        if (has.has(v) || fresh.includes(v)) level.duplicates.push([u, v]);
        else {
          level.accepted.push([u, v]);
          fresh.push(v);
        }
      }
    }
    levels.push(level);
    fresh.forEach(v => has.add(v));
    senders = fresh;
  }
  return levels;
}

export function Fig4Broadcast({ t, reducedMotion }: { t: Strings; reducedMotion: boolean }) {
  const f = t.figures.fig4;
  const [mode, setMode] = useState<'complete' | 'incomplete'>('complete');
  const adjacency = mode === 'complete' ? K4 : WITH_E;
  const levels = useMemo(() => simulate(adjacency, 'A'), [adjacency]);
  const [shown, setShown] = useState(levels.length);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setShown(levels.length);
    return () => timers.current.forEach(clearTimeout);
  }, [levels]);

  const play = () => {
    timers.current.forEach(clearTimeout);
    if (reducedMotion) {
      setShown(levels.length);
      return;
    }
    setShown(0);
    timers.current = levels.map((_, i) => window.setTimeout(() => setShown(i + 1), 700 * (i + 1)));
  };

  const nodes = Object.keys(adjacency);
  const baseEdges: Message[] = [];
  nodes.forEach(u => adjacency[u].forEach(v => u < v && baseEdges.push([u, v])));
  const depth = levels.filter(level => level.accepted.length).length;
  const reached = new Set(['A', ...levels.slice(0, shown).flatMap(level => level.accepted.map(([, v]) => v))]);
  const levelColor = ['#FF5500', '#FFA200', '#F59E0B'];

  return (
    <FigureFrame id="fig-4" caption={f.caption} desc={f.desc}>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(['complete', 'incomplete'] as const).map(value => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              mode === value ? 'bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white border-transparent' : 'border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]'
            }`}
          >
            {value === 'complete' ? f.complete : f.incomplete}
          </button>
        ))}
        <button onClick={play} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[#1A110C] dark:bg-white text-white dark:text-black">
          <Play className="w-3.5 h-3.5" />
          {f.play}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="p-3 bg-[#FAF6F2]/70 dark:bg-[#0B0705]/80 rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14]">
          <svg viewBox={mode === 'complete' ? '0 10 350 220' : '0 10 350 310'} className="w-full h-auto">
            <defs>
              {levelColor.map((color, i) => (
                <marker key={i} id={`arrow-${i}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
              ))}
            </defs>
            {baseEdges.map(([u, v]) => (
              <line key={`${u}${v}`} x1={POS[u].x} y1={POS[u].y} x2={POS[v].x} y2={POS[v].y} stroke="currentColor" strokeWidth="1.2" className="text-[#E5D7CE] dark:text-[#2C1C14]" />
            ))}
            {levels.slice(0, shown).map((level, i) =>
              level.accepted.map(([u, v]) => {
                const p = POS[u], q = POS[v];
                const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
                return (
                  <line
                    key={`${i}${u}${v}`}
                    x1={p.x + (dx / len) * 20}
                    y1={p.y + (dy / len) * 20}
                    x2={q.x - (dx / len) * 22}
                    y2={q.y - (dy / len) * 22}
                    stroke={levelColor[Math.min(i, 2)]}
                    strokeWidth="2.6"
                    markerEnd={`url(#arrow-${Math.min(i, 2)})`}
                  />
                );
              }),
            )}
            {nodes.map(id => (
              <g key={id} transform={`translate(${POS[id].x}, ${POS[id].y})`}>
                <circle r="18" className="fill-white dark:fill-[#140D0A]" stroke={reached.has(id) ? '#FF5500' : '#A89489'} strokeWidth={id === 'A' ? 3.5 : 2.2} />
                <text textAnchor="middle" dy="4.5" fontSize="12" fontWeight="700" fontFamily="var(--font-mono)" className="fill-[#1A110C] dark:fill-[#FAF5F0]">
                  {id}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-2 text-xs">
          <LevelRow color="#C93300" label={f.level0} detail="A" />
          {levels.map((level, i) => (
            <LevelRow
              key={i}
              color={levelColor[Math.min(i, 2)]}
              dim={i >= shown}
              label={i === 0 ? f.level1 : `${f.level2} (L${i + 1})`}
              detail={[
                level.accepted.length ? `${level.accepted.map(([u, v]) => `${u}→${v}`).join(', ')} · ${f.accepted}` : '',
                level.duplicates.length ? `${level.duplicates.length}× ${f.duplicate}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
          <div className="pt-2 font-console text-[#1A110C] dark:text-[#FAF5F0]">
            {f.depth}: <b className="text-[#C93300] dark:text-[#FFA200]">{depth}</b>
          </div>
        </div>
      </div>
    </FigureFrame>
  );
}

function LevelRow({ color, label, detail, dim = false }: { color: string; label: string; detail: string; dim?: boolean }) {
  return (
    <div className={`p-2.5 rounded-md border border-[#EFE6DF] dark:border-[#2C1C14] transition-opacity ${dim ? 'opacity-35' : ''}`}>
      <div className="flex items-center gap-2 font-semibold text-[#1A110C] dark:text-[#FAF5F0]">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <div className="mt-1 font-console text-[11px] text-[#6B5A51] dark:text-[#A89489]">{detail}</div>
    </div>
  );
}
