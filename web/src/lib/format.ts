export function shortHash(hash: string | null | undefined, lead = 8, tail = 4): string {
  if (!hash) return '—';
  if (hash.length <= lead + tail + 1) return hash;
  return `${hash.slice(0, lead)}…${hash.slice(-tail)}`;
}

export function shortKey(key: string | null | undefined): string {
  if (!key) return '—';
  return key.length <= 14 ? key : `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export function clock(t: number): string {
  const d = new Date(t);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export function countdown(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function number(value: number | null | undefined, lang: 'en' | 'id'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US');
}
