// Bentuk data dari server demo (demo/sandbox.py). Nama field blok sama dengan BlockChainDB.json.
export type Lang = 'en' | 'id';

export interface ApiBlock {
  number_of_block: number;
  hash: string;
  prev_hash: string;
  message: string;
  nonce: number;
  proof_of_work: number;
  timeStamp: string;
  signature: string;
  /** id node pengirim / penerima, hasil mencocokkan public key di message (null jika tidak dikenal) */
  from: string | null;
  to: string | null;
  /** isi pesan setelah "From <pengirim> to <penerima>, " */
  text: string | null;
}

export type BlockStatus = 'valid' | 'invalid' | 'untrusted';

export interface ChainRow {
  /** kunci ke Snapshot.blocks */
  d: string;
  s: BlockStatus;
  /** flag BlockVerifyStatus yang gagal, mis. InvalidBlockHash */
  e: string[];
}

export interface PeerInfo {
  status: 'Online' | 'Offline' | 'Unknown';
  inbound: boolean;
  latencyMs: number | null;
}

export interface ApiNode {
  id: string;
  address: string;
  port: number;
  running: boolean;
  publicKey: string;
  seed: string | null;
  chain: ChainRow[];
  invalidAt: number | null;
  peers: Record<string, PeerInfo>;
  queue: number;
  activity: 'mining' | 'syncing' | null;
  autoRestartAt: number | null;
}

export interface Stats {
  mined: number;
  avgMineSeconds: number | null;
  reorgs: number;
  repairs: number;
  rejected: number;
  propagations: number;
  avgPropagationMs: number | null;
}

export interface Snapshot {
  nodes: ApiNode[];
  blocks: Record<string, ApiBlock>;
  latency: Record<string, number>;
  meta: {
    ready: boolean;
    scenario: string | null;
    maxNodes: number;
    difficulty: number;
    messageLimit: number;
    startedAt: number;
    resetAt: number;
    maxBlocks: number;
    stats: Stats;
  };
}

export type Category = 'MINER' | 'FORK' | 'SYNC' | 'NETWORK' | 'TAMPER' | 'SYSTEM';

export interface SandboxEvent {
  id: number;
  t: number;
  node: string | null;
  cat: Category;
  kind: string | null;
  code?: string;
  data?: Record<string, any>;
  peer?: string | null;
  text?: string;
  raw?: string;
  by: string | null;
  source: 'node' | 'task' | 'sandbox';
}

export interface QuotaItem {
  left: number;
  max: number;
  retryIn: number;
}

export type Quota = Record<'tx' | 'action' | 'scenario' | 'reset', QuotaItem>;

export type ConnectionStatus = 'connecting' | 'waking' | 'online' | 'offline';

export interface ActionResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Paket yang dianimasikan di graf (dari event "received", "adopted", ...) */
export interface Packet {
  id: string;
  from: string;
  to: string;
  kind: 'block' | 'sync' | 'fork';
  started: number;
}
