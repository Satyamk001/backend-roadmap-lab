import React, { useCallback, useMemo, useState } from 'react';
import { Hash, KeyRound, LogIn, ShieldCheck, Trash2 } from 'lucide-react';
import { RedisStructuresEngine } from '../../../engine/redis/structures';
import {
  DemoActionButton,
  DemoChallenge,
  DemoLogEntry,
  DemoShell,
} from './DemoShell';

const SESSION_KEY = 'sess:alice';
const INTRO_WHAT =
  'Session key ke andar alag-alag fields hain — ek Hash, ek single string nahi.';
const INTRO_WHY =
  'Role ya login count badalne par sirf woh field update hota hai; baaki session data untouched rehta hai.';

function createEngine(): RedisStructuresEngine {
  const engine = new RedisStructuresEngine();
  engine.clear();
  engine.hset(SESSION_KEY, 'userId', 'u101');
  engine.hset(SESSION_KEY, 'role', 'viewer');
  engine.hset(SESSION_KEY, 'loginCount', '2');
  engine.hset(SESSION_KEY, 'lastSeen', '10:42');
  engine.setNarrative(INTRO_WHAT, INTRO_WHY);
  return engine;
}

const FIELD_ORDER = ['userId', 'role', 'loginCount', 'lastSeen'] as const;

export const HashDemo: React.FC = () => {
  const engine = useMemo(createEngine, []);
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const entry = snapshot.entries[SESSION_KEY];
  const fields =
    entry?.value.type === 'hash' ? entry.value.fields : null;
  const role = fields?.role ?? '';
  const loginCount = Number(fields?.loginCount ?? 0);

  const handleLogin = useCallback(() => {
    if (!fields) return;
    const nextTick = engine.getSnapshot().tick + 1;
    engine.hset(SESSION_KEY, 'lastSeen', `t${nextTick}`);
    engine.hincrby(SESSION_KEY, 'loginCount', 1);
    sync();
  }, [engine, fields, sync]);

  const handleToggleRole = useCallback(() => {
    if (!fields) return;
    engine.hset(SESSION_KEY, 'role', role === 'admin' ? 'viewer' : 'admin');
    sync();
  }, [engine, fields, role, sync]);

  const handleDelete = useCallback(() => {
    engine.del(SESSION_KEY);
    sync();
  }, [engine, sync]);

  const handleReset = useCallback(() => {
    engine.clear();
    engine.hset(SESSION_KEY, 'userId', 'u101');
    engine.hset(SESSION_KEY, 'role', 'viewer');
    engine.hset(SESSION_KEY, 'loginCount', '2');
    engine.hset(SESSION_KEY, 'lastSeen', '10:42');
    engine.setNarrative(INTRO_WHAT, INTRO_WHY);
    sync();
  }, [engine, sync]);

  const logs: DemoLogEntry[] = snapshot.eventLog.map((event) => {
    const parts = event.command.split(/\s+/);
    const isFieldCommand = parts[0] === 'HSET' || parts[0] === 'HINCRBY';
    const target = isFieldCommand
      ? `field:${parts[2]}`
      : parts[0] === 'DEL'
      ? `key:${parts[1]}`
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

  const challenges: DemoChallenge[] = [
    {
      id: 'hash-admin-role',
      title: 'Role ko admin banao',
      description: 'Promote to admin dabao. Sirf role field change hogi.',
      passed: role === 'admin',
    },
    {
      id: 'hash-five-logins',
      title: 'Login count 5 tak pahunchao',
      description: 'Record login 3 baar dabao. HINCRBY sirf count field update karta hai.',
      passed: loginCount >= 5,
    },
  ];

  return (
    <DemoShell
      title="Hash: fields inside a key"
      summary="Ek session key, andar alag fields. Role badlo ya login count badhao — poora object rewrite nahi hota."
      difficulty="easy"
      notesAnchor="hashes"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      canvasClassName="min-h-[34.25rem] max-[380px]:min-h-[35.75rem] sm:min-h-[27.25rem]"
      logs={logs}
      challenges={challenges}
      stateSnapshot={{
        tick: snapshot.tick,
        entries: snapshot.entries,
        stats: snapshot.stats,
      }}
      onReset={handleReset}
      onPrimaryAction={handleLogin}
      resetLabel="Reset session scenario"
      extraOptions={
        <DemoActionButton
          variant="danger"
          onClick={handleDelete}
          disabled={!fields}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>Delete whole session</span>
        </DemoActionButton>
      }
      actions={
        <>
          <DemoActionButton
            variant="primary"
            onClick={handleLogin}
            disabled={!fields}
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span>Record login</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleToggleRole} disabled={!fields}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{role === 'admin' ? 'Demote to viewer' : 'Promote to admin'}</span>
          </DemoActionButton>
        </>
      }
    >
      {!fields ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-theme-border bg-theme-bg p-5">
          <div className="flex items-center gap-2 text-[16px] font-semibold text-theme-text">
            <KeyRound className="h-4 w-4 text-theme-muted" aria-hidden="true" />
            <span>Session key delete ho gayi</span>
          </div>
          <p className="text-[15px] leading-relaxed text-theme-muted">
            Ek DEL ne poora Hash aur uske saare fields hata diye. More options se
            scenario reset karo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <article
            data-highlight-id="key:sess:alice"
            className="rounded-xl border border-theme-border bg-theme-bg p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-semibold text-theme-text">
                  {SESSION_KEY}
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-theme-border bg-theme-surface px-2 py-0.5 text-[13px] font-semibold text-theme-muted">
                  Hash
                </span>
                <span className="font-mono text-[13px] text-theme-muted">
                  {Object.keys(fields).length} fields · {entry?.encoding}
                </span>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-theme-border">
              {FIELD_ORDER.filter((field) => fields[field] !== undefined).map(
                (field) => (
                  <div
                    key={field}
                    data-highlight-id={`field:${field}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/70 bg-theme-surface px-3 py-2.5 last:border-b-0"
                  >
                    <code className="font-mono text-[13px] font-semibold text-theme-muted">
                      {field}
                    </code>
                    {field === 'role' ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[13px] font-semibold ${
                          fields[field] === 'admin'
                            ? 'border-semantic-success/40 bg-semantic-success-bg text-semantic-success'
                            : 'border-theme-border bg-theme-surface-alt text-theme-muted'
                        }`}
                      >
                        {fields[field]}
                      </span>
                    ) : (
                      <span className="font-mono text-[15px] font-semibold text-theme-text">
                        {fields[field]}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="mt-3 grid min-h-[5.25rem] gap-1 rounded-lg border border-theme-border bg-theme-surface-alt/60 px-3 py-2 sm:min-h-[2.75rem] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-2">
              <span className="font-mono text-[13px] text-theme-text">
                Next: HSET {SESSION_KEY} role {role === 'admin' ? 'viewer' : 'admin'}
              </span>
              <span className="text-[15px] text-theme-muted">
                sirf role field badlegi
              </span>
            </div>
          </article>

          <div className="rounded-lg border border-dashed border-theme-border bg-theme-surface-alt/40 px-3 py-2.5 text-[15px] leading-relaxed text-theme-muted">
            <span className="font-semibold text-theme-text">String JSON vs Hash: </span>
            JSON me role badalne ke liye poora object parse + rewrite karna padta
            hai. Hash me Redis sirf selected field update karta hai.
          </div>
        </div>
      )}
    </DemoShell>
  );
};

export default HashDemo;
