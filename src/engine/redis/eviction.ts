/**
 * Redis TTL & Maxmemory Eviction Simulation Engine
 * Deterministic model of Redis memory constraints, active/lazy TTL expiration,
 * and eviction policies (noeviction, allkeys-lru, allkeys-lfu, volatile-lru, volatile-ttl).
 */

export type EvictionPolicy =
  | 'noeviction'
  | 'allkeys-lru'
  | 'allkeys-lfu'
  | 'volatile-lru'
  | 'volatile-lfu'
  | 'volatile-ttl';

export interface EvictionKeyItem {
  key: string;
  sizeBytes: number;
  createdTick: number;
  lastAccessedTick: number;
  accessCount: number;
  ttlSeconds?: number;
  expiresAtTick?: number;
}

export interface EvictionLogEvent {
  id: string;
  tick: number;
  action: string;
  detail: string;
  type: 'success' | 'error' | 'info';
}

export interface EvictionSnapshot {
  tick: number;
  policy: EvictionPolicy;
  maxmemoryBytes: number;
  usedMemoryBytes: number;
  memoryUsagePercent: number;
  keys: EvictionKeyItem[];
  stats: {
    evictedKeysCount: number;
    expiredKeysCount: number;
    rejectedWritesCount: number;
    totalOpsCount: number;
  };
  whatJustHappened: string;
  whyItMatters: string;
  eventLog: EvictionLogEvent[];
}

export class RedisEvictionEngine {
  private tickCount: number = 0;
  private policy: EvictionPolicy = 'allkeys-lru';
  private maxmemoryBytes: number = 1000; // Simulated RAM limit in bytes
  private keys: Map<string, EvictionKeyItem> = new Map();
  private eventLog: EvictionLogEvent[] = [];

  private evictedKeysCount: number = 0;
  private expiredKeysCount: number = 0;
  private rejectedWritesCount: number = 0;
  private opsCount: number = 0;

  private whatJustHappened: string = 'Redis eviction engine initialized with allkeys-lru.';
  private whyItMatters: string = 'RAM limited hoti hai; memory bharne par policy tay karti hai ki purani keys hatengi ya naye writes fail honge.';

  constructor(policy: EvictionPolicy = 'allkeys-lru', maxmemoryBytes: number = 1000) {
    this.policy = policy;
    this.maxmemoryBytes = maxmemoryBytes;
    this.seedInitialKeys();
  }

  private seedInitialKeys(): void {
    // Seed initial keys that fit comfortably within configured maxmemory limit
    const initialCandidates = [
      { key: 'sess:auth_u101', size: 180, ttl: 60 },
      { key: 'sess:auth_u102', size: 180, ttl: 45 },
      { key: 'cache:catalog_v1', size: 250, ttl: undefined },
      { key: 'views:post_42', size: 120, ttl: undefined },
    ];

    let current = 0;
    for (const c of initialCandidates) {
      if (current + c.size <= this.maxmemoryBytes * 0.75) {
        this.addKeyDirect(c.key, c.size, c.ttl);
        current += c.size;
      }
    }

    this.whatJustHappened = 'Initial state: Sessions (with TTL) aur cache keys RAM me loaded.';
    this.whyItMatters = 'Sessions par sliding TTL lagana zaroori hai taaki inactive users ki RAM naturally free ho sake.';
  }

  public clear(): void {
    this.keys.clear();
    this.eventLog = [];
    this.tickCount = 0;
    this.evictedKeysCount = 0;
    this.expiredKeysCount = 0;
    this.rejectedWritesCount = 0;
    this.opsCount = 0;
  }

  private addKeyDirect(key: string, sizeBytes: number, ttlSeconds?: number): boolean {
    const expiresAt = ttlSeconds !== undefined ? this.tickCount + ttlSeconds : undefined;
    this.keys.set(key, {
      key,
      sizeBytes,
      createdTick: this.tickCount,
      lastAccessedTick: this.tickCount,
      accessCount: 1,
      ttlSeconds,
      expiresAtTick: expiresAt,
    });
    return true;
  }

  public getSnapshot(): EvictionSnapshot {
    const usedBytes = this.calculateUsedMemory();
    const percent = Math.min(100, Math.round((usedBytes / this.maxmemoryBytes) * 100));

    // Sort keys by lastAccessedTick DESC for easy visualization
    const keyList = Array.from(this.keys.values()).map((k) => ({ ...k }));

    return {
      tick: this.tickCount,
      policy: this.policy,
      maxmemoryBytes: this.maxmemoryBytes,
      usedMemoryBytes: usedBytes,
      memoryUsagePercent: percent,
      keys: keyList,
      stats: {
        evictedKeysCount: this.evictedKeysCount,
        expiredKeysCount: this.expiredKeysCount,
        rejectedWritesCount: this.rejectedWritesCount,
        totalOpsCount: this.opsCount,
      },
      whatJustHappened: this.whatJustHappened,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog].slice(0, 100),
    };
  }

  public calculateUsedMemory(): number {
    let sum = 0;
    for (const item of this.keys.values()) {
      sum += item.sizeBytes;
    }
    return sum;
  }

  private pushLog(action: string, detail: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.opsCount++;
    this.eventLog.unshift({
      id: `evt-${this.tickCount}-${Math.random().toString(36).slice(2, 7)}`,
      tick: this.tickCount,
      action,
      detail,
      type,
    });
  }

  /**
   * Performs eviction if used memory + required bytes exceeds maxmemory
   */
  private ensureMemoryAvailable(requiredBytes: number): boolean {
    let currentUsed = this.calculateUsedMemory();
    if (currentUsed + requiredBytes <= this.maxmemoryBytes) {
      return true;
    }

    if (this.policy === 'noeviction') {
      this.rejectedWritesCount++;
      this.pushLog(
        'WRITE REJECTED (OOM)',
        `maxmemory ${this.maxmemoryBytes}B reached. 'noeviction' policy writes ko reject karti hai`,
        'error'
      );
      this.whatJustHappened = `Memory full (${currentUsed}B / ${this.maxmemoryBytes}B)! 'noeviction' ne write reject kiya.`;
      this.whyItMatters = 'Session stores aur BullMQ queues me noeviction use karte hain taaki data silently udd na jaye.';
      return false;
    }

    // Eviction loop
    while (currentUsed + requiredBytes > this.maxmemoryBytes && this.keys.size > 0) {
      const victim = this.findEvictionVictim();
      if (!victim) {
        // No candidate found (e.g. volatile-* policy but no keys with TTL exist)
        this.rejectedWritesCount++;
        this.pushLog(
          'EVICTION FAILED (OOM)',
          `Policy '${this.policy}' ke under koi eligible key nahi mili. Write rejected!`,
          'error'
        );
        this.whatJustHappened = `Eviction fail ho gayi! '${this.policy}' ko koi volatile key nahi mili.`;
        this.whyItMatters = 'volatile-lru me agar persistent keys memory bhar dein to wo evict nahi ho sakti, OOM error aata hai.';
        return false;
      }

      this.keys.delete(victim.key);
      this.evictedKeysCount++;
      currentUsed -= victim.sizeBytes;

      this.pushLog(
        `EVICTED (${this.policy})`,
        `Key '${victim.key}' (${victim.sizeBytes}B) removed to free memory`,
        'info'
      );
      this.whatJustHappened = `Memory limit breach! Key "${victim.key}" ko '${this.policy}' ke hisaab se evict kiya.`;
      this.whyItMatters = 'Pure cache me LRU/LFU purani keys silently evict karta hai bina app ko break kiye.';
    }

    return true;
  }

  private findEvictionVictim(): EvictionKeyItem | null {
    const all = Array.from(this.keys.values());
    if (all.length === 0) return null;

    switch (this.policy) {
      case 'allkeys-lru': {
        // Least recently used among all keys
        return all.reduce((min, cur) => (cur.lastAccessedTick < min.lastAccessedTick ? cur : min), all[0]);
      }

      case 'allkeys-lfu': {
        // Least frequently used among all keys
        return all.reduce((min, cur) => (cur.accessCount < min.accessCount ? cur : min), all[0]);
      }

      case 'volatile-lru': {
        // LRU only among keys with TTL
        const volatiles = all.filter((k) => k.expiresAtTick !== undefined);
        if (volatiles.length === 0) return null;
        return volatiles.reduce((min, cur) => (cur.lastAccessedTick < min.lastAccessedTick ? cur : min), volatiles[0]);
      }

      case 'volatile-lfu': {
        // LFU only among keys with TTL
        const volatiles = all.filter((k) => k.expiresAtTick !== undefined);
        if (volatiles.length === 0) return null;
        return volatiles.reduce((min, cur) => (cur.accessCount < min.accessCount ? cur : min), volatiles[0]);
      }

      case 'volatile-ttl': {
        // Shortest remaining TTL
        const volatiles = all.filter((k) => k.expiresAtTick !== undefined);
        if (volatiles.length === 0) return null;
        return volatiles.reduce((min, cur) => (cur.expiresAtTick! < min.expiresAtTick! ? cur : min), volatiles[0]);
      }

      default:
        return null;
    }
  }

  /**
   * Action: Add key with optional TTL
   */
  public addKey(key: string, sizeBytes: number = 180, ttlSeconds?: number): boolean {
    this.tickCount++;
    this.performLazyAndActiveExpiration();

    const existing = this.keys.get(key);
    const deltaBytes = existing ? sizeBytes - existing.sizeBytes : sizeBytes;

    if (!this.ensureMemoryAvailable(deltaBytes)) {
      return false;
    }

    const expiresAt = ttlSeconds !== undefined ? this.tickCount + ttlSeconds : undefined;
    this.keys.set(key, {
      key,
      sizeBytes,
      createdTick: this.tickCount,
      lastAccessedTick: this.tickCount,
      accessCount: (existing?.accessCount ?? 0) + 1,
      ttlSeconds,
      expiresAtTick: expiresAt,
    });

    const ttlText = ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ' (Permanent)';
    this.pushLog(`ADD KEY '${key}'`, `${sizeBytes}B allocated${ttlText}`);
    this.whatJustHappened = `Nayi key "${key}" (${sizeBytes} B) memory me store hui${ttlText}.`;
    this.whyItMatters = 'Har key RAM leti hai; bounded memory me TTL lagana leak prevention ka first defense hai.';
    return true;
  }

  /**
   * Action: Access key (updates LRU timestamp & LFU counter)
   */
  public accessKey(key: string): boolean {
    this.tickCount++;
    const item = this.keys.get(key);
    if (!item) {
      this.pushLog(`ACCESS '${key}'`, '(nil) - Key not found', 'info');
      this.whatJustHappened = `Key "${key}" access ki koshish ki par key memory me nahi mili.`;
      this.whyItMatters = 'Cache miss par application backend DB se data fetch karti hai.';
      return false;
    }

    // Lazy expiration check
    if (item.expiresAtTick !== undefined && this.tickCount >= item.expiresAtTick) {
      this.keys.delete(key);
      this.expiredKeysCount++;
      this.pushLog(`LAZY EXPIRED '${key}'`, `TTL expired at tick ${item.expiresAtTick}. Deleted on read!`, 'info');
      this.whatJustHappened = `Key "${key}" ka TTL expire ho chuka tha; read request aate hi lazy delete ho gayi.`;
      this.whyItMatters = 'Redis lazy expiry read time par hoti hai — CPU time waste kiye bina memory free hoti hai.';
      return false;
    }

    item.lastAccessedTick = this.tickCount;
    item.accessCount++;
    this.pushLog(`ACCESS '${key}'`, `Hits: ${item.accessCount}, LastAccessed updated to tick ${this.tickCount}`);
    this.whatJustHappened = `Key "${key}" access hui (LRU updated, Hits: ${item.accessCount}).`;
    this.whyItMatters = 'Recent aur frequent access se key LRU/LFU eviction list me end par chali jaati hai (safe rehti hai).';
    return true;
  }

  /**
   * Action: Advance virtual time / tick
   */
  public advanceTime(seconds: number = 10): void {
    this.tickCount += seconds;
    const expiredCount = this.performLazyAndActiveExpiration();
    this.pushLog(`TIME ADVANCED +${seconds}s`, `Current tick: ${this.tickCount}. ${expiredCount} expired keys cleaned.`);
    this.whatJustHappened = `Time ${seconds}s aage badha. Active expiration ne ${expiredCount} expired keys delete kiye.`;
    this.whyItMatters = 'Redis active expiry periodically random keys sample karke background me saaf karti rehti hai.';
  }

  private performLazyAndActiveExpiration(): number {
    let count = 0;
    for (const [key, item] of this.keys.entries()) {
      if (item.expiresAtTick !== undefined && this.tickCount >= item.expiresAtTick) {
        this.keys.delete(key);
        count++;
        this.expiredKeysCount++;
      }
    }
    return count;
  }

  /**
   * Action: Change eviction policy
   */
  public setPolicy(newPolicy: EvictionPolicy): void {
    const old = this.policy;
    this.policy = newPolicy;
    this.pushLog(`CONFIG SET maxmemory-policy`, `${old} → ${newPolicy}`);
    this.whatJustHappened = `Eviction policy badal kar '${newPolicy}' set kar di gayi.`;
    this.whyItMatters =
      newPolicy === 'noeviction'
        ? 'noeviction mode me memory full par writes fail honge, koi key delete nahi hogi (Sessions/Queues safe).'
        : `'${newPolicy}' mode me memory full par automatic pruning chalu ho jayegi.`;
  }

  /**
   * Action: Fill memory to limit (convenience to simulate pressure)
   */
  public fillMemoryToLimit(): void {
    let index = 1;
    while (this.calculateUsedMemory() < this.maxmemoryBytes && index <= 5) {
      const keyName = `bulk:temp_${index}_${Math.random().toString(36).slice(2, 5)}`;
      const success = this.addKey(keyName, 180, index % 2 === 0 ? 30 : undefined);
      if (!success) break;
      index++;
    }
    this.whatJustHappened = 'Memory limit tak naye bulk keys write kiye gaye taaki eviction trigger ho.';
    this.whyItMatters = 'Production me sudden traffic spike par yahi memory pressure banta hai.';
  }

  public reset(): void {
    this.keys.clear();
    this.eventLog = [];
    this.tickCount = 0;
    this.evictedKeysCount = 0;
    this.expiredKeysCount = 0;
    this.rejectedWritesCount = 0;
    this.opsCount = 0;
    this.seedInitialKeys();
  }
}
