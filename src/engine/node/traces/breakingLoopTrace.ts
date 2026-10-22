import { TracePreset } from '../types';

// Failure Mode 1: Long Synchronous Loop Blocking the Call Stack
const CODE_BLOCKING_LOOP = `// Incoming HTTP health check ping
setInterval(() => console.log('Ping check: OK (200)'), 100);

// Catastrophic heavy synchronous execution on main thread:
function computeFibonacci(n) {
  const start = Date.now();
  while (Date.now() - start < 5000) {
    // 5000ms CPU-bound spinlock!
  }
  return "Done";
}

computeFibonacci(45);
// Event loop is 100% BLOCKED. Zero pings, zero I/O, 0 FPS!`;

// Failure Mode 2: Recursive process.nextTick Starvation
const CODE_STARVATION_TICK = `// I/O callback waiting in poll phase:
fs.readFile('critical_data.json', () => {
  console.log('I/O Callback executed!');
});

// Buggy recursive nextTick loop:
function infiniteTick() {
  process.nextTick(infiniteTick); // Queues another nextTick continuously!
}
infiniteTick();

// The nextTick queue NEVER empties.
// Poll phase and Timers are STARVED forever. CPU = 100%, 0 requests handled!`;

// Failure Mode 3: Thread Pool Saturation (Head of Line Blocking)
const CODE_THREADPOOL_SATURATION = `// 4 heavy password hashing jobs (bcrypt / pbkdf2) saturate pool:
for (let i = 1; i <= 4; i++) {
  crypto.pbkdf2('pass', 'salt', 200000, 64, 'sha512', () => {});
}

// Lightweight 2ms file read arrives:
fs.readFile('small_avatar.png', () => {
  console.log('Avatar read completed!');
});

// Worker threads 1-4 are 100% BUSY for seconds.
// fs.readFile waits in line — latency spikes from 2ms to 2500ms!`;

export const breakingSyncLoopTrace: TracePreset = {
  id: 'breaking-sync-block',
  title: 'Failure Mode 1: Long Synchronous Loop',
  description: 'Main JS thread par 5000ms ka heavy sync loop call stack ko pin kar deta hai. Event loop freeze ho jaata hai, timers drift hote hain, aur HTTP health checks timeout ho jaate hain.',
  code: CODE_BLOCKING_LOOP,
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 4,
      line: 2,
      caption: 'Step 0: Health check interval schedule hua.',
      whatJustHappened: 'setInterval timer min-heap me register hua.',
      whyItMatters: 'Normal state: loop har 100ms me ping callback run karega.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 1, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [{ id: 't1', label: 'setInterval(100ms)', delay: 100, dueTick: 1, ready: true }],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 'f0', tick: 0, label: 'HEALTH_CHECK', message: 'Registered 100ms health check interval', type: 'info', target: 'phase-timers' },
      ],
      activeHandles: 1,
      isBlocked: false,
    },
    {
      stepIndex: 1,
      totalSteps: 4,
      line: 13,
      caption: 'Step 1: computeFibonacci(45) call hua aur Call Stack par lock ho gaya!',
      whatJustHappened: 'V8 single thread heavy computation me phans gaya. Call stack busy hai.',
      whyItMatters: 'Node single-threaded hai. Jab tak sync function return nahi karta, stack yield nahi ho sakta.',
      callStack: [
        { id: 'main', name: 'main()' },
        { id: 'fib', name: 'computeFibonacci(45) [SYNC BLOCK]' },
      ],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 1, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [{ id: 't1', label: 'setInterval(100ms) [EXPIRED]', delay: 100, dueTick: 1, ready: true }],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 'f1', tick: 1, label: 'SYNC_INVOKE', message: 'computeFibonacci(45) pushed to Call Stack', type: 'warning', target: 'callstack' },
      ],
      activeHandles: 1,
      isBlocked: true,
      blockedReason: 'Call Stack pinned by synchronous computeFibonacci()',
    },
    {
      stepIndex: 2,
      totalSteps: 4,
      line: 7,
      caption: 'FREEZE: 5000ms loop running. Event loop pointer FROZEN, Timer expired but cannot run!',
      whatJustHappened: 'Timer heap me 100ms timer kab ka expire ho chuka hai, par Call Stack occupied hone ki wajah se Event Loop chal hi nahi sakta!',
      whyItMatters: 'HIGH SEVERITY: Health check timeout! K8s / AWS load balancer pod ko dead samajh kar kill kar dega (503 Service Unavailable).',
      callStack: [
        { id: 'main', name: 'main()' },
        { id: 'fib', name: 'while(Date.now() - start < 5000) [CPU SPIN]' },
      ],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 5, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [{ id: 't1', label: 'setInterval [DRIFT +5000ms]', delay: 100, dueTick: 1, ready: true }],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [{ id: 'err1', text: '[ERROR] 503 Gateway Timeout: Health Check Failed (Event Loop Lag: 5120ms)', tick: 2, isError: true }],
      eventLog: [
        { id: 'f1', tick: 1, label: 'SYNC_INVOKE', message: 'computeFibonacci() running', type: 'warning', target: 'callstack' },
        { id: 'f2', tick: 2, label: 'EVENT_LOOP_BLOCKED', message: 'Event loop FROZEN. Timer drift: 5120ms. Health check dead.', type: 'error', target: 'callstack' },
      ],
      activeHandles: 1,
      isBlocked: true,
      blockedReason: '0 FPS — EVENT LOOP BLOCKED (p99 latency exploded to 5000ms+)',
    },
    {
      stepIndex: 3,
      totalSteps: 4,
      line: 14,
      caption: 'Fix / Solution: CPU kaam ko worker_threads me bhejo ya setImmediate chunking use karo!',
      whatJustHappened: 'Sync kaam khatam hone ke baad hi delayed timer callback execute ho paya.',
      whyItMatters: 'Production rule: Kabhi bhi main thread par heavy CPU loop ya sync I/O (fs.readFileSync) mat chalao.',
      callStack: [{ id: 'cb_ping', name: 'delayed setInterval callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'timers',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'err1', text: '[ERROR] 503 Gateway Timeout: Health Check Failed (Event Loop Lag: 5120ms)', tick: 2, isError: true },
        { id: 'c1', text: 'Ping check: OK (delayed by 5000ms)', tick: 3 },
      ],
      eventLog: [
        { id: 'f2', tick: 2, label: 'EVENT_LOOP_BLOCKED', message: 'Event loop was blocked', type: 'error', target: 'callstack' },
        { id: 'f3', tick: 3, label: 'DELAYED_RECOVERY', message: 'Loop recovered; executed severely drifted timer', type: 'warning', target: 'phase-timers' },
      ],
      activeHandles: 0,
      isBlocked: false,
    },
  ],
  challenges: [
    {
      id: 'break-sync-freeze',
      title: 'Event loop freeze observe karo',
      description: 'Step 2 par jao aur dekho ki sync while loop ke dauran timer heap me due timers drift hote hain.',
      passed: false,
    },
  ],
};

export const breakingTickStarvationTrace: TracePreset = {
  id: 'breaking-tick-starvation',
  title: 'Failure Mode 2: Recursive process.nextTick Starvation',
  description: 'Buggy recursive nextTick loop call stack ko toh empty karta hai par nextTick queue ko lagatar refill karta rehta hai. Isse I/O aur Timers hamesha ke liye starve ho jaate hain.',
  code: CODE_STARVATION_TICK,
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 4,
      line: 2,
      caption: 'Step 0: fs.readFile call hua aur critical data ka I/O callback Poll queue me wait kar raha hai.',
      whatJustHappened: 'File read complete ho chuki hai aur uska callback poll phase me ready hai.',
      whyItMatters: 'Normal loop me ye callback turant agle turn par chalna chahiye.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 1, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 't0', tick: 0, label: 'FS_READY', message: 'fs.readFile callback waiting in Poll phase', type: 'info', target: 'phase-poll' },
      ],
      activeHandles: 1,
      isBlocked: false,
    },
    {
      stepIndex: 1,
      totalSteps: 4,
      line: 8,
      caption: 'Step 1: infiniteTick() call hua aur pehla process.nextTick schedule kiya.',
      whatJustHappened: 'nextTick queue me pehla tick aa gaya.',
      whyItMatters: 'Call stack ab empty hoga aur microtask draining shuru hogi.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [{ id: 'nt1', name: 'nextTick: infiniteTick (turn 1)', type: 'nextTick', sourceLine: 8 }],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 1, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 't1', tick: 1, label: 'TICK_START', message: 'Pushed infiniteTick to nextTick queue', type: 'info', target: 'nexttick-queue' },
      ],
      activeHandles: 1,
      isBlocked: false,
    },
    {
      stepIndex: 2,
      totalSteps: 4,
      line: 7,
      caption: 'STARVATION LOOP: infiniteTick chala aur usne AGLE tick ko schedule kar diya!',
      whatJustHappened: 'nextTick callback execute hua, par return hone se pehle usne ek aur process.nextTick schedule kar diya.',
      whyItMatters: 'Draining rule: nextTick queue jab tak EMPTY nahi hoti, tab tak loop aage nahi badh sakta!',
      callStack: [{ id: 'cb_nt', name: 'infiniteTick callback' }],
      nextTickQueue: [
        { id: 'nt2', name: 'nextTick: infiniteTick (turn 2)', type: 'nextTick' },
        { id: 'nt3', name: 'nextTick: infiniteTick (turn 3)', type: 'nextTick' },
      ],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 1, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [{ id: 'c_starve', text: '[STARVATION] nextTick loop spinning (Queue size > 0)...', tick: 2 }],
      eventLog: [
        { id: 't2', tick: 2, label: 'QUEUE_STARVATION', message: 'nextTick queue continuously refilling. Poll phase is STARVED.', type: 'error', target: 'nexttick-queue' },
      ],
      activeHandles: 1,
      isBlocked: true,
      blockedReason: 'I/O STARVATION: nextTick queue never empties; fs.readFile callback will NEVER run!',
    },
    {
      stepIndex: 3,
      totalSteps: 4,
      line: 12,
      caption: 'Contrast: setImmediate recursion safe hai kyunki wo agli iteration ke check phase me chalta hai!',
      whatJustHappened: 'nextTick queue drain loop process ko 100% CPU par phasa deta hai.',
      whyItMatters: 'Rule: Agar recursive async schedule karna hai to hamesha setImmediate use karo, process.nextTick nahi.',
      callStack: [],
      nextTickQueue: [{ id: 'nt_inf', name: 'infinite nextTicks...', type: 'nextTick' }],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 1, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c_starve', text: '[STARVATION] nextTick loop spinning (Queue size > 0)...', tick: 2 },
        { id: 'c_warn', text: '[FATAL] I/O callbacks starved indefinitely. Memory leak & process hang.', tick: 3, isError: true },
      ],
      eventLog: [
        { id: 't2', tick: 2, label: 'QUEUE_STARVATION', message: 'I/O Starved', type: 'error', target: 'nexttick-queue' },
        { id: 't3', tick: 3, label: 'RULE', message: 'Use setImmediate for safe recursion (gives loop room to breathe)', type: 'warning', target: 'phase-check' },
      ],
      activeHandles: 1,
      isBlocked: true,
      blockedReason: 'Starved I/O: Use setImmediate(fn) instead of nextTick',
    },
  ],
  challenges: [
    {
      id: 'break-tick-starvation',
      title: 'nextTick starvation observe karo',
      description: 'Step 2 par jao aur dekho ki nextTick queue lagatar bharne se fs.readFile ka callback execute nahi ho pata.',
      passed: false,
    },
  ],
};

export const breakingPoolSaturationTrace: TracePreset = {
  id: 'breaking-pool-saturation',
  title: 'Failure Mode 3: Thread Pool Saturation (Head-of-Line Blocking)',
  description: '4 heavy crypto hashing operations pure libuv thread pool ko occupy kar lete hain. Ek lightweight 2ms file read task queue me phans jaata hai aur latency 2ms se 2500ms tak badh jaati hai.',
  code: CODE_THREADPOOL_SATURATION,
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 4,
      line: 2,
      caption: 'Step 0: 4 heavy crypto hashing tasks dispatch hue. Charon workers BUSY!',
      whatJustHappened: 'Tasks 1, 2, 3, 4 ne 4 worker threads acquire kar liye.',
      whyItMatters: 'Default libuv pool size 4 hai. Abhi koi worker thread free nahi bacha.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [
        { id: 1, busy: true, task: 'crypto.pbkdf2 #1 (2500ms)', taskType: 'crypto' },
        { id: 2, busy: true, task: 'crypto.pbkdf2 #2 (2500ms)', taskType: 'crypto' },
        { id: 3, busy: true, task: 'crypto.pbkdf2 #3 (2500ms)', taskType: 'crypto' },
        { id: 4, busy: true, task: 'crypto.pbkdf2 #4 (2500ms)', taskType: 'crypto' },
      ],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 's0', tick: 0, label: 'SATURATE', message: 'Workers 1-4 100% busy with heavy pbkdf2 hashing', type: 'warning', target: 'workers' },
      ],
      activeHandles: 4,
      isBlocked: false,
    },
    {
      stepIndex: 1,
      totalSteps: 4,
      line: 8,
      caption: 'Step 1: Lightweight 2ms fs.readFile("small_avatar.png") aaya — par pool me jagah nahi hai!',
      whatJustHappened: 'fs.readFile task thread pool wait queue me phans gaya.',
      whyItMatters: 'Head-of-Line Blocking: File read ka khud ka kaam sirf 2ms ka hai, par ye 2500ms tak queue me baitha rahega!',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [
        { id: 1, busy: true, task: 'crypto.pbkdf2 #1', taskType: 'crypto' },
        { id: 2, busy: true, task: 'crypto.pbkdf2 #2', taskType: 'crypto' },
        { id: 3, busy: true, task: 'crypto.pbkdf2 #3', taskType: 'crypto' },
        { id: 4, busy: true, task: 'crypto.pbkdf2 #4', taskType: 'crypto' },
      ],
      workerQueue: ['fs.readFile("small_avatar.png") [WAITING BEHIND 4 CRYPTO JOBS]'],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c_warn', text: '[LATENCY SPIKE] fs.readFile stuck in thread pool queue (expected 2ms, waiting >2000ms)...', tick: 1, isError: true },
      ],
      eventLog: [
        { id: 's0', tick: 0, label: 'SATURATE', message: 'Workers 1-4 busy', type: 'warning', target: 'workers' },
        { id: 's1', tick: 1, label: 'HEAD_OF_LINE_BLOCK', message: 'fs.readFile stuck in wait queue behind heavy crypto', type: 'error', target: 'worker-queue' },
      ],
      activeHandles: 5,
      isBlocked: true,
      blockedReason: 'Thread Pool Exhaustion: 2ms fs.readFile delayed by heavy crypto tasks',
    },
    {
      stepIndex: 2,
      totalSteps: 4,
      line: 8,
      caption: 'Step 2: 2500ms baad Worker 1 free hua, tab jakar fs.readFile Worker 1 me enter hua.',
      whatJustHappened: 'Crypto job khatam hui. Free hue Worker 1 ne avatar read start kiya.',
      whyItMatters: 'Login storm (bcrypt/pbkdf2) se poore server ke static file reads aur dns lookups slow ho jaate hain!',
      callStack: [],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [
        { id: 1, busy: true, task: 'fs.readFile("small_avatar.png")', taskType: 'fs' },
        { id: 2, busy: false },
        { id: 3, busy: false },
        { id: 4, busy: false },
      ],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c_warn', text: '[LATENCY SPIKE] fs.readFile stuck in thread pool queue (expected 2ms, waiting >2000ms)...', tick: 1, isError: true },
        { id: 'c_pick', text: 'Worker 1 finally picked fs.readFile after 2500ms delay', tick: 2 },
      ],
      eventLog: [
        { id: 's1', tick: 1, label: 'HEAD_OF_LINE_BLOCK', message: 'Queue wait delay', type: 'error', target: 'worker-queue' },
        { id: 's2', tick: 2, label: 'WORKER_ACQUIRED', message: 'Worker 1 acquired after 2500ms queue wait', type: 'warning', target: 'workers' },
      ],
      activeHandles: 1,
      isBlocked: false,
    },
    {
      stepIndex: 3,
      totalSteps: 4,
      line: 9,
      caption: 'Step 3: Avatar read complete. Total latency: 2502ms (2500ms queue wait + 2ms actual work).',
      whatJustHappened: 'Callback poll phase me execute hua. Console par "Avatar read completed!" print hua.',
      whyItMatters: 'Solutions: UV_THREADPOOL_SIZE badhao (e.g. 8 or 16), ya heavy crypto ko dedicated worker_threads me bhejo.',
      callStack: [{ id: 'cb_fs', name: 'fs.readFile callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c_warn', text: '[LATENCY SPIKE] fs.readFile stuck in thread pool queue (expected 2ms, waiting >2000ms)...', tick: 1, isError: true },
        { id: 'c_pick', text: 'Worker 1 finally picked fs.readFile after 2500ms delay', tick: 2 },
        { id: 'c_done', text: 'Avatar read completed! (Total latency: 2502ms)', tick: 3 },
      ],
      eventLog: [
        { id: 's2', tick: 2, label: 'WORKER_ACQUIRED', message: 'Worker 1 acquired', type: 'warning', target: 'workers' },
        { id: 's3', tick: 3, label: 'COMPLETED', message: 'fs.readFile callback finished (delayed by pool saturation)', type: 'success', target: 'phase-poll' },
      ],
      activeHandles: 0,
      isBlocked: false,
    },
  ],
  challenges: [
    {
      id: 'break-pool-delay',
      title: 'Head-of-line blocking observe karo',
      description: 'Step 1 me dekho ki 4 crypto jobs ki wajah se 2ms ka fs.readFile wait queue me phans jaata hai.',
      passed: false,
    },
  ],
};
