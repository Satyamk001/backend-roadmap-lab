import { describe, it, expect } from 'vitest';
import { matchesTopic } from './topicMatcher';

describe('RabbitMQ Topic Pattern Matcher', () => {
  it('matches exact literal keys without wildcards', () => {
    expect(matchesTopic('order.created', 'order.created')).toBe(true);
    expect(matchesTopic('order.created', 'order.paid')).toBe(false);
    expect(matchesTopic('order', 'order')).toBe(true);
    expect(matchesTopic('order', 'order.created')).toBe(false);
  });

  it('handles single-word wildcard * correctly', () => {
    // * matches exactly 1 word
    expect(matchesTopic('order.*', 'order.created')).toBe(true);
    expect(matchesTopic('order.*', 'order.paid')).toBe(true);
    expect(matchesTopic('order.*', 'order.created.in')).toBe(false); // 3 words, * is only 1
    expect(matchesTopic('order.*', 'order')).toBe(false); // 0 words after order
    expect(matchesTopic('*.failed', 'payment.failed')).toBe(true);
    expect(matchesTopic('*.failed', 'payment.retry.failed')).toBe(false);
    expect(matchesTopic('*.*', 'order.created')).toBe(true);
    expect(matchesTopic('*.*', 'order')).toBe(false);
    expect(matchesTopic('*.*', 'order.created.in')).toBe(false);
  });

  it('handles multi-word wildcard # correctly', () => {
    // # matches 0 or more words
    expect(matchesTopic('#', 'order.created.in')).toBe(true);
    expect(matchesTopic('#', 'order')).toBe(true);
    expect(matchesTopic('#', '')).toBe(true);

    expect(matchesTopic('order.#', 'order')).toBe(true); // 0 words
    expect(matchesTopic('order.#', 'order.created')).toBe(true); // 1 word
    expect(matchesTopic('order.#', 'order.created.in')).toBe(true); // 2 words
    expect(matchesTopic('order.#', 'user.created')).toBe(false);

    expect(matchesTopic('*.failed', 'payment.failed')).toBe(true);
    expect(matchesTopic('#.failed', 'payment.retry.failed')).toBe(true);
    expect(matchesTopic('#.failed', 'failed')).toBe(true);
    expect(matchesTopic('#.failed', 'payment.success')).toBe(false);
  });

  it('handles combinations of * and #', () => {
    expect(matchesTopic('app.*.service.#', 'app.orders.service.checkout.v1')).toBe(true);
    expect(matchesTopic('app.*.service.#', 'app.orders.service')).toBe(true);
    expect(matchesTopic('app.*.service.#', 'app.orders.other.v1')).toBe(false);
    expect(matchesTopic('app.*.service.*', 'app.orders.service.checkout')).toBe(true);
    expect(matchesTopic('app.*.service.*', 'app.orders.service.checkout.extra')).toBe(false);
  });
});
