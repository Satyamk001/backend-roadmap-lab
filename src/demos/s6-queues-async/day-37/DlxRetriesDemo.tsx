import React, { useState, useCallback } from 'react';
import {
  RabbitMqDlxEngine,
  DlxSnapshot,
} from '../../../engine/rabbitmq/dlxEngine';
import { Send, ChevronDown, ChevronUp, AlertOctagon, RefreshCw, ShieldAlert, CheckCircle2, Clock, Info } from 'lucide-react';
import { DemoCommandDeck, DemoActionButton } from '../../../components/common/DemoCommandDeck';

export const DlxRetriesDemo: React.FC = () => {
  const [engine] = useState(() => new RabbitMqDlxEngine());
  const [snapshot, setSnapshot] = useState<DlxSnapshot>(() => engine.getSnapshot());
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handlePublishNormal = () => {
    engine.publish('normal');
    sync();
  };

  const handlePublishPoison = () => {
    engine.publish('poison');
    sync();
  };

  const handleStep = () => {
    engine.step();
    sync();
  };

  const handleReplay = (id: string) => {
    engine.replayDlq(id);
    sync();
  };

  const handleReset = () => {
    engine.reset();
    sync();
  };

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      <DemoCommandDeck
        title="Dead letter exchange (DLX) and retries"
        statusWhat={snapshot.statusMessage}
        statusWhy={snapshot.whyItMatters}
        onReset={handleReset}
        actions={
          <>
            <DemoActionButton
              onClick={handlePublishNormal}
              icon={<Send className="w-3.5 h-3.5" />}
              variant="secondary"
            >
              Normal Job
            </DemoActionButton>
            <DemoActionButton
              onClick={handlePublishPoison}
              icon={<AlertOctagon className="w-3.5 h-3.5 text-red-400" />}
              variant="danger"
            >
              Poison Pill
            </DemoActionButton>
            <DemoActionButton
              onClick={handleStep}
              icon={<Clock className="w-3.5 h-3.5" />}
              variant="primary"
            >
              Step Tick (#{snapshot.tick})
            </DemoActionButton>
          </>
        }
      />

      {/* Main DLX Architecture Canvas */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
        {/* Active Worker & In-flight Job */}
        <div className="p-3.5 rounded-xl bg-theme-surface-alt/60 border border-theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] text-theme-muted font-bold uppercase tracking-wider block">
              Active Consumer Worker
            </span>
            <div className="text-xs font-semibold text-theme-text">
              {snapshot.activeJob ? (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-theme-accent">{snapshot.activeJob.id}</span>
                  <span className="text-theme-muted">({snapshot.activeJob.payload})</span>
                </span>
              ) : (
                <span className="text-theme-muted italic">Idle (click 'Step Tick' to pick up next message)</span>
              )}
            </div>
          </div>

          {snapshot.activeJob && (
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                snapshot.activeJob.type === 'poison'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {snapshot.activeJob.type === 'poison' ? '🚨 FAILS ON EXECUTION' : '✓ HEALTHY'}
            </span>
          )}
        </div>

        {/* 3 Queue Lanes: Main Queue -> Retry Queue -> Dead Letter Queue */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Main Queue */}
          <div className="p-4 rounded-xl bg-theme-surface-alt/40 border border-theme-border flex flex-col justify-between h-full min-h-[240px] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-theme-text">1. Main Queue</span>
                <span className="text-[10px] font-mono text-theme-muted">{snapshot.mainQueue.length} waiting</span>
              </div>
              <div className="text-[11px] text-theme-muted mt-1">
                Argument: <code>x-dead-letter-exchange: orders.dlx</code>
              </div>
            </div>

            <div className="space-y-1.5 min-h-[120px] max-h-[160px] overflow-y-auto p-1">
              {snapshot.mainQueue.length === 0 ? (
                <div className="py-8 text-center text-xs text-theme-muted italic">Queue empty</div>
              ) : (
                snapshot.mainQueue.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between ${
                      m.type === 'poison'
                        ? 'bg-red-500/10 border-red-500/40 text-red-300'
                        : 'bg-theme-surface border-theme-border text-theme-text'
                    }`}
                  >
                    <span>{m.id}</span>
                    {m.deathCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-theme-accent">
                        attempt {m.deathCount + 1}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Delayed Retry Queue (TTL) */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 flex flex-col justify-between h-full min-h-[240px] space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-theme-accent flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  2. Retry Queue (TTL Backoff)
                </span>
                <span className="text-[10px] font-mono text-theme-accent">{snapshot.retryQueue.length} in delay</span>
              </div>
              <div className="text-[11px] text-theme-muted mt-1">
                Argument: <code>x-message-ttl: 2 ticks</code>
              </div>
            </div>

            <div className="space-y-1.5 min-h-[120px] max-h-[160px] overflow-y-auto p-1">
              {snapshot.retryQueue.length === 0 ? (
                <div className="py-8 text-center text-xs text-theme-muted italic">No delayed retries</div>
              ) : (
                snapshot.retryQueue.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-theme-surface border border-amber-500/40 text-xs font-mono flex items-center justify-between"
                  >
                    <span className="text-theme-accent font-semibold">{m.id}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-theme-accent animate-pulse">
                      TTL: {m.ttlRemaining} ticks left
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Dead Letter Queue (Quarantine) */}
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/30 flex flex-col justify-between h-full min-h-[240px] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-red-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                3. DLQ (Quarantine)
              </span>
              <span className="text-[10px] font-mono text-red-400 font-bold">{snapshot.dlq.length} quarantined</span>
            </div>
            <div className="text-[11px] text-theme-muted">
              Bound to: <code>orders.dlx (retries exhausted)</code>
            </div>

            <div className="space-y-1.5 min-h-[120px] max-h-[160px] overflow-y-auto p-1">
              {snapshot.dlq.length === 0 ? (
                <div className="py-8 text-center text-xs text-theme-muted italic">DLQ empty (clean)</div>
              ) : (
                snapshot.dlq.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-theme-surface border border-red-500/40 text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-red-400 font-bold">{m.id}</span>
                      <span className="text-[9px] px-1 rounded bg-red-500/20 text-red-400">POISON</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-theme-border">
                      <span className="text-[10px] text-theme-muted">x-death: {m.deathCount}</span>
                      <button
                        onClick={() => handleReplay(m.id)}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Replay
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Processed / Success Counter */}
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between text-xs">
          <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Healthy Jobs Processed & Acked:
          </span>
          <span className="font-mono font-bold text-emerald-400">{snapshot.completed.length} jobs</span>
        </div>
      </div>

      {/* Collapsible More Options */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden shadow-xs">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            More options (DLX Architecture Sequence & Headers)
          </span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border text-xs space-y-2 text-theme-muted">
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-1.5">
              <span className="font-bold text-theme-text block">RabbitMQ DLX Internals:</span>
              <div>• <b>x-dead-letter-exchange:</b> Queue banate waqt ye argument diya jaata hai jahan dead message route hota hai.</div>
              <div>• <b>x-death header:</b> RabbitMQ message headers me ek array jodta hai jisme original queue name, reason (rejected/expired/maxlen), aur death count store hota hai.</div>
              <div>• <b>No-Plugin Delayed Retry:</b> Queue TTL + DLX ke pattern se bina kisi third-party plugin ke perfectly reliable delayed retries banaye ja sakte hain.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DlxRetriesDemo;
