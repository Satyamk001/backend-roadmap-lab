/**
 * Redis In-Memory Data Structures Engine
 * Deterministic simulation of Redis core data structures:
 * Strings, Hashes, Lists, Sets, and Sorted Sets (ZSET).
 * Follows Redis 7 specifications for encodings, complexities, and memory footprint.
 */

export type RedisType = 'string' | 'hash' | 'list' | 'set' | 'zset';

export type RedisEncoding =
  | 'int'
  | 'embstr'
  | 'raw'
  | 'listpack'
  | 'hashtable'
  | 'quicklist'
  | 'intset'
  | 'skiplist';

export interface StringValue {
  type: 'string';
  raw: string;
}

export interface HashValue {
  type: 'hash';
  fields: Record<string, string>;
}

export interface ListValue {
  type: 'list';
  items: string[];
}

export interface SetValue {
  type: 'set';
  members: string[];
}

export interface ZSetMember {
  member: string;
  score: number;
}

export interface ZSetValue {
  type: 'zset';
  byMember: Record<string, number>;
  sorted: ZSetMember[]; // kept sorted by score ASC (ties: lexicographical)
}

export type RedisValue = StringValue | HashValue | ListValue | SetValue | ZSetValue;

export interface RedisEntry {
  key: string;
  value: RedisValue;
  encoding: RedisEncoding;
  bytes: number;
  lastUpdatedTick: number;
  ttlSeconds?: number;
}

export interface RedisLogEvent {
  id: string;
  tick: number;
  command: string;
  result: string;
  impact: string;
  type: 'success' | 'error' | 'info';
}

export interface StructuresSnapshot {
  tick: number;
  entries: Record<string, RedisEntry>;
  stats: {
    totalKeys: number;
    usedMemoryBytes: number;
    opsCount: number;
    typeDistribution: Record<RedisType, number>;
  };
  lastCommand?: string;
  whatJustHappened: string;
  whyItMatters: string;
  eventLog: RedisLogEvent[];
}

/**
 * Helper to compute internal Redis encoding and approximate memory footprint
 */
export function inspectEncodingAndMemory(key: string, value: RedisValue): { encoding: RedisEncoding; bytes: number } {
  // Redis object header: 16 bytes + dictEntry overhead ~24 bytes + key string memory
  const baseOverhead = 40 + key.length + 8;

  switch (value.type) {
    case 'string': {
      const isInteger = /^-?\d+$/.test(value.raw) && Number(value.raw) >= -9223372036854775808n && Number(value.raw) <= 9223372036854775807n;
      if (isInteger) {
        return { encoding: 'int', bytes: baseOverhead + 8 };
      }
      if (value.raw.length <= 44) {
        return { encoding: 'embstr', bytes: baseOverhead + value.raw.length + 3 };
      }
      return { encoding: 'raw', bytes: baseOverhead + value.raw.length + 9 };
    }

    case 'hash': {
      const fieldCount = Object.keys(value.fields).length;
      let totalFieldBytes = 0;
      let maxFieldLen = 0;
      for (const [f, v] of Object.entries(value.fields)) {
        totalFieldBytes += f.length + v.length;
        maxFieldLen = Math.max(maxFieldLen, f.length, v.length);
      }
      // Redis 7 listpack threshold: <= 128 entries and max field length <= 64
      if (fieldCount <= 128 && maxFieldLen <= 64) {
        return { encoding: 'listpack', bytes: baseOverhead + totalFieldBytes + 16 };
      }
      return { encoding: 'hashtable', bytes: baseOverhead + totalFieldBytes + (fieldCount * 32) };
    }

    case 'list': {
      const totalBytes = value.items.reduce((acc, item) => acc + item.length, 0);
      return { encoding: 'quicklist', bytes: baseOverhead + totalBytes + (value.items.length * 12) + 32 };
    }

    case 'set': {
      const allInts = value.members.length > 0 && value.members.every((m) => /^-?\d+$/.test(m));
      const totalBytes = value.members.reduce((acc, m) => acc + m.length, 0);
      if (allInts && value.members.length <= 512) {
        return { encoding: 'intset', bytes: baseOverhead + (value.members.length * 8) + 8 };
      }
      if (value.members.length <= 128) {
        return { encoding: 'listpack', bytes: baseOverhead + totalBytes + 16 };
      }
      return { encoding: 'hashtable', bytes: baseOverhead + totalBytes + (value.members.length * 28) };
    }

    case 'zset': {
      const totalBytes = value.sorted.reduce((acc, m) => acc + m.member.length + 8, 0);
      if (value.sorted.length <= 128) {
        return { encoding: 'listpack', bytes: baseOverhead + totalBytes + 16 };
      }
      // skiplist + hashtable dual representation
      return { encoding: 'skiplist', bytes: baseOverhead + totalBytes + (value.sorted.length * 48) };
    }
  }
}

export class RedisStructuresEngine {
  private tick: number = 0;
  private entries: Map<string, RedisEntry> = new Map();
  private eventLog: RedisLogEvent[] = [];
  private opsCount: number = 0;
  private whatJustHappened: string = 'Pehla Redis command chalao aur RAM allocation dekho.';
  private whyItMatters: string = 'Redis RAM me direct memory layouts use karta hai taaki sub-millisecond execution mile.';

  constructor() {
    this.seedDefaultState();
  }

  private seedDefaultState(): void {
    // Seed initial realistic structures from Day 22 running examples
    this.set('views:home', '10');
    this.hset('sess:alice_9a2f', 'userId', 'u101');
    this.hset('sess:alice_9a2f', 'role', 'admin');
    this.lpush('feed:u101', 'Login successful');
    this.sadd('dau:today', 'u101');
    this.zadd('lb:global', 120, 'alice');
    this.zadd('lb:global', 95, 'bob');
    this.whatJustHappened = 'Initial state loaded: String counter, Hash session, List feed, Set DAU, aur ZSet leaderboard.';
    this.whyItMatters = 'Har practical use-case ke liye ready-made structure milta hai, custom serialization ki zarurat nahi.';
  }

  public getSnapshot(): StructuresSnapshot {
    const entriesObj: Record<string, RedisEntry> = {};
    let totalBytes = 0;
    const typeDist: Record<RedisType, number> = {
      string: 0,
      hash: 0,
      list: 0,
      set: 0,
      zset: 0,
    };

    for (const [key, entry] of this.entries.entries()) {
      entriesObj[key] = {
        ...entry,
        value: JSON.parse(JSON.stringify(entry.value)),
      };
      totalBytes += entry.bytes;
      typeDist[entry.value.type]++;
    }

    return {
      tick: this.tick,
      entries: entriesObj,
      stats: {
        totalKeys: this.entries.size,
        usedMemoryBytes: totalBytes,
        opsCount: this.opsCount,
        typeDistribution: typeDist,
      },
      whatJustHappened: this.whatJustHappened,
      whyItMatters: this.whyItMatters,
      eventLog: [...this.eventLog].slice(0, 100),
    };
  }

  private pushLog(command: string, result: string, impact: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.tick++;
    this.opsCount++;
    this.eventLog.unshift({
      id: `evt-${this.tick}-${Math.random().toString(36).slice(2, 7)}`,
      tick: this.tick,
      command,
      result,
      impact,
      type,
    });
  }

  // --- STRING COMMANDS ---
  public set(key: string, value: string, options?: { ex?: number; nx?: boolean; xx?: boolean }): boolean {
    const exists = this.entries.has(key);
    if (options?.nx && exists) {
      this.pushLog(`SET ${key} "${value}" NX`, '(nil)', 'Key pehle se exist karti hai, NX guard ne write reject kiya', 'info');
      this.whatJustHappened = `SET NX ne key "${key}" ko overwrite hone se bacha liya (nil returned).`;
      this.whyItMatters = 'Distributed locks aur deduplication flags isi atomic NX check se bante hain.';
      return false;
    }

    if (options?.xx && !exists) {
      this.pushLog(`SET ${key} "${value}" XX`, '(nil)', 'Key exist nahi karti, XX write skip hua', 'info');
      this.whatJustHappened = `Key "${key}" exist nahi karti thi, isliye XX write nahi hua.`;
      this.whyItMatters = 'XX flag sirf existing cached keys ko update karne ke liye use hota hai.';
      return false;
    }

    const strVal: StringValue = { type: 'string', raw: value };
    const { encoding, bytes } = inspectEncodingAndMemory(key, strVal);
    this.entries.set(key, {
      key,
      value: strVal,
      encoding,
      bytes,
      lastUpdatedTick: this.tick,
      ttlSeconds: options?.ex,
    });

    const exText = options?.ex ? ` EX ${options.ex}` : '';
    this.pushLog(`SET ${key} "${value}"${exText}`, 'OK', `String key allocated with encoding '${encoding}' (${bytes} B)`);
    this.whatJustHappened = `Key "${key}" set ho gayi: value "${value}" (${encoding} encoding).`;
    this.whyItMatters = 'String binary-safe hai (numbers, JSON, raw bytes sab support karta hai).';
    return true;
  }

  public incr(key: string, by: number = 1): number | null {
    const existing = this.entries.get(key);
    let currentNum = 0;

    if (existing) {
      if (existing.value.type !== 'string') {
        this.pushLog(`INCRBY ${key} ${by}`, 'ERR WrongType', 'Key holds a non-string value', 'error');
        this.whatJustHappened = `Error: Key "${key}" ka type string nahi hai!`;
        this.whyItMatters = 'Redis command type-strict hai; wrong type par WRONGTYPE error aata hai.';
        return null;
      }
      const parsed = Number(existing.value.raw);
      if (isNaN(parsed)) {
        this.pushLog(`INCRBY ${key} ${by}`, 'ERR NotAnInteger', 'Value is not an integer string', 'error');
        this.whatJustHappened = `Error: "${existing.value.raw}" integer me convert nahi ho sakta.`;
        this.whyItMatters = 'INCR sirf parseable integer strings par atomic arithmetic karta hai.';
        return null;
      }
      currentNum = parsed;
    }

    const nextNum = currentNum + by;
    const strVal: StringValue = { type: 'string', raw: String(nextNum) };
    const { encoding, bytes } = inspectEncodingAndMemory(key, strVal);
    this.entries.set(key, {
      key,
      value: strVal,
      encoding,
      bytes,
      lastUpdatedTick: this.tick,
      ttlSeconds: existing?.ttlSeconds,
    });

    this.pushLog(`INCRBY ${key} ${by}`, `(integer) ${nextNum}`, `Counter atomically updated from ${currentNum} to ${nextNum}`);
    this.whatJustHappened = `Key "${key}" atomically increment hui: ${currentNum} → ${nextNum}.`;
    this.whyItMatters = 'Redis single-thread execution se race conditions nahi aati; GET + SET ki jagah INCR atomic hai.';
    return nextNum;
  }

  // --- HASH COMMANDS ---
  public hset(key: string, field: string, value: string): number {
    const existing = this.entries.get(key);
    let hashVal: HashValue;
    let isNewField = 1;

    if (existing) {
      if (existing.value.type !== 'hash') {
        this.pushLog(`HSET ${key} ${field} "${value}"`, 'ERR WrongType', 'Key is not a Hash', 'error');
        this.whatJustHappened = `Error: Key "${key}" Hash nahi hai.`;
        this.whyItMatters = 'Session data ke liye Hash use hota hai taaki individual fields update ho sakein.';
        return 0;
      }
      hashVal = existing.value;
      if (hashVal.fields[field] !== undefined) isNewField = 0;
      hashVal.fields[field] = value;
    } else {
      hashVal = { type: 'hash', fields: { [field]: value } };
    }

    const { encoding, bytes } = inspectEncodingAndMemory(key, hashVal);
    this.entries.set(key, {
      key,
      value: hashVal,
      encoding,
      bytes,
      lastUpdatedTick: this.tick,
    });

    this.pushLog(`HSET ${key} ${field} "${value}"`, `(integer) ${isNewField}`, `Field '${field}' updated. Hash encoding: '${encoding}'`);
    this.whatJustHappened = `Hash "${key}" me field "${field}" = "${value}" set ho gaya.`;
    this.whyItMatters = 'Hash me sirf badli hui field rewrite hoti hai, poora JSON string parse/stringify nahi karna padta.';
    return isNewField;
  }

  public hincrby(key: string, field: string, by: number = 1): number | null {
    const existing = this.entries.get(key);
    if (!existing || existing.value.type !== 'hash') {
      return this.hset(key, field, String(by));
    }
    const current = Number(existing.value.fields[field] ?? '0');
    if (isNaN(current)) {
      this.pushLog(`HINCRBY ${key} ${field} ${by}`, 'ERR NotAnInteger', 'Field is not an integer', 'error');
      return null;
    }
    const nextVal = current + by;
    existing.value.fields[field] = String(nextVal);
    const { encoding, bytes } = inspectEncodingAndMemory(key, existing.value);
    existing.encoding = encoding;
    existing.bytes = bytes;
    existing.lastUpdatedTick = this.tick;

    this.pushLog(`HINCRBY ${key} ${field} ${by}`, `(integer) ${nextVal}`, `Field counter updated to ${nextVal}`);
    this.whatJustHappened = `Hash "${key}" field "${field}" increment hokar ${nextVal} ban gaya.`;
    this.whyItMatters = 'Session visits ya item counts ko bina pure object ko fetch kiye in-place update karo.';
    return nextVal;
  }

  // --- LIST COMMANDS ---
  public lpush(key: string, value: string): number {
    const existing = this.entries.get(key);
    let listVal: ListValue;

    if (existing) {
      if (existing.value.type !== 'list') {
        this.pushLog(`LPUSH ${key} "${value}"`, 'ERR WrongType', 'Key is not a List', 'error');
        return 0;
      }
      listVal = existing.value;
      listVal.items.unshift(value);
    } else {
      listVal = { type: 'list', items: [value] };
    }

    const { encoding, bytes } = inspectEncodingAndMemory(key, listVal);
    this.entries.set(key, {
      key,
      value: listVal,
      encoding,
      bytes,
      lastUpdatedTick: this.tick,
    });

    this.pushLog(`LPUSH ${key} "${value}"`, `(integer) ${listVal.items.length}`, `Pushed to head. Length: ${listVal.items.length}`);
    this.whatJustHappened = `List "${key}" ke head par item "${value}" push kiya (Total: ${listVal.items.length}).`;
    this.whyItMatters = 'List dono ends se O(1) hai (deque) — recent activities aur simple buffers ke liye best.';
    return listVal.items.length;
  }

  public rpop(key: string): string | null {
    const existing = this.entries.get(key);
    if (!existing || existing.value.type !== 'list' || existing.value.items.length === 0) {
      this.pushLog(`RPOP ${key}`, '(nil)', 'List is empty or does not exist', 'info');
      this.whatJustHappened = `RPOP: List "${key}" khaali hai ya nahi mili.`;
      this.whyItMatters = 'Empty list par RPOP safe (nil) return karta hai bina error diye.';
      return null;
    }

    const popped = existing.value.items.pop()!;
    if (existing.value.items.length === 0) {
      this.entries.delete(key);
      this.pushLog(`RPOP ${key}`, `"${popped}"`, 'Last item popped, key automatically deleted');
      this.whatJustHappened = `List "${key}" se "${popped}" nikal gaya; list khaali hone par key auto-delete hui.`;
    } else {
      const { encoding, bytes } = inspectEncodingAndMemory(key, existing.value);
      existing.encoding = encoding;
      existing.bytes = bytes;
      existing.lastUpdatedTick = this.tick;
      this.pushLog(`RPOP ${key}`, `"${popped}"`, `Item removed from tail. Remaining: ${existing.value.items.length}`);
      this.whatJustHappened = `List "${key}" ke tail se "${popped}" nikala (FIFO consumer).`;
    }
    this.whyItMatters = 'LPUSH + RPOP se standard FIFO queue banti hai.';
    return popped;
  }

  public ltrim(key: string, start: number, stop: number): boolean {
    const existing = this.entries.get(key);
    if (!existing || existing.value.type !== 'list') return false;

    const items = existing.value.items;
    const initialLen = items.length;
    const normalizedStop = stop < 0 ? items.length + stop : stop;
    existing.value.items = items.slice(start, normalizedStop + 1);

    const { encoding, bytes } = inspectEncodingAndMemory(key, existing.value);
    existing.encoding = encoding;
    existing.bytes = bytes;
    existing.lastUpdatedTick = this.tick;

    this.pushLog(`LTRIM ${key} ${start} ${stop}`, 'OK', `Capped list from ${initialLen} to ${existing.value.items.length} items`);
    this.whatJustHappened = `LTRIM ne list "${key}" ko trim karke sirf latest ${existing.value.items.length} items rakhe.`;
    this.whyItMatters = 'LPUSH + LTRIM se list unbounded nahi badhti, memory leak rukta hai.';
    return true;
  }

  // --- SET COMMANDS ---
  public sadd(key: string, ...members: string[]): number {
    const existing = this.entries.get(key);
    let setVal: SetValue;
    let addedCount = 0;

    if (existing) {
      if (existing.value.type !== 'set') {
        this.pushLog(`SADD ${key}`, 'ERR WrongType', 'Key is not a Set', 'error');
        return 0;
      }
      setVal = existing.value;
      const set = new Set(setVal.members);
      for (const m of members) {
        if (!set.has(m)) {
          set.add(m);
          addedCount++;
        }
      }
      setVal.members = Array.from(set);
    } else {
      const set = new Set(members);
      setVal = { type: 'set', members: Array.from(set) };
      addedCount = setVal.members.length;
    }

    const { encoding, bytes } = inspectEncodingAndMemory(key, setVal);
    this.entries.set(key, {
      key,
      value: setVal,
      encoding,
      bytes,
      lastUpdatedTick: this.tick,
    });

    this.pushLog(`SADD ${key} ${members.join(' ')}`, `(integer) ${addedCount}`, `Added ${addedCount} unique members. Encoding: '${encoding}'`);
    this.whatJustHappened = `Set "${key}" me ${addedCount} naye unique members add hue (${members.length - addedCount} duplicates ignore).`;
    this.whyItMatters = 'Set me duplicates automatically drop ho jaate hain aur membership O(1) me check hoti hai.';
    return addedCount;
  }

  public srem(key: string, member: string): number {
    const existing = this.entries.get(key);
    if (!existing || existing.value.type !== 'set') return 0;

    const initialLen = existing.value.members.length;
    existing.value.members = existing.value.members.filter((m) => m !== member);
    const removed = initialLen !== existing.value.members.length ? 1 : 0;

    if (existing.value.members.length === 0) {
      this.entries.delete(key);
      this.pushLog(`SREM ${key} ${member}`, `(integer) ${removed}`, 'Set emptied and removed');
    } else {
      const { encoding, bytes } = inspectEncodingAndMemory(key, existing.value);
      existing.encoding = encoding;
      existing.bytes = bytes;
      this.pushLog(`SREM ${key} ${member}`, `(integer) ${removed}`, `Member '${member}' removed from set`);
    }

    this.whatJustHappened = removed ? `Set "${key}" se member "${member}" remove kiya.` : `Member "${member}" set me nahi tha.`;
    this.whyItMatters = 'User ke active sessions list me se specific session logout karte waqt SREM use hota hai.';
    return removed;
  }

  // --- SORTED SET (ZSET) COMMANDS ---
  public zadd(key: string, score: number, member: string): number {
    const existing = this.entries.get(key);
    let zval: ZSetValue;
    let isNew = 1;

    if (existing) {
      if (existing.value.type !== 'zset') {
        this.pushLog(`ZADD ${key} ${score} ${member}`, 'ERR WrongType', 'Key is not a ZSet', 'error');
        return 0;
      }
      zval = existing.value;
      if (zval.byMember[member] !== undefined) isNew = 0;
      zval.byMember[member] = score;
      // Re-sort
      const list: ZSetMember[] = Object.entries(zval.byMember).map(([m, s]) => ({ member: m, score: s }));
      list.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.member.localeCompare(b.member)));
      zval.sorted = list;
    } else {
      zval = {
        type: 'zset',
        byMember: { [member]: score },
        sorted: [{ member, score }],
      };
    }

    const { encoding, bytes } = inspectEncodingAndMemory(key, zval);
    this.entries.set(key, {
      key,
      value: zval,
      encoding,
      bytes,
      lastUpdatedTick: this.tick,
    });

    this.pushLog(`ZADD ${key} ${score} ${member}`, `(integer) ${isNew}`, `Member '${member}' updated with score ${score}. Encoding: '${encoding}'`);
    this.whatJustHappened = `ZSet "${key}" me member "${member}" score=${score} ke saath insert/update hua.`;
    this.whyItMatters = 'Sorted Set hamesha ordered rehta hai (Skiplist + Hashtable); top-N range queries O(log N + M) me ho jaati hain.';
    return isNew;
  }

  public zincrby(key: string, increment: number, member: string): number {
    const existing = this.entries.get(key);
    let currentScore = 0;
    if (existing && existing.value.type === 'zset' && existing.value.byMember[member] !== undefined) {
      currentScore = existing.value.byMember[member];
    }
    const newScore = currentScore + increment;
    this.zadd(key, newScore, member);

    this.pushLog(`ZINCRBY ${key} ${increment} ${member}`, `"${newScore}"`, `Score atomically changed from ${currentScore} to ${newScore}`);
    this.whatJustHappened = `Leaderboard "${key}": "${member}" ka score +${increment} hokar ${newScore} ho gaya!`;
    this.whyItMatters = 'Game events par `ZINCRBY` atomic call hoti hai — DB sorting ya heavy locking ki zarurat nahi hoti.';
    return newScore;
  }

  public del(key: string): number {
    const existed = this.entries.delete(key);
    const res = existed ? 1 : 0;
    this.pushLog(`DEL ${key}`, `(integer) ${res}`, existed ? `Key '${key}' deleted from memory` : 'Key did not exist');
    this.whatJustHappened = existed ? `Key "${key}" delete ho gayi aur RAM free hui.` : `Key "${key}" nahi mili.`;
    this.whyItMatters = 'Chhoti keys ke liye DEL; production me lakhon elements wali big key ke liye UNLINK (async free) use hota hai.';
    return res;
  }

  public reset(): void {
    this.entries.clear();
    this.eventLog = [];
    this.tick = 0;
    this.opsCount = 0;
    this.seedDefaultState();
  }
}
