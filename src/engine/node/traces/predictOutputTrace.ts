import { TracePreset } from '../types';

// Preset 1: Inside I/O callback: setTimeout vs setImmediate (ALWAYS immediate first)
const CODE_IO_IMMEDIATE_VS_TIMEOUT = `const fs = require('node:fs');

fs.readFile('user.json', () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
});

// Inside I/O callback (poll phase), next phase is ALWAYS check (immediate).
// Timers phase is only reached in the next loop turn!`;

// Preset 2: Main module: setTimeout(0) vs setImmediate (Non-deterministic)
const CODE_MAIN_TIMEOUT_VS_IMMEDIATE = `setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// In main module, ordering depends on process startup speed:
// If process starts in < 1ms, timer is not yet due → immediate first.
// If process took > 1ms, timer is due → timeout first.`;

// Preset 3: async / await ordering
const CODE_ASYNC_AWAIT = `async function asyncFlow() {
  console.log('1: async start (sync)');
  await Promise.resolve();
  console.log('2: after await (microtask)');
}

console.log('3: before call');
asyncFlow();
console.log('4: after call');
process.nextTick(() => console.log('5: nextTick'));`;

// Preset 4: Boss Level Nested Microtasks (Puzzle 10 from notes)
const CODE_BOSS_NESTED = `console.log('1: sync');
setImmediate(() => console.log('2: immediate main'));

Promise.resolve().then(() => {
  console.log('3: promise main');
  process.nextTick(() => console.log('4: tick inside promise'));
});

process.nextTick(() => console.log('5: tick main'));
console.log('6: sync');`;

export const predictIoImmediateVsTimeoutTrace: TracePreset = {
  id: 'predict-io-immediate-timeout',
  title: 'Inside I/O: setTimeout vs setImmediate',
  description: 'fs.readFile ka callback poll phase me chalta hai. Uske baad seedha check phase aata hai, isliye setImmediate HAMESHA pehle chalta hai.',
  code: CODE_IO_IMMEDIATE_VS_TIMEOUT,
  expectedOutput: ['immediate', 'timeout'],
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 4,
      line: 3,
      caption: 'Step 0: fs.readFile call hua aur background libuv worker thread ko hand-off hua.',
      whatJustHappened: 'Main script ne fs.readFile initiate kiya. JS thread free raha.',
      whyItMatters: 'File reading thread pool me hoti hai; callback aane tak event loop doosre kaam karta hai.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 1, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: true, task: 'fs.readFile' }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 'l0', tick: 0, label: 'FS_START', message: 'fs.readFile dispatched to Worker 1', type: 'info', target: 'workers' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 1,
      totalSteps: 4,
      line: 4,
      caption: 'Step 1: File ready hui! Callback POLL phase me execute ho raha hai aur setTimeout + setImmediate schedule hue.',
      whatJustHappened: 'Worker 1 complete hua. Poll phase me callback run hua; usne setTimeout(0) aur setImmediate() schedule kiya.',
      whyItMatters: 'Yahan dhyan se dekho: hum abhi POLL phase me hain!',
      callStack: [{ id: 'cb_fs', name: 'fs.readFile callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 1, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [{ id: 't1', label: 'setTimeout(0ms)', delay: 0, dueTick: 3, ready: true }],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 'l1', tick: 1, label: 'POLL_CB', message: 'fs callback running in poll phase; scheduled timeout & immediate', type: 'info', target: 'phase-poll' },
      ],
      activeHandles: 2,
    },
    {
      stepIndex: 2,
      totalSteps: 4,
      line: 5,
      caption: 'Step 2: Poll phase ke turant baad CHECK phase aata hai! Isliye immediate PEHLE chala.',
      whatJustHappened: 'Loop poll se check phase par gaya aur setImmediate callback execute kiya: "immediate".',
      whyItMatters: 'Poll phase ke baad check phase aata hai (timers nahi). Isiliye I/O ke andar setImmediate ALWAYS wins!',
      callStack: [{ id: 'cb_imm', name: 'setImmediate callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'check',
      phaseCounters: { timers: 1, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [{ id: 't1', label: 'setTimeout(0ms)', delay: 0, dueTick: 3, ready: true }],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [{ id: 'c1', text: 'immediate', tick: 2 }],
      eventLog: [
        { id: 'l1', tick: 1, label: 'POLL_CB', message: 'fs callback ran in poll phase', type: 'info', target: 'phase-poll' },
        { id: 'l2', tick: 2, label: 'CHECK_CB', message: 'Check phase executed setImmediate: printed "immediate"', type: 'success', target: 'phase-check' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 3,
      totalSteps: 4,
      line: 4,
      caption: 'Step 3: Loop Close phase cross karke agli iteration ke TIMERS phase me pahuncha, ab timeout chala.',
      whatJustHappened: 'Loop Turn 2 ke start par Timers phase me aaya aur setTimeout(0) callback run kiya: "timeout".',
      whyItMatters: 'Guaranteed order: "immediate" phir "timeout". Interview ka standard question!',
      callStack: [{ id: 'cb_tm', name: 'setTimeout callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'timers',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: 'immediate', tick: 2 },
        { id: 'c2', text: 'timeout', tick: 3 },
      ],
      eventLog: [
        { id: 'l2', tick: 2, label: 'CHECK_CB', message: 'Printed "immediate"', type: 'success', target: 'phase-check' },
        { id: 'l3', tick: 3, label: 'TIMERS_CB', message: 'Timers phase executed setTimeout: printed "timeout"', type: 'success', target: 'phase-timers' },
      ],
      activeHandles: 0,
    },
  ],
  challenges: [
    {
      id: 'pred-immediate-first',
      title: 'Poll se Check ka order verify karo',
      description: 'Step 2 me verify karo ki check phase ka immediate callback pehle chalta hai.',
      passed: false,
    },
    {
      id: 'pred-timeout-turn2',
      title: 'Agli loop iteration ka timer dekho',
      description: 'Step 3 me dekho ki setTimeout agli iteration ke timers phase me execute hota hai.',
      passed: false,
    },
  ],
};

export const predictMainTimeoutVsImmediateTrace: TracePreset = {
  id: 'predict-main-timeout-immediate',
  title: 'Main Module: setTimeout(0) vs setImmediate',
  description: 'Main module se ordering non-deterministic hoti hai: process startup speed par depend karta hai ki timer min-heap check hone tak 1ms elapsed hua ya nahi.',
  code: CODE_MAIN_TIMEOUT_VS_IMMEDIATE,
  expectedOutput: ['timeout', 'immediate'],
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 3,
      line: 1,
      caption: 'Step 0: Main module ne setTimeout(0) aur setImmediate() schedule kiya.',
      whatJustHappened: 'Timer min-heap me register hua aur immediate Check queue me aa gaya.',
      whyItMatters: 'Process startup time CPU load aur OS scheduler par depend karta hai.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'timers',
      phaseCounters: { timers: 1, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [{ id: 't1', label: 'setTimeout(0ms)', delay: 0, dueTick: 1, ready: true }],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [],
      eventLog: [
        { id: 'm0', tick: 0, label: 'SCHEDULE', message: 'setTimeout(0) & setImmediate queued from main', type: 'info', target: 'phase-timers' },
      ],
      activeHandles: 2,
    },
    {
      stepIndex: 1,
      totalSteps: 3,
      line: 1,
      caption: 'Scenario A: Loop enter hone tak ≥ 1ms ho chuka tha → Timers phase me timeout pehle chala!',
      whatJustHappened: 'libuv uv_update_time ne dekha timer due ho chuka hai, to Timers phase me pehle callback chalaya.',
      whyItMatters: 'Agar machine fast ho aur loop < 1ms me enter ho jaye, to timer ready nahi hota aur immediate pehle chal jaata!',
      callStack: [{ id: 'cb_tm', name: 'setTimeout callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'timers',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [{ id: 'c1', text: 'timeout', tick: 1 }],
      eventLog: [
        { id: 'm1', tick: 1, label: 'TIMERS_CB', message: 'Timers phase executed (≥ 1ms elapsed at start)', type: 'success', target: 'phase-timers' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 2,
      totalSteps: 3,
      line: 2,
      caption: 'Step 2: Check phase me setImmediate chala. Total: timeout phir immediate (non-deterministic).',
      whatJustHappened: 'Loop check phase me pahuncha aur setImmediate callback execute kiya.',
      whyItMatters: 'Main module me setTimeout vs setImmediate order fix nahi hota; sirf I/O callback ke andar immediate guaranteed first hota hai.',
      callStack: [{ id: 'cb_imm', name: 'setImmediate callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'check',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: 'timeout', tick: 1 },
        { id: 'c2', text: 'immediate', tick: 2 },
      ],
      eventLog: [
        { id: 'm1', tick: 1, label: 'TIMERS_CB', message: 'timeout printed', type: 'success', target: 'phase-timers' },
        { id: 'm2', tick: 2, label: 'CHECK_CB', message: 'immediate printed', type: 'success', target: 'phase-check' },
      ],
      activeHandles: 0,
    },
  ],
  challenges: [
    {
      id: 'pred-main-non-deterministic',
      title: 'Main module ordering observe karo',
      description: 'Step 1 aur 2 me dekho ki main module me timer check pehle ho sakta hai.',
      passed: false,
    },
  ],
};

export const predictAsyncAwaitTrace: TracePreset = {
  id: 'predict-async-await',
  title: 'async/await Execution Order',
  description: 'async function call sync chalti hai jab tak pehla await na aaye. await ke baad ka saara code Promise microtask queue me schedule hota hai.',
  code: CODE_ASYNC_AWAIT,
  expectedOutput: ['3: before call', '1: async start (sync)', '4: after call', '5: nextTick', '2: after await (microtask)'],
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 5,
      line: 7,
      caption: 'Line 7: console.log("3: before call") chala.',
      whatJustHappened: 'Pehla synchronous log execute hua.',
      whyItMatters: 'Top-level sync execution shuru hui.',
      callStack: [{ id: 'main', name: 'main()' }, { id: 'l3', name: 'console.log("3: before call")' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [{ id: 'c1', text: '3: before call', tick: 1 }],
      eventLog: [{ id: 'a1', tick: 1, label: 'SYNC', message: '3: before call', type: 'info', target: 'console' }],
      activeHandles: 0,
    },
    {
      stepIndex: 1,
      totalSteps: 5,
      line: 2,
      caption: 'Line 8 -> Line 2: asyncFlow() call hui. await tak ka code SYNCHRONOUS chalta hai!',
      whatJustHappened: 'async function enter hui aur console.log("1: async start (sync)") print kiya.',
      whyItMatters: 'Common misconception: async function ka matlab ye nahi ki pura function async hai. await se pehle ka part sync hota hai!',
      callStack: [{ id: 'main', name: 'main()' }, { id: 'fn', name: 'asyncFlow()' }, { id: 'l1', name: 'console.log("1: async start")' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '3: before call', tick: 1 },
        { id: 'c2', text: '1: async start (sync)', tick: 2 },
      ],
      eventLog: [
        { id: 'a1', tick: 1, label: 'SYNC', message: '3: before call', type: 'info', target: 'console' },
        { id: 'a2', tick: 2, label: 'ASYNC_SYNC', message: 'asyncFlow started synchronously: printed 1', type: 'info', target: 'console' },
      ],
      activeHandles: 0,
    },
    {
      stepIndex: 2,
      totalSteps: 5,
      line: 9,
      caption: 'Line 3 par await mila: continuation microtask me gayi. Caller par wapas aakar "4: after call" chala.',
      whatJustHappened: 'await Promise.resolve() ne function ko pause kiya aur line 4 ko microtask queue me dala. Line 9 synchronous chali.',
      whyItMatters: 'await call stack ko yield karta hai aur aage ka script continue hota hai.',
      callStack: [{ id: 'main', name: 'main()' }, { id: 'l4', name: 'console.log("4: after call")' }],
      nextTickQueue: [],
      promiseQueue: [{ id: 'p_resume', name: 'asyncFlow() continuation (line 4)', type: 'promise', sourceLine: 4 }],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '3: before call', tick: 1 },
        { id: 'c2', text: '1: async start (sync)', tick: 2 },
        { id: 'c3', text: '4: after call', tick: 3 },
      ],
      eventLog: [
        { id: 'a2', tick: 2, label: 'ASYNC_SYNC', message: '1: async start', type: 'info', target: 'console' },
        { id: 'a3', tick: 3, label: 'SYNC', message: '4: after call (continuation queued in microtasks)', type: 'info', target: 'console' },
      ],
      activeHandles: 0,
    },
    {
      stepIndex: 3,
      totalSteps: 5,
      line: 10,
      caption: 'Line 10: process.nextTick schedule hua. Sync code khatam, ab nextTick PEHLE chalega!',
      whatJustHappened: 'nextTick queue drain hui: "5: nextTick" print hua.',
      whyItMatters: 'await continuation Promise microtask me hoti hai, par nextTick usse bhi PEHLE drain hota hai!',
      callStack: [{ id: 'cb_nt', name: 'process.nextTick callback' }],
      nextTickQueue: [],
      promiseQueue: [{ id: 'p_resume', name: 'asyncFlow() continuation', type: 'promise', sourceLine: 4 }],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '3: before call', tick: 1 },
        { id: 'c2', text: '1: async start (sync)', tick: 2 },
        { id: 'c3', text: '4: after call', tick: 3 },
        { id: 'c4', text: '5: nextTick', tick: 4 },
      ],
      eventLog: [
        { id: 'a3', tick: 3, label: 'SYNC', message: '4: after call', type: 'info', target: 'console' },
        { id: 'a4', tick: 4, label: 'NEXT_TICK', message: 'nextTick drained before await continuation: printed 5', type: 'success', target: 'nexttick-queue' },
      ],
      activeHandles: 0,
    },
    {
      stepIndex: 4,
      totalSteps: 5,
      line: 4,
      caption: 'Finally: Promise microtask queue se await continuation resume hui!',
      whatJustHappened: 'asyncFlow ne line 4 par execution resume ki: "2: after await (microtask)".',
      whyItMatters: 'Complete order: 3 (sync) → 1 (sync) → 4 (sync) → 5 (nextTick) → 2 (await continuation).',
      callStack: [{ id: 'fn_resume', name: 'asyncFlow() resume' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '3: before call', tick: 1 },
        { id: 'c2', text: '1: async start (sync)', tick: 2 },
        { id: 'c3', text: '4: after call', tick: 3 },
        { id: 'c4', text: '5: nextTick', tick: 4 },
        { id: 'c5', text: '2: after await (microtask)', tick: 5 },
      ],
      eventLog: [
        { id: 'a4', tick: 4, label: 'NEXT_TICK', message: '5: nextTick', type: 'success', target: 'nexttick-queue' },
        { id: 'a5', tick: 5, label: 'PROMISE_RESUME', message: 'await continuation completed: printed 2', type: 'success', target: 'promise-queue' },
      ],
      activeHandles: 0,
    },
  ],
  challenges: [
    {
      id: 'async-sync-start',
      title: 'await se pehle ka sync part dekho',
      description: 'Step 1 me observe karo ki async function call hote hi 1: async start turant print hota hai.',
      passed: false,
    },
    {
      id: 'async-await-hop',
      title: 'nextTick vs await priority dekho',
      description: 'Step 3 aur 4 me dekho ki nextTick await continuation se pehle execute hota hai.',
      passed: false,
    },
  ],
};

export const predictBossNestedTrace: TracePreset = {
  id: 'predict-boss-nested',
  title: 'Boss Level: Nested Microtasks & Immediate',
  description: 'Sync → nextTick main → Promise main → tick inside promise → immediate main. Har layer ka priority order verify karo.',
  code: CODE_BOSS_NESTED,
  expectedOutput: ['1: sync', '6: sync', '5: tick main', '3: promise main', '4: tick inside promise', '2: immediate main'],
  snapshots: [
    {
      stepIndex: 0,
      totalSteps: 5,
      line: 1,
      caption: 'Line 1 & Line 9: Sync code "1: sync" aur "6: sync" execute hua.',
      whatJustHappened: 'Main script ne sync code chalaya aur immediate, promise, nextTick schedule kiye.',
      whyItMatters: 'Call stack par sync execution poori hone ke baad microtask draining trigger hoti hai.',
      callStack: [{ id: 'main', name: 'main()' }],
      nextTickQueue: [{ id: 'nt_m', name: 'nextTick main', type: 'nextTick', sourceLine: 8 }],
      promiseQueue: [{ id: 'pm_m', name: 'Promise main', type: 'promise', sourceLine: 4 }],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '1: sync', tick: 1 },
        { id: 'c2', text: '6: sync', tick: 2 },
      ],
      eventLog: [
        { id: 'b1', tick: 1, label: 'SYNC', message: 'Printed 1: sync and 6: sync', type: 'info', target: 'console' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 1,
      totalSteps: 5,
      line: 8,
      caption: 'Line 8: pehle process.nextTick main drain hua.',
      whatJustHappened: 'nextTick queue se "5: tick main" execute hua.',
      whyItMatters: 'Promise microtasks se pehle main nextTick chalta hai.',
      callStack: [{ id: 'cb_nt1', name: 'nextTick main callback' }],
      nextTickQueue: [],
      promiseQueue: [{ id: 'pm_m', name: 'Promise main', type: 'promise', sourceLine: 4 }],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '1: sync', tick: 1 },
        { id: 'c2', text: '6: sync', tick: 2 },
        { id: 'c3', text: '5: tick main', tick: 3 },
      ],
      eventLog: [
        { id: 'b1', tick: 1, label: 'SYNC', message: 'Sync done', type: 'info', target: 'console' },
        { id: 'b2', tick: 2, label: 'NEXT_TICK', message: 'nextTick main drained: printed 5', type: 'success', target: 'nexttick-queue' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 2,
      totalSteps: 5,
      line: 4,
      caption: 'Line 4: Promise main chala — aur uske andar ek naya nextTick queue hua!',
      whatJustHappened: '"3: promise main" print hua. Uske andar process.nextTick ne naya tick schedule kiya.',
      whyItMatters: 'Golden Rule loop: jab tak microtask queues khaali na hon, check karte raho!',
      callStack: [{ id: 'cb_pm', name: 'Promise main callback' }],
      nextTickQueue: [{ id: 'nt_sub', name: 'tick inside promise', type: 'nextTick', sourceLine: 6 }],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '1: sync', tick: 1 },
        { id: 'c2', text: '6: sync', tick: 2 },
        { id: 'c3', text: '5: tick main', tick: 3 },
        { id: 'c4', text: '3: promise main', tick: 4 },
      ],
      eventLog: [
        { id: 'b2', tick: 2, label: 'NEXT_TICK', message: 'nextTick main drained', type: 'success', target: 'nexttick-queue' },
        { id: 'b3', tick: 3, label: 'PROMISE', message: 'Promise executed: printed 3 (queued tick-inside-p1)', type: 'success', target: 'promise-queue' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 3,
      totalSteps: 5,
      line: 6,
      caption: 'Naya nextTick queue me aaya tha — isliye immediate se pehle wo bhi drain hoga!',
      whatJustHappened: 'Node ne dekha tickQueue me item hai: "4: tick inside promise" chala.',
      whyItMatters: 'Microtask drain loop tab tak chalta hai jab tak dono queues (ticks + promises) completely empty na ho jayein.',
      callStack: [{ id: 'cb_nt_sub', name: 'nested nextTick callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'poll',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 1, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '1: sync', tick: 1 },
        { id: 'c2', text: '6: sync', tick: 2 },
        { id: 'c3', text: '5: tick main', tick: 3 },
        { id: 'c4', text: '3: promise main', tick: 4 },
        { id: 'c5', text: '4: tick inside promise', tick: 5 },
      ],
      eventLog: [
        { id: 'b3', tick: 3, label: 'PROMISE', message: 'Promise main done', type: 'success', target: 'promise-queue' },
        { id: 'b4', tick: 4, label: 'NESTED_TICK', message: 'Nested nextTick drained: printed 4', type: 'success', target: 'nexttick-queue' },
      ],
      activeHandles: 1,
    },
    {
      stepIndex: 4,
      totalSteps: 5,
      line: 2,
      caption: 'Saare microtasks complete! Ab loop CHECK phase me gaya aur setImmediate chala.',
      whatJustHappened: 'Event loop check phase me aaya: "2: immediate main" execute hua.',
      whyItMatters: 'Macrotask tabhi chal sakta hai jab microtask queues ka har ek item execute ho chuka ho!',
      callStack: [{ id: 'cb_imm', name: 'setImmediate callback' }],
      nextTickQueue: [],
      promiseQueue: [],
      currentPhase: 'check',
      phaseCounters: { timers: 0, pending: 0, idle: 0, poll: 0, check: 0, close: 0 },
      timerHeap: [],
      workers: [{ id: 1, busy: false }, { id: 2, busy: false }, { id: 3, busy: false }, { id: 4, busy: false }],
      workerQueue: [],
      kernelTasks: [],
      consoleOutput: [
        { id: 'c1', text: '1: sync', tick: 1 },
        { id: 'c2', text: '6: sync', tick: 2 },
        { id: 'c3', text: '5: tick main', tick: 3 },
        { id: 'c4', text: '3: promise main', tick: 4 },
        { id: 'c5', text: '4: tick inside promise', tick: 5 },
        { id: 'c6', text: '2: immediate main', tick: 6 },
      ],
      eventLog: [
        { id: 'b4', tick: 4, label: 'NESTED_TICK', message: 'Nested nextTick done', type: 'success', target: 'nexttick-queue' },
        { id: 'b5', tick: 5, label: 'CHECK_MACRO', message: 'Check phase executed setImmediate: printed 2', type: 'success', target: 'phase-check' },
      ],
      activeHandles: 0,
    },
  ],
  challenges: [
    {
      id: 'boss-nested-tick',
      title: 'Nested tick draining observe karo',
      description: 'Step 2 aur 3 me dekho ki Promise ke andar se bana nextTick immediate se pehle chalta hai.',
      passed: false,
    },
  ],
};
