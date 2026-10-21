/**
 * Engine for Demo 1: Sync HTTP vs Async Queue
 * Deterministic simulation showing why queues exist in backend engineering:
 * Comparing blocking synchronous execution (high latency, 504 timeouts, thread exhaustion)
 * against asynchronous background queues (instant 202 Accepted, decoupled workers, resilient buffers).
 */

export interface HttpRequest {
  id: string;
  type: 'pdf' | 'email' | 'report';
  label: string;
  status: 'processing' | 'completed' | 'timeout';
  durationSeconds: number;
  remainingSeconds: number;
  responseTimeMs: number;
  httpStatus: number; // 200, 202, or 504
}

export interface QueueJob {
  id: string;
  type: 'pdf' | 'email' | 'report';
  label: string;
  state: 'queued' | 'processing' | 'completed';
  workerId?: string;
  progress: number; // 0 to 100
}

export interface SyncAsyncWorker {
  id: string;
  name: string;
  status: 'idle' | 'busy';
  currentJobId?: string;
}

export interface SyncAsyncSnapshot {
  mode: 'sync' | 'async';
  tick: number;
  httpThreadsUsed: number;
  maxHttpThreads: number;
  activeRequests: HttpRequest[];
  queue: QueueJob[];
  workers: SyncAsyncWorker[];
  completedCount: number;
  timeoutCount: number;
  avgResponseTimeMs: number;
  guidedStep: number;
  statusMessage: string;
  whyItMatters: string;
  eventLog: Array<{ id: string; tick: number; message: string; type: 'info' | 'warning' | 'error' | 'success' }>;
}

export class SyncVsAsyncEngine {
  private mode: 'sync' | 'async' = 'sync';
  private tick = 0;
  private readonly maxHttpThreads = 3; // Simulates server worker thread pool limit
  private activeRequests: HttpRequest[] = [];
  private queue: QueueJob[] = [];
  private workers: SyncAsyncWorker[] = [
    { id: 'w1', name: 'Background Worker A', status: 'idle' },
    { id: 'w2', name: 'Background Worker B', status: 'idle' },
  ];
  private completedCount = 0;
  private timeoutCount = 0;
  private totalResponseTimeMs = 0;
  private totalCompletedRequests = 0;
  private guidedStep = 0;

  private statusMessage = 'Ready. Click "Send Request" to observe synchronous HTTP blocking.';
  private whyItMatters = 'Sync requests me user ka browser HTTP connection hold karke wait karta hai jab tak heavy task khatam na ho.';
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

  public setMode(mode: 'sync' | 'async'): void {
    this.mode = mode;
    this.tick++;
    if (mode === 'sync') {
      this.statusMessage = 'Switched to Synchronous Mode: Heavy tasks HTTP thread ko block karenge.';
      this.whyItMatters = 'Agar 3 se zyada concurrent requests aayi to thread pool exhaust ho jayega aur 504 Timeout aayega.';
      this.log('Mode switched to SYNCHRONOUS', 'warning');
    } else {
      this.statusMessage = 'Switched to Asynchronous Queue Mode: API turant 202 Accepted return karegi (~15ms).';
      this.whyItMatters = 'Tasks Redis queue me buffer ho jate hain aur background workers unhe safely drain karte hain.';
      this.log('Mode switched to ASYNCHRONOUS QUEUE', 'success');
    }
  }

  public setGuidedStep(step: number): void {
    this.guidedStep = step;
  }

  /**
   * Send a single heavy task request (e.g. POST /signup with welcome email from Notion notes).
   */
  public sendRequest(type: 'email' | 'pdf' | 'report' = 'email'): boolean {
    this.tick++;
    const id = `req_${Math.floor(Math.random() * 9000 + 1000)}`;
    const label = type === 'email'
      ? 'POST /signup (sendWelcomeEmail)'
      : type === 'report'
      ? 'POST /report (report.generate)'
      : 'POST /invoice (render-pdf)';
    const taskDuration = 3; // 3 seconds virtual duration

    if (this.mode === 'sync') {
      // Check if thread pool is full
      const activeThreads = this.activeRequests.filter((r) => r.status === 'processing').length;
      if (activeThreads >= this.maxHttpThreads) {
        // HTTP 504 Gateway Timeout! Thread pool exhausted!
        this.timeoutCount++;
        const timeoutReq: HttpRequest = {
          id,
          type,
          label,
          status: 'timeout',
          durationSeconds: taskDuration,
          remainingSeconds: taskDuration,
          responseTimeMs: 5000,
          httpStatus: 504,
        };
        this.activeRequests.unshift(timeoutReq);
        this.statusMessage = `🚨 [504 GATEWAY TIMEOUT] Server thread pool full (${this.maxHttpThreads}/${this.maxHttpThreads})! Request #${id} drop ho gayi.`;
        this.whyItMatters = 'Bina queue ke sudden traffic aane par API server ke saare threads block ho jate hain aur naye users ko 504 Timeout milta hai.';
        this.log(`Thread pool exhausted -> Request #${id} timed out with HTTP 504!`, 'error');
        return false;
      }

      // Thread available: request starts processing synchronously
      const req: HttpRequest = {
        id,
        type,
        label,
        status: 'processing',
        durationSeconds: taskDuration,
        remainingSeconds: taskDuration,
        responseTimeMs: 3200, // 3.2s
        httpStatus: 200,
      };
      this.activeRequests.unshift(req);
      this.statusMessage = `⏳ [SYNC HTTP] Request #${id} received. Client connection blocked for ${taskDuration}s...`;
      this.whyItMatters = 'Browser loading spinner ghoom raha hai. Agar user tab band kar de ya network glitch ho to kaam fail.';
      this.log(`Client HTTP connection blocked by #${id} (${taskDuration}s heavy task)`, 'warning');
      return true;
    } else {
      // Async Mode: Instant 202 Accepted!
      const req: HttpRequest = {
        id,
        type,
        label,
        status: 'completed',
        durationSeconds: 0,
        remainingSeconds: 0,
        responseTimeMs: 12, // 12ms!
        httpStatus: 202,
      };
      this.activeRequests.unshift(req);
      this.totalResponseTimeMs += 12;
      this.totalCompletedRequests++;

      // Enqueue job into Redis buffer
      const job: QueueJob = {
        id,
        type,
        label,
        state: 'queued',
        progress: 0,
      };
      this.queue.push(job);

      this.statusMessage = `⚡ [202 ACCEPTED] Request #${id} instantly accepted in 12ms! Job Redis queue me buffer ho gaya.`;
      this.whyItMatters = 'API server free hai naye requests lene ke liye. Background workers queue se jobs uthayenge.';
      this.log(`Instant 202 Accepted for #${id} (12ms). Buffered in queue.`, 'success');

      // Auto assign to idle worker if available
      this.drainQueueToWorkers();
      return true;
    }
  }

  /**
   * Simulate a sudden spike of 5 concurrent requests (e.g. Flash sale / notification blast).
   */
  public sendSpike(count: number = 5): void {
    this.tick++;
    let accepted = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
      const types: Array<'pdf' | 'email' | 'report'> = ['pdf', 'email', 'report'];
      const chosenType = types[i % types.length];
      const ok = this.sendRequest(chosenType);
      if (ok) accepted++;
      else failed++;
    }

    if (this.mode === 'sync') {
      this.statusMessage = `💥 Traffic Spike (${count} requests): ${accepted} accepted, ${failed} failed with 504 Gateway Timeout!`;
      this.whyItMatters = 'Synchronous architecture me traffic spike seedha server crash ya timeouts me convert ho jata hai.';
      this.log(`Spike of ${count} requests -> ${failed} timeouts!`, 'error');
    } else {
      this.statusMessage = `🛡️ Traffic Spike (${count} requests): All ${count} requests accepted in <15ms! Queue buffer absorbed the spike.`;
      this.whyItMatters = 'Queue acts as a load-leveling shock absorber. Traffic spikes downstream workers ko overload nahi kar paate.';
      this.log(`Spike of ${count} requests absorbed smoothly by queue buffer`, 'success');
    }
  }

  /**
   * Advances the simulation clock by 1 tick (1s).
   */
  public step(): void {
    this.tick++;

    if (this.mode === 'sync') {
      let completedAny = false;
      for (const req of this.activeRequests) {
        if (req.status === 'processing') {
          req.remainingSeconds--;
          if (req.remainingSeconds <= 0) {
            req.status = 'completed';
            this.completedCount++;
            this.totalResponseTimeMs += req.responseTimeMs;
            this.totalCompletedRequests++;
            completedAny = true;
          }
        }
      }

      if (completedAny) {
        this.statusMessage = `Sync request complete! Client ko 200 OK mila. Total response latency: ~3200ms.`;
        this.whyItMatters = 'Thread release ho gaya, par user ne 3+ seconds intezaar kiya.';
        this.log('Sync HTTP request finished and thread released', 'info');
      } else {
        const busy = this.activeRequests.filter((r) => r.status === 'processing').length;
        this.statusMessage = `Tick T+${this.tick}: ${busy} HTTP thread(s) busy with heavy processing.`;
        this.whyItMatters = 'Active HTTP connections memory aur sockets hold karke rakhte hain.';
      }
    } else {
      // Async Mode: progress jobs assigned to workers
      let finishedJob = false;
      for (const worker of this.workers) {
        if (worker.status === 'busy' && worker.currentJobId) {
          const job = this.queue.find((j) => j.id === worker.currentJobId);
          if (job) {
            job.progress += 50; // Takes 2 ticks to complete
            if (job.progress >= 100) {
              job.state = 'completed';
              worker.status = 'idle';
              worker.currentJobId = undefined;
              this.completedCount++;
              finishedJob = true;
              this.log(`${worker.name} finished Job #${job.id} (${job.label})`, 'success');
            }
          }
        }
      }

      // Check for waiting jobs and assign to idle workers
      this.drainQueueToWorkers();

      if (finishedJob) {
        this.statusMessage = `Background worker ne job complete kar diya! User experience unaffected.`;
        this.whyItMatters = 'Workers independent speed par chalte hain, chahe 1000 jobs queue me kyu na hon.';
      } else {
        const queuedCount = this.queue.filter((j) => j.state === 'queued').length;
        this.statusMessage = `Tick T+${this.tick}: Workers processing in background. Buffer has ${queuedCount} waiting jobs.`;
        this.whyItMatters = 'Queue decouples response latency from actual task execution duration.';
      }
    }
  }

  private drainQueueToWorkers(): void {
    const idleWorkers = this.workers.filter((w) => w.status === 'idle');
    const waitingJobs = this.queue.filter((j) => j.state === 'queued');

    for (let i = 0; i < Math.min(idleWorkers.length, waitingJobs.length); i++) {
      const worker = idleWorkers[i];
      const job = waitingJobs[i];
      worker.status = 'busy';
      worker.currentJobId = job.id;
      job.state = 'processing';
      job.workerId = worker.id;
      this.log(`${worker.name} picked Job #${job.id} from queue`, 'info');
    }
  }

  public reset(): void {
    this.tick = 0;
    this.activeRequests = [];
    this.queue = [];
    this.workers = [
      { id: 'w1', name: 'Background Worker A', status: 'idle' },
      { id: 'w2', name: 'Background Worker B', status: 'idle' },
    ];
    this.completedCount = 0;
    this.timeoutCount = 0;
    this.totalResponseTimeMs = 0;
    this.totalCompletedRequests = 0;
    this.guidedStep = 0;
    this.statusMessage = 'Simulation reset. Click "Send Request" or "Walk me through" to begin.';
    this.whyItMatters = 'Sync vs Async queue comparison reset.';
    this.log('Simulation reset', 'info');
  }

  public getSnapshot(): SyncAsyncSnapshot {
    const activeThreads = this.activeRequests.filter((r) => r.status === 'processing').length;
    const avgLatency = this.totalCompletedRequests > 0
      ? Math.round(this.totalResponseTimeMs / this.totalCompletedRequests)
      : this.mode === 'sync' ? 3200 : 12;

    return {
      mode: this.mode,
      tick: this.tick,
      httpThreadsUsed: activeThreads,
      maxHttpThreads: this.maxHttpThreads,
      activeRequests: this.activeRequests.slice(0, 10).map((r) => ({ ...r })),
      queue: this.queue.map((q) => ({ ...q })),
      workers: this.workers.map((w) => ({ ...w })),
      completedCount: this.completedCount,
      timeoutCount: this.timeoutCount,
      avgResponseTimeMs: avgLatency,
      guidedStep: this.guidedStep,
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog],
    };
  }
}
