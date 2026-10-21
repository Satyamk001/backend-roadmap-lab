/**
 * BullMQ Backoff Retries & Dead Letter Queue (DLQ) Engine
 * Deterministic simulation of exponential backoff retries,
 * delayed sorted-set transitions, poison pill handling, and DLQ inspection/replay.
 */

export interface BackoffJob {
  id: string;
  title: string;
  payload: Record<string, any>;
  state: 'waiting' | 'active' | 'delayed' | 'completed' | 'dlq';
  attempts: number;
  maxAttempts: number;
  baseDelayMs: number;
  backoffType: 'exponential' | 'fixed';
  currentDelayRemaining: number; // in seconds
  nextDelayCalculated: number;
  lastError?: string;
  history: Array<{ timestamp: number; attempt: number; error: string }>;
}

export interface BackoffDemoSnapshot {
  tick: number;
  waitingJobs: BackoffJob[];
  activeJob?: BackoffJob;
  delayedJobs: BackoffJob[];
  completedJobs: BackoffJob[];
  dlqJobs: BackoffJob[];
  statusMessage: string;
  whyItMatters: string;
  eventLog: Array<{ id: string; tick: number; message: string; type: 'info' | 'warning' | 'error' | 'success' }>;
}

export class BullBackoffEngine {
  private tick = 0;
  private waitingJobs: BackoffJob[] = [];
  private activeJob?: BackoffJob;
  private delayedJobs: BackoffJob[] = [];
  private completedJobs: BackoffJob[] = [];
  private dlqJobs: BackoffJob[] = [];

  private statusMessage = 'Backoff queue initialized. Send a job or a poison pill to test retries.';
  private whyItMatters = 'Transient network errors ko exponential backoff se handle kiya jata hai taaki downstream services overwhelm na hon.';
  private eventLog: Array<{ id: string; tick: number; message: string; type: 'info' | 'warning' | 'error' | 'success' }> = [];

  constructor() {
    this.reset();
  }

  private log(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info') {
    this.eventLog.unshift({
      id: `ev-${this.tick}-${Math.random().toString(36).substring(2, 6)}`,
      tick: this.tick,
      message,
      type,
    });
    if (this.eventLog.length > 50) this.eventLog.pop();
  }

  public reset(): void {
    this.tick = 0;
    this.activeJob = undefined;
    this.completedJobs = [];
    this.delayedJobs = [];
    this.dlqJobs = [];
    this.waitingJobs = [
      {
        id: 'job_webhook_901',
        title: 'dispatch-webhook (Payment)',
        payload: { event: 'payment.success', customer: 'cust_882', endpoint: 'https://api.merchant.com/webhook' },
        state: 'waiting',
        attempts: 0,
        maxAttempts: 3,
        baseDelayMs: 2, // 2 ticks base
        backoffType: 'exponential',
        currentDelayRemaining: 0,
        nextDelayCalculated: 2,
        history: [],
      },
    ];
    this.statusMessage = 'Queue ready. Click "Pick Job" to begin processing.';
    this.whyItMatters = 'BullMQ jobs configure max attempts and backoff strategy (exponential: 2^attempts * delay).';
    this.log('Queue reset with default webhook job', 'info');
  }

  /**
   * Adds a poison pill job that is guaranteed to fail repeatedly until DLQ.
   */
  public addPoisonPill(): void {
    this.tick++;
    const poisonJob: BackoffJob = {
      id: `poison_${Math.floor(Math.random() * 900 + 100)}`,
      title: 'poison-pill (Malformed JSON / 500 Bug)',
      payload: { invalidFormat: true, bug: 'NullPointerException at InvoiceGenerator.ts:42' },
      state: 'waiting',
      attempts: 0,
      maxAttempts: 3,
      baseDelayMs: 2,
      backoffType: 'exponential',
      currentDelayRemaining: 0,
      nextDelayCalculated: 2,
      history: [],
    };
    this.waitingJobs.push(poisonJob);
    this.statusMessage = `Added Poison Pill #${poisonJob.id}. Yeh job har baar fail karega taaki DLQ flow test kiya ja sake.`;
    this.whyItMatters = 'Poison pills without DLQ queue ko permanently choke kar dete hain. Max attempts DLQ me send karke queue ko unblock karta hai.';
    this.log(`Poison pill #${poisonJob.id} added to waiting queue`, 'warning');
  }

  /**
   * Worker picks the first waiting job.
   */
  public pickJob(): boolean {
    if (this.activeJob) {
      this.statusMessage = `Worker busy hai with Job #${this.activeJob.id}. Pehle ise complete ya fail karein.`;
      return false;
    }

    if (this.waitingJobs.length === 0) {
      this.statusMessage = 'Wait list me koi job nahi hai.';
      return false;
    }

    this.tick++;
    const job = this.waitingJobs.shift()!;
    job.state = 'active';
    job.attempts++;
    this.activeJob = job;

    this.statusMessage = `Worker ne Job #${job.id} pick kiya (Attempt ${job.attempts}/${job.maxAttempts}).`;
    this.whyItMatters = 'Attempt number increment hota hai aur job Redis active list me move ho jata hai.';
    this.log(`Job #${job.id} picked (Attempt ${job.attempts}/${job.maxAttempts})`, 'info');
    return true;
  }

  /**
   * Complete active job successfully.
   */
  public succeedJob(): boolean {
    if (!this.activeJob) {
      this.statusMessage = 'Koi active job nahi hai.';
      return false;
    }

    this.tick++;
    const job = this.activeJob;
    job.state = 'completed';
    this.completedJobs.push(job);
    this.activeJob = undefined;

    this.statusMessage = `Job #${job.id} successfully complete ho gaya!`;
    this.whyItMatters = 'Successful jobs Redis completed set me move hote hain with removeOnComplete retention config.';
    this.log(`Job #${job.id} marked as completed`, 'success');
    return true;
  }

  /**
   * Fail active job with error.
   * If attempts < maxAttempts: calculates exponential backoff delay and moves to delayed set.
   * If attempts >= maxAttempts: moves to Dead Letter Queue (DLQ).
   */
  public failJob(customError: string = 'Upstream 504 Gateway Timeout'): boolean {
    if (!this.activeJob) {
      this.statusMessage = 'Koi active job nahi hai jise fail kiya ja sake.';
      return false;
    }

    this.tick++;
    const job = this.activeJob;
    job.lastError = customError;
    job.history.push({
      timestamp: this.tick,
      attempt: job.attempts,
      error: customError,
    });
    this.activeJob = undefined;

    if (job.attempts < job.maxAttempts) {
      // Calculate exponential backoff: baseDelay * 2^(attempts - 1)
      const delaySeconds = job.baseDelayMs * Math.pow(2, job.attempts - 1);
      job.currentDelayRemaining = delaySeconds;
      job.nextDelayCalculated = job.baseDelayMs * Math.pow(2, job.attempts);
      job.state = 'delayed';
      this.delayedJobs.push(job);

      this.statusMessage = `⚠️ Job #${job.id} fail hua (${customError}). Exponential backoff: ${delaySeconds}s delay ke liye "Delayed" set me move kiya.`;
      this.whyItMatters = `Exponential delay: 2^${job.attempts - 1} * ${job.baseDelayMs}s = ${delaySeconds}s. BullMQ ise Redis ZSET me score = timestamp + delay ke sath store karta hai.`;
      this.log(`Job #${job.id} failed attempt ${job.attempts}/${job.maxAttempts}. Delayed for ${delaySeconds}s`, 'warning');
    } else {
      // Max attempts exhausted -> Move to DLQ
      job.state = 'dlq';
      this.dlqJobs.push(job);

      this.statusMessage = `🚨 [DLQ ALERT] Job #${job.id} ke sabhi ${job.maxAttempts} attempts exhaust ho gaye! Moved to Dead Letter Queue (DLQ).`;
      this.whyItMatters = 'Poison pills queue block na karein isliye exhausted retries wale jobs DLQ me jate hain for manual inspection and replay.';
      this.log(`Job #${job.id} exhausted retries -> Moved to DLQ!`, 'error');
    }

    return true;
  }

  /**
   * Fail job immediately with UnrecoverableError (Non-retryable error from Notion notes Section 4 & 10).
   * Bypasses remaining retry attempts and sends straight to DLQ.
   */
  public failWithUnrecoverableError(reason: string = 'UnrecoverableError: Invalid email format'): boolean {
    if (!this.activeJob) {
      this.statusMessage = 'Koi active job nahi hai.';
      return false;
    }

    this.tick++;
    const job = this.activeJob;
    job.lastError = reason;
    job.history.push({
      timestamp: this.tick,
      attempt: job.attempts,
      error: reason,
    });
    this.activeJob = undefined;
    job.state = 'dlq';
    this.dlqJobs.push(job);

    this.statusMessage = `🚨 [UnrecoverableError] Job #${job.id} seedha DLQ me bhej diya gaya (Non-retryable error, remaining retries skipped)!`;
    this.whyItMatters = 'Notion notes (Section 4 & 10): Validation errors par UnrecoverableError throw karke head-of-line blocking se bacha jata hai.';
    this.log(`Job #${job.id} threw UnrecoverableError -> Sent directly to DLQ`, 'error');
    return true;
  }

  /**
   * Virtual clock tick:
   * Decrements delay timer for all jobs in delayed set.
   * When delay reaches 0, moves back to waiting queue!
   */
  public tickClock(): void {
    this.tick++;

    const readyJobs: BackoffJob[] = [];
    const stillDelayedJobs: BackoffJob[] = [];

    for (const job of this.delayedJobs) {
      job.currentDelayRemaining--;
      if (job.currentDelayRemaining <= 0) {
        job.state = 'waiting';
        job.currentDelayRemaining = 0;
        readyJobs.push(job);
      } else {
        stillDelayedJobs.push(job);
      }
    }

    this.delayedJobs = stillDelayedJobs;
    for (const readyJob of readyJobs) {
      this.waitingJobs.push(readyJob);
      this.log(`Delay expired for #${readyJob.id}. Re-entered waiting queue for retry #${readyJob.attempts + 1}!`, 'info');
    }

    if (readyJobs.length > 0) {
      this.statusMessage = `Tick T+${this.tick}: ${readyJobs.length} job(s) ka backoff delay expire ho gaya. Wapas waiting list me add ho gaye!`;
      this.whyItMatters = 'Redis keyspace notifications ya BullMQ delay checker ZSET se expired jobs ko wait list me LPUSH karta hai.';
    } else if (this.delayedJobs.length > 0) {
      this.statusMessage = `Tick T+${this.tick}: ${this.delayedJobs.length} job(s) backoff delay me wait kar rahe hain.`;
      this.whyItMatters = 'Delayed set countdown simulates exponential backoff wait period.';
    } else {
      this.statusMessage = `Tick T+${this.tick}: Clock stepped.`;
      this.whyItMatters = 'Deterministic virtual clock progression.';
    }
  }

  /**
   * Replays a job from DLQ: resets attempts and moves back to waiting queue.
   */
  public replayDlqJob(jobId: string): boolean {
    const index = this.dlqJobs.findIndex((j) => j.id === jobId);
    if (index === -1) {
      this.statusMessage = `Job #${jobId} DLQ me nahi mila.`;
      return false;
    }

    this.tick++;
    const job = this.dlqJobs.splice(index, 1)[0];
    job.attempts = 0;
    job.state = 'waiting';
    job.currentDelayRemaining = 0;
    job.lastError = undefined;
    this.waitingJobs.push(job);

    this.statusMessage = `🔄 [DLQ REPLAY] Job #${job.id} replay ke liye wapas waiting queue me bhej diya gaya.`;
    this.whyItMatters = 'DLQ replay allows backend engineers to fix root causes (e.g. database schema, third party credentials) and safely re-process failed jobs.';
    this.log(`Job #${job.id} replayed from DLQ to waiting queue`, 'success');
    return true;
  }

  public getSnapshot(): BackoffDemoSnapshot {
    return {
      tick: this.tick,
      waitingJobs: this.waitingJobs.map((j) => ({ ...j })),
      activeJob: this.activeJob ? { ...this.activeJob } : undefined,
      delayedJobs: this.delayedJobs.map((j) => ({ ...j })),
      completedJobs: this.completedJobs.map((j) => ({ ...j })),
      dlqJobs: this.dlqJobs.map((j) => ({ ...j })),
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog],
    };
  }
}
