import React from 'react';

export const EventLoopVisualizerDemo: React.FC = () => {
  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Event Loop Phase Runner
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Interactive event loop execution order puzzle visualizer.
          </p>
        </div>
      </div>

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
              process.nextTick queue har phase aur har macrotask ke beech pehle drain hoti hai.
            </div>
            <div className="text-xs text-theme-muted leading-normal font-medium">
              Ek line me: Timers (setTimeout) → Pending → Poll → Check (setImmediate) → Close.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-xl p-5 shadow-sm text-center py-12">
        <p className="text-sm font-semibold text-theme-text">libuv event loop phase visualizer</p>
        <p className="text-xs text-theme-muted mt-1">Microtasks precedence and 10 execution order puzzles.</p>
      </div>
    </div>
  );
};

export default EventLoopVisualizerDemo;
