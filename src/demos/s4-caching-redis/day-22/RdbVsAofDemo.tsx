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
          <label className="flex items-center gap-2 text-[14.5px] text-theme-muted">
            <span className="font-mono text-[12px] font-bold">fsync policy:</span>
            <select
              value={snapshot.fsyncPolicy}
              onChange={(event) => handleFsync(event.target.value as FsyncPolicy)}
              disabled={!snapshot.aofEnabled || crashed}
              aria-label="AOF fsync policy"
              className="min-h-8 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1 font-mono text-[13px] font-semibold text-theme-text disabled:opacity-50"
            >
              <option value="always">always (max durability)</option>
              <option value="everysec">everysec (default)</option>
              <option value="no">no (OS flush)</option>
            </select>
          </label>
          <DemoActionButton
            onClick={handleFlush}
            disabled={!snapshot.aofEnabled || aofBufferEntries.length === 0 || crashed}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Flush buffer</span>
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
            <DemoActionButton
              variant="primary"
              className="font-bold shadow-xs"
              onClick={handleRestart}
            >
              <Power className="h-4 w-4" aria-hidden="true" />
              <span>Restart & Recover server</span>
            </DemoActionButton>
          ) : (
            <DemoActionButton variant="primary" onClick={handleWrite}>
              <PenLine className="h-4 w-4" aria-hidden="true" />
              <span>Write cart = {writeCount + 1}</span>
            </DemoActionButton>
          )}
          <DemoActionButton onClick={handleSaveRdb} disabled={crashed}>
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>Save RDB snapshot (BGSAVE)</span>
          </DemoActionButton>
          <DemoActionButton variant="danger" onClick={handleCrash} disabled={crashed}>
            <AlertTriangle className="h-4 w-4 text-semantic-error" aria-hidden="true" />
            <span>Simulate crash</span>
          </DemoActionButton>
        </>
      }
    >
      <div className="space-y-4">
        {/* Persistence Mode & Engine Health Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] font-bold uppercase tracking-wider text-theme-muted">
              Persistence Strategy:
            </span>
            <div
              role="group"
              aria-label="Persistence mode"
              className="flex items-center gap-1 rounded-xl border border-theme-border bg-theme-surface-alt/70 p-1 shadow-2xs"
            >
              {(['rdb', 'aof'] as const).map((option) => {
                const active = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleMode(option)}
                    className={`inline-flex min-h-7 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-all ${
                      active
                        ? 'bg-theme-surface text-theme-text shadow-xs ring-1 ring-theme-border'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    {active && <CheckCircle2 className="h-3.5 w-3.5 text-theme-accent" aria-hidden="true" />}
                    <span>{option === 'rdb' ? 'RDB Snapshot Only' : 'AOF Log Enabled'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11.5px] font-bold uppercase tracking-wider ${
                crashed
                  ? 'border-semantic-error/50 bg-semantic-error-bg text-semantic-error shadow-xs'
                  : 'border-semantic-success/50 bg-semantic-success-bg text-semantic-success'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  crashed ? 'bg-semantic-error' : 'bg-semantic-success animate-pulse'
                }`}
              />
              <span>Server {snapshot.serverStatus}</span>
            </span>
          </div>
        </div>

        {/* Dynamic Crash & Post-Mortem Report Banner */}
        <div>
          {report ? (
            <div
              className={`rounded-xl border p-4 shadow-2xs transition-all ${
                report.lostCount > 0
                  ? 'border-semantic-error/40 bg-semantic-error-bg/60'
                  : 'border-semantic-success/40 bg-semantic-success-bg/60'
              }`}
            >
              <div className="flex items-start gap-3">
                {report.lostCount > 0 ? (
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-semantic-error"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-semantic-success"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 space-y-1">
                  <p className="text-[16px] font-bold leading-snug text-theme-text">
                    {report.recoveredSource} Recovery Complete: {report.recoveredCount} keys recovered,{' '}
                    <span className={report.lostCount > 0 ? 'text-semantic-error font-extrabold' : 'text-semantic-success'}>
                      {report.lostCount} {report.lostCount === 1 ? 'write' : 'writes'} lost
                    </span>.
                  </p>
                  <p className="text-[14px] text-theme-muted">
                    Crash se pehle RAM me total {report.totalBeforeCrash} keys thi.
                  </p>
                  {report.lostKeys.length > 0 && (
                    <p className="font-mono text-[12.5px] text-semantic-error">
                      Lost keys (not in snapshot): {report.lostKeys.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : crashed ? (
            <div className="rounded-xl border border-semantic-error/50 bg-semantic-error-bg/40 p-4 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 text-semantic-error font-bold text-[15px]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <span>Server Crashed! Volatile RAM is completely wiped.</span>
              </div>
              <p className="text-[14px] text-theme-muted">
                Disk persistence engine check karega: RDB snapshot load hoga ya AOF log replay chalega. Upar <strong className="text-theme-text">Restart & Recover server</strong> dabao.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 text-[14px] leading-relaxed text-theme-muted flex flex-wrap items-center justify-between gap-2">
              <span>
                💡 <strong>Try this experiment:</strong> Write cart dabao, bina RDB save kiye crash karo, aur dekho RDB vs AOF mode me data bachta hai ya nahi!
              </span>
              <span className="font-mono text-[11px] text-theme-muted uppercase font-bold">
                writes pending crash: {writeCount}
              </span>
            </div>
          )}
        </div>

        {/* 3-Tier Persistence Architecture */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {/* Tier 1: Volatile RAM */}
          <article
            data-highlight-id="ram-card"
            className={`rounded-xl border bg-theme-bg p-4 shadow-2xs space-y-3 transition-colors ${
              crashed ? 'border-semantic-error/60 ring-1 ring-semantic-error/30' : 'border-theme-border'
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-theme-text">
                <Database className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                Tier 1: Volatile RAM
              </span>
              <span className="font-mono text-[11px] rounded bg-theme-surface-alt px-2 py-0.5 text-theme-muted font-bold">
                {snapshot.ramKeyCount} keys
              </span>
            </div>

            <p className="text-[13px] text-theme-muted">
              Sub-millisecond access · power loss / crash par 100% wipe.
            </p>

            <div className="h-[9.5rem] space-y-1.5 overflow-y-auto pr-0.5">
              {crashed ? (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-semantic-error/40 bg-semantic-error-bg/30 p-3 text-center">
                  <p className="text-[13.5px] font-bold text-semantic-error">RAM WIPED ON CRASH</p>
                  <p className="text-[12px] text-theme-muted mt-0.5">Memory empty. Restart required.</p>
                </div>
              ) : ramKeys.length === 0 ? (
                <p className="rounded-lg border border-dashed border-theme-border px-3 py-2 text-[13px] text-theme-muted">
                  Koi key nahi.
                </p>
              ) : (
                ramKeys.map(([key, value]) => (
                  <div
                    key={key}
                    data-highlight-id={`ram:${key}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5"
                  >
                    <code className="break-all font-mono text-[12px] font-semibold text-theme-text">
                      {key}
                    </code>
                    <span className="font-mono text-[12px] font-bold text-theme-text">
                      {value}
                    </span>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Tier 2: RDB Disk Snapshot */}
          <article
            data-highlight-id="rdb-snapshot"
            className="rounded-xl border border-theme-border bg-theme-bg p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-theme-text">
                <HardDrive className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                Tier 2: RDB Snapshot
              </span>
              <span className="font-mono text-[11px] rounded bg-theme-surface-alt px-2 py-0.5 text-theme-muted font-bold">
                {rdbKeys.length} keys
              </span>
            </div>

            <p className="text-[13px] text-theme-muted">
              Point-in-time image · snapshot ke baad ke writes disk par nahi hote.
            </p>

            <div className="h-[9.5rem] space-y-1.5 overflow-y-auto pr-0.5">
              {rdbKeys.length === 0 ? (
                <p className="rounded-lg border border-dashed border-theme-border px-3 py-2 text-[13px] text-theme-muted">
                  Snapshot abhi nahi hai.
                </p>
              ) : (
                rdbKeys.map(([key, value]) => (
                  <div
                    key={key}
                    data-highlight-id={`rdb:${key}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5"
                  >
                    <code className="break-all font-mono text-[12px] font-semibold text-theme-text">
                      {key}
                    </code>
                    <span className="font-mono text-[12px] font-bold text-theme-text">
                      {value}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="font-mono text-[11.5px] text-theme-muted pt-0.5">
              Snapshot saved at: <strong className="text-theme-text">t{snapshot.rdbSnapshot?.tick ?? '—'}</strong>
            </div>
          </article>

          {/* Tier 3: AOF Disk Log */}
          <article
            data-highlight-id="aof-disk"
            className="rounded-xl border border-theme-border bg-theme-bg p-4 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-theme-border/60 pb-2.5">
              <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-theme-text">
                <HardDrive className="h-4 w-4 text-theme-accent" aria-hidden="true" />
                Tier 3: AOF Log
              </span>
              <span className="font-mono text-[11px] rounded bg-theme-surface-alt px-2 py-0.5 text-theme-muted font-bold uppercase">
                {snapshot.aofEnabled ? `ON (${snapshot.fsyncPolicy})` : 'OFF'}
              </span>
            </div>

            <p className="text-[13px] text-theme-muted">
              Continuous append log · restart par har command replay hoti hai.
            </p>

            {!snapshot.aofEnabled ? (
              <div className="flex h-[9.5rem] items-center justify-center rounded-lg border border-dashed border-theme-border bg-theme-surface-alt/20 p-3 text-center text-[13px] text-theme-muted">
                AOF disabled hai. RDB-only mode me crash recovery sirf purane snapshot se hogi.
              </div>
            ) : (
              <div className="h-[9.5rem] space-y-1.5 overflow-y-auto pr-0.5">
                {aofDiskEntries.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-theme-border px-3 py-2 text-[13px] text-theme-muted">
                    Disk par koi append log nahi.
                  </p>
                ) : (
                  aofDiskEntries.map((entry) => (
                    <div
                      key={entry.id}
                      data-highlight-id={`aof:${entry.key}`}
                      className="rounded-lg border border-theme-border bg-theme-surface px-2.5 py-1.5 font-mono text-[11.5px]"
                    >
                      <div className="flex items-center justify-between text-theme-text font-bold">
                        <span>{entry.command} {entry.key}</span>
                        <span>{entry.value}</span>
                      </div>
                      <span className="text-[10px] text-semantic-success">
                        fsynced to disk (t{entry.tick})
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </article>
        </div>

        {/* Architecture Comparison */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-muted">
              📸 RDB Snapshot Mode
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Periodic photo. File compact hoti hai aur restart super-fast hota hai, lekin snapshot aur crash ke beech ke saare writes permanently lose ho jaate hain.
            </p>
          </div>
          <div className="rounded-xl border border-theme-border bg-theme-surface-alt/30 p-3.5 space-y-1">
            <p className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-theme-accent">
              📝 AOF Append-Log Mode
            </p>
            <p className="text-[14px] sm:text-[14.5px] text-theme-muted leading-relaxed">
              Continuous append log. Har write fsync ho kar disk par safe rehti hai. Restart par log replay hota hai — maximum durability, zero loss with <code className="font-mono text-[12px]">always</code>!
            </p>
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default RdbVsAofDemo;
