import React, { useState, useEffect } from 'react';
import { RotateCcw, Server, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface BrokerState {
  id: number;
  name: string;
  role: 'leader' | 'follower';
  status: 'online' | 'crashed' | 'lagging';
  log: number[]; // offsets replicated
}

export const AcksReplicationDemo: React.FC = () => {
  const [acks, setAcks] = useState<'0' | '1' | 'all'>('all');
  const minIsr = 2;

  const [brokers, setBrokers] = useState<BrokerState[]>([
    { id: 1, name: 'Broker 1', role: 'leader', status: 'online', log: [0, 1] },
    { id: 2, name: 'Broker 2', role: 'follower', status: 'online', log: [0, 1] },
    { id: 3, name: 'Broker 3', role: 'follower', status: 'online', log: [0, 1] },
  ]);

  const [highWatermark, setHighWatermark] = useState<number>(2);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  // Derive ISR (In-Sync Replicas)
  const isr = brokers.filter((b) => b.status === 'online');

  const [statusWhat, setStatusWhat] = useState<string>(
    'Cluster healthy: Broker 1 (Leader) write karta hai, Broker 2 & 3 (Followers) sync karte hain. ISR = [B1, B2, B3].'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'acks=all ensure karta hai ki write tabhi complete ho jab sabhi In-Sync Replicas data write kar lein.'
  );

  // Produce message with current acks setting
  const handleProduceMessage = () => {
    const leader = brokers.find((b) => b.role === 'leader');
    if (!leader || leader.status === 'crashed') {
      setStatusWhat('WRITE FAILED: Leader broker down hai! Naya leader elect hone ka wait karo.');
      setStatusWhy('Clients Kafka me sirf Partition Leader ko write request bhejte hain.');
      return;
    }

    const currentIsrCount = isr.length;
    if (acks === 'all' && currentIsrCount < minIsr) {
      setStatusWhat(
        `NOT_ENOUGH_REPLICAS: ISR count (${currentIsrCount}) < min.insync.replicas (${minIsr}). Write rejected!`
      );
      setStatusWhy('Data safety rule: Kafka partial replica set par write accept karne se mana kar deta hai.');
      return;
    }

    const nextOffset = leader.log.length;

    if (acks === '0') {
      // Fire and forget
      setBrokers((prev) =>
        prev.map((b) =>
          b.status === 'online' ? { ...b, log: [...b.log, nextOffset] } : b
        )
      );
      setHighWatermark(nextOffset + 1);
      setStatusWhat(`acks=0: Message bhejte hi client ko ACK mil gaya (offset ${nextOffset}). Risk: No guarantee!`);
      setStatusWhy('acks=0 sabse fast hai par agar broker network par fail ho to data lost ho jata hai.');
    } else if (acks === '1') {
      // Leader write only
      setBrokers((prev) =>
        prev.map((b) =>
          b.role === 'leader'
            ? { ...b, log: [...b.log, nextOffset] }
            : b.status === 'online'
            ? { ...b, log: [...b.log, nextOffset] }
            : b
        )
      );
      setHighWatermark(nextOffset);
      setStatusWhat(`acks=1: Leader (Broker 1) ne offset ${nextOffset} likh liya aur Client ko ACK de diya.`);
      setStatusWhy('Follower background me fetch karenge. Agar Leader replication se pehle crash ho gaya to data loss hoga.');
    } else {
      // acks=all
      setBrokers((prev) =>
        prev.map((b) =>
          b.status === 'online' ? { ...b, log: [...b.log, nextOffset] } : b
        )
      );
      setHighWatermark(nextOffset + 1);
      setStatusWhat(
        `acks=all: Offset ${nextOffset} Leader + ${currentIsrCount - 1} ISR Replicas me durable hone ke baad ACK mila.`
      );
      setStatusWhy('Zero Data Loss guarantee: High Watermark advance ho gaya, consumers ise safely read kar sakte hain.');
    }
  };

  // Crash Leader (Broker 1 or current leader)
  const handleCrashLeader = () => {
    const leader = brokers.find((b) => b.role === 'leader');
    if (!leader) return;

    // Elect new leader from remaining online ISR
    const availableFollower = brokers.find((b) => b.role === 'follower' && b.status === 'online');

    if (!availableFollower) {
      setBrokers((prev) =>
        prev.map((b) => (b.id === leader.id ? { ...b, status: 'crashed' } : b))
      );
      setStatusWhat(`CRITICAL: Leader ${leader.name} crashed aur koi ISR replica bacha nahi! Partition Offline.`);
      setStatusWhy('Production outage: Topic unavailable jab tak koi broker wapas online na aaye.');
      return;
    }

    setBrokers((prev) =>
      prev.map((b) => {
        if (b.id === leader.id) return { ...b, role: 'follower', status: 'crashed' };
        if (b.id === availableFollower.id) return { ...b, role: 'leader', status: 'online' };
        return b;
      })
    );

    setStatusWhat(
      `LEADER FAILOVER: ${leader.name} crash hua -> Controller ne ${availableFollower.name} ko naya LEADER elect kiya!`
    );
    setStatusWhy(
      'Kyunki acks=all use hua tha, naye leader ke paas sabhi committed offsets pehle se the. Zero data loss!'
    );
  };

  // Toggle Broker 3 Lag
  const handleToggleBroker3Lag = () => {
    setBrokers((prev) =>
      prev.map((b) => {
        if (b.id === 3) {
          const nextStatus = b.status === 'lagging' ? 'online' : 'lagging';
          return { ...b, status: nextStatus };
        }
        return b;
      })
    );

    const b3 = brokers.find((b) => b.id === 3);
    if (b3?.status === 'online') {
      setStatusWhat('Broker 3 network lag increase hua -> replica.lag.time.max.ms exceed hua -> ISR se BAHAR ho gaya!');
      setStatusWhy('Lagging replicas ko Kafka ISR se nikal deta hai taaki wo acks=all producer requests ko slow na karein.');
    } else {
      setStatusWhat('Broker 3 ne catch up kar liya -> ISR me wapas join ho gaya.');
      setStatusWhy('Replica jaise hi leader ke LEO ko catch up karta hai, Controller use ISR me re-add karta hai.');
    }
  };

  const handleReset = () => {
    setBrokers([
      { id: 1, name: 'Broker 1', role: 'leader', status: 'online', log: [0, 1] },
      { id: 2, name: 'Broker 2', role: 'follower', status: 'online', log: [0, 1] },
      { id: 3, name: 'Broker 3', role: 'follower', status: 'online', log: [0, 1] },
    ]);
    setHighWatermark(2);
    setAcks('all');
    setStatusWhat('Replication cluster reset ho gaya.');
    setStatusWhy('All 3 brokers online and in sync.');
  };

  // Keyboard accelerators
  useEffect(() => {
    const onPrimary = () => handleProduceMessage();
    const onReset = () => handleReset();
    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onReset);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onReset);
    };
  }, [acks, brokers]);

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Acks and replication
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Leader broker writes handle karta hai; acks=all aur ISR data loss rokte hain.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt border border-theme-border rounded-lg transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-theme-surface-alt text-theme-muted border border-theme-border">R</kbd>
        </button>
      </div>

      {/* 2. Status Banner: Ambient pulse beacon + clear Hinglish state */}
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
              {statusWhat}
            </div>
            {statusWhy && (
              <div className="text-xs text-theme-muted leading-normal font-medium">
                {statusWhy}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Primary Controls (4 to 5 direct verb buttons) */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleProduceMessage}
            className="px-4 py-2 bg-theme-primary text-theme-primary-text font-bold text-sm rounded-lg hover:bg-theme-primary-hover shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5"
          >
            <span>Produce message</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15 text-stone-900 border border-black/10">Space</kbd>
          </button>

          {/* Acks Dial */}
          <div className="flex items-center gap-1.5 bg-theme-surface-alt border border-theme-border rounded-lg p-1 text-xs">
            <span className="text-theme-muted font-medium px-1.5">acks:</span>
            {(['0', '1', 'all'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAcks(mode)}
                className={`px-2.5 py-1 rounded font-mono font-bold transition-colors ${
                  acks === mode
                    ? 'bg-amber-500 text-stone-900'
                    : 'bg-theme-surface hover:bg-theme-surface-alt text-theme-text'
                }`}
              >
                {mode === 'all' ? 'all (-1)' : mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCrashLeader}
            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Crash Leader Broker</span>
          </button>

          <button
            type="button"
            onClick={handleToggleBroker3Lag}
            className="px-3 py-2 bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text font-semibold text-xs rounded-lg transition-colors"
          >
            {brokers.find((b) => b.id === 3)?.status === 'lagging'
              ? 'Restore Broker 3 to ISR'
              : 'Simulate Broker 3 Lag (Drop from ISR)'}
          </button>
        </div>
      </section>

      {/* 4. ISR Cluster Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-theme-surface border border-theme-border rounded-xl text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-theme-muted">In-Sync Replicas (ISR):</span>
          <div className="flex gap-1.5">
            {brokers.map((b) => (
              <span
                key={b.id}
                className={`px-2 py-0.5 rounded border font-bold ${
                  b.status === 'online'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-400 text-rose-500 opacity-60'
                }`}
              >
                {b.name} {b.role === 'leader' ? '(Leader)' : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="text-theme-muted">
          min.insync.replicas: <b className="text-theme-text font-bold">{minIsr}</b> · High Watermark:{' '}
          <b className="text-theme-accent font-bold">off {highWatermark}</b>
        </div>
      </div>

      {/* 5. Brokers Visual Nodes */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {brokers.map((b) => {
          const isLeader = b.role === 'leader';
          const isLagging = b.status === 'lagging';

          return (
            <div
              key={b.id}
              className={`p-4 rounded-xl border transition-all ${
                b.status === 'crashed'
                  ? 'bg-rose-500/10 border-rose-300 dark:border-rose-900/50 opacity-60'
                  : isLeader
                  ? 'bg-theme-surface border-theme-primary ring-1 ring-theme-primary/50'
                  : 'bg-theme-surface border-theme-border'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-theme-border">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-theme-muted" />
                  <span className="font-bold text-sm text-theme-text font-mono">{b.name}</span>
                </div>
                {isLeader ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-stone-900 font-mono">
                    LEADER
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-muted font-mono">
                    FOLLOWER
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-theme-muted">Replicated Log:</span>
                  <span className="font-mono text-[11px] text-theme-accent">
                    LEO: {b.log.length}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1 min-h-[44px] no-scrollbar">
                  {b.log.length === 0 ? (
                    <span className="text-xs text-theme-muted italic">empty</span>
                  ) : (
                    b.log.map((off) => (
                      <span
                        key={off}
                        className={`px-2 py-1 rounded font-mono text-xs font-bold border ${
                          off < highWatermark
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-theme-surface-alt border-theme-border text-theme-muted'
                        }`}
                        title={off < highWatermark ? 'Committed in HW' : 'Uncommitted write'}
                      >
                        off {off}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-3 text-[11px] text-theme-muted border-t border-theme-border pt-2 flex items-center justify-between">
                <span>Status:</span>
                <span
                  className={`font-semibold ${
                    b.status === 'crashed'
                      ? 'text-rose-500'
                      : isLagging
                      ? 'text-amber-500'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {b.status === 'crashed'
                    ? 'CRASHED (Offline)'
                    : isLagging
                    ? 'LAGGING (OutOfSync)'
                    : 'IN-SYNC (ISR Member)'}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 6. Collapsed More Options Drawer */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 text-xs font-semibold text-theme-muted hover:text-theme-text flex items-center justify-between transition-colors"
        >
          <span>More options & state inspector</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border bg-theme-surface-alt space-y-3 font-mono text-xs">
            <pre className="p-3 bg-theme-bg border border-theme-border rounded-lg text-theme-text overflow-x-auto text-[11px] leading-relaxed">
              {JSON.stringify(
                {
                  acks,
                  minInsyncReplicas: minIsr,
                  highWatermark,
                  brokers,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default AcksReplicationDemo;
