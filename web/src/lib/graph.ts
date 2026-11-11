import type { ApiNode, PeerInfo } from '../types';

export function circlePositions(count: number, cx: number, cy: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(count, 1);
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

export type EdgeState = 'both' | 'one' | 'down' | 'off';

export interface EdgeView {
  a: string;
  b: string;
  /** a -> b: client a terhubung ke server b (Status "Online" di ConnectionDB milik a) */
  ab: boolean;
  ba: boolean;
  weight: number | null;
  state: EdgeState;
}

export function buildEdges(nodes: ApiNode[]): EdgeView[] {
  const edges: EdgeView[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const live = a.running && b.running;
      const ab = live && a.peers[b.id]?.status === 'Online';
      const ba = live && b.peers[a.id]?.status === 'Online';
      const weights = [a.peers[b.id]?.latencyMs, b.peers[a.id]?.latencyMs].filter(
        (w): w is number => typeof w === 'number',
      );
      edges.push({
        a: a.id,
        b: b.id,
        ab,
        ba,
        weight: weights.length ? weights.reduce((s, w) => s + w, 0) / weights.length : null,
        state: !live ? 'off' : ab && ba ? 'both' : ab || ba ? 'one' : 'down',
      });
    }
  }
  return edges;
}

/** Sama dengan BlockChainSync._nearest_neighbours: peer Online dahulu, lalu latency terkecil. */
export function nearestOrder(node: ApiNode): Array<PeerInfo & { id: string }> {
  return Object.entries(node.peers)
    .map(([id, info]) => ({ id, ...info }))
    .sort((x, y) => {
      const online = Number(x.status !== 'Online') - Number(y.status !== 'Online');
      if (online) return online;
      const lx = x.latencyMs ?? Number.POSITIVE_INFINITY, ly = y.latencyMs ?? Number.POSITIVE_INFINITY;
      return lx === ly ? 0 : lx < ly ? -1 : 1;
    });
}

export type NodeState = 'online' | 'offline' | 'mining' | 'syncing' | 'broken';

export function nodeState(node: ApiNode): NodeState {
  if (!node.running) return 'offline';
  if (node.activity) return node.activity;
  if (node.invalidAt !== null) return 'broken';
  return 'online';
}

export function degrees(node: ApiNode, nodes: ApiNode[]) {
  const running = new Set(nodes.filter(n => n.running).map(n => n.id));
  const peers = Object.entries(node.peers).filter(([id]) => running.has(id));
  return {
    out: node.running ? peers.filter(([, p]) => p.status === 'Online').length : 0,
    in: node.running ? peers.filter(([, p]) => p.inbound).length : 0,
  };
}

export const STATE_COLOR: Record<NodeState, string> = {
  online: '#FF5500',
  offline: '#6B5E57',
  mining: '#FFA200',
  syncing: '#38BDF8',
  broken: '#EF4444',
};
