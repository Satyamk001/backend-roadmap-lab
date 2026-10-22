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

  const [changedField, setChangedField] = useState<string | null>(null);

  const triggerChange = useCallback((field: string) => {
    setChangedField(field);
    setTimeout(() => setChangedField(null), 600);
  }, []);

  const handleLogin = useCallback(() => {
    if (!fields) return;
    const nextTick = engine.getSnapshot().tick + 1;
    engine.hset(SESSION_KEY, 'lastSeen', `t${nextTick}`);
    engine.hincrby(SESSION_KEY, 'loginCount', 1);
    triggerChange('loginCount');
    sync();
  }, [engine, fields, sync, triggerChange]);

  const handleToggleRole = useCallback(() => {
    if (!fields) return;
    engine.hset(SESSION_KEY, 'role', role === 'admin' ? 'viewer' : 'admin');
    triggerChange('role');
    sync();
  }, [engine, fields, role, sync, triggerChange]);

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
    setChangedField(null);
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
          <span>Delete whole session (DEL)</span>
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
            <span>Record login (HINCRBY)</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleToggleRole} disabled={!fields}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>{role === 'admin' ? 'Demote to viewer' : 'Promote to admin (HSET)'}</span>
          </DemoActionButton>
        </>
      }
    >
      {!fields ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-theme-border bg-theme-bg p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-semantic-error-bg text-semantic-error border border-semantic-error/40">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-[17px] font-bold text-theme-text">Session Key Deleted (DEL sess:alice)</p>
            <p className="text-[14.5px] max-w-md text-theme-muted">
              Ek single DEL command ne pure Hash object aur uske saare internal fields ko RAM se clean wipe kar diya.
            </p>
          </div>
          <DemoActionButton variant="primary" onClick={handleReset}>
            Restore session
          </DemoActionButton>
        </div>
      ) : (
        <div className="space-y-4">
          <article
            data-highlight-id="key:sess:alice"
            className="rounded-xl border border-theme-border bg-theme-bg p-4 shadow-2xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/60 pb-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                <code className="break-all font-mono text-[15px] font-bold text-theme-text">
                  {SESSION_KEY}
                </code>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  Type: Hash
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  {Object.keys(fields).length} fields
                </span>
                <span className="rounded-md border border-theme-border bg-theme-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-theme-muted">
                  encoding: {entry?.encoding ?? 'listpack'}
                </span>
              </div>
            </div>

            {/* Fields Grid */}
            <div className="mt-3.5 divide-y divide-theme-border/60 rounded-xl border border-theme-border bg-theme-surface overflow-hidden shadow-2xs">
              {FIELD_ORDER.filter((field) => fields[field] !== undefined).map((field) => {
                const isRecentlyChanged = changedField === field;
                return (
                  <div
                    key={field}
                    data-highlight-id={`field:${field}`}
                    className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 transition-colors duration-300 ${
                      isRecentlyChanged
                        ? 'bg-semantic-success-bg/40 ring-1 ring-inset ring-semantic-success'
                        : 'hover:bg-theme-surface-alt/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-theme-accent">
                        {field}
                      </span>
                      {isRecentlyChanged && (
                        <span className="rounded-full border border-semantic-success/40 bg-semantic-success-bg px-2 py-0.2 font-mono text-[10px] font-bold text-semantic-success">
                          updated in-place
                        </span>
                      )}
                    </div>

                    <div>
                      {field === 'role' ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12.5px] font-bold transition-all duration-200 ${
                            fields[field] === 'admin'
                              ? 'border-semantic-success/50 bg-semantic-success-bg text-semantic-success shadow-xs'
                              : 'border-theme-border bg-theme-surface-alt text-theme-muted'
                          }`}
                        >
                          {fields[field]}
                        </span>
                      ) : field === 'loginCount' ? (
                        <span className="font-mono text-[16px] font-extrabold tabular-nums text-theme-text">
                          {fields[field]}
                        </span>
                      ) : (
                        <span className="font-mono text-[14px] font-semibold text-theme-text">
                          {fields[field]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Next Live Command Pill */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface-alt/50 px-3 py-2 font-mono text-[12.5px] text-theme-text">
              <div className="flex items-center gap-2">
                <span className="font-bold text-theme-muted uppercase text-[11px]">Next Operation:</span>
                <span className="font-semibold text-theme-accent">
                  HSET {SESSION_KEY} role {role === 'admin' ? 'viewer' : 'admin'}
                </span>
              </div>
              <span className="text-[12px] text-theme-muted">
                Sirf role field update hogi, baaki fields untouched!
              </span>
            </div>
          </article>

          {/* Architecture Comparison */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
            <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
              <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-muted">
                ❌ String JSON Approach
              </p>
              <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
                Role badalne ke liye backend ko poora 150B JSON string read karna padta hai, parse karo, mutate karo, phir poora 150B rewrite karo. Heavy CPU + network overhead!
              </p>
            </div>
            <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
              <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-accent">
                ⚡ Redis Hash Approach
              </p>
              <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
                <code className="font-mono text-[12px]">HSET sess:alice role admin</code> sirf ~25 bytes bhejta hai. Redis memory me in-place update karta hai — zero serialization cost, 85% bandwidth saved.
              </p>
            </div>
          </div>
        </div>
      )}
    </DemoShell>
  );
};

export default HashDemo;
