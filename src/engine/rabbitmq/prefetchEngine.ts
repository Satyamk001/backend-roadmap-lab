/**
 * RabbitMQ Prefetch (basic.qos) & Fair Dispatch Simulation Engine
 *
 * Demonstrates:
 * - With prefetch=0 (unlimited), RabbitMQ round-robins messages blind to worker speed.
 *   Slow workers pile up unacked messages while fast workers sit idle (starvation).
 * - With prefetch=1 (fair dispatch), RabbitMQ only pushes messages when a worker has acked
 *   its current task, keeping fast workers busy and avoiding slow worker bottlenecks.
 */

export interface PrefetchTask {
  id: string;
  name: string;
  weight: 'light' | 'heavy';
  requiredTicks: number;
  ticksRemaining: number;
}

export interface PrefetchWorker {
  id: string;
  name: string;
  speedMultiplier: number; // 1 = fast, 3 = slow (takes 3x more ticks)
  prefetchLimit: number; // 0 = unlimited
  activeTask?: PrefetchTask;
  unackedBuffer: PrefetchTask[];
  completedCount: number;
  idleTicks: number;
}

export interface PrefetchSnapshot {
  tick: number;
  queue: PrefetchTask[];
  workers: PrefetchWorker[];
  prefetchSetting: number;
  roundRobinIndex: number;
  isAllCompleted: boolean;
  statusMessage: string;
  whyItMatters: string;
}

export class RabbitMqPrefetchEngine {
  public tick = 0;
  public prefetchSetting = 0; // 0 = unlimited round-robin
  private roundRobinPointer = 0;

  public queue: PrefetchTask[] = [];
  public workers: PrefetchWorker[] = [];

  public statusMessage = 'Prefetch engine ready. Choose prefetch setting and run simulation.';
  public whyItMatters = 'Prefetch(1) fair dispatch deta hai taaki slow worker choke na ho aur fast worker idle na baithe.';

  constructor(prefetch = 0) {
    this.prefetchSetting = prefetch;
    this.reset();
  }

  public reset() {
    this.tick = 0;
    this.roundRobinPointer = 0;
    this.workers = [
      {
        id: 'w-fast',
        name: 'Worker 1 (Fast: 2 ticks/task)',
        speedMultiplier: 1,
        prefetchLimit: this.prefetchSetting,
        unackedBuffer: [],
        completedCount: 0,
        idleTicks: 0,
      },
      {
        id: 'w-slow',
        name: 'Worker 2 (Slow: 6 ticks/task)',
        speedMultiplier: 3,
        prefetchLimit: this.prefetchSetting,
        unackedBuffer: [],
        completedCount: 0,
        idleTicks: 0,
      },
    ];
    this.loadBatch();
    this.dispatchMessages();
    this.updateStatus();
  }

  public setPrefetch(limit: number) {
    this.prefetchSetting = limit;
    this.workers.forEach((w) => (w.prefetchLimit = limit));
    this.dispatchMessages();
    this.updateStatus();
  }

  public loadBatch(taskCount = 6) {
    this.queue = [];
    for (let i = 1; i <= taskCount; i++) {
      this.queue.push({
        id: `t-${i}`,
        name: `Task #${i}`,
        weight: i % 2 === 0 ? 'heavy' : 'light',
        requiredTicks: i % 2 === 0 ? 4 : 2,
        ticksRemaining: i % 2 === 0 ? 4 : 2,
      });
    }
  }

  public step(): boolean {
    this.tick += 1;

    // 1. Advance active worker tasks
    let anyActive = false;

    for (const worker of this.workers) {
      if (!worker.activeTask && worker.unackedBuffer.length > 0) {
        worker.activeTask = worker.unackedBuffer.shift();
      }

      if (worker.activeTask) {
        anyActive = true;
        // Decrement remaining ticks based on worker speed
        worker.activeTask.ticksRemaining -= 1;

        if (worker.activeTask.ticksRemaining <= 0) {
          // Completed! Worker acks message
          worker.completedCount += 1;
          worker.activeTask = undefined;

          // Pull next from unacked buffer if available
          if (worker.unackedBuffer.length > 0) {
            worker.activeTask = worker.unackedBuffer.shift();
          }
        }
      } else {
        worker.idleTicks += 1;
      }
    }

    // 2. Dispatch new messages from queue if workers have available slots
    this.dispatchMessages();

    this.updateStatus();
    return anyActive || this.queue.length > 0;
  }

  public dispatchMessages() {
    if (this.queue.length === 0) return;

    if (this.prefetchSetting === 0) {
      // Unlimited prefetch: push ALL messages round-robin regardless of buffer size
      while (this.queue.length > 0) {
        const targetWorker = this.workers[this.roundRobinPointer % this.workers.length];
        this.roundRobinPointer += 1;
        const task = this.queue.shift()!;
        if (!targetWorker.activeTask) {
          targetWorker.activeTask = task;
        } else {
          targetWorker.unackedBuffer.push(task);
        }
      }
    } else {
      // Fair dispatch: only push to a worker whose in-flight (active + buffer) < prefetchSetting
      let progressMade = true;
      while (this.queue.length > 0 && progressMade) {
        progressMade = false;
        for (const worker of this.workers) {
          const currentInFlight = (worker.activeTask ? 1 : 0) + worker.unackedBuffer.length;
          if (currentInFlight < this.prefetchSetting && this.queue.length > 0) {
            const task = this.queue.shift()!;
            if (!worker.activeTask) {
              worker.activeTask = task;
            } else {
              worker.unackedBuffer.push(task);
            }
            progressMade = true;
          }
        }
      }
    }
  }

  private updateStatus() {
    const fastWorker = this.workers[0];
    const slowWorker = this.workers[1];

    if (this.prefetchSetting === 0) {
      this.statusMessage = `[Prefetch = 0 Unlimited] Round-robin ne bina worker speed dekhe barabar tasks baant diye. Slow worker (${slowWorker.completedCount} done, ${slowWorker.unackedBuffer.length} queued) par backlog jam gaya jabki Fast worker (${fastWorker.completedCount} done) idle baith gaya!`;
      this.whyItMatters = 'Bina prefetch ke RabbitMQ blind round-robin karta hai jisse slow consumers choke ho jaate hain aur fast consumers starve.';
    } else {
      this.statusMessage = `[Prefetch = ${this.prefetchSetting} Fair QoS] Fast worker ne turant acks dekar ${fastWorker.completedCount} tasks niptaye, Slow worker ne ${slowWorker.completedCount} task kiya. Koi worker unacked queue se choke nahi hua!`;
      this.whyItMatters = 'Prefetch=1 ensure karta hai ki broker worker ko naya message tabhi de jab pichla process hokar ack ho chuka ho.';
    }
  }

  public getSnapshot(): PrefetchSnapshot {
    return {
      tick: this.tick,
      queue: this.queue.map((t) => ({ ...t })),
      workers: this.workers.map((w) => ({
        ...w,
        activeTask: w.activeTask ? { ...w.activeTask } : undefined,
        unackedBuffer: w.unackedBuffer.map((t) => ({ ...t })),
      })),
      prefetchSetting: this.prefetchSetting,
      roundRobinIndex: this.roundRobinPointer,
      isAllCompleted:
        this.queue.length === 0 &&
        this.workers.every((w) => !w.activeTask && w.unackedBuffer.length === 0),
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
    };
  }
}
