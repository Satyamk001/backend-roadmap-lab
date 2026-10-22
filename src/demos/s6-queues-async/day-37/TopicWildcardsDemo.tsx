import React, { useState, useCallback } from 'react';
import { matchesTopic } from '../../../engine/rabbitmq/topicMatcher';
import { Send, ChevronDown, ChevronUp, CheckCircle2, XCircle, ShieldAlert, Info } from 'lucide-react';
import { DemoCommandDeck, DemoActionButton } from '../../../components/common/DemoCommandDeck';

interface TopicBinding {
  id: string;
  queueName: string;
  pattern: string;
  description: string;
}

const TOPIC_BINDINGS: TopicBinding[] = [
  { id: 'tb-1', queueName: 'billing.queue', pattern: 'order.*', description: 'Exactly 2-word order events (order.created, order.paid)' },
  { id: 'tb-2', queueName: 'analytics.queue', pattern: '#', description: 'Catch-all subscriber: matches all topics of any depth' },
  { id: 'tb-3', queueName: 'region.queue', pattern: 'order.#', description: 'All order events including deep paths (order.created.in)' },
  { id: 'tb-4', queueName: 'alerts.queue', pattern: '*.failed', description: 'Failed events with 2 words (payment.failed, order.failed)' },
];

const PRESETS = [
  { key: 'order.created', label: 'order.created' },
  { key: 'order.created.in', label: 'order.created.in' },
  { key: 'payment.failed', label: 'payment.failed' },
  { key: 'payment.stripe.failed', label: 'payment.stripe.failed' },
  { key: 'unknown.telemetry', label: 'unknown.telemetry' },
];

export const TopicWildcardsDemo: React.FC = () => {
  const [activeKey, setActiveKey] = useState<string>('order.created.in');
  const [customKey, setCustomKey] = useState<string>('');
  const [enableAlternateExchange, setEnableAlternateExchange] = useState<boolean>(true);

  const currentKey = (customKey.trim() || activeKey).toLowerCase();
  const words = currentKey.split('.').filter(Boolean);

  const [statusWhat, setStatusWhat] = useState<string>(
    "'order.created.in' (3 words) ne 'order.#' aur '#' ko match kiya, par 'order.*' ne reject kiya kyunki * sirf exactly 1 word leta hai."
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    "Topic exchange dot-separated words par token matching karta hai. Single level ke liye '*' aur multi-level hierarchical routing ke liye '#' use hota hai."
  );

  const [unroutedCount, setUnroutedCount] = useState<number>(0);
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  // Evaluate matching queues
  const evalResults = TOPIC_BINDINGS.map((b) => {
    const matched = matchesTopic(b.pattern, currentKey);
    return { ...b, matched };
  });

  const matchedCount = evalResults.filter((r) => r.matched).length;
  const isUnrouted = matchedCount === 0;

  const handleSend = useCallback(
    (keyToSend?: string) => {
      const key = (keyToSend ?? currentKey).trim();

      const matches = TOPIC_BINDINGS.filter((b) => matchesTopic(b.pattern, key));
      if (matches.length === 0) {
        setUnroutedCount((prev) => prev + 1);
        if (enableAlternateExchange) {
          setStatusWhat(`Routing key '${key}' kisi topic binding se match nahi hui — Alternate Exchange (orders.unrouted) ne pakad liya!`);
          setStatusWhy("Alternate Exchange safety-net banata hai taaki developer ki typo ya unhandled events silently vanish na hon.");
        } else {
          setStatusWhat(`Routing key '${key}' kisi binding se match nahi hui aur Alternate Exchange disabled hai — message DROP ho gaya!`);
          setStatusWhy("RabbitMQ me default behavior silent drop hota hai jab tak mandatory flag ya Alternate Exchange configured na ho.");
        }
      } else {
        const names = matches.map((m) => m.queueName).join(', ');
        setStatusWhat(
          `Message '${key}' (${words.length} words) ne ${matches.length} queue(s) ko match kiya: ${names}.`
        );
        setStatusWhy(
          "Har matching queue ko message ki independent copy milti hai (same queue ko duplicate copy nahi milti chahe kai bindings match hon)."
        );
      }
    },
    [currentKey, words.length, enableAlternateExchange]
  );

  const handleReset = () => {
    setActiveKey('order.created.in');
    setCustomKey('');
    setUnroutedCount(0);
    setStatusWhat("'order.created.in' reset ho gaya. Presets click karke token matching test karein.");
    setStatusWhy("Topic exchange dot-separated words par token matching karta hai.");
  };

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      <DemoCommandDeck
        title="Topic routing: * and # wildcards"
        statusWhat={statusWhat}
        statusWhy={statusWhy}
        onReset={handleReset}
        actions={
          <>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => {
                    setActiveKey(p.key);
                    setCustomKey('');
                    handleSend(p.key);
                  }}
                  className={`px-2 py-1 text-xs font-mono rounded-lg border transition-all ${
                    activeKey === p.key && !customKey
                      ? 'bg-theme-surface-alt text-theme-accent border-theme-accent font-bold'
                      : 'bg-theme-surface text-theme-muted border-theme-border hover:border-theme-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <DemoActionButton
              onClick={() => handleSend()}
              icon={<Send className="w-3.5 h-3.5" />}
              variant="primary"
            >
              Evaluate
            </DemoActionButton>
          </>
        }
      />

      {/* Main Canvas: Word Tokenizer & Wildcard Matching Engine */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
        {/* Tokenizer Visualizer */}
        <div className="p-4 rounded-xl bg-theme-surface-alt/60 border border-theme-border space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-muted">
              Word-by-Word Token Decomposition
            </span>
            <span className="text-xs font-mono text-theme-accent font-semibold">
              Word Count: {words.length} segment(s)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-theme-muted font-sans font-medium">Routing Key:</span>
            {words.map((w, idx) => (
              <React.Fragment key={idx}>
                <div className="px-3 py-1.5 rounded-lg bg-theme-surface border-2 border-theme-primary text-xs font-mono font-bold text-theme-text shadow-2xs">
                  <span className="text-[10px] text-theme-muted block font-sans font-normal">Word {idx + 1}</span>
                  {w}
                </div>
                {idx < words.length - 1 && (
                  <span className="font-mono text-base font-bold text-theme-primary">.</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Wildcard Rule Reference Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-theme-surface border border-theme-border flex flex-col justify-between space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 font-mono font-bold text-sm">*</span>
              <span className="font-bold text-theme-text">Star Wildcard (Asterisk)</span>
            </div>
            <p className="text-theme-muted text-[11px] leading-relaxed">
              Matches <b>EXACTLY ONE word</b> between dots. <code>order.*</code> matches <code>order.created</code>, par <code>order.created.in</code> ko reject karta hai.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-theme-surface border border-theme-border flex flex-col justify-between space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-400 font-mono font-bold text-sm">#</span>
              <span className="font-bold text-theme-text">Hash Wildcard (Octothorpe)</span>
            </div>
            <p className="text-theme-muted text-[11px] leading-relaxed">
              Matches <b>ZERO OR MORE words</b>. <code>order.#</code> matches <code>order</code>, <code>order.created</code>, aur <code>order.created.in.north</code>.
            </p>
          </div>
        </div>

        {/* Binding Comparison Matrix */}
        <div className="space-y-2 pt-2 border-t border-theme-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">
              Active Topic Bindings Evaluation
            </h3>
            <span className="text-xs font-mono text-theme-muted">
              Matched: <b className="text-theme-text">{matchedCount}</b> / {TOPIC_BINDINGS.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {evalResults.map((b) => (
              <div
                key={b.id}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  b.matched
                    ? 'bg-emerald-500/10 border-emerald-500/60 shadow-xs'
                    : 'bg-theme-surface border-theme-border opacity-85'
                }`}
              >
                <div className="space-y-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-theme-text">{b.queueName}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-theme-surface-alt border border-theme-border font-bold text-theme-accent">
                      {b.pattern}
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">{b.description}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-[11px]">
                    {b.matched ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Pattern Matched (Delivered)
                      </span>
                    ) : (
                      <span className="text-theme-muted flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-red-400" />
                        Mismatch (Skipped)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alternate Exchange Fallback Box */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isUnrouted
              ? 'bg-amber-500/15 border-amber-500/60'
              : 'bg-theme-surface-alt/40 border-theme-border'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className={`w-4 h-4 ${isUnrouted ? 'text-amber-500 animate-bounce' : 'text-theme-muted'}`} />
              <span className="font-bold text-xs text-theme-text">
                Alternate Exchange (Safety Net): orders.unrouted
              </span>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-theme-muted cursor-pointer">
              <input
                type="checkbox"
                checked={enableAlternateExchange}
                onChange={(e) => setEnableAlternateExchange(e.target.checked)}
                className="rounded border-theme-border text-theme-primary focus:ring-theme-primary"
              />
              Enable AE
            </label>
          </div>
          <p className="text-[11px] text-theme-muted mt-1">
            {isUnrouted ? (
              enableAlternateExchange ? (
                <span className="text-amber-300 font-medium">
                  ⚠️ Koi binding match nahi hui! Alternate Exchange ne message ko catch karke <code>orders.unrouted.queue</code> me deposit kiya. (Caught: {unroutedCount} msg)
                </span>
              ) : (
                <span className="text-red-400 font-medium">
                  ❌ Alternate exchange off hai aur koi binding match nahi hui — message SILENTLY DROPPED!
                </span>
              )
            ) : (
              'Message kam se kam ek queue se match ho gaya, isliye alternate exchange trigger nahi hua.'
            )}
          </p>
        </div>
      </div>

      {/* Collapsible "More options" */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden shadow-xs">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            More options (Custom routing key tester & regex tokens)
          </span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border space-y-3 text-xs">
            <div className="space-y-2">
              <label className="font-semibold text-theme-text block">
                Custom Routing Key Sandbox
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="e.g. order.created.in.urgent or payments.india.upi.failed"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-xs font-mono text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary"
                />
                <button
                  onClick={() => handleSend(customKey.trim())}
                  disabled={!customKey.trim()}
                  className="px-3 py-1.5 bg-theme-primary text-black font-bold rounded-lg disabled:opacity-50"
                >
                  Test Key
                </button>
              </div>
            </div>
            <p className="text-[11px] text-theme-muted">
              Tip: Production topic naming convention hamesha <code>domain.entity.event.region</code> format me follow karein.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicWildcardsDemo;
