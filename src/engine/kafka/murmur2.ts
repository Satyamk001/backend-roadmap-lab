/**
 * Java Kafka client compatible Murmur2 partitioner algorithm.
 * Kafka calculates: (murmur2(keyBytes) & 0x7fffffff) % partitionCount
 */

export function murmur2(str: string): number {
  const d = new TextEncoder().encode(str);
  const m = 0x5bd1e995;
  const r = 24;
  const len = d.length;
  let h = (0x9747b28c ^ len) | 0;
  const n4 = len >> 2;

  for (let i = 0; i < n4; i++) {
    const j = i * 4;
    let k =
      (d[j] & 255) |
      ((d[j + 1] & 255) << 8) |
      ((d[j + 2] & 255) << 16) |
      ((d[j + 3] & 255) << 24);
    k = Math.imul(k, m);
    k ^= k >>> r;
    k = Math.imul(k, m);
    h = Math.imul(h, m);
    h ^= k;
  }

  const t = len & ~3;
  const rem = len % 4;
  if (rem === 3) {
    h ^= (d[t + 2] & 255) << 16;
  }
  if (rem >= 2) {
    h ^= (d[t + 1] & 255) << 8;
  }
  if (rem >= 1) {
    h ^= d[t] & 255;
    h = Math.imul(h, m);
  }

  h ^= h >>> 13;
  h = Math.imul(h, m);
  h ^= h >>> 15;
  return h | 0;
}

export function partitionForKey(key: string | null, numPartitions: number, fallbackRoundRobinIndex: number = 0): {
  partition: number;
  hash: number | null;
  positiveHash: number | null;
} {
  if (key === null) {
    return {
      partition: fallbackRoundRobinIndex % numPartitions,
      hash: null,
      positiveHash: null,
    };
  }
  const hash = murmur2(key);
  const positiveHash = hash & 0x7fffffff;
  return {
    partition: positiveHash % numPartitions,
    hash,
    positiveHash,
  };
}
