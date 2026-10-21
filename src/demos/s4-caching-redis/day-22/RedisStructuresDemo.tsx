import React from 'react';

export const RedisStructuresDemo: React.FC = () => {
  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Redis In-Memory Structures &amp; TTL
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Explore Redis commands, memory layouts, and eviction policies.
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
              Redis har data structure (Strings, Hashes, ZSets) ko RAM me efficiently store karta hai.
            </div>
            <div className="text-xs text-theme-muted mt-1 leading-normal font-medium">
              Ek line me: Memory full hone par maxmemory-policy (LRU/LFU) purani keys evict karti hai.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-xl p-5 shadow-sm text-center py-12">
        <p className="text-sm font-semibold text-theme-text">Redis in-memory data structures visualizer</p>
        <p className="text-xs text-theme-muted mt-1">Hashes, Sorted Sets, TTL expiration, and RDB/AOF persistence.</p>
      </div>
    </div>
  );
};

export default RedisStructuresDemo;
