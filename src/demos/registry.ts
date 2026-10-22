import React from 'react';

type DemoLoader = () => Promise<{ default: React.ComponentType<any> }>;

const demoLoaders: Record<string, DemoLoader> = {
  // Day 38: Kafka Demos (in story order)
  'kafka-producer-partitions': () => import('./s6-queues-async/day-38/ProducerTopicPartitionsDemo'),
  'kafka-consumers-groups': () => import('./s6-queues-async/day-38/ConsumersGroupsDemo'),
  'kafka-offsets-lag': () => import('./s6-queues-async/day-38/OffsetsLagDemo'),
  'kafka-rebalance': () => import('./s6-queues-async/day-38/RebalanceDemo'),
  'kafka-acks-replication': () => import('./s6-queues-async/day-38/AcksReplicationDemo'),
  'kafka-retries-dlq': () => import('./s6-queues-async/day-38/RetriesDlqDemo'),

  // Day 37: RabbitMQ (in story order)
  'rabbitmq-exchange-types': () => import('./s6-queues-async/day-37/ExchangeTypesDemo'),
  'rabbitmq-topic-wildcards': () => import('./s6-queues-async/day-37/TopicWildcardsDemo'),
  'rabbitmq-pubsub-workqueue': () => import('./s6-queues-async/day-37/PubSubWorkQueueDemo'),
  'rabbitmq-consumer-acks': () => import('./s6-queues-async/day-37/ConsumerAcksDemo'),
  'rabbitmq-prefetch-qos': () => import('./s6-queues-async/day-37/PrefetchQoSDemo'),
  'rabbitmq-dlx-retries': () => import('./s6-queues-async/day-37/DlxRetriesDemo'),

  // Day 35: BullMQ (in story order: Beginner to Advanced)
  'queue-sync-vs-async': () => import('./s6-queues-async/day-35/SyncVsAsyncQueueDemo'),
  'bullmq-job-lifecycle': () => import('./s6-queues-async/day-35/JobLifecycleDemo'),
  'bullmq-worker-locks': () => import('./s6-queues-async/day-35/WorkerLocksStalledDemo'),
  'bullmq-backoff-dlq': () => import('./s6-queues-async/day-35/BackoffDlqDemo'),
  'bullmq-pipeline': () => import('./s6-queues-async/day-35/JobLifecycleDemo'),

  // Day 22: Redis (in story order)
  'redis-string-value': () => import('./s4-caching-redis/day-22/StringDemo'),
  'redis-hash-session': () => import('./s4-caching-redis/day-22/HashDemo'),
  'redis-list-vs-set': () => import('./s4-caching-redis/day-22/ListSetDemo'),
  'redis-zset-leaderboard': () => import('./s4-caching-redis/day-22/ZSetDemo'),
  'redis-ttl-vs-eviction': () => import('./s4-caching-redis/day-22/TtlVsEvictionDemo'),
  'redis-rdb-vs-aof': () => import('./s4-caching-redis/day-22/RdbVsAofDemo'),

  // Day 1: Node.js Internals & Event Loop (in story order 1-6)
  'node-stack-gec': () => import('./s1-nodejs-internals/day-01/StackGecDemo'),
  'node-architecture-libuv': () => import('./s1-nodejs-internals/day-01/NodeArchDemo'),
  'node-event-loop-phases': () => import('./s1-nodejs-internals/day-01/EventLoopPhasesDemo'),
  'node-microtasks-macrotasks': () => import('./s1-nodejs-internals/day-01/MicrotasksMacrotasksDemo'),
  'node-predict-output': () => import('./s1-nodejs-internals/day-01/PredictOutputDemo'),
  'node-breaking-loop': () => import('./s1-nodejs-internals/day-01/BreakingLoopDemo'),
  'event-loop-visualizer': () => import('./s1-nodejs-internals/day-01/EventLoopPhasesDemo'),
};

// Lazy-loaded demo registry mapping demo IDs to dedicated components
export const demoRegistry: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = Object.fromEntries(
  Object.entries(demoLoaders).map(([key, loader]) => [key, React.lazy(loader)])
);

export function getDemoComponent(demoId: string): React.LazyExoticComponent<React.ComponentType<any>> {
  return demoRegistry[demoId] || React.lazy(() => import('./placeholder/PlaceholderDemo'));
}

export function preloadDemo(demoId: string): void {
  const loader = demoLoaders[demoId];
  if (loader) {
    loader();
  }
}

export function registerDemo(demoId: string, loader: DemoLoader) {
  demoLoaders[demoId] = loader;
  demoRegistry[demoId] = React.lazy(loader);
}
