import React, { useState, useCallback, useEffect } from 'react';
import {
  RabbitMqPrefetchEngine,
  PrefetchSnapshot,
} from '../../../engine/rabbitmq/prefetchEngine';
import { Play, Pause, RotateCcw, ChevronDown, ChevronUp, FastForward, Zap, Clock, Info } from 'lucide-react';

export const PrefetchQoSDemo: React.FC = () => {
  const [engine] = useState(() => new RabbitMqPrefetchEngine(0));
  const [snapshot, setSnapshot] = useState<PrefetchSnapshot>(() => engine.getSnapshot());
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleStep = useCallback(() => {
    const hasMore = engine.step();
    sync();
    if (!hasMore) {
      setIsPlaying(false);
    }
  }, [engine, sync]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && !snapshot.isAllCompleted) {
      timer = setTimeout(() => {
        handleStep();
      }, 700);
    } else {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, snapshot.isAllCompleted, handleStep]);

  const handleSetPrefetch = (limit: number) => {
    setIsPlaying(false);
    engine.setPrefetch(limit);
    sync();
  };

  const handleReset = () => {
    setIsPlaying(false);
    engine.reset();
    sync();
  };

  const fastWorker = snapshot.workers.find((w) => w.id === 'w-fast');
  const slowWorker = snapshot.workers.find((w) => w.id === 'w-slow');

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Prefetch and fair dispatch
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Round-robin worker starvation ko rokne ke liye prefetch (basic.qos) fair dispatch.
          </p>
        </div>
      </div>

      {/* "What just happened?" status line */}
      <div
        role="status"
        aria-live="polite"
        className="relative overflow-hidden px-4 py-3 bg-theme-surface border border-theme-border rounded-xl shadow-xs transition-all"
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
              {snapshot.statusMessage}
            </div>
            <div className="text-xs text-theme-muted mt-1 leading-normal font-medium">
              💡 {snapshot.whyItMatters}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Controls (Max 5 controls) */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Prefetch Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-theme-surface-alt rounded-lg border border-theme-border text-xs font-semibold">
            <button
              onClick={() => handleSetPrefetch(0)}
              className={`px-3 py-1.5 rounded-md font-sans text-xs transition-all ${
                snapshot.prefetchSetting === 0
                  ? 'bg-theme-primary text-black font-bold shadow-xs'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Prefetch = 0 (Unlimited Round-Robin)
            </button>
            <button
              onClick={() => handleSetPrefetch(1)}
              className={`px-3 py-1.5 rounded-md font-sans text-xs transition-all ${
                snapshot.prefetchSetting === 1
                  ? 'bg-theme-primary text-black font-bold shadow-xs'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Prefetch = 1 (Fair QoS)
            </button>
          </div>

          {/* Stepper & Playback controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={snapshot.isAllCompleted}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                isPlaying
                  ? 'bg-amber-500 text-black'
                  : 'bg-theme-primary text-black hover:opacity-90'
              } disabled:opacity-40`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? 'Pause' : 'Auto Play'}
            </button>

            <button
              onClick={handleStep}
              disabled={isPlaying || snapshot.isAllCompleted}
              className="px-3 py-1.5 bg-theme-surface border border-theme-border text-theme-text font-bold rounded-lg text-xs flex items-center gap-1 hover:bg-theme-surface-alt transition-all disabled:opacity-40"
            >
              <FastForward className="w-3.5 h-3.5 text-theme-primary" />
              Tick (Step)
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 bg-theme-surface border border-theme-border text-theme-muted hover:text-theme-text rounded-lg text-xs transition-all"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Simulation Canvas */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
        {/* Tick & Progress Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-theme-border text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono text-theme-muted">Virtual Clock: <b className="text-theme-text">Tick #{snapshot.tick}</b></span>
            <span className="font-mono text-theme-muted">
              Queue Remaining: <b className="text-theme-text">{snapshot.queue.length}</b> tasks
            </span>
          </div>
          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-theme-surface-alt text-theme-accent font-semibold">
            {snapshot.prefetchSetting === 0 ? 'Mode: Round-Robin (Starvation Risk)' : 'Mode: Fair Dispatch (QoS 1)'}
          </span>
        </div>

        {/* Worker Cards Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Worker 1: Fast */}
          <div className="p-4 rounded-xl bg-theme-surface-alt/50 border border-theme-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-sm text-theme-text">Worker 1 (Fast: 2 ticks/task)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">
                {fastWorker?.completedCount} COMPLETED
              </span>
            </div>

            {/* Active task */}
            <div className="p-3 rounded-lg bg-theme-surface border border-theme-border space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-theme-muted">Active Task:</span>
                <span className="font-mono font-bold text-theme-text">
                  {fastWorker?.activeTask ? fastWorker.activeTask.name : 'IDLE (Waiting)'}
                </span>
              </div>
              {fastWorker?.activeTask && (
                <div className="space-y-1">
                  <div className="w-full bg-theme-surface-alt rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full transition-all"
                      style={{
                        width: `${Math.max(
                          0,
                          100 - (fastWorker.activeTask.ticksRemaining / fastWorker.activeTask.requiredTicks) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-theme-muted font-mono block text-right">
                    Remaining: {fastWorker.activeTask.ticksRemaining} tick(s)
                  </span>
                </div>
              )}
            </div>

            {/* Unacked In-flight Buffer */}
            <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-theme-muted">
                <span>Unacknowledged Buffer</span>
                <span>{fastWorker?.unackedBuffer.length} queued in RAM</span>
              </div>
              <div className="flex gap-1 flex-wrap min-h-[24px]">
                {fastWorker?.unackedBuffer.length === 0 ? (
                  <span className="text-[10px] text-theme-muted italic">Buffer empty (safe)</span>
                ) : (
                  fastWorker?.unackedBuffer.map((t) => (
                    <span key={t.id} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">
                      {t.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Worker 2: Slow */}
          <div className="p-4 rounded-xl bg-theme-surface-alt/50 border border-theme-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-sm text-theme-text">Worker 2 (Slow: 6 ticks/task)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-theme-accent font-bold">
                {slowWorker?.completedCount} COMPLETED
              </span>
            </div>

            {/* Active task */}
            <div className="p-3 rounded-lg bg-theme-surface border border-theme-border space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-theme-muted">Active Task:</span>
                <span className="font-mono font-bold text-theme-text">
                  {slowWorker?.activeTask ? slowWorker.activeTask.name : 'IDLE'}
                </span>
              </div>
              {slowWorker?.activeTask && (
                <div className="space-y-1">
                  <div className="w-full bg-theme-surface-alt rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full transition-all"
                      style={{
                        width: `${Math.max(
                          0,
                          100 - (slowWorker.activeTask.ticksRemaining / slowWorker.activeTask.requiredTicks) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-theme-muted font-mono block text-right">
                    Remaining: {slowWorker.activeTask.ticksRemaining} tick(s)
                  </span>
                </div>
              )}
            </div>

            {/* Unacked In-flight Buffer */}
            <div
              className={`p-2.5 rounded-lg border space-y-1 ${
                (slowWorker?.unackedBuffer.length || 0) > 1
                  ? 'bg-red-500/10 border-red-500/40'
                  : 'bg-theme-surface border-theme-border'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-theme-muted">
                <span>Unacknowledged Buffer</span>
                <span className={(slowWorker?.unackedBuffer.length || 0) > 1 ? 'text-red-400 font-bold' : ''}>
                  {slowWorker?.unackedBuffer.length} queued in RAM
                </span>
              </div>
              <div className="flex gap-1 flex-wrap min-h-[24px]">
                {slowWorker?.unackedBuffer.length === 0 ? (
                  <span className="text-[10px] text-theme-muted italic">Buffer empty (safe)</span>
                ) : (
                  slowWorker?.unackedBuffer.map((t) => (
                    <span
                      key={t.id}
                      className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[10px] font-semibold"
                    >
                      {t.name} (choked)
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Callout */}
        <div className="p-3.5 rounded-xl bg-theme-surface border border-theme-border text-xs leading-relaxed text-theme-muted">
          {snapshot.prefetchSetting === 0 ? (
            <p>
              ⚠️ <b>Kyun fail hota hai prefetch=0?</b> RabbitMQ blind round-robin karta hai. Task 1 fast ko mila, Task 2 slow ko, Task 3 fast ko, Task 4 slow ko... Slow worker abhi pehla task hi chaba raha tha tab tak agle tasks uske RAM me line lagakar baith gaye! Fast worker khali baitha raha aur customer ka p99 latency badh gaya.
            </p>
          ) : (
            <p>
              ✅ <b>Prefetch=1 se kya fayda hua?</b> Broker ne rule lagaya: "Jab tak pehle task ka ack na aaye, naya task mat do". Fast worker ne turant acks dekar queue se lagataar tasks uthaye jabki slow worker apne task ko aaram se complete karta raha. System throughput maximum ho gaya!
            </p>
          )}
        </div>
      </div>

      {/* Collapsible More Options */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden shadow-xs">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            More options (Prefetch Tuning Rules of Thumb)
          </span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border text-xs space-y-2 text-theme-muted">
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-1">
              <span className="font-bold text-theme-text block">Production Prefetch Rules of Thumb:</span>
              <div>• <b>CPU-bound tasks:</b> <code>prefetch(1)</code> ya <code>prefetch(2)</code> — taaki cores choke na hon.</div>
              <div>• <b>I/O-bound / Network tasks:</b> <code>prefetch(10)</code> to <code>50</code> — network latency hide karne ke liye.</div>
              <div>• <b>Never use prefetch(0) in production:</b> 0 ka matlab unlimited hota hai, jisse ek single consumer crash hone par redelivery storm aa sakta hai.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrefetchQoSDemo;
