import React, { useState, useEffect, useRef } from 'react';
import { BullStalledEngine, StalledDemoSnapshot } from '../../../engine/queues/stalled';
import {
  Play,
  Pause,
  Lock,
  HeartHandshake,
  Skull,
  Clock,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Snowflake,
  Cpu,
  Layers,
} from 'lucide-react';
import { DemoCommandDeck, DemoActionButton } from '../../../components/common/DemoCommandDeck';
import { LiveEventLog, LogLayoutMode } from '../../../components/common/LiveEventLog';

export const WorkerLocksStalledDemo: React.FC = () => {
  const engineRef = useRef<BullStalledEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BullStalledEngine();
  }
  const engine = engineRef.current;

  const [snap, setSnap] = useState<StalledDemoSnapshot>(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [logLayout, setLogLayout] = useState<LogLayoutMode>('stacked');

  const sync = () => setSnap(engine.getSnapshot());

  // Auto-play loop (off by default)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const current = engine.getSnapshot();
      if (!current.activeJob && current.waitingJobs.length > 0) {
        engine.pickJob();
      } else if (current.activeJob) {
        if (current.activeJob.lockTtl > 2) {
          engine.tickClock();
        } else {
          engine.completeJob();
        }
      }
      sync();
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Global lab keyboard shortcuts (Space: Primary action, R: Reset)
  useEffect(() => {
    const handlePrimary = () => {
      if (!snap.activeJob && snap.waitingJobs.length > 0) {
        engine.pickJob();
      } else if (snap.activeJob) {
        engine.tickClock();
      }
      sync();
    };

    const handleReset = () => {
      engine.reset();
      sync();
    };

    window.addEventListener('lab:primary-action', handlePrimary);
    window.addEventListener('lab:reset', handleReset);
    return () => {
      window.removeEventListener('lab:primary-action', handlePrimary);
      window.removeEventListener('lab:reset', handleReset);
    };
  }, [snap]);

  // Challenges
  const challenge1Passed = snap.waitingJobs.some((j) => j.stalledCount > 0) || snap.duplicateDetected;
  const challenge2Passed = snap.duplicateDetected && snap.sideEffectExecutionCount === 1;

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      {/* 1. Unified Command & Status Deck */}
      <DemoCommandDeck
        title="Worker locks and stalled jobs"
        statusMessage={snap.statusMessage}
        whyItMatters={snap.whyItMatters}
        badge="BullMQ · Day 35"
        notesAnchor="worker-locks-and-stalled-jobs"
        onReset={() => {
          engine.reset();
          sync();
        }}
        layout={logLayout}
        onLayoutChange={setLogLayout}
        actions={
          <>
            <DemoActionButton
              variant="primary"
              onClick={() => {
                engine.pickJob();
                sync();
              }}
              disabled={!!snap.activeJob || snap.waitingJobs.length === 0}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Pick & Lock Job</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.renewHeartbeat();
                sync();
              }}
              disabled={!snap.activeJob || snap.workers.find((w) => w.id === snap.activeJob?.workerId)?.status !== 'processing'}
              className="text-emerald-600 dark:text-emerald-400 font-semibold"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Renew Heartbeat</span>
            </DemoActionButton>

            <DemoActionButton
              variant="danger"
              onClick={() => {
                engine.crashWorker('w1');
                sync();
              }}
              disabled={snap.workers.find((w) => w.id === 'w1')?.status === 'crashed'}
            >
              <Skull className="w-3.5 h-3.5" />
              <span>Crash Worker-1</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.tickClock();
                sync();
              }}
            >
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              <span>Step Clock (1s)</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.completeJob();
                sync();
              }}
              disabled={!snap.activeJob}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Complete Job</span>
            </DemoActionButton>
          </>
        }
      />

      <div className={logLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        <div className={logLayout === 'side' ? 'lg:col-span-7 xl:col-span-8 space-y-4 min-w-0' : 'space-y-4'}>
          {/* 3. Demo Canvas (Largest Element) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Left Column: Workers & Active Job Lock */}
        <div className="lg:col-span-7 space-y-4">
          {/* Workers Lane */}
          <div className="bg-theme-surface-alt rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-500" />
                Worker Nodes
              </span>
              <span className="text-[11px] text-theme-muted font-mono">
                {snap.workers.filter((w) => w.status === 'processing').length}/{snap.workers.length} active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {snap.workers.map((worker) => {
                const isCrashed = worker.status === 'crashed';
                const isFrozen = worker.status === 'frozen';
                const isProcessing = worker.status === 'processing';

                return (
                  <div
                    key={worker.id}
                    className={`p-3 rounded-lg border transition-all text-xs ${isCrashed
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : isFrozen
                          ? 'bg-sky-500/10 border-sky-500/30'
                          : isProcessing
                            ? 'bg-amber-500/10 border-amber-500/30 shadow-xs'
                            : 'bg-theme-surface border-theme-border'
                      }`}
                  >
                    <div className="flex items-center justify-between font-medium text-theme-text mb-1">
                      <span className="font-semibold">{worker.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase font-bold ${isCrashed
                            ? 'bg-rose-500/20 text-rose-500'
                            : isFrozen
                              ? 'bg-sky-500/20 text-sky-500'
                              : isProcessing
                                ? 'bg-amber-500/20 text-amber-500'
                                : 'bg-theme-surface-alt text-theme-muted'
                          }`}
                      >
                        {worker.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-theme-muted flex items-center justify-between mt-2 pt-2 border-t border-theme-border/50 font-mono">
                      <span>Heartbeats: {worker.heartbeatsSent}</span>
                      <span>Job: {worker.currentJobId ? `#${worker.currentJobId.slice(0, 10)}` : 'none'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Job Lock Visualizer */}
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                Active Redis Lock Key
              </span>
              {snap.activeJob && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">
                  TTL: {snap.activeJob.lockTtl}s remaining
                </span>
              )}
            </div>

            {snap.activeJob ? (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-sans font-bold text-sm text-theme-text">
                    {snap.activeJob.title}
                  </div>
                  <span className="text-[10px] font-mono text-theme-muted">
                    ID: {snap.activeJob.id}
                  </span>
                </div>

                {/* Progress bar of TTL countdown */}
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-[11px] text-theme-muted font-mono">
                    <span>Lock Expiration</span>
                    <span className={snap.activeJob.lockTtl <= 3 ? 'text-rose-500 font-bold animate-pulse' : 'text-amber-500'}>
                      {snap.activeJob.lockTtl}s / {snap.activeJob.maxLockTtl}s
                    </span>
                  </div>
                  <div className="w-full h-2 bg-theme-surface-alt rounded-full overflow-hidden border border-theme-border">
                    <div
                      className={`h-full transition-all duration-300 ${snap.activeJob.lockTtl <= 2
                          ? 'bg-rose-500'
                          : snap.activeJob.lockTtl <= 4
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      style={{
                        width: `${(snap.activeJob.lockTtl / snap.activeJob.maxLockTtl) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-theme-border/50 text-theme-muted">
                  <div>Worker: <strong className="text-theme-text">{snap.activeJob.workerId}</strong></div>
                  <div>Times Executed: <strong className={snap.activeJob.timesExecuted > 1 ? 'text-rose-500' : 'text-theme-text'}>{snap.activeJob.timesExecuted}</strong></div>
                  <div>Stalled Count: <strong className="text-theme-text">{snap.activeJob.stalledCount}</strong></div>
                  <div>Payload ID: <strong className="text-theme-text">{snap.activeJob.payload.orderId || snap.activeJob.id}</strong></div>
                </div>
              </div>
            ) : (
              <div className="py-6 border border-dashed border-theme-border rounded-lg text-center text-xs text-theme-muted">
                Koi active job lock hold nahi kar raha. "Pick & Lock Job" par click karein.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Queues & Idempotency Database */}
        <div className="lg:col-span-5 space-y-4">
          {/* Waiting & Stalled Queue */}
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-theme-muted" />
                Waiting Queue ({snap.waitingJobs.length})
              </span>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {snap.waitingJobs.length === 0 ? (
                <div className="py-3 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded">
                  Queue is empty.
                </div>
              ) : (
                snap.waitingJobs.map((job) => (
                  <div
                    key={job.id}
                    className={`p-2.5 rounded-md border text-xs ${job.stalledCount > 0
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-theme-border bg-theme-surface-alt'
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-theme-text">{job.title}</span>
                      {job.stalledCount > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-500 font-bold">
                          STALLED ({job.stalledCount}x)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-theme-muted flex justify-between font-mono">
                      <span>ID: {job.id}</span>
                      <span>Executions: {job.timesExecuted}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Idempotency & Database State */}
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                {snap.idempotencyEnabled ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                )}
                Idempotency Store (DB)
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${snap.idempotencyEnabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-rose-500/10 text-rose-500'
                  }`}
              >
                {snap.idempotencyEnabled ? 'PROTECTION ON' : 'PROTECTION OFF'}
              </span>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between items-center p-2 rounded bg-theme-surface-alt border border-theme-border">
                <span className="text-theme-muted">Charges Executed:</span>
                <span
                  className={`font-mono font-bold text-sm ${snap.sideEffectExecutionCount > 1 && !snap.idempotencyEnabled
                      ? 'text-rose-500'
                      : 'text-theme-text'
                    }`}
                >
                  {snap.sideEffectExecutionCount} times
                </span>
              </div>

              <div className="text-[11px] text-theme-muted">
                <span className="font-semibold text-theme-text">Stored Keys: </span>
                {snap.dbProcessedKeys.length === 0 ? (
                  <span className="font-mono">None yet</span>
                ) : (
                  <span className="font-mono text-emerald-500 font-bold">
                    {snap.dbProcessedKeys.join(', ')}
                  </span>
                )}
              </div>

              {snap.duplicateDetected && (
                <div
                  className={`p-2 rounded text-xs border ${snap.idempotencyEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    }`}
                >
                  {snap.idempotencyEnabled
                    ? '🛡️ Redelivered job skipped safely via database unique key!'
                    : '🚨 Double charge occurred! Redelivered job was executed twice!'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* 5. Collapsed "More Options" Row */}
      <div className="border-t border-theme-border pt-3">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between text-xs text-theme-muted hover:text-theme-text font-medium py-1 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            More options & diagnostics
            {snap.duplicateDetected && (
              <span className="w-2 h-2 rounded-full bg-theme-accent" />
            )}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${showMoreOptions ? 'rotate-180' : ''
              }`}
          />
        </button>

        {showMoreOptions && (
          <div className="mt-4 space-y-4 pt-2">
            {/* Simulation controls & Idempotency toggle */}
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${isPlaying
                      ? 'bg-amber-500 text-white'
                      : 'border border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-alt'
                    }`}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? 'Pause Auto-Play' : 'Auto-Play'}
                </button>

                <button
                  onClick={() => {
                    engine.freezeWorker('w1');
                    sync();
                  }}
                  disabled={snap.workers.find((w) => w.id === 'w1')?.status === 'frozen'}
                  className="px-2.5 py-1.5 rounded-md border border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-alt flex items-center gap-1 disabled:opacity-40"
                >
                  <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                  Freeze Event Loop
                </button>
              </div>

              {/* Idempotency Protection Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-theme-muted font-medium">Idempotent Consumer:</span>
                <button
                  onClick={() => {
                    engine.setIdempotency(!snap.idempotencyEnabled);
                    sync();
                  }}
                  className={`px-2.5 py-1 rounded font-mono font-bold text-[11px] border transition-colors ${snap.idempotencyEnabled
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-500'
                    }`}
                >
                  {snap.idempotencyEnabled ? 'ENABLED (SAFE)' : 'DISABLED (RISKY)'}
                </button>
              </div>
            </div>

            {/* Challenges Box */}
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-2">
              <div className="text-xs font-bold text-theme-text uppercase tracking-wider">
                Hands-on Challenges
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-theme-surface border border-theme-border">
                  <span className="text-theme-muted">
                    1. Crash Worker-1 while holding a lock, step clock until TTL hits 0 to trigger Watchdog stalled recovery.
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${challenge1Passed
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-stone-500/10 text-theme-muted'
                      }`}
                  >
                    {challenge1Passed ? 'PASSED' : 'TODO'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-theme-surface border border-theme-border">
                  <span className="text-theme-muted">
                    2. Let Standby Worker-2 re-execute the stalled job with Idempotency enabled and verify charge count stays 1.
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${challenge2Passed
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-stone-500/10 text-theme-muted'
                      }`}
                  >
                    {challenge2Passed ? 'PASSED' : 'TODO'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
      </div>

      {/* Live Event Stream Log */}
      <div className={logLayout === 'side' ? 'lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 min-w-0' : 'w-full'}>
        <LiveEventLog
          title="Watchdog & Lock Event Stream"
          entries={snap.eventLog.map((ev) => ({
            id: ev.id,
            tick: ev.tick,
            type: ev.type,
            message: ev.message,
          }))}
          layout={logLayout}
          onLayoutChange={setLogLayout}
          maxHeight={logLayout === 'side' ? 'max-h-[620px]' : 'max-h-56'}
        />
      </div>
    </div>
    </div>
  );
};

export default WorkerLocksStalledDemo;
