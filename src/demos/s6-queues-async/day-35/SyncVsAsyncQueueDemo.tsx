import React, { useState, useEffect, useRef } from 'react';
import { SyncVsAsyncEngine, SyncAsyncSnapshot } from '../../../engine/queues/syncVsAsync';
import {
  Zap,
  Clock,
  ChevronDown,
  AlertOctagon,
  Cpu,
  Layers,
  ArrowRight,
  Gauge,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { DemoCommandDeck, DemoActionButton } from '../../../components/common/DemoCommandDeck';
import { LiveEventLog, LogLayoutMode } from '../../../components/common/LiveEventLog';

export const SyncVsAsyncQueueDemo: React.FC = () => {
  const engineRef = useRef<SyncVsAsyncEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new SyncVsAsyncEngine();
  }
  const engine = engineRef.current;

  const [snap, setSnap] = useState<SyncAsyncSnapshot>(() => engine.getSnapshot());
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [activeTabGuide, setActiveTabGuide] = useState<number>(1);
  const [logLayout, setLogLayout] = useState<LogLayoutMode>('stacked');

  const sync = () => setSnap(engine.getSnapshot());

  // Global lab keyboard shortcuts (Space: Primary action, R: Reset)
  useEffect(() => {
    const handlePrimary = () => {
      engine.sendRequest('pdf');
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
  }, []);

  // Challenges calculation
  const challenge1Passed = snap.timeoutCount > 0;
  const challenge2Passed = snap.mode === 'async' && snap.completedCount >= 3;

  // Beginner Walkthrough Steps
  const runGuidedStep = (stepNumber: number) => {
    setActiveTabGuide(stepNumber);
    if (stepNumber === 1) {
      engine.reset();
      engine.setMode('sync');
      engine.sendRequest('pdf');
    } else if (stepNumber === 2) {
      engine.reset();
      engine.setMode('sync');
      engine.sendSpike(5);
    } else if (stepNumber === 3) {
      engine.reset();
      engine.setMode('async');
      engine.sendSpike(5);
    }
    sync();
  };

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      {/* 1. Unified Command & Status Deck */}
      <DemoCommandDeck
        title="Sync HTTP vs async queue"
        statusMessage={snap.statusMessage}
        whyItMatters={snap.whyItMatters}
        badge="BullMQ · Day 35"
        notesAnchor="sync-vs-async-queue"
        onReset={() => {
          engine.reset();
          sync();
        }}
        actions={
          <>
            <DemoActionButton
              variant="primary"
              onClick={() => {
                engine.sendRequest('pdf');
                sync();
              }}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Send Request (PDF)</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.sendSpike(5);
                sync();
              }}
            >
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              <span>Simulate Spike (5 Reqs)</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                const nextMode = snap.mode === 'sync' ? 'async' : 'sync';
                engine.setMode(nextMode);
                sync();
              }}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Switch to {snap.mode === 'sync' ? 'Async Queue' : 'Sync HTTP'}</span>
            </DemoActionButton>

            <DemoActionButton
              variant="secondary"
              onClick={() => {
                engine.step();
                sync();
              }}
            >
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              <span>Step Clock (1s)</span>
            </DemoActionButton>
          </>
        }
      />

      <div className={logLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        <div className={logLayout === 'side' ? 'lg:col-span-7 xl:col-span-8 space-y-4 min-w-0' : 'space-y-4'}>
          {/* 3. Beginner Guided Tour Stepper */}
          <div className="mb-4 p-3 bg-theme-surface-alt/60 rounded-lg border border-theme-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-theme-accent" />
            Beginner Step-by-Step Guided Tour:
          </span>
          <span className="text-[11px] text-theme-muted">Click a step to see what happens:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => runGuidedStep(1)}
            className={`p-2 rounded-md border text-left text-xs transition-all ${activeTabGuide === 1
                ? 'border-theme-primary bg-theme-surface shadow-xs ring-1 ring-theme-primary'
                : 'border-theme-border bg-theme-surface hover:border-theme-border/80'
              }`}
          >
            <div className="font-bold text-theme-text flex items-center gap-1">
              <span>1. Single Sync Call</span>
            </div>
            <div className="text-[11px] text-theme-muted mt-0.5">
              Client freezes for 3.2s waiting for heavy PDF generation.
            </div>
          </button>

          <button
            onClick={() => runGuidedStep(2)}
            className={`p-2 rounded-md border text-left text-xs transition-all ${activeTabGuide === 2
                ? 'border-rose-500 bg-theme-surface shadow-xs ring-1 ring-rose-500'
                : 'border-theme-border bg-theme-surface hover:border-theme-border/80'
              }`}
          >
            <div className="font-bold text-rose-500 flex items-center gap-1">
              <span>2. Traffic Spike (504 Crash)</span>
            </div>
            <div className="text-[11px] text-theme-muted mt-0.5">
              Threads exhaust! Extra requests fail with HTTP 504 Timeout.
            </div>
          </button>

          <button
            onClick={() => runGuidedStep(3)}
            className={`p-2 rounded-md border text-left text-xs transition-all ${activeTabGuide === 3
                ? 'border-emerald-500 bg-theme-surface shadow-xs ring-1 ring-emerald-500'
                : 'border-theme-border bg-theme-surface hover:border-theme-border/80'
              }`}
          >
            <div className="font-bold text-emerald-500 flex items-center gap-1">
              <span>3. Async Queue (12ms Fix)</span>
            </div>
            <div className="text-[11px] text-theme-muted mt-0.5">
              Instant 202 response. Background workers drain smoothly!
            </div>
          </button>
        </div>
      </div>

      {/* 4. Demo Canvas (Largest Element) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
        {/* Left Column: Client Browser & Response Latency */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-theme-accent" />
                User Experience & Latency
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${snap.mode === 'sync'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                  }`}
              >
                {snap.mode === 'sync' ? 'SYNC BLOCKING' : 'ASYNC DECOUPLED'}
              </span>
            </div>

            {/* Response Time Gauge */}
            <div className="p-3 rounded-lg border border-theme-border bg-theme-surface-alt mb-3">
              <div className="text-[11px] text-theme-muted mb-1 flex justify-between">
                <span>Avg Client Latency:</span>
                <span className="font-bold font-mono text-xs">
                  {snap.mode === 'sync' ? '🐢 Slow (User Waits)' : '⚡ Instant (Fast UX)'}
                </span>
              </div>
              <div
                className={`text-2xl font-bold font-mono ${snap.mode === 'sync' ? 'text-amber-500' : 'text-emerald-500'
                  }`}
              >
                ~{snap.avgResponseTimeMs} ms
              </div>
              <div className="text-[11px] text-theme-muted mt-1">
                {snap.mode === 'sync'
                  ? 'HTTP thread stays locked until PDF generates.'
                  : 'API returns HTTP 202 Accepted immediately.'}
              </div>
            </div>

            {/* Recent HTTP Responses */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-theme-text flex justify-between">
                <span>Recent Client Requests:</span>
                <span className="font-mono text-theme-muted">{snap.activeRequests.length} total</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {snap.activeRequests.length === 0 ? (
                  <div className="py-4 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded">
                    Koi request nahi aayi. "Send Request" par click karein.
                  </div>
                ) : (
                  snap.activeRequests.map((req) => (
                    <div
                      key={req.id}
                      className={`p-2 rounded border text-xs font-mono flex items-center justify-between ${req.status === 'timeout'
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-500'
                          : req.status === 'processing'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 animate-pulse'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        }`}
                    >
                      <div className="truncate">
                        <span className="font-bold">[{req.httpStatus}]</span> {req.label.slice(0, 18)}...
                      </div>
                      <span className="shrink-0 text-[10px]">
                        {req.status === 'processing'
                          ? `waiting ${req.remainingSeconds}s`
                          : `${req.responseTimeMs}ms`}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: API Server & Architecture Buffer */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-500" />
                API Server (Thread Pool)
              </span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${snap.httpThreadsUsed >= snap.maxHttpThreads
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-theme-surface-alt text-theme-muted'
                  }`}
              >
                Threads: {snap.httpThreadsUsed}/{snap.maxHttpThreads}
              </span>
            </div>

            {/* Server Thread Meter */}
            <div className="space-y-1 mb-4">
              <div className="w-full h-2.5 bg-theme-surface-alt rounded-full overflow-hidden border border-theme-border">
                <div
                  className={`h-full transition-all duration-300 ${snap.httpThreadsUsed >= snap.maxHttpThreads
                      ? 'bg-rose-500'
                      : snap.httpThreadsUsed > 1
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  style={{
                    width: `${(snap.httpThreadsUsed / snap.maxHttpThreads) * 100}%`,
                  }}
                />
              </div>
              <div className="text-[11px] text-theme-muted flex justify-between font-mono">
                <span>Concurrency Capacity</span>
                <span>{snap.maxHttpThreads - snap.httpThreadsUsed} threads free</span>
              </div>
            </div>

            {/* In Sync vs Async Architecture view with exact Notion Code */}
            <div className="flex-1 p-3 rounded-lg border border-theme-border bg-theme-surface-alt flex flex-col justify-between">
              {snap.mode === 'sync' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                    <AlertOctagon className="w-4 h-4" />
                    <span>Notion Anti-Pattern: Sync in Request</span>
                  </div>
                  <pre className="p-2 rounded bg-theme-surface border border-theme-border text-[10px] font-mono text-theme-muted overflow-x-auto leading-relaxed">
                    {`// Anti-pattern (Notes 1️⃣)
app.post("/signup", async (req, res) => {
  // SMTP slow → thread blocked for 3s
  await sendWelcomeEmail(req.body.email);
  res.json({ ok: true });
});`}
                  </pre>
                  <p className="text-[11px] text-theme-muted">
                    Thread pool exhaust hone par incoming users ko <strong>HTTP 504 Gateway Timeout</strong> milta hai.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                    <Layers className="w-4 h-4" />
                    <span>Notion Solution: Enqueue + 202 Accepted</span>
                  </div>
                  <pre className="p-2 rounded bg-theme-surface border border-theme-border text-[10px] font-mono text-emerald-600 dark:text-emerald-400 overflow-x-auto leading-relaxed">
                    {`// Better (Notes 1️⃣)
app.post("/signup", async (req, res) => {
  await emailQueue.add("welcome", { to: req.body.email });
  res.status(202).json({ queued: true }); // ~12ms!
});`}
                  </pre>
                  <p className="text-[11px] text-theme-muted">
                    API thread sirf 12ms me free ho jata hai. Redis buffer me <strong>{snap.queue.filter((j) => j.state === 'queued').length} jobs</strong> safe hain!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Background Workers */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-theme-surface rounded-lg p-3.5 border border-theme-border h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-theme-text uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-violet-500" />
                Background Worker Pool
              </span>
              <span className="text-[10px] font-mono text-theme-muted">
                {snap.workers.filter((w) => w.status === 'busy').length}/{snap.workers.length} active
              </span>
            </div>

            {snap.mode === 'sync' ? (
              <div className="flex-1 py-8 text-center text-xs text-theme-muted border border-dashed border-theme-border rounded-lg flex flex-col items-center justify-center">
                <span>No Background Workers in Sync Mode.</span>
                <span className="text-[11px] mt-1 text-theme-muted/80">
                  Tasks are forced to execute directly inside the HTTP server thread.
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 flex-1">
                {snap.workers.map((worker) => {
                  const isBusy = worker.status === 'busy';
                  return (
                    <div
                      key={worker.id}
                      className={`p-3 rounded-lg border text-xs transition-all ${isBusy
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-theme-border bg-theme-surface-alt'
                        }`}
                    >
                      <div className="flex items-center justify-between font-bold text-theme-text mb-1">
                        <span>{worker.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase ${isBusy ? 'bg-emerald-500/20 text-emerald-500' : 'bg-theme-surface text-theme-muted'
                            }`}
                        >
                          {worker.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-theme-muted font-mono">
                        {isBusy ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ⚙️ Processing Job #{worker.currentJobId}
                          </span>
                        ) : (
                          'Waiting for queue jobs...'
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="mt-2 p-2 bg-theme-surface-alt rounded border border-theme-border text-[11px] text-theme-muted flex justify-between">
                  <span>Completed in background:</span>
                  <span className="font-mono font-bold text-emerald-500">{snap.completedCount} jobs</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* 6. Collapsed "More Options" Row */}
      <div className="border-t border-theme-border pt-3">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between text-xs text-theme-muted hover:text-theme-text font-medium py-1 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            More options & challenges
            {snap.timeoutCount > 0 && (
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
            {/* Challenges Box */}
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-2">
              <div className="text-xs font-bold text-theme-text uppercase tracking-wider">
                Hands-on Challenges
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-theme-surface border border-theme-border">
                  <span className="text-theme-muted">
                    1. In Sync mode, send 4 or more requests simultaneously to exhaust the thread pool and trigger an HTTP 504 Gateway Timeout.
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
                    2. Switch to Async Queue mode, trigger a 5-request spike, and step the clock until 3 background jobs complete with 0 timeouts.
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
          title="Architecture Traffic & Connection Stream"
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

export default SyncVsAsyncQueueDemo;
