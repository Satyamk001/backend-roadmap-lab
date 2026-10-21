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
      canvasClassName="min-h-[34.25rem] sm:min-h-[30.25rem]"
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
            <span>Bob +50 points</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAliceBoost}>
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            <span>Alice +20 points</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAddDina}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Dina</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-theme-accent" aria-hidden="true" />
            <code className="font-mono text-[15px] font-semibold text-theme-text">
              {BOARD_KEY}
            </code>
          </div>
          <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
            Sorted Set · score DESC
          </span>
        </div>

        <div className="min-h-[21rem] max-h-[21rem] space-y-2 overflow-y-auto pr-0.5">
          {ranked.length === 0 ? (
            <p className="rounded-lg border border-dashed border-theme-border bg-theme-bg px-3 py-4 text-[15px] text-theme-muted">
              Leaderboard khaali hai. Add Dina dabao.
            </p>
          ) : (
            ranked.map((item, index) => {
              const rank = index + 1;
              const percent = Math.max(8, Math.round((item.score / maxScore) * 100));
              return (
                <div
                  key={item.member}
                  data-highlight-id={`member:${item.member}`}
                  className="rounded-xl border border-theme-border bg-theme-bg p-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-mono text-[13px] font-bold ${
                        rank === 1
                          ? 'border-semantic-success/40 bg-semantic-success-bg text-semantic-success'
                          : 'border-theme-border bg-theme-surface-alt text-theme-muted'
                      }`}
                      aria-label={`Rank ${rank}`}
                    >
                      #{rank}
                    </span>

                    <span className="flex min-w-[6rem] flex-1 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            PLAYER_COLORS[item.member] ?? 'var(--entity-6)',
                        }}
                        aria-hidden="true"
                      />
                      <span className="font-semibold text-[15px] text-theme-text">
                        {item.member}
                      </span>
                      {rank === 1 && (
                        <span className="rounded-full border border-semantic-success/40 bg-semantic-success-bg px-2 py-0.5 text-[12px] font-semibold text-semantic-success">
                          top score
                        </span>
                      )}
                    </span>

                    <span className="font-mono text-[15px] font-bold tabular-nums text-theme-text">
                      {item.score}
                    </span>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-theme-surface-alt">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${percent}%`,
                        backgroundColor:
                          PLAYER_COLORS[item.member] ?? 'var(--entity-6)',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="rounded-lg border border-dashed border-theme-border bg-theme-surface-alt/40 px-3 py-2.5 text-[15px] leading-relaxed text-theme-muted">
          <span className="font-semibold text-theme-text">Rank formula: </span>
          sabse zyada score = rank #1. Equal score par member name tie-break
          karta hai; rank kisi array index me hardcoded nahi hota.
        </div>
      </div>
    </DemoShell>
  );
};

export default ZSetDemo;
