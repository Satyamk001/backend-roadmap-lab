import React, { useState, useEffect, useRef } from 'react';
import { BullJobLifecycleEngine, BullQueueSnapshot, BullJob } from '../../../engine/queues/lifecycle';
import {
  Play,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { DemoCommandDeck, DemoActionButton } from '../../../components/common/DemoCommandDeck';
import { LiveEventLog, LogLayoutMode } from '../../../components/common/LiveEventLog';

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
  const [logLayout, setLogLayout] = useState<LogLayoutMode>('stacked');

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
        className={`p-2.5 rounded-lg border text-xs font-mono transition-all duration-150 cursor-pointer ${isSelected
            ? 'border-theme-accent ring-1 ring-theme-accent shadow-xs'
            : 'border-theme-border hover:border-theme-border/80'
          } ${isActive
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
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      {/* 1. Unified Command & Status Deck */}
      <DemoCommandDeck
        title="Job lifecycle states"
        statusMessage={snap.statusMessage}
        whyItMatters={snap.whyItMatters}
        badge="BullMQ · Day 35"
        notesAnchor="job-lifecycle-states"
        onReset={() => {
          engine.reset();
          sync();
        }}
        actions={
          <>
            <DemoActionButton
              variant="primary"
              onClick={() => {
                engine.stepPick();
                sync();
              }}
              disabled={snap.waiting.length === 0 || !snap.workers.some((w) => w.status === 'idle')}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Pick Next Job</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.addJob('email:welcome', { to: 'bala@test.com' });
                sync();
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Job</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.completeJob();
                sync();
              }}
              disabled={snap.active.length === 0}
              className="text-emerald-600 dark:text-emerald-400 font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Complete Active</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.failJob();
                sync();
              }}
              disabled={snap.active.length === 0}
              className="text-rose-600 dark:text-rose-400 font-semibold"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Fail Active</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.advanceClock();
                sync();
              }}
            >
              <Clock className="w-3.5 h-3.5 text-theme-muted" />
              <span>Advance Clock</span>
            </DemoActionButton>
          </>
        }
      />

      <div className={logLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        <div className={logLayout === 'side' ? 'lg:col-span-7 xl:col-span-8 space-y-4 min-w-0' : 'space-y-4'}>
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
                  className={`w-2 h-2 rounded-full ${worker.status === 'busy'
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
            className={`w-3.5 h-3.5 text-theme-muted transition-transform ${showMoreOptions ? 'rotate-180' : ''
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
                  className={`p-2.5 rounded-lg border ${challenge1Passed
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
                  className={`p-2.5 rounded-lg border ${challenge2Passed
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
          </div>
        )}
      </div>
      </div>

      {/* Live Event Stream Log */}
      <div className={logLayout === 'side' ? 'lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 min-w-0' : 'w-full'}>
        <LiveEventLog
          title="BullMQ Job Lifecycle Event Stream"
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

export default JobLifecycleDemo;
