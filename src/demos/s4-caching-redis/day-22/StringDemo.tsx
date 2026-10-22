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
  const [cacheFlash, setCacheFlash] = useState(false);
  const [viewsFlash, setViewsFlash] = useState(false);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleIncrement = useCallback(() => {
    engine.incr('views:home', 1);
    setViewsFlash(true);
    setTimeout(() => setViewsFlash(false), 500);
    sync();
  }, [engine, sync]);

  const handleSaveCache = useCallback(() => {
    engine.set('cache:home', INITIAL_CACHE);
    setCacheWrites((count) => count + 1);
    setCacheFlash(true);
    setTimeout(() => setCacheFlash(false), 500);
    sync();
  }, [engine, sync]);

  const handleReset = useCallback(() => {
    engine.clear();
    engine.set('views:home', '10');
    engine.set('cache:home', INITIAL_CACHE);
    engine.setNarrative(INTRO_WHAT, INTRO_WHY);
    setCacheWrites(0);
    setCacheFlash(false);
    setViewsFlash(false);
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
            <span>Increment views (+1)</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleSaveCache}>
            <Braces className="h-4 w-4" aria-hidden="true" />
            <span>Save cache (SET)</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/70 pb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-theme-muted">
              In-Memory String Cells
            </span>
            <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 font-mono text-[11px] text-theme-muted">
              key → 512MB max bytes
            </span>
          </div>
          <span className="font-mono text-[12px] text-theme-muted">
            RAM footprint: {(viewsEntry?.bytes ?? 0) + (cacheEntry?.bytes ?? 0)} B
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {/* Cell 1: Atomic Counter */}
          <article
            data-highlight-id="key:views:home"
            className={`rounded-xl border border-theme-border bg-theme-bg p-4 transition-all duration-300 shadow-2xs ${
              viewsFlash ? 'demo-write-flash ring-2 ring-semantic-success' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-bold text-theme-text">
                  views:home
                </code>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  encoding: {viewsEntry?.encoding ?? 'int'}
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  {viewsEntry?.bytes ?? 66} B
                </span>
              </div>
            </div>

            <div className="mt-3.5 space-y-3">
              <div>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                  Live Value (Atomic Counter)
                </span>
                {viewsValue !== null ? (
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="font-mono text-4xl sm:text-5xl font-extrabold tabular-nums tracking-tight text-theme-text">
                      {viewsValue}
                    </p>
                    <span className="rounded-full border border-semantic-success/40 bg-semantic-success-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-semantic-success">
                      integer (64-bit)
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-[15px] text-theme-muted">Key missing.</p>
                )}
              </div>

              <div className="rounded-lg border border-theme-border bg-theme-surface-alt/50 p-2.5">
                <div className="flex items-center justify-between text-[12px] font-mono text-theme-muted">
                  <span>Atomic Command</span>
                  <span>Next result</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[13px] text-theme-text">
                  <span className="font-bold">INCRBY views:home 1</span>
                  {nextViews !== null && (
                    <div className="flex items-center gap-1.5 font-semibold text-semantic-info">
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="tabular-nums font-bold text-theme-text">{nextViews}</span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[14px] sm:text-[14.5px] leading-relaxed text-theme-muted">
                Redis single-threaded execution model guarantees concurrency safety: chahe hazaron users ek saath click karein, counter lost-updates ke bina atomically badhta hai.
              </p>
            </div>
          </article>

          {/* Cell 2: JSON String Cache */}
          <article
            data-highlight-id="key:cache:home"
            className={`rounded-xl border border-theme-border bg-theme-bg p-4 transition-all duration-300 shadow-2xs ${
              cacheFlash ? 'demo-write-flash ring-2 ring-semantic-success' : ''
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Braces className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-bold text-theme-text">
                  cache:home
                </code>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  encoding: {cacheEntry?.encoding ?? 'embstr'}
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  {cacheEntry?.bytes ?? 89} B
                </span>
              </div>
            </div>

            <div className="mt-3.5 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                    Raw UTF-8 Byte Payload
                  </span>
                  {cacheWrites > 0 && (
                    <span className="rounded-full border border-semantic-success/40 bg-semantic-success-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-semantic-success">
                      overwrites: {cacheWrites}
                    </span>
                  )}
                </div>
                <div className="mt-1 rounded-lg border border-theme-border bg-theme-surface p-2.5 font-mono text-[13px] leading-relaxed text-theme-text shadow-2xs">
                  {cacheValue ? (
                    <div>
                      <span className="text-theme-muted">{"{"}</span>
                      <div className="pl-4">
                        <span className="text-theme-accent font-semibold">"theme"</span>: <span className="text-semantic-success font-semibold">"dark"</span>,
                      </div>
                      <div className="pl-4">
                        <span className="text-theme-accent font-semibold">"lang"</span>: <span className="text-semantic-success font-semibold">"hi"</span>
                      </div>
                      <span className="text-theme-muted">{"}"}</span>
                    </div>
                  ) : (
                    <span className="text-theme-muted">Key missing.</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-theme-border bg-theme-surface-alt/50 p-2.5">
                <div className="flex items-center justify-between text-[12px] font-mono text-theme-muted">
                  <span>Write Command</span>
                  <span>Backend serialization</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[13px] text-theme-text">
                  <span className="font-bold truncate">SET cache:home '{"{...}"}'</span>
                  <span className="text-[12px] text-theme-muted shrink-0">JSON.stringify()</span>
                </div>
              </div>

              <p className="text-[14px] sm:text-[14.5px] leading-relaxed text-theme-muted">
                Redis is JSON ko parse nahi karta — uske liye ye sirf 29 raw bytes hain. Agar <code className="font-mono text-theme-accent text-[12.5px]">lang</code> badalna ho, to poora JSON string fir se rewrite karna hoga.
              </p>
            </div>
          </article>
        </div>

        {/* Takeaway Matrix */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-accent">
              ✓ Best Use Cases for String
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Atomic rate-limit counters (<code className="font-mono text-[12px]">INCR</code>), distributed locks (<code className="font-mono text-[12px]">SET key token NX EX 10</code>), aur pre-rendered HTML/API caches.
            </p>
          </div>
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-muted">
              ⚠️ Inefficient for Objects
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Agar session me 10 fields hain aur sirf 1 field update karni hai, to poora JSON rewrite karna wasteful hai. Next tab me dekho: <span className="font-semibold text-theme-text">Redis Hash</span>!
            </p>
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default StringDemo;
