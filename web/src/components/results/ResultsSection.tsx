import { AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react';
import type { Strings } from '../../i18n';
import { SectionHeader } from '../layout/SectionHeader';

export function ResultsSection({ t }: { t: Strings }) {
  const r = t.results;
  return (
    <section id="results" className="py-16 border-b border-[#EFE6DF] dark:border-white/[0.06] bg-[#FAF6F2] dark:bg-[#070504]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader eyebrow={r.eyebrow} title={r.title} subtitle={r.subtitle} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {r.items.map(item => (
            <div key={item.title} className="p-5 rounded-xl bg-white dark:bg-[#140D0A] border border-[#EFE6DF] dark:border-[#2C1C14] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm text-[#1A110C] dark:text-[#FAF5F0]">{item.title}</h3>
                <span className="font-console text-[10px] text-[#C93300] dark:text-[#FFA200] bg-orange-50 dark:bg-orange-950/80 px-2 py-0.5 rounded border border-orange-200/60 dark:border-orange-800/60">
                  {item.ref}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs flex-1">
                <div className="p-3 rounded-lg bg-[#F5ECE5] dark:bg-[#0B0705] border border-[#EFE6DF] dark:border-[#2C1C14]">
                  <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block mb-1 font-console">{r.before}</span>
                  <span className="text-[#4A3930] dark:text-[#D1BEB4] leading-relaxed">{item.before}</span>
                </div>
                <div className="p-3 rounded-lg bg-orange-50/60 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60">
                  <span className="text-[10px] uppercase font-bold text-orange-700 dark:text-orange-400 block mb-1 font-console">{r.after}</span>
                  <span className="text-[#1A110C] dark:text-[#FAF5F0] leading-relaxed">{item.after}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 p-5 rounded-xl bg-white dark:bg-[#140D0A] border border-[#EFE6DF] dark:border-[#2C1C14]">
            <h3 className="flex items-center gap-2 font-semibold text-sm text-[#1A110C] dark:text-[#FAF5F0] mb-4">
              <FlaskConical className="w-4 h-4 text-[#FF5500]" />
              {r.testsTitle}
            </h3>
            <ul className="space-y-3">
              {r.tests.map(([count, label, detail]) => (
                <li key={label} className="flex gap-3">
                  <span className="font-console text-xl font-semibold text-[#C93300] dark:text-[#FFA200] w-10 text-right tabular-nums">{count}</span>
                  <span className="text-xs leading-relaxed">
                    <b className="text-[#1A110C] dark:text-[#FAF5F0]">{label}</b>
                    <span className="block text-[#6B5A51] dark:text-[#A89689]">{detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-console">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                81 / 81
              </span>
              <span className="text-[#8D7B72]">{r.testsRun}</span>
              <code className="px-1.5 py-0.5 rounded bg-[#F5ECE5] dark:bg-[#0B0705] border border-[#EFE6DF] dark:border-[#2C1C14] text-[#1A110C] dark:text-[#FAF5F0]">
                python tests/run_all.py
              </code>
            </p>
          </div>
          <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-[#140D0A] border border-[#EFE6DF] dark:border-[#2C1C14]">
            <h3 className="flex items-center gap-2 font-semibold text-sm text-[#1A110C] dark:text-[#FAF5F0] mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {r.limitsTitle}
            </h3>
            <ul className="space-y-2.5 text-xs text-[#6B5A51] dark:text-[#A89689] leading-relaxed list-disc pl-4">
              {r.limits.map(limit => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
