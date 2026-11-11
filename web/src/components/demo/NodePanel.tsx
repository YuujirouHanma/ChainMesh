import { useEffect, useState } from 'react';
import { Check, Copy, Power, Send, ShieldAlert, Wrench } from 'lucide-react';
import { fmt, type Strings } from '../../i18n';
import { shortKey } from '../../lib/format';
import { degrees, nearestOrder, nodeState, STATE_COLOR } from '../../lib/graph';
import type { ActionResult, ApiBlock, ApiNode } from '../../types';

interface NodePanelProps {
  t: Strings;
  node: ApiNode | null;
  nodes: ApiNode[];
  blocks: Record<string, ApiBlock>;
  ready: boolean;
  messageLimit: number;
  run: (path: string, body?: object) => Promise<ActionResult>;
}

type Tab = 'tx' | 'tamper' | 'heal';

export function NodePanel({ t, node, nodes, blocks, ready, messageLimit, run }: NodePanelProps) {
  const [tab, setTab] = useState<Tab>('tx');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [tamperText, setTamperText] = useState(t.node.tamperDefault);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    if (node && to === node.id) setTo('');
  }, [node, to]);

  useEffect(() => {
    if (!node?.autoRestartAt) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [node?.autoRestartAt]);

  if (!node) {
    return <div className="h-full min-h-[340px] rounded-xl border border-[#2C1C14] bg-[#140D0A]" />;
  }

  const state = nodeState(node);
  const degree = degrees(node, nodes);
  const others = nodes.filter(n => n.id !== node.id);
  const editable = node.chain.slice(1).map(row => blocks[row.d]).filter(Boolean);
  const selectedBlock = blockNumber ?? editable[editable.length - 1]?.number_of_block ?? null;
  const receiver = nodes.find(n => n.id === to);

  const act = async (path: string, body: object, after?: () => void) => {
    setBusy(true);
    const result = await run(path, body);
    setBusy(false);
    if (result.ok) after?.();
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(node.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const tabButton = (value: Tab, label: string, Icon: typeof Send, active: string) => (
    <button
      onClick={() => setTab(value)}
      className={`flex-1 py-1.5 rounded transition-all flex items-center justify-center gap-1 ${
        tab === value ? `bg-[#261811] font-semibold border ${active}` : 'text-[#8C7769] hover:text-[#FAF5F0]'
      }`}
      aria-pressed={tab === value}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );

  const input = 'w-full bg-[#0B0705] border border-[#2C1C14] rounded px-2.5 py-1.5 text-xs text-[#FAF5F0] focus:outline-none focus:border-[#FF5500] font-console';
  const restartIn = node.autoRestartAt ? Math.max(0, Math.round((node.autoRestartAt - clock) / 1000)) : null;

  return (
    <div className="h-full bg-[#140D0A] border border-[#2C1C14] rounded-xl p-5 text-[#FAF5F0] flex flex-col shadow-2xl">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#2C1C14] mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATE_COLOR[state] }} />
            <h3 className="font-bold text-base font-console">{fmt(t.node.title, { id: node.id })}</h3>
            <span className="text-[10px] font-console font-bold px-2 py-0.5 rounded uppercase tracking-wider border" style={{ color: STATE_COLOR[state], borderColor: `${STATE_COLOR[state]}66` }}>
              {t.node.status[state]}
            </span>
          </div>
          <span className="text-[11px] font-console text-[#8C7769]">
            {t.node.address}: {node.address}
          </span>
        </div>
        <button
          onClick={() => act('/api/power', { node: node.id, on: !node.running })}
          disabled={!ready || busy}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-console transition-colors disabled:opacity-40 ${
            node.running ? 'bg-orange-950/80 border-orange-800/80 text-orange-300 hover:bg-orange-900/80' : 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {node.running ? t.node.turnOff : t.node.turnOn}
        </button>
      </div>

      {restartIn !== null && !node.running && <p className="-mt-2 mb-3 text-[11px] font-console text-[#FFA200]">{fmt(t.node.restartsIn, { s: restartIn })}</p>}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-console mb-4 bg-[#0B0705] p-3 rounded-lg border border-[#2C1C14]">
        <div className="col-span-2">
          <span className="text-[10px] text-[#8C7769] block uppercase">{t.node.publicKey}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] truncate">{shortKey(node.publicKey)}</span>
            <button onClick={copyKey} className="p-1 text-[#8C7769] hover:text-[#FFA200]" title={t.node.copy} aria-label={t.node.copy}>
              {copied ? <Check className="w-3.5 h-3.5 text-[#FFA200]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div>
          <span className="text-[10px] text-[#8C7769] block uppercase">{t.node.height}</span>
          <strong className="text-[#FF5500]">#{node.chain.length - 1}</strong>
        </div>
        <div>
          <span className="text-[10px] text-[#8C7769] block uppercase">{t.node.degree}</span>
          <span>
            {degree.in} / {degree.out}
          </span>
        </div>
        <div className="col-span-2 text-[11px]">
          {node.invalidAt === null ? (
            <span className="text-emerald-400">✓ {t.node.healthy}</span>
          ) : (
            <span className="text-rose-400">✗ {fmt(t.node.invalidAt, { n: node.invalidAt })}</span>
          )}
          <span className="text-[#8C7769]"> · {t.node.queue}: {node.queue}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-[#0B0705] rounded-lg border border-[#2C1C14] mb-4 text-xs font-console">
        {tabButton('tx', t.node.tabTx, Send, 'border-[#FF5500]/40 text-[#FF5500]')}
        {tabButton('tamper', t.node.tabTamper, ShieldAlert, 'border-rose-500/40 text-rose-400')}
        {tabButton('heal', t.node.tabHeal, Wrench, 'border-sky-500/40 text-sky-300')}
      </div>

      {!node.running && tab !== 'tamper' ? (
        <p className="text-xs text-[#A89689] font-console">{fmt(t.node.offlineNote, { id: node.id })}</p>
      ) : tab === 'tx' ? (
        <form
          className="space-y-3"
          onSubmit={event => {
            event.preventDefault();
            act('/api/tx', { from: node.id, to, message }, () => setMessage(''));
          }}
        >
          <div>
            <label className="text-[11px] font-console text-[#8C7769] block mb-1">{t.node.to}</label>
            <select value={to} onChange={event => setTo(event.target.value)} className={input} required>
              <option value="">{t.node.choose}</option>
              {others.map(other => (
                <option key={other.id} value={other.id}>
                  {other.id} · {shortKey(other.publicKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-console text-[#8C7769]">{t.node.message}</label>
              <span className="text-[10px] text-[#8C7769] tabular-nums">
                {message.length}/{messageLimit}
              </span>
            </div>
            <input value={message} maxLength={messageLimit} onChange={event => setMessage(event.target.value)} className={input} required />
          </div>
          <p className="text-[10.5px] text-[#8C7769] leading-relaxed">
            {fmt(t.node.txHint, { id: node.id })}{' '}
            <code className="text-[#E5D7CE] break-words">
              From {shortKey(node.publicKey)} to {receiver ? shortKey(receiver.publicKey) : '…'}, {message || '…'}
            </code>
          </p>
          <button
            type="submit"
            disabled={!ready || busy || !to || !message.trim()}
            className="w-full py-2 px-3 bg-gradient-to-r from-[#FF5500] to-[#C93300] hover:from-[#E84E00] hover:to-[#B32D00] disabled:opacity-40 text-white text-xs font-semibold rounded font-console flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {t.node.send}
          </button>
        </form>
      ) : tab === 'tamper' ? (
        <div className="space-y-3">
          <p className="text-[11px] text-rose-200 bg-rose-950/40 p-2.5 rounded border border-rose-900/60 leading-relaxed">{fmt(t.node.tamperHint, { id: node.id })}</p>
          {editable.length === 0 ? (
            <p className="text-xs text-[#A89689]">{t.node.noBlocks}</p>
          ) : (
            <>
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <label className="text-[11px] font-console text-[#8C7769]">{t.node.block}</label>
                <select value={selectedBlock ?? ''} onChange={event => setBlockNumber(Number(event.target.value))} className={input}>
                  {editable.map(block => (
                    <option key={`${block.number_of_block}-${block.hash}`} value={block.number_of_block}>
                      #{block.number_of_block} · {block.text ?? block.message.slice(0, 30)}
                    </option>
                  ))}
                </select>
                <label className="text-[11px] font-console text-[#8C7769]">{t.node.newText}</label>
                <input value={tamperText} maxLength={messageLimit} onChange={event => setTamperText(event.target.value)} className={`${input} text-rose-300`} />
              </div>
              <button
                onClick={() => act('/api/tamper', { node: node.id, block: selectedBlock, message: tamperText })}
                disabled={!ready || busy || selectedBlock === null || !tamperText.trim()}
                className="w-full py-2 px-3 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold rounded font-console flex items-center justify-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {t.node.tamperBtn}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-[#E5D7CE] leading-relaxed bg-[#0B0705] p-2.5 rounded border border-[#2C1C14]">{t.node.healHint}</p>
          <div>
            <div className="text-[10px] uppercase text-[#8C7769] font-console mb-1.5">{fmt(t.node.order, { id: node.id })}</div>
            <ol className="flex flex-wrap gap-1.5 text-[11px] font-console">
              {nearestOrder(node).map((peer, i) => (
                <li key={peer.id} className={`px-2 py-1 rounded border ${peer.status === 'Online' ? 'border-sky-800 text-sky-200' : 'border-[#2C1C14] text-[#8C7769] line-through'}`}>
                  {i + 1}. {peer.id} · {peer.latencyMs !== null ? `${peer.latencyMs} ms` : '—'}
                </li>
              ))}
            </ol>
          </div>
          <button
            onClick={() => act('/api/heal', { node: node.id })}
            disabled={!ready || busy}
            className="w-full py-2 px-3 bg-gradient-to-r from-sky-500 to-sky-700 hover:opacity-90 disabled:opacity-40 text-white text-xs font-bold rounded font-console flex items-center justify-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5" />
            {t.node.healBtn}
          </button>
        </div>
      )}
    </div>
  );
}
