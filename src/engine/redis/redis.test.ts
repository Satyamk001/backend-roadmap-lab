import { describe, it, expect, beforeEach } from 'vitest';
import { RedisStructuresEngine } from './structures';
import { RedisEvictionEngine } from './eviction';
import { RedisPersistenceEngine } from './persistence';

describe('Redis In-Memory Structures Engine', () => {
  let engine: RedisStructuresEngine;

  beforeEach(() => {
    engine = new RedisStructuresEngine();
    engine.reset();
  });

  it('sets and atomically increments string counters', () => {
    engine.set('counter:test', '100');
    const snap = engine.getSnapshot();
    expect(snap.entries['counter:test']).toBeDefined();
    expect((snap.entries['counter:test'].value as any).raw).toBe('100');
    expect(snap.entries['counter:test'].encoding).toBe('int');

    const incremented = engine.incr('counter:test', 5);
    expect(incremented).toBe(105);
    const snap2 = engine.getSnapshot();
    expect((snap2.entries['counter:test'].value as any).raw).toBe('105');
  });

  it('respects SET NX flag (only set if key does not exist)', () => {
    engine.set('lock:job42', 'worker1');
    const duplicateSet = engine.set('lock:job42', 'worker2', { nx: true });
    expect(duplicateSet).toBe(false);

    const snap = engine.getSnapshot();
    expect((snap.entries['lock:job42'].value as any).raw).toBe('worker1');
  });

  it('handles Hashes for sessions with field-level mutations', () => {
    engine.hset('sess:user_99', 'userId', 'u99');
    engine.hset('sess:user_99', 'role', 'editor');
    const snap = engine.getSnapshot();
    const hash = snap.entries['sess:user_99'].value as any;
    expect(hash.type).toBe('hash');
    expect(hash.fields['userId']).toBe('u99');
    expect(hash.fields['role']).toBe('editor');

    engine.hincrby('sess:user_99', 'visits', 1);
    const snap2 = engine.getSnapshot();
    expect((snap2.entries['sess:user_99'].value as any).fields['visits']).toBe('1');
  });

  it('handles Lists with LPUSH, RPOP, and LTRIM capping', () => {
    const listKey = 'feed:test';
    engine.del(listKey);
    engine.lpush(listKey, 'msg1');
    engine.lpush(listKey, 'msg2');
    engine.lpush(listKey, 'msg3');

    let snap = engine.getSnapshot();
    expect((snap.entries[listKey].value as any).items).toEqual(['msg3', 'msg2', 'msg1']);

    engine.ltrim(listKey, 0, 1); // keep top 2
    snap = engine.getSnapshot();
    expect((snap.entries[listKey].value as any).items).toEqual(['msg3', 'msg2']);

    const popped = engine.rpop(listKey);
    expect(popped).toBe('msg2');
  });

  it('handles Sets with automatic deduplication', () => {
    const setKey = 'tags:books';
    engine.sadd(setKey, 'node', 'redis', 'node'); // 'node' is duplicate
    const snap = engine.getSnapshot();
    const members = (snap.entries[setKey].value as any).members;
    expect(members.length).toBe(2);
    expect(members).toContain('node');
    expect(members).toContain('redis');
  });

  it('handles Sorted Sets (ZSET) with score ordering and atomic ZINCRBY', () => {
    const zKey = 'lb:test';
    engine.del(zKey);
    engine.zadd(zKey, 50, 'player1');
    engine.zadd(zKey, 80, 'player2');
    engine.zadd(zKey, 30, 'player3');

    let snap = engine.getSnapshot();
    let sorted = (snap.entries[zKey].value as any).sorted;
    // Ascending: player3 (30), player1 (50), player2 (80)
    expect(sorted[0].member).toBe('player3');
    expect(sorted[2].member).toBe('player2');

    // Atomic increment
    engine.zincrby(zKey, 60, 'player3'); // 30 + 60 = 90 (now leader!)
    snap = engine.getSnapshot();
    sorted = (snap.entries[zKey].value as any).sorted;
    expect(sorted[2].member).toBe('player3');
    expect(sorted[2].score).toBe(90);
  });
});

describe('Redis Eviction & TTL Engine', () => {
  it('performs active and lazy expiration when TTL passes', () => {
    const engine = new RedisEvictionEngine('allkeys-lru', 1000);
    engine.reset();
    engine.addKey('otp:secret', 100, 10); // 10s TTL

    let snap = engine.getSnapshot();
    expect(snap.keys.find((k) => k.key === 'otp:secret')).toBeDefined();

    // Advance 15s
    engine.advanceTime(15);
    snap = engine.getSnapshot();
    expect(snap.keys.find((k) => k.key === 'otp:secret')).toBeUndefined();
    expect(snap.stats.expiredKeysCount).toBeGreaterThan(0);
  });

  it('enforces noeviction policy by rejecting writes when memory is full', () => {
    const engine = new RedisEvictionEngine('noeviction', 500);
    engine.clear();
    // Fill to limit
    engine.addKey('k1', 250);
    engine.addKey('k2', 200);

    // This write would exceed 500B
    const allowed = engine.addKey('k3', 100);
    expect(allowed).toBe(false);

    const snap = engine.getSnapshot();
    expect(snap.stats.rejectedWritesCount).toBe(1);
    expect(snap.keys.find((k) => k.key === 'k1')).toBeDefined();
    expect(snap.keys.find((k) => k.key === 'k2')).toBeDefined();
  });

  it('evicts least recently used key under allkeys-lru policy', () => {
    const engine = new RedisEvictionEngine('allkeys-lru', 500);
    engine.clear();
    engine.addKey('old_key', 200);
    engine.addKey('recent_key', 200);

    // Access recent_key to refresh its LRU timestamp
    engine.accessKey('recent_key');

    // Add key that requires eviction
    engine.addKey('new_key', 200);

    const snap = engine.getSnapshot();
    // old_key should have been evicted!
    expect(snap.keys.find((k) => k.key === 'old_key')).toBeUndefined();
    expect(snap.keys.find((k) => k.key === 'recent_key')).toBeDefined();
    expect(snap.keys.find((k) => k.key === 'new_key')).toBeDefined();
    expect(snap.stats.evictedKeysCount).toBe(1);
  });
});

describe('Redis Persistence Engine (RDB & AOF)', () => {
  it('writes commands into RAM and AOF buffer', () => {
    const engine = new RedisPersistenceEngine();
    engine.reset();
    engine.write('SET', 'order:1001', 'pending');

    const snap = engine.getSnapshot();
    expect(snap.ramKeys['order:1001']).toBe('pending');
    expect(snap.aofBuffer.some((e) => e.key === 'order:1001')).toBe(true);
  });

  it('creates point-in-time snapshot with BGSAVE', () => {
    const engine = new RedisPersistenceEngine();
    engine.reset();
    engine.write('SET', 'player:x', '45');
    engine.triggerBgsave();

    const snap = engine.getSnapshot();
    expect(snap.rdbSnapshot).not.toBeNull();
    expect(snap.rdbSnapshot?.data['player:x']).toBe('45');
  });

  it('flushes AOF buffer and compacts with BGREWRITEAOF', () => {
    const engine = new RedisPersistenceEngine();
    engine.reset();
    engine.write('SET', 'views', '1');
    engine.write('SET', 'views', '2');
    engine.write('SET', 'views', '3');

    engine.flushAofBuffer();
    let snap = engine.getSnapshot();
    expect(snap.aofDiskFile.length).toBeGreaterThan(0);

    engine.triggerAofRewrite();
    snap = engine.getSnapshot();
    expect(snap.aofBaseSnapshot).toBeDefined();
    expect(snap.aofBaseSnapshot?.['views']).toBe('3');
  });

  it('survives crash and recovers from AOF log', () => {
    const engine = new RedisPersistenceEngine();
    engine.reset();
    engine.write('SET', 'important:data', 'survive');
    engine.flushAofBuffer(); // flushed to disk!

    // Crash the server
    engine.crashServer();
    let snap = engine.getSnapshot();
    expect(snap.serverStatus).toBe('crashed');
    expect(Object.keys(snap.ramKeys).length).toBe(0);

    // Restart server
    engine.restartServer();
    snap = engine.getSnapshot();
    expect(snap.serverStatus).toBe('running');
    expect(snap.ramKeys['important:data']).toBe('survive');
  });
});
