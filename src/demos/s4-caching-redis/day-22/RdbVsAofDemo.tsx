import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  HardDrive,
  PenLine,
  Power,
  RefreshCw,
  Save,
} from 'lucide-react';
import {
  FsyncPolicy,
  RedisPersistenceEngine,
} from '../../../engine/redis/persistence';
import {
  DemoActionButton,
  DemoChallenge,
  DemoLogEntry,
  DemoShell,
} from './DemoShell';

type PersistenceMode = 'rdb' | 'aof';

const RDB_INTRO_WHAT =
  'RDB mode: initial snapshot me 3 keys hain. Naya cart write snapshot ke baad hua to crash par lost hoga.';
const RDB_INTRO_WHY =
  'RDB point-in-time photo hai. Save ke baad ke writes disk par nahi hote, isliye restart par woh missing hain.';
const AOF_INTRO_WHAT =
  'AOF mode: har write append log me jaati hai. fsync always hai, isliye crash ke baad replay se write wapas aayegi.';
const AOF_INTRO_WHY =
  'AOF commands ka log hai. Disk par fsynced command restart par replay hoti hai, isliye durability zyada hai.';

function configureEngine(
  engine: RedisPersistenceEngine,
  mode: PersistenceMode
): void {
  engine.reset();
  engine.setAofEnabled(mode === 'aof');
  if (mode === 'aof') {
    engine.setFsyncPolicy('always');
  }
  engine.setNarrative(
    mode === 'rdb' ? RDB_INTRO_WHAT : AOF_INTRO_WHAT,
    mode === 'rdb' ? RDB_INTRO_WHY : AOF_INTRO_WHY
  );
}

export const RdbVsAofDemo: React.FC = () => {
  const engine = useMemo(() => {
    const instance = new RedisPersistenceEngine();
    configureEngine(instance, 'rdb');
    return instance;
  }, []);
  const [mode, setMode] = useState<PersistenceMode>('rdb');
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());
  const [writeCount, setWriteCount] = useState(0);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handleWrite = useCallback(() => {
    if (engine.getSnapshot().serverStatus !== 'running') return;
    const next = writeCount + 1;
    engine.write('SET', 'cart:u101', String(next));
    setWriteCount(next);
    sync();
  }, [engine, sync, writeCount]);

  const handleSaveRdb = useCallback(() => {
    engine.triggerBgsave();
    sync();
  }, [engine, sync]);

  const handleCrash = useCallback(() => {
    engine.crashServer();
    sync();
  }, [engine, sync]);

  const handleRestart = useCallback(() => {
    engine.restartServer();
    sync();
  }, [engine, sync]);

  const handleMode = useCallback(
    (nextMode: PersistenceMode) => {
      if (nextMode === mode) return;
      configureEngine(engine, nextMode);
      setMode(nextMode);
      setWriteCount(0);
      sync();
    },
    [engine, mode, sync]
  );

  const handleReset = useCallback(() => {
    configureEngine(engine, mode);
    setWriteCount(0);
    sync();
  }, [engine, mode, sync]);

  const handleFsync = useCallback(
    (policy: FsyncPolicy) => {
      engine.setFsyncPolicy(policy);
      sync();
    },
    [engine, sync]
  );

  const handleFlush = useCallback(() => {
    engine.flushAofBuffer();
    sync();
  }, [engine, sync]);

  const handleAdvance = useCallback(() => {
    engine.advanceTime(1);
    sync();
  }, [engine, sync]);

  const crashed = snapshot.serverStatus === 'crashed';
  const report = snapshot.lastCrashReport;
  const ramKeys = Object.entries(snapshot.ramKeys);
  const rdbKeys = snapshot.rdbSnapshot
    ? Object.entries(snapshot.rdbSnapshot.data)
    : [];
  const aofDiskEntries = snapshot.aofDiskFile.slice(-6);
  const aofBufferEntries = snapshot.aofBuffer;
  const primaryAction = crashed ? handleRestart : handleWrite;

  const logs: DemoLogEntry[] = snapshot.eventLog.map((event) => {
    let target: string | undefined;
    if (event.source === 'RAM' && event.key) target = `ram:${event.key}`;
    else if (event.source === 'AOF' && event.key) target = `aof:${event.key}`;
    else if (event.source === 'RDB') target = 'rdb-snapshot';
    else if (event.source === 'AOF') target = 'aof-disk';
    else if (event.source === 'CRASH' || event.source === 'RECOVERY') {
      target = 'ram-card';
    }

    return {
      id: event.id,
      tick: event.tick,
      label: event.source,
      message: event.message,
      type: event.type,
      target,
    };
  });

  const challenges: DemoChallenge[] = [
    {
      id: 'rdb-lost-write',
      title: 'RDB crash me ek write lose karo',
      description:
        'RDB mode me cart write karo, RDB save mat karo, crash karke restart karo.',
      passed: report?.recoveredSource === 'RDB' && report.lostCount > 0,
    },
    {
      id: 'aof-zero-loss',
      title: 'AOF se zero-loss recovery karo',
      description:
        'AOF mode me cart write karo, crash karo, restart karo. fsync always rakho.',
      passed: report?.recoveredSource === 'AOF' && report.lostCount === 0,
    },
  ];

  return (
    <DemoShell
      title="RDB vs AOF: what survives a crash"
      summary="RDB last snapshot tak ka data deta hai; AOF fsynced commands replay karta hai. Crash karke khud difference dekho."
      difficulty="medium"
      notesAnchor="persistence-2-aof-append-only-file"
      whatJustHappened={snapshot.whatJustHappened}
      whyItMatters={snapshot.whyItMatters}
      canvasClassName="min-h-[77.75rem] max-[380px]:min-h-[80rem] sm:min-h-[37.5rem]"
      logs={logs}
      challenges={challenges}
      stateSnapshot={{
        tick: snapshot.tick,
        serverStatus: snapshot.serverStatus,
        fsyncPolicy: snapshot.fsyncPolicy,
        ramKeys: snapshot.ramKeys,
        rdbSnapshot: snapshot.rdbSnapshot,
        aofEnabled: snapshot.aofEnabled,
        aofDiskFile: snapshot.aofDiskFile.slice(-10),
        aofBuffer: snapshot.aofBuffer,
        lastCrashReport: snapshot.lastCrashReport,
      }}
      onReset={handleReset}
      onPrimaryAction={primaryAction}
      resetLabel="Reset crash scenario"
      extraOptions={
        <>
          <label className="flex items-center gap-2 text-[15px] text-theme-muted">
            <span>AOF fsync</span>
            <select
              value={snapshot.fsyncPolicy}
              onChange={(event) => handleFsync(event.target.value as FsyncPolicy)}
              disabled={!snapshot.aofEnabled || crashed}
              className="min-h-9 rounded-lg border border-theme-border bg-theme-surface px-2 py-1.5 text-[14px] font-semibold text-theme-text disabled:opacity-50"
            >
              <option value="always">always</option>
              <option value="everysec">everysec</option>
              <option value="no">no</option>
            </select>
          </label>
          <DemoActionButton
            onClick={handleFlush}
            disabled={!snapshot.aofEnabled || aofBufferEntries.length === 0 || crashed}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Flush AOF now</span>
          </DemoActionButton>
          <DemoActionButton onClick={handleAdvance} disabled={crashed}>
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Advance 1s</span>
          </DemoActionButton>
        </>
      }
      actions={
        <>
          {crashed ? (
            <DemoActionButton variant="primary" onClick={handleRestart}>
              <Power className="h-4 w-4" aria-hidden="true" />
              <span>Restart server</span>
            </DemoActionButton>
          ) : (
            <DemoActionButton variant="primary" onClick={handleWrite}>
              <PenLine className="h-4 w-4" aria-hidden="true" />
              <span>Write cart = {writeCount + 1}</span>
            </DemoActionButton>
          )}
          <DemoActionButton onClick={handleSaveRdb} disabled={crashed}>
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>Save RDB snapshot</span>
          </DemoActionButton>
          <DemoActionButton variant="danger" onClick={handleCrash} disabled={crashed}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span>Crash server</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Persistence mode"
            className="flex flex-wrap items-center gap-1 rounded-lg border border-theme-border bg-theme-surface-alt p-1"
          >
            {(['rdb', 'aof'] as const).map((option) => {
              const active = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleMode(option)}
                  className={`inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-semibold transition-colors ${
                    active
                      ? 'bg-theme-surface text-theme-text shadow-xs'
                      : 'text-theme-muted hover:text-theme-text'
                  }`}
                >
                  {active && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{option === 'rdb' ? 'RDB only' : 'AOF on'}</span>
                </button>
              );
            })}
          </div>
          <span className="rounded-full border border-theme-border bg-theme-surface-alt px-2 py-0.5 font-mono text-[12px] text-theme-muted">
            status: {snapshot.serverStatus}
          </span>
        </div>

        <div className="min-h-[7.5rem]">
          {report ? (
            <div
              className={`rounded-xl border p-3.5 ${
                report.lostCount > 0
                  ? 'border-semantic-error/40 bg-semantic-error-bg'
                  : 'border-semantic-success/40 bg-semantic-success-bg'
              }`}
            >
              <div className="flex items-start gap-2">
                {report.lostCount > 0 ? (
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-error"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-semantic-success"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[16px] font-semibold leading-snug text-theme-text">
                    {report.recoveredSource} recovery: {report.recoveredCount} keys aayi,{' '}
                    {report.lostCount} {report.lostCount === 1 ? 'write' : 'writes'} lost.
                  </p>
                  <p className="mt-0.5 text-[15px] text-theme-muted">
                    Crash se pehle RAM me {report.totalBeforeCrash} keys thi.
                  </p>
                  {report.lostKeys.length > 0 && (
                    <p className="mt-1 font-mono text-[13px] text-semantic-error">
                      lost: {report.lostKeys.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-theme-border bg-theme-bg p-3.5 text-[15px] leading-relaxed text-theme-muted">
              Crash ke baad recovery report yahan aayegi. Pehle ek write karo, phir crash karke restart karo.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article
            data-highlight-id="ram-card"
            className="rounded-xl border border-theme-border bg-theme-bg p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-theme-text sm:text-[17px]">
                <Database className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                RAM
              </span>
              <span className="font-mono text-[13px] tabular-nums text-theme-muted">
                {snapshot.ramKeyCount} keys
              </span>
            </div>
            <p className="mt-1 text-[15px] text-theme-muted">volatile · crash par wipe</p>

            <div className="mt-3 h-[10rem] space-y-1.5 overflow-y-auto pr-0.5">
              {crashed ? (
                <p className="rounded-lg border border-semantic-error/40 bg-semantic-error-bg px-2.5 py-2 text-[15px] font-semibold text-semantic-error">
                  RAM wiped. Restart se recovery hogi.
                </p>
              ) : ramKeys.length === 0 ? (
                <p className="rounded-lg border border-dashed border-theme-border px-2.5 py-2 text-[15px] text-theme-muted">
                  Koi key nahi.
                </p>
              ) : (
                ramKeys.map(([key, value]) => (
                  <div
                    key={key}
                    data-highlight-id={`ram:${key}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5"
                  >
                    <code className="break-all font-mono text-[12px] text-theme-text">
                      {key}
                    </code>
                    <span className="font-mono text-[13px] font-semibold text-theme-text">
                      {value}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article
            data-highlight-id="rdb-snapshot"
            className="rounded-xl border border-theme-border bg-theme-bg p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-theme-text sm:text-[17px]">
                <HardDrive className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                RDB snapshot
              </span>
              <span className="font-mono text-[13px] tabular-nums text-theme-muted">
                {rdbKeys.length} keys
              </span>
            </div>
            <p className="mt-1 text-[15px] text-theme-muted">
              point-in-time · save ke baad ka data nahi
            </p>

            <div className="mt-3 h-[10rem] space-y-1.5 overflow-y-auto pr-0.5">
              {rdbKeys.length === 0 ? (
                <p className="rounded-lg border border-dashed border-theme-border px-2.5 py-2 text-[15px] text-theme-muted">
                  Snapshot abhi nahi hai.
                </p>
              ) : (
                rdbKeys.map(([key, value]) => (
                  <div
                    key={key}
                    data-highlight-id={`rdb:${key}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5"
                  >
                    <code className="break-all font-mono text-[12px] text-theme-text">
                      {key}
                    </code>
                    <span className="font-mono text-[13px] font-semibold text-theme-text">
                      {value}
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 font-mono text-[12px] text-theme-muted">
              saved at t{snapshot.rdbSnapshot?.tick ?? '—'}
            </p>
          </article>

          <article
            data-highlight-id="aof-disk"
            className="rounded-xl border border-theme-border bg-theme-bg p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[16px] font-semibold tracking-tight text-theme-text sm:text-[17px]">
                <HardDrive className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                AOF log
              </span>
              <span className="font-mono text-[13px] tabular-nums text-theme-muted">
                {snapshot.aofEnabled ? 'on' : 'off'}
              </span>
            </div>
            <p className="mt-1 text-[15px] text-theme-muted">
              command log · fsynced writes replay
            </p>

            {!snapshot.aofEnabled ? (
              <div className="mt-3 flex h-36 items-center justify-center rounded-lg border border-dashed border-theme-border px-3 py-2 text-center text-[15px] leading-relaxed text-theme-muted">
                AOF off hai. RDB-only mode me restart sirf snapshot load karega.
              </div>
            ) : (
              <>
                <div className="mt-3 h-24 space-y-1.5 overflow-y-auto pr-0.5">
                  {aofDiskEntries.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-theme-border px-2.5 py-2 text-[15px] text-theme-muted">
                      Disk par koi command nahi.
                    </p>
                  ) : (
                    aofDiskEntries.map((entry) => (
                      <div
                        key={entry.id}
                        data-highlight-id={`aof:${entry.key}`}
                        className="rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5"
                      >
                        <code className="block break-all font-mono text-[12px] text-theme-text">
                          {entry.command} {entry.key} {entry.value}
                        </code>
                        <span className="font-mono text-[11px] text-theme-muted">
                          t{entry.tick} · fsynced
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-2 h-10 overflow-y-auto">
                  {aofBufferEntries.length > 0 ? (
                    <div className="rounded-lg border border-semantic-inflight/40 bg-semantic-inflight-bg px-2.5 py-2">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-semantic-inflight">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Buffer: {aofBufferEntries.length} pending fsync
                      </p>
                      {aofBufferEntries.map((entry) => (
                        <code
                          key={entry.id}
                          data-highlight-id={`aof-buffer:${entry.key}`}
                          className="mt-1 block break-all font-mono text-[12px] text-theme-text"
                        >
                          {entry.command} {entry.key} {entry.value}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-theme-border bg-theme-surface-alt/40 px-2.5 py-2 text-[13px] text-theme-muted">
                      Buffer empty — pending writes sab fsynced hain.
                    </p>
                  )}
                </div>
              </>
            )}
          </article>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-theme-border bg-theme-surface-alt/40 px-3 py-2.5 text-[15px] leading-relaxed text-theme-muted">
            <span className="font-semibold text-theme-text">RDB: </span>
            photo jitni purani, utna data. Fast restart, but snapshot ke baad ke
            writes lost.
          </div>
          <div className="rounded-lg border border-theme-border bg-theme-surface-alt/40 px-3 py-2.5 text-[15px] leading-relaxed text-theme-muted">
            <span className="font-semibold text-theme-text">AOF: </span>
            har command ka log. fsynced writes replay hote hain, isliye crash
            loss kam.
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default RdbVsAofDemo;
