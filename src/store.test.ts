/**
 * Unit tests for the TRADE reducer in store.ts.
 * Covers: buy/sell round-trip, balance invariants, cannot oversell.
 */
import { describe, it, expect } from 'vitest';
import { createInitialState, reducer } from '../src/store';
import { costToBuyYes, costToBuyNo } from '../src/math';
import type { AppState } from '../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

function freshState(): AppState {
  return createInitialState('TestUser');
}

function firstClaimId(state: AppState): string {
  return state.claims[0].id;
}

// ─── BUY tests ────────────────────────────────────────────────────────────────

describe('TRADE BUY_YES', () => {
  it('deducts correct cost from balance', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const claim = state.claims[0];
    const shares = 0.1;
    const expectedCost = costToBuyYes(claim.yesStake, claim.noStake, shares);
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares });
    expect(approx(next.user.balance, state.user.balance - expectedCost)).toBe(true);
  });

  it('increases yesStake on the claim', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares });
    const updatedClaim = next.claims.find(c => c.id === claimId)!;
    expect(approx(updatedClaim.yesStake, state.claims[0].yesStake + shares)).toBe(true);
  });

  it('updates user position', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares });
    const pos = next.positions.find(p => p.claimId === claimId);
    expect(pos).toBeDefined();
    expect(approx(pos!.yesShares, shares)).toBe(true);
  });

  it('records a transaction', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares: 0.1 });
    const txs = next.transactions.filter(t => t.claimId === claimId && t.type === 'BUY_YES');
    expect(txs.length).toBe(1);
  });

  it('appends to price history', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const before = (state.priceHistory[claimId] ?? []).length;
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares: 0.1 });
    expect(next.priceHistory[claimId].length).toBe(before + 1);
  });
});

describe('TRADE BUY_NO', () => {
  it('deducts correct cost from balance', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const claim = state.claims[0];
    const shares = 0.1;
    const expectedCost = costToBuyNo(claim.yesStake, claim.noStake, shares);
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_NO', shares });
    expect(approx(next.user.balance, state.user.balance - expectedCost)).toBe(true);
  });

  it('increases noStake on the claim', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_NO', shares });
    const updatedClaim = next.claims.find(c => c.id === claimId)!;
    expect(approx(updatedClaim.noStake, state.claims[0].noStake + shares)).toBe(true);
  });
});

// ─── SELL tests ───────────────────────────────────────────────────────────────

describe('TRADE SELL_YES', () => {
  it('restores balance after buy then sell (LMSR lossless round-trip)', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;

    const afterBuy = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares });
    const afterSell = reducer(afterBuy, { type: 'TRADE', claimId, tradeType: 'SELL_YES', shares });

    // Balance should be back to original (within floating point tolerance)
    expect(approx(afterSell.user.balance, state.user.balance, 1e-9)).toBe(true);
  });

  it('decreases yesStake after selling', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;
    const afterBuy = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares });
    const afterSell = reducer(afterBuy, { type: 'TRADE', claimId, tradeType: 'SELL_YES', shares });
    const originalStake = state.claims[0].yesStake;
    const claimAfter = afterSell.claims.find(c => c.id === claimId)!;
    expect(approx(claimAfter.yesStake, originalStake, 1e-9)).toBe(true);
  });

  it('cannot sell more YES shares than held — caps at position size', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;
    const afterBuy = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares });
    // Try selling 1.0, but only 0.1 is held
    const afterSell = reducer(afterBuy, { type: 'TRADE', claimId, tradeType: 'SELL_YES', shares: 1.0 });
    const pos = afterSell.positions.find(p => p.claimId === claimId)!;
    expect(pos.yesShares).toBeGreaterThanOrEqual(0);
    // Balance should not exceed original (can't make money by overselling)
    expect(afterSell.user.balance).toBeLessThanOrEqual(state.user.balance + 1e-9);
  });

  it('returns state unchanged when no YES shares are held', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    // No prior buy — position is empty
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'SELL_YES', shares: 0.1 });
    expect(next).toBe(state); // strict identity: reducer returned same object
  });
});

describe('TRADE SELL_NO', () => {
  it('restores balance after buy then sell (LMSR lossless round-trip)', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;

    const afterBuy = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_NO', shares });
    const afterSell = reducer(afterBuy, { type: 'TRADE', claimId, tradeType: 'SELL_NO', shares });

    expect(approx(afterSell.user.balance, state.user.balance, 1e-9)).toBe(true);
  });

  it('cannot sell more NO shares than held', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const shares = 0.1;
    const afterBuy = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_NO', shares });
    const afterSell = reducer(afterBuy, { type: 'TRADE', claimId, tradeType: 'SELL_NO', shares: 1.0 });
    const pos = afterSell.positions.find(p => p.claimId === claimId)!;
    expect(pos.noShares).toBeGreaterThanOrEqual(0);
  });

  it('returns state unchanged when no NO shares are held', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'SELL_NO', shares: 0.1 });
    expect(next).toBe(state);
  });
});

// ─── Balance invariants ────────────────────────────────────────────────────────

describe('balance invariants', () => {
  it('balance is never negative after a buy', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    // Try to buy more than the user can afford
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares: 1000 });
    // Should be rejected (state unchanged) because cost > balance
    expect(next.user.balance).toBeGreaterThanOrEqual(0);
  });

  it('buying with exactly zero shares returns state unchanged', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares: 0 });
    expect(next).toBe(state);
  });

  it('buying with negative shares returns state unchanged', () => {
    const state = freshState();
    const claimId = firstClaimId(state);
    const next = reducer(state, { type: 'TRADE', claimId, tradeType: 'BUY_YES', shares: -0.1 });
    expect(next).toBe(state);
  });

  it('trade on unknown claimId returns state unchanged', () => {
    const state = freshState();
    const next = reducer(state, { type: 'TRADE', claimId: 'nonexistent', tradeType: 'BUY_YES', shares: 0.1 });
    expect(next).toBe(state);
  });
});

// ─── CREATE_CLAIM ─────────────────────────────────────────────────────────────

describe('CREATE_CLAIM', () => {
  it('adds a new claim with yesStake=0 and noStake=0', () => {
    const state = freshState();
    const id = 'test-id-123';
    const next = reducer(state, { type: 'CREATE_CLAIM', id, title: 'Test claim', description: '' });
    const claim = next.claims.find(c => c.id === id);
    expect(claim).toBeDefined();
    expect(claim!.yesStake).toBe(0);
    expect(claim!.noStake).toBe(0);
  });

  it('initialises price history with a 50/50 point', () => {
    const state = freshState();
    const id = 'test-id-456';
    const next = reducer(state, { type: 'CREATE_CLAIM', id, title: 'Test', description: '' });
    const history = next.priceHistory[id];
    expect(history).toHaveLength(1);
    expect(history[0].yesPrice).toBe(0.5);
    expect(history[0].noPrice).toBe(0.5);
  });

  it('does not change user balance', () => {
    const state = freshState();
    const next = reducer(state, { type: 'CREATE_CLAIM', id: 'x', title: 'Test', description: '' });
    expect(next.user.balance).toBe(state.user.balance);
  });

  it('ignores empty title', () => {
    const state = freshState();
    const next = reducer(state, { type: 'CREATE_CLAIM', id: 'y', title: '   ', description: '' });
    expect(next).toBe(state);
  });
});
