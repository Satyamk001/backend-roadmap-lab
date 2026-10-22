export type EventLoopPhase =
  | 'timers'
  | 'pending'
  | 'idle'
  | 'poll'
  | 'check'
  | 'close';

export interface MemoryRecord {
  name: string;
  kind: 'var' | 'let' | 'const' | 'function';
  value: string;
  status: 'initialized' | 'uninitialized' | 'tdz';
}

export interface StackFrame {
  id: string;
  name: string;
  scope?: Record<string, string>;
  isGec?: boolean;
}

export interface QueueItem {
  id: string;
  name: string;
  sourceLine?: number;
  type: 'nextTick' | 'promise' | 'immediate' | 'timer' | 'io' | 'close';
  phase?: EventLoopPhase;
}

export interface WorkerStatus {
  id: number;
  busy: boolean;
  task?: string;
  taskType?: 'fs' | 'crypto' | 'dns' | 'zlib';
}

export interface KernelTask {
  id: string;
  label: string;
  type: 'socket' | 'stream' | 'pipe';
  status: 'listening' | 'ready' | 'received';
}

export interface TimerHeapItem {
  id: string;
  label: string;
  delay: number;
  dueTick: number;
  ready: boolean;
}

export interface ConsoleEntry {
  id: string;
  text: string;
  tick: number;
  isError?: boolean;
}

export interface EventLogEntry {
  id: string;
  tick: number;
  label: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  target?: string; // data-highlight-id for canvas highlighting
}

export interface EngineSnapshot {
  stepIndex: number;
  totalSteps: number;
  line: number; // 1-indexed highlighted code line
  caption: string; // "Why this next?" in Hinglish
  whatJustHappened: string;
  whyItMatters: string;
  callStack: StackFrame[];
  memoryCreation?: MemoryRecord[];
  nextTickQueue: QueueItem[];
  promiseQueue: QueueItem[];
  currentPhase: EventLoopPhase;
  phaseCounters: Record<EventLoopPhase, number>;
  timerHeap: TimerHeapItem[];
  workers: WorkerStatus[]; // 4 workers
  workerQueue: string[]; // Waiting queue for thread pool
  kernelTasks: KernelTask[];
  consoleOutput: ConsoleEntry[];
  eventLog: EventLogEntry[];
  activeHandles: number;
  isBlocked?: boolean;
  blockedReason?: string;
}

export interface DemoChallenge {
  id: string;
  title: string;
  description: string;
  passed: boolean;
}

export interface TracePreset {
  id: string;
  title: string;
  description: string;
  code: string;
  snapshots: EngineSnapshot[];
  challenges?: DemoChallenge[];
  expectedOutput?: string[];
}
