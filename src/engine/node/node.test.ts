import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NodeEventLoopEngine } from './engine';
import { stackGecTrace } from './traces/stackGecTrace';
import { architecture8TasksTrace } from './traces/architectureTrace';
import { eventLoopPhasesTrace } from './traces/eventLoopPhasesTrace';
import { microtasksMacrotasksTrace } from './traces/microtasksMacrotasksTrace';
import {
  predictIoImmediateVsTimeoutTrace,
  predictAsyncAwaitTrace,
  predictBossNestedTrace,
} from './traces/predictOutputTrace';
import {
  breakingSyncLoopTrace,
  breakingTickStarvationTrace,
  breakingPoolSaturationTrace,
} from './traces/breakingLoopTrace';

describe('NodeEventLoopEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with step 0 and provides immutable snapshot', () => {
    const engine = new NodeEventLoopEngine(stackGecTrace);
    const snap = engine.getSnapshot();
    expect(snap.stepIndex).toBe(0);
    expect(snap.caption).toContain('Memory Creation');
    expect(snap.callStack.length).toBe(1);
    expect(snap.callStack[0].isGec).toBe(true);
  });

  it('steps forward and backward deterministically', () => {
    const engine = new NodeEventLoopEngine(stackGecTrace);
    expect(engine.getSnapshot().stepIndex).toBe(0);

    const stepped = engine.step();
    expect(stepped).toBe(true);
    expect(engine.getSnapshot().stepIndex).toBe(1);

    engine.step();
    expect(engine.getSnapshot().stepIndex).toBe(2);

    // Step back (rewind)
    const steppedBack = engine.stepBack();
    expect(steppedBack).toBe(true);
    expect(engine.getSnapshot().stepIndex).toBe(1);

    // Reset back to start
    engine.reset();
    expect(engine.getSnapshot().stepIndex).toBe(0);
  });

  it('handles play, pause and speed', () => {
    const engine = new NodeEventLoopEngine(stackGecTrace);
    expect(engine.isPlaying()).toBe(false);

    engine.play();
    expect(engine.isPlaying()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(engine.getSnapshot().stepIndex).toBe(1);

    engine.setSpeed(2); // 500ms per step
    vi.advanceTimersByTime(500);
    expect(engine.getSnapshot().stepIndex).toBe(2);

    engine.pause();
    expect(engine.isPlaying()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(engine.getSnapshot().stepIndex).toBe(2); // unchanged
  });

  it('Tab 1 (Stack & GEC): captures Hoisting and TDZ', () => {
    const engine = new NodeEventLoopEngine(stackGecTrace);
    const initialSnap = engine.getSnapshot();
    expect(initialSnap.memoryCreation).toBeDefined();

    const greeting = initialSnap.memoryCreation?.find((m) => m.name === 'greeting');
    const score = initialSnap.memoryCreation?.find((m) => m.name === 'score');
    expect(greeting?.value).toBe('undefined');
    expect(score?.status).toBe('tdz');

    // Step to final
    while (engine.step()) {}
    const finalSnap = engine.getSnapshot();
    expect(finalSnap.consoleOutput.some((c) => c.text.includes('greeting: undefined'))).toBe(true);
    expect(finalSnap.consoleOutput.some((c) => c.text.includes('finalScore: 147'))).toBe(true);
  });

  it('Tab 2 (Node Architecture): verifies 2 waves of thread pool and kernel socket bypass', () => {
    const engine = new NodeEventLoopEngine(architecture8TasksTrace);

    // Step to wave 1
    engine.step();
    const wave1 = engine.getSnapshot();
    expect(wave1.workers.every((w) => w.busy)).toBe(true);
    expect(wave1.workerQueue.length).toBe(0);

    // Step to tasks 5-8 waiting
    engine.step();
    const queued = engine.getSnapshot();
    expect(queued.workerQueue.length).toBe(4);

    // Step to network socket: routes to kernel, NOT worker threads
    engine.step();
    const kernelSnap = engine.getSnapshot();
    expect(kernelSnap.kernelTasks.length).toBe(1);
    expect(kernelSnap.kernelTasks[0].label).toContain('epoll');

    // Run to completion
    while (engine.step()) {}
    const finalSnap = engine.getSnapshot();
    expect(finalSnap.consoleOutput.length).toBe(9); // 1 socket + 8 tasks
    expect(finalSnap.workers.every((w) => !w.busy)).toBe(true);
  });

  it('Tab 3 (Event Loop Phases): cycles through timers, poll, check, and close', () => {
    const engine = new NodeEventLoopEngine(eventLoopPhasesTrace);
    const phasesVisited: string[] = [];

    phasesVisited.push(engine.getSnapshot().currentPhase);
    while (engine.step()) {
      phasesVisited.push(engine.getSnapshot().currentPhase);
    }

    expect(phasesVisited).toContain('timers');
    expect(phasesVisited).toContain('pending');
    expect(phasesVisited).toContain('poll');
    expect(phasesVisited).toContain('check');
    expect(phasesVisited).toContain('close');
  });

  it('Tab 4 (Microtasks vs Macrotasks): ensures nextTick drains before Promise, both before timers', () => {
    const engine = new NodeEventLoopEngine(microtasksMacrotasksTrace);

    while (engine.step()) {}
    const output = engine.getSnapshot().consoleOutput.map((c) => c.text);

    // Expected order: 1: sync, 5: sync, 4: nextTick, 3: microtask, 2: macrotask
    expect(output).toEqual([
      '1: sync',
      '5: sync',
      '4: nextTick (priority microtask)',
      '3: microtask (promise)',
      '2: macrotask (timer)',
    ]);
  });

  it('Tab 5 (Predict Output): inside I/O callback, setImmediate always runs before setTimeout', () => {
    const engine = new NodeEventLoopEngine(predictIoImmediateVsTimeoutTrace);

    while (engine.step()) {}
    const output = engine.getSnapshot().consoleOutput.map((c) => c.text);
    expect(output).toEqual(['immediate', 'timeout']);
  });

  it('Tab 5 (Predict Output): async/await continuation yields to microtask queue', () => {
    const engine = new NodeEventLoopEngine(predictAsyncAwaitTrace);

    while (engine.step()) {}
    const output = engine.getSnapshot().consoleOutput.map((c) => c.text);
    expect(output).toEqual([
      '3: before call',
      '1: async start (sync)',
      '4: after call',
      '5: nextTick',
      '2: after await (microtask)',
    ]);
  });

  it('Tab 5 (Predict Output): Boss level nested ticks and promises drain completely before check phase', () => {
    const engine = new NodeEventLoopEngine(predictBossNestedTrace);

    while (engine.step()) {}
    const output = engine.getSnapshot().consoleOutput.map((c) => c.text);
    expect(output).toEqual([
      '1: sync',
      '6: sync',
      '5: tick main',
      '3: promise main',
      '4: tick inside promise',
      '2: immediate main',
    ]);
  });

  it('Tab 6 (Breaking the Loop): detects sync freeze, starvation, and pool saturation', () => {
    // 1. Sync block
    const syncEngine = new NodeEventLoopEngine(breakingSyncLoopTrace);
    syncEngine.step();
    syncEngine.step();
    expect(syncEngine.getSnapshot().isBlocked).toBe(true);
    expect(syncEngine.getSnapshot().blockedReason).toContain('0 FPS');

    // 2. nextTick Starvation
    const tickEngine = new NodeEventLoopEngine(breakingTickStarvationTrace);
    tickEngine.step();
    tickEngine.step();
    expect(tickEngine.getSnapshot().isBlocked).toBe(true);
    expect(tickEngine.getSnapshot().blockedReason).toContain('STARVATION');

    // 3. Pool saturation
    const poolEngine = new NodeEventLoopEngine(breakingPoolSaturationTrace);
    poolEngine.step();
    expect(poolEngine.getSnapshot().isBlocked).toBe(true);
    expect(poolEngine.getSnapshot().blockedReason).toContain('Thread Pool Exhaustion');
  });
});
