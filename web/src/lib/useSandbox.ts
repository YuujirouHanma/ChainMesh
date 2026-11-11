import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionResult, ConnectionStatus, Quota, SandboxEvent, Snapshot } from '../types';
import { clientId, post, wsUrl } from './api';

const MAX_EVENTS = 500;
const WAKE_LIMIT_MS = 120_000;   // hosting gratis bisa butuh ~1 menit untuk bangun
const MAX_DROPS = 6;

/** Koneksi live ke server demo: snapshot node, event log, kuota, dan aksi. */
export function useSandbox() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<SandboxEvent[]>([]);
  const [you, setYou] = useState('');
  const [quota, setQuota] = useState<Quota | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastEventId = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let connectedOnce = false;
    let drops = 0;
    const startedAt = Date.now();
    setStatus('connecting');

    const handleEvents = (batch: SandboxEvent[], replay: boolean) => {
      setEvents(previous => {
        let next = replay ? [] : previous;
        for (const event of batch) {
          if (event.id <= lastEventId.current && !replay) continue;
          if (event.kind === 'story' && event.code === 'reset') next = [];
          next = [...next, event];
        }
        if (batch.length) lastEventId.current = Math.max(lastEventId.current, batch[batch.length - 1].id);
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    };

    const connect = () => {
      socket = new WebSocket(wsUrl(`/api/stream?client=${encodeURIComponent(clientId())}`));
      socket.onopen = () => {
        connectedOnce = true;
        drops = 0;
        setStatus('online');
      };
      socket.onmessage = message => {
        let data: any;
        try {
          data = JSON.parse(message.data);
        } catch {
          return;
        }
        if (data.type === 'hello') {
          setYou(data.you);
          setQuota(data.quota);
        } else if (data.type === 'snapshot') {
          setSnapshot(data.data);
        } else if (data.type === 'events') {
          if (data.replay) lastEventId.current = 0;
          handleEvents(data.data, Boolean(data.replay));
        }
      };
      socket.onclose = () => {
        if (stopped) return;
        drops += 1;
        if (!connectedOnce) {
          if (Date.now() - startedAt > WAKE_LIMIT_MS) {
            setStatus('offline');
            return;
          }
          setStatus('waking');
        } else if (drops > MAX_DROPS) {
          setStatus('offline');
          return;
        } else {
          setStatus('connecting');
        }
        timer = setTimeout(connect, Math.min(8000, 1000 * 2 ** Math.min(drops, 3)));
      };
    };

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [attempt]);

  const act = useCallback(async (path: string, body?: object): Promise<ActionResult> => {
    const result = await post(path, body);
    if (result.quota) setQuota(result.quota);
    return result;
  }, []);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  const clearEvents = useCallback(() => setEvents([]), []);

  return { status, snapshot, events, you, quota, act, retry, clearEvents };
}

export type Sandbox = ReturnType<typeof useSandbox>;
