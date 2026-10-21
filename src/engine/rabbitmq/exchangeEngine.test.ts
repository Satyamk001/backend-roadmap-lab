import { describe, it, expect } from 'vitest';
import { RabbitMqExchangeEngine } from './exchangeEngine';

describe('RabbitMQ Exchange Engine', () => {
  const bindings = [
    { id: 'b1', queueId: 'q-billing', queueName: 'billing.queue', bindingKey: 'order.created' },
    { id: 'b2', queueId: 'q-email', queueName: 'email.queue', bindingKey: 'order.*' },
    { id: 'b3', queueId: 'q-analytics', queueName: 'analytics.queue', bindingKey: '#' },
    { id: 'b4', queueId: 'q-alerts', queueName: 'alerts.queue', bindingKey: '*.failed' },
  ];

  it('routes correctly with Direct exchange (exact match only)', () => {
    const engine = new RabbitMqExchangeEngine(
      { name: 'test.direct', type: 'direct' },
      bindings
    );

    // Exact match for billing
    const res1 = engine.route('order.created');
    expect(res1.matchedQueueIds).toEqual(['q-billing']);
    expect(res1.unrouted).toBe(false);

    // Mismatch - no exact match exists for order.created.in
    const res2 = engine.route('order.created.in');
    expect(res2.matchedQueueIds).toEqual([]);
    expect(res2.unrouted).toBe(true);
  });

  it('routes correctly with Fanout exchange (broadcasts to all bound queues)', () => {
    const engine = new RabbitMqExchangeEngine(
      { name: 'test.fanout', type: 'fanout' },
      bindings
    );

    // Routing key is completely ignored in Fanout
    const res = engine.route('random.key.xyz');
    expect(res.matchedQueueIds).toHaveLength(4);
    expect(res.matchedQueueIds).toContain('q-billing');
    expect(res.matchedQueueIds).toContain('q-email');
    expect(res.matchedQueueIds).toContain('q-analytics');
    expect(res.matchedQueueIds).toContain('q-alerts');
  });

  it('routes correctly with Topic exchange (* and # wildcards)', () => {
    const engine = new RabbitMqExchangeEngine(
      { name: 'test.topic', type: 'topic' },
      bindings
    );

    // 'order.created' matches:
    // - b1: 'order.created' (exact) -> q-billing
    // - b2: 'order.*' (* = 1 word) -> q-email
    // - b3: '#' (all) -> q-analytics
    const res1 = engine.route('order.created');
    expect(res1.matchedQueueIds).toContain('q-billing');
    expect(res1.matchedQueueIds).toContain('q-email');
    expect(res1.matchedQueueIds).toContain('q-analytics');
    expect(res1.matchedQueueIds).not.toContain('q-alerts');

    // 'order.created.in' (3 words) matches:
    // - b1: no (exact)
    // - b2: no (order.* requires exactly 1 word)
    // - b3: yes (# matches multiple words) -> q-analytics
    const res2 = engine.route('order.created.in');
    expect(res2.matchedQueueIds).toEqual(['q-analytics']);

    // 'payment.failed' matches:
    // - b3: '#' -> q-analytics
    // - b4: '*.failed' -> q-alerts
    const res3 = engine.route('payment.failed');
    expect(res3.matchedQueueIds).toContain('q-analytics');
    expect(res3.matchedQueueIds).toContain('q-alerts');
    expect(res3.matchedQueueIds).not.toContain('q-billing');
  });

  it('deduplicates deliveries to the same queue with multiple matching bindings', () => {
    const multiBindings = [
      { id: 'b1', queueId: 'q-orders', queueName: 'orders.queue', bindingKey: 'order.created' },
      { id: 'b2', queueId: 'q-orders', queueName: 'orders.queue', bindingKey: 'order.*' },
    ];
    const engine = new RabbitMqExchangeEngine(
      { name: 'test.topic', type: 'topic' },
      multiBindings
    );

    // Both b1 and b2 match 'order.created', but q-orders should only appear once
    const res = engine.route('order.created');
    expect(res.matchedQueueIds).toEqual(['q-orders']);
    expect(res.matchedQueueIds).toHaveLength(1);
  });

  it('routes to alternate exchange when no bindings match', () => {
    const engine = new RabbitMqExchangeEngine(
      {
        name: 'test.direct',
        type: 'direct',
        alternateExchange: 'unrouted.fanout',
      },
      bindings
    );

    const res = engine.route('unmatched.key');
    expect(res.unrouted).toBe(true);
    expect(res.alternateExchangeUsed).toBe('unrouted.fanout');
  });
});
