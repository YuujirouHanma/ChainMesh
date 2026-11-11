import type { Strings } from '../../i18n';
import type { Stats } from '../../types';

export function LiveStats({ t, lang, stats }: { t: Strings; lang: 'en' | 'id'; stats: Stats | null }) {
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const value = (v: number | null | undefined, unit = '') => (v === null || v === undefined ? '—' : `${v.toLocaleString(locale)}${unit}`);
  const tiles: Array<[string, string, string?]> = [
    [t.stats.mined, value(stats?.mined)],
    [t.stats.mineTime, stats?.avgMineSeconds != null ? `${value(Math.round(stats.avgMineSeconds * 1000))} ms` : '—'],
    [t.stats.propagation, stats?.avgPropagationMs != null ? `${value(stats.avgPropagationMs)} ms` : '—', t.stats.propagationNote],
    [t.stats.reorgs, value(stats?.reorgs)],
    [t.stats.repairs, value(stats?.repairs)],
  ];
  return (
    <div className="bg-[#0B0705] border border-[#2C1C14] rounded-xl p-5 shadow-2xl h-full">
      <h3 className="font-bold text-sm font-console text-white mb-4">{t.stats.title}</h3>
      <dl className="grid grid-cols-2 lg:grid-cols-1 gap-3">
        {tiles.map(([label, shown, note]) => (
          <div key={label} className="p-3 rounded-lg bg-[#140D0A] border border-[#2C1C14]">
            <dt className="text-[10.5px] text-[#8C7769] leading-snug">{label}</dt>
            <dd className="mt-1 font-console text-lg font-semibold text-[#FFA200] tabular-nums">{shown}</dd>
            {note && <dd className="text-[10px] text-[#6B5E57] mt-0.5">{note}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
