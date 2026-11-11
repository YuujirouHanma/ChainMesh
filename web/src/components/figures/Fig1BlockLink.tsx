import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Hammer, RotateCcw } from 'lucide-react';
import { BLOCK_1, BLOCK_2, SAMPLE_KEYS } from '../../data/samples';
import { fmt, type Strings } from '../../i18n';
import { shortHash, shortKey } from '../../lib/format';
import { blockHash, meetsDifficulty } from '../../lib/sha256';
import { CheckMark, FigureFrame } from './FigureFrame';

const ORIGINAL_TEXT = 'hello from A';
const prefix = (from: string, to: string) => `From ${from} to ${to}, `;

export function Fig1BlockLink({ t, lang }: { t: Strings; lang: 'en' | 'id' }) {
  const f = t.figures.fig1;
  const [text, setText] = useState(ORIGINAL_TEXT);
  const [rewriteHash, setRewriteHash] = useState(false);
  const [mined, setMined] = useState<{ nonce: number; hash: string; message: string } | null>(null);
  const [tries, setTries] = useState<number | null>(null);
  const [mining, setMining] = useState(false);
  const job = useRef(0);

  const message = prefix(SAMPLE_KEYS.A, SAMPLE_KEYS.B) + text;
  const validMined = mined && mined.message === message ? mined : null;
  const nonce = validMined ? validMined.nonce : BLOCK_1.nonce;
  const recomputed = blockHash(message, BLOCK_1.prev_hash, BLOCK_1.signature, nonce, BLOCK_1.timeStamp);
  const stored = validMined ? validMined.hash : rewriteHash ? recomputed : BLOCK_1.hash;

  const hashOk = stored === recomputed;
  const powOk = meetsDifficulty(stored, 16);
  const sigOk = message === BLOCK_1.message;
  const linkOk = BLOCK_2.prev_hash === stored;
  const untouched = message === BLOCK_1.message && !validMined;

  useEffect(() => () => void (job.current += 1), []);

  const cancel = () => {
    job.current += 1;
    setMining(false);
  };

  const restore = () => {
    cancel();
    setText(ORIGINAL_TEXT);
    setRewriteHash(false);
    setMined(null);
    setTries(null);
  };

  const remine = () => {
    const id = ++job.current;
    const target = message;
    let candidate = 1;
    const step = () => {
      if (id !== job.current) return;
      for (let i = 0; i < 4000; i++, candidate++) {
        const hash = blockHash(target, BLOCK_1.prev_hash, BLOCK_1.signature, candidate, BLOCK_1.timeStamp);
        if (meetsDifficulty(hash, 16)) {
          setMined({ nonce: candidate, hash, message: target });
          setTries(candidate);
          setMining(false);
          return;
        }
      }
      setTries(candidate);
      setTimeout(step, 0);
    };
    setMined(null);
    setTries(0);
    setMining(true);
    setTimeout(step, 0);
  };

  const checks: Array<[boolean, string, string]> = [
    [hashOk, f.checkHash, 'InvalidBlockHash'],
    [powOk, f.checkPow, 'InvalidProofOfWork'],
    [sigOk, f.checkSig, 'InvalidSignature'],
    [linkOk, f.checkLink, 'PreviousHashBlockError (#2)'],
  ];

  return (
    <FigureFrame id="fig-1" caption={f.caption} desc={f.desc} formula={f.formula}>
      <p className="text-xs text-[#6B5A51] dark:text-[#C5B3A8] mb-4 leading-relaxed">{f.sample}</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
        <BlockCard
          title="Block #1"
          bad={!hashOk || !powOk || !sigOk}
          rows={[
            ['number_of_block', '1'],
            ['timeStamp', BLOCK_1.timeStamp],
            ['prev_hash', `"0" (genesis)`],
            ['nonce', nonce.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')],
            ['proof_of_work', (nonce - 1).toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')],
            ['signature', shortHash(BLOCK_1.signature, 14, 6)],
          ]}
        >
          <label className="block text-[10px] text-[#8D7B72] font-sans mt-2">{f.messageLabel}</label>
          <div className="mt-1 rounded border border-[#EFE6DF] dark:border-[#2C1C14] bg-white dark:bg-[#0B0705] p-2 text-[11px] font-console">
            <span className="text-[#8D7B72]">
              From {shortKey(SAMPLE_KEYS.A)} to {shortKey(SAMPLE_KEYS.B)},{' '}
            </span>
            <input
              value={text}
              maxLength={60}
              onChange={event => {
                cancel();
                setTries(null);
                setText(event.target.value);
              }}
              className={`w-full mt-1 bg-transparent border-b outline-none py-0.5 ${
                sigOk ? 'border-[#EFE6DF] dark:border-[#2C1C14] text-[#1A110C] dark:text-[#FAF5F0]' : 'border-rose-400 text-rose-600 dark:text-rose-300'
              }`}
              aria-label={f.messageLabel}
            />
          </div>
          <HashLine label={f.storedHash} value={stored} good={hashOk && powOk} />
          <HashLine label={f.recomputed} value={recomputed} good={hashOk} muted />
        </BlockCard>

        <div className="flex lg:flex-col items-center justify-center gap-2">
          <div
            className={`p-2 rounded-full border shadow-md ${
              linkOk ? 'bg-gradient-to-r from-[#FF5500] to-[#E63900] border-orange-600 text-white' : 'bg-rose-500 border-rose-600 text-white'
            }`}
          >
            <ArrowRight className="w-4 h-4 rotate-90 lg:rotate-0" />
          </div>
          <span className="text-[10px] font-console text-[#8D7B72]">{f.link}</span>
        </div>

        <BlockCard
          title="Block #2"
          bad={!linkOk}
          rows={[
            ['number_of_block', '2'],
            ['timeStamp', BLOCK_2.timeStamp],
            ['message', `From ${shortKey(SAMPLE_KEYS.B)} to ${shortKey(SAMPLE_KEYS.C)}, graph theory final project`],
            ['nonce', BLOCK_2.nonce.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')],
            ['hash', shortHash(BLOCK_2.hash, 14, 6)],
          ]}
        >
          <HashLine label="prev_hash" value={BLOCK_2.prev_hash} good={linkOk} />
        </BlockCard>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
        <div className="rounded-lg border border-[#EFE6DF] dark:border-[#2C1C14] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8D7B72] mb-2 font-console">{f.checks}</div>
          <ul className="space-y-1.5">
            {checks.map(([ok, label, flag]) => (
              <li key={flag} className="flex items-center gap-2 text-xs">
                <CheckMark ok={ok} />
                <span className="text-[#4A3930] dark:text-[#D1BEB4]">{label}</span>
                {!ok && <code className="ml-auto text-[10px] text-rose-600 dark:text-rose-300">{flag}</code>}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex md:flex-col gap-2">
          <button
            onClick={() => setRewriteHash(v => !v)}
            disabled={untouched || Boolean(validMined)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-40 ${
              rewriteHash ? 'bg-rose-500/10 border-rose-400 text-rose-700 dark:text-rose-300' : 'border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]'
            }`}
            aria-pressed={rewriteHash}
          >
            {f.rewriteHash}
          </button>
          <button
            onClick={remine}
            disabled={untouched || mining}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-gradient-to-r from-[#FF5500] to-[#E63900] text-white disabled:opacity-40"
          >
            <Hammer className="w-3.5 h-3.5" />
            {f.remine}
          </button>
          <button onClick={restore} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[#EFE6DF] dark:border-[#2C1C14] text-[#4A3930] dark:text-[#D1BEB4]">
            <RotateCcw className="w-3.5 h-3.5" />
            {f.restore}
          </button>
        </div>
      </div>

      {tries !== null && tries > 0 && (
        <p className="mt-3 text-xs font-console text-[#C93300] dark:text-[#FFA200]">
          {validMined ? fmt(f.mined, { n: tries.toLocaleString() }) : fmt(f.mining, { n: tries.toLocaleString() })}
        </p>
      )}
      {!untouched && <p className="mt-3 text-xs text-[#6B5A51] dark:text-[#C5B3A8] italic font-academic">{f.lesson}</p>}
      <p className="mt-3 text-[11px] text-[#8D7B72] font-console">{f.genesis}</p>
    </FigureFrame>
  );
}

function BlockCard({ title, bad, rows, children }: { title: string; bad: boolean; rows: Array<[string, string]>; children?: ReactNode }) {
  return (
    <div
      className={`p-4 rounded-lg border transition-colors ${
        bad ? 'border-rose-400 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30' : 'border-[#EFE6DF] dark:border-[#2C1C14] bg-[#FAF6F2]/70 dark:bg-[#1C130E]'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#EFE6DF] dark:border-[#261811] pb-2 mb-3">
        <span className="font-semibold text-xs tracking-wider text-[#1A110C] dark:text-[#FAF5F0] uppercase">{title}</span>
        <span
          className={`text-[10px] font-console px-2 py-0.5 rounded font-bold ${
            bad ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300' : 'bg-orange-100 dark:bg-orange-950/70 text-[#C93300] dark:text-[#FF6B1A]'
          }`}
        >
          {bad ? 'INVALID' : 'VALID'}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] font-console">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-[#8D7B72]">{key}</dt>
            <dd className="text-[#1A110C] dark:text-[#FAF5F0] break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </div>
  );
}

function HashLine({ label, value, good, muted = false }: { label: string; value: string; good: boolean; muted?: boolean }) {
  return (
    <div
      className={`mt-2 p-2 rounded border text-[10.5px] font-console ${
        good
          ? 'border-orange-200 dark:border-orange-900/70 bg-orange-50/60 dark:bg-[#1A0E08]'
          : 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40'
      } ${muted ? 'opacity-80' : ''}`}
    >
      <span className="block text-[9.5px] uppercase tracking-wider text-[#8D7B72] font-sans font-semibold">{label}</span>
      <span className={`break-all ${good ? 'text-[#C93300] dark:text-[#FFA200]' : 'text-rose-700 dark:text-rose-300'}`}>
        <strong>{value.slice(0, 4)}</strong>
        {value.slice(4)}
      </span>
    </div>
  );
}
