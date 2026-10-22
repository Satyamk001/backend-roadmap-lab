import React, { useCallback, useMemo, useState } from 'react';
import { ArrowUp, Plus, Trophy } from 'lucide-react';
import { RedisStructuresEngine } from '../../../engine/redis/structures';
import {
  DemoActionButton,
  DemoChallenge,
  DemoLogEntry,
  DemoShell,
} from './DemoShell';

const BOARD_KEY = 'lb:weekly';
const INTRO_WHAT =
  'Leaderboard ka order score se banta hai: sabse zyada score wala #1 par hai.';
const INTRO_WHY =
  'ZSet member ko score ke saath store karta hai; score badla to rank bhi apne aap badal jaata hai.';

const PLAYER_COLORS: Record<string, string> = {
  alice: 'var(--entity-1)',
  bob: 'var(--entity-2)',
  cara: 'var(--entity-3)',
  dina: 'var(--entity-4)',
};

function createEngine(): RedisStructuresEngine {
  const engine = new RedisStructuresEngine();
  engine.clear();
  engine.zadd(BOARD_KEY, 120, 'alice');
  engine.zadd(BOARD_KEY, 95, 'bob');
  engine.zadd(BOARD_KEY, 80, 'cara');
  engine.setNarrative(INTRO_WHAT, INTRO_WHY);
  return engine;
}

export const ZSetDemo: React.FC = () => {
  const engine = useMemo(createEngine, []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const entry = snapshot.entries[BOARD_KEY];
  const ranked =
    entry?.value.type === 'zset'
      ? [...entry.value.sorted].sort(
          (a, b) => b.score - a.score || a.member.localeCompare(b.member)
        )
      : [];

  const maxScore = ranked.length > 0 ? ranked[0].score : 1;

  const rankFromSnapshot = (member: string): number | null => {
    const current = engine.getSnapshot().entries[BOARD_KEY];
    if (current?.value.type !== 'zset') return null;
    const ordered = [...current.value.sorted].sort(
      (a, b) => b.score - a.score || a.member.localeCompare(b.member)
    );
    const index = ordered.findIndex((item) => item.member === member);
    return index === -1 ? null : index + 1;
  };

  const handleBobBoost = useCallback(() => {
    const before = rankFromSnapshot('bob');
    engine.zincrby(BOARD_KEY, 50, 'bob');
    const after = rankFromSnapshot('bob');
    engine.setNarrative(
      `Bob ka score +50 hua aur rank #${before} se #${after} pahunch gaya.`,
      'ZSet ne score ke hisaab se order khud badal diya; array manually sort nahi karna pada.'
    );
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleAliceBoost = useCallback(() => {
    const before = rankFromSnapshot('alice');
    engine.zincrby(BOARD_KEY, 20, 'alice');
    const after = rankFromSnapshot('alice');
    engine.setNarrative(
      `Alice ka score +20 hua; rank #${before} se #${after} hua.`,
      'Score update hote hi sorted index rebuild hota hai; rank query O(log N) rehti hai.'
    );
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleAddDina = useCallback(() => {
    engine.zadd(BOARD_KEY, 100, 'dina');
    const next = engine.getSnapshot();
    const nextEntry = next.entries[BOARD_KEY];
    const nextRanked =
      nextEntry?.value.type === 'zset'
        ? [...nextEntry.value.sorted].sort(
            (a, b) => b.score - a.score || a.member.localeCompare(b.member)
          )
        : [];
    const rank = nextRanked.findIndex((item) => item.member === 'dina') + 1;
    engine.setNarrative(
      `Naya player Dina score 100 ke saath seedha rank #${rank} par aaya.`,
      'Sorted Set insertion bhi score-order maintain karti hai; koi manual reposition nahi.'
    );
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleReset = useCallback(() => {
    engine.clear();
    engine.zadd(BOARD_KEY, 120, 'alice');
    engine.zadd(BOARD_KEY, 95, 'bob');
    engine.zadd(BOARD_KEY, 80, 'cara');
    engine.setNarrative(INTRO_WHAT, INTRO_WHY);
    sync();
  }, [engine, sync]);

  const logs: DemoLogEntry[] = snapshot.eventLog.map((event) => {
    const parts = event.command.split(/\s+/);
    const isZSetCommand = parts[0] === 'ZADD' || parts[0] === 'ZINCRBY';
    return {
      id: event.id,
      tick: event.tick,
      label: event.command,
      message: `${event.result} — ${event.impact}`,
      type: event.type,
      target: isZSetCommand ? `member:${parts[parts.length - 1]}` : undefined,
    };
  });

  const challenges: DemoChallenge[] = [
    {
      id: 'zset-bob-first',
      title: 'Bob ko #1 banao',
      description: 'Bob +50 dabao. Score 145 hote hi woh top par aa jayega.',
      passed: ranked[0]?.member === 'bob',
    },
    {
      id: 'zset-add-dina',
      title: 'Dina ko leaderboard me add karo',
      description: 'Add Dina dabao. Naya member score 100 ke saath rank par aayega.',
      passed: ranked.some((item) => item.member === 'dina'),
    },
  ];

  return (
    <DemoShell
      title="Sorted set: score decides rank"
      summary="Har player ka score hi uska rank hai. Score badla, rank khud badal jaata hai — manual sorting nahi."
      difficulty="easy"
      notesAnchor="sorted-sets-zset-leaderboard-ka-dil"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      logs={logs}
      challenges={challenges}
      stateSnapshot={{
        tick: snapshot.tick,
        entries: snapshot.entries,
        stats: snapshot.stats,
      }}
      onReset={handleReset}
      onPrimaryAction={handleBobBoost}
      resetLabel="Reset leaderboard"
      actions={
        <>
          <DemoActionButton variant="primary" onClick={handleBobBoost}>
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            <span>Bob +50 points (ZINCRBY)</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAliceBoost}>
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            <span>Alice +20 points</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAddDina}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Dina (100 pts)</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Header Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/70 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-theme-accent" aria-hidden="true" />
            <code className="font-mono text-[15px] font-bold text-theme-text">
              {BOARD_KEY}
            </code>
            <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
              Type: ZSet (Sorted Set)
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[12px] text-theme-muted">
            <span>Ordering: <strong className="text-theme-text">Score DESC (ZREVRANGE)</strong></span>
          </div>
        </div>

        {/* Dynamic Leaderboard Cards */}
        <div className="space-y-2.5">
          {ranked.length === 0 ? (
            <p className="rounded-xl border border-dashed border-theme-border bg-theme-bg p-6 text-center text-[15px] text-theme-muted">
              Leaderboard khaali hai. Add Dina dabao.
            </p>
          ) : (
            ranked.map((item, index) => {
              const rank = index + 1;
              const percent = Math.max(12, Math.round((item.score / maxScore) * 100));
              const isLeader = rank === 1;

              return (
                <div
                  key={item.member}
                  data-highlight-id={`member:${item.member}`}
                  className={`rounded-xl border p-3.5 transition-all duration-300 shadow-2xs ${
                    isLeader
                      ? 'border-semantic-success/50 bg-theme-bg ring-1 ring-semantic-success/30'
                      : 'border-theme-border bg-theme-bg'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Rank Number Badge */}
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl font-mono text-[13px] font-extrabold shadow-2xs ${
                          isLeader
                            ? 'border border-semantic-success/50 bg-semantic-success-bg text-semantic-success'
                            : rank === 2
                            ? 'border border-theme-border bg-theme-surface-alt font-bold text-theme-text'
                            : 'border border-theme-border bg-theme-surface text-theme-muted'
                        }`}
                        aria-label={`Rank ${rank}`}
                      >
                        #{rank}
                      </span>

                      {/* Avatar & Player Info */}
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold text-stone-900 shadow-2xs"
                          style={{
                            backgroundColor:
                              PLAYER_COLORS[item.member] ?? 'var(--entity-6)',
                          }}
                        >
                          {item.member.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[15px] text-theme-text">
                            {item.member}
                          </span>
                          {isLeader && (
                            <span className="rounded-full border border-semantic-success/40 bg-semantic-success-bg px-2 py-0.2 font-mono text-[10.5px] font-bold text-semantic-success uppercase tracking-wider">
                              Leader
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Score Value */}
                    <div className="flex items-baseline gap-1.5 font-mono">
                      <span className="text-[12px] text-theme-muted">score</span>
                      <span className="text-[18px] font-extrabold tabular-nums text-theme-text">
                        {item.score}
                      </span>
                    </div>
                  </div>

                  {/* Relative Score Bar */}
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-theme-surface-alt/80">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${percent}%`,
                          backgroundColor:
                            PLAYER_COLORS[item.member] ?? 'var(--entity-6)',
                        }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-theme-muted tabular-nums shrink-0">
                      {percent}% of leader
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Live Command Execution Feedback */}
        <div className="rounded-lg border border-theme-border bg-theme-surface-alt/50 px-3 py-2 text-[13px] font-mono text-theme-text flex flex-wrap items-center justify-between gap-2">
          <span>O(log N) SkipList Index Rebuilt Automatically</span>
          <span className="text-[12px] text-theme-muted">
            Array manual sorting ki zarurat nahi hoti
          </span>
        </div>

        {/* Architecture Comparison */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-muted">
              🗄️ Traditional SQL Leaderboard
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              <code className="font-mono text-[12px]">ORDER BY score DESC LIMIT 10</code> har query par index traversal ya sorting karta hai. Concurrent game writes me DB bottleneck ban jaata hai.
            </p>
          </div>
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-accent">
              ⚡ Redis ZSet (SkipList + Hash)
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Hash se O(1) score lookups aur SkipList se O(log N) ranking scan. Score badalte hi rank real-time RAM me update hoti hai — sub-millisecond latency guaranteed!
            </p>
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default ZSetDemo;
