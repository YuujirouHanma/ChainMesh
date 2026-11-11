import { useEffect, useState } from 'react';
import type { Strings } from '../../i18n';
import { buildEdges, circlePositions, nodeState, STATE_COLOR } from '../../lib/graph';
import type { ApiNode, Packet } from '../../types';

interface NetworkGraphProps {
  t: Strings;
  nodes: ApiNode[];
  selected: string;
  onSelect: (id: string) => void;
  packets: Packet[];
  reducedMotion: boolean;
}

const PACKET_COLOR = { block: '#FFA200', sync: '#38BDF8', fork: '#F472B6' } as const;

export function NetworkGraph({ t, nodes, selected, onSelect, packets, reducedMotion }: NetworkGraphProps) {
  const width = 520;
  const height = 380;
  const positions = circlePositions(nodes.length, width / 2, height / 2 + 6, 138);
  const index = Object.fromEntries(nodes.map((node, i) => [node.id, i]));
  const edges = buildEdges(nodes);
  const running = nodes.filter(n => n.running).length;
  const target = (running * (running - 1)) / 2;
  const connected = edges.filter(e => e.state === 'both').length;
  const complete = running > 1 && connected === target;
  const [, setTick] = useState(0);

  const weightOf = (a: string, b: string) => edges.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))?.weight ?? 20;
  const now = performance.now();
  const live = reducedMotion
    ? []
    : packets
        .map(p => ({ ...p, progress: (now - p.started) / (450 + weightOf(p.from, p.to) * 14) }))
        .filter(p => p.progress >= 0 && p.progress < 1 && index[p.from] !== undefined && index[p.to] !== undefined);

  useEffect(() => {
    if (!live.length) return;
    const frame = requestAnimationFrame(() => setTick(n => n + 1));
    return () => cancelAnimationFrame(frame);
  });

  return (
    <div className="relative w-full h-full min-h-[340px] bg-[#0B0705] rounded-xl border border-[#2C1C14] overflow-hidden select-none shadow-2xl">
      <div
        className="absolute inset-0 opacity-[0.09] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#FF5500 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      <svg viewBox={`0 0 ${width} ${height}`} className="relative w-full h-full" role="img" aria-label="network graph">
        <defs>
          <marker id="one-way" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#FFA200" />
          </marker>
        </defs>
        {edges.map(edge => {
          const p = positions[index[edge.a]];
          const q = positions[index[edge.b]];
          const touchesSelected = edge.a === selected || edge.b === selected;
          const style = {
            both: { stroke: touchesSelected ? '#FF5500' : '#5A3A28', width: touchesSelected ? 2.2 : 1.3, dash: undefined, opacity: 0.95 },
            one: { stroke: '#FFA200', width: 1.6, dash: '6 4', opacity: 0.9 },
            down: { stroke: '#7F1D1D', width: 1.2, dash: '3 5', opacity: 0.8 },
            off: { stroke: '#3A2A20', width: 1, dash: '3 6', opacity: 0.5 },
          }[edge.state];
          const [from, to] = edge.state === 'one' ? (edge.ab ? [p, q] : [q, p]) : [p, q];
          const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
          const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
          return (
            <g key={`${edge.a}-${edge.b}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={edge.state === 'one' ? to.x - (dx / len) * 26 : to.x}
                y2={edge.state === 'one' ? to.y - (dy / len) * 26 : to.y}
                stroke={style.stroke}
                strokeWidth={style.width}
                strokeDasharray={style.dash}
                strokeOpacity={style.opacity}
                markerEnd={edge.state === 'one' ? 'url(#one-way)' : undefined}
              />
              {edge.state !== 'off' && edge.weight !== null && (
                <g transform={`translate(${mx}, ${my})`}>
                  <rect x="-19" y="-8" width="38" height="16" rx="3" fill="#140D0A" stroke={touchesSelected ? '#FF5500' : '#2C1C14'} strokeWidth="0.8" />
                  <text textAnchor="middle" dy="3.5" fontSize="8.5" fontFamily="var(--font-mono)" fill={touchesSelected ? '#FFA200' : '#C7B5A7'}>
                    {edge.weight.toFixed(edge.weight < 10 ? 1 : 0)} ms
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {live.map(packet => {
          const p = positions[index[packet.from]];
          const q = positions[index[packet.to]];
          const x = p.x + (q.x - p.x) * packet.progress;
          const y = p.y + (q.y - p.y) * packet.progress;
          return (
            <g key={packet.id} transform={`translate(${x}, ${y})`}>
              <circle r="8" fill={PACKET_COLOR[packet.kind]} opacity="0.25" />
              <circle r="4.5" fill={PACKET_COLOR[packet.kind]} />
            </g>
          );
        })}

        {nodes.map((node, i) => {
          const { x, y } = positions[i];
          const state = nodeState(node);
          const color = STATE_COLOR[state];
          const isSelected = node.id === selected;
          const heightLabel = node.running ? `h=${node.chain.length - 1}` : t.demo.off;
          return (
            <g
              key={node.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelect(node.id)}
              onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && onSelect(node.id)}
              tabIndex={0}
              role="button"
              aria-label={`Node ${node.id}`}
              className="cursor-pointer outline-none"
            >
              {isSelected && <circle r="30" fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 3" className={reducedMotion ? '' : 'animate-spin-slow'} />}
              {(state === 'mining' || state === 'syncing') && !reducedMotion && (
                <circle r="26" fill="none" stroke={color} strokeWidth="2" opacity="0.6">
                  <animate attributeName="r" values="23;31;23" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0.1;0.7" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r="22" fill="#140D0A" stroke={isSelected ? '#FFA200' : color} strokeWidth={isSelected ? 2.8 : 2.2} opacity={node.running ? 1 : 0.6} />
              <text textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fontFamily="var(--font-mono)" fill="#FAF5F0">
                {node.id}
              </text>
              <circle cx="15" cy="-15" r="4.5" fill={color} stroke="#140D0A" strokeWidth="1.5" />
              <text textAnchor="middle" dy="38" fontSize="9.5" fontFamily="var(--font-mono)" fill={isSelected ? '#FFA200' : '#A89689'}>
                {heightLabel}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute top-3 left-3 flex items-center gap-2 text-[11px] font-console bg-[#140D0A]/95 border border-[#2C1C14] text-[#E5D7CE] px-2.5 py-1 rounded-md">
        <span className={complete ? 'text-[#FF5500] font-bold' : 'text-[#FFA200] font-bold'}>
          K{running} {complete ? t.demo.complete : `${t.demo.forming} ${connected}/${target}`}
        </span>
        <span className="text-[#4A3525]">|</span>
        <span className="tabular-nums">|E| = {target}</span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-console text-[#8C7769]">
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-[#FF5500]" />
          {t.demo.legendBoth}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-dashed border-[#FFA200]" />
          {t.demo.legendOne}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 border-t-2 border-dotted border-[#7F1D1D]" />
          {t.demo.legendDown}
        </span>
        <span className="ml-auto hidden sm:inline">{t.demo.graphHint}</span>
      </div>
    </div>
  );
}
