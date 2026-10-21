import { matchesTopic } from './topicMatcher';

export type ExchangeType = 'direct' | 'fanout' | 'topic' | 'default';

export interface QueueBinding {
  id: string;
  queueId: string;
  queueName: string;
  bindingKey: string;
}

export interface QueuedMessage {
  id: string;
  routingKey: string;
  payload: any;
  timestamp: number;
  deliveryTag: number;
  redelivered?: boolean;
}

export interface RouteEvaluationStep {
  queueId: string;
  queueName: string;
  bindingKey: string;
  matched: boolean;
  reason: string;
}

export interface RouteResult {
  message: QueuedMessage;
  exchangeType: ExchangeType;
  exchangeName: string;
  matchedQueueIds: string[];
  evaluations: RouteEvaluationStep[];
  alternateExchangeUsed?: string;
  unrouted: boolean;
  whatJustHappened: string;
  whyItMatters: string;
}

export interface RabbitMqExchangeConfig {
  name: string;
  type: ExchangeType;
  alternateExchange?: string;
  durable?: boolean;
}

export class RabbitMqExchangeEngine {
  public config: RabbitMqExchangeConfig;
  public bindings: QueueBinding[] = [];
  private deliveryTagSeq = 1;

  constructor(config: RabbitMqExchangeConfig, initialBindings: QueueBinding[] = []) {
    this.config = { durable: true, ...config };
    this.bindings = [...initialBindings];
  }

  public setExchangeType(type: ExchangeType) {
    this.config.type = type;
  }

  public addBinding(binding: Omit<QueueBinding, 'id'>): QueueBinding {
    const newBinding: QueueBinding = {
      id: `b-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...binding,
    };
    this.bindings.push(newBinding);
    return newBinding;
  }

  public removeBinding(id: string) {
    this.bindings = this.bindings.filter((b) => b.id !== id);
  }

  public route(
    routingKey: string,
    payload: any = {},
    customDeliveryTag?: number
  ): RouteResult {
    const message: QueuedMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      routingKey,
      payload,
      timestamp: Date.now(),
      deliveryTag: customDeliveryTag ?? this.deliveryTagSeq++,
      redelivered: false,
    };

    const evaluations: RouteEvaluationStep[] = [];
    const matchedQueueSet = new Set<string>();

    for (const binding of this.bindings) {
      let matched = false;
      let reason = '';

      switch (this.config.type) {
        case 'fanout':
          // Fanout ignores routing key completely, delivers to every bound queue
          matched = true;
          reason = `Fanout exchange routing key ignore karta hai: bound queue '${binding.queueName}' ko copy receive hogi.`;
          break;

        case 'direct':
          // Direct requires exact string equality
          if (binding.bindingKey === routingKey) {
            matched = true;
            reason = `Exact match: routingKey '${routingKey}' === bindingKey '${binding.bindingKey}'.`;
          } else {
            matched = false;
            reason = `Mismatch: routingKey '${routingKey}' !== bindingKey '${binding.bindingKey}'.`;
          }
          break;

        case 'default':
          // Nameless direct exchange: routes when routingKey matches queueName
          if (binding.queueName === routingKey || binding.queueId === routingKey) {
            matched = true;
            reason = `Default exchange: routingKey '${routingKey}' queue name se match hua.`;
          } else {
            matched = false;
            reason = `Default exchange: routingKey '${routingKey}' queue name '${binding.queueName}' se match nahi hua.`;
          }
          break;

        case 'topic':
          // Topic uses wildcard matching (* for 1 word, # for 0+ words)
          matched = matchesTopic(binding.bindingKey, routingKey);
          if (matched) {
            reason = `Pattern match: '${routingKey}' binding pattern '${binding.bindingKey}' ke rule me fit ho gaya.`;
          } else {
            reason = `Pattern mismatch: '${routingKey}' binding pattern '${binding.bindingKey}' se match nahi hua.`;
          }
          break;
      }

      evaluations.push({
        queueId: binding.queueId,
        queueName: binding.queueName,
        bindingKey: binding.bindingKey,
        matched,
        reason,
      });

      if (matched) {
        matchedQueueSet.add(binding.queueId);
      }
    }

    const matchedQueueIds = Array.from(matchedQueueSet);
    const unrouted = matchedQueueIds.length === 0;
    let alternateExchangeUsed: string | undefined;

    let whatJustHappened = '';
    let whyItMatters = '';

    if (unrouted) {
      if (this.config.alternateExchange) {
        alternateExchangeUsed = this.config.alternateExchange;
        whatJustHappened = `Message '${routingKey}' kisi binding se match nahi hua, isliye alternate exchange '${this.config.alternateExchange}' par route kar diya gaya.`;
        whyItMatters = 'Alternate exchange unrouted messages ke liye safety-net ka kaam karta hai taaki silent message drop na ho.';
      } else {
        whatJustHappened = `Message '${routingKey}' kisi bhi queue ki binding se match nahi hua — message silently drop ho gaya!`;
        whyItMatters = "RabbitMQ me agar koi binding match na ho aur mandatory flag/alternate exchange na ho, toh message drop ho jaata hai.";
      }
    } else {
      const queueNames = matchedQueueIds
        .map((qid) => this.bindings.find((b) => b.queueId === qid)?.queueName)
        .filter(Boolean)
        .join(', ');

      if (this.config.type === 'fanout') {
        whatJustHappened = `Fanout exchange ne routing key '${routingKey}' ko ignore karke sabhi ${matchedQueueIds.length} queues (${queueNames}) me ek-ek copy daal di.`;
        whyItMatters = 'Pub/Sub broadcasting me fanout exchange use hota hai jahan har subscriber queue ko har message ki copy milti hai.';
      } else if (this.config.type === 'direct') {
        whatJustHappened = `Direct exchange ne exact match dekha: message '${routingKey}' sirf matching queue (${queueNames}) tak gaya.`;
        whyItMatters = 'Direct exchange tab use hota hai jab message ko exact label ke aadhar par specific worker queue me bhejte hain.';
      } else if (this.config.type === 'topic') {
        whatJustHappened = `Topic exchange ne wildcards (*, #) evaluate kiye: '${routingKey}' ne ${matchedQueueIds.length} queues (${queueNames}) ko match kiya.`;
        whyItMatters = 'Topic exchange dynamic pattern matching deta hai jahan billing (order.*) aur analytics (#) dono ko sahi messages milte hain.';
      } else {
        whatJustHappened = `Default exchange ne direct routing key '${routingKey}' ko queue name se match karke deliver kiya.`;
        whyItMatters = "Default nameless exchange ('') simple work queues ke liye fast shortcut hota hai.";
      }
    }

    return {
      message,
      exchangeType: this.config.type,
      exchangeName: this.config.name,
      matchedQueueIds,
      evaluations,
      alternateExchangeUsed,
      unrouted,
      whatJustHappened,
      whyItMatters,
    };
  }
}
