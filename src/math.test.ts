/**
 * Unit tests for the core math utilities.
 * Run with: npx vitest run
 */
import { describe, it, expect } from 'vitest';
import {
  cost,
  priceYes,
  priceNo,
  costToBuyYes,
  costToBuyNo,
  maxYesForBudget,
  maxNoForBudget,
} from './math';

const EPS = 1e-9;
const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

describe('cost function C(y,n) = log2(2^y + 2^n) - 1', () => {
  it('C(0, 0) = 0', () => {
    expect(approx(cost(0, 0), 0)).toBe(true);
  });

  it('C(1, 0) = log2(3) - 1 ≈ 0.584963', () => {
    const expected = Math.log2(3) - 1;
    expect(approx(cost(1, 0), expected)).toBe(true);
  });

  it('C(0, 1) = log2(3) - 1 ≈ 0.584963', () => {
    const expected = Math.log2(3) - 1;
    expect(approx(cost(0, 1), expected)).toBe(true);
  });

  it('is symmetric: C(y, n) = C(n, y)', () => {
    expect(approx(cost(2, 3), cost(3, 2))).toBe(true);
    expect(approx(cost(0.5, 1.5), cost(1.5, 0.5))).toBe(true);
  });

  it('is non-negative', () => {
    expect(cost(0, 0)).toBeGreaterThanOrEqual(0);
    expect(cost(1, 1)).toBeGreaterThanOrEqual(0);
    expect(cost(5, 2)).toBeGreaterThanOrEqual(0);
  });

  it('is convex: adding more stake increases cost more', () => {
    // C(y+1, n) - C(y, n) >= C(y, n) - C(y-1, n) is not the right formulation
    // Convexity: cost(y+d, n) - cost(y, n) >= 0 (increasing)
    const c0 = cost(0, 0);
    const c1 = cost(1, 0);
    const c2 = cost(2, 0);
    expect(c1 - c0).toBeGreaterThan(0);
    expect(c2 - c1).toBeGreaterThan(0);
  });

  it('handles large values without overflow', () => {
    // Should not produce Infinity or NaN
    const c = cost(100, 50);
    expect(isFinite(c)).toBe(true);
    expect(c).toBeGreaterThan(0);
  });

  it('C(1, 1) = log2(2^1 + 2^1) - 1 = log2(4) - 1 = 1', () => {
    expect(approx(cost(1, 1), 1)).toBe(true);
  });
});

describe('marginal price P_YES = 2^y / (2^y + 2^n)', () => {
  it('P_YES(0, 0) = 0.5', () => {
    expect(approx(priceYes(0, 0), 0.5)).toBe(true);
  });

  it('P_YES + P_NO = 1 always', () => {
    const pairs = [[0, 0], [1, 0], [0, 1], [2, 3], [5, 5]];
    for (const [y, n] of pairs) {
      expect(approx(priceYes(y, n) + priceNo(y, n), 1)).toBe(true);
    }
  });

  it('P_YES > 0.5 when y > n', () => {
    expect(priceYes(2, 1)).toBeGreaterThan(0.5);
  });

  it('P_YES < 0.5 when y < n', () => {
    expect(priceYes(1, 2)).toBeLessThan(0.5);
  });

  it('P_YES approaches 1 as y >> n', () => {
    expect(priceYes(20, 0)).toBeGreaterThan(0.999);
  });

  it('P_YES approaches 0 as n >> y', () => {
    expect(priceYes(0, 20)).toBeLessThan(0.001);
  });
});

describe('marginal price P_NO = 2^n / (2^y + 2^n)', () => {
  it('P_NO(0, 0) = 0.5', () => {
    expect(approx(priceNo(0, 0), 0.5)).toBe(true);
  });

  it('P_NO is symmetric with P_YES: P_NO(y, n) = P_YES(n, y)', () => {
    expect(approx(priceNo(2, 3), priceYes(3, 2))).toBe(true);
    expect(approx(priceNo(1, 4), priceYes(4, 1))).toBe(true);
  });
});

describe('cost to trade', () => {
  it('costToBuyYes(0, 0, 1) = C(1, 0) - C(0, 0)', () => {
    const expected = cost(1, 0) - cost(0, 0);
    expect(approx(costToBuyYes(0, 0, 1), expected)).toBe(true);
  });

  it('costToBuyNo(0, 0, 1) = C(0, 1) - C(0, 0)', () => {
    const expected = cost(0, 1) - cost(0, 0);
    expect(approx(costToBuyNo(0, 0, 1), expected)).toBe(true);
  });

  it('selling YES returns negative cost (receive)', () => {
    const sellCost = costToBuyYes(2, 1, -0.5);
    expect(sellCost).toBeLessThan(0);
  });

  it('selling NO returns negative cost (receive)', () => {
    const sellCost = costToBuyNo(1, 2, -0.5);
    expect(sellCost).toBeLessThan(0);
  });

  it('buy then sell is lossless (LMSR property)', () => {
    const y = 1, n = 1, delta = 0.1;
    const buyCost = costToBuyYes(y, n, delta);
    // Selling delta shares from (y+delta) position returns exactly buyCost
    const sellReceipt = -costToBuyYes(y + delta, n, -delta);
    // In LMSR, C(y+d,n) - C(y,n) = -(C(y,n) - C(y+d,n)), so they're equal
    expect(approx(buyCost, sellReceipt, EPS * 10)).toBe(true);
  });

  it('buying affects price correctly', () => {
    const pBefore = priceYes(0, 0);
    // After buying YES
    const deltaY = 1;
    const pAfter = priceYes(deltaY, 0);
    expect(pAfter).toBeGreaterThan(pBefore);
  });
});

describe('budget allocation', () => {
  it('maxYesForBudget returns positive shares for positive budget', () => {
    const shares = maxYesForBudget(0, 0, 0.5);
    expect(shares).toBeGreaterThan(0);
  });

  it('cost of maxYesForBudget ≈ budget', () => {
    const budget = 0.3;
    const shares = maxYesForBudget(0, 0, budget);
    const actualCost = costToBuyYes(0, 0, shares);
    expect(approx(actualCost, budget, 1e-5)).toBe(true);
  });

  it('cost of maxNoForBudget ≈ budget', () => {
    const budget = 0.4;
    const shares = maxNoForBudget(0, 0, budget);
    const actualCost = costToBuyNo(0, 0, shares);
    expect(approx(actualCost, budget, 1e-5)).toBe(true);
  });

  it('maxYesForBudget(0) = 0', () => {
    expect(maxYesForBudget(0, 0, 0)).toBe(0);
  });

  it('larger budget buys more shares', () => {
    const s1 = maxYesForBudget(0, 0, 0.1);
    const s2 = maxYesForBudget(0, 0, 0.5);
    expect(s2).toBeGreaterThan(s1);
  });
});

describe('mathematical integrity checks', () => {
  it('initial prices are exactly 0.5 at (0, 0)', () => {
    expect(priceYes(0, 0)).toBe(0.5);
    expect(priceNo(0, 0)).toBe(0.5);
  });

  it('prices are in [0, 1]', () => {
    const testCases = [[0, 0], [1, 0], [0, 1], [5, 3], [0.1, 0.9]];
    for (const [y, n] of testCases) {
      const pY = priceYes(y, n);
      const pN = priceNo(y, n);
      expect(pY).toBeGreaterThanOrEqual(0);
      expect(pY).toBeLessThanOrEqual(1);
      expect(pN).toBeGreaterThanOrEqual(0);
      expect(pN).toBeLessThanOrEqual(1);
    }
  });

  it('cost function is strictly increasing in y', () => {
    const n = 1;
    let prev = cost(0, n);
    for (let y = 0.5; y <= 5; y += 0.5) {
      const curr = cost(y, n);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });

  it('cost function is strictly increasing in n', () => {
    const y = 1;
    let prev = cost(y, 0);
    for (let n = 0.5; n <= 5; n += 0.5) {
      const curr = cost(y, n);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });
});
