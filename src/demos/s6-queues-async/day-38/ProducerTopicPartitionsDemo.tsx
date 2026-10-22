import React, { useState, useEffect, useRef, useCallback } from 'react';
import { partitionForKey } from '../../../engine/kafka/murmur2';
import { rangeAssign } from '../../../engine/kafka/assignor';
import { Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { DemoCommandDeck } from '../../../components/common/DemoCommandDeck';
import { LiveEventLog, LogLayoutMode } from '../../../components/common/LiveEventLog';

interface KafkaMessage {
  id: string;
  topic: string;
  key: string | null;
  event: string;
  offset: number;
  partition: number;
  timestamp: number;
}

interface ConsumerGroupState {
  id: string;
  numConsumers: number;
  committed: number[]; // committed offset per partition
}

export interface TopicConfig {
  name: string;
  defaultKey: string;
  presetKeys: string[];
  events: string[];
  description: string;
}

export const TOPIC_CATALOG: Record<string, TopicConfig> = {
  'orders.events': {
    name: 'orders.events',
    defaultKey: 'order_1',
    presetKeys: ['order_1', 'order_2', 'order_3', 'order_6', 'order_4', 'order_7'],
    events: ['order.created', 'order.paid', 'order.shipped', 'order.cancelled'],
    description: 'E-commerce order lifecycle events',
  },
  'payments.events': {
    name: 'payments.events',
    defaultKey: 'pay_3',
    presetKeys: ['pay_3', 'pay_1', 'pay_5', 'pay_4', 'pay_2', 'pay_7'],
    events: ['payment.initiated', 'payment.verified', 'payment.failed', 'payment.refunded'],
    description: 'Payment gateway transaction events',
  },
  'users.events': {
    name: 'users.events',
    defaultKey: 'user_1',
    presetKeys: ['user_1', 'user_2', 'user_4', 'user_8', 'user_3', 'user_5'],
    events: ['user.registered', 'user.profile_updated', 'user.kyc_submitted'],
    description: 'User registration & identity updates',
  },
};

// Consistent key color palette from AGENTS.md / reference
const KEY_COLOR_MAP: Record<string, string> = {
  // Orders
  'order_1': 'var(--entity-1)',
  'order_2': 'var(--entity-2)',
  'order_3': 'var(--entity-3)',
  'order_6': 'var(--entity-4)',
  'order_4': 'var(--entity-5)',
  'order_7': 'var(--entity-6)',
  // Payments
  'pay_3': 'var(--entity-1)',
  'pay_1': 'var(--entity-2)',
  'pay_5': 'var(--entity-3)',
  'pay_4': 'var(--entity-4)',
  'pay_2': 'var(--entity-5)',
  'pay_7': 'var(--entity-6)',
  // Users
  'user_1': 'var(--entity-1)',
  'user_2': 'var(--entity-2)',
  'user_4': 'var(--entity-3)',
  'user_8': 'var(--entity-4)',
  'user_3': 'var(--entity-5)',
  'user_5': 'var(--entity-6)',
};

export const ProducerTopicPartitionsDemo: React.FC = () => {
  // Active topic state
  const [selectedTopic, setSelectedTopic] = useState<string>('orders.events');

  // Topic partition count (1-4, default 3)
  const [numPartitions, setNumPartitions] = useState<number>(3);

  // Producer form state
  const [selectedKey, setSelectedKey] = useState<string>('order_1');
  const [selectedEvent, setSelectedEvent] = useState<string>('order.created');
  const [isNullKey, setIsNullKey] = useState<boolean>(false);

  // Logs partitioned per topic: topicName -> partition index -> array of messages
  const [partitionLogsByTopic, setPartitionLogsByTopic] = useState<Record<string, KafkaMessage[][]>>({
    'orders.events': Array.from({ length: 3 }, () => []),
    'payments.events': Array.from({ length: 3 }, () => []),
    'users.events': Array.from({ length: 3 }, () => []),
  });

  // Round-robin index for null keys
  const [rrIndex, setRrIndex] = useState<number>(0);

  // Consumer groups: billing-group (default), analytics-group (optional pub/sub)
  const [groups, setGroups] = useState<ConsumerGroupState[]>([
    { id: 'billing-group', numConsumers: 1, committed: [0, 0, 0] },
  ]);

  // Last routing calculation text
  const [routingExplanation, setRoutingExplanation] = useState<string>(`
    <div class="space-y-1 text-xs text-theme-muted font-sans leading-relaxed">
      <div class="font-bold text-theme-text flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>💡 Key Partitioning Formula Preview:</span>
      </div>
      <p>Kafka me message bhejte hi key ka <b>Murmur2 Hash</b> nikala jata hai, use <b>& 0x7fffffff</b> se positive banaya jata hai, aur <b>% Partitions</b> karke Partition P0/P1/P2 decide hota hai. Upar "Send message" (<kbd class="font-mono text-[10px] bg-theme-surface border border-theme-border px-1 rounded">Space</kbd>) dabao aur live math breakdown dekho!</p>
    </div>
  `);

  // "What just happened?" status banner
  const [statusWhat, setStatusWhat] = useState<string>(
    'Producer se ek message bhejo aur dekho kis partition me jaata hai.'
  );
  const [statusWhy, setStatusWhy] = useState<string>(
    'Ek line me: key se partition decide hota hai, partition ke andar order guaranteed hai.'
  );

  // Newly produced cell for pop animation
  const [newCellTarget, setNewCellTarget] = useState<string | null>(null);

  // Event stream log & layout
  const [eventLogs, setEventLogs] = useState<Array<{ id: string; tag: string; type: string; text: string }>>([]);
  const [logLayout, setLogLayout] = useState<LogLayoutMode>('stacked');

  // Auto-produce and Auto-consume toggles
  const [autoProduce, setAutoProduce] = useState<boolean>(false);
  const [autoConsume, setAutoConsume] = useState<boolean>(false);

  // Collapsed "More options" state
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);
  const [seed, setSeed] = useState<number>(42);
  const [speed, setSpeed] = useState<number>(1);

  // Order lifecycle event index tracking per key: o-1001 -> 0 (created), 1 (paid), 2 (shipped)
  const keyEventIndexRef = useRef<Record<string, number>>({});

  const appendLog = useCallback((tag: string, type: 'produce' | 'consume' | 'rebalance', text: string) => {
    setEventLogs((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, tag, type, text },
      ...prev.slice(0, 59),
    ]);
  }, []);

  const getKeyColor = (key: string | null) => {
    if (key === null) return 'var(--color-muted)';
    return KEY_COLOR_MAP[key] || 'var(--entity-1)';
  };

  // Switch topic
  const handleTopicChange = (newTopic: string) => {
    if (!TOPIC_CATALOG[newTopic]) return;
    setSelectedTopic(newTopic);
    setSelectedKey(TOPIC_CATALOG[newTopic].defaultKey);
    setSelectedEvent(TOPIC_CATALOG[newTopic].events[0]);
    setStatusWhat(`Topic badla: ${newTopic} active hai.`);
    setStatusWhy(`Kafka me har topic ek independent category hoti hai jiske apne partitions hote hain.`);
    appendLog('topic', 'produce', `Switched active topic to ${newTopic}`);
  };

  // Switch event (synchronizes topic if event belongs to another domain)
  const handleEventChange = (newEvent: string) => {
    setSelectedEvent(newEvent);
    // Find which topic owns this event
    const parentTopic = Object.keys(TOPIC_CATALOG).find((t) =>
      TOPIC_CATALOG[t].events.includes(newEvent)
    );
    if (parentTopic && parentTopic !== selectedTopic) {
      setSelectedTopic(parentTopic);
      setSelectedKey(TOPIC_CATALOG[parentTopic].defaultKey);
      setStatusWhat(`Event ${newEvent} chuna -> Topic auto-sync hua: ${parentTopic}`);
    } else {
      setStatusWhat(`Event chuna: ${newEvent}`);
    }
  };

  // Current active partition logs
  const partitionLogs = partitionLogsByTopic[selectedTopic] || Array.from({ length: numPartitions }, () => []);

  // Reset Topic
  const handleReset = useCallback((pCount = numPartitions) => {
    setAutoProduce(false);
    setAutoConsume(false);
    setPartitionLogsByTopic((prev) => ({
      ...prev,
      [selectedTopic]: Array.from({ length: pCount }, () => []),
    }));
    setGroups([
      { id: `${selectedTopic.split('.')[0]}-workers`, numConsumers: 1, committed: Array(pCount).fill(0) },
    ]);
    setRrIndex(0);
    setNewCellTarget(null);
    setRoutingExplanation(`Topic ${selectedTopic} reset ho gaya. Naya message bhejo.`);
    setStatusWhat(`Topic ${selectedTopic} reset ho gaya.`);
    setStatusWhy('Sabhi offsets zero ho gaye. Naye messages shuru se append honge.');
    keyEventIndexRef.current = {};
    appendLog('topic', 'rebalance', `Topic ${selectedTopic} reset with ${pCount} partitions.`);
  }, [selectedTopic, numPartitions, appendLog]);

  const handlePartitionCountChange = (newCount: number) => {
    setNumPartitions(newCount);
    handleReset(newCount);
  };

  // Send a message
  const handleSendMessage = useCallback((overrideKey?: string | null, overrideEvent?: string) => {
    const topicConfig = TOPIC_CATALOG[selectedTopic] || TOPIC_CATALOG['orders.events'];
    const key = overrideKey !== undefined ? overrideKey : isNullKey ? null : selectedKey.trim() || topicConfig.defaultKey;
    const evt = overrideEvent || selectedEvent;

    let targetPartition: number;
    let explanation: string;

    if (key === null) {
      targetPartition = rrIndex % numPartitions;
      setRrIndex((prev) => prev + 1);
      explanation = `
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span class="text-theme-muted">Topic:</span> <b class="text-theme-accent">${selectedTopic}</b>
            <span class="text-theme-muted">|</span>
            <span class="text-theme-muted">Key:</span> <code>null</code>
            <span class="text-theme-muted">→</span>
            <span class="text-theme-muted">Partitioner:</span> <b>Round-Robin Spread</b>
            <span class="text-theme-muted">→</span>
            <span class="px-2 py-0.5 rounded bg-amber-500/20 text-theme-accent font-bold">Partition P${targetPartition}</span>
          </div>
          <div class="p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs leading-relaxed text-theme-muted space-y-1">
            <div class="font-bold text-theme-text">💡 Key null hone par:</div>
            <p>Kafka round-robin distribution use karta hai (P0 → P1 → P2...). Messages alag-alag partitions me bikhar jaate hain, isliye <b>per-key order guarantee nahi milti</b>.</p>
          </div>
        </div>
      `;
      setStatusWhat(`null key (${evt}) → ${selectedTopic} [P${targetPartition}]`);
      setStatusWhy('Key null hai, to messages partitions me bikhar gaye. Same order ka sequence ab guaranteed nahi.');
    } else {
      const routing = partitionForKey(key, numPartitions, rrIndex);
      targetPartition = routing.partition;
      explanation = `
        <div class="space-y-2.5">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
            <div class="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-0.5 shadow-xs">
              <span class="text-[10px] text-theme-muted block font-sans font-semibold uppercase tracking-wider">1. String to Hash</span>
              <div class="text-theme-text font-bold">murmur2("${key}")</div>
              <div class="text-theme-accent font-bold text-xs font-mono">= ${routing.hash}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-0.5 shadow-xs">
              <span class="text-[10px] text-theme-muted block font-sans font-semibold uppercase tracking-wider">2. Minus ko Plus Banaya</span>
              <div class="text-theme-text font-bold">& 0x7fffffff (toPositive)</div>
              <div class="text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono">= ${routing.positiveHash}</div>
            </div>
            <div class="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-0.5 shadow-xs">
              <span class="text-[10px] text-theme-muted block font-sans font-semibold uppercase tracking-wider">3. Modulo Partitions</span>
              <div class="text-theme-text font-bold">${routing.positiveHash} % ${numPartitions}</div>
              <div class="text-theme-accent font-bold text-xs font-mono">= Partition P${targetPartition}</div>
            </div>
          </div>

          <div class="p-2.5 rounded-lg bg-theme-surface border border-theme-border text-xs leading-relaxed space-y-1.5 font-sans">
            <div class="font-bold text-theme-text flex items-center gap-1.5">
              <span>💡 Ye formula kaise kaam karta hai? (Simple Hinglish me):</span>
            </div>
            <ul class="space-y-1 text-theme-muted list-disc list-inside text-[11.5px]">
              <li><b>murmur2("${key}") = ${routing.hash}</b>: Computer string ko direct divide nahi kar sakta. Murmur2 ise ek 32-bit unique integer number me convert karta hai.</li>
              <li><b>Kyun toPositive (& 0x7fffffff)?</b> Murmur2 ka result minus (-ve: <code>${routing.hash}</code>) ho sakta hai. Agar <code>${routing.hash} % ${numPartitions}</code> karte to computer result negative deta (jaise <code>-1</code>), lekin <b>Kafka me negative partition index exist nahi karta</b>! Isliye <code>& 0x7fffffff</code> se minus sign hata kar safe positive number (<code>${routing.positiveHash}</code>) banaya jata hai.</li>
              <li><b>Order Guarantee:</b> <code>"${key}"</code> ka hash hamesha yahi aayega, isliye is key ke saare events hamesha <b>Partition P${targetPartition}</b> me hi jayenge aur order maintain rahega!</li>
            </ul>
          </div>
        </div>
      `;
      setStatusWhat(`${key} (${evt}) → ${selectedTopic} [Partition ${targetPartition}]`);
      setStatusWhy(`Same key hamesha same partition me jaati hai. Isliye ${key} ke events ka order hamesha maintained rehta hai.`);
    }

    setRoutingExplanation(explanation);

    // Get current offset safely from state snapshot
    const topicLogs = partitionLogsByTopic[selectedTopic] || Array.from({ length: numPartitions }, () => []);
    const currentPartLog = topicLogs[targetPartition] || [];
    const newOffset = currentPartLog.length;

    const newMsg: KafkaMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      topic: selectedTopic,
      key,
      event: evt,
      offset: newOffset,
      partition: targetPartition,
      timestamp: Date.now(),
    };

    setNewCellTarget(`${targetPartition}:${newOffset}`);

    if (key !== null) {
      setStatusWhat(`${key} (${evt}) → ${selectedTopic} [P${targetPartition}, offset ${newOffset}]`);
    }

    // Append log outside functional state updater to prevent React StrictMode duplication
    appendLog(
      'produce',
      'produce',
      `${selectedTopic} P${targetPartition} @${newOffset}: ${key === null ? 'null' : key} (${evt})`
    );

    // Pure functional state update
    setPartitionLogsByTopic((prev) => {
      const prevTopicLogs = prev[selectedTopic] || Array.from({ length: numPartitions }, () => []);
      const nextTopicLogs = prevTopicLogs.map((partLog, p) =>
        p === targetPartition ? [...partLog, newMsg] : partLog
      );
      return {
        ...prev,
        [selectedTopic]: nextTopicLogs,
      };
    });
  }, [selectedTopic, isNullKey, selectedKey, selectedEvent, rrIndex, numPartitions, partitionLogsByTopic, appendLog]);

  // Burst: Send 6 events for current topic
  const handleSendBurst = () => {
    const topicConfig = TOPIC_CATALOG[selectedTopic] || TOPIC_CATALOG['orders.events'];
    topicConfig.presetKeys.forEach((k) => {
      const currentIdx = keyEventIndexRef.current[k] || 0;
      const evt = topicConfig.events[currentIdx % topicConfig.events.length];
      keyEventIndexRef.current[k] = (currentIdx + 1) % topicConfig.events.length;
      handleSendMessage(k, evt);
    });
    setStatusWhat(`Batch bheja: ${topicConfig.presetKeys.length} messages -> ${selectedTopic} partitions me distributed.`);
    setStatusWhy('Same key ke messages hamesha usi partition me jaate hain, par alag keys partitions me spread hoti hain.');
  };

  // Poll consumer group (single step consume)
  const handlePollGroup = (groupIndex: number) => {
    const targetGroup = groups[groupIndex];
    if (!targetGroup) return;

    const assignment = rangeAssign(targetGroup.numConsumers, numPartitions);
    let consumedCount = 0;
    const nextCommitted = [...targetGroup.committed];
    const logBatch: Array<{ tag: string; text: string }> = [];

    assignment.forEach((partitions, consumerIdx) => {
      partitions.forEach((p) => {
        const currentOffset = nextCommitted[p];
        const partitionData = partitionLogs[p] || [];
        if (partitionData[currentOffset]) {
          const msg = partitionData[currentOffset];
          nextCommitted[p] = currentOffset + 1;
          consumedCount++;
          logBatch.push({
            tag: `${targetGroup.id.split('-')[0]}-C${consumerIdx + 1}`,
            text: `P${p} @${currentOffset} ${msg.key === null ? 'null' : msg.key} ${msg.event} processed → commit ${currentOffset + 1}`,
          });
        }
      });
    });

    // Execute logging and status updates OUTSIDE the React state updater
    logBatch.forEach(({ tag, text }) => {
      appendLog(tag, 'consume', text);
    });

    if (consumedCount > 0) {
      setStatusWhat(`${targetGroup.id}: ${consumedCount} message process hue, offset commit ho gaya.`);
      setStatusWhy('Commit hamesha NEXT offset hota hai (processed + 1). Restart ke baad consumer wahin se aage padhega.');
    } else {
      setStatusWhat(`${targetGroup.id}: padhne ko kuch nahi bacha (lag = 0).`);
      setStatusWhy('Producer se naya message bhejo ya consumer add karo.');
    }

    // Pure functional state update
    setGroups((prevGroups) =>
      prevGroups.map((g, idx) => (idx === groupIndex ? { ...g, committed: nextCommitted } : g))
    );
  };

  // Add / Remove consumer from group
  const handleModifyConsumerCount = (groupIndex: number, delta: number) => {
    const g = groups[groupIndex];
    if (!g) return;

    const nextCount = g.numConsumers + delta;
    if (nextCount < 1 || nextCount > 5) return;

    const newAssignment = rangeAssign(nextCount, numPartitions)
      .map((parts, i) => `C${i + 1}=${parts.length ? parts.map((p) => 'P' + p).join(',') : 'idle'}`)
      .join('  ');

    // Run side-effects outside updater
    appendLog('rebalance', 'rebalance', `${g.id} → ${nextCount} consumer: ${newAssignment}`);
    setStatusWhat(`${g.id} me ${nextCount} consumer, rebalance hua: ${newAssignment}`);
    setStatusWhy(
      nextCount > numPartitions
        ? 'Consumers partitions se zyada hain, isliye kuch consumers idle hain. Max parallelism = partition count.'
        : 'Committed offsets group ke paas hain, isliye naya assignment bhi wahin se aage padhta hai.'
    );

    // Pure state update
    setGroups((prev) =>
      prev.map((grp, idx) => (idx === groupIndex ? { ...grp, numConsumers: nextCount } : grp))
    );
  };

  // Add analytics-group (pub/sub demonstration)
  const handleAddAnalyticsGroup = () => {
    if (groups.length > 1) return;
    setGroups((prev) => [
      ...prev,
      { id: 'analytics-group', numConsumers: 1, committed: Array(numPartitions).fill(0) },
    ]);
    appendLog('group', 'rebalance', 'analytics-group joined with its own offsets');
    setStatusWhat('analytics-group alag group hai, isliye use saare messages shuru se milenge.');
    setStatusWhy('Pub/Sub = alag consumer groups. Har group ke offsets independent hain (cell me B aur A badge dekho).');
  };

  // Auto-produce timer
  useEffect(() => {
    if (!autoProduce) return;
    const intervalMs = Math.max(200, 1000 / speed);
    const timer = setInterval(() => {
      const topicConfig = TOPIC_CATALOG[selectedTopic] || TOPIC_CATALOG['orders.events'];
      const randomKey = topicConfig.presetKeys[Math.floor(Math.random() * topicConfig.presetKeys.length)];
      const currentIdx = keyEventIndexRef.current[randomKey] || 0;
      const evt = topicConfig.events[currentIdx % topicConfig.events.length];
      keyEventIndexRef.current[randomKey] = (currentIdx + 1) % topicConfig.events.length;
      handleSendMessage(randomKey, evt);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoProduce, speed, selectedTopic, handleSendMessage]);

  // Auto-consume timer
  useEffect(() => {
    if (!autoConsume) return;
    const intervalMs = Math.max(300, 1500 / speed);
    const timer = setInterval(() => {
      groups.forEach((_, idx) => handlePollGroup(idx));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoConsume, speed, groups]);

  // Clean animation state after pop
  useEffect(() => {
    if (newCellTarget) {
      const timer = setTimeout(() => setNewCellTarget(null), 600);
      return () => clearTimeout(timer);
    }
  }, [newCellTarget]);

  // Keyboard accelerators: Space to send message, R to reset
  useEffect(() => {
    const onPrimary = () => handleSendMessage();
    const onReset = () => handleReset();
    window.addEventListener('lab:primary-action', onPrimary);
    window.addEventListener('lab:reset', onReset);
    return () => {
      window.removeEventListener('lab:primary-action', onPrimary);
      window.removeEventListener('lab:reset', onReset);
    };
  }, [handleSendMessage, handleReset]);

  return (
    <div className="w-full text-theme-text space-y-3 sm:space-y-4">
      <DemoCommandDeck
        title="Producer, topic and partitions"
        statusWhat={statusWhat}
        statusWhy={statusWhy}
        onReset={() => handleReset()}
      />

      <div className={logLayout === 'side' ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 items-start' : 'space-y-4'}>
        <div className={logLayout === 'side' ? 'lg:col-span-7 xl:col-span-8 space-y-4 min-w-0' : 'space-y-4'}>
          {/* 1. Producer Section Card */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-theme-border/60">
          <h3 className="text-sm sm:text-base font-bold text-theme-text flex items-center gap-2">
            <span>1. Producer Message Dispatcher</span>
          </h3>
          <span className="text-xs text-theme-muted font-mono">Murmur2 Partitioning</span>
        </div>

        {/* Form controls structured responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {/* Topic */}
          <div className="space-y-1">
            <label htmlFor="producer-topic" className="text-theme-muted text-xs font-semibold block">
              Topic
            </label>
            <select
              id="producer-topic"
              value={selectedTopic}
              onChange={(e) => handleTopicChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-theme-surface-alt border border-theme-border rounded-lg text-theme-text font-mono text-xs focus:outline-none cursor-pointer font-bold"
            >
              {Object.keys(TOPIC_CATALOG).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Key Input + Target Partition */}
          <div className="space-y-1">
            <label htmlFor="producer-key" className="text-theme-muted text-xs font-semibold block">
              Key ({selectedTopic.split('.')[0]}Id)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="producer-key"
                type="text"
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                disabled={isNullKey}
                className="flex-1 px-2.5 py-1.5 bg-theme-surface-alt border border-theme-border rounded-lg text-theme-text font-mono text-xs focus:outline-none focus:ring-2 focus:ring-theme-primary disabled:opacity-50"
              />
              <span
                className={`text-xs font-mono font-bold px-2 py-1 rounded border border-theme-border shrink-0 ${
                  isNullKey ? 'bg-theme-surface-alt text-theme-muted' : 'bg-theme-surface-alt text-theme-accent'
                }`}
                title="Target partition destination for this key"
              >
                {isNullKey ? '→ RR' : `→ P${partitionForKey(selectedKey, numPartitions).partition}`}
              </span>
            </div>
          </div>

          {/* Preset Keys */}
          <div className="space-y-1">
            <label className="text-theme-muted text-xs font-semibold block">
              Preset Key
            </label>
            <select
              value={selectedKey}
              onChange={(e) => {
                setSelectedKey(e.target.value);
                setIsNullKey(false);
              }}
              disabled={isNullKey}
              className="w-full px-2.5 py-1.5 bg-theme-surface-alt border border-theme-border rounded-lg text-theme-text font-mono text-xs focus:outline-none cursor-pointer disabled:opacity-50"
              aria-label="Preset Keys"
            >
              {(TOPIC_CATALOG[selectedTopic]?.presetKeys || []).map((k) => {
                const targetP = partitionForKey(k, numPartitions).partition;
                return (
                  <option key={k} value={k}>
                    {k} (→ P{targetP})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Event Selector & Null Key */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="producer-event" className="text-theme-muted text-xs font-semibold">
                Event Type
              </label>
              <label className="flex items-center gap-1 text-[11px] text-theme-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isNullKey}
                  onChange={(e) => setIsNullKey(e.target.checked)}
                  className="rounded border-theme-border text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>null key</span>
              </label>
            </div>
            <select
              id="producer-event"
              value={selectedEvent}
              onChange={(e) => handleEventChange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-theme-surface-alt border border-theme-border rounded-lg text-theme-text font-mono text-xs focus:outline-none cursor-pointer font-semibold"
            >
              {(TOPIC_CATALOG[selectedTopic]?.events || []).map((evt) => (
                <option key={evt} value={evt}>
                  {evt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-theme-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSendMessage()}
              className="px-4 py-1.5 bg-theme-primary text-theme-primary-text font-bold text-xs rounded-lg hover:bg-theme-primary-hover shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5"
            >
              <span>Send message</span>
              <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/15 text-stone-900 border border-black/10">Space</kbd>
            </button>

            <button
              type="button"
              onClick={handleSendBurst}
              className="px-3 py-1.5 bg-theme-surface-alt hover:bg-theme-border text-theme-text font-semibold text-xs rounded-lg border border-theme-border transition-colors shadow-2xs"
            >
              Send batch ({selectedTopic.split('.')[0]})
            </button>

            <button
              type="button"
              onClick={() => setAutoProduce(!autoProduce)}
              aria-pressed={autoProduce}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${
                autoProduce
                  ? 'bg-amber-500/20 border-theme-primary text-theme-accent ring-1 ring-theme-primary font-bold'
                  : 'bg-theme-surface-alt hover:bg-theme-border border-theme-border text-theme-text'
              }`}
            >
              {autoProduce ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Auto-produce</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="partition-select" className="text-theme-muted font-medium">
              Partitions:
            </label>
            <select
              id="partition-select"
              value={numPartitions}
              onChange={(e) => handlePartitionCountChange(parseInt(e.target.value, 10))}
              className="px-2.5 py-1 bg-theme-surface-alt border border-theme-border rounded-lg text-theme-text font-mono text-xs focus:outline-none cursor-pointer font-bold"
            >
              <option value={1}>1 Partition</option>
              <option value={2}>2 Partitions</option>
              <option value={3}>3 Partitions</option>
              <option value={4}>4 Partitions</option>
            </select>
          </div>
        </div>

        {/* Route Calculation Math Box */}
        <div className="p-3 bg-theme-surface-alt/70 border border-theme-border rounded-lg text-xs text-theme-text overflow-x-auto">
          <div dangerouslySetInnerHTML={{ __html: routingExplanation }} />
        </div>
      </section>

      {/* 2. Topic and Partitions Visualizer (The Core Board) */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-theme-border/60">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-theme-text">Topic Append-Only Log</h3>
            <code className="text-xs px-2 py-0.5 bg-theme-surface-alt border border-theme-border rounded text-theme-accent font-mono font-bold">
              {selectedTopic}
            </code>
          </div>
          <span className="text-xs text-theme-muted font-mono">{numPartitions} Partition Registers</span>
        </div>
        <p className="text-xs text-theme-muted mt-0.5">
          Har partition ek notebook register hai. Message cell ka <b className="text-theme-text font-mono font-bold">"off 0, off 1..."</b> = <b>Offset (Permanent Page Number)</b> jo kabhi change nahi hota.
        </p>

        {/* Partitions Append-Only Rows */}
        <div className="space-y-2 pt-1">
          {Array.from({ length: numPartitions }, (_, p) => {
            const messages = partitionLogs[p] || [];
            return (
              <div
                key={p}
                className="grid grid-cols-[44px_1fr] gap-3 items-center py-2 border-t first:border-t-0 border-dashed border-theme-border"
              >
                <div className="w-11 h-11 rounded-lg bg-theme-surface-alt border border-theme-border flex items-center justify-center font-mono font-bold text-sm text-theme-accent shrink-0 shadow-2xs">
                  P{p}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto py-1 min-h-[56px] no-scrollbar">
                  {messages.length === 0 ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-theme-border/70 text-xs text-theme-muted bg-theme-surface-alt/40 h-11">
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-muted/50" />
                      <span>khali log — Pehla message bhejo</span>
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-theme-surface text-theme-muted border border-theme-border">Space</kbd>
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isNew = newCellTarget === `${p}:${m.offset}`;
                      const isConsumedBilling = groups[0]?.committed[p] > m.offset;
                      const isConsumedAnalytics = groups[1]?.committed[p] > m.offset;

                      let badgeText = '';
                      if (isConsumedBilling && isConsumedAnalytics) badgeText = '✓B+A';
                      else if (isConsumedBilling) badgeText = '✓B';
                      else if (isConsumedAnalytics) badgeText = '✓A';

                      return (
                        <div
                          key={m.id}
                          className={`flex-shrink-0 min-w-[90px] h-11 px-2.5 py-1 bg-theme-surface-alt border border-theme-border rounded-lg font-mono text-xs transition-all relative select-none flex flex-col justify-center ${isNew ? 'scale-105 ring-2 ring-amber-500' : ''
                            } ${isConsumedBilling ? 'opacity-60' : 'opacity-100'}`}
                          style={{
                            borderLeftWidth: '4px',
                            borderLeftColor: getKeyColor(m.key),
                          }}
                          title={`(${m.topic || selectedTopic}, P${p}, offset ${m.offset})`}
                        >
                          {badgeText && (
                            <span className="absolute top-1 right-1.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              {badgeText}
                            </span>
                          )}
                          <div className="font-bold text-theme-text truncate pr-4 text-xs">
                            {m.key === null ? 'null' : m.key}
                          </div>
                          <div className="text-[10px] text-theme-muted">
                            off {m.offset} · {m.event.split('.')[1] || m.event}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. Consumer Groups Section */}
      <section className="bg-theme-surface border border-theme-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-theme-text">3. Consumer groups</h3>
            <p className="text-xs text-theme-muted mt-0.5">
              Consumer group partitions ko divide karta hai. Har partition ka ek group me sirf ek owner hota hai.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddAnalyticsGroup}
              disabled={groups.length > 1}
              className="px-3 py-1.5 bg-theme-surface-alt hover:bg-theme-border disabled:opacity-50 disabled:cursor-not-allowed text-theme-text text-xs font-semibold rounded-lg border border-theme-border transition-colors"
            >
              Add analytics-group (pub/sub)
            </button>

            <button
              type="button"
              onClick={() => setAutoConsume(!autoConsume)}
              aria-pressed={autoConsume}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${autoConsume
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                  : 'bg-theme-surface-alt hover:bg-theme-border border-theme-border text-theme-text'
                }`}
            >
              {autoConsume ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>Auto-consume</span>
            </button>
          </div>
        </div>

        {/* Concept Explainer: Offset, Next & Lag */}
        <div className="p-3 bg-theme-surface-alt/70 border border-theme-border rounded-xl text-xs space-y-1.5">
          <div className="font-bold text-theme-text flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Ek Line Me: Offset, Next aur Lag ka matlab</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5 text-[11px] leading-relaxed">
            <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-1">
              <strong className="text-theme-text font-bold flex items-center gap-1">
                <span>📖 1. Offset (Page Number)</span>
              </strong>
              <span className="text-theme-muted block">
                Partition ek notebook hai. Har message ko ek permanent number milta hai (<code>off 0, 1, 2...</code>). Ye number kabhi nahi badalta.
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-1">
              <strong className="text-theme-text font-bold flex items-center gap-1">
                <span>🔖 2. Next (Bookmark)</span>
              </strong>
              <span className="text-theme-muted block">
                Consumer ka bookmark. <code>next 0</code> ka matlab: consumer abhi offset 0 padhega. Read hone ke baad bookmark <code>next 1</code> ban jata hai.
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-theme-surface border border-theme-border space-y-1">
              <strong className="text-theme-text font-bold flex items-center gap-1">
                <span>⏳ 3. Lag (Pending Backlog)</span>
              </strong>
              <span className="text-theme-muted block">
                <code>Lag = Total Messages - Bookmark</code>. Kitne messages padhna baaki hain. <code>lag 0</code> matlab consumer upto date hai!
              </span>
            </div>
          </div>
        </div>

        {/* Group Lanes */}
        <div className="space-y-3">
          {groups.map((g, gIdx) => {
            const assignment = rangeAssign(g.numConsumers, numPartitions);
            const lagPerPartition = Array.from(
              { length: numPartitions },
              (_, p) => (partitionLogs[p]?.length || 0) - (g.committed[p] || 0)
            );
            const totalLag = lagPerPartition.reduce((a, b) => a + Math.max(0, b), 0);

            return (
              <div
                key={g.id}
                className="p-3.5 bg-theme-bg border border-theme-border rounded-xl space-y-2.5"
              >
                {/* Group Control Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-mono">
                    <strong className="text-sm text-theme-text font-bold">{g.id}</strong>
                    <span className="text-xs text-theme-muted">
                      consumers: <b className="text-theme-text">{g.numConsumers}</b> · total lag:{' '}
                      <b className="text-theme-accent">{totalLag}</b>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleModifyConsumerCount(gIdx, -1)}
                      disabled={g.numConsumers <= 1}
                      className="px-2.5 py-1 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt disabled:opacity-40 border border-theme-border rounded-md"
                      title="Remove consumer"
                    >
                      − consumer
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModifyConsumerCount(gIdx, 1)}
                      disabled={g.numConsumers >= 5}
                      className="px-2.5 py-1 text-xs font-medium bg-theme-surface hover:bg-theme-surface-alt disabled:opacity-40 border border-theme-border rounded-md"
                      title="Add consumer"
                    >
                      + consumer
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePollGroup(gIdx)}
                      className="px-3.5 py-1 bg-theme-primary text-theme-primary-text font-bold text-xs rounded-md hover:bg-theme-primary-hover shadow-sm"
                    >
                      Poll once
                    </button>
                  </div>
                </div>

                {/* Consumer Lanes */}
                <div className="space-y-1.5 pt-1">
                  {assignment.map((parts, cIdx) => (
                    <div key={cIdx} className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="font-bold text-theme-text w-7">C{cIdx + 1}</span>
                      {parts.length === 0 ? (
                        <span className="text-theme-muted italic text-[11px]">
                          idle: koi partition nahi mila (consumers &gt; partitions)
                        </span>
                      ) : (
                        parts.map((p) => {
                          const nextOff = g.committed[p] || 0;
                          const lag = Math.max(0, lagPerPartition[p]);
                          return (
                            <span
                              key={p}
                              title={`Partition P${p}: Consumer ka bookmark abhi offset ${nextOff} par hai. Is partition me ${lag} unread messages pending hain.`}
                              className="px-2.5 py-1 bg-theme-surface border border-theme-border rounded-full text-theme-text text-xs cursor-help"
                            >
                              P{p} · bookmark <b className="font-bold">next {nextOff}</b> · backlog{' '}
                              <b className={lag > 0 ? 'text-theme-accent font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                lag {lag}
                              </b>
                            </span>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>

        {/* Live Event Stream Log */}
        <div className={logLayout === 'side' ? 'lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 min-w-0' : 'w-full'}>
          <LiveEventLog
            title="Kafka Event Stream Log"
            entries={eventLogs.map((l) => ({
              id: l.id,
              tag: l.tag,
              type: l.type as any,
              message: l.text,
            }))}
            layout={logLayout}
            onLayoutChange={setLogLayout}
            onClear={() => setEventLogs([])}
            maxHeight={logLayout === 'side' ? 'max-h-[620px]' : 'max-h-56'}
          />
        </div>
      </div>

      {/* 7. Collapsed "More Options" Row (Direct Manipulation Beats Sliders) */}
      <div className="border border-theme-border rounded-xl overflow-hidden bg-theme-surface">
        <button
          type="button"
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className="w-full flex items-center justify-between p-3 bg-theme-surface-alt hover:bg-theme-border/50 text-xs font-semibold text-theme-text transition-colors select-none"
        >
          <span>More options (Simulation speed, seed &amp; state inspector)</span>
          {showMoreOptions ? <ChevronUp className="w-4 h-4 text-theme-muted" /> : <ChevronDown className="w-4 h-4 text-theme-muted" />}
        </button>

        {showMoreOptions && (
          <div className="p-4 space-y-4 border-t border-theme-border text-xs">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-theme-muted font-medium">Speed:</span>
                <input
                  type="range"
                  min="0.25"
                  max="4"
                  step="0.25"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-24 accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-theme-accent font-bold">{speed}x</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-theme-muted font-medium">Seed:</span>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)}
                  className="w-16 px-2 py-1 bg-theme-surface-alt border border-theme-border rounded font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-theme-border">
              <div className="text-[11px] font-mono text-theme-muted mb-1">State Inspector Snapshot:</div>
              <pre className="p-3 bg-stone-900 text-amber-400 font-mono text-[11px] rounded-lg overflow-x-auto max-h-40">
                {JSON.stringify(
                  {
                    numPartitions,
                    autoProduce,
                    autoConsume,
                    routingExplanation,
                    totalMessages: partitionLogs.reduce((acc, l) => acc + l.length, 0),
                    groups: groups.map((g) => ({
                      id: g.id,
                      consumers: g.numConsumers,
                      committedOffsets: g.committed,
                    })),
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer Notes Ref */}
      <div className="text-xs text-theme-muted pt-1">
        Notes ref: Day 38 sections 2 (Topic, Partition, Offset), 3 (Producer), 5 (Consumer Groups), 6 (Offsets).
      </div>
    </div>
  );
};

export default ProducerTopicPartitionsDemo;
