import { useState } from 'react';
import { BLOCK_2, FIG6_SAMPLES, SAMPLE_KEYS, type Fig6Sample, type SampleBlock } from '../../data/samples';
import type { Strings } from '../../i18n';
import { shortHash, shortKey } from '../../lib/format';
import { CheckMark, FigureFrame } from './FigureFrame';

export function Fig6Checks({ t }: { t: Strings }) {
  const f = t.figures.fig6;
  const [sample, setSample] = useState<Fig6Sample>('tampered');
  const { changes, errors } = FIG6_SAMPLES[sample];
  const block: SampleBlock = { ...BLOCK_2, ...changes };
  const changed = new Set(Object.keys(changes));
  const display = (key: keyof SampleBlock) => {
    const value = block[key];
    if (key === 'message') {
      return String(value).replace(SAMPLE_KEYS.B, shortKey(SAMPLE_KEYS.B)).replace(SAMPLE_KEYS.C, shortKey(SAMPLE_KEYS.C));
    }
    if (key === 'hash' || key === 'prev_hash' || key === 'signature') return shortHash(String(value), 12, 6);
    return String(value);
  };

  return (
    <FigureFrame id="fig-6" caption={f.caption} desc={f.desc}>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-xs font-medium text-[#4A3930] dark:text-[#D1BEB4]">{f.sample}</span>
        {(Object.keys(FIG6_SAMPLES) as Fig6Sample[]).map(key => (
          <button
            key={key}
            onClick={() => setSample(key)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              sample === key ? 'bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white border-transparent' : 'border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]'
            }`}
          >
            {f.samples[key]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <dl className="p-4 rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14] bg-[#FAF6F2]/70 dark:bg-[#0B0705] grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-console self-start">
          {(['number_of_block', 'prev_hash', 'message', 'timeStamp', 'signature', 'nonce', 'proof_of_work', 'hash'] as Array<keyof SampleBlock>).map(key => (
            <div key={key} className="contents">
              <dt className="text-[#8D7B72]">{key}</dt>
              <dd className={`break-all ${changed.has(key) ? 'text-rose-600 dark:text-rose-300 font-semibold' : 'text-[#1A110C] dark:text-[#FAF5F0]'}`}>{display(key)}</dd>
            </div>
          ))}
        </dl>

        <div>
          <ol className="space-y-1.5">
            {f.checks.map(([flag, description], index) => {
              const ok = !errors.includes(flag);
              return (
                <li
                  key={flag}
                  className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                    ok ? 'border-[#EFE6DF] dark:border-[#2C1C14]' : 'border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30'
                  }`}
                >
                  <span className="font-console text-[#8D7B72] w-4">{index + 1}</span>
                  <CheckMark ok={ok} />
                  <span className="flex-1">
                    <code className={`text-[10.5px] ${ok ? 'text-[#8D7B72]' : 'text-rose-700 dark:text-rose-300 font-semibold'}`}>{flag}</code>
                    <span className="block text-[#4A3930] dark:text-[#D1BEB4]">{description}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-[#8D7B72]">{f.result}</span>
            <span className={`px-2 py-0.5 rounded font-console font-bold uppercase ${errors.length ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
              {errors.length ? f.rejected : f.accepted}
            </span>
          </div>
          <p className="mt-3 text-[11px] text-[#6B5A51] dark:text-[#C5B3A8] leading-relaxed">{f.notHashed}</p>
        </div>
      </div>
    </FigureFrame>
  );
}
