import React, { useState, useEffect } from 'react';
import { RotateCcw, ArrowRight, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';

interface DLQMessage {
  id: string;
  offset: number;
  key: string;
  payload: string;
  isPoison: boolean;
  attempts: number;
}

export const RetriesDlqDemo: React.FC = () => {
  const [dlqEnabled, setDlqEnabled] = useState<boolean>(true);
  const [mainTopic, setMainTopic] = useState<DLQMessage[]>([
    { id: 'm0', offset: 0, key: 'o-1001', payload: '{"amount": 500, "status": "valid"}', isPoison: false, attempts: 0 },
    { id: 'm1', offset: 1, key: 'o-1002', payload: '{"corrupt_json": <MALFORMED_SYNTAX>}', isPoison: true, attempts: 0 },
    { id: 'm2', offset: 2, key: 'o-1003', payload: '{"amount": 1200, "status": "valid"}', isPoison: false, attempts: 0 },
    { id: 'm3', offset: 3, key: 'o-1004', payload: '{"amount": 350, "status": "valid"}', isPoison: false, attempts: 0 },
  ]);

  const [dlqTopic, setDlqTopic] = useState<DLQMessage[]>([]);
  const [committedOffset, setCommittedOffset] = useState<number>(0);
  const [currentAttempts, setCurrentAttempts] = useState<number>(0);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const currentMsg = mainTopic[committedOffset];

  const [statusWhat, setStatusWhat] = useState<string>(
    'Partition 0 me offset 1 par ek poison pill (corrupt JSON) message hai.'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Kafka me consumer message commit nahi karta to next poll par wahi message dobara aata hai (Head-of-Line blocking).'
  );

  // Process next message
  const handleProcessNext = () => {
    if (!currentMsg) {
      setStatusWhat('Main topic ke sabhi messages process ho chuke hain.');
      setStatusWhy('Partition healthy aur upto date hai.');
      return;
    }

    if (currentMsg.isPoison) {
      const nextAttempt = currentAttempts + 1;
      setCurrentAttempts(nextAttempt);

      if (nextAttempt < 3) {
        setStatusWhat(
          `EXCEPTION: Offset ${currentMsg.offset} (${currentMsg.key}) parse nahi ho paya! Retry ${nextAttempt}/3 (Backoff ${nextAttempt * 500}ms).`
        );
        setStatusWhy(
          'Transient error ke liye exponential backoff zaroori hota hai taaki database ya downstream recover ho sake.'
        );
      } else {
        // Max retries reached (3)
        if (dlqEnabled) {
          // Offload to DLQ topic and commit
          setDlqTopic((prev) => [
            ...prev,
            { ...currentMsg, attempts: nextAttempt },
          ]);
          setCommittedOffset((prev) => prev + 1);
          setCurrentAttempts(0);
          setStatusWhat(
            `DLQ OFFLOAD: Poison message ${currentMsg.key} ko orders.events.dlq me bhej diya aur offset commit kiya. Partition UNBLOCKED!`
          );
          setStatusWhy(
            'DLQ topic me poison messages store hote hain taaki engineers investigate kar sakein, aur main queue ka flow na ruke.'
          );
        } else {
          // Deadlock / Head of line blocking
          setStatusWhat(
            `HEAD-OF-LINE BLOCKING: DLQ disabled hai! Offset ${currentMsg.offset} fail hota rahega aur aage ke orders freeze rahenge!`
          );
          setStatusWhy(
            'Without DLQ, Kafka me ek corrupt message poori partition ko permanently deadlock kar deta hai.'
          );
        }
      }
    } else {
      // Valid message
      setCommittedOffset((prev) => prev + 1);
      setCurrentAttempts(0);
      setStatusWhat(`SUCCESS: Offset ${currentMsg.offset} (${currentMsg.key}) successfully processed and committed.`);
      setStatusWhy('Valid order processed smoothly.');
    }
  };

  // Add more valid orders
  const handleAddValidOrder = () => {
    setMainTopic((prev) => {
      const nextOff = prev.length;
      return [
        ...prev,
        {
          id: `m-${nextOff}`,
          offset: nextOff,
          key: `o-${1000 + nextOff}`,
          payload: `{"amount": ${500 + nextOff * 50}, "status": "valid"}`,
          isPoison: false,
          attempts: 0,
        },
      ];
    });
    setStatusWhat('Naya valid order produce hua.');
  };

  const handleReset = () => {
    setMainTopic([
      { id: 'm0', offset: 0, key: 'o-1001', payload: '{"amount": 500, "status": "valid"}', isPoison: false, attempts: 0 },
      { id: 'm1', offset: 1, key: 'o-1002', payload: '{"corrupt_json": <MALFORMED_SYNTAX>}', isPoison: true, attempts: 0 },
      { id: 'm2', offset: 2, key: 'o-1003', payload: '{"amount": 1200, "status": "valid"}', isPoison: false, attempts: 0 },
      { id: 'm3', offset: 3, key: 'o-1004', payload: '{"amount": 350, "status": "valid"}', isPoison: false, attempts: 0 },
    ]);
    setDlqTopic([]);
    setCommittedOffset(0);
    setCurrentAttempts(0);
    setStatusWhat('Topic reset ho gaya: Offset 1 par poison pill tayar hai.');
    setStatusWhy('Process dabao aur dekho 3 retries ke baad kya hota hai.');
  };

  // Keyboard accelerators
  useEffect(() => {
    const onPrimary = () => {
      if (committedOffset < mainTopic.length) {
        handleProcessNext();
      }
    };
    const onReset = () => handleReset();
    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onReset);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onReset);
    };
  }, [committedOffset, mainTopic, dlqEnabled, currentAttempts]);

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Retries and DLQ
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Poison message partition block kar deta hai jab tak retry backoff aur DLQ na ho.
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
            onClick={handleProcessNext}
            disabled={committedOffset >= mainTopic.length}
            className="px-4 py-2 bg-theme-primary text-theme-primary-text font-bold text-sm rounded-lg hover:bg-theme-primary-hover shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5"
          >
            <span>Process message</span>
            <ArrowRight className="w-4 h-4" />
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15 text-stone-900 border border-black/10">Space</kbd>
          </button>

          <button
            type="button"
            onClick={handleAddValidOrder}
            className="px-3.5 py-2 bg-theme-surface-alt hover:bg-theme-border border border-theme-border text-theme-text font-semibold text-xs rounded-lg transition-colors"
          >
            + Add valid order
          </button>

          {/* DLQ Policy Toggle */}
          <button
            type="button"
            onClick={() => setDlqEnabled(!dlqEnabled)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
              dlqEnabled
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                : 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>DLQ Pattern: {dlqEnabled ? 'ENABLED (Auto-offload)' : 'DISABLED (Blocking)'}</span>
          </button>
        </div>
      </section>

      {/* 4. Active Message Processing Card with Retry Gauge */}
      {currentMsg && (
        <section className="p-4 bg-theme-surface border border-theme-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-theme-muted">Consumer Current Focus:</span>
            <span className="text-theme-accent font-bold">
              Attempt: {currentAttempts} / 3 max
            </span>
          </div>

          <div
            className={`p-3 rounded-lg border font-mono text-xs flex flex-wrap items-center justify-between gap-2 ${
              currentMsg.isPoison
                ? 'bg-rose-500/10 border-rose-300 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
                : 'bg-theme-surface-alt border-theme-border text-theme-text'
            }`}
          >
            <div>
              <b className="text-sm">{currentMsg.key}</b> (offset {currentMsg.offset})
              <div className="text-[11px] opacity-80 mt-0.5">{currentMsg.payload}</div>
            </div>

            {currentMsg.isPoison && (
              <span className="px-2 py-0.5 bg-rose-500 text-white font-bold rounded text-[10px]">
                POISON PILL (CORRUPT)
              </span>
            )}
          </div>
        </section>
      )}

      {/* 5. Main Topic Partition vs DLQ Topic */}
      <div className="space-y-4">
        {/* Main Topic Log */}
        <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
              <span>Main Topic</span>
              <code className="text-xs px-2 py-0.5 bg-theme-surface-alt border border-theme-border rounded text-theme-accent font-mono font-bold">
                orders.events (Partition 0)
              </code>
            </h3>
            <span className="text-xs text-theme-muted font-mono">
              Committed offset: <b>{committedOffset}</b>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-2 min-h-[64px] no-scrollbar">
            {mainTopic.map((m) => {
              const isCommitted = m.offset < committedOffset;
              const isCurrent = m.offset === committedOffset;

              return (
                <div
                  key={m.id}
                  className={`flex-shrink-0 min-w-[95px] p-2 rounded-lg border font-mono text-xs relative select-none transition-all ${
                    isCurrent
                      ? 'ring-2 ring-amber-500 bg-amber-500/10 border-amber-500'
                      : isCommitted
                      ? 'bg-theme-surface-alt/70 border-emerald-500/30 opacity-60'
                      : 'bg-theme-surface-alt border-theme-border'
                  }`}
                >
                  {isCommitted && (
                    <span className="absolute top-1 right-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓
                    </span>
                  )}
                  <div className="font-bold text-theme-text truncate">{m.key}</div>
                  <div className="text-[10px] text-theme-muted mt-0.5">off {m.offset}</div>
                  {m.isPoison && (
                    <span className="text-[9px] text-rose-500 font-bold block mt-0.5">POISON</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* DLQ Topic */}
        <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-400">Dead Letter Queue Topic</span>
              <code className="text-xs px-2 py-0.5 bg-theme-surface-alt border border-theme-border rounded text-rose-600 dark:text-rose-400 font-mono font-bold">
                orders.events.dlq
              </code>
            </h3>
            <span className="text-xs text-theme-muted">
              Quarantined messages: <b>{dlqTopic.length}</b>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-2 min-h-[64px] no-scrollbar">
            {dlqTopic.length === 0 ? (
              <span className="text-xs text-theme-muted italic">
                Abhi koi poison message DLQ me nahi bheja gaya.
              </span>
            ) : (
              dlqTopic.map((m) => (
                <div
                  key={m.id}
                  className="flex-shrink-0 min-w-[120px] p-2 rounded-lg border border-rose-400 bg-rose-500/10 font-mono text-xs"
                >
                  <div className="font-bold text-rose-600 dark:text-rose-400">{m.key}</div>
                  <div className="text-[10px] text-theme-muted">from off {m.offset}</div>
                  <div className="text-[9px] text-rose-500 mt-1 font-semibold">
                    Failed after {m.attempts} attempts
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

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
                  dlqEnabled,
                  committedOffset,
                  currentAttempts,
                  mainTopicCount: mainTopic.length,
                  dlqTopicCount: dlqTopic.length,
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

export default RetriesDlqDemo;
