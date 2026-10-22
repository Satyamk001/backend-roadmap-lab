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

  const [lastAction, setLastAction] = useState<'duplicate' | 'new' | null>(null);

  const handleDuplicateSearch = useCallback(() => {
    engine.lpush(HISTORY_KEY, 'redis');
    engine.sadd(UNIQUE_KEY, 'redis');
    engine.setNarrative(
      'Search "redis" history me dobara add hua, par unique Set ne duplicate ignore kar diya.',
      'List duplicates preserve karti hai; Set ka kaam hi uniqueness enforce karna hai.'
    );
    setLastAction('duplicate');
    sync();
  }, [engine, sync]);

  const handleNewSearch = useCallback(() => {
    engine.lpush(HISTORY_KEY, 'postgres');
    engine.sadd(UNIQUE_KEY, 'postgres');
    engine.setNarrative(
      'Naya search "postgres" List ke head par aaya aur Set me ek naya unique member bana.',
      'List newest-first history dikhati hai; Set me sirf unique values ka count badhta hai.'
    );
    setLastAction('new');
    sync();
  }, [engine, sync]);

  const handleReset = useCallback(() => {
    engine.clear();
    engine.lpush(HISTORY_KEY, 'kafka');
    engine.lpush(HISTORY_KEY, 'redis');
    engine.sadd(UNIQUE_KEY, 'redis', 'kafka');
    engine.setNarrative(INTRO_WHAT, INTRO_WHY);
    setLastAction(null);
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
            <span>Search "redis" again (duplicate)</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleNewSearch}>
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search "postgres" (new)</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Stream Inspector Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/70 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-theme-muted">
              Live Stream Comparator
            </span>
            <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 font-mono text-[11px] text-theme-muted">
              Input: User Searches
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[12px] text-theme-muted">
            <span>List size: <strong className="text-theme-text">{items.length}</strong></span>
            <span>·</span>
            <span>Set unique: <strong className="text-theme-text">{members.length}</strong></span>
          </div>
        </div>

        {/* Side-by-Side Structure Comparison */}
        <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
          {/* List Card */}
          <article
            data-highlight-id="structure:list"
            className="rounded-xl border border-theme-border bg-theme-bg p-4 shadow-2xs space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-bold text-theme-text">
                  {HISTORY_KEY}
                </code>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  Type: List (Deque)
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  {historyEntry?.encoding ?? 'quicklist'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[12.5px] font-mono text-theme-muted">
              <span className="flex items-center gap-1 text-theme-accent font-semibold">
                HEAD (LPUSH insert point)
              </span>
              <span>TAIL (oldest)</span>
            </div>

            {/* List Items Stack */}
            <div className="space-y-1.5 min-h-[9.5rem] max-h-[14rem] overflow-y-auto pr-0.5">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-theme-border bg-theme-surface px-3 py-3 text-[14px] text-theme-muted">
                  List khaali hai. Upar se search button dabao.
                </p>
              ) : (
                items.map((item, index) => {
                  const isDuplicate = counts[item] > 1;
                  const isHead = index === 0;
                  return (
                    <div
                      key={`${item}-${index}`}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
                        isHead && lastAction
                          ? 'border-theme-primary/60 bg-theme-surface shadow-xs ring-1 ring-theme-primary/40'
                          : 'border-theme-border bg-theme-surface'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="font-mono text-[11.5px] font-bold text-theme-muted tabular-nums">
                          #{index + 1}
                        </span>
                        <code className="font-mono text-[14.5px] font-bold text-theme-text">
                          {item}
                        </code>
                        {isHead && (
                          <span className="rounded bg-theme-surface-alt px-1.5 py-0.2 font-mono text-[10px] font-semibold text-theme-muted">
                            newest
                          </span>
                        )}
                      </div>
                      {isDuplicate && (
                        <span className="rounded-full border border-semantic-duplicate/40 bg-semantic-duplicate-bg px-2 py-0.5 text-[11px] font-semibold text-semantic-duplicate">
                          duplicate allowed
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <p className="text-[13.5px] text-theme-muted leading-relaxed">
              Order preserved. Duplicate search terms baar-baar append hote rahenge. User activity timeline ya message feed ke liye ideal.
            </p>
          </article>

          {/* Set Card */}
          <article
            data-highlight-id="structure:set"
            className="rounded-xl border border-theme-border bg-theme-bg p-4 shadow-2xs space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-bold text-theme-text">
                  {UNIQUE_KEY}
                </code>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  Type: Set (HashTable)
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  {uniqueEntry?.encoding ?? 'listpack'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[12.5px] font-mono text-theme-muted">
              <span>Unordered Unique Members</span>
              <span className="text-semantic-success font-semibold">O(1) Deduplication</span>
            </div>

            {/* Set Members Grid */}
            <div className="min-h-[9.5rem] max-h-[14rem] overflow-y-auto rounded-lg border border-theme-border bg-theme-surface p-3 flex flex-wrap content-start gap-2">
              {members.length === 0 ? (
                <p className="text-[14px] text-theme-muted">
                  Set khaali hai. Upar se search button dabao.
                </p>
              ) : (
                members.map((member) => (
                  <span
                    key={member}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-theme-border bg-theme-surface-alt px-3 py-1.5 font-mono text-[13.5px] font-bold text-theme-text shadow-2xs"
                  >
                    <span className="text-theme-muted font-normal text-[11px]">#</span>
                    <span>{member}</span>
                  </span>
                ))
              )}
            </div>

            {lastAction === 'duplicate' ? (
              <div className="rounded-lg border border-semantic-duplicate/40 bg-semantic-duplicate-bg p-2 font-mono text-[12px] text-semantic-duplicate">
                ↳ SADD unique:u101 redis → 0 (Duplicate silently dropped!)
              </div>
            ) : lastAction === 'new' ? (
              <div className="rounded-lg border border-semantic-success/40 bg-semantic-success-bg p-2 font-mono text-[12px] text-semantic-success">
                ↳ SADD unique:u101 postgres → 1 (New unique member inserted!)
              </div>
            ) : (
              <p className="text-[13.5px] text-theme-muted leading-relaxed">
                Duplicates rejected. Agar same key 1,000 baar bhi bhejo, Set me sirf 1 copy rahegi. O(1) membership check (<code className="font-mono text-[12px]">SISMEMBER</code>).
              </p>
            )}
          </article>
        </div>

        {/* Comparative Architecture Matrix */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-accent">
              📋 When to use Redis List
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Order zaruri hai aur duplicates acceptable hain: Recent searches, user notification timeline, ya simple message queue (<code className="font-mono text-[12px]">LPUSH / RPOP</code>).
            </p>
          </div>
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-accent">
              🏷️ When to use Redis Set
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Uniqueness guarantee chahiye: Unique visitors (IP deduplication), tagging systems, mutual friends (<code className="font-mono text-[12px]">SINTER</code>), authorized user IDs.
            </p>
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default ListSetDemo;
