import { describe, it, expect } from 'vitest';

describe('Deterministic Engine Foundations', () => {
  it('seeded PRNG generates identical sequences for identical seeds', () => {
    function mulberry32(a: number) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const prng1 = mulberry32(42);
    const prng2 = mulberry32(42);

    const seq1 = [prng1(), prng1(), prng1()];
    const seq2 = [prng2(), prng2(), prng2()];

    expect(seq1).toEqual(seq2);
  });

  it('virtual tick advances deterministically', () => {
    let tick = 0;
    const advanceTick = (delta = 1) => {
      tick += delta;
      return tick;
    };

    expect(advanceTick()).toBe(1);
    expect(advanceTick(5)).toBe(6);
  });
});
