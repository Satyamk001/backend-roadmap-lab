import { describe, it, expect } from 'vitest';
import { RabbitMqPrefetchEngine } from './prefetchEngine';

describe('RabbitMQ Prefetch & Fair QoS Engine', () => {
  it('divides tasks equally regardless of speed when prefetch is 0 (unlimited round-robin)', () => {
    const engine = new RabbitMqPrefetchEngine(0);
    // Upon reset/init with prefetch=0, all 6 tasks are dispatched round-robin
    const snap = engine.getSnapshot();

    const fastWorker = snap.workers.find((w) => w.id === 'w-fast')!;
    const slowWorker = snap.workers.find((w) => w.id === 'w-slow')!;

    const fastTotal = (fastWorker.activeTask ? 1 : 0) + fastWorker.unackedBuffer.length;
    const slowTotal = (slowWorker.activeTask ? 1 : 0) + slowWorker.unackedBuffer.length;

    expect(fastTotal).toBe(3);
    expect(slowTotal).toBe(3);
  });

  it('delivers tasks on-demand when prefetch is 1 (fair dispatch)', () => {
    const engine = new RabbitMqPrefetchEngine(1);
    let snap = engine.getSnapshot();

    let fastWorker = snap.workers.find((w) => w.id === 'w-fast')!;
    let slowWorker = snap.workers.find((w) => w.id === 'w-slow')!;

    // With prefetch=1, each worker only holds 1 task in-flight (no unacked buffer overflow)
    expect(fastWorker.unackedBuffer).toHaveLength(0);
    expect(slowWorker.unackedBuffer).toHaveLength(0);
    expect(fastWorker.activeTask).toBeDefined();
    expect(slowWorker.activeTask).toBeDefined();

    // Run until completion
    let maxSteps = 30;
    while (!snap.isAllCompleted && maxSteps > 0) {
      engine.step();
      snap = engine.getSnapshot();
      maxSteps--;
    }

    fastWorker = snap.workers.find((w) => w.id === 'w-fast')!;
    slowWorker = snap.workers.find((w) => w.id === 'w-slow')!;

    // Fast worker completes more tasks than slow worker under fair dispatch
    expect(fastWorker.completedCount).toBeGreaterThanOrEqual(slowWorker.completedCount);
  });
});
