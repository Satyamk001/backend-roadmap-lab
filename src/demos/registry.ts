import React from 'react';

// Lazy-loaded demo registry mapping demo IDs to dedicated components
export const demoRegistry: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Day 38: Kafka Demos (in story order)
  'kafka-producer-partitions': React.lazy(() => import('./s6-queues-async/day-38/ProducerTopicPartitionsDemo')),
  'kafka-consumers-groups': React.lazy(() => import('./s6-queues-async/day-38/ConsumersGroupsDemo')),
  'kafka-offsets-lag': React.lazy(() => import('./s6-queues-async/day-38/OffsetsLagDemo')),
  'kafka-rebalance': React.lazy(() => import('./s6-queues-async/day-38/RebalanceDemo')),
  'kafka-acks-replication': React.lazy(() => import('./s6-queues-async/day-38/AcksReplicationDemo')),
  'kafka-retries-dlq': React.lazy(() => import('./s6-queues-async/day-38/RetriesDlqDemo')),

  // Day 37: RabbitMQ (in story order)
  'rabbitmq-exchange-types': React.lazy(() => import('./s6-queues-async/day-37/ExchangeTypesDemo')),
  'rabbitmq-topic-wildcards': React.lazy(() => import('./s6-queues-async/day-37/TopicWildcardsDemo')),
  'rabbitmq-pubsub-workqueue': React.lazy(() => import('./s6-queues-async/day-37/PubSubWorkQueueDemo')),
  'rabbitmq-consumer-acks': React.lazy(() => import('./s6-queues-async/day-37/ConsumerAcksDemo')),
  'rabbitmq-prefetch-qos': React.lazy(() => import('./s6-queues-async/day-37/PrefetchQoSDemo')),
  'rabbitmq-dlx-retries': React.lazy(() => import('./s6-queues-async/day-37/DlxRetriesDemo')),

  // Day 35: BullMQ (in story order: Beginner to Advanced)
  'queue-sync-vs-async': React.lazy(() => import('./s6-queues-async/day-35/SyncVsAsyncQueueDemo')),
  'bullmq-job-lifecycle': React.lazy(() => import('./s6-queues-async/day-35/JobLifecycleDemo')),
  'bullmq-worker-locks': React.lazy(() => import('./s6-queues-async/day-35/WorkerLocksStalledDemo')),
  'bullmq-backoff-dlq': React.lazy(() => import('./s6-queues-async/day-35/BackoffDlqDemo')),
  'bullmq-pipeline': React.lazy(() => import('./s6-queues-async/day-35/JobLifecycleDemo')),

  // Day 22: Redis (in story order)
  'redis-string-value': React.lazy(() => import('./s4-caching-redis/day-22/StringDemo')),
  'redis-hash-session': React.lazy(() => import('./s4-caching-redis/day-22/HashDemo')),
  'redis-list-vs-set': React.lazy(() => import('./s4-caching-redis/day-22/ListSetDemo')),
  'redis-zset-leaderboard': React.lazy(() => import('./s4-caching-redis/day-22/ZSetDemo')),
  'redis-ttl-vs-eviction': React.lazy(() => import('./s4-caching-redis/day-22/TtlVsEvictionDemo')),
  'redis-rdb-vs-aof': React.lazy(() => import('./s4-caching-redis/day-22/RdbVsAofDemo')),

  // Day 1: Node.js Internals & Event Loop (in story order 1-6)
  'node-stack-gec': React.lazy(() => import('./s1-nodejs-internals/day-01/StackGecDemo')),
  'node-architecture-libuv': React.lazy(() => import('./s1-nodejs-internals/day-01/NodeArchDemo')),
  'node-event-loop-phases': React.lazy(() => import('./s1-nodejs-internals/day-01/EventLoopPhasesDemo')),
  'node-microtasks-macrotasks': React.lazy(() => import('./s1-nodejs-internals/day-01/MicrotasksMacrotasksDemo')),
  'node-predict-output': React.lazy(() => import('./s1-nodejs-internals/day-01/PredictOutputDemo')),
  'node-breaking-loop': React.lazy(() => import('./s1-nodejs-internals/day-01/BreakingLoopDemo')),
  'event-loop-visualizer': React.lazy(() => import('./s1-nodejs-internals/day-01/EventLoopPhasesDemo')),
};

export function getDemoComponent(demoId: string): React.LazyExoticComponent<React.ComponentType<any>> {
  return demoRegistry[demoId] || React.lazy(() => import('./placeholder/PlaceholderDemo'));
}

export function registerDemo(demoId: string, loader: () => Promise<{ default: React.ComponentType<any> }>) {
  demoRegistry[demoId] = React.lazy(loader);
}
