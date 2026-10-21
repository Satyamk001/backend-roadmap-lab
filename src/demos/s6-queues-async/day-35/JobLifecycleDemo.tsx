import React, { useState, useEffect, useRef } from 'react';
import { BullJobLifecycleEngine, BullQueueSnapshot, BullJob } from '../../../engine/queues/lifecycle';
import {
  Play,
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  ChevronDown,
  Layers,
} from 'lucide-react';

export const JobLifecycleDemo: React.FC = () => {
  const engineRef = useRef<BullJobLifecycleEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new BullJobLifecycleEngine();
  }
  const engine = engineRef.current;

  const [snap, setSnap] = useState<BullQueueSnapshot>(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const sync = () => setSnap(engine.getSnapshot());

  // Auto-play loop (off by default)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      // If there are waiting jobs and idle workers, pick; otherwise complete or advance clock
      const current = engine.getSnapshot();
      if (current.waiting.length > 0 && current.workers.some((w) => w.status === 'idle')) {
        engine.stepPick();
      } else if (current.active.length > 0) {
        engine.completeJob();
      } else if (current.delayed.length > 0) {
        engine.advanceClock();
      } else {
        engine.addJob('email:auto', { timestamp: Date.now() });
      }
      sync();
    }, 1400);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Global keyboard shortcuts (Space: Primary action, R: Reset)
  useEffect(() => {
    const handlePrimary = () => {
      if (snap.waiting.length > 0 && snap.workers.some((w) => w.status === 'idle')) {
        engine.stepPick();
      } else if (snap.active.length > 0) {
        engine.completeJob();
      } else {
        engine.addJob('email:welcome', { user: 'new_user' });
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
  const challenge1Passed = snap.stats.totalCompleted >= 2;
  const challenge2Passed = snap.delayed.length > 0 || snap.stats.totalFailed > 0;

  const renderJobCard = (job: BullJob, isSelected: boolean) => {
    const isCompleted = job.state === 'completed';
    const isFailed = job.state === 'failed';
    const isActive = job.state === 'active';
    const isDelayed = job.state === 'delayed';

    return (
      <div
        key={job.id}
        onClick={() => setSelectedJobId(job.id)}
        className={`p-2.5 rounded-lg border text-xs font-mono transition-all duration-150 cursor-pointer ${
          isSelected
            ? 'border-theme-accent ring-1 ring-theme-accent shadow-xs'
            : 'border-theme-border hover:border-theme-border/80'
        } ${
          isActive
            ? 'bg-amber-500/10 border-amber-500/30'
            : isCompleted
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : isFailed
            ? 'bg-rose-500/10 border-rose-500/20'
            : isDelayed
            ? 'bg-violet-500/10 border-violet-500/20'
            : 'bg-theme-surface'
        }`}
      >
        <div className="flex items-center justify-between gap-1 mb-1 font-sans">
          <span className="font-bold text-theme-text text-[11px] truncate">{job.name}</span>
          <span className="text-[10px] text-theme-muted font-mono">{job.id}</span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-theme-muted">
          <span>Tries: {job.attemptsMade}/{job.maxAttempts}</span>
          {isActive && (
            <span className="text-amber-500 font-bold flex items-center gap-0.5">
              <Lock className="w-3 h-3" />
              <span>{job.lockTtl}s</span>
            </span>
          )}
          {isDelayed && (
            <span className="text-violet-500 font-bold flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              <span>{job.delayRemaining} ticks</span>
            </span>
          )}
          {isCompleted && (
            <span className="text-emerald-500 font-semibold">Done</span>
          )}
          {isFailed && (
            <span className="text-rose-500 font-semibold">Failed</span>
          )}
        </div>

        {isActive && (
          <div className="mt-1.5 w-full bg-theme-surface-alt rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* Tab Heading & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-500/10 text-sky-500 border border-sky-500/30">
              LEVEL 2: CORE LIFECYCLE
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
              Job lifecycle states
            </h2>
          </div>
          <p className="text-sm text-theme-muted mt-0.5">
            Jobs move atomically through Redis sets: waiting to active with a lock, then completed or failed.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            engine.reset();
            sync();
          }}
          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-alt text-theme-text flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* "What just happened?" Live Status Line */}
      <div
        role="status"
        aria-live="polite"
        className="relative overflow-hidden px-4 py-3 bg-theme-surface border border-theme-border rounded-xl shadow-xs transition-all border-l-4 border-l-theme-primary"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex items-center justify-center shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-theme-primary"></span>
            </span>
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-sm sm:text-base font-bold text-theme-text leading-snug">
              {snap.statusMessage}
            </div>
            <div className="text-xs text-theme-muted mt-0.5 leading-normal font-medium">
              {snap.whyItMatters}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Controls (Max 5 verbs in default view) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            engine.stepPick();
            sync();
          }}
          disabled={snap.waiting.length === 0 || !snap.workers.some((w) => w.status === 'idle')}
          className="px-4 py-2 rounded-lg bg-theme-primary text-theme-primary-text font-bold text-sm shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-1.5"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Pick Next Job</span>
        </button>

        <button
          type="button"
          onClick={() => {
            engine.addJob('email:welcome', { to: 'bala@test.com' });
            sync();
          }}
          className="px-3.5 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-alt text-theme-text font-semibold text-sm shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Job</span>
        </button>

        <button
          type="button"
          onClick={() => {
            engine.completeJob();
            sync();
          }}
          disabled={snap.active.length === 0}
          className="px-3.5 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-alt text-emerald-600 dark:text-emerald-400 font-semibold text-sm shadow-xs transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Complete Active</span>
        </button>

        <button
          type="button"
          onClick={() => {
            engine.failJob();
            sync();
          }}
          disabled={snap.active.length === 0}
          className="px-3.5 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-alt text-rose-600 dark:text-rose-400 font-semibold text-sm shadow-xs transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Fail Active</span>
        </button>

        <button
          type="button"
          onClick={() => {
            engine.advanceClock();
            sync();
          }}
          className="px-3.5 py-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-theme-surface-alt text-theme-text font-semibold text-sm shadow-xs transition-colors flex items-center gap-1.5"
        >
          <Clock className="w-4 h-4 text-theme-muted" />
          <span>Advance Clock</span>
        </button>
      </div>

      {/* Main Simulation Canvas: BullMQ Redis State Lanes */}
      <div className="p-4 sm:p-5 rounded-xl border border-theme-border bg-theme-surface shadow-xs space-y-4">
        {/* Workers Status Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-theme-surface-alt/50 border border-theme-border text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-theme-text uppercase tracking-wider text-[11px]">
              Workers Pool (Concurrency: 2)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {snap.workers.map((worker) => (
              <div
                key={worker.id}
                className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-theme-surface border border-theme-border font-mono text-[11px]"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    worker.status === 'busy'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-theme-text font-sans font-medium">{worker.name}</span>
                <span className="text-theme-muted font-mono">
                  {worker.currentJobId ? `[Job: ${worker.currentJobId}]` : '[Idle]'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4 Redis Lifecycle Lanes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Lane 1: Waiting */}
          <div className="p-3 rounded-xl border border-theme-border bg-theme-surface-alt/30 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme-border gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                <span className="font-bold text-xs text-theme-text font-mono truncate">bull:email:wait</span>
              </div>
              <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border shrink-0">
                {snap.waiting.length}
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
              {snap.waiting.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-theme-muted italic py-6 text-center">
                  Queue empty.<br />Click "Add Job"
                </div>
              ) : (
                snap.waiting.map((job) => renderJobCard(job, selectedJobId === job.id))
              )}
            </div>
          </div>

          {/* Lane 2: Active */}
          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-500/20 gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="font-bold text-xs text-theme-text font-mono truncate">bull:email:active</span>
              </div>
              <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border text-amber-600 dark:text-amber-400 shrink-0">
                {snap.active.length}
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
              {snap.active.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-theme-muted italic py-6 text-center">
                  No active jobs.<br />Click "Pick Next Job"
                </div>
              ) : (
                snap.active.map((job) => renderJobCard(job, selectedJobId === job.id))
              )}
            </div>
          </div>

          {/* Lane 3: Completed */}
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20 gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-bold text-xs text-theme-text font-mono truncate">bull:email:done</span>
              </div>
              <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border text-emerald-600 dark:text-emerald-400 shrink-0">
                {snap.completed.length}
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
              {snap.completed.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-theme-muted italic py-6 text-center">
                  None completed yet
                </div>
              ) : (
                snap.completed.map((job) => renderJobCard(job, selectedJobId === job.id))
              )}
            </div>
          </div>

          {/* Lane 4: Delayed & Failed */}
          <div className="p-3 rounded-xl border border-theme-border bg-theme-surface-alt/30 flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme-border gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                <span className="font-bold text-xs text-theme-text font-mono truncate">bull:email:delayed</span>
              </div>
              <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border shrink-0">
                {snap.delayed.length + snap.failed.length}
              </span>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[200px]">
              {snap.delayed.length === 0 && snap.failed.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-theme-muted italic py-6 text-center">
                  None delayed/failed.<br />Click "Fail Active"
                </div>
              ) : (
                <>
                  {snap.delayed.map((job) => renderJobCard(job, selectedJobId === job.id))}
                  {snap.failed.map((job) => renderJobCard(job, selectedJobId === job.id))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Selected Job Inspection Box */}
        {selectedJobId && (
          <div className="p-3 rounded-lg border border-theme-border bg-theme-surface-alt/40 text-xs font-mono space-y-1 select-text">
            <div className="flex items-center justify-between font-sans">
              <span className="font-bold text-theme-text">Redis Hash Inspector: bull:email:{selectedJobId}</span>
              <button
                type="button"
                onClick={() => setSelectedJobId(null)}
                className="text-[11px] text-theme-muted hover:text-theme-text"
              >
                Close
              </button>
            </div>
            <pre className="text-[11px] overflow-x-auto text-theme-text">
              {JSON.stringify(
                [...snap.waiting, ...snap.active, ...snap.completed, ...snap.failed, ...snap.delayed].find(
                  (j) => j.id === selectedJobId
                ) || {},
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Collapsed "More Options" Row */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between p-3.5 bg-theme-surface-alt hover:bg-theme-border/40 text-xs font-semibold text-theme-text transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-theme-accent" />
            <span>More options (Auto-play, Challenges, Event log & State inspector)</span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-theme-muted transition-transform ${
              showMoreOptions ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border space-y-5 text-sm">
            {/* Auto-play and Quick Add Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPlaying}
                  onChange={(e) => setIsPlaying(e.target.checked)}
                  className="rounded border-theme-border text-theme-primary focus:ring-theme-primary"
                />
                <span className="text-xs font-medium text-theme-text">
                  Auto-play Simulation
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  engine.addJob('cron:nightly-report', { scope: 'full' }, 3, 4);
                  sync();
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-md border border-theme-border bg-theme-surface hover:bg-theme-surface-alt text-theme-text"
              >
                + Add Delayed Job (4 ticks delay)
              </button>
            </div>

            {/* Challenges Box */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-accent">
                Interactive Challenges
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div
                  className={`p-2.5 rounded-lg border ${
                    challenge1Passed
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-theme-border bg-theme-surface text-theme-muted'
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    {challenge1Passed ? '✓ Challenge 1 Passed' : 'Challenge 1: Process 2 Jobs'}
                  </div>
                  <p className="text-[11px] mt-0.5">
                    Pick jobs from wait and complete them to verify lock release.
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    challenge2Passed
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'border-theme-border bg-theme-surface text-theme-muted'
                  }`}
                >
                  <div className="font-semibold flex items-center gap-1.5">
                    {challenge2Passed ? '✓ Challenge 2 Passed' : 'Challenge 2: Trigger a Retry Backoff'}
                  </div>
                  <p className="text-[11px] mt-0.5">
                    Fail an active job to observe exponential backoff transition into the delayed set.
                  </p>
                </div>
              </div>
            </div>

            {/* Live Event Log */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-accent">
                Virtual Tick Event Log
              </span>
              <div className="p-3 rounded-lg border border-theme-border bg-theme-surface-alt/40 font-mono text-[11px] max-h-36 overflow-y-auto space-y-1">
                {snap.eventLog.length === 0 ? (
                  <span className="text-theme-muted italic">No events recorded.</span>
                ) : (
                  snap.eventLog.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-2">
                      <span className="text-theme-muted">T+{ev.tick}</span>
                      <span
                        className={
                          ev.type === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : ev.type === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : ev.type === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-theme-text'
                        }
                      >
                        {ev.message}
                      </span>
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

export default JobLifecycleDemo;
