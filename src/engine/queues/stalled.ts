/**
 * BullMQ Worker Locks & Stalled Job Recovery Engine
 * Deterministic simulation of worker locks, heartbeat renewals, worker crashes,
 * stalled job detection watchdog, duplicate redeliveries, and idempotency protection.
 */

export interface StalledDemoWorker {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'crashed' | 'frozen';
  currentJobId?: string;
  heartbeatsSent: number;
}

export interface StalledDemoJob {
  id: string;
  title: string;
  payload: Record<string, any>;
  state: 'waiting' | 'locked' | 'completed' | 'stalled_recovered';
  workerId?: string;
  lockTtl: number;        // in seconds (e.g. 8s)
  maxLockTtl: number;     // e.g. 8s
  stalledCount: number;
  timesExecuted: number;  // Tracks duplicate executions
  processedSideEffect: boolean;
}

export interface StalledDemoSnapshot {
  tick: number;
  waitingJobs: StalledDemoJob[];
  activeJob?: StalledDemoJob;
  completedJobs: StalledDemoJob[];
  workers: StalledDemoWorker[];
  idempotencyEnabled: boolean;
  duplicateDetected: boolean;
  sideEffectExecutionCount: number; // e.g. how many times credit card was charged
  dbProcessedKeys: string[];        // Idempotency keys stored in DB
  statusMessage: string;
  whyItMatters: string;
  eventLog: Array<{ id: string; tick: number; message: string; type: 'info' | 'warning' | 'error' | 'success' }>;
}

export class BullStalledEngine {
  private tick = 0;
  private idempotencyEnabled = true;
  private duplicateDetected = false;
  private sideEffectExecutionCount = 0;
  private dbProcessedKeys: Set<string> = new Set();

  private workers: StalledDemoWorker[] = [
    { id: 'w1', name: 'Worker-1 (Primary)', status: 'idle', heartbeatsSent: 0 },
    { id: 'w2', name: 'Worker-2 (Standby)', status: 'idle', heartbeatsSent: 0 },
  ];

  private waitingJobs: StalledDemoJob[] = [
    {
      id: 'pay_order_401',
      title: 'charge-customer (₹450)',
      payload: { orderId: 'ord_401', amount: 450, idempotencyKey: 'idemp_ord_401' },
      state: 'waiting',
      lockTtl: 8,
      maxLockTtl: 8,
      stalledCount: 0,
      timesExecuted: 0,
      processedSideEffect: false,
    },
    {
      id: 'email_receipt_401',
      title: 'send-receipt-email',
      payload: { email: 'satyam@example.com' },
      state: 'waiting',
      lockTtl: 8,
      maxLockTtl: 8,
      stalledCount: 0,
      timesExecuted: 0,
      processedSideEffect: false,
    },
  ];

  private activeJob?: StalledDemoJob;
  private completedJobs: StalledDemoJob[] = [];
  private statusMessage = 'Queue ready with 2 workers. Click "Pick & Lock Job" to start processing.';
  private whyItMatters = 'BullMQ me worker Redis lock key acquire karta hai with a lockDuration TTL (default 30s).';
  private eventLog: Array<{ id: string; tick: number; message: string; type: 'info' | 'warning' | 'error' | 'success' }> = [];

  constructor() {}

  private log(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
    this.eventLog.unshift({
      id: `ev-${this.tick}-${Math.random().toString(36).substring(2, 6)}`,
      tick: this.tick,
      message,
      type,
    });
    if (this.eventLog.length > 50) this.eventLog.pop();
  }

  public setIdempotency(enabled: boolean) {
    this.idempotencyEnabled = enabled;
    this.statusMessage = enabled
      ? 'Idempotency enabled: Database unique key constraints will detect and ignore duplicate deliveries.'
      : 'Idempotency disabled: Duplicate deliveries will run the side-effect twice (Risk of double charges)!';
    this.whyItMatters = 'At-least-once queues me duplicate delivery guaranteed hoti hai, isliye consumer ka idempotent hona mandatory hai.';
  }

  /**
   * Worker picks job and acquires lock with TTL.
   */
  public pickJob(): boolean {
    const idleWorker = this.workers.find((w) => w.status === 'idle');
    if (!idleWorker) {
      this.statusMessage = 'Koi idle worker available nahi hai.';
      this.whyItMatters = 'Concurrency limit protects downstream systems from overload.';
      return false;
    }

    if (this.waitingJobs.length === 0) {
      this.statusMessage = 'Wait list me koi job nahi hai.';
      this.whyItMatters = 'Workers wait for new jobs via non-blocking pub/sub or BRPOPLPUSH.';
      return false;
    }

    const job = this.waitingJobs.shift()!;
    this.tick++;
    job.state = 'locked';
    job.workerId = idleWorker.id;
    job.lockTtl = job.maxLockTtl;
    job.timesExecuted++;

    idleWorker.status = 'processing';
    idleWorker.currentJobId = job.id;
    this.activeJob = job;

    // Simulate side effect execution (e.g. charging credit card)
    const idempKey = job.payload.idempotencyKey || job.id;
    if (this.idempotencyEnabled && this.dbProcessedKeys.has(idempKey)) {
      // Idempotency caught the duplicate!
      this.duplicateDetected = true;
      this.statusMessage = `[Idempotent Check] Job #${job.id} pehle hi process ho chuka hai (Key: ${idempKey}). Duplicate side effect skipped!`;
      this.whyItMatters = 'Idempotent consumer database me unique key check karta hai aur repeat call ko no-op bana deta hai.';
      this.log(`Idempotency check passed: ignored duplicate execution of #${job.id}`, 'success');
    } else {
      this.sideEffectExecutionCount++;
      if (job.timesExecuted > 1) {
        this.duplicateDetected = true;
        this.statusMessage = `⚠️ [ALERT] Job #${job.id} DUPLICATE run ho gaya! Side effect executed ${this.sideEffectExecutionCount} times!`;
        this.whyItMatters = 'Idempotency off hone ki wajah se credit card 2 baar charge ho gaya!';
        this.log(`Duplicate charge executed for Job #${job.id} without idempotency!`, 'error');
      } else {
        if (this.idempotencyEnabled) {
          this.dbProcessedKeys.add(idempKey);
        }
        this.statusMessage = `${idleWorker.name} ne Job #${job.id} pick kiya aur lock acquire kiya (Lock TTL: ${job.lockTtl}s).`;
        this.whyItMatters = 'Worker Redis lock duration set karta hai aur background timer se lock renew karta rehta hai.';
        this.log(`${idleWorker.name} acquired lock for #${job.id}`, 'info');
      }
    }

    return true;
  }

  /**
   * Heartbeat renewal: Active worker renews its lock TTL.
   */
  public renewHeartbeat(): boolean {
    if (!this.activeJob || !this.activeJob.workerId) {
      this.statusMessage = 'Lock renew karne ke liye koi active job nahi hai.';
      return false;
    }

    const worker = this.workers.find((w) => w.id === this.activeJob?.workerId);
    if (!worker || worker.status !== 'processing') {
      this.statusMessage = `Cannot renew lock: ${worker?.name || 'Worker'} is not active!`;
      return false;
    }

    this.tick++;
    this.activeJob.lockTtl = this.activeJob.maxLockTtl;
    worker.heartbeatsSent++;
    this.statusMessage = `${worker.name} ne lock heartbeat bheja. Lock TTL reset to ${this.activeJob.lockTtl}s.`;
    this.whyItMatters = 'BullMQ background heartbeat renews the Redis lock every lockDuration / 2 seconds.';
    this.log(`${worker.name} renewed lock for #${this.activeJob.id} (${this.activeJob.lockTtl}s)`, 'info');

    return true;
  }

  /**
   * Crash worker: worker dies immediately, heartbeats stop!
   */
  public crashWorker(workerId: string = 'w1'): boolean {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) return false;

    this.tick++;
    worker.status = 'crashed';
    this.statusMessage = `💥 ${worker.name} CRASHED! Heartbeats stop ho gayi hain, par Redis me lock abhi expire nahi hua hai.`;
    this.whyItMatters = 'Jab worker process crash ya OOM kill hota hai, tab Redis connection close hota hai par lock TTL expire hone tak job lock rehta hai.';
    this.log(`Worker ${worker.name} crashed while holding lock`, 'error');

    return true;
  }

  /**
   * Freeze worker: simulates blocked event loop (e.g. CPU heavy sync task).
   */
  public freezeWorker(workerId: string = 'w1'): boolean {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) return false;

    this.tick++;
    worker.status = 'frozen';
    this.statusMessage = `❄️ ${worker.name} event-loop FREEZE ho gaya (sync CPU task). Heartbeats block ho gayi hain!`;
    this.whyItMatters = 'Agar worker me synchronous heavy calculation (crypto, big JSON) ho, to event loop block hone se heartbeats ruk jaati hain.';
    this.log(`Worker ${worker.name} event-loop frozen (no heartbeats)`, 'warning');

    return true;
  }

  /**
   * Virtual tick: lock TTL counts down. If TTL hits 0, Watchdog triggers stalled recovery!
   */
  public tickClock(): void {
    this.tick++;

    if (this.activeJob && this.activeJob.state === 'locked') {
      this.activeJob.lockTtl--;

      if (this.activeJob.lockTtl <= 0) {
        // Watchdog detects stalled job!
        const stalledJob = this.activeJob;
        stalledJob.stalledCount++;
        stalledJob.state = 'waiting';
        stalledJob.workerId = undefined;
        this.activeJob = undefined;

        // Move back to waiting for another worker to pick up
        this.waitingJobs.unshift(stalledJob);

        this.statusMessage = `🚨 [WATCHDOG TRIGGERED] Lock expired for Job #${stalledJob.id}! Watchdog ne ise "Stalled" mark karke wait list me wapas bhej diya.`;
        this.whyItMatters = 'Stalled job recovery mechanism ensure karta hai ki crashed worker ka kaam hamesha doosre worker ko redeliver ho sake (At-Least-Once Delivery).';
        this.log(`Lock expired for #${stalledJob.id}. Re-queued as stalled job!`, 'warning');
        return;
      }
    }

    this.statusMessage = `Tick T+${this.tick}: Active lock TTL = ${this.activeJob?.lockTtl ?? 0}s.`;
    this.whyItMatters = 'Lock TTL countdown happens in real Redis via PEXPIRE / EXPIRE.';
  }

  /**
   * Complete active job successfully.
   */
  public completeJob(): boolean {
    if (!this.activeJob) {
      this.statusMessage = 'Complete karne ke liye koi active job nahi hai.';
      return false;
    }

    this.tick++;
    const job = this.activeJob;
    job.state = 'completed';
    const worker = this.workers.find((w) => w.id === job.workerId);
    if (worker) {
      worker.status = 'idle';
      worker.currentJobId = undefined;
    }
    this.completedJobs.push(job);
    this.activeJob = undefined;

    this.statusMessage = `Job #${job.id} successfully completed. Lock released cleanly.`;
    this.whyItMatters = 'Normal flow me job complete hone par worker lock key DEL karta hai.';
    this.log(`Job #${job.id} completed cleanly`, 'success');

    return true;
  }

  public reset(): void {
    this.tick = 0;
    this.duplicateDetected = false;
    this.sideEffectExecutionCount = 0;
    this.dbProcessedKeys.clear();
    this.activeJob = undefined;
    this.completedJobs = [];
    this.workers = [
      { id: 'w1', name: 'Worker-1 (Primary)', status: 'idle', heartbeatsSent: 0 },
      { id: 'w2', name: 'Worker-2 (Standby)', status: 'idle', heartbeatsSent: 0 },
    ];
    this.waitingJobs = [
      {
        id: 'pay_order_401',
        title: 'charge-customer (₹450)',
        payload: { orderId: 'ord_401', amount: 450, idempotencyKey: 'idemp_ord_401' },
        state: 'waiting',
        lockTtl: 8,
        maxLockTtl: 8,
        stalledCount: 0,
        timesExecuted: 0,
        processedSideEffect: false,
      },
      {
        id: 'email_receipt_401',
        title: 'send-receipt-email',
        payload: { email: 'satyam@example.com' },
        state: 'waiting',
        lockTtl: 8,
        maxLockTtl: 8,
        stalledCount: 0,
        timesExecuted: 0,
        processedSideEffect: false,
      },
    ];
    this.statusMessage = 'Queue reset ho gayi. Ready to demonstrate lock expiration & stalled recovery.';
    this.whyItMatters = 'Deterministic simulation reset.';
    this.log('Simulation reset', 'info');
  }

  public getSnapshot(): StalledDemoSnapshot {
    return {
      tick: this.tick,
      waitingJobs: this.waitingJobs.map((j) => ({ ...j })),
      activeJob: this.activeJob ? { ...this.activeJob } : undefined,
      completedJobs: this.completedJobs.map((j) => ({ ...j })),
      workers: this.workers.map((w) => ({ ...w })),
      idempotencyEnabled: this.idempotencyEnabled,
      duplicateDetected: this.duplicateDetected,
      sideEffectExecutionCount: this.sideEffectExecutionCount,
      dbProcessedKeys: Array.from(this.dbProcessedKeys),
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog],
    };
  }
}
