import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { DemoCommandDeck } from '../../../components/common/DemoCommandDeck';

interface ConsumerNode {
  id: string;
  name: string;
  status: 'active' | 'crashed' | 'joining';
  partitions: number[];
}

export const RebalanceDemo: React.FC = () => {
  const [protocol, setProtocol] = useState<'eager' | 'cooperative'>('cooperative');
  const [consumers, setConsumers] = useState<ConsumerNode[]>([
    { id: 'c1', name: 'Consumer C1', status: 'active', partitions: [0] },
    { id: 'c2', name: 'Consumer C2', status: 'active', partitions: [1] },
    { id: 'c3', name: 'Consumer C3', status: 'active', partitions: [2] },
  ]);

  const [phase, setPhase] = useState<'stable' | 'stop_the_world' | 'reassigning'>('stable');
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const [statusWhat, setStatusWhat] = useState<string>(
    '3 active consumers: P0→C1, P1→C2, P2→C3. Group stable hai.'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Consumer heartbeat bhejte hain Group Coordinator ko. Crash hone par coordinator rebalance trigger karta hai.'
  );

  // Crash C2
  const handleCrashC2 = () => {
    const c2 = consumers.find((c) => c.id === 'c2');
    if (!c2 || c2.status === 'crashed') return;

    if (protocol === 'eager') {
      setPhase('stop_the_world');
      setStatusWhat('ALERT: C2 crash hua! Eager mode: STOP-THE-WORLD! Sabhi consumers ne partitions revoke kar diye.');
      setStatusWhy('Purane Eager protocol me jab bhi ek consumer crash hota tha, poora group freeze ho jata tha.');

      setTimeout(() => {
        setPhase('reassigning');
        setConsumers([
          { id: 'c1', name: 'Consumer C1', status: 'active', partitions: [0, 1] },
          { id: 'c2', name: 'Consumer C2', status: 'crashed', partitions: [] },
          { id: 'c3', name: 'Consumer C3', status: 'active', partitions: [2] },
        ]);
        setPhase('stable');
        setStatusWhat('Rebalance complete: P0, P1 → C1 ko mile; P2 → C3 ke paas hai. Group resumed.');
        setStatusWhy('Eager rebalance me latency spike aata hai kyunki poora group ruka rehta hai.');
      }, 1200);
    } else {
      // Cooperative Sticky
      setConsumers([
        { id: 'c1', name: 'Consumer C1', status: 'active', partitions: [0, 1] },
        { id: 'c2', name: 'Consumer C2', status: 'crashed', partitions: [] },
        { id: 'c3', name: 'Consumer C3', status: 'active', partitions: [2] },
      ]);
      setPhase('stable');
      setStatusWhat('COOPERATIVE REBALANCE: C2 crash hua, sirf P1 transfer hua C1 ko. C1 aur C3 bina ruke chalte rahe!');
      setStatusWhy('Cooperative Sticky rebalance unaffected consumers ko pause nahi karta. Zero stop-the-world!');
    }
  };

  // Revive C2
  const handleReviveC2 = () => {
    if (protocol === 'eager') {
      setPhase('stop_the_world');
      setStatusWhat('C2 wapas join hua: Eager protocol ne sabhi partitions revoke kiye (Pause).');
      setStatusWhy('Eager me join hone par bhi poori group membership freeze hoti hai.');

      setTimeout(() => {
        setConsumers([
          { id: 'c1', name: 'Consumer C1', status: 'active', partitions: [0] },
          { id: 'c2', name: 'Consumer C2', status: 'active', partitions: [1] },
          { id: 'c3', name: 'Consumer C3', status: 'active', partitions: [2] },
        ]);
        setPhase('stable');
        setStatusWhat('Rebalance complete: 1:1 partition mapping restore ho gayi (P0→C1, P1→C2, P2→C3).');
        setStatusWhy('Group Coordinator ne clean assignment commit kar diya.');
      }, 1200);
    } else {
      setConsumers([
        { id: 'c1', name: 'Consumer C1', status: 'active', partitions: [0] },
        { id: 'c2', name: 'Consumer C2', status: 'active', partitions: [1] },
        { id: 'c3', name: 'Consumer C3', status: 'active', partitions: [2] },
      ]);
      setPhase('stable');
      setStatusWhat('COOPERATIVE: C2 ne rejoin kiya -> sirf P1 C1 se C2 ko transfer hua. C3 bilkul disturb nahi hua.');
      setStatusWhy('Sticky assignor minimal partitions move karta hai taaki local caches warm rahein.');
    }
  };

  const handleReset = () => {
    setConsumers([
      { id: 'c1', name: 'Consumer C1', status: 'active', partitions: [0] },
      { id: 'c2', name: 'Consumer C2', status: 'active', partitions: [1] },
      { id: 'c3', name: 'Consumer C3', status: 'active', partitions: [2] },
    ]);
    setPhase('stable');
    setStatusWhat('Rebalance simulation reset: 3 consumers active, group stable.');
    setStatusWhy('P0→C1, P1→C2, P2→C3 evenly allocated.');
  };

  // Keyboard accelerators
  useEffect(() => {
    const onPrimary = () => {
      const c2 = consumers.find((c) => c.id === 'c2');
      if (c2?.status === 'active') {
        handleCrashC2();
      } else {
        handleReviveC2();
      }
    };
    const onReset = () => handleReset();
    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onReset);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onReset);
    };
  }, [consumers, protocol]);

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      <DemoCommandDeck
        title="Rebalance"
        statusWhat={statusWhat}
        statusWhy={statusWhy}
        onReset={handleReset}
      />

      {/* 3. Primary Controls (4 to 5 direct verb buttons) */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCrashC2}
              disabled={consumers.find((c) => c.id === 'c2')?.status === 'crashed'}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Crash Consumer C2 (Timeout)</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-white border border-white/20">Space</kbd>
            </button>

            <button
              type="button"
              onClick={handleReviveC2}
              disabled={consumers.find((c) => c.id === 'c2')?.status === 'active'}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Revive Consumer C2</span>
            </button>
          </div>

          {/* Protocol Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-theme-muted font-medium">Rebalance Protocol:</span>
            <div className="flex rounded-lg border border-theme-border overflow-hidden">
              <button
                type="button"
                onClick={() => setProtocol('cooperative')}
                className={`px-3 py-1.5 font-semibold text-xs transition-colors ${
                  protocol === 'cooperative'
                    ? 'bg-amber-500 text-stone-900 font-bold'
                    : 'bg-theme-surface hover:bg-theme-surface-alt text-theme-text'
                }`}
              >
                Cooperative Sticky
              </button>
              <button
                type="button"
                onClick={() => setProtocol('eager')}
                className={`px-3 py-1.5 font-semibold text-xs transition-colors ${
                  protocol === 'eager'
                    ? 'bg-amber-500 text-stone-900 font-bold'
                    : 'bg-theme-surface hover:bg-theme-surface-alt text-theme-text'
                }`}
              >
                Eager (Stop-the-world)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Stop-the-world freeze banner (when in Eager mode) */}
      {phase === 'stop_the_world' && (
        <div className="p-4 bg-rose-500/15 border-2 border-rose-500 rounded-xl text-rose-700 dark:text-rose-300 animate-pulse text-center space-y-1">
          <div className="font-bold text-sm flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>STOP-THE-WORLD: All Partitions Revoked! Processing Frozen.</span>
          </div>
          <div className="text-xs opacity-90">
            Coordinator is waiting for all consumers to report before re-assigning from scratch...
          </div>
        </div>
      )}

      {/* 5. Visual Consumer Nodes & Partition Assignment */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-theme-text">
            Consumer Group: <code>orders-workers</code>
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-theme-surface-alt border border-theme-border">
            Protocol: <b>{protocol === 'cooperative' ? 'Cooperative Sticky' : 'Eager'}</b>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {consumers.map((c) => {
            const isCrashed = c.status === 'crashed';
            const isFrozen = phase === 'stop_the_world';

            return (
              <div
                key={c.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[140px] ${
                  isCrashed
                    ? 'bg-rose-500/10 border-rose-300 dark:border-rose-900/50 opacity-80'
                    : isFrozen
                    ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                    : 'bg-theme-bg border-theme-border'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-theme-border/60">
                  <div className="font-bold text-sm text-theme-text font-mono">{c.name}</div>
                  {isCrashed ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500 text-white">
                      CRASHED
                    </span>
                  ) : isFrozen ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-stone-900">
                      REVOKED
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Reading
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  <div className="text-xs text-theme-muted font-medium">Assigned Partitions:</div>
                  <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                    {c.partitions.length === 0 ? (
                      <span className="text-xs text-theme-muted italic">koi partition nahi</span>
                    ) : (
                      c.partitions.map((p) => (
                        <span
                          key={p}
                          className="px-2.5 py-1 bg-theme-surface border border-theme-border rounded-lg font-mono text-xs font-bold text-theme-accent shadow-sm"
                        >
                          Partition {p}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-theme-muted border-t border-theme-border/40 pt-2">
                  {isCrashed
                    ? 'Heartbeat timeout. Coordinator ne partition withdraw kar li.'
                    : isFrozen
                    ? 'Rebalance in progress... partition lock released.'
                    : `Active heartbeat (session.timeout.ms: 45000)`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Collapsed More Options Drawer */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center justify-between transition-colors"
        >
          <span>More options & state inspector</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border bg-theme-surface-alt space-y-3 font-mono text-xs">
            <pre className="p-3 bg-theme-bg border border-theme-border rounded-lg text-theme-text overflow-x-auto text-[11px] leading-relaxed">
              {JSON.stringify(
                {
                  protocol,
                  groupCoordinatorState: phase,
                  activeConsumers: consumers,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default RebalanceDemo;
