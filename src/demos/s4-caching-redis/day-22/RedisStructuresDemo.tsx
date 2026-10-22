import React, { useState, useMemo } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, Terminal, Layers, CheckCircle2, Circle } from 'lucide-react';
import { RedisStructuresEngine, type StructuresSnapshot } from '../../../engine/redis/structures';

export const RedisStructuresDemo: React.FC = () => {
  const engine = useMemo(() => new RedisStructuresEngine(), []);
  const [snapshot, setSnapshot] = useState<StructuresSnapshot>(() => engine.getSnapshot());
  const [showEventLog, setShowEventLog] = useState<boolean>(false);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [showStateInspector, setShowStateInspector] = useState<boolean>(false);

  // Sync state after engine mutation
  const sync = () => {
    setSnapshot(engine.getSnapshot());
  };

  // 5 Primary Actions
  const handleIncrCounter = () => {
    engine.incr('views:home', 1);
    sync();
  };

  const handleUpdateSession = () => {
    const roles = ['user', 'admin', 'pro_member', 'moderator'];
    const nextRole = roles[Math.floor(Math.random() * roles.length)];
    engine.hset('sess:alice_9a2f', 'role', nextRole);
    engine.hincrby('sess:alice_9a2f', 'visits', 1);
    sync();
  };

  const handlePushActivity = () => {
    const activities = [
      'Joined match #42',
      'Completed level 3',
      'Unlocked achievement',
      'Redeemed daily bonus',
      'Sent friend request',
    ];
    const item = activities[Math.floor(Math.random() * activities.length)];
    engine.lpush('feed:u101', item);
    engine.ltrim('feed:u101', 0, 4); // Keep latest 5
    sync();
  };

  const handleAddSetMember = () => {
    const candidateUsers = ['u101', 'u102', 'u103', 'u104', 'u105'];
    const chosen = candidateUsers[Math.floor(Math.random() * candidateUsers.length)];
    engine.sadd('dau:today', chosen);
    sync();
  };

  const handleIncrLeaderboard = () => {
    const candidates = ['alice', 'bob', 'carol', 'dave'];
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    engine.zincrby('lb:global', 15, chosen);
    sync();
  };

  const handleReset = () => {
    engine.reset();
    sync();
  };

  // Entries categorized by Redis type
  const entries = Object.values(snapshot.entries);
  const strings = entries.filter((e) => e.value.type === 'string');
  const hashes = entries.filter((e) => e.value.type === 'hash');
  const lists = entries.filter((e) => e.value.type === 'list');
  const sets = entries.filter((e) => e.value.type === 'set');
  const zsets = entries.filter((e) => e.value.type === 'zset');

  // Challenge checks
  const challenge1Pass = useMemo(() => {
    const sess = snapshot.entries['sess:alice_9a2f'];
    if (!sess || sess.value.type !== 'hash') return false;
    return Number(sess.value.fields['visits'] || 0) >= 2;
  }, [snapshot]);

  const challenge2Pass = useMemo(() => {
    const counter = snapshot.entries['views:home'];
    if (!counter || counter.value.type !== 'string') return false;
    return Number(counter.value.raw) >= 14;
  }, [snapshot]);

  const challenge3Pass = useMemo(() => {
    const lb = snapshot.entries['lb:global'];
    if (!lb || lb.value.type !== 'zset') return false;
    const sorted = lb.value.sorted;
    if (sorted.length === 0) return false;
    const leader = sorted[sorted.length - 1]; // highest score is at end
    return leader.member === 'bob' && leader.score > 120;
  }, [snapshot]);

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            In-memory data structures
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Strings, Hashes for sessions, Lists, Sets, and Sorted Sets in volatile RAM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt border border-theme-border rounded-lg transition-colors flex items-center gap-1.5 text-theme-text"
            title="Reset data structures"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. "What just happened?" status line */}
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
          onClick={handleIncrCounter}
          className="px-3 py-2 text-xs font-bold rounded-lg bg-theme-primary text-theme-primary-text hover:bg-theme-primary-hover transition-colors shadow-xs"
          title="INCR views:home"
        >
          INCR Counter
        </button>

        <button
          type="button"
          onClick={handleUpdateSession}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="HSET sess:alice_9a2f role / visits"
        >
          HSET Session
        </button>

        <button
          type="button"
          onClick={handlePushActivity}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="LPUSH feed:u101 & LTRIM 0 4"
        >
          LPUSH Activity
        </button>

        <button
          type="button"
          onClick={handleAddSetMember}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="SADD dau:today <user>"
        >
          SADD DAU / Tag
        </button>

        <button
          type="button"
          onClick={handleIncrLeaderboard}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text transition-colors"
          title="ZINCRBY lb:global +15 <member>"
        >
          ZINCRBY Leaderboard
        </button>

        <div className="ml-auto hidden sm:flex items-center gap-3 text-xs text-theme-muted font-mono pr-2">
          <span>Keys: <b>{snapshot.stats.totalKeys}</b></span>
          <span>RAM: <b>{snapshot.stats.usedMemoryBytes} B</b></span>
        </div>
      </div>

      {/* 4. Interactive Canvas (Direct Manipulation of Redis In-Memory Structures) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* String & Hash Card */}
        <div className="space-y-4">
          {/* Strings */}
          <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-entity-1"></span>
                <h3 className="text-sm font-bold text-theme-text">Strings (Cache &amp; Counters)</h3>
              </div>
              <span className="text-[11px] font-mono text-theme-muted">O(1)</span>
            </div>

            {strings.length === 0 ? (
              <p className="text-xs text-theme-muted italic">Koi string key nahi hai.</p>
            ) : (
              strings.map((entry) => (
                <div key={entry.key} className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border/70 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-theme-accent">{entry.key}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-muted">
                      {entry.encoding} · {entry.bytes} B
                    </span>
                  </div>
                  <div className="text-sm font-mono text-theme-text font-bold">
                    {(entry.value as any).raw}
                  </div>
                  <div className="text-[11px] text-theme-muted">
                    Atomic INCR support · Cache responses &amp; distributed locks
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Hashes (Session Store) */}
          <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-entity-2"></span>
                <h3 className="text-sm font-bold text-theme-text">Hashes (Session Store)</h3>
              </div>
              <span className="text-[11px] font-mono text-theme-muted">Field O(1)</span>
            </div>

            {hashes.map((entry) => {
              const hashVal = entry.value as any;
              return (
                <div key={entry.key} className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border/70 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-theme-accent">{entry.key}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-muted">
                      {entry.encoding} · {entry.bytes} B
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {Object.entries(hashVal.fields).map(([field, val]) => (
                      <div key={field} className="p-1.5 bg-theme-surface rounded border border-theme-border flex items-center justify-between">
                        <span className="text-theme-muted">{field}:</span>
                        <b className="text-theme-text">{String(val)}</b>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    Partial update without deserializing whole JSON.
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* List, Set, & Sorted Set Card */}
        <div className="space-y-4">
          {/* Sorted Set (Leaderboard) */}
          <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-entity-3"></span>
                <h3 className="text-sm font-bold text-theme-text">Sorted Set (Leaderboard)</h3>
              </div>
              <span className="text-[11px] font-mono text-theme-muted">O(log N)</span>
            </div>

            {zsets.map((entry) => {
              const zval = entry.value as any;
              // Sorted ascending in engine, reverse for leaderboard (highest score first)
              const ranking = [...zval.sorted].reverse();
              return (
                <div key={entry.key} className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border/70 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-theme-accent">{entry.key}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-theme-surface border border-theme-border text-theme-muted">
                      {entry.encoding} · {entry.bytes} B
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {ranking.map((row, idx) => (
                      <div
                        key={row.member}
                        className="flex items-center justify-between p-2 bg-theme-surface rounded-md border border-theme-border text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 flex items-center justify-center rounded font-bold text-[10px] ${
                              idx === 0
                                ? 'bg-amber-500 text-stone-900'
                                : idx === 1
                                ? 'bg-stone-300 text-stone-900'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-theme-surface-alt text-theme-muted border border-theme-border'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-theme-text">{row.member}</span>
                        </div>
                        <span className="font-bold text-theme-accent">{row.score} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Lists & Sets Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* List Deque */}
            <div className="bg-theme-surface border border-theme-border rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-theme-border/60 pb-1.5">
                <span className="text-xs font-bold text-theme-text">List (Feed / Queue)</span>
                <span className="text-[10px] font-mono text-theme-muted">O(1) ends</span>
              </div>
              {lists.map((entry) => {
                const listVal = entry.value as any;
                return (
                  <div key={entry.key} className="space-y-1.5 text-xs font-mono">
                    <div className="text-[11px] text-theme-accent font-semibold">{entry.key}</div>
                    <div className="space-y-1">
                      {listVal.items.slice(0, 4).map((item: string, i: number) => (
                        <div key={i} className="p-1.5 bg-theme-surface-alt rounded border border-theme-border text-[11px] truncate">
                          {i === 0 ? '← Head: ' : ''}{item}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sets */}
            <div className="bg-theme-surface border border-theme-border rounded-xl p-3 shadow-xs space-y-2">
              <div className="flex items-center justify-between border-b border-theme-border/60 pb-1.5">
                <span className="text-xs font-bold text-theme-text">Set (Unique Items)</span>
                <span className="text-[10px] font-mono text-theme-muted">O(1) check</span>
              </div>
              {sets.map((entry) => {
                const setVal = entry.value as any;
                return (
                  <div key={entry.key} className="space-y-2 text-xs font-mono">
                    <div className="text-[11px] text-theme-accent font-semibold">{entry.key}</div>
                    <div className="flex flex-wrap gap-1">
                      {setVal.members.map((m: string) => (
                        <span key={m} className="px-2 py-0.5 bg-theme-surface-alt rounded-full border border-theme-border text-[11px] text-theme-text">
                          {m}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-theme-muted">
                      Duplicates automatically ignored.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            <span className="font-bold">Redis commands event log</span>
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
                  <span className="font-bold text-theme-accent flex-shrink-0">{log.command}</span>
                  <span className="text-theme-muted">→</span>
                  <span className="text-theme-text font-semibold flex-shrink-0">{log.result}</span>
                  <span className="text-theme-muted truncate hidden sm:inline">({log.impact})</span>
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
          <span>More options (Challenges &amp; RAM state inspector)</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 space-y-4 border-t border-theme-border text-xs">
            {/* Challenges */}
            <div className="space-y-2">
              <h4 className="font-bold text-theme-text uppercase tracking-wider text-[11px]">
                🎯 Hands-on Challenges
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
                      1. Session Mutation
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    HSET session ko 2 ya zyada baar click karke visit count badhao.
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
                      2. Counter Spike
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    INCR Counter dabakar page views ko 14 ya usse zyada le jao.
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
                      3. Leaderboard Overtake
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    ZINCRBY se bob ka score badhao jab tak bob alice ko pachhad kar #1 na ban jaye!
                  </p>
                </div>
              </div>
            </div>

            {/* State Inspector Toggle */}
            <div className="pt-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setShowStateInspector(!showStateInspector)}
                className="flex items-center gap-1.5 text-xs text-theme-accent font-semibold hover:underline"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showStateInspector ? 'Hide raw RAM snapshot' : 'Inspect raw RAM JSON snapshot'}</span>
              </button>

              {showStateInspector && (
                <pre className="mt-2 p-3 bg-stone-900 text-stone-100 rounded-lg text-[11px] font-mono max-h-60 overflow-auto border border-theme-border">
                  {JSON.stringify(snapshot.entries, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedisStructuresDemo;
