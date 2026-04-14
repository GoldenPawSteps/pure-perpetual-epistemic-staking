import { describe, expect, it } from 'vitest';
import { formatAmountInput } from './number';

describe('formatAmountInput', () => {
  it('returns a round-trip-safe string for floating point holdings', () => {
    const holdings = 0.123456789123;
    const parsed = Number.parseFloat(formatAmountInput(holdings));

    expect(parsed).toBe(holdings);
  });

  it('does not round a holding up beyond the actual value', () => {
    const holdings = 0.123456789;
    const parsed = Number.parseFloat(formatAmountInput(holdings));

    expect(parsed).toBeLessThanOrEqual(holdings);
  });

  it('returns 0 for invalid values', () => {
    expect(formatAmountInput(Number.NaN)).toBe('0');
    expect(formatAmountInput(Infinity)).toBe('0');
    expect(formatAmountInput(0)).toBe('0');
  });
});