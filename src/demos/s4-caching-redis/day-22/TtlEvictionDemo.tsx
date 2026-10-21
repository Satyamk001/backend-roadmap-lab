import React, { useState, useMemo } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, Terminal, Layers, CheckCircle2, Circle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { RedisEvictionEngine, type EvictionPolicy, type EvictionSnapshot } from '../../../engine/redis/eviction';

export const TtlEvictionDemo: React.FC = () => {
  const engine = useMemo(() => new RedisEvictionEngine('allkeys-lru', 1000), []);
  const [snapshot, setSnapshot] = useState<EvictionSnapshot>(() => engine.getSnapshot());
  const [showEventLog, setShowEventLog] = useState<boolean>(false);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [showStateInspector, setShowStateInspector] = useState<boolean>(false);

  const sync = () => {
    setSnapshot(engine.getSnapshot());
  };

  // 5 Primary Actions
  const handleAddSession = () => {
    const id = Math.random().toString(36).slice(2, 6);
    engine.addKey(`sess:auth_${id}`, 180, 40); // 40s TTL
    sync();
  };

  const handleAddCache = () => {
    const id = Math.random().toString(36).slice(2, 6);
    engine.addKey(`cache:data_${id}`, 220); // Permanent (no TTL)
    sync();
  };

  const handleAccessKey = (keyName?: string) => {
    if (snapshot.keys.length === 0) return;
    const target = keyName || snapshot.keys[Math.floor(Math.random() * snapshot.keys.length)].key;
    engine.accessKey(target);
    sync();
  };

  const handleAdvanceTime = () => {
    engine.advanceTime(15);
    sync();
  };

  const handleFillLimit = () => {
    engine.fillMemoryToLimit();
    sync();
  };

  const handlePolicyChange = (policy: EvictionPolicy) => {
    engine.setPolicy(policy);
    sync();
  };

  const handleReset = () => {
    engine.reset();
    sync();
  };

  // Challenge evaluation
  const challenge1Pass = useMemo(() => {
    return snapshot.stats.expiredKeysCount >= 2;
  }, [snapshot]);

  const challenge2Pass = useMemo(() => {
    return snapshot.policy === 'noeviction' && snapshot.stats.rejectedWritesCount >= 1;
  }, [snapshot]);

  const challenge3Pass = useMemo(() => {
    return snapshot.stats.evictedKeysCount >= 1;
  }, [snapshot]);

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            TTL and eviction policies
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            RAM limits (maxmemory), active/lazy TTL expiration, and eviction policies (noeviction, allkeys-lru, volatile-lru).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt border border-theme-border rounded-lg transition-colors flex items-center gap-1.5 text-theme-text"
            title="Reset eviction engine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. "What just happened?" status banner */}
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
              {snapshot.whatJustHappened}
            </div>
            <div className="text-xs text-theme-muted mt-1 leading-normal font-medium">
              {snapshot.whyItMatters}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Primary Controls Bar (Max 5 primary action buttons) */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-theme-surface border border-theme-border rounded-xl shadow-xs">
        <button
          type="button"
          onClick={handleAddSession}
          className="px-3 py-2 text-xs font-bold rounded-lg bg-theme-primary text-theme-primary-text hover:bg-theme-primary-hover transition-colors shadow-xs"
          title="Add key with TTL 40s"
        >
          Add Session (TTL 40s)
        </button>

        <button
          type="button"
          onClick={handleAddCache}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="Add persistent key without TTL"
        >
          Add Cache (Permanent)
        </button>

        <button
          type="button"
          onClick={() => handleAccessKey()}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="Access random key to update LRU/LFU"
        >
          Access Key (LRU touch)
        </button>

        <button
          type="button"
          onClick={handleAdvanceTime}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors flex items-center gap-1.5"
          title="Advance clock by 15s to trigger expiration"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Advance Time +15s</span>
        </button>

        <button
          type="button"
          onClick={handleFillLimit}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="Fill memory to trigger eviction"
        >
          Fill RAM to Limit
        </button>
      </div>

      {/* 4. Interactive Canvas: Memory Gauge + Policy Switcher + Live Keys Table */}
      <div className="space-y-4">
        {/* Memory Pressure & Policy Card */}
        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
                RAM Memory Limit (maxmemory)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-theme-text">
                  {snapshot.usedMemoryBytes} B
                </span>
                <span className="text-sm text-theme-muted font-mono">
                  / {snapshot.maxmemoryBytes} B ({snapshot.memoryUsagePercent}%)
                </span>
              </div>
            </div>

            {/* Quick Policy Switcher */}
            <div className="flex items-center gap-1 p-1 bg-theme-surface-alt rounded-lg border border-theme-border text-xs">
              <span className="text-theme-muted px-2 font-medium">Policy:</span>
              {(['allkeys-lru', 'noeviction', 'volatile-lru'] as EvictionPolicy[]).map((pol) => {
                const active = snapshot.policy === pol;
                return (
                  <button
                    key={pol}
                    type="button"
                    onClick={() => handlePolicyChange(pol)}
                    className={`px-2.5 py-1 rounded-md font-semibold font-mono text-xs transition-colors ${
                      active
                        ? 'bg-theme-primary text-theme-primary-text shadow-xs'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    {pol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-theme-surface-alt rounded-full h-3 overflow-hidden border border-theme-border">
            <div
              className={`h-full transition-all duration-300 ${
                snapshot.memoryUsagePercent >= 90
                  ? 'bg-red-500'
                  : snapshot.memoryUsagePercent >= 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, snapshot.memoryUsagePercent)}%` }}
            />
          </div>

          {/* Policy Explanation Line */}
          <div className="flex items-start gap-2 p-2.5 bg-theme-surface-alt rounded-lg border border-theme-border/70 text-xs">
            {snapshot.policy === 'noeviction' ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-theme-text leading-relaxed">
                  <b>noeviction:</b> Memory full hone par Redis naye writes par <code>OOM command not allowed</code> throw karega. Purani keys bilkul safe rahengi. Sessions aur queues ke liye ideal.
                </span>
              </>
            ) : snapshot.policy === 'allkeys-lru' ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-theme-text leading-relaxed">
                  <b>allkeys-lru:</b> Memory full hone par sabse purani unaccessed key chupchap evict (delete) ho jayegi. Pure caches ke liye ideal.
                </span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span className="text-theme-text leading-relaxed">
                  <b>volatile-lru:</b> Sirf un keys ko evict karega jin par TTL laga hai. Permanent keys hamesha safe rehti hain.
                </span>
              </>
            )}
          </div>
        </div>

        {/* Live Keyspace Visualizer */}
        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-theme-text">Live Keyspace in RAM</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-theme-surface-alt border border-theme-border text-theme-muted font-mono">
                {snapshot.keys.length} keys
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-theme-muted">
              <span>Evicted: <b className="text-red-600 dark:text-red-400 font-mono">{snapshot.stats.evictedKeysCount}</b></span>
              <span>Expired: <b className="text-amber-600 dark:text-amber-400 font-mono">{snapshot.stats.expiredKeysCount}</b></span>
              <span>Rejected: <b className="text-red-600 dark:text-red-400 font-mono">{snapshot.stats.rejectedWritesCount}</b></span>
            </div>
          </div>

          {snapshot.keys.length === 0 ? (
            <div className="py-8 text-center text-theme-muted text-xs italic">
              RAM khaali hai. Upar &quot;Add Session&quot; ya &quot;Add Cache&quot; click karke keys store karein.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {snapshot.keys.map((k) => {
                const isVolatile = k.expiresAtTick !== undefined;
                const remaining = isVolatile ? Math.max(0, k.expiresAtTick! - snapshot.tick) : null;
                const isNearExpiry = remaining !== null && remaining <= 15;

                return (
                  <div
                    key={k.key}
                    onClick={() => handleAccessKey(k.key)}
                    className="group cursor-pointer p-3 bg-theme-surface-alt hover:border-theme-primary/60 border border-theme-border rounded-lg space-y-2 transition-all shadow-2xs"
                    title="Click to access and refresh LRU"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-mono text-xs font-bold text-theme-accent truncate">
                        {k.key}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-theme-surface border border-theme-border text-theme-muted shrink-0">
                        {k.sizeBytes} B
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-theme-muted">TTL:</span>
                      {isVolatile ? (
                        <span className={`font-bold ${isNearExpiry ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-theme-text'}`}>
                          {remaining}s left
                        </span>
                      ) : (
                        <span className="text-theme-muted italic">Permanent</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-theme-border/50 text-theme-muted">
                      <span>Hits: <b className="text-theme-text">{k.accessCount}</b></span>
                      <span>Last: <b className="text-theme-text">T+{k.lastAccessedTick}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. Collapsible Event Log */}
      <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-surface shadow-xs">
        <button
          type="button"
          onClick={() => setShowEventLog(!showEventLog)}
          className="w-full flex items-center justify-between p-3.5 bg-theme-surface-alt hover:bg-theme-border/40 text-sm font-semibold text-theme-text transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-theme-muted" />
            <span className="font-bold">Eviction &amp; TTL live logs</span>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-theme-surface border border-theme-border text-theme-muted">
              {snapshot.eventLog.length} events
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <span>{showEventLog ? 'Hide log' : 'Show log'}</span>
            {showEventLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showEventLog && (
          <div className="p-4 border-t border-theme-border space-y-2">
            <ul className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto divide-y divide-theme-border/40 text-theme-text">
              {snapshot.eventLog.map((log) => (
                <li key={log.id} className="py-1 flex items-start gap-2">
                  <span className="text-theme-muted text-[10px] w-12 flex-shrink-0">T+{log.tick}</span>
                  <span
                    className={`font-bold flex-shrink-0 ${
                      log.type === 'error'
                        ? 'text-red-600 dark:text-red-400'
                        : log.type === 'info'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {log.action}
                  </span>
                  <span className="text-theme-muted">→</span>
                  <span className="text-theme-text">{log.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 6. Collapsed "More Options" Row (Challenges & State Inspector) */}
      <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-surface">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between p-3 bg-theme-surface-alt hover:bg-theme-border/50 text-xs font-semibold text-theme-text transition-colors select-none"
        >
          <span>More options (Eviction challenges &amp; memory inspector)</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 space-y-4 border-t border-theme-border text-xs">
            {/* Challenges */}
            <div className="space-y-2">
              <h4 className="font-bold text-theme-text uppercase tracking-wider text-[11px]">
                🎯 Hands-on Eviction Challenges
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {challenge1Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-theme-muted" />
                    )}
                    <span className={challenge1Pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'}>
                      1. Natural Expiration
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    &quot;Advance Time +15s&quot; dabao jab tak kam se kam 2 keys naturally expire na ho jayein.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {challenge2Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-theme-muted" />
                    )}
                    <span className={challenge2Pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'}>
                      2. noeviction OOM Guard
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    Policy ko <code>noeviction</code> par set karo aur &quot;Fill RAM&quot; dabakar write rejection dekho.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {challenge3Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-theme-muted" />
                    )}
                    <span className={challenge3Pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'}>
                      3. LRU Eviction Under Pressure
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    <code>allkeys-lru</code> policy me memory bharo aur dekho sabse purani key kaise auto-evict hoti hai.
                  </p>
                </div>
              </div>
            </div>

            {/* State Inspector */}
            <div className="pt-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setShowStateInspector(!showStateInspector)}
                className="flex items-center gap-1.5 text-xs text-theme-accent font-semibold hover:underline"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showStateInspector ? 'Hide raw memory snapshot' : 'Inspect raw memory JSON snapshot'}</span>
              </button>

              {showStateInspector && (
                <pre className="mt-2 p-3 bg-stone-900 text-stone-100 rounded-lg text-[11px] font-mono max-h-60 overflow-auto border border-theme-border">
                  {JSON.stringify(snapshot, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TtlEvictionDemo;
