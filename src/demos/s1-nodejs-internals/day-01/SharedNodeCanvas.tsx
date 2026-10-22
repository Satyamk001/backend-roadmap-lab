import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Cpu,
  Globe,
  HardDrive,
  Hourglass,
  Layers,
  Radio,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { EngineSnapshot, EventLoopPhase } from '../../../engine/node/types';

interface SharedNodeCanvasProps {
  snapshot: EngineSnapshot;
  code: string;
  activeLine?: number;
  interactiveControls?: React.ReactNode;
}

const PHASES: Array<{
  id: EventLoopPhase;
  name: string;
  subtext: string;
  badge: string;
}> = [
  { id: 'timers', name: 'Timers', subtext: 'setTimeout, setInterval', badge: '1' },
  { id: 'pending', name: 'Pending', subtext: 'Deferred system I/O (TCP)', badge: '2' },
  { id: 'idle', name: 'Idle / Prepare', subtext: 'libuv internal use only', badge: '3' },
  { id: 'poll', name: 'Poll', subtext: 'I/O callbacks, waits for events', badge: '4' },
  { id: 'check', name: 'Check', subtext: 'setImmediate callbacks', badge: '5' },
  { id: 'close', name: 'Close', subtext: 'socket.on("close")', badge: '6' },
];

export const SharedNodeCanvas: React.FC<SharedNodeCanvasProps> = ({
  snapshot,
  code,
  activeLine = snapshot.line,
  interactiveControls,
}) => {
  const codeLines = code.split('\n');

  return (
    <div className="space-y-4">
      {/* 1. "Why this next?" Live Narrative Caption Banner */}
      <div className="rounded-xl border border-theme-border bg-theme-surface-alt/60 p-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <Sparkles className="h-4 w-4 text-theme-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-theme-accent">
                Why this next?
              </span>
              <span className="rounded-md border border-theme-border bg-theme-surface px-1.5 py-0.2 font-mono text-[10.5px] font-semibold text-theme-muted">
                Step {snapshot.stepIndex + 1} of {snapshot.totalSteps}
              </span>
            </div>
            <p className="mt-1 text-[13.5px] sm:text-[14px] font-medium leading-relaxed text-theme-text">
              {snapshot.caption}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Optional Freeze / Failure Mode Warning Banner */}
      {snapshot.isBlocked && (
        <div
          role="alert"
          className="rounded-xl border border-semantic-error/60 bg-semantic-error-bg p-3.5 shadow-xs animate-pulse"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-semantic-error flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[13px] font-bold uppercase tracking-wider text-semantic-error">
                EVENT LOOP BLOCKED / STARVED
              </p>
              <p className="mt-0.5 text-[13.5px] font-medium text-semantic-error">
                {snapshot.blockedReason || 'Call stack or queues blocked! Zero async I/O can be processed.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Code Panel & Interactive Triggers */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-start">
        {/* Code Block with Highlighted Active Line (8 cols on lg) */}
        <div
          data-highlight-id="code-panel"
          className="lg:col-span-8 rounded-xl border border-theme-border bg-theme-bg overflow-hidden shadow-2xs"
        >
          <div className="flex items-center justify-between border-b border-theme-border/60 bg-theme-surface px-3 py-1.5 text-[11.5px] font-mono text-theme-muted">
            <span className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
              <span>script.js</span>
            </span>
            <span>line {activeLine}</span>
          </div>

          <pre className="p-3 text-[12.5px] sm:text-[13px] font-mono leading-relaxed overflow-x-auto">
            {codeLines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const isActive = lineNum === activeLine;
              return (
                <div
                  key={lineNum}
                  className={`flex items-start gap-3 px-2 py-0.5 rounded transition-colors ${
                    isActive
                      ? 'bg-theme-primary/15 border-l-2 border-theme-primary font-semibold text-theme-text'
                      : 'text-theme-text/80 hover:bg-theme-surface-alt/40'
                  }`}
                >
                  <span className="w-5 text-right select-none text-theme-muted/60 font-normal">
                    {lineNum}
                  </span>
                  <span className="flex-1 whitespace-pre">{lineText || ' '}</span>
                </div>
              );
            })}
          </pre>
        </div>

        {/* Quick Context & Interactive Controls (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-2.5">
          {interactiveControls && (
            <div className="rounded-xl border border-theme-border bg-theme-surface p-3 shadow-2xs">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-theme-muted block mb-2">
                Scenario Actions
              </span>
              {interactiveControls}
            </div>
          )}

          {/* Golden Rule Cheat Card */}
          <div className="rounded-xl border border-theme-border bg-theme-surface p-3 shadow-2xs space-y-1.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-theme-accent flex items-center gap-1">
              <Zap className="h-3 w-3" aria-hidden="true" />
              <span>Execution Priority</span>
            </span>
            <div className="text-[12px] font-mono leading-snug space-y-1 text-theme-muted">
              <div className="flex items-center gap-1.5 font-semibold text-theme-text">
                <span className="rounded bg-theme-surface-alt px-1 py-0.2">1</span> Sync Main Script
              </div>
              <div className="flex items-center gap-1.5 text-semantic-info font-semibold">
                <span className="rounded bg-semantic-info-bg px-1 py-0.2 text-semantic-info">2</span> process.nextTick (drain)
              </div>
              <div className="flex items-center gap-1.5 text-theme-accent font-semibold">
                <span className="rounded bg-theme-surface-alt px-1 py-0.2 text-theme-accent">3</span> Promise Microtasks
              </div>
              <div className="flex items-center gap-1.5 text-theme-muted font-semibold">
                <span className="rounded bg-theme-surface-alt px-1 py-0.2">4</span> libuv Phase (Macrotask)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Lanes Grid (Call Stack, nextTick, Promise, Phase Ring, libuv, Console) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Lane 1: Call Stack */}
        <div
          data-highlight-id="callstack"
          className="rounded-xl border border-theme-border bg-theme-surface p-3 shadow-2xs flex flex-col min-h-[180px]"
        >
          <div className="flex items-center justify-between border-b border-theme-border/60 pb-2 mb-2">
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-theme-text">
              <Layers className="h-4 w-4 text-theme-accent" aria-hidden="true" />
              <span>Call Stack (V8)</span>
            </span>
            <span className="rounded-full border border-theme-border bg-theme-surface-alt px-1.5 py-0.2 font-mono text-[10.5px] font-semibold text-theme-muted">
              {snapshot.callStack.length} frame{snapshot.callStack.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex-1 flex flex-col-reverse justify-end gap-1.5 overflow-y-auto">
            {snapshot.callStack.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-6 text-center text-theme-muted">
                <CheckCircle className="h-5 w-5 text-semantic-success mb-1" aria-hidden="true" />
                <p className="text-[12px] font-semibold">Stack is Empty</p>
                <p className="text-[11px] text-theme-muted">Ready to drain microtasks / event loop</p>
              </div>
            ) : (
              snapshot.callStack.map((frame, index) => (
                <div
                  key={frame.id || index}
                  className={`rounded-lg border px-2.5 py-1.5 font-mono text-[12px] shadow-2xs transition-all ${
                    index === snapshot.callStack.length - 1
                      ? 'border-theme-primary bg-theme-primary/10 font-bold text-theme-text'
                      : 'border-theme-border bg-theme-bg text-theme-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{frame.name}</span>
                    {frame.isGec && (
                      <span className="text-[10px] uppercase font-bold text-theme-accent">GEC</span>
                    )}
                  </div>
                  {frame.scope && (
                    <div className="mt-1 pt-1 border-t border-theme-border/40 text-[10.5px] text-theme-muted space-x-2">
                      {Object.entries(frame.scope).map(([k, v]) => (
                        <span key={k}>
                          {k}: <code className="text-theme-text">{v}</code>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* GEC Memory Creation Panel (if available in snapshot) */}
          {snapshot.memoryCreation && snapshot.memoryCreation.length > 0 && (
            <div data-highlight-id="memory" className="mt-2 pt-2 border-t border-theme-border/60">
              <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-theme-muted block mb-1">
                GEC Memory Allocation
              </span>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {snapshot.memoryCreation.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between text-[11px] font-mono bg-theme-bg px-1.5 py-0.5 rounded border border-theme-border/50"
                  >
                    <span className="text-theme-muted">
                      {m.kind} <strong className="text-theme-text">{m.name}</strong>
                    </span>
                    <span
                      className={`text-[10.5px] px-1 rounded ${
                        m.status === 'tdz'
                          ? 'bg-semantic-error-bg text-semantic-error font-semibold'
                          : m.value === 'undefined'
                          ? 'bg-theme-surface-alt text-theme-muted'
                          : 'bg-semantic-success-bg text-semantic-success font-semibold'
                      }`}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lane 2: Microtasks Queues (nextTick & Promise) */}
        <div
          data-highlight-id="queues"
          className="rounded-xl border border-theme-border bg-theme-surface p-3 shadow-2xs flex flex-col min-h-[180px] space-y-3"
        >
          {/* Sublane: process.nextTick Queue */}
          <div data-highlight-id="nexttick-queue" className="flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-1 mb-1.5">
              <span className="flex items-center gap-1 text-[12px] font-bold text-semantic-info">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                <span>nextTick Queue</span>
              </span>
              <span className="rounded-full border border-semantic-info/40 bg-semantic-info-bg px-1.5 py-0.2 font-mono text-[10px] font-bold text-semantic-info">
                Priority 1 ({snapshot.nextTickQueue.length})
              </span>
            </div>

            <div className="space-y-1 overflow-y-auto flex-1 min-h-[48px]">
              {snapshot.nextTickQueue.length === 0 ? (
                <div className="text-[11.5px] text-theme-muted py-2 text-center italic">
                  Queue empty
                </div>
              ) : (
                snapshot.nextTickQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded border border-semantic-info/40 bg-semantic-info-bg px-2 py-1 font-mono text-[11.5px] text-semantic-info font-medium flex items-center justify-between"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] opacity-75">nextTick</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sublane: Promise Microtasks Queue */}
          <div data-highlight-id="promise-queue" className="flex-1 flex flex-col border-t border-theme-border/60 pt-2">
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-1 mb-1.5">
              <span className="flex items-center gap-1 text-[12px] font-bold text-theme-accent">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Promise Microtasks</span>
              </span>
              <span className="rounded-full border border-theme-border bg-theme-surface-alt px-1.5 py-0.2 font-mono text-[10px] font-bold text-theme-accent">
                Priority 2 ({snapshot.promiseQueue.length})
              </span>
            </div>

            <div className="space-y-1 overflow-y-auto flex-1 min-h-[48px]">
              {snapshot.promiseQueue.length === 0 ? (
                <div className="text-[11.5px] text-theme-muted py-2 text-center italic">
                  Queue empty
                </div>
              ) : (
                snapshot.promiseQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded border border-theme-border bg-theme-surface-alt px-2 py-1 font-mono text-[11.5px] text-theme-accent font-medium flex items-center justify-between"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] opacity-75">promise</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Lane 3: Console Output */}
        <div
          data-highlight-id="console"
          className="rounded-xl border border-theme-border bg-theme-surface p-3 shadow-2xs flex flex-col min-h-[180px]"
        >
          <div className="flex items-center justify-between border-b border-theme-border/60 pb-2 mb-2">
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-theme-text">
              <Terminal className="h-4 w-4 text-theme-accent" aria-hidden="true" />
              <span>Console Output</span>
            </span>
            <span className="rounded-full border border-theme-border bg-theme-surface-alt px-1.5 py-0.2 font-mono text-[10.5px] font-semibold text-theme-muted">
              {snapshot.consoleOutput.length} line{snapshot.consoleOutput.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex-1 rounded-lg bg-theme-bg border border-theme-border p-2.5 font-mono text-[12px] overflow-y-auto space-y-1">
            {snapshot.consoleOutput.length === 0 ? (
              <div className="h-full flex items-center justify-center text-theme-muted/60 text-[11.5px] italic">
                Awaiting console output...
              </div>
            ) : (
              snapshot.consoleOutput.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-start gap-2 ${
                    c.isError ? 'text-semantic-error font-bold' : 'text-theme-text'
                  }`}
                >
                  <span className="text-theme-muted select-none">›</span>
                  <span className="break-all">{c.text}</span>
                  <span className="ml-auto text-[10px] text-theme-muted font-mono select-none">
                    t{c.tick}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Phase Ring Lane (Always Visible 6-Phase Indicator) */}
      <div
        data-highlight-id="phase-ring"
        className="rounded-xl border border-theme-border bg-theme-surface p-3.5 shadow-2xs space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-theme-accent animate-pulse" aria-hidden="true" />
            <span className="text-[13px] font-bold text-theme-text">
              libuv Event Loop Phase Ring
            </span>
            <span className="rounded-md border border-theme-border bg-theme-surface-alt px-1.5 py-0.2 font-mono text-[11px] font-bold text-theme-accent">
              Active: {snapshot.currentPhase.toUpperCase()}
            </span>
          </div>
          <span className="font-mono text-[11px] text-theme-muted">
            Active handles: {snapshot.activeHandles}
          </span>
        </div>

        {/* 6 Phases Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PHASES.map((phase) => {
            const isCurrent = snapshot.currentPhase === phase.id;
            const waitingCount = snapshot.phaseCounters[phase.id] ?? 0;

            return (
              <div
                key={phase.id}
                data-highlight-id={`phase-${phase.id}`}
                className={`relative rounded-xl border p-2.5 flex flex-col justify-between transition-all duration-200 ${
                  isCurrent
                    ? 'border-theme-primary bg-theme-primary/10 ring-2 ring-theme-primary/40 shadow-xs'
                    : 'border-theme-border bg-theme-bg hover:bg-theme-surface-alt/40'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="font-mono text-[10.5px] font-bold rounded bg-theme-surface px-1 py-0.2 text-theme-muted border border-theme-border">
                    #{phase.badge}
                  </span>
                  {waitingCount > 0 && (
                    <span className="rounded-full bg-theme-primary text-theme-primary-text font-mono text-[10px] font-bold px-1.5 py-0.2">
                      {waitingCount} queued
                    </span>
                  )}
                </div>

                <div>
                  <p className={`text-[12.5px] font-bold ${isCurrent ? 'text-theme-text' : 'text-theme-muted'}`}>
                    {phase.name}
                  </p>
                  <p className="text-[10.5px] text-theme-muted leading-tight mt-0.5 truncate">
                    {phase.subtext}
                  </p>
                </div>

                {isCurrent && (
                  <div className="mt-2 pt-1 border-t border-theme-primary/30 flex items-center gap-1 text-[11px] font-semibold text-theme-accent">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-theme-primary"></span>
                    </span>
                    <span>Pointer Here</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. libuv Zone (Timer Heap, Thread Pool 4 Workers, Kernel I/O) */}
      <div
        data-highlight-id="libuv"
        className="rounded-xl border border-theme-border bg-theme-surface p-3.5 shadow-2xs space-y-3"
      >
        <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-theme-accent" aria-hidden="true" />
            <span className="text-[13px] font-bold text-theme-text">libuv Execution Zone</span>
            <span className="rounded-md border border-theme-border bg-theme-surface-alt px-2 py-0.2 font-mono text-[11px] text-theme-muted">
              OS Async + Thread Pool (Size: 4)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Sub-zone 1: Timer Heap (Min-Heap) */}
          <div
            data-highlight-id="timers-heap"
            className="rounded-lg border border-theme-border bg-theme-bg p-2.5 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-1 mb-2">
              <span className="flex items-center gap-1 text-[11.5px] font-bold text-theme-text">
                <Hourglass className="h-3.5 w-3.5 text-theme-muted" aria-hidden="true" />
                <span>Timer Min-Heap</span>
              </span>
              <span className="font-mono text-[10.5px] text-theme-muted">
                {snapshot.timerHeap.length} active
              </span>
            </div>

            <div className="space-y-1.5 flex-1 min-h-[60px] overflow-y-auto">
              {snapshot.timerHeap.length === 0 ? (
                <div className="text-[11px] text-theme-muted text-center py-4">No active timers</div>
              ) : (
                snapshot.timerHeap.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded border border-theme-border bg-theme-surface px-2 py-1 font-mono text-[11px]"
                  >
                    <span className="text-theme-text font-medium">{t.label}</span>
                    <span
                      className={`px-1 rounded text-[10px] font-semibold ${
                        t.ready ? 'bg-semantic-success-bg text-semantic-success' : 'text-theme-muted'
                      }`}
                    >
                      {t.ready ? 'DUE NOW' : `delay: ${t.delay}ms`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sub-zone 2: Thread Pool (4 Workers + Queue) */}
          <div
            data-highlight-id="workers"
            className="rounded-lg border border-theme-border bg-theme-bg p-2.5 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-1 mb-2">
              <span className="flex items-center gap-1 text-[11.5px] font-bold text-theme-text">
                <HardDrive className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />
                <span>Thread Pool (4 Workers)</span>
              </span>
              <span className="font-mono text-[10.5px] text-theme-muted">
                {snapshot.workers.filter((w) => w.busy).length}/4 busy
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {snapshot.workers.map((w) => (
                <div
                  key={w.id}
                  className={`rounded border p-1.5 font-mono text-[11px] transition-colors ${
                    w.busy
                      ? 'border-semantic-inflight/60 bg-semantic-inflight-bg text-theme-text font-semibold'
                      : 'border-theme-border bg-theme-surface text-theme-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Worker {w.id}</span>
                    <span
                      className={`text-[9.5px] px-1 rounded font-bold uppercase ${
                        w.busy ? 'text-semantic-inflight' : 'text-semantic-success'
                      }`}
                    >
                      {w.busy ? 'BUSY' : 'IDLE'}
                    </span>
                  </div>
                  {w.task && <p className="truncate text-[10px] mt-0.5 text-theme-text">{w.task}</p>}
                </div>
              ))}
            </div>

            {/* Worker Wait Queue */}
            {snapshot.workerQueue.length > 0 && (
              <div data-highlight-id="worker-queue" className="mt-2 pt-1.5 border-t border-theme-border/60">
                <span className="font-mono text-[10px] font-bold text-semantic-inflight block mb-1">
                  Wait Queue ({snapshot.workerQueue.length} tasks blocked):
                </span>
                <div className="space-y-1 max-h-16 overflow-y-auto font-mono text-[10.5px]">
                  {snapshot.workerQueue.map((item, i) => (
                    <div key={i} className="rounded bg-theme-surface border border-theme-border px-1.5 py-0.5 truncate text-theme-muted">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sub-zone 3: Kernel OS Async I/O */}
          <div
            data-highlight-id="kernel"
            className="rounded-lg border border-theme-border bg-theme-bg p-2.5 flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-1 mb-2">
              <span className="flex items-center gap-1 text-[11.5px] font-bold text-theme-text">
                <Globe className="h-3.5 w-3.5 text-semantic-info" aria-hidden="true" />
                <span>Kernel OS Async (epoll/kqueue)</span>
              </span>
              <span className="font-mono text-[10.5px] text-semantic-info font-bold">
                No threads
              </span>
            </div>

            <div className="space-y-1.5 flex-1 min-h-[60px] overflow-y-auto">
              {snapshot.kernelTasks.length === 0 ? (
                <div className="text-[11px] text-theme-muted text-center py-4">
                  No active sockets
                </div>
              ) : (
                snapshot.kernelTasks.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between rounded border border-semantic-info/40 bg-semantic-info-bg px-2 py-1 font-mono text-[11px]"
                  >
                    <span className="truncate text-semantic-info font-medium">{k.label}</span>
                    <span className="text-[10px] font-bold uppercase text-semantic-info ml-1">
                      {k.status}
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-[10.5px] text-theme-muted leading-tight border-t border-theme-border/50 pt-1">
              Network I/O stays in OS kernel; never touches the 4 thread pool workers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
