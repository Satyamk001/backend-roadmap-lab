import React, { useState, useCallback } from 'react';
import {
  RabbitMqConsumerAckEngine,
  AckDemoSnapshot,
} from '../../../engine/rabbitmq/consumerAckEngine';
import { Send, RotateCcw, ChevronDown, ChevronUp, Check, X, Skull, ShieldCheck, AlertOctagon, Info } from 'lucide-react';

export const ConsumerAcksDemo: React.FC = () => {
  const [engine] = useState(() => new RabbitMqConsumerAckEngine(false));
  const [snapshot, setSnapshot] = useState<AckDemoSnapshot>(() => engine.getSnapshot());
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const sync = useCallback(() => {
    setSnapshot(engine.getSnapshot());
  }, [engine]);

  const handlePublish = () => {
    engine.publish(`Order payment #${Math.floor(1000 + Math.random() * 9000)}`);
    engine.dispatchNext();
    sync();
  };

  const handleAck = (workerId: string) => {
    engine.ack(workerId);
    engine.dispatchNext(); // Try dispatching next if available
    sync();
  };

  const handleNackRequeue = (workerId: string) => {
    engine.nack(workerId, true);
    sync();
  };

  const handleNackDlq = (workerId: string) => {
    engine.nack(workerId, false);
    sync();
  };

  const handleCrash = (workerId: string) => {
    engine.crashWorker(workerId);
    sync();
  };

  const handleRecover = (workerId: string) => {
    engine.recoverWorker(workerId);
    engine.dispatchNext();
    sync();
  };

  const handleToggleAutoAck = () => {
    engine.setAutoAck(!snapshot.autoAck);
    sync();
  };

  const handleReset = () => {
    engine.reset();
    sync();
  };

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Consumer acks and redelivery
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Manual ack vs auto-ack, worker crash par redelivered flag ke saath safe redelivery.
          </p>
        </div>
      </div>

      {/* "What just happened?" status line */}
      <div
        role="status"
        aria-live="polite"
        className="relative overflow-hidden px-4 py-3 bg-theme-surface border border-theme-border rounded-xl shadow-xs transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 flex items-center justify-center shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-theme-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-theme-primary"></span>
            </span>
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="text-sm sm:text-base font-bold text-theme-text leading-snug">
              {snapshot.statusMessage}
            </div>
            <div className="text-xs text-theme-muted mt-1 leading-normal font-medium">
              💡 {snapshot.whyItMatters}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Controls (Max 5 controls) */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePublish}
              className="px-3.5 py-1.5 bg-theme-primary text-black font-bold rounded-lg text-xs flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Publish Task
            </button>

            {/* Toggle AutoAck vs Manual */}
            <button
              onClick={handleToggleAutoAck}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                snapshot.autoAck
                  ? 'bg-amber-500/20 text-theme-accent border-theme-accent'
                  : 'bg-theme-surface text-emerald-400 border-emerald-500/40'
              }`}
            >
              Mode: {snapshot.autoAck ? '⚡ Auto-ack (noAck: true)' : '🛡️ Manual Ack (Safe)'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-1.5 bg-theme-surface border border-theme-border text-theme-muted hover:text-theme-text rounded-lg text-xs transition-all"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Simulation Canvas */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
        {/* Workers Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">
              Consumer Workers ({snapshot.workers.length})
            </h3>
            <span className="text-[11px] text-theme-muted font-mono">
              Unacked In-flight: {snapshot.unackedMessages.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshot.workers.map((worker) => {
              const activeMsg = snapshot.unackedMessages.find(
                (m) => m.assignedConsumerId === worker.id
              );

              return (
                <div
                  key={worker.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    worker.status === 'crashed'
                      ? 'bg-red-500/10 border-red-500/50'
                      : worker.status === 'processing'
                      ? 'bg-theme-surface-alt/70 border-theme-border shadow-xs'
                      : 'bg-theme-surface border-theme-border opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-theme-text">{worker.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          worker.status === 'crashed'
                            ? 'bg-red-500/20 text-red-400'
                            : worker.status === 'processing'
                            ? 'bg-amber-500/20 text-theme-accent'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {worker.status.toUpperCase()}
                      </span>
                    </div>

                    {worker.status === 'crashed' ? (
                      <button
                        onClick={() => handleRecover(worker.id)}
                        className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors"
                      >
                        Recover
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCrash(worker.id)}
                        className="px-2 py-1 rounded bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition-colors flex items-center gap-1"
                        title="Simulate process crash before ack"
                      >
                        <Skull className="w-3.5 h-3.5" />
                        Crash
                      </button>
                    )}
                  </div>

                  {/* Active Message card */}
                  <div className="p-3 rounded-lg bg-theme-surface border border-theme-border min-h-[64px] flex items-center justify-between">
                    {activeMsg ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-theme-text">{activeMsg.id}</span>
                          {activeMsg.redelivered && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-violet-500/20 text-violet-400 border border-violet-500/40">
                              REDELIVERED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-theme-muted">{activeMsg.payload}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-theme-muted italic">
                        {worker.status === 'crashed' ? 'Worker crashed (offline)' : 'Idle (waiting for messages)'}
                      </span>
                    )}

                    {activeMsg && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-theme-surface-alt text-theme-muted">
                        Tag: {activeMsg.deliveryTag}
                      </span>
                    )}
                  </div>

                  {/* Worker Action Buttons */}
                  {worker.status === 'processing' && activeMsg && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleAck(worker.id)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-500/30 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Ack (Success)
                      </button>
                      <button
                        onClick={() => handleNackRequeue(worker.id)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/40 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-violet-500/30 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Nack (Requeue)
                      </button>
                      <button
                        onClick={() => handleNackDlq(worker.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold hover:bg-red-500/25 transition-all"
                        title="Nack with requeue=false (forward to DLX)"
                      >
                        DLX
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Queues & History Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-theme-border">
          {/* 1. Ready Queue */}
          <div className="p-3.5 rounded-xl bg-theme-surface-alt/40 border border-theme-border space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-theme-text">Ready Queue (Buffer)</span>
              <span className="font-mono text-theme-muted">{snapshot.readyQueue.length} msgs</span>
            </div>
            <div className="min-h-[100px] max-h-[140px] overflow-y-auto space-y-1.5 p-1">
              {snapshot.readyQueue.length === 0 ? (
                <div className="py-6 text-center text-xs text-theme-muted italic">Queue empty</div>
              ) : (
                snapshot.readyQueue.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-theme-surface border border-theme-border text-xs flex items-center justify-between font-mono"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-theme-accent font-bold">{m.id}</span>
                      {m.redelivered && (
                        <span className="px-1 text-[9px] bg-violet-500/20 text-violet-400 rounded">RETRY</span>
                      )}
                    </div>
                    <span className="text-theme-muted text-[10px]">tag:{m.deliveryTag}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. Acked (Deleted) */}
          <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Acked (Safely Deleted)
              </span>
              <span className="font-mono text-emerald-400">{snapshot.ackedMessages.length}</span>
            </div>
            <div className="min-h-[100px] max-h-[140px] overflow-y-auto space-y-1.5 p-1">
              {snapshot.ackedMessages.length === 0 ? (
                <div className="py-6 text-center text-xs text-theme-muted italic">No acked messages yet</div>
              ) : (
                snapshot.ackedMessages.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-theme-surface border border-theme-border text-xs flex items-center justify-between font-mono"
                  >
                    <span className="text-emerald-400 font-semibold">{m.id}</span>
                    <span className="text-theme-muted text-[10px]">deleted</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. Lost Messages / DLX */}
          <div className="p-3.5 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-red-400 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" />
                Lost on Crash (Auto-ack)
              </span>
              <span className="font-mono text-red-400">{snapshot.lostMessages.length}</span>
            </div>
            <div className="min-h-[100px] max-h-[140px] overflow-y-auto space-y-1.5 p-1">
              {snapshot.lostMessages.length === 0 ? (
                <div className="py-6 text-center text-xs text-theme-muted italic">No messages lost</div>
              ) : (
                snapshot.lostMessages.map((m) => (
                  <div
                    key={m.id}
                    className="p-2 rounded-lg bg-theme-surface border border-red-500/40 text-xs flex items-center justify-between font-mono"
                  >
                    <span className="text-red-400 font-bold">{m.id}</span>
                    <span className="text-red-400 text-[10px]">LOST</span>
                  </div>
                ))
              )}
            </div>
          </div>
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
            More options (Ack Lifecycle Deep Dive & State)
          </span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border text-xs space-y-3">
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-1.5">
              <span className="font-bold text-theme-text block">RabbitMQ Acknowledgment Golden Rules:</span>
              <ul className="list-disc list-inside space-y-1 text-theme-muted leading-relaxed">
                <li><b>Pehle business logic, phir ack:</b> Agar pehle ack kiya aur DB fail ho gaya, toh message lost ho jaata hai.</li>
                <li><b>Delivery Tag Channel-Scoped hai:</b> Jis channel par message mila hai, ack hamesha usi channel par bhejna zaroori hai.</li>
                <li><b>Double ack is Fatal:</b> Ek hi delivery tag par do baar ack call karne se <code>PRECONDITION_FAILED</code> channel error aati hai aur channel band ho jaata hai.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsumerAcksDemo;
