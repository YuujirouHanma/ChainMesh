import { ArrowDown, FileText, Github } from 'lucide-react';
import { SITE, STACK, TEAM } from '../../content';
import type { Strings } from '../../i18n';
import { buildEdges, circlePositions, nodeState, STATE_COLOR } from '../../lib/graph';
import type { ApiNode, ConnectionStatus, Snapshot } from '../../types';

interface HeroProps {
  t: Strings;
  lang: 'en' | 'id';
  snapshot: Snapshot | null;
  status: ConnectionStatus;
  onOpenPaper: () => void;
}

const ILLUSTRATION: ApiNode[] = ['A', 'B', 'C', 'D'].map(id => ({
  id,
  address: '',
  port: 0,
  running: true,
  publicKey: '',
  seed: null,
  chain: [],
  invalidAt: null,
  queue: 0,
  activity: null,
  autoRestartAt: null,
  peers: Object.fromEntries(
    ['A', 'B', 'C', 'D'].filter(p => p !== id).map(p => [p, { status: 'Online' as const, inbound: true, latencyMs: null }]),
  ),
}));

export function Hero({ t, lang, snapshot, status, onOpenPaper }: HeroProps) {
  const me = TEAM.find(member => member.me);
  const live = status === 'online' && snapshot && snapshot.nodes.length > 0;
  const nodes = live ? snapshot.nodes : ILLUSTRATION;
  const height = live ? Math.max(...snapshot.nodes.map(n => n.chain.length - 1)) : null;

  return (
    <section id="hero" className="relative overflow-hidden bg-[#070504] text-white border-b border-white/[0.06]">
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#FF5500 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      />
      <div className="absolute -bottom-48 -left-40 w-[560px] h-[560px] rounded-full bg-[#FF5500]/20 blur-[120px] pointer-events-none" />
      <div className="absolute -top-40 right-0 w-[460px] h-[460px] rounded-full bg-[#FFA200]/10 blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-console text-white/80">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5500]" />
            {t.hero.eyebrow}
          </span>
          <h1 className="mt-6 font-academic text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight">
            {t.hero.title1}
            <br />
            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#FF5500] to-[#FFA200]">{t.hero.title2}</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-white/70 leading-relaxed max-w-2xl">{t.hero.subtitle}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#console"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-orange-50 transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
              {t.hero.tryDemo}
            </a>
            <button
              onClick={onOpenPaper}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.06] border border-white/15 text-sm font-medium hover:border-[#FF5500]/60 transition-colors"
            >
              <FileText className="w-4 h-4 text-[#FFA200]" />
              {t.hero.readPaper}
            </button>
            <a
              href={SITE.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2.5 text-sm text-white/70 hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              {t.hero.viewCode}
            </a>
          </div>

          <dl className="mt-10 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm border-t border-white/10 pt-6">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40 font-console">{t.hero.role}</dt>
              <dd className="mt-1 text-white/85">{me?.role[lang]}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40 font-console">{t.hero.team}</dt>
              <dd className="mt-1 text-white/85">{TEAM.map(member => member.name).join(', ')}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40 font-console">{t.hero.course}</dt>
              <dd className="mt-1 text-white/85">{t.hero.courseValue}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/40 font-console">{t.hero.stack}</dt>
              <dd className="mt-1.5 flex flex-wrap gap-1.5">
                {STACK.map(item => (
                  <span key={item} className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-console text-white/80">
                    {item}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        <figure className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#0B0705]/80 p-4 sm:p-5 shadow-2xl shadow-black/60">
          <MiniGraph nodes={nodes} />
          <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-console text-white/60">
            <span className="font-academic italic text-sm text-white/80">{t.hero.figCaption}</span>
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-[#FFA200]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t.hero.figLive} · {snapshot.nodes.filter(n => n.running).length} {t.hero.figNodes} · {t.hero.figHeight} {height}
              </span>
            ) : (
              <span>{t.hero.figOffline}</span>
            )}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function MiniGraph({ nodes }: { nodes: ApiNode[] }) {
  const width = 360;
  const height = 300;
  const positions = circlePositions(nodes.length, width / 2, height / 2, 112);
  const index = Object.fromEntries(nodes.map((node, i) => [node.id, i]));
  const edges = buildEdges(nodes);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="network graph">
      <defs>
        <radialGradient id="hero-node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF5500" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#FF5500" stopOpacity="0" />
        </radialGradient>
      </defs>
      {edges.map(edge => {
        const p = positions[index[edge.a]];
        const q = positions[index[edge.b]];
        const strong = edge.state === 'both';
        return (
          <line
            key={`${edge.a}-${edge.b}`}
            x1={p.x}
            y1={p.y}
            x2={q.x}
            y2={q.y}
            stroke={strong ? '#FF5500' : '#4A3525'}
            strokeOpacity={strong ? 0.7 : 0.5}
            strokeWidth={strong ? 1.6 : 1}
            strokeDasharray={strong ? undefined : '4 4'}
          />
        );
      })}
      {nodes.map((node, i) => {
        const { x, y } = positions[i];
        const color = STATE_COLOR[nodeState(node)];
        return (
          <g key={node.id} transform={`translate(${x}, ${y})`}>
            <circle r="34" fill="url(#hero-node)" opacity={node.running ? 1 : 0.2} />
            <circle r="19" fill="#140D0A" stroke={color} strokeWidth="2.2" />
            <text textAnchor="middle" dy="4.5" fontSize="13" fontWeight="700" fontFamily="var(--font-mono)" fill="#FAF5F0">
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
