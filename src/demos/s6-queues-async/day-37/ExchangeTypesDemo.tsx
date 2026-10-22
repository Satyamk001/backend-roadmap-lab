import React, { useState, useCallback } from 'react';
import {
  RabbitMqExchangeEngine,
  ExchangeType,
  RouteResult,
  QueueBinding,
} from '../../../engine/rabbitmq/exchangeEngine';
import { Send, ChevronDown, ChevronUp, Layers, ArrowRight, CheckCircle2, XCircle, Info } from 'lucide-react';
import { DemoCommandDeck, DemoActionButton } from '../../../components/common/DemoCommandDeck';
import { LiveEventLog, LogLayoutMode } from '../../../components/common/LiveEventLog';

const INITIAL_BINDINGS: QueueBinding[] = [
  { id: 'b1', queueId: 'q-billing', queueName: 'billing.queue', bindingKey: 'order.created' },
  { id: 'b2', queueId: 'q-email', queueName: 'email.queue', bindingKey: 'order.*' },
  { id: 'b3', queueId: 'q-analytics', queueName: 'analytics.queue', bindingKey: '#' },
  { id: 'b4', queueId: 'q-alerts', queueName: 'alerts.queue', bindingKey: '*.failed' },
];

const PRESET_KEYS = [
  { key: 'order.created', label: 'order.created' },
  { key: 'order.created.in', label: 'order.created.in' },
  { key: 'payment.failed', label: 'payment.failed' },
  { key: 'user.signup', label: 'user.signup' },
];

export const ExchangeTypesDemo: React.FC = () => {
  const [exchangeType, setExchangeType] = useState<ExchangeType>('direct');
  const [selectedKey, setSelectedKey] = useState<string>('order.created');
  const [customKey, setCustomKey] = useState<string>('');
  const [engine] = useState(
    () => new RabbitMqExchangeEngine({ name: 'orders.events', type: 'direct' }, INITIAL_BINDINGS)
  );
  const [lastResult, setLastResult] = useState<RouteResult | null>(null);
  const [queueMessages, setQueueMessages] = useState<Record<string, Array<{ id: string; key: string; time: string }>>>({
    'q-billing': [],
    'q-email': [],
    'q-analytics': [],
    'q-alerts': [],
  });

  const [statusWhat, setStatusWhat] = useState<string>(
    'RabbitMQ exchange types playground ready. Ek routing key chuno aur exchange type toggle karke route karo.'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Direct exchange exact match karta hai, Fanout sabhi bound queues ko broadcast karta hai, aur Topic wildcards (*, #) se evaluate karta hai.'
  );

  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [eventLog, setEventLog] = useState<Array<{ id: string; text: string; type: 'info' | 'success' | 'warn' }>>([]);
  const [logLayout, setLogLayout] = useState<LogLayoutMode>('stacked');

  const appendLog = useCallback((text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setEventLog((prev) => [
      { id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`, text, type },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Handle routing execution
  const handleRoute = useCallback(
    (overrideType?: ExchangeType, overrideKey?: string) => {
      const typeToUse = overrideType ?? exchangeType;
      const keyToUse = overrideKey ?? (customKey.trim() || selectedKey);

      engine.setExchangeType(typeToUse);
      const result = engine.route(keyToUse, { time: new Date().toISOString() });
      setLastResult(result);

      setStatusWhat(result.whatJustHappened);
      setStatusWhy(result.whyItMatters);

      // Append message to matched queues
      if (result.matchedQueueIds.length > 0) {
        setQueueMessages((prev) => {
          const next = { ...prev };
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          result.matchedQueueIds.forEach((qid) => {
            next[qid] = [
              { id: result.message.id, key: keyToUse, time: timeStr },
              ...(next[qid] || []).slice(0, 7),
            ];
          });
          return next;
        });
        appendLog(
          `[${typeToUse.toUpperCase()}] '${keyToUse}' routed to ${result.matchedQueueIds.length} queue(s).`,
          'success'
        );
      } else {
        appendLog(`[${typeToUse.toUpperCase()}] '${keyToUse}' unmatched — dropped!`, 'warn');
      }
    },
    [engine, exchangeType, selectedKey, customKey, appendLog]
  );

  const handleTypeChange = (newType: ExchangeType) => {
    setExchangeType(newType);
    handleRoute(newType, customKey.trim() || selectedKey);
  };

  const handleReset = () => {
    setExchangeType('direct');
    setSelectedKey('order.created');
    setCustomKey('');
    setLastResult(null);
    setQueueMessages({
      'q-billing': [],
      'q-email': [],
      'q-analytics': [],
      'q-alerts': [],
    });
    setEventLog([]);
    setStatusWhat('Playground reset ho gaya. Exchange type: direct, routing key: order.created.');
    setStatusWhy('Naye message bhejne ke liye "Route Message" click karein.');
  };

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      {/* 1. Unified Command & Status Deck */}
      <DemoCommandDeck
        title="Exchange types: Direct, fanout, and topic"
        statusMessage={statusWhat}
        whyItMatters={statusWhy}
        badge=""
        notesAnchor="exchange-types"
        onReset={handleReset}
        actions={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            {/* Control 1: Exchange Type Selector */}
            <div className="flex items-center gap-1 p-0.5 bg-theme-surface-alt rounded-lg border border-theme-border text-xs font-semibold">
              <span className="px-2 text-theme-muted font-sans font-medium hidden sm:inline">Exchange:</span>
              {(['direct', 'fanout', 'topic'] as ExchangeType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`px-2.5 py-1 rounded-md font-mono uppercase tracking-wider text-[11.5px] transition-all ${exchangeType === t
                      ? 'bg-theme-primary text-theme-primary-text font-bold shadow-xs'
                      : 'text-theme-muted hover:text-theme-text'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Control 2: Routing Key Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-theme-muted font-medium mr-1 hidden md:inline">Key:</span>
              {PRESET_KEYS.map((pk) => (
                <button
                  key={pk.key}
                  type="button"
                  onClick={() => {
                    setSelectedKey(pk.key);
                    setCustomKey('');
                    handleRoute(undefined, pk.key);
                  }}
                  className={`px-2 py-0.5 text-xs font-mono rounded-lg border transition-all ${selectedKey === pk.key && !customKey
                      ? 'bg-theme-surface-alt text-theme-accent border-theme-accent font-bold'
                      : 'bg-theme-surface text-theme-muted border-theme-border hover:border-theme-muted'
                    }`}
                >
                  {pk.label}
                </button>
              ))}
            </div>

            {/* Control 3: Route Message */}
            <DemoActionButton
              variant="primary"
              onClick={() => handleRoute()}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Route Message</span>
            </DemoActionButton>
          </div>
        }
      />

      <div className={logLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        <div className={logLayout === 'side' ? 'lg:col-span-7 xl:col-span-8 space-y-4 min-w-0' : 'space-y-4'}>
          {/* Main Interactive Simulation Canvas */}
          <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
        {/* Visual Architecture Flow: Producer -> Exchange -> Queues */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* 1. Producer Box (3 cols) */}
          <div className="md:col-span-3 p-3.5 rounded-xl bg-theme-surface-alt/60 border border-theme-border space-y-2 text-center md:text-left">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-theme-muted">Producer</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400 font-mono">active</span>
            </div>
            <div className="font-semibold text-sm text-theme-text">order-service</div>
            <div className="p-2 rounded-lg bg-theme-surface border border-theme-border space-y-1">
              <span className="text-[10px] text-theme-muted block">Outbound Routing Key:</span>
              <div className="font-mono text-xs font-bold text-theme-accent truncate">
                {customKey.trim() || selectedKey}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex md:col-span-1 justify-center text-theme-muted">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* 2. Exchange Box (4 cols) */}
          <div className="md:col-span-4 p-4 rounded-xl bg-theme-surface border-2 border-theme-primary/50 shadow-sm space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-theme-primary" />
                <span className="font-bold text-sm text-theme-text">orders.events</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-theme-primary text-black uppercase">
                {exchangeType}
              </span>
            </div>

            <div className="text-xs text-theme-muted leading-relaxed">
              {exchangeType === 'direct' && (
                <span>
                  <b>Direct rule:</b> Routing key ko binding key se <b>exact match</b> karta hai.
                </span>
              )}
              {exchangeType === 'fanout' && (
                <span>
                  <b>Fanout rule:</b> Routing key <b>ignore</b> karke sabhi bound queues ko broadcast karta hai.
                </span>
              )}
              {exchangeType === 'topic' && (
                <span>
                  <b>Topic rule:</b> Dot-separated words par <code>*</code> (1 word) aur <code>#</code> (0+ words) evaluate karta hai.
                </span>
              )}
            </div>

            <div className="p-2 rounded bg-theme-surface-alt border border-theme-border flex items-center justify-between text-xs">
              <span className="text-theme-muted">Matched Queues:</span>
              <span className="font-mono font-bold text-theme-text">
                {lastResult ? lastResult.matchedQueueIds.length : 0} / {INITIAL_BINDINGS.length}
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex md:col-span-1 justify-center text-theme-muted">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* 3. Destination Queues Overview (3 cols preview badge) */}
          <div className="md:col-span-3 space-y-2">
            <div className="text-xs font-semibold text-theme-muted flex items-center justify-between">
              <span>Bound Queues ({INITIAL_BINDINGS.length})</span>
              <span className="text-[10px] text-theme-muted font-mono">buffer</span>
            </div>
            <div className="p-2.5 rounded-xl bg-theme-surface-alt/40 border border-theme-border text-xs text-theme-muted space-y-1">
              <div>• billing.queue (key: <code>order.created</code>)</div>
              <div>• email.queue (key: <code>order.*</code>)</div>
              <div>• analytics.queue (key: <code>#</code>)</div>
              <div>• alerts.queue (key: <code>*.failed</code>)</div>
            </div>
          </div>
        </div>

        {/* Live Binding Evaluation Cards Grid */}
        <div className="space-y-2 pt-2 border-t border-theme-border">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">
              Live Queue Bindings & Message Delivery
            </h3>
            <span className="text-[11px] text-theme-muted font-mono">
              current key: <b className="text-theme-accent">{customKey.trim() || selectedKey}</b>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {INITIAL_BINDINGS.map((b) => {
              const evalStep = lastResult?.evaluations.find((e) => e.queueId === b.queueId);
              const isMatched = evalStep ? evalStep.matched : false;
              const msgs = queueMessages[b.queueId] || [];

              return (
                <div
                  key={b.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between h-full min-h-[200px] ${isMatched
                      ? 'bg-emerald-500/10 border-emerald-500/60 shadow-xs'
                      : 'bg-theme-surface border-theme-border opacity-90'
                    }`}
                >
                  {/* Queue Header */}
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-theme-text truncate">{b.queueName}</span>
                    {evalStep && (
                      isMatched ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )
                    )}
                  </div>

                  {/* Binding Pattern */}
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className="text-theme-muted">Binding:</span>
                    <span className="font-mono px-1.5 py-0.5 rounded bg-theme-surface-alt border border-theme-border text-theme-text font-semibold">
                      {b.bindingKey}
                    </span>
                  </div>

                  {/* Evaluation reason */}
                  <div className="mt-2 text-[11px] text-theme-muted leading-tight min-h-[32px]">
                    {evalStep ? (
                      <span className={isMatched ? 'text-emerald-400 font-medium' : 'text-theme-muted'}>
                        {evalStep.reason}
                      </span>
                    ) : (
                      'Route button dabane par evaluation yahan dikhega.'
                    )}
                  </div>

                  {/* Queue Messages Buffer */}
                  <div className="mt-3 pt-2 border-t border-theme-border space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-theme-muted font-mono">
                      <span>Queue Buffer</span>
                      <span>{msgs.length} msgs</span>
                    </div>
                    {msgs.length === 0 ? (
                      <div className="py-2 text-center text-[10px] text-theme-muted italic">
                        Empty queue
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
                        {msgs.map((m, idx) => (
                          <div
                            key={`${m.id}-${idx}`}
                            className="p-1 px-1.5 rounded bg-theme-surface border border-theme-border text-[10px] font-mono flex items-center justify-between"
                          >
                            <span className="text-theme-accent font-semibold truncate max-w-[120px]">{m.key}</span>
                            <span className="text-theme-muted text-[9px]">{m.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
            More options (Custom routing key &amp; State inspector)
          </span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border space-y-4 text-xs">
            {/* Custom Routing Key Input */}
            <div className="p-3 bg-theme-surface-alt rounded-lg border border-theme-border space-y-2">
              <label className="font-semibold text-theme-text block">
                Custom Routing Key Test
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  placeholder="e.g. order.created.in or payment.retry.failed"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-xs font-mono text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-primary"
                />
                <button
                  onClick={() => handleRoute(undefined, customKey.trim())}
                  disabled={!customKey.trim()}
                  className="px-3 py-1.5 bg-theme-primary text-black font-bold rounded-lg disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <p className="text-[11px] text-theme-muted">
                Dot-separated words type karein (jaise <code>shop.order.eu.v1</code>) aur dekhein Direct vs Topic me kya fark padta hai.
              </p>
            </div>

            {/* State Inspector */}
            <details className="cursor-pointer">
              <summary className="font-semibold text-theme-muted hover:text-theme-text">
                State Inspector (JSON Snapshot)
              </summary>
              <pre className="mt-2 p-3 bg-theme-surface-alt rounded-lg font-mono text-[10px] overflow-x-auto text-theme-muted border border-theme-border">
                {JSON.stringify({ exchangeType, lastResult }, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
      </div>

      {/* Live Event Stream Log */}
      <div className={logLayout === 'side' ? 'lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 min-w-0' : 'w-full'}>
        <LiveEventLog
          title="RabbitMQ Routing Event Log"
          entries={eventLog.map((l) => ({
            id: l.id,
            type: l.type === 'warn' ? 'warn' : l.type,
            message: l.text,
          }))}
          layout={logLayout}
          onLayoutChange={setLogLayout}
          onClear={() => setEventLog([])}
          maxHeight={logLayout === 'side' ? 'max-h-[620px]' : 'max-h-56'}
        />
      </div>
    </div>
    </div>
  );
};

export default ExchangeTypesDemo;
