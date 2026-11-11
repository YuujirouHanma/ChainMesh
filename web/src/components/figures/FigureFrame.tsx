import type { ReactNode } from 'react';

interface FigureFrameProps {
  id: string;
  caption: string;
  desc: string;
  formula?: ReactNode;
  children: ReactNode;
}

/** Bingkai figur bergaya buku teks: caption miring, penjelasan, rumus, lalu isi interaktif. */
export function FigureFrame({ id, caption, desc, formula, children }: FigureFrameProps) {
  return (
    <figure id={id} className="bg-white dark:bg-[#140D0A] border border-[#EFE6DF] dark:border-[#2C1C14] rounded-xl p-5 sm:p-6 shadow-xs">
      <div className="border-b border-[#EFE6DF] dark:border-[#261811] pb-4 mb-6">
        <figcaption className="font-academic text-xl font-semibold text-[#1A110C] dark:text-[#FAF5F0] italic">{caption}</figcaption>
        <p className="text-sm text-[#6B5A51] dark:text-[#C5B3A8] mt-1.5 leading-relaxed max-w-4xl">{desc}</p>
        {formula && (
          <div className="mt-3 text-xs font-console text-[#C93300] dark:text-[#FF6B1A] bg-orange-50/70 dark:bg-orange-950/40 p-2.5 rounded-lg border border-orange-200/80 dark:border-orange-900/60 overflow-x-auto whitespace-nowrap">
            {formula}
          </div>
        )}
      </div>
      {children}
    </figure>
  );
}

export function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
        ok ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
      }`}
      aria-label={ok ? 'pass' : 'fail'}
    >
      {ok ? '✓' : '✗'}
    </span>
  );
}
