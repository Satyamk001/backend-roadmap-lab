import React, { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Braces, Hash, RefreshCw } from 'lucide-react';
import { RedisStructuresEngine } from '../../../engine/redis/structures';
import {
  DemoActionButton,
  DemoChallenge,
  DemoLogEntry,
  DemoShell,
} from './DemoShell';

const INTRO_WHAT =
  'Ek string key ke andar sirf ek value hoti hai — yahan views:home ka value 10 hai.';
const INTRO_WHY =
  'Counter badhane ke liye poora object nahi, sirf ek atomic INCR chalta hai.';

const INITIAL_CACHE = '{"theme":"dark","lang":"hi"}';

function createEngine(): RedisStructuresEngine {
  const engine = new RedisStructuresEngine();
  engine.clear();
  engine.set('views:home', '10');
  engine.set('cache:home', INITIAL_CACHE);
  engine.setNarrative(INTRO_WHAT, INTRO_WHY);
  return engine;
}

export const StringDemo: React.FC = () => {
  const engine = useMemo(createEngine, []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const [cacheWrites, setCacheWrites] = useState(0);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleIncrement = useCallback(() => {
    engine.incr('views:home', 1);
    sync();
  }, [engine, sync]);

  const handleSaveCache = useCallback(() => {
    engine.set('cache:home', INITIAL_CACHE);
    setCacheWrites((count) => count + 1);
    sync();
  }, [engine, sync]);

  const handleReset = useCallback(() => {
    engine.clear();
    engine.set('views:home', '10');
    engine.set('cache:home', INITIAL_CACHE);
    engine.setNarrative(INTRO_WHAT, INTRO_WHY);
    setCacheWrites(0);
    sync();
  }, [engine, sync]);

  const viewsEntry = snapshot.entries['views:home'];
  const cacheEntry = snapshot.entries['cache:home'];
  const viewsValue =
    viewsEntry?.value.type === 'string' ? viewsEntry.value.raw : null;
  const cacheValue =
    cacheEntry?.value.type === 'string' ? cacheEntry.value.raw : null;
  const nextViews =
    viewsValue !== null && Number.isFinite(Number(viewsValue))
      ? Number(viewsValue) + 1
      : null;

  const logs: DemoLogEntry[] = snapshot.eventLog.map((event) => {
    const key = event.command.split(/\s+/)[1];
    return {
      id: event.id,
      tick: event.tick,
      label: event.command,
      message: `${event.result} — ${event.impact}`,
      type: event.type,
      target: key ? `key:${key}` : undefined,
    };
  });

  const challenges: DemoChallenge[] = [
    {
      id: 'string-counter-14',
      title: 'Counter ko 14 tak pahunchao',
      description: 'Increment views button 4 baar dabao. Har click ek atomic INCR hai.',
      passed: Number(viewsValue ?? 0) >= 14,
    },
    {
      id: 'string-cache-write',
      title: 'Cache value ko dobara save karo',
      description:
        'Save cache dabao. JSON string ko Redis parse nahi karta — woh sirf bytes store karta hai.',
      passed: cacheWrites > 0,
    },
  ];

  return (
    <DemoShell
      title="String: one key, one value"
      summary="Ek key ke andar ek value — counter, JSON cache, ya raw string. Value ka type Redis ke liye sirf bytes hai."
      difficulty="easy"
      notesAnchor="strings"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      canvasClassName="min-h-[54.75rem] sm:min-h-[26.25rem]"
      logs={logs}
      challenges={challenges}
      stateSnapshot={{
        tick: snapshot.tick,
        entries: snapshot.entries,
        stats: snapshot.stats,
      }}
      onReset={handleReset}
      onPrimaryAction={handleIncrement}
      resetLabel="Reset String scenario"
      actions={
        <>
          <DemoActionButton variant="primary" onClick={handleIncrement}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Increment views</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleSaveCache}>
            <Braces className="h-4 w-4" aria-hidden="true" />
            <span>Save cache</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-bold tracking-tight text-theme-text sm:text-[18px]">
            Ek key ke andar kya rehta hai?
          </h3>
          <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 font-mono text-[12px] text-theme-muted">
            key → value
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <article
            data-highlight-id="key:views:home"
            className="rounded-xl border border-theme-border bg-theme-bg p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-semibold text-theme-text">
                  views:home
                </code>
              </div>
              <span className="rounded-full border border-theme-border bg-theme-surface px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
                String
              </span>
            </div>

            <div className="mt-3">
              <p className="text-[15px] text-theme-muted">Value</p>
              {viewsValue !== null ? (
                <p className="mt-0.5 font-mono text-4xl font-bold tabular-nums tracking-tight text-theme-text">
                  {viewsValue}
                </p>
              ) : (
                <p className="mt-0.5 text-[15px] font-semibold text-theme-muted">
                  Key nahi mili. More options se reset karo.
                </p>
              )}
              <p className="mt-1 font-mono text-[13px] text-theme-muted">
                encoding {viewsEntry?.encoding ?? '—'} · {viewsEntry?.bytes ?? '—'} B
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-theme-border bg-theme-surface-alt/60 px-3 py-2 font-mono text-[13px] text-theme-text">
              <span>INCRBY views:home 1</span>
              {nextViews !== null && (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-theme-muted" aria-hidden="true" />
                  <span className="font-bold tabular-nums">{nextViews}</span>
                </>
              )}
            </div>

            <p className="mt-3 text-[15px] leading-relaxed text-theme-muted">
              Counter ek hi key me rehta hai. Redis ise atomically badhata hai,
              isliye do requests ek doosre ko overwrite nahi karti.
            </p>
          </article>

          <article
            data-highlight-id="key:cache:home"
            className="rounded-xl border border-theme-border bg-theme-bg p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-semibold text-theme-text">
                  cache:home
                </code>
              </div>
              <span className="rounded-full border border-theme-border bg-theme-surface px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
                String
              </span>
            </div>

            <div className="mt-3">
              <p className="text-[15px] text-theme-muted">Value</p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-theme-border bg-theme-surface px-3 py-2 font-mono text-[13px] leading-relaxed text-theme-text">
                {cacheValue ?? 'Key nahi mili.'}
              </pre>
              <p className="mt-1 font-mono text-[13px] text-theme-muted">
                encoding {cacheEntry?.encoding ?? '—'} · {cacheEntry?.bytes ?? '—'} B
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-theme-border bg-theme-surface-alt/60 px-3 py-2 font-mono text-[13px] text-theme-text">
              <span>SET cache:home ...</span>
            </div>

            <p className="mt-3 text-[15px] leading-relaxed text-theme-muted">
              JSON bhi ek string hai. Redis usse parse nahi karta; application
              hi value ko JSON samajhta hai.
            </p>
          </article>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-theme-border bg-theme-surface-alt/40 px-3 py-2.5 text-[15px] text-theme-muted">
          <span className="font-mono text-theme-text">key</span>
          <ArrowRight className="h-4 w-4 text-theme-accent" aria-hidden="true" />
          <span className="font-mono text-theme-text">one value</span>
          <span>
            Bas itna hi. String number, JSON, ya raw bytes ho sakta hai — Redis
            ke liye sab ek hi value hai.
          </span>
        </div>
      </div>
    </DemoShell>
  );
};

export default StringDemo;
