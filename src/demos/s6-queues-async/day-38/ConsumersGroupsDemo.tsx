import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { rangeAssign } from '../../../engine/kafka/assignor';

interface MessageItem {
  id: string;
  key: string;
  event: string;
  offset: number;
}

interface GroupState {
  id: string;
  name: string;
  color: string;
  numConsumers: number;
  committed: number[]; // per partition
}

const PRESET_KEYS = ['order_1', 'order_2', 'order_3', 'order_6', 'order_4', 'order_7'];
const KEY_COLORS: Record<string, string> = {
  'order_1': 'var(--entity-1)',
  'order_2': 'var(--entity-2)',
  'order_3': 'var(--entity-3)',
  'order_6': 'var(--entity-4)',
  'order_4': 'var(--entity-5)',
  'order_7': 'var(--entity-6)',
};

export const ConsumersGroupsDemo: React.FC = () => {
  const [numPartitions, setNumPartitions] = useState<number>(3);
  const [partitionLogs, setPartitionLogs] = useState<MessageItem[][]>(() => [
    [
      { id: 'm1', key: 'order_1', event: 'order.created', offset: 0 },
      { id: 'm2', key: 'order_1', event: 'order.paid', offset: 1 },
    ],
    [
      { id: 'm3', key: 'order_2', event: 'order.created', offset: 0 },
      { id: 'm4', key: 'order_2', event: 'order.paid', offset: 1 },
      { id: 'm5', key: 'order_2', event: 'order.shipped', offset: 2 },
    ],
    [
      { id: 'm6', key: 'order_3', event: 'order.created', offset: 0 },
    ],
  ]);

  const [groups, setGroups] = useState<GroupState[]>([
    {
      id: 'billing-group',
      name: 'billing-service',
      color: 'sky',
      numConsumers: 2,
      committed: [1, 2, 0],
    },
  ]);

  const [showPubSub, setShowPubSub] = useState<boolean>(false);
  const [analyticsGroup, setAnalyticsGroup] = useState<GroupState>({
    id: 'analytics-group',
    name: 'analytics-service',
    color: 'emerald',
    numConsumers: 1,
    committed: [0, 0, 0],
  });

  const [statusWhat, setStatusWhat] = useState<string>(
    'billing-service me 2 consumers hain: C1 ko P0+P1 mile, C2 ko P2 mila.'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Ek consumer group me har partition ka ek hi consumer owner hota hai. Isse race conditions nahi hoti.'
  );

  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  // Send a new batch of messages across partitions
  const handleProduceBatch = () => {
    setPartitionLogs((prev) => {
      const next = prev.map((partLog, pIdx) => {
        const nextOff = partLog.length;
        const key = PRESET_KEYS[pIdx % PRESET_KEYS.length];
        return [
          ...partLog,
          {
            id: `msg-${Date.now()}-${pIdx}-${nextOff}`,
            key,
            event: nextOff % 2 === 0 ? 'order.created' : 'order.paid',
            offset: nextOff,
          },
        ];
      });
      return next;
    });

    setStatusWhat('Naye messages produce hue: har partition me 1 naya event append hua.');
    setStatusWhy('Producer partition key se data bhejta hai; consumer groups apne current offsets se aage read karenge.');
  };

  // Modify consumer count for primary group
  const handleModifyConsumers = (delta: number) => {
    setGroups((prev) => {
      const g = prev[0];
      const nextCount = Math.max(1, Math.min(5, g.numConsumers + delta));
      if (nextCount === g.numConsumers) return prev;

      const assignment = rangeAssign(nextCount, numPartitions);
      const idleCount = assignment.filter((p) => p.length === 0).length;

      if (idleCount > 0) {
        setStatusWhat(
          `${g.name} me ${nextCount} consumers hain par partitions sirf ${numPartitions} hain: ${idleCount} consumer IDLE hai!`
        );
        setStatusWhy(
          'Max parallelism = partition count. Extra consumers standby backup hote hain, unhe tab tak kaam nahi milta jab tak koi fail na ho.'
        );
      } else {
        const desc = assignment
          .map((parts, i) => `C${i + 1}→${parts.map((p) => 'P' + p).join('+')}`)
          .join(', ');
        setStatusWhat(`Consumers badle (${nextCount}): Rebalance hua [${desc}].`);
        setStatusWhy('Group Coordinator ne partitions evenly distribute kar diye.');
      }

      return [{ ...g, numConsumers: nextCount }];
    });
  };

  // Single step poll / consume for billing group
  const handlePollPrimary = () => {
    setGroups((prev) => {
      const g = prev[0];
      const nextCommitted = [...g.committed];
      let processed = 0;

      for (let p = 0; p < numPartitions; p++) {
        if (nextCommitted[p] < partitionLogs[p].length) {
          nextCommitted[p] += 1;
          processed++;
        }
      }

      if (processed > 0) {
        setStatusWhat(`${g.name}: ${processed} naye messages process karke offset commit kiye.`);
        setStatusWhy('Consumer offset commit karta hai to __consumer_offsets topic me entry banti hai.');
      } else {
        setStatusWhat(`${g.name}: Sabhi partitions upto date hain (Lag = 0).`);
        setStatusWhy('Naya message aane par consumer turant pick karega.');
      }

      return [{ ...g, committed: nextCommitted }];
    });
  };

  // Toggle pub/sub secondary analytics group
  const handleTogglePubSub = () => {
    setShowPubSub((prev) => {
      const nextState = !prev;
      if (nextState) {
        setStatusWhat('Pub/Sub Mode Active: analytics-service group add ho gaya!');
        setStatusWhy(
          'Kafka me Pub/Sub alag consumer groups se hota hai. Har group ko 100% messages milte hain independent bookmarks ke saath.'
        );
      } else {
        setStatusWhat('analytics-service group remove kiya.');
        setStatusWhy('Sirf primary billing-service group active hai.');
      }
      return nextState;
    });
  };

  // Poll analytics group
  const handlePollAnalytics = () => {
    setAnalyticsGroup((prev) => {
      const nextCommitted = [...prev.committed];
      let processed = 0;
      for (let p = 0; p < numPartitions; p++) {
        if (nextCommitted[p] < partitionLogs[p].length) {
          nextCommitted[p] += 1;
          processed++;
        }
      }
      if (processed > 0) {
        setStatusWhat(`analytics-service: ${processed} messages process kiye.`);
        setStatusWhy('Dekho billing-service ke offsets ko koi farak nahi pada. Dono groups totally decoupled hain.');
      }
      return { ...prev, committed: nextCommitted };
    });
  };

  const handleReset = () => {
    setPartitionLogs([
      [
        { id: 'm1', key: 'o-1001', event: 'order.created', offset: 0 },
        { id: 'm2', key: 'o-1001', event: 'order.paid', offset: 1 },
      ],
      [
        { id: 'm3', key: 'o-1002', event: 'order.created', offset: 0 },
        { id: 'm4', key: 'o-1002', event: 'order.paid', offset: 1 },
      ],
      [
        { id: 'm6', key: 'o-1003', event: 'order.created', offset: 0 },
      ],
    ]);
    setGroups([
      {
        id: 'billing-group',
        name: 'billing-service',
        color: 'sky',
        numConsumers: 2,
        committed: [0, 0, 0],
      },
    ]);
    setAnalyticsGroup({
      id: 'analytics-group',
      name: 'analytics-service',
      color: 'emerald',
      numConsumers: 1,
      committed: [0, 0, 0],
    });
    setStatusWhat('Simulation reset ho gaya.');
    setStatusWhy('Offsets aur consumer state shuru se set ho gaye.');
  };

  // Keyboard accelerators
  useEffect(() => {
    const onPrimary = () => handleProduceBatch();
    const onReset = () => handleReset();
    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onReset);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onReset);
    };
  }, []);

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Consumers and groups
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            One consumer per partition: consumer group me har partition ka ek hi owner hota hai.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt border border-theme-border rounded-lg transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-theme-surface-alt text-theme-muted border border-theme-border">R</kbd>
        </button>
      </div>

      {/* 2. Status Banner: Ambient pulse beacon + clear Hinglish state */}
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
              {statusWhat}
            </div>
            {statusWhy && (
              <div className="text-xs text-theme-muted leading-normal font-medium">
                {statusWhy}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Primary Controls (4 to 5 direct verb buttons) */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleProduceBatch}
            className="px-4 py-2 bg-theme-primary text-theme-primary-text font-bold text-sm rounded-lg hover:bg-theme-primary-hover shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5"
          >
            <span>Produce messages</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15 text-stone-900 border border-black/10">Space</kbd>
          </button>

          <button
            type="button"
            onClick={handlePollPrimary}
            className="px-3.5 py-2 bg-theme-surface-alt hover:bg-theme-border text-theme-text font-semibold text-xs rounded-lg border border-theme-border transition-colors"
          >
            Poll billing-service
          </button>

          <div className="flex items-center gap-1.5 bg-theme-surface-alt border border-theme-border rounded-lg p-1">
            <span className="text-xs text-theme-muted font-medium px-1.5">Consumers:</span>
            <button
              type="button"
              onClick={() => handleModifyConsumers(-1)}
              disabled={groups[0].numConsumers <= 1}
              className="p-1.5 bg-theme-surface hover:bg-theme-border disabled:opacity-40 rounded border border-theme-border transition-colors"
              title="Remove consumer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono font-bold text-xs px-2 text-theme-text">
              {groups[0].numConsumers}
            </span>
            <button
              type="button"
              onClick={() => handleModifyConsumers(1)}
              disabled={groups[0].numConsumers >= 5}
              className="p-1.5 bg-theme-surface hover:bg-theme-border disabled:opacity-40 rounded border border-theme-border transition-colors"
              title="Add consumer"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleTogglePubSub}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
              showPubSub
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                : 'bg-theme-surface-alt hover:bg-theme-border border-theme-border text-theme-text'
            }`}
          >
            {showPubSub ? 'Pub/Sub: 2 Groups Active' : '+ Add analytics-service (Pub/Sub)'}
          </button>

          <div className="flex items-center gap-2 ml-auto text-xs">
            <label htmlFor="cg-part-select" className="text-theme-muted font-medium">
              Partitions:
            </label>
            <select
              id="cg-part-select"
              value={numPartitions}
              onChange={(e) => {
                const count = parseInt(e.target.value, 10);
                setNumPartitions(count);
                setPartitionLogs(Array.from({ length: count }, (_, i) => partitionLogs[i] || []));
                setGroups([{ ...groups[0], committed: Array(count).fill(0) }]);
              }}
              className="px-2.5 py-1.5 bg-theme-surface-alt border border-theme-border rounded-lg text-theme-text font-mono text-xs focus:outline-none cursor-pointer font-bold"
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
        </div>
      </section>

      {/* 4. Topic Partitions Append-Only View */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
            <span>Topic</span>
            <code className="text-xs px-2 py-0.5 bg-theme-surface-alt border border-theme-border rounded text-theme-accent font-mono font-bold">
              orders.events
            </code>
            <span>partitions log</span>
          </h3>
          <span className="text-xs text-theme-muted">
            Total messages: {partitionLogs.reduce((acc, p) => acc + p.length, 0)}
          </span>
        </div>

        <div className="space-y-2 pt-1">
          {Array.from({ length: numPartitions }, (_, p) => {
            const messages = partitionLogs[p] || [];
            const billingCommitted = groups[0]?.committed[p] || 0;
            const analyticsCommitted = analyticsGroup.committed[p] || 0;

            return (
              <div
                key={p}
                className="grid grid-cols-[48px_1fr] gap-3 items-center py-2.5 border-t first:border-t-0 border-dashed border-theme-border"
              >
                <div className="font-mono font-bold text-sm text-theme-accent">
                  P{p}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto py-1 min-h-[58px] no-scrollbar">
                  {messages.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-theme-border/70 text-xs text-theme-muted bg-theme-surface-alt/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-muted/50" />
                      <span>khali log — Pehla message bhejo</span>
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-theme-surface text-theme-muted border border-theme-border">Space</kbd>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isBillingRead = billingCommitted > m.offset;
                      const isAnalyticsRead = showPubSub && analyticsCommitted > m.offset;

                      let badgeText = '';
                      if (isBillingRead && isAnalyticsRead) badgeText = '✓B+A';
                      else if (isBillingRead) badgeText = '✓B';
                      else if (isAnalyticsRead) badgeText = '✓A';

                      return (
                        <div
                          key={m.id}
                          className={`flex-shrink-0 min-w-[80px] p-1.5 px-2 bg-theme-surface-alt border border-theme-border rounded-lg font-mono text-xs transition-all relative select-none ${
                            isBillingRead ? 'opacity-60' : 'opacity-100'
                          }`}
                          style={{
                            borderLeftWidth: '5px',
                            borderLeftColor: KEY_COLORS[m.key] || 'var(--entity-1)',
                          }}
                        >
                          {badgeText && (
                            <span className="absolute top-1 right-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              {badgeText}
                            </span>
                          )}
                          <div className="font-bold text-theme-text truncate pr-4">{m.key}</div>
                          <div className="text-[10px] text-theme-muted mt-0.5">
                            off {m.offset} · {m.event.split('.')[1]}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Consumer Groups Assignment & Parallelism Visualization */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-theme-text">Consumer Groups Partition Ownership</h3>
          <p className="text-xs text-theme-muted mt-0.5">
            Har consumer lane dekho. Agar consumers partitions se zyada hain, to extra consumer idle dikhega.
          </p>
        </div>

        {/* Primary Group */}
        {groups.map((g) => {
          const assignment = rangeAssign(g.numConsumers, numPartitions);
          const totalLag = assignment.reduce((acc, parts) => {
            return (
              acc +
              parts.reduce(
                (pAcc, p) => pAcc + Math.max(0, (partitionLogs[p]?.length || 0) - (g.committed[p] || 0)),
                0
              )
            );
          }, 0);

          return (
            <div key={g.id} className="p-3.5 bg-theme-bg border border-theme-border rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <strong className="text-sm text-theme-text font-bold">{g.name}</strong>
                  <span className="text-xs px-2 py-0.5 bg-theme-surface border border-theme-border rounded text-theme-muted">
                    Group ID: {g.id}
                  </span>
                </div>
                <div className="text-xs text-theme-muted">
                  Total group lag: <b className="text-theme-accent">{totalLag}</b>
                </div>
              </div>

              {/* Consumer Lanes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {Array.from({ length: g.numConsumers }, (_, cIdx) => {
                  const ownedPartitions = assignment[cIdx] || [];
                  const isIdle = ownedPartitions.length === 0;

                  return (
                    <div
                      key={cIdx}
                      className={`p-3 rounded-lg border transition-all ${
                        isIdle
                          ? 'bg-rose-500/10 border-rose-300 dark:border-rose-900/50'
                          : 'bg-theme-surface border-theme-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-theme-text font-mono">
                          Consumer C{cIdx + 1}
                        </span>
                        {isIdle ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400">
                            IDLE (No Partition)
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-theme-muted">
                        {isIdle ? (
                          <span>Partitions count ({numPartitions}) kam hai. C{cIdx + 1} backup standby par hai.</span>
                        ) : (
                          <div className="space-y-1">
                            <div>
                              Assigned:{' '}
                              {ownedPartitions.map((p) => (
                                <span
                                  key={p}
                                  className="inline-block mr-1 font-mono font-bold text-theme-accent bg-theme-surface-alt px-1.5 py-0.5 rounded border border-theme-border"
                                >
                                  P{p} (next: {g.committed[p]}, lag:{' '}
                                  {Math.max(0, (partitionLogs[p]?.length || 0) - g.committed[p])})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Secondary Pub/Sub Group */}
        {showPubSub && (
          <div className="p-3.5 bg-theme-bg border border-theme-border rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <strong className="text-sm text-theme-text font-bold">{analyticsGroup.name}</strong>
                <span className="text-xs px-2 py-0.5 bg-theme-surface border border-theme-border rounded text-theme-muted">
                  Group ID: {analyticsGroup.id} (Independent Bookmark)
                </span>
              </div>
              <button
                type="button"
                onClick={handlePollAnalytics}
                className="px-2.5 py-1 text-xs font-semibold bg-emerald-500 text-white rounded hover:bg-emerald-600"
              >
                Poll analytics
              </button>
            </div>

            <div className="p-3 bg-theme-surface border border-theme-border rounded-lg text-xs space-y-2">
              <div className="text-theme-muted">
                analytics-service ke paas 1 consumer hai jo sabhi {numPartitions} partitions read kar raha hai:
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: numPartitions }, (_, p) => (
                  <span
                    key={p}
                    className="font-mono text-xs bg-theme-surface-alt px-2 py-1 rounded border border-theme-border"
                  >
                    P{p} committed: <b>{analyticsGroup.committed[p]}</b> / {partitionLogs[p].length} (lag:{' '}
                    {Math.max(0, partitionLogs[p].length - analyticsGroup.committed[p])})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 6. Collapsed More Options Drawer */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center justify-between transition-colors"
        >
          <span>More options & state inspector</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border bg-theme-surface-alt space-y-3 font-mono text-xs">
            <pre className="p-3 bg-theme-bg border border-theme-border rounded-lg text-theme-text overflow-x-auto text-[11px] leading-relaxed">
              {JSON.stringify(
                {
                  topic: 'orders.events',
                  numPartitions,
                  groups: [
                    groups[0],
                    ...(showPubSub ? [analyticsGroup] : []),
                  ],
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsumersGroupsDemo;
