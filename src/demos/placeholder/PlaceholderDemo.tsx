import React, { useState, useEffect, useCallback } from 'react';
import { DemoContainer } from '../../components/demo-chrome/DemoContainer';
import { DemoControlBar, PresetScenario } from '../../components/demo-chrome/DemoControlBar';
import { LogEntry } from '../../components/demo-chrome/DemoEventLog';
import { Challenge } from '../../components/demo-chrome/DemoChallengeMode';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Send, Server, Database, RefreshCw, CheckCircle2 } from 'lucide-react';

interface QueueItem {
  id: string;
  key: string;
  payload: string;
  status: 'pending' | 'processing' | 'completed' | 'dead_letter';
  attempt: number;
}

const PRESETS: PresetScenario[] = [
  { id: 'standard', name: 'Standard Traffic', description: 'Regular incoming stream of 5 order jobs.' },
  { id: 'burst', name: 'Burst Spike', description: 'Sudden burst of 10 incoming jobs causing queue backlog.' },
  { id: 'poison', name: 'Poison Message', description: 'Simulates a faulty payload that fails 3 retries and routes to DLQ.' },
];

export const PlaceholderDemo: React.FC = () => {
  // Demo State
  const [seed, setSeed] = useState(42);
  const [speed, setSpeed] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [activePreset, setActivePreset] = useState('standard');

  const [queue, setQueue] = useState<QueueItem[]>([
    { id: 'msg-1', key: 'usr-101', payload: 'Order Created', status: 'pending', attempt: 0 },
    { id: 'msg-2', key: 'usr-102', payload: 'Payment Processed', status: 'pending', attempt: 0 },
  ]);

  const [processedCount, setProcessedCount] = useState(0);
  const [dlqCount, setDlqCount] = useState(0);
  const [whatHappened, setWhatHappened] = useState(
    'Simulation ready hai. "Play" dabayein ya "Produce Job" button se naya message bhejein.'
  );

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-1',
      timestamp: 0,
      type: 'info',
      category: 'System',
      message: 'Queue simulation engine initialized with seed 42.',
    },
  ]);

  const [selectedEventId, setSelectedEventId] = useState<string>();

  // Add Log helper
  const addLog = useCallback(
    (type: LogEntry['type'], category: string, message: string, targetId?: string) => {
      setLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          timestamp: tick,
          type,
          category,
          message,
          targetId,
        },
      ]);
    },
    [tick]
  );

  // Step simulation forward 1 tick
  const stepSimulation = useCallback(() => {
    setTick((prev) => prev + 1);

    setQueue((prevQueue) => {
      const pendingIndex = prevQueue.findIndex((item) => item.status === 'pending');

      if (pendingIndex === -1) {
        setWhatHappened('Queue empty hai! Sabhi pending jobs process ho chuke hain.');
        return prevQueue;
      }

      const item = prevQueue[pendingIndex];
      const isPoison = item.key === 'poison-key' || item.payload.includes('Faulty');

      if (isPoison && item.attempt < 2) {
        // Retry
        const nextAttempt = item.attempt + 1;
        setWhatHappened(
          `Message #${item.id} fail hua! Exponential retry attempt ${nextAttempt}/3 trigger hui.`
        );
        addLog(
          'error',
          'Worker',
          `Job ${item.id} execution failed (attempt ${nextAttempt}/3). Requeueing with backoff.`,
          item.id
        );
        return prevQueue.map((m, idx) =>
          idx === pendingIndex ? { ...m, attempt: nextAttempt } : m
        );
      } else if (isPoison && item.attempt >= 2) {
        // Move to DLQ
        setDlqCount((d) => d + 1);
        setWhatHappened(
          `Message #${item.id} ne 3 retries exhaust kar liye! Safe isolation ke liye Dead Letter Queue (DLQ) me bhej diya gaya.`
        );
        addLog(
          'error',
          'DLQ',
          `Poison pill ${item.id} exhausted maximum retries -> Routed to Dead Letter Queue.`,
          item.id
        );
        return prevQueue.map((m, idx) =>
          idx === pendingIndex ? { ...m, status: 'dead_letter' } : m
        );
      } else {
        // Success
        setProcessedCount((c) => c + 1);
        setWhatHappened(
          `Worker ne Job #${item.id} (${item.payload}) successfully process kiya aur ack acknowledge kiya.`
        );
        addLog(
          'success',
          'Worker',
          `Job ${item.id} processed successfully. Ack committed.`,
          item.id
        );
        return prevQueue.map((m, idx) =>
          idx === pendingIndex ? { ...m, status: 'completed' } : m
        );
      }
    });
  }, [addLog]);

  // Virtual Clock Tick runner
  useEffect(() => {
    if (!isRunning) return;
    const intervalMs = Math.max(100, 800 / speed);
    const timer = setInterval(() => {
      stepSimulation();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isRunning, speed, stepSimulation]);

  // Produce manual job
  const handleProduce = (isPoison = false) => {
    const newId = `msg-${queue.length + 1}`;
    const newKey = isPoison ? 'poison-key' : `usr-${100 + queue.length + 1}`;
    const newPayload = isPoison ? 'Faulty Payment Payload' : `Event #${queue.length + 1}`;

    setQueue((prev) => [
      ...prev,
      { id: newId, key: newKey, payload: newPayload, status: 'pending', attempt: 0 },
    ]);

    setWhatHappened(
      `Producer ne naya job #${newId} publish kiya. Queue buffer me append ho gaya.`
    );
    addLog('inflight', 'Producer', `New job ${newId} published to queue buffer.`, newId);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTick(0);
    setProcessedCount(0);
    setDlqCount(0);
    setQueue([
      { id: 'msg-1', key: 'usr-101', payload: 'Order Created', status: 'pending', attempt: 0 },
      { id: 'msg-2', key: 'usr-102', payload: 'Payment Processed', status: 'pending', attempt: 0 },
    ]);
    setWhatHappened('Simulation reset to initial seed state.');
    setLogs([
      {
        id: `init-${Date.now()}`,
        timestamp: 0,
        type: 'info',
        category: 'System',
        message: `Simulation reset to seed ${seed}.`,
      },
    ]);
  };

  const handlePreset = (presetId: string) => {
    setActivePreset(presetId);
    handleReset();
    if (presetId === 'burst') {
      const burstItems: QueueItem[] = Array.from({ length: 8 }, (_, i) => ({
        id: `burst-${i + 1}`,
        key: `usr-${200 + i}`,
        payload: `Spike Job #${i + 1}`,
        status: 'pending',
        attempt: 0,
      }));
      setQueue(burstItems);
      setWhatHappened('Burst Spike preset loaded: 8 concurrent jobs added to queue.');
    } else if (presetId === 'poison') {
      setQueue([
        { id: 'poison-1', key: 'poison-key', payload: 'Faulty Billing Job', status: 'pending', attempt: 0 },
        { id: 'norm-2', key: 'usr-105', payload: 'Notification Send', status: 'pending', attempt: 0 },
      ]);
      setWhatHappened('Poison Message scenario loaded: Job #poison-1 will fail and test DLQ routing.');
    }
  };

  // Challenges
  const challenges: Challenge[] = [
    {
      id: 'ch-process-3',
      title: 'Process at least 3 jobs',
      description: 'Run the simulation or produce jobs until 3 jobs are marked completed.',
      isCompleted: processedCount >= 3,
    },
    {
      id: 'ch-route-dlq',
      title: 'Observe a Dead Letter Queue (DLQ) route',
      description: 'Trigger a poison job or load the Poison preset and watch it fail 3 retries.',
      hint: 'Click "+ Add Poison Job" or load preset "Poison Message".',
      isCompleted: dlqCount >= 1,
    },
  ];

  const pendingItems = queue.filter((q) => q.status === 'pending');
  const completedItems = queue.filter((q) => q.status === 'completed');
  const dlqItems = queue.filter((q) => q.status === 'dead_letter');

  return (
    <DemoContainer
      demoId="starter-queue-demo"
      title="Queue Lifecycle & Worker Simulator"
      summary="Interactive demonstration of producer publishing, in-memory queue buffering, worker execution with exponential retry, and Dead Letter Queue isolation."
      difficulty="medium"
      notesAnchor="queue-concepts-architecture"
      notesRefTitle="Day 35: Queue Concepts (At-least-once, Ordering, DLQ)"
      whatHappened={whatHappened}
      challenges={challenges}
      logs={logs}
      onClearLogs={() => setLogs([])}
      onSelectEvent={(entry) => setSelectedEventId(entry.targetId)}
      selectedEventId={selectedEventId}
      state={{
        tick,
        seed,
        speed,
        queueLength: pendingItems.length,
        processedCount,
        dlqCount,
      }}
      controls={
        <DemoControlBar
          isRunning={isRunning}
          onTogglePlay={() => setIsRunning(!isRunning)}
          onStep={stepSimulation}
          onReset={handleReset}
          speed={speed}
          onChangeSpeed={setSpeed}
          seed={seed}
          onChangeSeed={setSeed}
          onRandomizeSeed={() => setSeed(Math.floor(Math.random() * 9999) + 1)}
          presets={PRESETS}
          activePresetId={activePreset}
          onSelectPreset={handlePreset}
          currentTick={tick}
        />
      }
    >
      {/* Interactive Controls Bar inside Canvas */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-theme-surface-alt rounded-lg border border-theme-border">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleProduce(false)}
            icon={<Send className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
          >
            + Produce Normal Job
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleProduce(true)}
            className="border-red-400/50 text-red-600 dark:text-red-400 hover:bg-red-500/10"
            icon={<RefreshCw className="w-3.5 h-3.5 text-red-500" />}
          >
            + Add Poison Job
          </Button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-theme-muted">Pending: </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">{pendingItems.length}</span>
          </div>
          <div>
            <span className="text-theme-muted">Processed: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{processedCount}</span>
          </div>
          <div>
            <span className="text-theme-muted">DLQ: </span>
            <span className="font-bold text-red-600 dark:text-red-400">{dlqCount}</span>
          </div>
        </div>
      </div>

      {/* Visualizer Architecture Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* 1. Producer & Ingestion Queue */}
        <div className="p-4 bg-theme-surface-alt border border-theme-border rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-xs">
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Queue Buffer (Pending)</span>
            </div>
            <Badge type="inflight" size="sm">
              {pendingItems.length}
            </Badge>
          </div>

          <div className="space-y-2 min-h-[160px] max-h-[260px] overflow-y-auto">
            {pendingItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 border-2 border-dashed border-theme-border rounded-lg text-xs text-theme-muted italic">
                Queue is empty
              </div>
            ) : (
              pendingItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${
                    selectedEventId === item.id
                      ? 'border-amber-500 bg-amber-500/20 shadow-amber-glow'
                      : 'border-theme-border bg-theme-surface'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-theme-text mb-1">
                    <span>{item.id}</span>
                    {item.attempt > 0 && (
                      <Badge type="error" size="sm">
                        Retry {item.attempt}/3
                      </Badge>
                    )}
                  </div>
                  <div className="text-theme-muted truncate">{item.payload}</div>
                  <div className="text-[10px] text-theme-accent mt-1">Key: {item.key}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Worker Processing Lane */}
        <div className="p-4 bg-theme-surface-alt border border-theme-border rounded-xl flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <Server className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Worker Consumer (Concurrently 1)</span>
              </div>
              <Badge type="info" size="sm">
                Active
              </Badge>
            </div>

            <div className="p-4 bg-theme-surface border border-theme-border rounded-lg text-center">
              {isRunning && pendingItems.length > 0 ? (
                <div className="space-y-2 py-4">
                  <div className="inline-block animate-spin text-amber-500 text-xl font-bold">
                    ⚙️
                  </div>
                  <div className="text-xs font-mono font-semibold text-theme-text">
                    Processing {pendingItems[0]?.id}...
                  </div>
                  <div className="text-[11px] text-theme-muted">
                    Lock held • Event loop heartbeat active
                  </div>
                </div>
              ) : (
                <div className="py-6 text-xs text-theme-muted italic">
                  Worker idle. Waiting for next tick...
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-theme-border text-[11px] text-theme-muted">
            Ek line me: Worker job lock leta hai, process karta hai, aur failure par exponential backoff deta hai.
          </div>
        </div>

        {/* 3. Output Streams: Completed & DLQ */}
        <div className="space-y-4">
          {/* Completed Lane */}
          <div className="p-3 bg-theme-surface-alt border border-emerald-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Completed Stream (Acked)</span>
              </div>
              <Badge type="success" size="sm">
                {completedItems.length}
              </Badge>
            </div>
            <div className="text-xs font-mono text-theme-muted">
              {completedItems.length > 0
                ? `${completedItems.slice(-3).map((c) => c.id).join(', ')} acknowledged`
                : 'No completed jobs yet'}
            </div>
          </div>

          {/* DLQ Lane */}
          <div className="p-3 bg-theme-surface-alt border border-red-500/30 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-red-800 dark:text-red-300">
                <RefreshCw className="w-4 h-4 text-red-500" />
                <span>Dead Letter Queue (DLQ)</span>
              </div>
              <Badge type="error" size="sm">
                {dlqItems.length}
              </Badge>
            </div>
            <div className="text-xs font-mono text-theme-muted">
              {dlqItems.length > 0
                ? `${dlqItems.map((d) => d.id).join(', ')} isolated from main queue`
                : 'DLQ empty (0 poisoned jobs)'}
            </div>
          </div>
        </div>
      </div>
    </DemoContainer>
  );
};
export default PlaceholderDemo;
