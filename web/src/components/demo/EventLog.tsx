import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Terminal, Trash2, User, Users } from 'lucide-react';
import { fmt, type Strings } from '../../i18n';
import { clock } from '../../lib/format';
import type { ApiBlock, Category, SandboxEvent } from '../../types';

const CATEGORY_STYLE: Record<Category, string> = {
  MINER: 'bg-orange-950/80 text-orange-400 border-orange-800/80',
  FORK: 'bg-pink-950/70 text-pink-300 border-pink-800',
  SYNC: 'bg-sky-950/70 text-sky-300 border-sky-800',
  NETWORK: 'bg-[#1C130E] text-[#E5D7CE] border-[#3D2619]',
  TAMPER: 'bg-rose-950/80 text-rose-300 border-rose-800',
  SYSTEM: 'bg-purple-950/70 text-purple-300 border-purple-800',
};
const FILTERS: Array<'ALL' | Category> = ['ALL', 'MINER', 'FORK', 'SYNC', 'NETWORK', 'TAMPER'];

export function storyText(t: Strings, event: SandboxEvent, lang: 'en' | 'id'): string {
  const s = t.story_events as Record<string, string>;
  const d = (event.data ?? {}) as Record<string, any>;
  const n = (value: unknown) => (typeof value === 'number' ? value.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US') : String(value ?? '—'));
  switch (event.code) {
    case 'reset':
      return fmt(s.reset, { reason: s[`reason_${d.reason}`] ?? d.reason });
    case 'heal':
      return fmt(s.heal, {
        node: d.node,
        order:
          (d.order ?? [])
            .map((peer: any) => `${peer.node} (${peer.latencyMs ?? '—'} ms${peer.status !== 'Online' ? `, ${peer.status}` : ''})`)
            .join(' → ') || '—',
      });
    case 'fork_result':
      return fmt(s.fork_result, {
        height: d.height,
        winner: d.winner?.node,
        winnerPow: n(d.winner?.pow),
        loser: d.loser?.node,
        loserPow: n(d.loser?.pow),
      });
    case 'fork_none':
      return fmt(s.fork_none, { a: d.a?.number, b: d.b?.number });
    default:
      return fmt(s[event.code ?? ''] ?? event.code ?? '', d);
  }
}

interface EventLogProps {
  t: Strings;
  lang: 'en' | 'id';
  events: SandboxEvent[];
  you: string;
  blocks: Record<string, ApiBlock>;
  onClear: () => void;
}

export function EventLog({ t, lang, events, you, blocks, onClear }: EventLogProps) {
  const [filter, setFilter] = useState<'ALL' | Category>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const shown = filter === 'ALL' ? events : events.filter(event => event.cat === filter);

  useEffect(() => {
    if (autoScroll && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [shown.length, autoScroll]);

  const minerOf = (prefix: string) => Object.values(blocks).find(block => block.hash.startsWith(prefix))?.from;

  return (
    <div className="bg-[#0B0705] border border-[#2C1C14] rounded-xl p-5 shadow-2xl flex flex-col h-[440px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2C1C14] mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#FF5500]" />
            <h3 className="font-bold text-sm font-console text-white">{t.log.title}</h3>
            <span className="text-[10px] font-console bg-[#140D0A] border border-[#2C1C14] text-[#8C7769] px-1.5 py-0.5 rounded">
              {fmt(t.log.events, { n: events.length })}
            </span>
          </div>
          <p className="text-[11px] text-[#8C7769] mt-0.5">{t.log.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-console">
          {FILTERS.map(category => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === category ? 'bg-gradient-to-r from-[#FF5500] to-[#C93300] text-white font-semibold' : 'bg-[#140D0A] text-[#8C7769] hover:text-[#FAF5F0] border border-[#2C1C14]'
              }`}
            >
              {category === 'ALL' ? t.log.all : category}
            </button>
          ))}
          <button
            onClick={() => setAutoScroll(v => !v)}
            className={`px-2 py-0.5 rounded text-[10px] border flex items-center gap-1 ${autoScroll ? 'bg-[#261811] border-[#FF5500]/40 text-[#FFA200]' : 'bg-[#140D0A] border-[#2C1C14] text-[#8C7769]'}`}
            aria-pressed={autoScroll}
          >
            <ArrowDown className="w-3 h-3" />
            {t.log.autoScroll}
          </button>
          <button onClick={onClear} title={t.log.clear} aria-label={t.log.clear} className="p-1 rounded text-[#8C7769] hover:text-rose-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div ref={box} className="flex-1 overflow-y-auto space-y-1 font-console text-xs pr-2" aria-live="polite">
        {shown.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[#6B5E57] italic">{t.log.empty}</div>
        ) : (
          shown.map(event => {
            const story = event.kind === 'story';
            const level =
              event.kind === 'broadcast' && event.data?.groups
                ? minerOf(String(event.data.groups[1])) === event.node
                  ? t.log.root
                  : t.log.relay
                : null;
            return (
              <div key={event.id} className={`p-1.5 rounded flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 ${story ? 'bg-[#1C130E] border-l-2 border-[#FF5500] pl-2' : 'hover:bg-[#140D0A]/60'}`}>
                <div className="flex items-center gap-1.5 shrink-0 text-[10.5px]">
                  <span className="text-[#8C7769] tabular-nums">{clock(event.t)}</span>
                  <span className={`px-1.5 rounded font-semibold text-[9.5px] border ${CATEGORY_STYLE[event.cat] ?? CATEGORY_STYLE.SYSTEM}`}>{event.cat}</span>
                  {event.node && <span className="px-1.5 rounded bg-[#FF5500]/15 text-[#FFA200] font-bold text-[10px]">{event.node}</span>}
                  {level && <span className="text-[9.5px] text-[#8C7769]">[{level}]</span>}
                </div>
                <div className={`flex-1 break-words leading-relaxed text-[11px] ${story ? 'text-[#FAF5F0] font-sans' : 'text-[#E5D7CE]'}`} title={event.raw}>
                  {story ? storyText(t, event, lang) : event.text}
                </div>
                {event.by && (
                  <span
                    className={`inline-flex items-center gap-0.5 px-1 rounded text-[9px] border shrink-0 ${
                      event.by === you ? 'bg-orange-950/80 text-orange-300 border-orange-800/80' : 'bg-blue-950 text-blue-300 border-blue-800/60'
                    }`}
                  >
                    {event.by === you ? <User className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                    {event.by === you ? t.log.you : t.log.visitor}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
