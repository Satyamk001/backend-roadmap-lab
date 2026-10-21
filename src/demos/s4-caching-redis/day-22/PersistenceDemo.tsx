import React, { useState, useMemo } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, Terminal, Layers, CheckCircle2, Circle, HardDrive, Cpu, AlertOctagon, RefreshCw, Zap } from 'lucide-react';
import { RedisPersistenceEngine, type FsyncPolicy, type PersistenceSnapshot } from '../../../engine/redis/persistence';

export const PersistenceDemo: React.FC = () => {
  const engine = useMemo(() => new RedisPersistenceEngine(), []);
  const [snapshot, setSnapshot] = useState<PersistenceSnapshot>(() => engine.getSnapshot());
  const [showEventLog, setShowEventLog] = useState<boolean>(false);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [showStateInspector, setShowStateInspector] = useState<boolean>(false);

  const sync = () => {
    setSnapshot(engine.getSnapshot());
  };

  // 5 Primary Actions
  const handleWrite = () => {
    const candidates = [
      { key: 'order:4012', val: 'confirmed' },
      { key: 'pay:txn_99', val: 'success' },
      { key: 'user:session_x', val: 'logged_in' },
      { key: 'views:banner', val: '42' },
      { key: 'cart:u101', val: 'item_3' },
    ];
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    engine.write('SET', picked.key, picked.val);
    sync();
  };

  const handleBgsave = () => {
    engine.triggerBgsave();
    sync();
  };

  const handleFsync = () => {
    engine.flushAofBuffer();
    sync();
  };

  const handleCrash = () => {
    engine.crashServer();
    sync();
  };

  const handleRestart = () => {
    engine.restartServer();
    sync();
  };

  const handleRewriteAof = () => {
    engine.triggerAofRewrite();
    sync();
  };

  const handleFsyncPolicyChange = (policy: FsyncPolicy) => {
    engine.setFsyncPolicy(policy);
    sync();
  };

  const handleReset = () => {
    engine.reset();
    sync();
  };

  // Challenges
  const challenge1Pass = useMemo(() => {
    return snapshot.bgsaveCount >= 1 && snapshot.rdbSnapshot !== null;
  }, [snapshot]);

  const challenge2Pass = useMemo(() => {
    return snapshot.lastCrashReport !== undefined && snapshot.lastCrashReport.recoveredSource === 'AOF';
  }, [snapshot]);

  const challenge3Pass = useMemo(() => {
    return snapshot.aofBaseSnapshot !== null;
  }, [snapshot]);

  const isCrashed = snapshot.serverStatus === 'crashed';

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            RDB and AOF persistence
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Point-in-time snapshots (RDB fork/COW), write-ahead append log (AOF fsync policies), and crash recovery replay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt border border-theme-border rounded-lg transition-colors flex items-center gap-1.5 text-theme-text"
            title="Reset persistence engine"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. "What just happened?" status banner */}
      <div
        role="status"
        aria-live="polite"
        className={`relative overflow-hidden px-4 py-3 bg-theme-surface border rounded-xl shadow-xs transition-all ${
          isCrashed ? 'border-red-500/60' : 'border-theme-border'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex items-center justify-center shrink-0">
            {isCrashed ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            ) : (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-theme-primary"></span>
              </span>
            )}
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-sm sm:text-base font-bold text-theme-text leading-snug">
              {snapshot.whatJustHappened}
            </div>
            <div className="text-xs text-theme-muted mt-1 leading-normal font-medium">
              {snapshot.whyItMatters}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Primary Controls Bar (Max 5 primary action buttons) */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-theme-surface border border-theme-border rounded-xl shadow-xs">
        <button
          type="button"
          onClick={handleWrite}
          disabled={isCrashed}
          className="px-3 py-2 text-xs font-bold rounded-lg bg-theme-primary text-theme-primary-text hover:bg-theme-primary-hover disabled:opacity-40 transition-colors shadow-xs"
          title="Write key to RAM and AOF buffer"
        >
          Write to Redis
        </button>

        <button
          type="button"
          onClick={handleBgsave}
          disabled={isCrashed}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border disabled:opacity-40 text-theme-text transition-colors flex items-center gap-1.5"
          title="Trigger BGSAVE snapshot"
        >
          <HardDrive className="w-3.5 h-3.5 text-sky-500" />
          <span>BGSAVE (RDB Snapshot)</span>
        </button>

        <button
          type="button"
          onClick={handleFsync}
          disabled={isCrashed || snapshot.aofBuffer.length === 0}
          className="px-3 py-2 text-xs font-semibold rounded-lg bg-theme-surface-alt hover:bg-theme-border border border-theme-border disabled:opacity-40 text-theme-text transition-colors flex items-center gap-1.5"
          title="Flush buffer to disk (fsync)"
        >
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Flush AOF (fsync)</span>
          {snapshot.aofBuffer.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-theme-accent font-bold">
              {snapshot.aofBuffer.length}
            </span>
          )}
        </button>

        {!isCrashed ? (
          <button
            type="button"
            onClick={handleCrash}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors flex items-center gap-1.5 ml-auto"
            title="Simulate sudden kill -9 / power outage"
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            <span>Crash Redis (kill -9)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRestart}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 shadow-sm ml-auto animate-pulse"
            title="Restart server and recover from disk"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restart &amp; Recover</span>
          </button>
        )}
      </div>

      {/* 4. Interactive Architecture Canvas: RAM vs RDB vs AOF */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Volatile RAM */}
        <div className={`bg-theme-surface border rounded-xl p-4 shadow-xs space-y-3 transition-colors ${
          isCrashed ? 'border-red-500/40 bg-red-500/5' : 'border-theme-border'
        }`}>
          <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-theme-primary" />
              <h3 className="text-sm font-bold text-theme-text">Volatile RAM</h3>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              isCrashed
                ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}>
              {snapshot.serverStatus}
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-theme-muted">
              <span>Keys in memory:</span>
              <b className="text-theme-text">{snapshot.ramKeyCount}</b>
            </div>
            {snapshot.cowOverheadBytes > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 text-[11px]">
                <span>Fork COW overhead:</span>
                <b>+{snapshot.cowOverheadBytes} B</b>
              </div>
            )}
          </div>

          {/* RAM keys list */}
          <div className="space-y-1.5 pt-1">
            {isCrashed ? (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center text-xs text-red-600 dark:text-red-400 font-medium">
                RAM is wiped to 0 B!
                <div className="text-[11px] text-theme-muted mt-1">
                  Power lost. Restart Redis to recover from disk files.
                </div>
              </div>
            ) : snapshot.ramKeyCount === 0 ? (
              <div className="p-4 text-center text-xs text-theme-muted italic">
                RAM khaali hai. Write command chalayein.
              </div>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {Object.entries(snapshot.ramKeys).map(([k, v]) => (
                  <div
                    key={k}
                    className="p-2 bg-theme-surface-alt rounded border border-theme-border flex items-center justify-between text-xs font-mono"
                  >
                    <span className="font-bold text-theme-accent">{k}</span>
                    <span className="text-theme-text font-semibold truncate max-w-[100px]">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: RDB Snapshot File */}
        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-bold text-theme-text">RDB Snapshot</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-muted">
              dump.rdb
            </span>
          </div>

          <div className="space-y-1 text-xs text-theme-muted">
            <div className="flex justify-between font-mono">
              <span>Last Snapshot:</span>
              <b className="text-theme-text">{snapshot.rdbSnapshot?.timestamp ?? 'Never'}</b>
            </div>
            <div className="flex justify-between font-mono">
              <span>Keys in RDB:</span>
              <b className="text-theme-text">{snapshot.rdbSnapshot?.keyCount ?? 0}</b>
            </div>
            <div className="flex justify-between font-mono">
              <span>File size:</span>
              <b className="text-theme-text">{snapshot.rdbSnapshot?.sizeBytes ?? 0} B</b>
            </div>
          </div>

          <div className="p-2.5 bg-theme-surface-alt rounded-lg border border-theme-border/70 text-[11px] text-theme-muted leading-relaxed space-y-1">
            <div className="font-bold text-theme-text">📸 RDB Nature (Photo):</div>
            <p>Periodic binary snapshot. Restart par bahut fast load hoti hai, par snapshot lene ke baad ke writes crash me <b>lost</b> ho jaate hain.</p>
          </div>
        </div>

        {/* Column 3: AOF Append Log File */}
        <div className="bg-theme-surface border border-theme-border rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-theme-text">AOF Append Log</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-muted">
              appendonlydir
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-theme-muted">
              <span>Pending in buffer:</span>
              <b className={snapshot.aofBuffer.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-theme-text'}>
                {snapshot.aofBuffer.length} commands
              </b>
            </div>
            <div className="flex justify-between text-theme-muted">
              <span>Persisted on disk:</span>
              <b className="text-theme-text">{snapshot.aofDiskFile.length} entries</b>
            </div>
            <div className="flex justify-between text-theme-muted">
              <span>fsync policy:</span>
              <b className="text-theme-accent">{snapshot.fsyncPolicy}</b>
            </div>
          </div>

          <div className="p-2.5 bg-theme-surface-alt rounded-lg border border-theme-border/70 text-[11px] text-theme-muted leading-relaxed space-y-1">
            <div className="font-bold text-theme-text">📝 AOF Nature (Diary):</div>
            <p>Continuous append log. Crash ke dauran max ~1 second data loss window (everysec). Restart par har command dobara replay hoti hai.</p>
          </div>
        </div>
      </div>

      {/* 5. Collapsible Event Log */}
      <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-surface shadow-xs">
        <button
          type="button"
          onClick={() => setShowEventLog(!showEventLog)}
          className="w-full flex items-center justify-between p-3.5 bg-theme-surface-alt hover:bg-theme-border/40 text-sm font-semibold text-theme-text transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-theme-muted" />
            <span className="font-bold">Persistence engine lifecycle log</span>
            <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-theme-surface border border-theme-border text-theme-muted">
              {snapshot.eventLog.length} events
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-theme-muted">
            <span>{showEventLog ? 'Hide log' : 'Show log'}</span>
            {showEventLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showEventLog && (
          <div className="p-4 border-t border-theme-border space-y-2">
            <ul className="space-y-1 font-mono text-xs max-h-48 overflow-y-auto divide-y divide-theme-border/40 text-theme-text">
              {snapshot.eventLog.map((log) => (
                <li key={log.id} className="py-1 flex items-start gap-2">
                  <span className="text-theme-muted text-[10px] w-12 flex-shrink-0">T+{log.tick}</span>
                  <span
                    className={`font-bold flex-shrink-0 text-[10px] px-1.5 py-0.2 rounded border ${
                      log.source === 'CRASH'
                        ? 'text-red-600 dark:text-red-400 border-red-500/30'
                        : log.source === 'RECOVERY'
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : log.source === 'RDB'
                        ? 'text-sky-600 dark:text-sky-400 border-sky-500/30'
                        : 'text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {log.source}
                  </span>
                  <span className="text-theme-text break-words">{log.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 6. Collapsed "More Options" Row (Fsync Tuning, BGREWRITEAOF, Challenges) */}
      <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-surface">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between p-3 bg-theme-surface-alt hover:bg-theme-border/50 text-xs font-semibold text-theme-text transition-colors select-none"
        >
          <span>More options (fsync tuning, BGREWRITEAOF, &amp; challenges)</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 space-y-4 border-t border-theme-border text-xs">
            {/* Fsync tuning & Rewrite */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-theme-surface-alt rounded-lg border border-theme-border">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-theme-text">appendfsync:</span>
                {(['everysec', 'always', 'no'] as FsyncPolicy[]).map((pol) => (
                  <button
                    key={pol}
                    type="button"
                    onClick={() => handleFsyncPolicyChange(pol)}
                    className={`px-2.5 py-1 rounded font-mono text-xs font-semibold transition-colors ${
                      snapshot.fsyncPolicy === pol
                        ? 'bg-theme-primary text-theme-primary-text shadow-xs'
                        : 'bg-theme-surface border border-theme-border text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    {pol}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleRewriteAof}
                disabled={isCrashed}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-theme-surface border border-theme-border hover:bg-theme-border text-theme-text disabled:opacity-40 transition-colors"
                title="BGREWRITEAOF compacts history log"
              >
                Trigger BGREWRITEAOF (Compaction)
              </button>
            </div>

            {/* Challenges */}
            <div className="space-y-2">
              <h4 className="font-bold text-theme-text uppercase tracking-wider text-[11px]">
                🎯 Hands-on Durability Challenges
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {challenge1Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-theme-muted" />
                    )}
                    <span className={challenge1Pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'}>
                      1. Photo Snapshot
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    BGSAVE chala kar ek fresh RDB point-in-time snapshot file disk par record karo.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {challenge2Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-theme-muted" />
                    )}
                    <span className={challenge2Pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'}>
                      2. Crash &amp; Full Replay
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    Flush AOF karein, Crash karein, aur Restart karke AOF replay se data wapas layein.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    {challenge3Pass ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-theme-muted" />
                    )}
                    <span className={challenge3Pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme-text'}>
                      3. AOF Log Compaction
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    BGREWRITEAOF chala kar saare purane incremental writes ko ek compact base me merge karein.
                  </p>
                </div>
              </div>
            </div>

            {/* State Inspector */}
            <div className="pt-2 border-t border-theme-border">
              <button
                type="button"
                onClick={() => setShowStateInspector(!showStateInspector)}
                className="flex items-center gap-1.5 text-xs text-theme-accent font-semibold hover:underline"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{showStateInspector ? 'Hide raw persistence snapshot' : 'Inspect raw persistence JSON snapshot'}</span>
              </button>

              {showStateInspector && (
                <pre className="mt-2 p-3 bg-stone-900 text-stone-100 rounded-lg text-[11px] font-mono max-h-60 overflow-auto border border-theme-border">
                  {JSON.stringify(snapshot, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersistenceDemo;
