import { describe, it, expect, beforeEach } from 'vitest';
import { BullJobLifecycleEngine } from './lifecycle';

describe('BullJobLifecycleEngine', () => {
  let engine: BullJobLifecycleEngine;

  beforeEach(() => {
    engine = new BullJobLifecycleEngine();
  });

  it('initializes with seed jobs in wait state', () => {
    const snap = engine.getSnapshot();
    expect(snap.waiting.length).toBe(2);
    expect(snap.active.length).toBe(0);
    expect(snap.workers.length).toBe(2);
    expect(snap.workers.every((w) => w.status === 'idle')).toBe(true);
  });

  it('allows adding regular and delayed jobs', () => {
    const normalId = engine.addJob('email:digest', { user: 'u1' });
    const delayedId = engine.addJob('email:reminder', { user: 'u2' }, 3, 5);

    const snap = engine.getSnapshot();
    expect(snap.waiting.some((j) => j.id === normalId)).toBe(true);
    expect(snap.delayed.some((j) => j.id === delayedId)).toBe(true);
  });

  it('worker picks job atomically from waiting to active with lock', () => {
    const picked = engine.stepPick();
    expect(picked).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.waiting.length).toBe(1);
    expect(snap.active.length).toBe(1);

    const activeJob = snap.active[0];
    expect(activeJob.workerId).toBe('w1');
    expect(activeJob.lockTtl).toBeGreaterThan(0);
    expect(activeJob.attemptsMade).toBe(1);

    const busyWorker = snap.workers.find((w) => w.id === 'w1');
    expect(busyWorker?.status).toBe('busy');
    expect(busyWorker?.currentJobId).toBe(activeJob.id);
  });

  it('completes an active job and frees the worker', () => {
    engine.stepPick();
    const snapBefore = engine.getSnapshot();
    const activeId = snapBefore.active[0].id;

    const completed = engine.completeJob(activeId);
    expect(completed).toBe(true);

    const snapAfter = engine.getSnapshot();
    expect(snapAfter.active.length).toBe(0);
    expect(snapAfter.completed.length).toBe(1);
    expect(snapAfter.completed[0].id).toBe(activeId);
    expect(snapAfter.completed[0].returnValue).toBeDefined();

    const worker = snapAfter.workers.find((w) => w.id === 'w1');
    expect(worker?.status).toBe('idle');
  });

  it('schedules retry into delayed set when attempts remain', () => {
    engine.stepPick();
    const failed = engine.failJob(undefined, false);
    expect(failed).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.active.length).toBe(0);
    expect(snap.delayed.length).toBe(1); // Backoff retry
    expect(snap.delayed[0].delayRemaining).toBeGreaterThan(0);
    expect(snap.failed.length).toBe(0);
  });

  it('moves job to failed state when max attempts are reached', () => {
    // Add job with maxAttempts = 1
    const testId = engine.addJob('critical:sms', { phone: '123' }, 1);

    // Pick until testId is active
    engine.stepPick(); // picks seed 1
    engine.stepPick(); // picks seed 2
    engine.completeJob(); // frees a worker
    engine.stepPick(); // picks testId

    const snapActive = engine.getSnapshot();
    const target = snapActive.active.find((j) => j.id === testId);
    expect(target).toBeDefined();

    // Fail it
    engine.failJob(testId, false);

    const snapFinal = engine.getSnapshot();
    expect(snapFinal.failed.some((j) => j.id === testId)).toBe(true);
    expect(snapFinal.delayed.some((j) => j.id === testId)).toBe(false);
  });

  it('countdown moves delayed jobs to waiting on clock ticks', () => {
    const delayedId = engine.addJob('report:weekly', {}, 3, 2);

    expect(engine.getSnapshot().delayed.some((j) => j.id === delayedId)).toBe(true);

    engine.advanceClock();
    expect(engine.getSnapshot().delayed.some((j) => j.id === delayedId)).toBe(true);

    engine.advanceClock();
    const snap = engine.getSnapshot();
    expect(snap.delayed.some((j) => j.id === delayedId)).toBe(false);
    expect(snap.waiting.some((j) => j.id === delayedId)).toBe(true);
  });
});
