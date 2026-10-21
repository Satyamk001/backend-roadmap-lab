/**
 * BullMQ Job Lifecycle Simulation Engine
 * Deterministic simulation of BullMQ Redis-backed job lifecycle:
 * waiting -> active (locked by worker) -> completed / failed / delayed.
 *
 * Implements atomic transitions modeled after BullMQ's Lua scripts in Redis.
 */

export type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

export interface BullJob {
  id: string;
  name: string;
  data: Record<string, any>;
  state: JobState;
  attemptsMade: number;
  maxAttempts: number;
  lockTtl?: number;
  workerId?: string;
  progress: number; // 0 to 100
  returnValue?: string;
  failedReason?: string;
  delayRemaining?: number;
  enqueuedTick: number;
  completedTick?: number;
}

export interface QueueWorker {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'crashed';
  currentJobId?: string;
}

export interface QueueEventLog {
  id: string;
  tick: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface BullQueueSnapshot {
  tick: number;
  waiting: BullJob[];
  active: BullJob[];
  completed: BullJob[];
  failed: BullJob[];
  delayed: BullJob[];
  workers: QueueWorker[];
  statusMessage: string;
  whyItMatters: string;
  eventLog: QueueEventLog[];
  stats: {
    totalAdded: number;
    totalCompleted: number;
    totalFailed: number;
  };
}

export class BullJobLifecycleEngine {
  private tick = 0;
  private jobs: Map<string, BullJob> = new Map();
  private workers: QueueWorker[] = [
    { id: 'w1', name: 'Worker-1 (email-mailer)', status: 'idle' },
    { id: 'w2', name: 'Worker-2 (invoice-pdf)', status: 'idle' },
  ];
  private statusMessage = 'Queue initialized. Click "Add Job" to push job to Redis wait list.';
  private whyItMatters = 'BullMQ me job ek Redis Hash hota hai aur state references Redis Lists & Sorted Sets me store hote hain.';
  private eventLog: QueueEventLog[] = [];
  private jobCounter = 100;
  private totalAdded = 0;
  private totalCompleted = 0;
  private totalFailed = 0;

  constructor() {
    this.seedInitialJobs();
  }

  private seedInitialJobs() {
    this.addJob('email:welcome', { to: 'asha@example.com', type: 'welcome' }, 3);
    this.addJob('pdf:invoice', { orderId: 'ord_9012', amount: 450 }, 2);
  }

  private logEvent(message: string, type: QueueEventLog['type'] = 'info') {
    this.eventLog.unshift({
      id: `ev-${this.tick}-${Math.random().toString(36).substring(2, 7)}`,
      tick: this.tick,
      message,
      type,
    });
    if (this.eventLog.length > 50) {
      this.eventLog.pop();
    }
  }

  public addJob(name: string, data: Record<string, any>, maxAttempts = 3, delay = 0): string {
    this.jobCounter++;
    const id = `job_${this.jobCounter}`;
    const isDelayed = delay > 0;

    const job: BullJob = {
      id,
      name,
      data,
      state: isDelayed ? 'delayed' : 'waiting',
      attemptsMade: 0,
      maxAttempts,
      progress: 0,
      delayRemaining: isDelayed ? delay : undefined,
      enqueuedTick: this.tick,
    };

    this.jobs.set(id, job);
    this.totalAdded++;

    if (isDelayed) {
      this.statusMessage = `Job #${id} (${name}) delayed set me add hua (${delay} ticks delay).`;
      this.whyItMatters = 'Delayed jobs Redis Sorted Set me score = execution timestamp ke saath store hote hain.';
      this.logEvent(`Job #${id} scheduled in delayed set (${delay} ticks)`, 'info');
    } else {
      this.statusMessage = `Job #${id} (${name}) Redis 'wait' list me LPUSH hua.`;
      this.whyItMatters = 'Producer sirf job enqueue karta hai aur turant 202 Accepted response deta hai.';
      this.logEvent(`Job #${id} (${name}) added to wait list`, 'info');
    }

    return id;
  }

  /**
   * Simulates an idle worker picking up the next job from the wait list.
   * Atomic Lua script in BullMQ: RPOPLPUSH wait -> active, creates lock key with TTL.
   */
  public stepPick(): boolean {
    const idleWorker = this.workers.find((w) => w.status === 'idle');
    if (!idleWorker) {
      this.statusMessage = 'Saare workers busy hain! Naya job pick karne ke liye worker ka complete ya fail hone ka wait karein.';
      this.whyItMatters = 'Worker concurrency limits resource utilization and prevents Node.js event-loop exhaustion.';
      return false;
    }

    const nextJob = Array.from(this.jobs.values()).find((j) => j.state === 'waiting');
    if (!nextJob) {
      this.statusMessage = 'Wait list me koi job nahi hai. "Add Job" click karke naya job dalein.';
      this.whyItMatters = 'Jab queue khaali ho, worker blocking Redis pop (BRPOPLPUSH / BLPOP) pe wait karta hai bina CPU burn kiye.';
      return false;
    }

    // Atomic move to active
    this.tick++;
    nextJob.state = 'active';
    nextJob.attemptsMade++;
    nextJob.workerId = idleWorker.id;
    nextJob.lockTtl = 15; // 15 ticks lock duration
    nextJob.progress = 25;

    idleWorker.status = 'busy';
    idleWorker.currentJobId = nextJob.id;

    this.statusMessage = `${idleWorker.name} ne Job #${nextJob.id} pick kiya (Attempt ${nextJob.attemptsMade}/${nextJob.maxAttempts}, Lock: 15s).`;
    this.whyItMatters = 'BullMQ atomic Lua script se job wait se active me daalta hai aur Redis lock key set karta hai taaki duplicate pick na ho.';
    this.logEvent(`${idleWorker.name} acquired lock for Job #${nextJob.id} (Attempt ${nextJob.attemptsMade})`, 'info');

    return true;
  }

  /**
   * Complete the currently active job on a worker.
   */
  public completeJob(jobId?: string): boolean {
    const targetJob = jobId
      ? this.jobs.get(jobId)
      : Array.from(this.jobs.values()).find((j) => j.state === 'active');

    if (!targetJob || targetJob.state !== 'active') {
      this.statusMessage = 'Completed karne ke liye koi active job nahi mila. Pehle job pick karein.';
      this.whyItMatters = 'Sirf active locked jobs complete kiye ja sakte hain.';
      return false;
    }

    this.tick++;
    targetJob.state = 'completed';
    targetJob.progress = 100;
    targetJob.returnValue = `result:done:${targetJob.id}`;
    targetJob.completedTick = this.tick;
    const workerId = targetJob.workerId;
    targetJob.workerId = undefined;
    targetJob.lockTtl = undefined;
    this.totalCompleted++;

    if (workerId) {
      const worker = this.workers.find((w) => w.id === workerId);
      if (worker) {
        worker.status = 'idle';
        worker.currentJobId = undefined;
      }
    }

    this.statusMessage = `Job #${targetJob.id} successfully complete ho gaya! Result: ${targetJob.returnValue}`;
    this.whyItMatters = 'Completion par worker Redis lock release karta hai aur job completed set me move hota hai.';
    this.logEvent(`Job #${targetJob.id} completed by ${workerId || 'worker'}`, 'success');

    return true;
  }

  /**
   * Fail the currently active job.
   * If attempts remain, moves to delayed backoff; otherwise moves to failed.
   */
  public failJob(jobId?: string, isFatal = false): boolean {
    const targetJob = jobId
      ? this.jobs.get(jobId)
      : Array.from(this.jobs.values()).find((j) => j.state === 'active');

    if (!targetJob || targetJob.state !== 'active') {
      this.statusMessage = 'Fail karne ke liye koi active job nahi mila.';
      this.whyItMatters = 'Processor jab error throw karta hai, tabhi BullMQ failure lifecycle trigger karta hai.';
      return false;
    }

    this.tick++;
    const workerId = targetJob.workerId;
    targetJob.workerId = undefined;
    targetJob.lockTtl = undefined;

    if (workerId) {
      const worker = this.workers.find((w) => w.id === workerId);
      if (worker) {
        worker.status = 'idle';
        worker.currentJobId = undefined;
      }
    }

    const canRetry = !isFatal && targetJob.attemptsMade < targetJob.maxAttempts;

    if (canRetry) {
      // Exponential delay: 2, 4, 8 ticks
      const backoffTicks = Math.pow(2, targetJob.attemptsMade);
      targetJob.state = 'delayed';
      targetJob.delayRemaining = backoffTicks;
      targetJob.failedReason = `TransientError: SMTP connection timeout (will retry in ${backoffTicks} ticks)`;

      this.statusMessage = `Job #${targetJob.id} fail hua! Attempts left: ${targetJob.maxAttempts - targetJob.attemptsMade}. Job ${backoffTicks} ticks ke liye delayed set me gaya.`;
      this.whyItMatters = 'Retry par job turant retry nahi hota; exponential backoff delayed set me daalta hai taaki downstream service recover ho sake.';
      this.logEvent(`Job #${targetJob.id} failed, retry scheduled in ${backoffTicks} ticks`, 'warning');
    } else {
      targetJob.state = 'failed';
      targetJob.failedReason = isFatal
        ? 'UnrecoverableError: Invalid email format'
        : `AttemptsExhausted: Max attempts (${targetJob.maxAttempts}) reached`;
      this.totalFailed++;

      this.statusMessage = `Job #${targetJob.id} permanent fail ho gaya! Reason: ${targetJob.failedReason}`;
      this.whyItMatters = 'Saari attempts khatam hone par job failed set (DLQ) me move hota hai taaki queue block na ho.';
      this.logEvent(`Job #${targetJob.id} permanently failed`, 'error');
    }

    return true;
  }

  /**
   * Advances the clock tick: counts down delayed jobs and moves them to waiting when ready.
   */
  public advanceClock(): void {
    this.tick++;

    // Check delayed jobs
    let delayedMoved = 0;
    for (const job of this.jobs.values()) {
      if (job.state === 'delayed' && job.delayRemaining !== undefined) {
        job.delayRemaining--;
        if (job.delayRemaining <= 0) {
          job.state = 'waiting';
          job.delayRemaining = undefined;
          delayedMoved++;
        }
      }
    }

    if (delayedMoved > 0) {
      this.statusMessage = `Clock tick ${this.tick}: ${delayedMoved} delayed job(s) ready hokar wait list me move ho gaye.`;
      this.whyItMatters = 'BullMQ background timer score <= now wale delayed jobs ko atomic Lua se wait list me convert karta hai.';
      this.logEvent(`${delayedMoved} delayed job(s) moved to waiting list`, 'info');
    } else {
      this.statusMessage = `Clock tick ${this.tick} advanced.`;
      this.whyItMatters = 'Virtual tick state transition timers aur delay countdown advance karta hai.';
    }
  }

  public reset(): void {
    this.tick = 0;
    this.jobs.clear();
    this.workers.forEach((w) => {
      w.status = 'idle';
      w.currentJobId = undefined;
    });
    this.eventLog = [];
    this.jobCounter = 100;
    this.totalAdded = 0;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.seedInitialJobs();
    this.statusMessage = 'Queue reset ho gayi. Initial seed jobs wait list me ready hain.';
    this.whyItMatters = 'Deterministic simulation initial seed par wapas restore ho gayi.';
    this.logEvent('Queue reset to initial state', 'info');
  }

  public getSnapshot(): BullQueueSnapshot {
    const all = Array.from(this.jobs.values());
    return {
      tick: this.tick,
      waiting: all.filter((j) => j.state === 'waiting'),
      active: all.filter((j) => j.state === 'active'),
      completed: all.filter((j) => j.state === 'completed'),
      failed: all.filter((j) => j.state === 'failed'),
      delayed: all.filter((j) => j.state === 'delayed'),
      workers: this.workers.map((w) => ({ ...w })),
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog],
      stats: {
        totalAdded: this.totalAdded,
        totalCompleted: this.totalCompleted,
        totalFailed: this.totalFailed,
      },
    };
  }
}
