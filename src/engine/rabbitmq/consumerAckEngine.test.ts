import { describe, it, expect } from 'vitest';
import { RabbitMqConsumerAckEngine } from './consumerAckEngine';

describe('RabbitMQ Consumer Ack Engine', () => {
  it('delivers messages and deletes them upon manual ch.ack', () => {
    const engine = new RabbitMqConsumerAckEngine(false);
    const msg = engine.publish('order-1');
    expect(engine.getSnapshot().readyQueue).toHaveLength(1);

    // Dispatch to worker 1
    engine.dispatchNext();
    let snap = engine.getSnapshot();
    expect(snap.readyQueue).toHaveLength(0);
    expect(snap.unackedMessages).toHaveLength(1);
    expect(snap.unackedMessages[0].id).toBe(msg.id);
    expect(snap.workers[0].status).toBe('processing');

    // Ack by worker 1
    engine.ack('w-1');
    snap = engine.getSnapshot();
    expect(snap.unackedMessages).toHaveLength(0);
    expect(snap.ackedMessages).toHaveLength(1);
    expect(snap.workers[0].status).toBe('idle');
  });

  it('requeues messages with redelivered: true on nack(requeue=true)', () => {
    const engine = new RabbitMqConsumerAckEngine(false);
    engine.publish('order-2');
    engine.dispatchNext();

    // Nack with requeue=true
    engine.nack('w-1', true);
    const snap = engine.getSnapshot();
    expect(snap.unackedMessages).toHaveLength(0);
    expect(snap.readyQueue).toHaveLength(1);
    expect(snap.readyQueue[0].redelivered).toBe(true);
  });

  it('dead-letters message on nack(requeue=false)', () => {
    const engine = new RabbitMqConsumerAckEngine(false);
    engine.publish('order-poison');
    engine.dispatchNext();

    // Nack with requeue=false
    engine.nack('w-1', false);
    const snap = engine.getSnapshot();
    expect(snap.unackedMessages).toHaveLength(0);
    expect(snap.readyQueue).toHaveLength(0);
    expect(snap.deadLetterQueue).toHaveLength(1);
    expect(snap.deadLetterQueue[0].state).toBe('dead_lettered');
  });

  it('requeues unacked messages when worker crashes in manual ack mode', () => {
    const engine = new RabbitMqConsumerAckEngine(false);
    engine.publish('order-crash-test');
    engine.dispatchNext();

    expect(engine.getSnapshot().unackedMessages).toHaveLength(1);

    // Crash worker 1
    engine.crashWorker('w-1');
    const snap = engine.getSnapshot();
    expect(snap.workers[0].status).toBe('crashed');
    expect(snap.unackedMessages).toHaveLength(0);
    expect(snap.readyQueue).toHaveLength(1);
    expect(snap.readyQueue[0].redelivered).toBe(true);
  });

  it('permanently loses in-flight message when worker crashes in auto-ack mode', () => {
    const engine = new RabbitMqConsumerAckEngine(true); // autoAck = true
    engine.publish('telemetry-1');
    engine.dispatchNext();

    // In auto-ack, readyQueue becomes empty immediately
    expect(engine.getSnapshot().readyQueue).toHaveLength(0);

    // Crash worker 1 while working on auto-acked job
    engine.crashWorker('w-1');
    const snap = engine.getSnapshot();
    expect(snap.readyQueue).toHaveLength(0);
    expect(snap.lostMessages).toHaveLength(1);
    expect(snap.lostMessages[0].payload).toBe('telemetry-1');
  });
});
