import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Info, Plus, Trash2 } from 'lucide-react';
import {
  EvictionKeyItem,
  EvictionPolicy,
  RedisEvictionEngine,
} from '../../../engine/redis/eviction';
import {
  DemoActionButton,
  DemoChallenge,
  DemoLogEntry,
  DemoShell,
} from './DemoShell';

const MAXMEMORY = 1000;
const INTRO_WHAT =
  '4 keys RAM me hain: do sessions ke paas TTL hai, cache aur views permanent hain.';
const INTRO_WHY =
  'TTL waqt se key hatata hai; eviction memory full hone par policy se key chunta hai. Do alag reasons.';

const SCENARIO = [
  { key: 'sess:auth_u101', sizeBytes: 180, ttlSeconds: 20 },
  { key: 'sess:auth_u102', sizeBytes: 180, ttlSeconds: 45 },
  { key: 'cache:catalog_v1', sizeBytes: 250 },
  { key: 'views:post_42', sizeBytes: 120 },
];

function createEngine(): RedisEvictionEngine {
  const engine = new RedisEvictionEngine('allkeys-lru', MAXMEMORY);
  engine.loadScenario(SCENARIO, {
    whatJustHappened: INTRO_WHAT,
    whyItMatters: INTRO_WHY,
  });
  return engine;
}

function ttlRemaining(item: EvictionKeyItem, tick: number): number | null {
  if (item.expiresAtTick === undefined) return null;
  return Math.max(0, item.expiresAtTick - tick);
}

export const TtlVsEvictionDemo: React.FC = () => {
  const engine = useMemo(createEngine, []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const addIndexRef = useRef(0);
  const [departingKeys, setDepartingKeys] = useState<EvictionKeyItem[]>([]);
  const [isOomShaking, setIsOomShaking] = useState(false);
  const prevKeysRef = useRef<Map<string, EvictionKeyItem>>(
    new Map(engine.getSnapshot().keys.map((k) => [k.key, k]))
  );
  const prevRejectedRef = useRef(engine.getSnapshot().stats.rejectedWritesCount);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  useEffect(() => {
    if (snapshot.stats.rejectedWritesCount > prevRejectedRef.current) {
      setIsOomShaking(true);
      const timer = setTimeout(() => setIsOomShaking(false), 350);
      prevRejectedRef.current = snapshot.stats.rejectedWritesCount;
      return () => clearTimeout(timer);
    }
    prevRejectedRef.current = snapshot.stats.rejectedWritesCount;
  }, [snapshot.stats.rejectedWritesCount]);

  useEffect(() => {
    const currentKeySet = new Set(snapshot.keys.map((k) => k.key));
    const newlyDeparted: EvictionKeyItem[] = [];
    for (const [key, item] of prevKeysRef.current.entries()) {
      if (!currentKeySet.has(key)) {
        newlyDeparted.push(item);
      }
    }
    prevKeysRef.current = new Map(snapshot.keys.map((k) => [k.key, k]));

    if (newlyDeparted.length > 0) {
      setDepartingKeys(newlyDeparted);
      const timer = setTimeout(() => {
        setDepartingKeys([]);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [snapshot.keys]);

  const handleAdvance = useCallback(() => {
    engine.advanceTime(25);
    sync();
  }, [engine, sync]);

  const handleAddKey = useCallback(() => {
    const beforeEvicted = engine.getSnapshot().stats.evictedKeysCount;
    addIndexRef.current += 1;
    const key = `bulk:report_${addIndexRef.current}`;
    const stored = engine.addKey(key, 300);
    const next = engine.getSnapshot();
    const evicted = next.stats.evictedKeysCount - beforeEvicted;

    if (stored && evicted > 0) {
      engine.setNarrative(
        `Nayi 300B key ne memory limit cross ki; '${next.policy}' ne ${evicted} key evict ki.`,
        'Eviction memory pressure se hoti hai — key ka TTL waqt khatam hone ki zarurat nahi.'
      );
    }

    sync();
  }, [engine, sync]);

  const handlePolicy = useCallback(
    (policy: EvictionPolicy) => {
      engine.setPolicy(policy);
      sync();
    },
    [engine, sync]
  );

  const handleReset = useCallback(() => {
    engine.setPolicy('allkeys-lru');
    engine.loadScenario(SCENARIO, {
      whatJustHappened: INTRO_WHAT,
      whyItMatters: INTRO_WHY,
    });
    addIndexRef.current = 0;
    setDepartingKeys([]);
    setIsOomShaking(false);
    sync();
  }, [engine, sync]);

  const existingKeys = new Set(snapshot.keys.map((item) => item.key));
  const removedMap = new Map<
    string,
    { key: string; reason: 'TTL' | 'Eviction'; tick: number }
  >();
  for (const event of snapshot.eventLog) {
    if (!event.key || removedMap.has(event.key)) continue;
    if (event.action.startsWith('TTL EXPIRED')) {
      removedMap.set(event.key, {
        key: event.key,
        reason: 'TTL',
        tick: event.tick,
      });
    } else if (event.action.startsWith('EVICTED')) {
      removedMap.set(event.key, {
        key: event.key,
        reason: 'Eviction',
        tick: event.tick,
      });
    }
  }
  const removedKeys = [...removedMap.values()].slice(0, 3);

  const logs: DemoLogEntry[] = snapshot.eventLog.map((event) => {
    const stillPresent = event.key ? existingKeys.has(event.key) : false;
    return {
      id: event.id,
      tick: event.tick,
      label: event.action,
      message: event.detail,
      type: event.type,
      target: event.key
        ? stillPresent
          ? `key:${event.key}`
          : `removed:${event.key}`
        : undefined,
    };
  });

  const challenges: DemoChallenge[] = [
    {
      id: 'ttl-expire-key',
      title: 'TTL se ek key expire karo',
      description: 'Advance 25s dabao. sess:auth_u101 ka TTL khatam hoga.',
      passed: snapshot.stats.expiredKeysCount >= 1,
    },
    {
      id: 'eviction-remove-key',
      title: 'Eviction se ek key hatao',
      description:
        'allkeys-lru me 300B keys add karo jab tak memory limit cross ho.',
      passed: snapshot.stats.evictedKeysCount >= 1,
    },
    {
      id: 'noeviction-reject',
      title: 'noeviction me write reject karao',
      description: 'Policy noeviction karo aur memory bharne par 300B key add karo.',
      passed: snapshot.stats.rejectedWritesCount >= 1,
    },
  ];

  const usedPercent = Math.min(100, snapshot.memoryUsagePercent);

  return (
    <DemoShell
      title="TTL vs eviction: why a key disappears"
      summary="TTL time se key hatata hai; eviction memory full hone par policy se key chunta hai. Same result, alag reason."
      difficulty="medium"
      notesAnchor="memory-eviction-persistence-se-pehle-ye-zaruri"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={logs}
      challenges={challenges}
      stateSnapshot={{
        tick: snapshot.tick,
        policy: snapshot.policy,
        maxmemoryBytes: snapshot.maxmemoryBytes,
        usedMemoryBytes: snapshot.usedMemoryBytes,
        keys: snapshot.keys,
        stats: snapshot.stats,
      }}
      onReset={handleReset}
      onPrimaryAction={handleAdvance}
      resetLabel="Reset memory scenario"
      actions={
        <>
          <DemoActionButton variant="primary" onClick={handleAdvance}>
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Advance 25s (Trigger TTL)</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAddKey}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add 300B key (Fill RAM)</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* RAM Capacity Meter & Policy Switcher */}
        <div
          className={`rounded-xl border bg-theme-bg p-4 transition-all duration-300 shadow-2xs ${
            isOomShaking ? 'demo-oom-shake border-semantic-error ring-2 ring-semantic-error/40' : 'border-theme-border'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-theme-muted">
                  Redis RAM Capacity Gauge
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  maxmemory: 1000 B
                </span>
              </div>
              <p className="mt-1 font-mono text-[18px] sm:text-[20px] font-extrabold tabular-nums tracking-tight text-theme-text">
                {snapshot.usedMemoryBytes} B <span className="text-[14px] font-normal text-theme-muted">/ 1000 B ({snapshot.memoryUsagePercent}%)</span>
              </p>
            </div>

            {/* Policy Toggle */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] font-mono text-theme-muted uppercase font-bold">Eviction Policy:</span>
              <div
                role="group"
                aria-label="Memory policy"
                className="flex items-center gap-1 rounded-xl border border-theme-border bg-theme-surface-alt/70 p-1 shadow-2xs"
              >
                {(['allkeys-lru', 'noeviction'] as const).map((policy) => {
                  const active = snapshot.policy === policy;
                  return (
                    <button
                      key={policy}
                      type="button"
                      aria-pressed={active}
                      onClick={() => handlePolicy(policy)}
                      className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-all ${
                        active
                          ? 'bg-theme-surface text-theme-text shadow-xs ring-1 ring-theme-border'
                          : 'text-theme-muted hover:text-theme-text'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />}
                      <span className="font-mono">{policy}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="mt-3.5">
            <div
              role="meter"
              aria-label="Redis memory usage"
              aria-valuemin={0}
              aria-valuemax={snapshot.maxmemoryBytes}
              aria-valuenow={snapshot.usedMemoryBytes}
              className="h-3 overflow-hidden rounded-full bg-theme-surface-alt p-0.5"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  usedPercent >= 100
                    ? 'bg-semantic-error'
                    : usedPercent >= 80
                    ? 'bg-theme-primary'
                    : 'bg-semantic-info'
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-theme-muted">
              <span>0 B</span>
              <span className="text-theme-muted">800 B (80% threshold)</span>
              <span className={usedPercent >= 100 ? 'font-bold text-semantic-error' : ''}>1000 B Limit</span>
            </div>
          </div>

          <div className="mt-2.5 rounded-lg border border-theme-border/60 bg-theme-surface-alt/40 px-3 py-2 font-mono text-[12.5px] text-theme-text">
            {snapshot.policy === 'allkeys-lru' ? (
              <span className="text-semantic-info">
                <strong>allkeys-lru:</strong> RAM bharte hi least-recently accessed key evict hogi (TTL ho ya na ho).
              </span>
            ) : (
              <span className="text-semantic-error">
                <strong>noeviction:</strong> RAM bharte hi koi key delete nahi hogi — naye writes OOM error se fail honge.
              </span>
            )}
          </div>
        </div>

        {/* Active Keys in RAM */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[13px] font-mono text-theme-muted">
            <span className="font-bold uppercase tracking-wider text-[11.5px]">Resident RAM Keys ({snapshot.keys.length})</span>
            <span>Hover or inspect LRU timestamps</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {snapshot.keys.length === 0 && departingKeys.length === 0 ? (
              <p className="rounded-xl border border-dashed border-theme-border bg-theme-bg p-6 text-center text-[15px] text-theme-muted sm:col-span-2">
                Saari keys chali gayin. More options se reset scenario karo.
              </p>
            ) : (
              <>
                {snapshot.keys.map((item) => {
                  const remaining = ttlRemaining(item, snapshot.tick);
                  const isCandidate =
                    snapshot.policy !== 'noeviction' &&
                    snapshot.evictionCandidateKey === item.key;
                  return (
                    <article
                      key={item.key}
                      data-highlight-id={`key:${item.key}`}
                      className={`rounded-xl border p-3.5 transition-all shadow-2xs ${
                        isCandidate
                          ? 'demo-lru-candidate border-semantic-error/60 bg-theme-bg ring-1 ring-semantic-error/40'
                          : 'border-theme-border bg-theme-bg'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="break-all font-mono text-[14px] font-bold text-theme-text">
                            {item.key}
                          </code>
                          {isCandidate && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-semantic-error/40 bg-semantic-error-bg px-2 py-0.2 font-mono text-[10.5px] font-bold text-semantic-error">
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                              <span>LRU Next Victim</span>
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold font-mono ${
                            remaining !== null
                              ? 'border-semantic-info/40 bg-semantic-info-bg text-semantic-info'
                              : 'border-theme-border bg-theme-surface text-theme-muted'
                          }`}
                        >
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {remaining !== null ? `${remaining}s TTL` : 'No TTL (Permanent)'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between font-mono text-[12px] text-theme-muted">
                        <span>Size: <strong className="text-theme-text">{item.sizeBytes} B</strong></span>
                        <span>Last access: <strong className="text-theme-text">t{item.lastAccessedTick}</strong></span>
                      </div>
                    </article>
                  );
                })}
                {departingKeys.map((item) => (
                  <article
                    key={`departing:${item.key}`}
                    className="demo-evict-out rounded-xl border border-semantic-error/60 bg-semantic-error-bg/20 p-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <code className="break-all font-mono text-[14px] font-bold text-semantic-error line-through">
                        {item.key}
                      </code>
                      <span className="inline-flex items-center gap-1 rounded-full border border-semantic-error/40 bg-semantic-error-bg px-2 py-0.2 text-[10.5px] font-bold text-semantic-error">
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        <span>Evicting from RAM</span>
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[12px] text-theme-muted line-through">
                      {item.sizeBytes} B · last access t{item.lastAccessedTick}
                    </p>
                  </article>
                ))}
              </>
            )}
          </div>
        </div>

        {/* The Two Deletion Drivers */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-theme-border bg-theme-surface p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-theme-text">
                <Clock className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                TTL Expiry (Time-driven)
              </span>
              <span className="font-mono text-[14px] font-bold tabular-nums text-semantic-info">
                expired: {snapshot.stats.expiredKeysCount}
              </span>
            </div>
            <p className="text-[13.5px] text-theme-muted leading-relaxed">
              Active cron sweeps expired keys; passive sweep checks on read. Key tabhi expire hoti hai jab uska time khatam ho.
            </p>
          </div>

          <div className="rounded-xl border border-theme-border bg-theme-surface p-3.5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[15px] font-bold tracking-tight text-theme-text">
                <Trash2 className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                Memory Eviction (Capacity-driven)
              </span>
              <span className="font-mono text-[14px] font-bold tabular-nums text-semantic-error">
                evicted: {snapshot.stats.evictedKeysCount} · rejected: {snapshot.stats.rejectedWritesCount}
              </span>
            </div>
            <p className="text-[13.5px] text-theme-muted leading-relaxed">
              RAM full hone par policy victim chunti hai. Agar key ka TTL 10 saal bhi ho, LRU ke hisaab se pehle delete ho sakti hai!
            </p>
          </div>
        </div>

        {/* Recently Removed Keys / Tombstone Log */}
        <div className="rounded-xl border border-theme-border bg-theme-surface-alt/40 p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-theme-accent" aria-hidden="true" />
            <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-theme-text">
              Tombstone Log (Removed Keys)
            </span>
          </div>

          {removedKeys.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-theme-muted">
              Abhi koi key remove nahi hui. <span className="font-semibold text-theme-text">Advance 25s</span> se TTL expire dekho, ya <span className="font-semibold text-theme-text">Add 300B key</span> se memory limit cross karke LRU eviction dekho.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-0.5">
              {removedKeys.map((item) => (
                <span
                  key={item.key}
                  data-highlight-id={`removed:${item.key}`}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 font-mono text-[12.5px] shadow-2xs ${
                    item.reason === 'TTL'
                      ? 'border-semantic-info/40 bg-semantic-info-bg text-semantic-info'
                      : 'border-semantic-error/40 bg-semantic-error-bg text-semantic-error'
                  }`}
                >
                  <span className="font-bold uppercase text-[11px]">{item.reason === 'TTL' ? 'TTL Expired' : 'LRU Evicted'}</span>
                  <code className="font-bold">{item.key}</code>
                  <span className="text-[11px] opacity-75">t{item.tick}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </DemoShell>
  );
};

export default TtlVsEvictionDemo;
