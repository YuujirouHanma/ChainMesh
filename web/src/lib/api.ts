import type { ActionResult, Quota } from '../types';

// Kosong = server yang sama dengan halaman ini. Isi VITE_API_BASE (mis. https://k-chain.onrender.com)
// jika web di-hosting terpisah dari server demo.
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';

const CLIENT_KEY = 'k-chain-client-id';
let cachedId = '';

/** Id acak per browser, hanya untuk menandai "aksimu" vs "pengunjung lain" di log. */
export function clientId(): string {
  if (cachedId) return cachedId;
  try {
    cachedId = localStorage.getItem(CLIENT_KEY) ?? '';
    if (!cachedId) {
      cachedId = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(CLIENT_KEY, cachedId);
    }
  } catch {
    cachedId = Math.random().toString(36).slice(2);
  }
  return cachedId;
}

export function wsUrl(path: string): string {
  if (API_BASE) return API_BASE.replace(/^http/, 'ws') + path;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

export async function post(path: string, body?: object): Promise<ActionResult & { quota?: Quota }> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId() },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json().catch(() => ({}));
    return { ...data, ok: response.ok && data.ok !== false };
  } catch {
    return { ok: false, error: 'network' };
  }
}
