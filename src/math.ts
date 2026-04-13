/**
 * Core math utilities for the Pure Perpetual Epistemic Staking system.
 *
 * Cost function: C(y, n) = log2(2^y + 2^n) - 1
 *
 * Numerical stability: we use the log-sum-exp identity
 *   log2(2^y + 2^n) = max(y, n) + log2(1 + 2^(min - max))
 * This avoids overflow because (min - max) <= 0, so 2^(min-max) <= 1.
 */

/**
 * Stable computation of log2(2^a + 2^b).
 */
function logSumExp2(a: number, b: number): number {
  if (!isFinite(a) || !isFinite(b)) return Math.max(a, b);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  // hi + log2(1 + 2^(lo - hi))
  return hi + Math.log2(1 + Math.pow(2, lo - hi));
}

/**
 * Cost function C(y, n) = log2(2^y + 2^n) - 1
 */
export function cost(y: number, n: number): number {
  return logSumExp2(y, n) - 1;
}

/**
 * Marginal price of YES: P_YES = 2^y / (2^y + 2^n) = 1 / (1 + 2^(n - y))
 */
export function priceYes(y: number, n: number): number {
  // Stable: avoid 2^large numbers.
  // IEEE-754 double overflows at 2^1024; beyond ±1023 the result saturates to 0 or 1.
  const diff = n - y; // if diff is very negative, P_YES -> 1; if very positive, P_YES -> 0
  if (diff > 1023) return 0;
  if (diff < -1023) return 1;
  return 1 / (1 + Math.pow(2, diff));
}

/**
 * Marginal price of NO: P_NO = 2^n / (2^y + 2^n) = 1 / (1 + 2^(y - n))
 */
export function priceNo(y: number, n: number): number {
  const diff = y - n;
  if (diff > 1023) return 0;
  if (diff < -1023) return 1;
  return 1 / (1 + Math.pow(2, diff));
}

/**
 * Cost to buy deltaY additional YES shares (deltaY > 0 = buy, < 0 = sell).
 * Returns the change in cost (positive = you pay, negative = you receive).
 */
export function costToBuyYes(y: number, n: number, deltaY: number): number {
  return cost(y + deltaY, n) - cost(y, n);
}

/**
 * Cost to buy deltaN additional NO shares (deltaN > 0 = buy, < 0 = sell).
 */
export function costToBuyNo(y: number, n: number, deltaN: number): number {
  return cost(y, n + deltaN) - cost(y, n);
}

/**
 * Given a budget (how much the user wants to spend), compute the maximum
 * deltaY of YES shares they can buy using binary search.
 */
export function maxYesForBudget(y: number, n: number, budget: number): number {
  if (budget <= 0) return 0;
  // Binary search: find deltaY such that costToBuyYes(y, n, deltaY) == budget
  // C(y + deltaY, n) - C(y, n) = budget
  // C(y + deltaY, n) = C(y, n) + budget
  const target = cost(y, n) + budget;
  let lo = 0;
  let hi = budget * 2 + 1; // upper bound: can't buy more units than budget at price 1
  // Ensure hi is big enough
  while (cost(y + hi, n) < target) hi *= 2;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (cost(y + mid, n) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Given a budget, compute the maximum deltaN of NO shares they can buy.
 */
export function maxNoForBudget(y: number, n: number, budget: number): number {
  if (budget <= 0) return 0;
  const target = cost(y, n) + budget;
  let lo = 0;
  let hi = budget * 2 + 1;
  while (cost(y, n + hi) < target) hi *= 2;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (cost(y, n + mid) < target) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
