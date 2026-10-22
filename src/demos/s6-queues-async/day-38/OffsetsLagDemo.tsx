import React, { useState, useEffect } from 'react';
import { FastForward, Rewind, ChevronDown, ChevronUp } from 'lucide-react';
import { DemoCommandDeck } from '../../../components/common/DemoCommandDeck';

interface OffsetMessage {
  id: string;
  offset: number;
  key: string;
  payload: string;
  timestamp: string;
}

export const OffsetsLagDemo: React.FC = () => {
  const [messages, setMessages] = useState<OffsetMessage[]>([
    { id: 'm0', offset: 0, key: 'o-1001', payload: 'order.created', timestamp: '12:00:01' },
    { id: 'm1', offset: 1, key: 'o-1001', payload: 'order.paid', timestamp: '12:00:02' },
    { id: 'm2', offset: 2, key: 'o-1002', payload: 'order.created', timestamp: '12:00:05' },
    { id: 'm3', offset: 3, key: 'o-1003', payload: 'order.created', timestamp: '12:00:08' },
    { id: 'm4', offset: 4, key: 'o-1002', payload: 'order.paid', timestamp: '12:00:10' },
  ]);

  const [committedOffset, setCommittedOffset] = useState<number>(2);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const leo = messages.length; // Log End Offset
  const lag = Math.max(0, leo - committedOffset);

  const [statusWhat, setStatusWhat] = useState<string>(
    `Log End Offset = ${leo}, Committed Offset = ${committedOffset} -> Consumer Lag = ${lag} messages.`
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Lag = LEO - Committed Offset. Ye batata hai ki consumer kitne messages peeche chal raha hai.'
  );

  // Produce burst
  const handleProduceBurst = () => {
    setMessages((prev) => {
      const nextOff = prev.length;
      const newBatch: OffsetMessage[] = [
        {
          id: `m-${nextOff}`,
          offset: nextOff,
          key: `o-${1000 + nextOff}`,
          payload: 'order.created',
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          id: `m-${nextOff + 1}`,
          offset: nextOff + 1,
          key: `o-${1000 + nextOff}`,
          payload: 'order.paid',
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          id: `m-${nextOff + 2}`,
          offset: nextOff + 2,
          key: `o-${1001 + nextOff}`,
          payload: 'order.created',
          timestamp: new Date().toLocaleTimeString(),
        },
      ];
      const updated = [...prev, ...newBatch];
      const newLag = updated.length - committedOffset;
      setStatusWhat(`Producer ne 3 naye messages append kiye -> LEO ${nextOff + 3} ho gaya, Lag badhkar ${newLag} hua!`);
      setStatusWhy('Producer fast hai aur consumer abhi process nahi kar paya, isliye lag badh gaya.');
      return updated;
    });
  };

  // Poll & Commit 1 message
  const handlePollAndCommit = () => {
    if (committedOffset >= messages.length) {
      setStatusWhat('Sabhi messages process ho chuke hain (Lag = 0).');
      setStatusWhy('Log me koi uncommitted message nahi bacha.');
      return;
    }

    const nextCommit = committedOffset + 1;
    setCommittedOffset(nextCommit);
    const newLag = messages.length - nextCommit;
    setStatusWhat(`Consumer ne offset ${committedOffset} process kiya -> Commit advanced to ${nextCommit} (Lag: ${newLag}).`);
    setStatusWhy('Commit hamesha NEXT offset hota hai jahan se consumer restart par read karega.');
  };

  // Consume all (drain backlog)
  const handleDrainLag = () => {
    setCommittedOffset(messages.length);
    setStatusWhat(`Consumer ne backlog clear kar diya: Committed Offset = ${messages.length} (Lag = 0).`);
    setStatusWhy('Consumer caught up with producer. Zero lag matlab real-time processing.');
  };

  // Reset offset to earliest (replay)
  const handleResetEarliest = () => {
    setCommittedOffset(0);
    setStatusWhat(`Offset reset to EARLIEST (offset = 0) -> Lag badhkar ${messages.length} ho gaya!`);
    setStatusWhy('Kafka me purane messages delete nahi hote. Offset 0 karke poori history dobara replay ki ja sakti hai.');
  };

  // Reset offset to latest (skip backlog)
  const handleResetLatest = () => {
    setCommittedOffset(messages.length);
    setStatusWhat(`Offset reset to LATEST (offset = ${messages.length}) -> Lag = 0.`);
    setStatusWhy('Purane unread messages skip kar diye aur consumer seedha naye incoming events par aa gaya.');
  };

  const handleResetAll = () => {
    setMessages([
      { id: 'm0', offset: 0, key: 'o-1001', payload: 'order.created', timestamp: '12:00:01' },
      { id: 'm1', offset: 1, key: 'o-1001', payload: 'order.paid', timestamp: '12:00:02' },
      { id: 'm2', offset: 2, key: 'o-1002', payload: 'order.created', timestamp: '12:00:05' },
    ]);
    setCommittedOffset(1);
    setStatusWhat('Topic aur offsets reset ho gaye.');
    setStatusWhy('Fresh simulation state.');
  };

  // Keyboard accelerators
  useEffect(() => {
    const onPrimary = () => handleProduceBurst();
    const onReset = () => handleResetAll();
    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onReset);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onReset);
    };
  }, [handleProduceBurst]);

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      <DemoCommandDeck
        title="Offsets and lag"
        statusWhat={statusWhat}
        statusWhy={statusWhy}
        onReset={handleResetAll}
      />

      {/* 3. Primary Controls (4 to 5 direct verb buttons) */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleProduceBurst}
              className="px-4 py-2 bg-theme-primary text-theme-primary-text font-bold text-xs rounded-lg hover:bg-theme-primary-hover shadow-sm active:translate-y-0.5 transition-all flex items-center gap-1.5"
            >
              <span>Produce 3 messages (LEO ↑)</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/15 text-stone-900 border border-black/10">Space</kbd>
            </button>

            <button
              type="button"
              onClick={handlePollAndCommit}
              disabled={committedOffset >= messages.length}
              className="px-3.5 py-2 bg-theme-surface-alt hover:bg-theme-border disabled:opacity-40 text-theme-text font-semibold text-xs rounded-lg border border-theme-border transition-colors"
            >
              Poll & commit 1 msg (Lag ↓)
            </button>

            <button
              type="button"
              onClick={handleDrainLag}
              disabled={lag === 0}
              className="px-3 py-2 bg-theme-surface-alt hover:bg-theme-border disabled:opacity-40 text-theme-text font-semibold text-xs rounded-lg border border-theme-border transition-colors"
            >
              Drain all lag (Catch up)
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={handleResetEarliest}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-theme-border bg-theme-surface-alt hover:bg-theme-border flex items-center gap-1 text-theme-text"
              title="Reset offset to earliest (replay history)"
            >
              <Rewind className="w-3.5 h-3.5" />
              <span>auto.offset.reset = earliest</span>
            </button>

            <button
              type="button"
              onClick={handleResetLatest}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-theme-border bg-theme-surface-alt hover:bg-theme-border flex items-center gap-1 text-theme-text"
              title="Reset offset to latest (skip lag)"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>latest</span>
            </button>
          </div>
        </div>
      </section>

      {/* Concept Quick-Guide: Offset, Bookmark aur Lag ka seedha funda */}
      <div className="p-3 bg-theme-surface-alt/70 border border-theme-border rounded-xl text-xs space-y-1.5">
        <div className="font-bold text-theme-text flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Ek Line Me: Offset, Bookmark aur Lag ka matlab</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-[11px] leading-relaxed">
          <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-0.5">
            <strong className="text-theme-text font-bold block">📖 Offset (Page Number)</strong>
            <span className="text-theme-muted block">Partition ek notebook register hai. Message ka index (0, 1, 2...) permanent page number hai jo kabhi change nahi hota.</span>
          </div>
          <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-0.5">
            <strong className="text-theme-text font-bold block">🔖 Committed (Bookmark)</strong>
            <span className="text-theme-muted block">Consumer ka bookmark. <code>offset {committedOffset}</code> ka matlab: consumer yahan tak process karke bookmark laga chuka hai.</span>
          </div>
          <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-0.5">
            <strong className="text-theme-text font-bold block">⏳ Lag (Pending Homework)</strong>
            <span className="text-theme-muted block"><code>Lag = LEO - Committed</code>. Kitne pages padhna baaki hain. <code>lag = 0</code> matlab consumer upto date hai!</span>
          </div>
        </div>
      </div>

      {/* 4. Offset Metrics Board: LEO vs Committed vs Lag */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-theme-surface border border-theme-border rounded-xl flex flex-col justify-between min-h-[96px]">
          <div>
            <div className="text-xs text-theme-muted font-medium">Log End Offset (LEO)</div>
            <div className="text-2xl font-mono font-bold text-theme-text mt-1">{leo}</div>
          </div>
          <div className="text-[11px] text-theme-muted mt-1">Notebook ka aakhri likha hua page (Total messages)</div>
        </div>

        <div className="p-4 bg-theme-surface border border-theme-border rounded-xl flex flex-col justify-between min-h-[96px]">
          <div>
            <div className="text-xs text-theme-muted font-medium">Committed Offset (Bookmark)</div>
            <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {committedOffset}
            </div>
          </div>
          <div className="text-[11px] text-theme-muted mt-1">Consumer bookmark: agla offset jo padhna hai</div>
        </div>

        <div className="p-4 bg-theme-surface border border-theme-border rounded-xl flex flex-col justify-between min-h-[96px]">
          <div>
            <div className="text-xs text-theme-muted font-medium">Consumer Lag (Pending Backlog)</div>
            <div
              className={`text-2xl font-mono font-bold mt-1 ${
                lag > 3 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-500'
              }`}
            >
              {lag}
            </div>
          </div>
          <div className="text-[11px] text-theme-muted mt-1">
            {lag === 0 ? 'Caught up (Real-time, Lag = 0)' : `${lag} unread messages bache hain`}
          </div>
        </div>
      </div>

      {/* 5. Visual Partition Stream with Offset Bookmark & Lag Highlight */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-theme-text flex items-center gap-2">
            <span>Partition 0 Log View</span>
            <code className="text-xs px-2 py-0.5 bg-theme-surface-alt border border-theme-border rounded text-theme-accent font-mono font-bold">
              orders.events:P0
            </code>
          </h3>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Committed (Processed)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Lag (Unread Backlog)</span>
            </span>
          </div>
        </div>

        {/* Message Log Cell Stream */}
        <div className="flex items-center gap-2.5 overflow-x-auto py-3 min-h-[90px] no-scrollbar">
          {messages.map((m) => {
            const isCommitted = m.offset < committedOffset;
            const isNextToRead = m.offset === committedOffset;

            return (
              <div
                key={m.id}
                className={`flex-shrink-0 min-w-[110px] p-2.5 rounded-lg border font-mono text-xs transition-all relative select-none ${
                  isCommitted
                    ? 'bg-theme-surface-alt/70 border-emerald-500/40 text-theme-muted'
                    : isNextToRead
                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500 text-theme-text'
                    : 'bg-theme-surface-alt border-amber-300 dark:border-amber-900/50 text-theme-text'
                }`}
              >
                {/* Pointer Badge */}
                {isNextToRead && (
                  <span className="absolute -top-2.5 left-2 px-1.5 py-0.2 bg-amber-500 text-stone-900 text-[9px] font-bold rounded shadow">
                    NEXT READ
                  </span>
                )}
                {isCommitted && (
                  <span className="absolute top-1 right-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    ✓ committed
                  </span>
                )}

                <div className="font-bold text-sm text-theme-accent">off {m.offset}</div>
                <div className="text-xs font-semibold text-theme-text truncate mt-0.5">{m.key}</div>
                <div className="text-[10px] text-theme-muted mt-0.5">{m.payload}</div>
              </div>
            );
          })}

          {/* Log End Offset Marker */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center p-2 border-2 border-dashed border-theme-border rounded-lg text-theme-muted text-xs font-mono min-w-[80px]">
            <span className="font-bold text-theme-text">LEO</span>
            <span className="text-[10px] text-theme-muted">off {leo}</span>
          </div>
        </div>
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
                  partition: 'orders.events:0',
                  logEndOffset: leo,
                  committedOffset,
                  lag,
                  totalMessagesCount: messages.length,
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

export default OffsetsLagDemo;
