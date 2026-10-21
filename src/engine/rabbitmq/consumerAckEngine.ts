/**
 * RabbitMQ Consumer Acknowledgment & Redelivery Engine
 * Simulates:
 * - Manual ack (ch.ack) -> message deleted
 * - Manual nack with requeue=true (ch.nack) -> requeued with redelivered: true
 * - Manual nack with requeue=false -> routed to DLX / dropped
 * - Consumer crash with pending unacked messages -> broker redelivers with redelivered: true
 * - Auto-ack (noAck: true) -> deleted on delivery, worker crash causes message loss
 */

export interface ConsumerMessage {
  id: string;
  payload: string;
  deliveryTag: number;
  state: 'ready' | 'unacknowledged' | 'acked' | 'dead_lettered' | 'lost';
  assignedConsumerId?: string;
  redelivered: boolean;
  publishedAt: number;
  deliveryCount: number;
}

export interface ConsumerWorker {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'crashed';
  currentDeliveryTag?: number;
}

export interface AckDemoSnapshot {
  readyQueue: ConsumerMessage[];
  unackedMessages: ConsumerMessage[];
  ackedMessages: ConsumerMessage[];
  deadLetterQueue: ConsumerMessage[];
  lostMessages: ConsumerMessage[];
  workers: ConsumerWorker[];
  autoAck: boolean;
  statusMessage: string;
  whyItMatters: string;
}

export class RabbitMqConsumerAckEngine {
  private seq = 1;
  private autoAck = false;
  private readyQueue: ConsumerMessage[] = [];
  private unackedMessages: ConsumerMessage[] = [];
  private ackedMessages: ConsumerMessage[] = [];
  private deadLetterQueue: ConsumerMessage[] = [];
  private lostMessages: ConsumerMessage[] = [];

  private workers: ConsumerWorker[] = [
    { id: 'w-1', name: 'Worker 1 (Billing)', status: 'idle' },
    { id: 'w-2', name: 'Worker 2 (Invoicing)', status: 'idle' },
  ];

  public statusMessage = 'Queue ready. Publish a message to see the acknowledgment cycle.';
  public whyItMatters = 'RabbitMQ me at-least-once guarantee manual ack ke zariye milti hai.';

  constructor(autoAck = false) {
    this.autoAck = autoAck;
    this.reset();
  }

  public reset() {
    this.seq = 1;
    this.readyQueue = [];
    this.unackedMessages = [];
    this.ackedMessages = [];
    this.deadLetterQueue = [];
    this.lostMessages = [];
    this.workers = [
      { id: 'w-1', name: 'Worker 1 (Billing)', status: 'idle' },
      { id: 'w-2', name: 'Worker 2 (Invoicing)', status: 'idle' },
    ];
    this.statusMessage = 'Queue initialized. Publish a message to start.';
    this.whyItMatters = 'RabbitMQ me at-least-once guarantee manual ack ke zariye milti hai.';
  }

  public setAutoAck(enabled: boolean) {
    this.autoAck = enabled;
    this.statusMessage = enabled
      ? 'Auto-ack (noAck: true) enabled: messages deliver hote hi delete ho jaate hain (crash hone par data loss risk!).'
      : 'Manual ack (noAck: false) enabled: messages processing poori hone ke baad hi delete hote hain.';
    this.whyItMatters = enabled
      ? 'Auto-ack sirf high-speed non-critical telemetry ke liye use hota hai jahan data loss acceptable ho.'
      : 'Production backend services me hamesha manual ack use karte hain taaki crash par message safe rahe.';
  }

  public publish(payload: string): ConsumerMessage {
    const msg: ConsumerMessage = {
      id: `job-${this.seq}`,
      payload,
      deliveryTag: this.seq++,
      state: 'ready',
      redelivered: false,
      publishedAt: Date.now(),
      deliveryCount: 0,
    };
    this.readyQueue.push(msg);
    this.statusMessage = `Message '${msg.id}' queue me publish hua (Delivery Tag: ${msg.deliveryTag}).`;
    this.whyItMatters = 'Message queue me durable buffer ki tarah wait kar raha hai jab tak koi free worker na mile.';
    return msg;
  }

  public dispatchNext(): boolean {
    if (this.readyQueue.length === 0) return false;
    const idleWorker = this.workers.find((w) => w.status === 'idle');
    if (!idleWorker) return false;

    const msg = this.readyQueue.shift()!;
    msg.assignedConsumerId = idleWorker.id;
    msg.deliveryCount += 1;
    idleWorker.status = 'processing';
    idleWorker.currentDeliveryTag = msg.deliveryTag;

    if (this.autoAck) {
      // In auto-ack mode, broker deletes message from queue IMMEDIATELY upon delivery
      msg.state = 'acked';
      this.ackedMessages.unshift(msg);
      this.statusMessage = `[Auto-ack] Message '${msg.id}' ${idleWorker.name} ko deliver hote hi broker ne turant delete kar diya!`;
      this.whyItMatters = 'Auto-ack me worker crash hua toh broker ke paas message nahi bachega (lost).';
    } else {
      // Manual ack mode: message stays unacknowledged in memory
      msg.state = 'unacknowledged';
      this.unackedMessages.push(msg);
      this.statusMessage = `Message '${msg.id}' ${idleWorker.name} ko deliver hua. Broker ack ka wait kar raha hai (Unacknowledged).`;
      this.whyItMatters = 'Jab tak worker ack nahi bhejta, broker message ko queue se delete nahi karta.';
    }
    return true;
  }

  public ack(workerId: string): boolean {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker || worker.status !== 'processing' || !worker.currentDeliveryTag) return false;

    const tag = worker.currentDeliveryTag;
    const msgIndex = this.unackedMessages.findIndex((m) => m.deliveryTag === tag);
    if (msgIndex === -1) {
      // Could be auto-ack already marked
      worker.status = 'idle';
      worker.currentDeliveryTag = undefined;
      return true;
    }

    const [msg] = this.unackedMessages.splice(msgIndex, 1);
    msg.state = 'acked';
    this.ackedMessages.unshift(msg);

    worker.status = 'idle';
    worker.currentDeliveryTag = undefined;

    this.statusMessage = `${worker.name} ne ch.ack(${tag}) call kiya. Broker ne message '${msg.id}' ko queue se successfully delete kar diya.`;
    this.whyItMatters = 'Ack hamesha business logic aur DB transaction commit hone ke BAAD bhejna chahiye.';
    return true;
  }

  public nack(workerId: string, requeue: boolean): boolean {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker || worker.status !== 'processing' || !worker.currentDeliveryTag) return false;

    const tag = worker.currentDeliveryTag;
    const msgIndex = this.unackedMessages.findIndex((m) => m.deliveryTag === tag);
    if (msgIndex === -1) return false;

    const [msg] = this.unackedMessages.splice(msgIndex, 1);
    worker.status = 'idle';
    worker.currentDeliveryTag = undefined;

    if (requeue) {
      msg.state = 'ready';
      msg.redelivered = true;
      msg.assignedConsumerId = undefined;
      this.readyQueue.unshift(msg); // Put back to front of queue
      this.statusMessage = `${worker.name} ne ch.nack(${tag}, false, requeue=true) kiya. Message queue ke head par redelivered: true badge ke saath wapas aa gaya.`;
      this.whyItMatters = 'Requeue temporary failure (jaise DB blip) ke liye theek hai, par poison message me retry limit lagana zaroori hai.';
    } else {
      msg.state = 'dead_lettered';
      this.deadLetterQueue.unshift(msg);
      this.statusMessage = `${worker.name} ne ch.nack(${tag}, false, requeue=false) kiya. Message Dead Letter Exchange (DLX) ko forward ho gaya.`;
      this.whyItMatters = 'requeue=false permanent errors aur malformed data ke liye use hota hai taaki queue block na ho.';
    }
    return true;
  }

  public crashWorker(workerId: string): boolean {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) return false;

    worker.status = 'crashed';

    if (this.autoAck) {
      // In auto-ack, worker was processing something that was already deleted from broker!
      if (worker.currentDeliveryTag) {
        const lostMsg = this.ackedMessages.find((m) => m.deliveryTag === worker.currentDeliveryTag);
        if (lostMsg) {
          lostMsg.state = 'lost';
          this.lostMessages.unshift(lostMsg);
        }
      }
      this.statusMessage = `CRASH! ${worker.name} crash ho gaya. Auto-ack ki wajah se in-flight message hamesha ke liye LOST ho gaya!`;
      this.whyItMatters = 'Auto-ack me crash = permanent data loss. Isi liye critical financial pipelines me manual ack mandatory hai.';
      return true;
    }

    // Manual ack mode: broker redelivers all unacked messages held by this connection
    const unackedForWorker = this.unackedMessages.filter(
      (m) => m.assignedConsumerId === workerId
    );

    this.unackedMessages = this.unackedMessages.filter(
      (m) => m.assignedConsumerId !== workerId
    );

    unackedForWorker.forEach((msg) => {
      msg.state = 'ready';
      msg.redelivered = true;
      msg.assignedConsumerId = undefined;
      this.readyQueue.unshift(msg); // RabbitMQ requeues to head
    });

    this.statusMessage = `CRASH! ${worker.name} crash ho gaya. Broker ne connection drop detect kiya aur ${unackedForWorker.length} unacked message(s) ko redelivered: true ke saath queue me wapas daal diya.`;
    this.whyItMatters = 'RabbitMQ at-least-once guarantee deta hai: consumer mar bhi jaye toh message safe rehta hai aur doosra consumer use pick kar leta hai.';
    return true;
  }

  public recoverWorker(workerId: string): boolean {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker || worker.status !== 'crashed') return false;
    worker.status = 'idle';
    worker.currentDeliveryTag = undefined;
    this.statusMessage = `${worker.name} recover ho gaya aur naye messages process karne ke liye ready hai.`;
    this.whyItMatters = 'Kubernetes pod restart hone ke baad naya channel khol kar seamlessly queue se consume karna shuru kar deta hai.';
    return true;
  }

  public getSnapshot(): AckDemoSnapshot {
    return {
      readyQueue: [...this.readyQueue],
      unackedMessages: [...this.unackedMessages],
      ackedMessages: [...this.ackedMessages],
      deadLetterQueue: [...this.deadLetterQueue],
      lostMessages: [...this.lostMessages],
      workers: this.workers.map((w) => ({ ...w })),
      autoAck: this.autoAck,
      statusMessage: this.statusMessage,
      whyItMatters: this.whyItMatters,
    };
  }
}
