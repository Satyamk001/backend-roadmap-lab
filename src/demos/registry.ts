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
  'redis-data-structures': React.lazy(() => import('./s4-caching-redis/day-22/RedisStructuresDemo')),
  'redis-ttl-eviction': React.lazy(() => import('./s4-caching-redis/day-22/TtlEvictionDemo')),
  'redis-rdb-aof-persistence': React.lazy(() => import('./s4-caching-redis/day-22/PersistenceDemo')),
  'redis-structures-explorer': React.lazy(() => import('./s4-caching-redis/day-22/RedisStructuresDemo')),

  // Day 1: Node.js Event Loop
  'event-loop-visualizer': React.lazy(() => import('./s1-nodejs-internals/day-01/EventLoopVisualizerDemo')),
};

export function getDemoComponent(demoId: string): React.LazyExoticComponent<React.ComponentType<any>> {
  return demoRegistry[demoId] || React.lazy(() => import('./placeholder/PlaceholderDemo'));
}

export function registerDemo(demoId: string, loader: () => Promise<{ default: React.ComponentType<any> }>) {
  demoRegistry[demoId] = React.lazy(loader);
}
