import React, { useCallback, useMemo, useState } from 'react';
import { ListOrdered, Search, Tags } from 'lucide-react';
import { RedisStructuresEngine } from '../../../engine/redis/structures';
import {
  DemoActionButton,
  DemoChallenge,
  DemoLogEntry,
  DemoShell,
} from './DemoShell';

const HISTORY_KEY = 'history:u101';
const UNIQUE_KEY = 'unique:u101';

const INTRO_WHAT =
  'Same searches, do structures: history List order rakhti hai, unique Set sirf naye values rakhta hai.';
const INTRO_WHY =
  'List me duplicate allowed hai; Set duplicate ko silently ignore karta hai. Isliye dono ka use-case alag hai.';

function createEngine(): RedisStructuresEngine {
  const engine = new RedisStructuresEngine();
  engine.clear();
  engine.lpush(HISTORY_KEY, 'kafka');
  engine.lpush(HISTORY_KEY, 'redis');
  engine.sadd(UNIQUE_KEY, 'redis', 'kafka');
  engine.setNarrative(INTRO_WHAT, INTRO_WHY);
  return engine;
}

export const ListSetDemo: React.FC = () => {
  const engine = useMemo(createEngine, []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const historyEntry = snapshot.entries[HISTORY_KEY];
  const uniqueEntry = snapshot.entries[UNIQUE_KEY];
  const items =
    historyEntry?.value.type === 'list' ? historyEntry.value.items : [];
  const members =
    uniqueEntry?.value.type === 'set' ? uniqueEntry.value.members : [];

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});

  const handleDuplicateSearch = useCallback(() => {
    engine.lpush(HISTORY_KEY, 'redis');
    engine.sadd(UNIQUE_KEY, 'redis');
    engine.setNarrative(
      'Search "redis" history me dobara add hua, par unique Set ne duplicate ignore kar diya.',
      'List duplicates preserve karti hai; Set ka kaam hi uniqueness enforce karna hai.'
    );
    sync();
  }, [engine, sync]);

  const handleNewSearch = useCallback(() => {
    engine.lpush(HISTORY_KEY, 'postgres');
    engine.sadd(UNIQUE_KEY, 'postgres');
    engine.setNarrative(
      'Naya search "postgres" List ke head par aaya aur Set me ek naya unique member bana.',
      'List newest-first history dikhati hai; Set me sirf unique values ka count badhta hai.'
    );
    sync();
  }, [engine, sync]);

  const handleReset = useCallback(() => {
    engine.clear();
    engine.lpush(HISTORY_KEY, 'kafka');
    engine.lpush(HISTORY_KEY, 'redis');
    engine.sadd(UNIQUE_KEY, 'redis', 'kafka');
    engine.setNarrative(INTRO_WHAT, INTRO_WHY);
    sync();
  }, [engine, sync]);

  const logs: DemoLogEntry[] = snapshot.eventLog.map((event) => {
    const command = event.command.split(/\s+/)[0];
    const target =
      command === 'LPUSH' || command === 'RPOP' || command === 'LTRIM'
        ? 'structure:list'
        : command === 'SADD' || command === 'SREM'
        ? 'structure:set'
        : undefined;
    return {
      id: event.id,
      tick: event.tick,
      label: event.command,
      message: `${event.result} — ${event.impact}`,
      type: event.type,
      target,
    };
  });

  const duplicateExists = Object.values(counts).some((count) => count > 1);

  const challenges: DemoChallenge[] = [
    {
      id: 'list-duplicate-search',
      title: 'Ek duplicate search banao',
      description: 'Search "redis" again dabao. List grow hogi, Set same rahega.',
      passed: duplicateExists,
    },
    {
      id: 'set-new-unique',
      title: 'Set me naya unique value add karo',
      description: 'Search "postgres" dabao. Set ka size 3 ho jayega.',
      passed: members.length >= 3,
    },
  ];

  return (
    <DemoShell
      title="List vs Set: order or uniqueness"
      summary="Same search events, do alag guarantees: List order aur duplicates rakhti hai; Set sirf unique values."
      difficulty="easy"
      notesAnchor="sahi-data-structure-kaise-choose-karein"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      canvasClassName="min-h-[48.75rem] max-[380px]:min-h-[52.5rem] sm:min-h-[29rem]"
      logs={logs}
      challenges={challenges}
      stateSnapshot={{
        tick: snapshot.tick,
        entries: snapshot.entries,
        stats: snapshot.stats,
      }}
      onReset={handleReset}
      onPrimaryAction={handleDuplicateSearch}
      resetLabel="Reset search scenario"
      actions={
        <>
          <DemoActionButton variant="primary" onClick={handleDuplicateSearch}>
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search "redis" again</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleNewSearch}>
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search "postgres"</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[17px] font-bold tracking-tight text-theme-text sm:text-[18px]">
            Same input, different guarantees
          </h3>
          <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 font-mono text-[12px] text-theme-muted">
            list {items.length} · set {members.length}
          </span>
        </div>

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          <article
            data-highlight-id="structure:list"
            className="rounded-xl border border-theme-border bg-theme-bg p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-semibold text-theme-text">
                  {HISTORY_KEY}
                </code>
              </div>
              <span className="rounded-full border border-theme-border bg-theme-surface px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
                List
              </span>
            </div>

            <p className="mt-1 text-[15px] text-theme-muted">
              Ordered history · duplicates allowed
            </p>

            <div className="mt-3 min-h-[11.5rem] max-h-[11.5rem] space-y-1.5 overflow-y-auto pr-0.5">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-theme-border bg-theme-surface px-3 py-3 text-[15px] text-theme-muted">
                  History khaali hai. Search button dabao.
                </p>
              ) : (
                items.map((item, index) => {
                  const isDuplicate = counts[item] > 1;
                  return (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-[12px] text-theme-muted">
                          #{index + 1}
                        </span>
                        <span className="font-mono text-[15px] font-semibold text-theme-text">
                          {item}
                        </span>
                      </span>
                      {isDuplicate && (
                        <span className="rounded-full border border-semantic-duplicate/40 bg-semantic-duplicate-bg px-2 py-0.5 text-[12px] font-semibold text-semantic-duplicate">
                          duplicate
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <p className="mt-3 font-mono text-[13px] text-theme-muted">
              length {items.length} · encoding {historyEntry?.encoding ?? '—'}
            </p>
          </article>

          <article
            data-highlight-id="structure:set"
            className="rounded-xl border border-theme-border bg-theme-bg p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-semibold text-theme-text">
                  {UNIQUE_KEY}
                </code>
              </div>
              <span className="rounded-full border border-theme-border bg-theme-surface px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
                Set
              </span>
            </div>

            <p className="mt-1 text-[15px] text-theme-muted">
              Unordered values · duplicates rejected
            </p>

            <div className="mt-3 flex min-h-20 flex-wrap content-start gap-2 rounded-lg border border-theme-border bg-theme-surface p-3">
              {members.length === 0 ? (
                <p className="text-[15px] text-theme-muted">
                  Set khaali hai. Search button dabao.
                </p>
              ) : (
                members.map((member) => (
                  <span
                    key={member}
                    className="rounded-full border border-theme-border bg-theme-surface-alt px-2.5 py-1 font-mono text-[14px] font-semibold text-theme-text"
                  >
                    {member}
                  </span>
                ))
              )}
            </div>

            <p className="mt-3 font-mono text-[13px] text-theme-muted">
              size {members.length} · encoding {uniqueEntry?.encoding ?? '—'}
            </p>
          </article>
        </div>

        <div className="rounded-lg border border-dashed border-theme-border bg-theme-surface-alt/40 px-3 py-2.5 text-[15px] leading-relaxed text-theme-muted">
          <span className="font-semibold text-theme-text">Rule of thumb: </span>
          order aur duplicates chahiye to List; sirf "kaun kaun hai" chahiye to
          Set. Same data dono me daal kar guarantee compare karo.
        </div>
      </div>
    </DemoShell>
  );
};

export default ListSetDemo;
