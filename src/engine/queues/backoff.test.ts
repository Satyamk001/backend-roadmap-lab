import { describe, it, expect, beforeEach } from 'vitest';
import { BullBackoffEngine } from './backoff';

describe('BullBackoffEngine', () => {
  let engine: BullBackoffEngine;

  beforeEach(() => {
    engine = new BullBackoffEngine();
  });

  it('initializes with default webhook job in waiting list', () => {
    const snap = engine.getSnapshot();
    expect(snap.waitingJobs.length).toBe(1);
    expect(snap.waitingJobs[0].id).toBe('job_webhook_901');
    expect(snap.waitingJobs[0].attempts).toBe(0);
  });

  it('moves job to active on pickJob and increments attempt counter', () => {
    const picked = engine.pickJob();
    expect(picked).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.activeJob).toBeDefined();
    expect(snap.activeJob?.id).toBe('job_webhook_901');
    expect(snap.activeJob?.attempts).toBe(1);
    expect(snap.waitingJobs.length).toBe(0);
  });

  it('completes job when succeedJob is called', () => {
    engine.pickJob();
    const succeeded = engine.succeedJob();
    expect(succeeded).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.activeJob).toBeUndefined();
    expect(snap.completedJobs.length).toBe(1);
    expect(snap.completedJobs[0].id).toBe('job_webhook_901');
  });

  it('sends job to delayed set with exponential backoff on failure', () => {
    engine.pickJob(); // attempt 1
    engine.failJob('503 Service Unavailable');

    let snap = engine.getSnapshot();
    expect(snap.activeJob).toBeUndefined();
    expect(snap.delayedJobs.length).toBe(1);
    // Base delay is 2s; for attempt 1 (first retry), delay = 2 * 2^(1-1) = 2s
    expect(snap.delayedJobs[0].currentDelayRemaining).toBe(2);

    // Tick clock 1 second
    engine.tickClock();
    snap = engine.getSnapshot();
    expect(snap.delayedJobs[0].currentDelayRemaining).toBe(1);

    // Tick clock another second -> delay hits 0, moved back to waiting
    engine.tickClock();
    snap = engine.getSnapshot();
    expect(snap.delayedJobs.length).toBe(0);
    expect(snap.waitingJobs.length).toBe(1);
    expect(snap.waitingJobs[0].id).toBe('job_webhook_901');

    // Pick again for attempt 2
    engine.pickJob();
    expect(engine.getSnapshot().activeJob?.attempts).toBe(2);

    // Fail attempt 2 -> delay = 2 * 2^(2-1) = 4s
    engine.failJob('503 Service Unavailable');
    snap = engine.getSnapshot();
    expect(snap.delayedJobs.length).toBe(1);
    expect(snap.delayedJobs[0].currentDelayRemaining).toBe(4);
  });

  it('moves job to DLQ when maxAttempts is exhausted', () => {
    // Attempt 1
    engine.pickJob();
    engine.failJob('Timeout 1');
    // Exhaust 2s delay
    engine.tickClock();
    engine.tickClock();

    // Attempt 2
    engine.pickJob();
    engine.failJob('Timeout 2');
    // Exhaust 4s delay
    for (let i = 0; i < 4; i++) engine.tickClock();

    // Attempt 3 (Final attempt because maxAttempts = 3)
    engine.pickJob();
    expect(engine.getSnapshot().activeJob?.attempts).toBe(3);

    engine.failJob('Fatal 500 error');
    const snap = engine.getSnapshot();
    expect(snap.activeJob).toBeUndefined();
    expect(snap.delayedJobs.length).toBe(0);
    expect(snap.dlqJobs.length).toBe(1);
    expect(snap.dlqJobs[0].id).toBe('job_webhook_901');
    expect(snap.dlqJobs[0].state).toBe('dlq');
    expect(snap.dlqJobs[0].history.length).toBe(3);
  });

  it('allows inspection and replaying of jobs from DLQ', () => {
    // Force job to DLQ
    engine.pickJob();
    engine.failJob('Err 1');
    engine.tickClock(); engine.tickClock();

    engine.pickJob();
    engine.failJob('Err 2');
    for (let i = 0; i < 4; i++) engine.tickClock();

    engine.pickJob();
    engine.failJob('Err 3');

    let snap = engine.getSnapshot();
    expect(snap.dlqJobs.length).toBe(1);

    // Replay the DLQ job
    const replayed = engine.replayDlqJob('job_webhook_901');
    expect(replayed).toBe(true);

    snap = engine.getSnapshot();
    expect(snap.dlqJobs.length).toBe(0);
    expect(snap.waitingJobs.length).toBe(1);
    expect(snap.waitingJobs[0].id).toBe('job_webhook_901');
    expect(snap.waitingJobs[0].attempts).toBe(0);
  });

  it('handles poison pill addition and tracks it cleanly', () => {
    engine.addPoisonPill();
    const snap = engine.getSnapshot();
    expect(snap.waitingJobs.length).toBe(2);
    const poisonJob = snap.waitingJobs[1];
    expect(poisonJob.id).toMatch(/^poison_/);
    expect(poisonJob.maxAttempts).toBe(3);
  });

  it('bypasses retries and sends job straight to DLQ when UnrecoverableError is thrown', () => {
    engine.pickJob();
    const success = engine.failWithUnrecoverableError('UnrecoverableError: Invalid email format');
    expect(success).toBe(true);

    const snap = engine.getSnapshot();
    expect(snap.activeJob).toBeUndefined();
    expect(snap.delayedJobs.length).toBe(0);
    expect(snap.dlqJobs.length).toBe(1);
    expect(snap.dlqJobs[0].lastError).toContain('UnrecoverableError');
    expect(snap.dlqJobs[0].state).toBe('dlq');
  });
});
