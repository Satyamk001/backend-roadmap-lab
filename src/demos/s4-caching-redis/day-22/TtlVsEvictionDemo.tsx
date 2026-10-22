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
      canvasClassName="min-h-[61rem] sm:min-h-[37.25rem]"
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
            <span>Advance 25s</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAddKey}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add 300B key</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={`rounded-xl border bg-theme-bg p-4 transition-all duration-300 ${
            isOomShaking ? 'demo-oom-shake border-semantic-error' : 'border-theme-border'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[17px] font-bold tracking-tight text-theme-text sm:text-[18px]">
                RAM usage
              </p>
              <p className="mt-0.5 font-mono text-[13px] tabular-nums text-theme-muted">
                {snapshot.usedMemoryBytes} B / {snapshot.maxmemoryBytes} B ·{' '}
                {snapshot.memoryUsagePercent}%
              </p>
            </div>
            <span className="rounded-full border border-theme-border bg-theme-surface px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
              {snapshot.policy}
            </span>
          </div>

          <div
            role="meter"
            aria-label="Redis memory usage"
            aria-valuemin={0}
            aria-valuemax={snapshot.maxmemoryBytes}
            aria-valuenow={snapshot.usedMemoryBytes}
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-theme-surface-alt"
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                usedPercent >= 100 ? 'bg-semantic-error' : 'bg-semantic-info'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] text-theme-muted">
              Limit cross hui to policy decide karti hai: evict ya reject.
            </span>
            <div
              role="group"
              aria-label="Memory policy"
              className="flex flex-wrap items-center gap-1 rounded-lg border border-theme-border bg-theme-surface-alt p-1"
            >
              {(['allkeys-lru', 'noeviction'] as const).map((policy) => {
                const active = snapshot.policy === policy;
                return (
                  <button
                    key={policy}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handlePolicy(policy)}
                    className={`inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                      active
                        ? 'bg-theme-surface text-theme-text shadow-xs'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    <span>{policy}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-2 text-[13px] font-mono text-theme-muted">
            {snapshot.policy === 'allkeys-lru'
              ? 'allkeys-lru: Sabse purani accessed key evict hogi — TTL ka role nahi'
              : 'noeviction: Naya write OOM error se reject hoga, koi key delete nahi hogi'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {snapshot.keys.length === 0 && departingKeys.length === 0 ? (
            <p className="rounded-lg border border-dashed border-theme-border bg-theme-bg px-3 py-4 text-[15px] text-theme-muted sm:col-span-2">
              Saari keys chali gayin. Reset scenario se wapas load karo.
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
                    className={`rounded-lg border bg-theme-bg p-3 transition-colors ${
                      isCandidate
                        ? 'demo-lru-candidate border-semantic-error/60'
                        : 'border-theme-border'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="break-all font-mono text-[13px] font-semibold text-theme-text">
                          {item.key}
                        </code>
                        {isCandidate && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-semantic-error/40 bg-semantic-error-bg px-2 py-0.5 text-[11px] font-semibold text-semantic-error">
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                            <span>LRU next</span>
                          </span>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold ${
                          remaining !== null
                            ? 'border-semantic-info/40 bg-semantic-info-bg text-semantic-info'
                            : 'border-theme-border bg-theme-surface text-theme-muted'
                        }`}
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {remaining !== null ? `${remaining}s TTL` : 'no TTL'}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[12px] text-theme-muted">
                      {item.sizeBytes} B · last access t{item.lastAccessedTick}
                    </p>
                  </article>
                );
              })}
              {departingKeys.map((item) => (
                <article
                  key={`departing:${item.key}`}
                  className="demo-evict-out rounded-lg border border-semantic-error/60 bg-semantic-error-bg/20 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <code className="break-all font-mono text-[13px] font-semibold text-semantic-error line-through">
                      {item.key}
                    </code>
                    <span className="inline-flex items-center gap-1 rounded-full border border-semantic-error/40 bg-semantic-error-bg px-2 py-0.5 text-[11px] font-semibold text-semantic-error">
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                      <span>evicting</span>
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-theme-border bg-theme-bg p-3">
            <p className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-theme-text sm:text-[17px]">
              <Clock className="h-4 w-4 text-theme-muted" aria-hidden="true" />
              TTL expiry
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-theme-muted">
              Key ka waqt khatam. Time-based deletion.
            </p>
            <p className="mt-1 font-mono text-[13px] tabular-nums text-theme-text">
              expired: {snapshot.stats.expiredKeysCount}
            </p>
          </div>
          <div className="rounded-lg border border-theme-border bg-theme-bg p-3">
            <p className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-theme-text sm:text-[17px]">
              <Trash2 className="h-4 w-4 text-theme-muted" aria-hidden="true" />
              Memory eviction
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-theme-muted">
              RAM full. Policy ne victim chuna.
            </p>
            <p className="mt-1 font-mono text-[13px] tabular-nums text-theme-text">
              evicted: {snapshot.stats.evictedKeysCount} · rejected:{' '}
              {snapshot.stats.rejectedWritesCount}
            </p>
          </div>
        </div>

        <div className="min-h-[7rem] rounded-lg border border-dashed border-theme-border bg-theme-surface-alt/40 p-3 sm:min-h-[5rem]">
          <p className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-theme-text sm:text-[17px]">
            <Info className="h-4 w-4 text-theme-muted" aria-hidden="true" />
            Recently removed keys
          </p>
          {removedKeys.length === 0 ? (
            <p className="mt-2 text-[15px] leading-relaxed text-theme-muted">
              Abhi kuch remove nahi hua. TTL ke liye 25s advance karo, ya memory limit cross karke eviction dekho.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {removedKeys.map((item) => (
                <span
                  key={item.key}
                  data-highlight-id={`removed:${item.key}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-semibold ${
                    item.reason === 'TTL'
                      ? 'border-semantic-info/40 bg-semantic-info-bg text-semantic-info'
                      : 'border-semantic-error/40 bg-semantic-error-bg text-semantic-error'
                  }`}
                >
                  <span>{item.reason === 'TTL' ? 'TTL' : 'evicted'}</span>
                  <code className="font-mono text-[12px]">{item.key}</code>
                  <span className="font-mono text-[11px] opacity-80">t{item.tick}</span>
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
