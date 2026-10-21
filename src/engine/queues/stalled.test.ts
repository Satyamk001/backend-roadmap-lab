import { describe, it, expect, beforeEach } from 'vitest';
import { BullStalledEngine } from './stalled';

describe('BullStalledEngine', () => {
  let engine: BullStalledEngine;

  beforeEach(() => {
    engine = new BullStalledEngine();
  });

  it('allows an idle worker to pick a job and acquire a lock', () => {
    const success = engine.pickJob();
    expect(success).toBe(true);

    const snapshot = engine.getSnapshot();
    expect(snapshot.activeJob).toBeDefined();
    expect(snapshot.activeJob?.id).toBe('pay_order_401');
    expect(snapshot.activeJob?.state).toBe('locked');
    expect(snapshot.activeJob?.lockTtl).toBe(8);

    const w1 = snapshot.workers.find((w) => w.id === 'w1');
    expect(w1?.status).toBe('processing');
    expect(w1?.currentJobId).toBe('pay_order_401');
  });

  it('renews heartbeat and resets lock TTL', () => {
    engine.pickJob();
    engine.tickClock();
    engine.tickClock();

    let snap = engine.getSnapshot();
    expect(snap.activeJob?.lockTtl).toBe(6);

    const renewed = engine.renewHeartbeat();
    expect(renewed).toBe(true);

    snap = engine.getSnapshot();
    expect(snap.activeJob?.lockTtl).toBe(8);
    const w1 = snap.workers.find((w) => w.id === 'w1');
    expect(w1?.heartbeatsSent).toBe(1);
  });

  it('triggers watchdog recovery when lock TTL expires after worker crashes', () => {
    engine.pickJob();
    engine.crashWorker('w1');

    const snapCrash = engine.getSnapshot();
    const w1 = snapCrash.workers.find((w) => w.id === 'w1');
    expect(w1?.status).toBe('crashed');

    // Tick until lock TTL hits 0
    for (let i = 0; i < 8; i++) {
      engine.tickClock();
    }

    const snapStalled = engine.getSnapshot();
    // Active job should now be cleared
    expect(snapStalled.activeJob).toBeUndefined();
    // Job should be put back into waiting queue with stalledCount incremented
    expect(snapStalled.waitingJobs.length).toBe(2);
    const recoveredJob = snapStalled.waitingJobs[0];
    expect(recoveredJob.id).toBe('pay_order_401');
    expect(recoveredJob.state).toBe('waiting');
    expect(recoveredJob.stalledCount).toBe(1);
  });

  it('protects against duplicate side-effects when idempotency is enabled', () => {
    engine.setIdempotency(true);
    engine.pickJob(); // First execution by W1
    let snap = engine.getSnapshot();
    expect(snap.sideEffectExecutionCount).toBe(1);

    // W1 crashes
    engine.crashWorker('w1');
    // Lock expires
    for (let i = 0; i < 8; i++) {
      engine.tickClock();
    }

    // W2 picks the re-queued stalled job
    engine.pickJob();
    snap = engine.getSnapshot();
    expect(snap.activeJob?.id).toBe('pay_order_401');
    expect(snap.duplicateDetected).toBe(true);
    // Because idempotency was on, side effect count must remain 1
    expect(snap.sideEffectExecutionCount).toBe(1);
  });

  it('executes duplicate side-effect if idempotency is disabled (demonstrating duplicate charge bug)', () => {
    engine.setIdempotency(false);
    engine.pickJob(); // First execution by W1
    let snap = engine.getSnapshot();
    expect(snap.sideEffectExecutionCount).toBe(1);

    // W1 freezes
    engine.freezeWorker('w1');
    for (let i = 0; i < 8; i++) {
      engine.tickClock();
    }

    // W2 picks up stalled job
    engine.pickJob();
    snap = engine.getSnapshot();
    expect(snap.activeJob?.id).toBe('pay_order_401');
    expect(snap.duplicateDetected).toBe(true);
    // Because idempotency is false, side effect executed again!
    expect(snap.sideEffectExecutionCount).toBe(2);
  });

  it('cleanly completes a job and releases worker', () => {
    engine.pickJob();
    const success = engine.completeJob();
    expect(success).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.activeJob).toBeUndefined();
    expect(snap.completedJobs.length).toBe(1);
    expect(snap.completedJobs[0].id).toBe('pay_order_401');
    const w1 = snap.workers.find((w) => w.id === 'w1');
    expect(w1?.status).toBe('idle');
  });
});
