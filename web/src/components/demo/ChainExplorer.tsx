import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { fmt, type Strings } from '../../i18n';
import { shortHash } from '../../lib/format';
import { nodeState, STATE_COLOR } from '../../lib/graph';
import type { ApiBlock, ApiNode, ChainRow } from '../../types';

export interface Ghost {
  node: string;
  block: ApiBlock;
  at: number;
  dropped: boolean;
}

interface ChainExplorerProps {
  t: Strings;
  lang: 'en' | 'id';
  nodes: ApiNode[];
  blocks: Record<string, ApiBlock>;
  ghosts: Ghost[];
  firstSeen: Map<string, number>;
  remined: Set<string>;
}

interface Selected {
  node: string;
  row: ChainRow | null;
  block: ApiBlock;
}

export function ChainExplorer({ t, lang, nodes, blocks, ghosts, firstSeen, remined }: ChainExplorerProps) {
  const [selected, setSelected] = useState<Selected | null>(null);
  const legend: Array<[string, string]> = [
    ['bg-[#FF5500]/20 border-[#FF5500]', t.explorer.legendValid],
    ['bg-amber-500/20 border-amber-400', t.explorer.legendNew],
    ['bg-rose-500/25 border-rose-500', t.explorer.legendInvalid],
    ['bg-rose-950/40 border-rose-900', t.explorer.legendUntrusted],
    ['bg-purple-500/20 border-purple-500 border-dashed', t.explorer.legendGhost],
    ['bg-emerald-500/20 border-emerald-500', t.explorer.legendRemined],
  ];

  return (
    <div className="bg-[#0B0705] border border-[#2C1C14] rounded-xl p-5 shadow-2xl">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-4 border-b border-[#2C1C14] mb-5">
        <div>
          <h3 className="font-bold text-base font-console text-white">{t.explorer.title}</h3>
          <p className="text-xs text-[#8C7769] mt-0.5">{t.explorer.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-console text-[#8C7769]">
          {legend.map(([swatch, label]) => (
            <span key={label} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm border ${swatch}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {nodes.map(node => (
          <ChainRowView
            key={node.id}
            t={t}
            lang={lang}
            node={node}
            blocks={blocks}
            ghosts={ghosts.filter(g => g.node === node.id)}
            firstSeen={firstSeen}
            remined={remined}
            onOpen={setSelected}
          />
        ))}
      </div>

      {selected && <BlockDetail t={t} lang={lang} selected={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ChainRowView({
  t,
  lang,
  node,
  blocks,
  ghosts,
  firstSeen,
  remined,
  onOpen,
}: {
  t: Strings;
  lang: 'en' | 'id';
  node: ApiNode;
  blocks: Record<string, ApiBlock>;
  ghosts: Ghost[];
  firstSeen: Map<string, number>;
  remined: Set<string>;
  onOpen: (selected: Selected) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const state = nodeState(node);
  const now = Date.now();

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [node.chain.length, ghosts.length]);

  const items: Array<{ key: string; block: ApiBlock; row: ChainRow | null; ghost?: Ghost }> = [];
  node.chain.forEach((row, index) => {
    const block = blocks[row.d];
    if (!block) return;
    items.push({ key: `${row.d}-${index}`, block, row });
    ghosts
      .filter(g => g.block.number_of_block === block.number_of_block)
      .forEach(ghost => items.push({ key: `ghost-${ghost.block.hash}-${ghost.at}`, block: ghost.block, row: null, ghost }));
  });
  ghosts
    .filter(g => g.block.number_of_block >= node.chain.length)
    .forEach(ghost => items.push({ key: `ghost-${ghost.block.hash}-${ghost.at}`, block: ghost.block, row: null, ghost }));

  return (
    <div
      className={`p-3.5 rounded-lg border transition-colors ${
        state === 'broken' ? 'bg-[#260E0A] border-rose-900/60' : !node.running ? 'bg-[#140D0A]/40 border-[#2C1C14]/60' : 'bg-[#140D0A] border-[#2C1C14]'
      }`}
    >
      <div className="flex items-center justify-between mb-2.5 text-xs font-console">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATE_COLOR[state] }} />
          <span className="font-bold text-white">Node {node.id}</span>
          <span className="text-[#8C7769] text-[11px] hidden sm:inline">{node.address}</span>
        </div>
        <span className="text-[#A89689] text-[11px]">
          {t.node.height}: <strong className="text-[#FF5500] tabular-nums">#{node.chain.length - 1}</strong>
          {!node.running && <span className="ml-2 text-[#8C7769]">({t.explorer.off})</span>}
        </span>
      </div>
      <div ref={scroller} className={`flex items-stretch gap-2 overflow-x-auto pb-2 pt-1 ${node.running ? '' : 'opacity-60'}`}>
        {items.map(({ key, block, row, ghost }) => {
          const seen = row ? firstSeen.get(row.d) ?? 0 : 0;
          const isNew = Boolean(row && seen && now - seen < 4000);
          const isRemined = Boolean(block.from && remined.has(`${block.from}:${block.number_of_block}`));
          const status = ghost ? (ghost.dropped ? 'dropped' : 'replaced') : row!.s;
          const style = ghost
            ? 'bg-purple-950/30 border-purple-500 border-dashed text-purple-200 opacity-80'
            : status === 'invalid'
              ? 'bg-rose-950/50 border-rose-500 text-rose-100'
              : status === 'untrusted'
                ? 'bg-rose-950/20 border-rose-900 text-rose-200/80'
                : isNew
                  ? 'bg-amber-950/40 border-amber-400 animate-flash-in'
                  : isRemined
                    ? 'bg-emerald-950/30 border-emerald-600'
                    : 'bg-[#1C130E] border-[#2C1C14] hover:border-[#FF5500]/50';
          const badge = ghost
            ? ghost.dropped
              ? t.explorer.dropped
              : t.explorer.replaced
            : status === 'invalid'
              ? t.explorer.invalid
              : status === 'untrusted'
                ? t.explorer.untrusted
                : isRemined
                  ? t.explorer.remined
                  : t.explorer.valid;
          const badgeStyle = ghost
            ? 'bg-purple-600 text-white'
            : status === 'invalid'
              ? 'bg-rose-600 text-white'
              : status === 'untrusted'
                ? 'bg-rose-900 text-rose-200'
                : isRemined
                  ? 'bg-emerald-600 text-white'
                  : 'bg-orange-950/80 text-orange-400 border border-orange-800/80';
          const genesis = block.number_of_block === 0;
          return (
            <button
              key={key}
              onClick={() => onOpen({ node: node.id, row, block })}
              className={`min-w-[176px] max-w-[190px] p-2.5 rounded-md border text-left text-xs font-console transition-transform shrink-0 hover:-translate-y-0.5 ${style}`}
            >
              <div className="flex items-center justify-between pb-1.5 border-b border-white/10 mb-1.5">
                <span className="font-bold text-white text-[11px]">{fmt(t.explorer.block, { n: block.number_of_block })}</span>
                <span className={`text-[8.5px] px-1.5 rounded font-bold uppercase ${badgeStyle}`}>{badge}</span>
              </div>
              {genesis ? (
                <div className="text-[10px] text-[#A89689] py-3">{t.explorer.genesis} · hash "0"</div>
              ) : (
                <div className="space-y-0.5 text-[10px]">
                  <div>
                    <span className="text-[#8C7769]">hash </span>
                    <span className={status === 'invalid' ? 'text-rose-300' : 'text-[#FF5500]'}>
                      <b>{block.hash.slice(0, 4)}</b>
                      {shortHash(block.hash, 10, 4).slice(4)}
                    </span>
                  </div>
                  <div className="text-[#A89689]">
                    <span className="text-[#8C7769]">prev </span>
                    {shortHash(block.prev_hash, 8, 4)}
                  </div>
                  <div className="pt-1 text-[#FAF5F0] truncate" title={block.text ?? block.message}>
                    <span className="text-[#FFA200]">
                      {block.from ?? '?'}→{block.to ?? '?'}
                    </span>{' '}
                    {block.text ?? block.message}
                  </div>
                  <div className="pt-1 flex justify-between text-[#8C7769] border-t border-white/5 mt-1">
                    <span>
                      PoW <b className="text-white tabular-nums">{block.proof_of_work.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')}</b>
                    </span>
                    {row && row.e.length > 0 && <span className="text-rose-300">✗ {row.e.length}</span>}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BlockDetail({ t, lang, selected, onClose }: { t: Strings; lang: 'en' | 'id'; selected: Selected; onClose: () => void }) {
  const { block, row } = selected;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const fields: Array<[string, string]> = [
    ['number_of_block', String(block.number_of_block)],
    ['hash', block.hash],
    ['prev_hash', block.prev_hash],
    ['message', block.message],
    ['nonce', block.nonce.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')],
    ['proof_of_work', block.proof_of_work.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US')],
    ['timeStamp', block.timeStamp],
    ['signature', block.signature],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[#0B0705] border border-[#2C1C14] rounded-xl shadow-2xl" onClick={event => event.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2C1C14]">
          <span className="font-console font-bold text-white text-sm">
            {t.explorer.details} · Node {selected.node} · #{block.number_of_block}
          </span>
          <button onClick={onClose} className="p-1 text-[#8C7769] hover:text-white" aria-label={t.explorer.close}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="p-5 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs font-console">
          {fields.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-[#8C7769]">{key}</dt>
              <dd className="text-[#FAF5F0] break-all">{value}</dd>
            </div>
          ))}
        </dl>
        {row && row.e.length > 0 && (
          <div className="mx-5 mb-5 p-3 rounded border border-rose-800 bg-rose-950/40 text-xs font-console text-rose-200">
            {t.explorer.errors}: {row.e.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
