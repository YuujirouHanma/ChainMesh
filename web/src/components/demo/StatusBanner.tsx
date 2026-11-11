import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Clock, Loader2, RefreshCw, Server, Shield } from 'lucide-react';
import type { Strings } from '../../i18n';
import { countdown } from '../../lib/format';
import type { ConnectionStatus, Quota, Snapshot } from '../../types';

interface StatusBannerProps {
  t: Strings;
  status: ConnectionStatus;
  snapshot: Snapshot | null;
  quota: Quota | null;
  onRetry: () => void;
}

export function StatusBanner({ t, status, snapshot, quota, onRetry }: StatusBannerProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const starting = status === 'online' && snapshot && !snapshot.meta.ready;
  return (
    <div className="space-y-3 mb-6">
      {status === 'waking' && (
        <Banner tone="amber" icon={<Server className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />} title={t.demo.wakingTitle} desc={t.demo.wakingDesc}>
          <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
        </Banner>
      )}
      {status === 'connecting' && !snapshot && (
        <Banner tone="amber" icon={<Loader2 className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />} title={t.demo.connecting} desc="" />
      )}
      {starting && (
        <Banner tone="amber" icon={<Loader2 className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />} title={t.demo.startingTitle} desc={t.demo.startingDesc} />
      )}
      {status === 'offline' && (
        <Banner tone="rose" icon={<AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />} title={t.demo.offlineTitle} desc={t.demo.offlineDesc}>
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-console font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            {t.demo.retry}
          </button>
        </Banner>
      )}

      <div className="bg-[#0B0705] border border-[#2C1C14] rounded-xl px-4 py-2.5 text-xs font-console flex flex-col md:flex-row md:items-center justify-between gap-3 text-[#E5D7CE]">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-[#FF5500] shrink-0 mt-0.5" />
          <span className="text-[11.5px] leading-relaxed text-[#FAF5F0] font-sans">{t.demo.notice}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-[11px] text-[#8C7769] border-t md:border-t-0 pt-2 md:pt-0 border-[#2C1C14]">
          {snapshot && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t.demo.resetsIn} <strong className="text-white tabular-nums">{countdown(snapshot.meta.resetAt - now)}</strong>
            </span>
          )}
          {quota && (
            <span className="flex items-center gap-1.5">
              {t.demo.txLeft}
              <span
                className={`font-semibold tabular-nums px-1.5 rounded text-[10px] border ${
                  quota.tx.left > 1 ? 'bg-orange-950/80 text-orange-400 border-orange-800/80' : 'bg-rose-950 text-rose-300 border-rose-800'
                }`}
              >
                {quota.tx.left}/{quota.tx.max}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, icon, title, desc, children }: { tone: 'amber' | 'rose'; icon: ReactNode; title: string; desc: string; children?: ReactNode }) {
  const style = tone === 'amber' ? 'bg-amber-950/60 border-amber-600/80 text-amber-200' : 'bg-rose-950/70 border-rose-600 text-rose-200';
  return (
    <div className={`p-4 rounded-xl border ${style}`} role="status">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <span className="font-bold text-xs font-console block">{title}</span>
            {desc && <span className="text-[11px] opacity-80">{desc}</span>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
