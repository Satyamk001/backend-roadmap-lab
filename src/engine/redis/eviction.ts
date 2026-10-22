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
  /** Key this event refers to, used by the UI to highlight the affected card. */
  key?: string;
}

export interface EvictionSnapshot {
  tick: number;
  policy: EvictionPolicy;
  maxmemoryBytes: number;
  usedMemoryBytes: number;
  memoryUsagePercent: number;
  evictionCandidateKey: string | null;
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
    const victim = this.policy === 'noeviction' ? null : this.findEvictionVictim();

    return {
      tick: this.tickCount,
      policy: this.policy,
      maxmemoryBytes: this.maxmemoryBytes,
      usedMemoryBytes: usedBytes,
      memoryUsagePercent: percent,
      evictionCandidateKey: victim ? victim.key : null,
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

  private pushLog(
    action: string,
    detail: string,
    type: 'success' | 'error' | 'info' = 'success',
    key?: string
  ): void {
    this.opsCount++;
    this.eventLog.unshift({
      id: `evt-${this.tickCount}-${this.eventLog.length}`,
      tick: this.tickCount,
      action,
      detail,
      type,
      key,
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
      const projected = currentUsed + requiredBytes;
      this.pushLog(
        'WRITE REJECTED (OOM)',
        `Naya write ${requiredBytes}B ka hai: ${currentUsed}B + ${requiredBytes}B = ${projected}B > ${this.maxmemoryBytes}B limit. 'noeviction' policy ne reject kiya.`,
        'error'
      );
      this.whatJustHappened = `Write reject: ${currentUsed}B + ${requiredBytes}B = ${projected}B, limit ${this.maxmemoryBytes}B. 'noeviction' ne naya key accept nahi kiya.`;
      this.whyItMatters =
        "'noeviction' purana data silently evict karne ke bajaye naya write reject karta hai — data loss se bachne ke liye.";
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
        'info',
        victim.key
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
    this.pushLog(`ADD KEY '${key}'`, `${sizeBytes}B allocated${ttlText}`, 'success', key);
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
      this.pushLog(`ACCESS '${key}'`, '(nil) - Key not found', 'info', key);
      this.whatJustHappened = `Key "${key}" access ki koshish ki par key memory me nahi mili.`;
      this.whyItMatters = 'Cache miss par application backend DB se data fetch karti hai.';
      return false;
    }

    // Lazy expiration check
    if (item.expiresAtTick !== undefined && this.tickCount >= item.expiresAtTick) {
      this.keys.delete(key);
      this.expiredKeysCount++;
      this.pushLog(`LAZY EXPIRED '${key}'`, `TTL expired at tick ${item.expiresAtTick}. Deleted on read!`, 'info', key);
      this.whatJustHappened = `Key "${key}" ka TTL expire ho chuka tha; read request aate hi lazy delete ho gayi.`;
      this.whyItMatters = 'Redis lazy expiry read time par hoti hai — CPU time waste kiye bina memory free hoti hai.';
      return false;
    }

    item.lastAccessedTick = this.tickCount;
    item.accessCount++;
    this.pushLog(`ACCESS '${key}'`, `Hits: ${item.accessCount}, LastAccessed updated to tick ${this.tickCount}`, 'success', key);
    this.whatJustHappened = `Key "${key}" access hui (LRU updated, Hits: ${item.accessCount}).`;
    this.whyItMatters = 'Recent aur frequent access se key LRU/LFU eviction list me end par chali jaati hai (safe rehti hai).';
    return true;
  }

  /**
   * Action: Advance virtual time / tick
   */
  public advanceTime(seconds: number = 10): void {
    this.tickCount += seconds;
    const expired = this.expireDueKeys();

    for (const item of expired) {
      this.pushLog(
        `TTL EXPIRED '${item.key}'`,
        `TTL ${item.ttlSeconds}s khatam at tick ${item.expiresAtTick}; key memory se hat gayi.`,
        'info',
        item.key
      );
    }

    this.pushLog(
      `TIME ADVANCED +${seconds}s`,
      `Current tick: ${this.tickCount}. ${expired.length} expired keys cleaned.`
    );
    this.whatJustHappened =
      expired.length > 0
        ? `Time ${seconds}s aage badha aur ${expired.length} TTL key expire hui: ${expired
            .map((item) => item.key)
            .join(', ')}.`
        : `Time ${seconds}s aage badha; koi TTL key expire nahi hui.`;
    this.whyItMatters =
      'TTL expiry time-based hai: key ka waqt khatam hua, isliye woh gayi. Memory full hone ki zarurat nahi.';
  }

  private performLazyAndActiveExpiration(): number {
    return this.expireDueKeys().length;
  }

  private expireDueKeys(): EvictionKeyItem[] {
    const expired: EvictionKeyItem[] = [];
    for (const [key, item] of this.keys.entries()) {
      if (item.expiresAtTick !== undefined && this.tickCount >= item.expiresAtTick) {
        this.keys.delete(key);
        this.expiredKeysCount++;
        expired.push(item);
      }
    }
    return expired;
  }

  /** Lets a focused demo set a scenario-specific explanation. */
  public setNarrative(whatJustHappened: string, whyItMatters: string): void {
    this.whatJustHappened = whatJustHappened;
    this.whyItMatters = whyItMatters;
  }

  /**
   * Loads a clean, deterministic scenario. Used by focused demos so the first
   * screen is explainable and does not depend on constructor seeding.
   */
  public loadScenario(
    items: Array<{ key: string; sizeBytes: number; ttlSeconds?: number }>,
    narrative?: { whatJustHappened: string; whyItMatters: string }
  ): void {
    this.clear();
    for (const item of items) {
      this.addKeyDirect(item.key, item.sizeBytes, item.ttlSeconds);
    }
    this.whatJustHappened =
      narrative?.whatJustHappened ??
      `${items.length} keys memory me load hui. Ab TTL ya memory pressure trigger karo.`;
    this.whyItMatters =
      narrative?.whyItMatters ??
      'TTL time se key hatati hai; eviction memory full hone par policy se key chunti hai.';
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
      const keyName = `bulk:temp_${index}`;
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
