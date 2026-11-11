import { GitFork, Loader2, PlusCircle, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { fmt, type Strings } from '../../i18n';

interface ScenarioBarProps {
  t: Strings;
  ready: boolean;
  running: string | null;
  canAddNode: boolean;
  onScenario: (name: 'fork' | 'tamper' | 'offline') => void;
  onAddNode: () => void;
  onReset: () => void;
}

export function ScenarioBar({ t, ready, running, canAddNode, onScenario, onAddNode, onReset }: ScenarioBarProps) {
  const names = { fork: t.demo.scenarioFork, tamper: t.demo.scenarioTamper, offline: t.demo.scenarioOffline } as const;
  const disabled = !ready || Boolean(running);
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-console transition-all border disabled:opacity-40 disabled:cursor-not-allowed';
  return (
    <div className="bg-[#0B0705] border border-[#2C1C14] rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 mt-1 rounded-full bg-[#FF5500] animate-pulse" />
          <div>
            <span className="font-bold text-xs font-console text-white block">{t.demo.scenarios}</span>
            <span className="text-[11px] text-[#8C7769]">
              {running ? (
                <span className="inline-flex items-center gap-1 text-[#FFA200]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {fmt(t.demo.running, { name: names[running as keyof typeof names] ?? running })}
                </span>
              ) : (
                t.demo.scenariosHint
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={disabled} onClick={() => onScenario('fork')} className={`${base} bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border-pink-500/40`}>
            <GitFork className="w-3.5 h-3.5" />
            {names.fork}
          </button>
          <button disabled={disabled} onClick={() => onScenario('tamper')} className={`${base} bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/40`}>
            <ShieldAlert className="w-3.5 h-3.5" />
            {names.tamper}
          </button>
          <button disabled={disabled} onClick={() => onScenario('offline')} className={`${base} bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/40`}>
            <WifiOff className="w-3.5 h-3.5" />
            {names.offline}
          </button>
          <span className="h-5 w-px bg-[#2C1C14] hidden sm:block" />
          <button disabled={!ready || !canAddNode} onClick={onAddNode} className={`${base} bg-gradient-to-r from-[#FF5500] to-[#C93300] text-white font-semibold border-transparent`}>
            <PlusCircle className="w-3.5 h-3.5" />
            {t.demo.addNode}
          </button>
          <button disabled={!ready} onClick={onReset} className={`${base} bg-[#140D0A] hover:bg-[#1C130E] text-[#E5D7CE] border-[#2C1C14]`}>
            <RefreshCw className="w-3.5 h-3.5" />
            {t.demo.reset}
          </button>
        </div>
      </div>
    </div>
  );
}
