import { describe, it, expect, beforeEach } from 'vitest';
import { SyncVsAsyncEngine } from './syncVsAsync';

describe('SyncVsAsyncEngine', () => {
  let engine: SyncVsAsyncEngine;

  beforeEach(() => {
    engine = new SyncVsAsyncEngine();
  });

  it('initializes in sync mode with 0 used threads', () => {
    const snap = engine.getSnapshot();
    expect(snap.mode).toBe('sync');
    expect(snap.httpThreadsUsed).toBe(0);
    expect(snap.maxHttpThreads).toBe(3);
  });

  it('allocates an HTTP thread and sets 200 OK on sync request completion', () => {
    const ok = engine.sendRequest('pdf');
    expect(ok).toBe(true);

    let snap = engine.getSnapshot();
    expect(snap.httpThreadsUsed).toBe(1);
    expect(snap.activeRequests[0].status).toBe('processing');

    // Step virtual clock 3 times to complete
    engine.step();
    engine.step();
    engine.step();

    snap = engine.getSnapshot();
    expect(snap.httpThreadsUsed).toBe(0);
    expect(snap.completedCount).toBe(1);
    expect(snap.activeRequests[0].status).toBe('completed');
    expect(snap.activeRequests[0].httpStatus).toBe(200);
  });

  it('causes HTTP 504 Gateway Timeout when sync thread pool is exhausted', () => {
    // Max threads = 3
    engine.sendRequest('pdf');
    engine.sendRequest('email');
    engine.sendRequest('report');

    let snap = engine.getSnapshot();
    expect(snap.httpThreadsUsed).toBe(3);

    // 4th request must fail with 504 Timeout
    const success = engine.sendRequest('pdf');
    expect(success).toBe(false);

    snap = engine.getSnapshot();
    expect(snap.timeoutCount).toBe(1);
    expect(snap.activeRequests[0].status).toBe('timeout');
    expect(snap.activeRequests[0].httpStatus).toBe(504);
  });

  it('handles traffic spike in async mode with instant 202 and zero timeouts', () => {
    engine.setMode('async');
    engine.sendSpike(5);

    const snap = engine.getSnapshot();
    expect(snap.timeoutCount).toBe(0);
    expect(snap.queue.length).toBe(5);
    // Background workers should immediately pick 2 jobs
    expect(snap.workers.filter((w) => w.status === 'busy').length).toBe(2);
    // Average response time should be ~12ms
    expect(snap.avgResponseTimeMs).toBeLessThan(50);
  });

  it('drains queue jobs through background workers in async mode', () => {
    engine.setMode('async');
    engine.sendRequest('pdf');

    let snap = engine.getSnapshot();
    expect(snap.queue.length).toBe(1);
    const worker = snap.workers.find((w) => w.status === 'busy');
    expect(worker).toBeDefined();

    // Step clock twice to complete worker execution (progress 50% then 100%)
    engine.step();
    engine.step();

    snap = engine.getSnapshot();
    expect(snap.completedCount).toBe(1);
    expect(snap.workers.every((w) => w.status === 'idle')).toBe(true);
  });
});
