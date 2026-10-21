import React, { useState, useCallback } from 'react';
import { Send, RotateCcw, ChevronDown, ChevronUp, Users, Copy, AlertTriangle, Info } from 'lucide-react';

type ArchitectureMode = 'pubsub' | 'workqueue' | 'shared_queue_bug';

interface QueueItem {
  id: string;
  name: string;
  count: number;
}

export const PubSubWorkQueueDemo: React.FC = () => {
  const [mode, setMode] = useState<ArchitectureMode>('pubsub');
  const [msgSeq, setMsgSeq] = useState<number>(1);

  // Pub/Sub state: 3 independent queues
  const [pubSubQueues, setPubSubQueues] = useState<Record<string, number>>({
    'billing.queue': 0,
    'email.queue': 0,
    'analytics.queue': 0,
  });

  // Work queue state: 1 queue with 3 competing workers
  const [workQueueCount, setWorkQueueCount] = useState<number>(0);
  const [workerCounts, setWorkerCounts] = useState<Record<string, number>>({
    'Worker 1': 0,
    'Worker 2': 0,
    'Worker 3': 0,
  });

  // Shared queue bug state (Billing & Email sharing 1 queue)
  const [sharedQueueCount, setSharedQueueCount] = useState<number>(0);
  const [sharedServiceProcessed, setSharedServiceProcessed] = useState<{
    billing: string[];
    email: string[];
  }>({
    billing: [],
    email: [],
  });

  const [statusWhat, setStatusWhat] = useState<string>(
    'Pub/Sub mode active: Exchange har subscriber queue (billing, email, analytics) me message ki independent copy daalta hai.'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Pub/Sub me har service ki apni queue hoti hai; naya subscriber jodna ho toh bas nayi queue bind karo, producer change nahi hota.'
  );

  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

  const handlePublish = useCallback(() => {
    const currentId = `order-#${msgSeq}`;
    setMsgSeq((prev) => prev + 1);

    if (mode === 'pubsub') {
      setPubSubQueues((prev) => ({
        'billing.queue': prev['billing.queue'] + 1,
        'email.queue': prev['email.queue'] + 1,
        'analytics.queue': prev['analytics.queue'] + 1,
      }));
      setStatusWhat(
        `[Pub/Sub] '${currentId}' publish hua — Exchange ne teeno subscriber queues me ek-ek copy (total 3 copies) duplicate karke daali.`
      );
      setStatusWhy(
        'Billing, Email aur Analytics teeno ko event mila aur sab apni apni speed se bina ek doosre ko block kiye process karenge.'
      );
    } else if (mode === 'workqueue') {
      // Competing consumers: distribute round-robin to one worker
      const workerKeys = ['Worker 1', 'Worker 2', 'Worker 3'];
      const chosenWorker = workerKeys[(msgSeq - 1) % workerKeys.length];

      setWorkerCounts((prev) => ({
        ...prev,
        [chosenWorker]: prev[chosenWorker] + 1,
      }));
      setWorkQueueCount((prev) => prev + 1);

      setStatusWhat(
        `[Work Queue] '${currentId}' single queue me gaya aur sirf ${chosenWorker} ne uthaya — baki workers ko copy nahi mili.`
      );
      setStatusWhy(
        'Work Queue heavy background tasks (jaise PDF generation ya email sending) ko multiple workers me baantne (load levelling) ke liye hoti hai.'
      );
    } else {
      // Shared Queue Bug!
      const isBilling = msgSeq % 2 === 1;
      const targetService = isBilling ? 'billing' : 'email';

      setSharedServiceProcessed((prev) => ({
        ...prev,
        [targetService]: [currentId, ...prev[targetService]].slice(0, 5),
      }));
      setSharedQueueCount((prev) => prev + 1);

      setStatusWhat(
        `🚨 BUG DETECTED! '${currentId}' sirf ${targetService.toUpperCase()} service ko mila. Doosri service ke paas ye event gaya hi nahi!`
      );
      setStatusWhy(
        'Agar do alag services same queue share karengi, toh wo competing consumers ban jaayengi aur message ek doosre se chheen lengi (Pub/Sub fail!).'
      );
    }
  }, [mode, msgSeq]);

  const handleModeChange = (newMode: ArchitectureMode) => {
    setMode(newMode);
    if (newMode === 'pubsub') {
      setStatusWhat('Pub/Sub Mode selected: Har subscriber service ki apni dedicated queue hoti hai.');
      setStatusWhy('Publisher ko pata bhi nahi hota ki kaun kaun se subscribers sun rahe hain (complete decoupling).');
    } else if (newMode === 'workqueue') {
      setStatusWhat('Work Queue Mode selected: Ek single queue aur multiple competing worker instances.');
      setStatusWhy('Har task sirf ek worker ko milta hai taaki duplicate processing na ho.');
    } else {
      setStatusWhat('Common Production Bug: Billing aur Email dono galti se same queue se consume kar rahe hain!');
      setStatusWhy('Dono services ek doosre ke messages steal kar lengi. Pub/Sub ke liye per-service queue mandatory hai.');
    }
  };

  const handleReset = () => {
    setMsgSeq(1);
    setPubSubQueues({
      'billing.queue': 0,
      'email.queue': 0,
      'analytics.queue': 0,
    });
    setWorkQueueCount(0);
    setWorkerCounts({
      'Worker 1': 0,
      'Worker 2': 0,
      'Worker 3': 0,
    });
    setSharedQueueCount(0);
    setSharedServiceProcessed({ billing: [], email: [] });
    setStatusWhat('Queues aur workers reset ho gaye.');
    setStatusWhy('Publish order.created button dabakar test karein.');
  };

  return (
    <div className="w-full max-w-[1040px] mx-auto text-theme-text space-y-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-theme-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-theme-text">
            Pub/Sub vs work queues
          </h2>
          <p className="text-sm text-theme-muted mt-0.5">
            Ek queue par competing consumers (work queue) vs har subscriber ki apni queue (pub/sub).
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
              {statusWhat}
            </div>
            <div className="text-xs text-theme-muted mt-1 leading-normal font-medium">
              💡 {statusWhy}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Controls (Max 5 controls) */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-3.5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Architecture Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-theme-surface-alt rounded-lg border border-theme-border text-xs font-semibold">
            <button
              onClick={() => handleModeChange('pubsub')}
              className={`px-3 py-1.5 rounded-md font-sans text-xs transition-all ${
                mode === 'pubsub'
                  ? 'bg-theme-primary text-black font-bold shadow-xs'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Pub/Sub (Copy to all)
            </button>
            <button
              onClick={() => handleModeChange('workqueue')}
              className={`px-3 py-1.5 rounded-md font-sans text-xs transition-all ${
                mode === 'workqueue'
                  ? 'bg-theme-primary text-black font-bold shadow-xs'
                  : 'text-theme-muted hover:text-theme-text'
              }`}
            >
              Work Queue (1 worker gets it)
            </button>
            <button
              onClick={() => handleModeChange('shared_queue_bug')}
              className={`px-2.5 py-1.5 rounded-md font-sans text-xs transition-all ${
                mode === 'shared_queue_bug'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 font-bold'
                  : 'text-red-400/80 hover:text-red-400'
              }`}
            >
              ⚠️ Shared Queue Bug
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePublish}
              className="px-3.5 py-1.5 bg-theme-primary text-black font-bold rounded-lg text-xs flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Publish order.created
            </button>
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

      {/* Main Canvas */}
      <div className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-5">
        {mode === 'pubsub' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-theme-primary" />
                <span className="font-bold text-sm text-theme-text">Pub/Sub Model: 1 Queue Per Subscriber Service</span>
              </div>
              <span className="text-xs text-theme-muted font-mono">Total Published: {msgSeq - 1}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(pubSubQueues).map(([queueName, count]) => (
                <div key={queueName} className="p-4 rounded-xl bg-theme-surface-alt/50 border border-theme-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-theme-text">{queueName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">
                      subscriber
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-theme-surface border border-theme-border text-center space-y-1">
                    <span className="text-[10px] text-theme-muted block font-sans">Delivered Copies</span>
                    <div className="text-2xl font-bold font-mono text-theme-text">{count}</div>
                  </div>
                  <p className="text-[11px] text-theme-muted leading-tight">
                    {queueName === 'billing.queue' && 'Billing service customer card charge karegi.'}
                    {queueName === 'email.queue' && 'Notification service receipt email bhejegi.'}
                    {queueName === 'analytics.queue' && 'Data warehouse reporting metrics update karega.'}
                  </p>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-theme-surface border border-theme-border text-xs text-theme-muted flex items-start gap-2">
              <span className="text-theme-primary font-bold">✓ Decoupling Benefit:</span>
              <span>
                Kal agar ek nayi <b>fraud-detection-service</b> banani ho, toh bas uski apni queue exchange se bind karni hogi — <code>order-service</code> ka code 0% badlega!
              </span>
            </div>
          </div>
        )}

        {mode === 'workqueue' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-theme-border">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-sm text-theme-text">Work Queue Model: Competing Consumers on 1 Queue</span>
              </div>
              <span className="text-xs text-theme-muted font-mono">Queue Buffer: {workQueueCount} tasks handled</span>
            </div>

            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-center space-y-1">
              <span className="text-xs font-bold text-sky-400 font-mono">orders.jobs (Single Shared Queue)</span>
              <p className="text-[11px] text-theme-muted">
                Saare messages isi ek queue me aate hain aur neeche diye gaye workers round-robin me ek-ek karke baant lete hain.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(workerCounts).map(([workerName, count]) => (
                <div key={workerName} className="p-4 rounded-xl bg-theme-surface-alt/50 border border-theme-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-theme-text">{workerName}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-400 font-bold">
                      worker
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-theme-surface border border-theme-border text-center space-y-1">
                    <span className="text-[10px] text-theme-muted block font-sans">Tasks Processed</span>
                    <div className="text-2xl font-bold font-mono text-theme-text">{count}</div>
                  </div>
                  <p className="text-[11px] text-theme-muted">
                    Round-robin ke zariye fair load levelling. Message duplicate nahi hota.
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {mode === 'shared_queue_bug' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/40 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <AlertTriangle className="w-4 h-4" />
                ANTI-PATTERN: Sharing a Single Queue between Distinct Business Services
              </div>
              <p className="text-xs text-theme-muted leading-relaxed">
                Developer ne socha "ek hi queue <code>orders.events</code> bana lete hain aur Billing aur Email dono ko usi se connect kar dete hain". Dekhein kya hua:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-theme-surface border border-theme-border space-y-2">
                <span className="font-bold text-xs text-theme-text block">Billing Service ne uthaya:</span>
                <div className="min-h-[90px] p-2 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1 font-mono text-xs">
                  {sharedServiceProcessed.billing.length === 0 ? (
                    <span className="text-theme-muted text-[11px] italic">No events yet...</span>
                  ) : (
                    sharedServiceProcessed.billing.map((id, idx) => (
                      <div key={idx} className="text-emerald-400">• {id} (charged)</div>
                    ))
                  )}
                </div>
                <p className="text-[10px] text-theme-muted">
                  Billing sirf in orders ko dekh payi; baki orders Email service ne steal kar liye!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-theme-surface border border-theme-border space-y-2">
                <span className="font-bold text-xs text-theme-text block">Email Service ne uthaya:</span>
                <div className="min-h-[90px] p-2 rounded-lg bg-theme-surface-alt border border-theme-border space-y-1 font-mono text-xs">
                  {sharedServiceProcessed.email.length === 0 ? (
                    <span className="text-theme-muted text-[11px] italic">No events yet...</span>
                  ) : (
                    sharedServiceProcessed.email.map((id, idx) => (
                      <div key={idx} className="text-sky-400">• {id} (email sent)</div>
                    ))
                  )}
                </div>
                <p className="text-[10px] text-theme-muted">
                  Email service ko sirf ye orders mile; billing wale orders ka receipt email kabhi gaya hi nahi!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible More Options */}
      <div className="border border-theme-border rounded-xl bg-theme-surface overflow-hidden shadow-xs">
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-theme-muted hover:text-theme-text transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            More options (Architecture Comparison Cheat Sheet)
          </span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 border-t border-theme-border text-xs space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-theme-border text-theme-muted text-[11px]">
                    <th className="py-1.5 pr-4">Feature</th>
                    <th className="py-1.5 pr-4">Work Queue</th>
                    <th className="py-1.5 pr-4">Pub/Sub</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border text-[11px] text-theme-text">
                  <tr>
                    <td className="py-1.5 font-semibold text-theme-muted">Queues</td>
                    <td className="py-1.5">1 single queue</td>
                    <td className="py-1.5">1 queue per subscriber</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-theme-muted">Message delivery</td>
                    <td className="py-1.5">Only 1 worker gets it</td>
                    <td className="py-1.5">All subscribers get a copy</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-semibold text-theme-muted">Primary use case</td>
                    <td className="py-1.5">Distributing heavy CPU/IO jobs</td>
                    <td className="py-1.5">Event broadcasting across microservices</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PubSubWorkQueueDemo;
