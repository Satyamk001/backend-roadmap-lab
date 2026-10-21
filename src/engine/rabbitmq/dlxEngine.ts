/**
 * RabbitMQ Dead Letter Exchange (DLX) & Delayed Retry Queue Simulation Engine
 *
 * Demonstrates:
 * 1. Poison job fails -> consumer calls ch.nack(msg, false, requeue=false).
 * 2. Broker inspects queue arguments: 'x-dead-letter-exchange: orders.dlx'.
 * 3. Message routes to DLX.
 * 4. Retry Loop:
 *    - If x-death count < maxRetries: routed to 'orders.retry' queue with 'x-message-ttl'.
 *    - When TTL expires in retry queue, message is dead-lettered BACK to main exchange!
 *    - If x-death count >= maxRetries: routed to 'orders.dlq' for human review/replay.
 */

export interface DlxMessage {
  id: string;
  type: 'normal' | 'poison';
  payload: string;
  deathCount: number; // simulated x-death count
  maxRetries: number;
  ttlRemaining: number; // ticks left in retry queue
  state: 'main_queue' | 'processing' | 'retry_queue' | 'dlq' | 'completed';
  errorLog?: string;
}

export interface DlxSnapshot {
  tick: number;
  mainQueue: DlxMessage[];
  activeJob?: DlxMessage;
  retryQueue: DlxMessage[];
  dlq: DlxMessage[];
  completed: DlxMessage[];
  statusMessage: string;
  whyItMatters: string;
}

export class RabbitMqDlxEngine {
  public tick = 0;
  private seq = 1;

  public mainQueue: DlxMessage[] = [];
  public activeJob?: DlxMessage;
  public retryQueue: DlxMessage[] = [];
  public dlq: DlxMessage[] = [];
  public completed: DlxMessage[] = [];

  public statusMessage = 'DLX engine ready. Publish normal or poison jobs to see retry & quarantine.';
  public whyItMatters = 'DLX poison messages ko main queue se alag karke head-of-line blocking rokti hai.';

  constructor() {
    this.reset();
  }

  public reset() {
    this.tick = 0;
    this.seq = 1;
    this.mainQueue = [];
    this.activeJob = undefined;
    this.retryQueue = [];
    this.dlq = [];
    this.completed = [];
    this.statusMessage = 'DLX engine initialized.';
    this.whyItMatters = 'DLX poison messages ko main queue se alag karke head-of-line blocking rokti hai.';
  }

  public publish(type: 'normal' | 'poison', payload?: string): DlxMessage {
    const msg: DlxMessage = {
      id: `ord-${this.seq++}`,
      type,
      payload: payload ?? (type === 'poison' ? 'Malformed payment token (throws SyntaxError)' : 'Order #1001 payment'),
      deathCount: 0,
      maxRetries: 2,
      ttlRemaining: 0,
      state: 'main_queue',
    };
    this.mainQueue.push(msg);
    this.statusMessage = `${type === 'poison' ? '🚨 Poison' : '📦 Normal'} job '${msg.id}' main queue me publish hua.`;
    this.whyItMatters = 'Main queue x-dead-letter-exchange: "orders.dlx" argument ke saath configured hai.';
    return msg;
  }

  public step(): void {
    this.tick += 1;

    // 1. Process retry queue TTL expiration
    const stillInRetry: DlxMessage[] = [];
    for (const msg of this.retryQueue) {
      msg.ttlRemaining -= 1;
      if (msg.ttlRemaining <= 0) {
        // TTL expired! Route BACK to main queue through main exchange
        msg.state = 'main_queue';
        this.mainQueue.push(msg);
        this.statusMessage = `TTL Expired! Message '${msg.id}' retry queue se expire hokar main exchange ke zariye wapas main queue me aa gaya (Attempt ${msg.deathCount + 1}).`;
        this.whyItMatters = 'RabbitMQ me bina plugin ke TTL + DLX pattern se non-blocking delayed retries implement hote hain.';
      } else {
        stillInRetry.push(msg);
      }
    }
    this.retryQueue = stillInRetry;

    // 2. If no active job, pull from mainQueue
    if (!this.activeJob && this.mainQueue.length > 0) {
      this.activeJob = this.mainQueue.shift()!;
      this.activeJob.state = 'processing';
      this.statusMessage = `Worker ne job '${this.activeJob.id}' process karna shuru kiya.`;
      this.whyItMatters = 'Worker message receive karke business logic execute karta hai.';
      return;
    }

    // 3. Process active job if present
    if (this.activeJob) {
      if (this.activeJob.type === 'normal') {
        // Normal job succeeds
        this.activeJob.state = 'completed';
        this.completed.unshift(this.activeJob);
        this.statusMessage = `Job '${this.activeJob.id}' successfully process hokar ch.ack() ho gaya.`;
        this.whyItMatters = 'Success par message delete ho gaya, queue clean rehti hai.';
        this.activeJob = undefined;
      } else {
        // Poison job fails!
        this.nackActive();
      }
    }
  }

  public nackActive(): void {
    if (!this.activeJob) return;

    const job = this.activeJob;
    job.deathCount += 1;
    this.activeJob = undefined;

    if (job.deathCount <= job.maxRetries) {
      // Send to retry queue with TTL = 2 ticks
      job.state = 'retry_queue';
      job.ttlRemaining = 2;
      job.errorLog = `Attempt ${job.deathCount} failed: Bad payload`;
      this.retryQueue.push(job);
      this.statusMessage = `Poison job '${job.id}' fail hua -> ch.nack(requeue=false) -> DLX ne ise retry queue (TTL: 2 ticks) me daal diya (Death count: ${job.deathCount}/${job.maxRetries}).`;
      this.whyItMatters = 'Message retry queue me wait karta hai, jisse main queue ke baaki healthy jobs bina delay process ho paate hain.';
    } else {
      // Retries exhausted! Send to DLQ
      job.state = 'dlq';
      job.errorLog = `Retries exhausted (${job.deathCount} failures). Quarantined in DLQ.`;
      this.dlq.unshift(job);
      this.statusMessage = `QUARANTINE! Job '${job.id}' ke saare retries (${job.maxRetries}) khatam ho gaye. Message DLQ me bhej diya gaya manual review ke liye.`;
      this.whyItMatters = 'DLQ poison messages ko isolate karti hai taaki infinite loop na bane aur alert trigger ho sake.';
    }
  }

  public replayDlq(id: string): boolean {
    const idx = this.dlq.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    const [msg] = this.dlq.splice(idx, 1);
    msg.state = 'main_queue';
    msg.deathCount = 0;
    msg.type = 'normal'; // Bug fixed before replay!
    msg.payload = 'Order #1001 payment (fixed schema)';
    this.mainQueue.push(msg);

    this.statusMessage = `Bug fix ke baad DLQ se message '${msg.id}' ko main exchange me re-publish kar diya gaya.`;
    this.whyItMatters = 'DLQ messages ko bug fix hone ke baad bina data loss ke replay kiya ja sakta hai (idempotency key zaroori hai).';
    return true;
  }

  public getSnapshot(): DlxSnapshot {
    return {
      tick: this.tick,
      mainQueue: this.mainQueue.map((m) => ({ ...m })),
      activeJob: this.activeJob ? { ...this.activeJob } : undefined,
      retryQueue: this.retryQueue.map((m) => ({ ...m })),
      dlq: this.dlq.map((m) => ({ ...m })),
      completed: this.completed.map((m) => ({ ...m })),
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
    };
  }
}
