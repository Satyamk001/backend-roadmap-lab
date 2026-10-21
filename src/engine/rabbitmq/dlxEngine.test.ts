import { describe, it, expect } from 'vitest';
import { RabbitMqDlxEngine } from './dlxEngine';

describe('RabbitMQ DLX & Retry Engine', () => {
  it('processes normal jobs successfully and deletes them', () => {
    const engine = new RabbitMqDlxEngine();
    engine.publish('normal');

    // First step: picks up job
    engine.step();
    expect(engine.getSnapshot().activeJob).toBeDefined();

    // Second step: processes and acks job
    engine.step();
    const snap = engine.getSnapshot();
    expect(snap.completed).toHaveLength(1);
    expect(snap.activeJob).toBeUndefined();
  });

  it('routes poison jobs through retry queue with TTL backoff', () => {
    const engine = new RabbitMqDlxEngine();
    const poison = engine.publish('poison');

    // Step 1: worker picks up poison job
    engine.step();
    expect(engine.getSnapshot().activeJob?.id).toBe(poison.id);

    // Step 2: worker fails and nacks -> sent to retry queue with TTL
    engine.step();
    let snap = engine.getSnapshot();
    expect(snap.retryQueue).toHaveLength(1);
    expect(snap.retryQueue[0].deathCount).toBe(1);
    expect(snap.retryQueue[0].ttlRemaining).toBe(2);

    // Step 3: 1 tick passes in retry queue
    engine.step();
    snap = engine.getSnapshot();
    expect(snap.retryQueue[0].ttlRemaining).toBe(1);

    // Step 4: TTL reaches 0 -> re-routed back to main queue / worker picks it up
    engine.step();
    snap = engine.getSnapshot();
    expect(snap.retryQueue).toHaveLength(0);
    // Since worker was free, worker picked up the expired retry job for attempt 2
    expect(snap.activeJob?.id).toBe(poison.id);
  });

  it('quarantines message into DLQ when max retries are exhausted', () => {
    const engine = new RabbitMqDlxEngine();
    engine.publish('poison');

    // Run multiple cycles until max retries exhausted
    for (let i = 0; i < 15; i++) {
      engine.step();
    }

    const snap = engine.getSnapshot();
    expect(snap.dlq).toHaveLength(1);
    expect(snap.dlq[0].deathCount).toBeGreaterThanOrEqual(2);
    expect(snap.dlq[0].state).toBe('dlq');
  });

  it('allows manual replay of quarantined DLQ messages after bug fix', () => {
    const engine = new RabbitMqDlxEngine();
    engine.publish('poison');

    for (let i = 0; i < 15; i++) {
      engine.step();
    }

    expect(engine.getSnapshot().dlq).toHaveLength(1);
    const dlqMsgId = engine.getSnapshot().dlq[0].id;

    // Replay message
    const replayed = engine.replayDlq(dlqMsgId);
    expect(replayed).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.dlq).toHaveLength(0);
    expect(snap.mainQueue).toHaveLength(1);
    expect(snap.mainQueue[0].type).toBe('normal'); // Fixed before replay
  });
});
