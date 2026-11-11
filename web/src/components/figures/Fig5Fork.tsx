import { useState } from 'react';
import { fmt, type Strings } from '../../i18n';
import { FigureFrame } from './FigureFrame';

interface Card {
  n: number;
  hash: string;
  pow: number;
  tag?: 'fork' | 'remined';
}

const SHARED: Card[] = [
  { n: 0, hash: '0', pow: 0 },
  { n: 1, hash: '0000c4e2…5504', pow: 57814 },
  { n: 2, hash: '000037bb…5e4c', pow: 36024 },
];
const A_FORK: Card = { n: 3, hash: '0000a1f3…9c20', pow: 70312, tag: 'fork' };
const B_FORK: Card = { n: 3, hash: '0000b7e0…41d8', pow: 12045, tag: 'fork' };
const B_NEXT: Card = { n: 4, hash: '00005d2c…e7a1', pow: 23110 };

export function Fig5Fork({ t, lang }: { t: Strings; lang: 'en' | 'id' }) {
  const f = t.figures.fig5;
  const [mode, setMode] = useState<'equal' | 'longer'>('equal');
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const branchA = [A_FORK];
  const branchB = mode === 'longer' ? [B_FORK, B_NEXT] : [B_FORK];
  const winner = mode === 'equal' ? 'A' : 'B';
  const result =
    mode === 'equal'
      ? [...SHARED, A_FORK, { n: 4, hash: '0000e81b…03af', pow: 41207, tag: 'remined' as const }]
      : [...SHARED, B_FORK, B_NEXT, { n: 5, hash: '000094c6…b512', pow: 33861, tag: 'remined' as const }];

  return (
    <FigureFrame id="fig-5" caption={f.caption} desc={f.desc}>
      <ul className="mb-5 space-y-1.5 text-xs font-console">
        {[f.rule1, f.rule2, f.rule3].map(rule => (
          <li key={rule} className="p-2 rounded-md bg-[#FAF6F2] dark:bg-[#0B0705] border border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]">
            {rule}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 mb-5">
        {(['equal', 'longer'] as const).map(value => (
          <button
            key={value}
            onClick={() => setMode(value)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              mode === value ? 'bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white border-transparent' : 'border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]'
            }`}
          >
            {value === 'equal' ? f.equal : f.longer}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {(['A', 'B'] as const).map(name => {
          const wins = name === winner;
          const branch = name === 'A' ? branchA : branchB;
          return (
            <div
              key={name}
              className={`p-3 rounded-lg border transition-all ${
                wins ? 'bg-orange-50/60 dark:bg-[#1A0E08] border-orange-300 dark:border-orange-900/80' : 'border-[#EFE6DF] dark:border-[#2C1C14] opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-[#1A110C] dark:text-[#FAF5F0]">{fmt(f.branch, { x: name })}</span>
                <span className={`px-2 py-0.5 rounded font-console font-bold text-[10px] uppercase ${wins ? 'bg-[#FF5500] text-white' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'}`}>
                  {wins ? f.wins : f.loses}
                </span>
              </div>
              <Row cards={[...SHARED, ...branch]} locale={locale} />
            </div>
          );
        })}
        <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/20">
          <Row cards={result} locale={locale} remined={f.remined} />
          <p className="mt-2 text-xs text-[#4A3930] dark:text-[#D1BEB4]">
            {mode === 'equal'
              ? fmt(f.whyEqual, { a: A_FORK.pow.toLocaleString(locale), b: B_FORK.pow.toLocaleString(locale) })
              : f.whyLonger}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-[#6B5A51] dark:text-[#C5B3A8] leading-relaxed border-l-2 border-[#FF5500] pl-3">{f.bipartite}</p>
    </FigureFrame>
  );
}

function Row({ cards, locale, remined }: { cards: Card[]; locale: string; remined?: string }) {
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
      {cards.map((card, i) => (
        <div key={i} className="flex items-center gap-1.5 shrink-0">
          {i > 0 && <span className="text-[#C5B3A8] dark:text-[#4A3525]">→</span>}
          <div
            className={`px-2 py-1.5 rounded border text-[10px] font-console min-w-[92px] ${
              card.tag === 'fork'
                ? 'border-[#FF5500] bg-white dark:bg-[#140D0A]'
                : card.tag === 'remined'
                  ? 'border-emerald-500 bg-white dark:bg-[#0B0705]'
                  : 'border-[#EFE6DF] dark:border-[#2C1C14] bg-white dark:bg-[#0B0705]'
            }`}
          >
            <div className="font-bold text-[#1A110C] dark:text-[#FAF5F0]">#{card.n}</div>
            <div className="text-[#8D7B72]">{card.hash}</div>
            <div className="text-[#C93300] dark:text-[#FFA200]">PoW {card.pow.toLocaleString(locale)}</div>
            {card.tag === 'remined' && remined && <div className="text-emerald-600 dark:text-emerald-400">{remined}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
