import React, { useState, useEffect, useRef } from 'react';
import { BullBackoffEngine, BackoffDemoSnapshot, BackoffJob } from '../../../engine/queues/backoff';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  Layers,
  Flame,
  ArrowRight,
  RefreshCw,
  Bug,
  Archive,
} from 'lucide-react';

export const BackoffDlqDemo: React.FC = () => {
  const engineRef = useRef<BullBackoffEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BullBackoffEngine();
  }
  const engine = engineRef.current;

  const [snap, setSnap] = useState<BackoffDemoSnapshot>(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [inspectedDlqJob, setInspectedDlqJob] = useState<BackoffJob | null>(null);

  const sync = () => setSnap(engine.getSnapshot());

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const current = engine.getSnapshot();
      if (current.delayedJobs.length > 0) {
        engine.tickClock();
      } else if (!current.activeJob && current.waitingJobs.length > 0) {
        engine.pickJob();
      } else if (current.activeJob) {
        // Randomly fail or succeed for demonstration
        if (current.activeJob.id.startsWith('poison') || current.activeJob.attempts < 2) {
          engine.failJob('Downstream 504 Gateway Timeout');
        } else {
          engine.succeedJob();
        }
      }
      sync();
    }, 1300);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Global lab keyboard shortcuts
  useEffect(() => {
    const handlePrimary = () => {
      if (snap.delayedJobs.length > 0) {
        engine.tickClock();
      } else if (!snap.activeJob && snap.waitingJobs.length > 0) {
        engine.pickJob();
      } else if (snap.activeJob) {
        engine.failJob('Gateway 504 Timeout');
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

  // Challenges calculation
  const challenge1Passed = snap.dlqJobs.length > 0;
  const challenge2Passed = challenge1Passed && snap.waitingJobs.some((j) => j.history.length >= 3);

  return (
    <div className="bg-theme-surface rounded-xl border border-theme-border p-4 md:p-6 shadow-xs transition-colors duration-150">
      {/* 1. Header & Title (Enforced by Demo Titles test) */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">

              <h2 className="text-xl font-bold text-theme-text">
                Backoff retries and DLQ
              </h2>
            </div>
            <p className="text-sm text-theme-muted">
              Exponential retry delays (2^attempts × base delay), Redis delayed sorted-sets, and Dead Letter Queue recovery.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                engine.reset();
                setInspectedDlqJob(null);
                sync();
              }}
              title="Reset simulation"
              className="p-1.5 rounded-lg border border-theme-border text-theme-muted hover:text-theme-text hover:bg-theme-surface-alt transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. "What just happened?" line */}
        <div className="mt-4 p-3 rounded-lg bg-theme-surface-alt border-l-4 border-theme-primary transition-colors">
          <div className="text-sm font-medium text-theme-text flex items-start gap-2">
            <span className="font-bold text-theme-accent shrink-0 text-xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-theme-primary/10">
              STATUS
            </span>
            <span>{snap.statusMessage}</span>
          </div>
          <div className="text-xs text-theme-muted mt-1 pl-14">
            💡 {snap.whyItMatters}
          </div>
        </div>
      </div>

      {/* 3. Demo Canvas (Largest Element) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Left Column: Waiting Queue & Active Job */}
        <div className="lg:col-span-4 space-y-4">
          {/* Waiting Queue */}
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-theme-muted" />
                Waiting Queue ({snap.waitingJobs.length})
              </span>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {snap.waitingJobs.length === 0 ? (
                <div className="py-4 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded">
                  No jobs waiting.
                </div>
              ) : (
                snap.waitingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-2.5 rounded-md border border-theme-border bg-theme-surface-alt text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-theme-text">{job.title}</span>
                      <span className="text-[10px] font-mono text-theme-muted">
                        Tries: {job.attempts}/{job.maxAttempts}
                      </span>
                    </div>
                    <div className="text-[11px] text-theme-muted font-mono flex justify-between">
                      <span>ID: {job.id}</span>
                      {job.history.length > 0 && (
                        <span className="text-amber-500 font-bold">Retried ({job.history.length}x)</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Job Processing */}
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                Active Worker Slot
              </span>
              {snap.activeJob && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">
                  Attempt #{snap.activeJob.attempts} of {snap.activeJob.maxAttempts}
                </span>
              )}
            </div>

            {snap.activeJob ? (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="font-bold text-sm text-theme-text mb-1">
                  {snap.activeJob.title}
                </div>
                <div className="text-xs text-theme-muted font-mono mb-2">
                  ID: {snap.activeJob.id}
                </div>

                <div className="text-[11px] p-2 rounded bg-theme-surface border border-theme-border font-mono space-y-1 text-theme-muted">
                  <div>Strategy: <strong className="text-theme-text">{snap.activeJob.backoffType} (2^k * 2s)</strong></div>
                  <div>Base Delay: <strong className="text-theme-text">{snap.activeJob.baseDelayMs}s</strong></div>
                  <div>Next Failure Delay: <strong className="text-amber-500 font-bold">{snap.activeJob.baseDelayMs * Math.pow(2, snap.activeJob.attempts - 1)}s</strong></div>
                </div>
              </div>
            ) : (
              <div className="py-6 border border-dashed border-theme-border rounded-lg text-center text-xs text-theme-muted">
                Worker idle hai. Click "Pick Job" to start.
              </div>
            )}
          </div>
        </div>

        {/* Center Column: Exponential Delayed Set (Redis ZSET) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-theme-surface-alt rounded-lg p-3.5 border border-theme-border h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-500" />
                Delayed ZSet (Backoff Wait)
              </span>
              <span className="text-[10px] font-mono text-theme-muted">
                {snap.delayedJobs.length} delayed
              </span>
            </div>

            <p className="text-[11px] text-theme-muted mb-2">
              BullMQ failed jobs ko Redis ZSET me score = <code>now + delay</code> ke sath rakhta hai:
            </p>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {snap.delayedJobs.length === 0 ? (
                <div className="py-8 border border-dashed border-theme-border rounded-lg text-center text-xs text-theme-muted">
                  Delayed set is empty. Jobs fail hone par exponential backoff timer ke sath yahan aate hain.
                </div>
              ) : (
                snap.delayedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border border-violet-500/30 bg-violet-500/10 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-theme-text mb-1">
                      <span>{job.title}</span>
                      <span className="text-[11px] font-mono text-violet-500 font-bold animate-pulse flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {job.currentDelayRemaining}s remaining
                      </span>
                    </div>

                    <div className="text-[11px] text-theme-muted mb-1.5 font-mono">
                      Attempt {job.attempts}/{job.maxAttempts} failed • Last Error: {job.lastError}
                    </div>

                    <div className="w-full h-1.5 bg-theme-surface rounded-full overflow-hidden border border-theme-border/50">
                      <div
                        className="h-full bg-violet-500 transition-all duration-300"
                        style={{
                          width: `${Math.max(10, (job.currentDelayRemaining / (job.baseDelayMs * Math.pow(2, job.attempts - 1))) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {snap.delayedJobs.length > 0 && (
              <div className="mt-3 pt-2 border-t border-theme-border/60 text-[11px] text-theme-muted text-center">
                👉 Click <strong>"Step Clock (1s)"</strong> to count down backoff timer.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dead Letter Queue (DLQ) & Completed */}
        <div className="lg:col-span-4 space-y-4">
          {/* DLQ / Failed Queue */}
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-rose-500" />
                Dead Letter Queue (DLQ) ({snap.dlqJobs.length})
              </span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {snap.dlqJobs.length === 0 ? (
                <div className="py-4 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded">
                  No dead-lettered jobs yet.
                </div>
              ) : (
                snap.dlqJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-theme-text mb-1">
                      <span>{job.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 font-bold uppercase">
                        EXHAUSTED ({job.attempts}x)
                      </span>
                    </div>

                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono mb-2 truncate">
                      {job.lastError}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          engine.replayDlqJob(job.id);
                          sync();
                        }}
                        className="px-2 py-1 rounded bg-theme-primary text-theme-surface font-semibold text-[11px] flex items-center gap-1 hover:opacity-90 transition-opacity"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Replay Job
                      </button>
                      <button
                        onClick={() => setInspectedDlqJob(job)}
                        className="px-2 py-1 rounded border border-theme-border text-theme-muted hover:text-theme-text text-[11px]"
                      >
                        Inspect Trace
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Completed Jobs summary */}
          <div className="bg-theme-surface rounded-lg p-3 border border-theme-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-theme-text flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Completed Jobs:
              </span>
              <span className="font-mono font-bold text-emerald-500">
                {snap.completedJobs.length} processed
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Inspected DLQ Modal / Drawer */}
      {inspectedDlqJob && (
        <div className="mb-4 p-3.5 rounded-lg bg-theme-surface-alt border border-rose-500/40 text-xs font-mono space-y-2">
          <div className="flex items-center justify-between font-sans">
            <span className="font-bold text-rose-500 flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" />
              DLQ Failure Trace: #{inspectedDlqJob.id}
            </span>
            <button
              onClick={() => setInspectedDlqJob(null)}
              className="text-theme-muted hover:text-theme-text text-xs"
            >
              ✕ Close
            </button>
          </div>
          <div className="p-2 bg-theme-surface rounded border border-theme-border text-theme-muted text-[11px]">
            Payload: {JSON.stringify(inspectedDlqJob.payload)}
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-theme-text font-sans">Attempt History:</span>
            {inspectedDlqJob.history.map((h, i) => (
              <div key={i} className="text-[11px] text-theme-muted">
                • Attempt {h.attempt} at tick T+{h.timestamp}: <span className="text-rose-500">{h.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Primary Action Controls (5 controls max) */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Control 1: Pick Job */}
        <button
          onClick={() => {
            engine.pickJob();
            sync();
          }}
          disabled={!!snap.activeJob || snap.waitingJobs.length === 0}
          className="px-3.5 py-2 rounded-lg bg-theme-primary text-theme-surface font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Pick Job
        </button>

        {/* Control 2: Fail Job (Retryable Backoff) */}
        <button
          onClick={() => {
            engine.failJob('Downstream 504 Gateway Timeout');
            sync();
          }}
          disabled={!snap.activeJob}
          className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-xs flex items-center gap-1.5 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Fail (504 Timeout)
        </button>

        {/* Control 3: Throw UnrecoverableError (Non-retryable from Notion Notes) */}
        <button
          onClick={() => {
            engine.failWithUnrecoverableError('UnrecoverableError: Malformed schema');
            sync();
          }}
          disabled={!snap.activeJob}
          className="px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-500 font-medium text-xs flex items-center gap-1.5 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
        >
          <Flame className="w-3.5 h-3.5" />
          Throw UnrecoverableError
        </button>

        {/* Control 4: Step Clock (1s) */}
        <button
          onClick={() => {
            engine.tickClock();
            sync();
          }}
          className="px-3 py-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text font-medium text-xs flex items-center gap-1.5 hover:bg-theme-surface-alt transition-colors"
        >
          <Clock className="w-3.5 h-3.5 text-violet-500" />
          Step Clock (1s)
        </button>

        {/* Control 5: Succeed Job */}
        <button
          onClick={() => {
            engine.succeedJob();
            sync();
          }}
          disabled={!snap.activeJob}
          className="px-3 py-2 rounded-lg border border-theme-border bg-theme-surface text-theme-text font-medium text-xs flex items-center gap-1.5 hover:bg-theme-surface-alt disabled:opacity-40 transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          Succeed Job
        </button>
      </div>

      {/* 5. Collapsed "More Options" Row */}
      <div className="border-t border-theme-border pt-3">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between text-xs text-theme-muted hover:text-theme-text font-medium py-1 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            More options & challenges
            {snap.dlqJobs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${showMoreOptions ? 'rotate-180' : ''
              }`}
          />
        </button>

        {showMoreOptions && (
          <div className="mt-4 space-y-4 pt-2">
            {/* Auto-play toggle */}
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border flex items-center justify-between text-xs">
              <span className="text-theme-muted">Autonomous Simulation Runner:</span>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors ${isPlaying
                    ? 'bg-amber-500 text-white'
                    : 'border border-theme-border bg-theme-surface text-theme-text hover:bg-theme-surface-alt'
                  }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause Auto-Play' : 'Auto-Play Simulation'}
              </button>
            </div>

            {/* Challenges Box */}
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-2">
              <div className="text-xs font-bold text-theme-text uppercase tracking-wider">
                Hands-on Challenges
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-theme-surface border border-theme-border">
                  <span className="text-theme-muted">
                    1. Fail a job 3 consecutive times with exponential backoff until all retries exhaust and it enters DLQ.
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
                    2. Inspect the failed job stack trace in DLQ and click "Replay Job" to re-enqueue it.
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

            {/* Event Log */}
            <div className="p-3 bg-theme-surface rounded-lg border border-theme-border">
              <div className="text-xs font-bold text-theme-text uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Exponential Backoff & DLQ Event Log</span>
                <span className="text-[10px] font-mono text-theme-muted">
                  Virtual Tick T+{snap.tick}
                </span>
              </div>
              <div
                className="max-h-36 overflow-y-auto space-y-1 font-mono text-[11px] pr-1"
                aria-live="polite"
              >
                {snap.eventLog.length === 0 ? (
                  <div className="text-theme-muted py-2 text-center">No events logged yet.</div>
                ) : (
                  snap.eventLog.map((ev) => (
                    <div
                      key={ev.id}
                      className={`py-1 px-1.5 rounded flex items-start gap-2 ${ev.type === 'error'
                          ? 'bg-rose-500/10 text-rose-500'
                          : ev.type === 'warning'
                            ? 'bg-amber-500/10 text-amber-500'
                            : ev.type === 'success'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'text-theme-muted'
                        }`}
                    >
                      <span className="text-theme-muted shrink-0">[T+{ev.tick}]</span>
                      <span>{ev.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackoffDlqDemo;
