import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { fmt, type Strings } from '../../i18n';
import { buildEdges } from '../../lib/graph';
import type { Sandbox } from '../../lib/useSandbox';
import type { ActionResult, ApiBlock, ChainRow, Packet } from '../../types';
import { SectionHeader } from '../layout/SectionHeader';
import { ChainExplorer, type Ghost } from './ChainExplorer';
import { EventLog } from './EventLog';
import { LiveStats } from './LiveStats';
import { NetworkGraph } from './NetworkGraph';
import { NodePanel } from './NodePanel';
import { ScenarioBar } from './ScenarioBar';
import { StatusBanner } from './StatusBanner';

const GHOST_MS = 12_000;

interface DemoSectionProps {
  t: Strings;
  lang: 'en' | 'id';
  sandbox: Sandbox;
  reducedMotion: boolean;
}

export function DemoSection({ t, lang, sandbox, reducedMotion }: DemoSectionProps) {
  const { status, snapshot, events, you, quota, act, retry, clearEvents } = sandbox;
  const [selected, setSelected] = useState('A');
  const [error, setError] = useState<string | null>(null);
  const nodes = snapshot?.nodes ?? [];
  const blocks = snapshot?.blocks ?? {};
  const ready = status === 'online' && Boolean(snapshot?.meta.ready);
  const node = nodes.find(n => n.id === selected) ?? nodes[0] ?? null;

  const run = useCallback(
    async (path: string, body?: object): Promise<ActionResult> => {
      const result = await act(path, body);
      if (!result.ok) {
        const code = result.error ?? 'network';
        const template = (t.errors as Record<string, string>)[code] ?? t.errors.network;
        setError(fmt(template, result as Record<string, any>));
      } else {
        setError(null);
      }
      return result;
    },
    [act, t],
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const packets = usePackets(events, reducedMotion);
  const history = useChainHistory(snapshot);
  const { firstSeen } = history;
  // Blok milik node yang kalah fork sering diganti dalam <0,4 detik (lebih cepat dari snapshot),
  // jadi kartunya juga dibuat dari event "fork_result" yang memuat hash dan PoW-nya.
  const ghosts = [...history.ghosts];
  for (const event of events) {
    const loser = event.data?.loser;
    if (event.code !== 'fork_result' || !loser || Date.now() - event.t > GHOST_MS) continue;
    const known = ghosts.some(g => g.node === loser.node && g.block.number_of_block === loser.number && g.block.hash.startsWith(loser.hash));
    if (!known) {
      ghosts.push({
        node: loser.node,
        at: event.t,
        dropped: false,
        block: {
          number_of_block: loser.number,
          hash: `${loser.hash}…`,
          prev_hash: '',
          message: '',
          nonce: loser.pow + 1,
          proof_of_work: loser.pow,
          timeStamp: '',
          signature: '',
          from: loser.node,
          to: event.data?.winner?.node ?? null,
          text: `fork test by ${loser.node}`,
        },
      });
    }
  }
  const remined = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      if (event.kind === 'remined' && event.node && event.data?.groups) set.add(`${event.node}:${event.data.groups[0]}`);
    }
    return set;
  }, [events]);

  const edges = buildEdges(nodes);
  const height = nodes.length ? Math.max(...nodes.map(n => n.chain.length - 1)) : 0;

  return (
    <section id="console" className="py-16 bg-[#070504] text-[#FAF5F0] border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <SectionHeader eyebrow={t.demo.eyebrow} title={t.demo.title} subtitle={t.demo.subtitle} dark />
          <div className="mb-10 flex items-center gap-3 text-xs font-console bg-[#140D0A] border border-[#2C1C14] px-3 py-1.5 rounded-lg text-[#E5D7CE] self-start lg:self-end">
            <span>
              {t.demo.nodes} <strong className="text-[#FFA200]">{nodes.filter(n => n.running).length}</strong>
            </span>
            <span className="text-[#4A3525]">|</span>
            <span>
              {t.demo.edges} <strong className="text-[#FFA200]">{edges.filter(e => e.state === 'both').length}</strong>
            </span>
            <span className="text-[#4A3525]">|</span>
            <span>
              {t.demo.height} <strong className="text-[#FFA200]">{height}</strong>
            </span>
          </div>
        </div>
        <p className="-mt-6 mb-6 text-[11px] text-[#8C7769] font-console">{t.demo.emulated}</p>

        <StatusBanner t={t} status={status} snapshot={snapshot} quota={quota} onRetry={retry} />
        <ScenarioBar
          t={t}
          ready={ready}
          running={snapshot?.meta.scenario ?? null}
          canAddNode={nodes.length < (snapshot?.meta.maxNodes ?? 6)}
          onScenario={name => run('/api/scenario', { name })}
          onAddNode={() => run('/api/nodes')}
          onReset={() => run('/api/reset')}
        />

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-700 text-rose-200 text-xs font-console flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} aria-label="close">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 items-stretch">
          <div className="lg:col-span-7">
            <NetworkGraph t={t} nodes={nodes} selected={node?.id ?? ''} onSelect={setSelected} packets={packets} reducedMotion={reducedMotion} />
          </div>
          <div className="lg:col-span-5">
            <NodePanel t={t} node={node} nodes={nodes} blocks={blocks} ready={ready} messageLimit={snapshot?.meta.messageLimit ?? 64} run={run} />
          </div>
        </div>

        <div className="mb-6">
          <ChainExplorer t={t} lang={lang} nodes={nodes} blocks={blocks} ghosts={ghosts} firstSeen={firstSeen} remined={remined} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <EventLog t={t} lang={lang} events={events} you={you} blocks={blocks} onClear={clearEvents} />
          </div>
          <div className="lg:col-span-4">
            <LiveStats t={t} lang={lang} stats={snapshot?.meta.stats ?? null} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Paket yang dianimasikan: blok yang benar-benar diterima / disinkronkan menurut log node. */
function usePackets(events: Sandbox['events'], reducedMotion: boolean): Packet[] {
  const [packets, setPackets] = useState<Packet[]>([]);
  const last = useRef(0);
  useEffect(() => {
    const fresh = events.filter(event => event.id > last.current);
    if (!events.length) {
      last.current = 0;
      return;
    }
    last.current = events[events.length - 1].id;
    if (reducedMotion) return;
    const started = performance.now();
    const recent = Date.now() - 3000;
    const add: Packet[] = [];
    for (const event of fresh) {
      if (!event.node || !event.peer || event.t < recent) continue;
      const kind = event.kind === 'received' ? 'block' : event.kind === 'adopted' ? 'sync' : event.kind === 'fork_kept' || event.kind === 'ahead' ? 'fork' : null;
      if (kind) add.push({ id: `p${event.id}`, from: event.peer, to: event.node, kind, started });
    }
    if (add.length) setPackets(previous => [...previous.filter(p => started - p.started < 3000), ...add].slice(-40));
  }, [events, reducedMotion]);
  return packets;
}

/** Ingat blok yang hilang dari chain sebuah node (kalah fork / dibuang saat perbaikan) dan kapan blok pertama kali muncul. */
function useChainHistory(snapshot: Sandbox['snapshot']) {
  const firstSeen = useRef(new Map<string, number>());
  const previous = useRef<{ startedAt: number; chains: Record<string, ChainRow[]>; blocks: Record<string, ApiBlock> } | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);

  useEffect(() => {
    if (!snapshot) return;
    const now = Date.now();
    const before = previous.current;
    const fresh = !before || before.startedAt !== snapshot.meta.startedAt;
    if (fresh) {
      firstSeen.current = new Map();
      setGhosts([]);
    }
    for (const digest of Object.keys(snapshot.blocks)) {
      if (!firstSeen.current.has(digest)) firstSeen.current.set(digest, fresh ? 0 : now);
    }
    if (!fresh && before) {
      const added: Ghost[] = [];
      for (const node of snapshot.nodes) {
        const old = before.chains[node.id];
        if (!old) continue;
        const digests = new Set(node.chain.map(row => row.d));
        const hashes = new Set(node.chain.map(row => snapshot.blocks[row.d]?.hash));
        for (const row of old) {
          const block = before.blocks[row.d];
          // isi blok berubah tetapi hash-nya sama = blok yang diedit / dipulihkan, bukan blok yang hilang
          if (!block || digests.has(row.d) || hashes.has(block.hash)) continue;
          added.push({ node: node.id, block, at: now, dropped: row.s !== 'valid' });
        }
      }
      if (added.length) setGhosts(current => [...current.filter(g => now - g.at < GHOST_MS), ...added]);
    }
    previous.current = {
      startedAt: snapshot.meta.startedAt,
      chains: Object.fromEntries(snapshot.nodes.map(node => [node.id, node.chain])),
      blocks: snapshot.blocks,
    };
  }, [snapshot]);

  useEffect(() => {
    if (!ghosts.length) return;
    const timer = setTimeout(() => setGhosts(current => current.filter(g => Date.now() - g.at < GHOST_MS)), 2000);
    return () => clearTimeout(timer);
  }, [ghosts]);

  return { ghosts, firstSeen: firstSeen.current };
}
