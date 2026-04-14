import type { AppState, AppAction, Claim, Position, PricePoint, Transaction, TradeType } from './types';
import { priceYes, priceNo, costToBuyYes, costToBuyNo } from './math';
import { createInitialState } from './initialState';

function generateId(): string {
  return crypto.randomUUID();
}

function getOrCreatePosition(positions: Position[], claimId: string): Position {
  const existing = positions.find(p => p.claimId === claimId);
  if (existing) return existing;
  return { claimId, yesShares: 0, noShares: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.state ?? state;

    case 'SET_USERNAME': {
      return {
        ...state,
        user: { ...state.user, name: action.name },
      };
    }

    case 'CREATE_CLAIM': {
      const { id, title, description } = action;
      if (!title.trim()) return state;

      const newClaim: Claim = {
        id,
        title: title.trim(),
        description: description.trim(),
        creatorId: state.user.id,
        createdAt: Date.now(),
        yesStake: 0,
        noStake: 0,
      };

      const tx: Transaction = {
        id: generateId(),
        userId: state.user.id,
        claimId: newClaim.id,
        type: 'CREATE_CLAIM',
        shares: 0,
        cost: 0,
        timestamp: Date.now(),
        yesStakeAfter: 0,
        noStakeAfter: 0,
        balanceAfter: state.user.balance,
      };

      const initialPricePoint: PricePoint = {
        timestamp: newClaim.createdAt,
        yesPrice: 0.5,
        noPrice: 0.5,
      };

      return {
        ...state,
        claims: [...state.claims, newClaim],
        transactions: [...state.transactions, tx],
        priceHistory: {
          ...state.priceHistory,
          [newClaim.id]: [initialPricePoint],
        },
      };
    }

    case 'TRADE': {
      const { claimId, tradeType, shares } = action;
      if (shares <= 0) return state;

      const claim = state.claims.find(c => c.id === claimId);
      if (!claim) return state;

      const position = getOrCreatePosition(state.positions, claimId);
      const { yesStake: y, noStake: n } = claim;

      let tradeCost: number;
      let newY = y;
      let newN = n;
      let newYesShares = position.yesShares;
      let newNoShares = position.noShares;

      switch (tradeType) {
        case 'BUY_YES': {
          tradeCost = costToBuyYes(y, n, shares);
          if (tradeCost > state.user.balance + 1e-12) return state; // insufficient funds
          tradeCost = clamp(tradeCost, 0, state.user.balance);
          newY = y + shares;
          newYesShares = position.yesShares + shares;
          break;
        }
        case 'BUY_NO': {
          tradeCost = costToBuyNo(y, n, shares);
          if (tradeCost > state.user.balance + 1e-12) return state;
          tradeCost = clamp(tradeCost, 0, state.user.balance);
          newN = n + shares;
          newNoShares = position.noShares + shares;
          break;
        }
        case 'SELL_YES': {
          const maxSell = position.yesShares;
          const actualShares = Math.min(shares, maxSell);
          if (actualShares <= 0) return state;
          // Selling: receive the cost difference (positive receipt)
          tradeCost = costToBuyYes(y, n, -actualShares); // negative cost = receive
          newY = Math.max(0, y - actualShares);
          newYesShares = Math.max(0, position.yesShares - actualShares);
          // Use actualShares for the transaction record
          return applyTrade(state, claimId, tradeType, actualShares, tradeCost, newY, newN, newYesShares, position.noShares);
        }
        case 'SELL_NO': {
          const maxSell = position.noShares;
          const actualShares = Math.min(shares, maxSell);
          if (actualShares <= 0) return state;
          tradeCost = costToBuyNo(y, n, -actualShares);
          newN = Math.max(0, n - actualShares);
          newNoShares = Math.max(0, position.noShares - actualShares);
          return applyTrade(state, claimId, tradeType, actualShares, tradeCost, newY, newN, position.yesShares, newNoShares);
        }
        default:
          return state;
      }

      return applyTrade(state, claimId, tradeType, shares, tradeCost, newY, newN, newYesShares, newNoShares);
    }

    default:
      return state;
  }
}

function applyTrade(
  state: AppState,
  claimId: string,
  tradeType: TradeType,
  shares: number,
  tradeCost: number,
  newY: number,
  newN: number,
  newYesShares: number,
  newNoShares: number,
): AppState {
  const newBalance = state.user.balance - tradeCost;
  const timestamp = Date.now();

  const tx: Transaction = {
    id: generateId(),
    userId: state.user.id,
    claimId,
    type: tradeType,
    shares,
    cost: tradeCost,
    timestamp,
    yesStakeAfter: newY,
    noStakeAfter: newN,
    balanceAfter: newBalance,
  };

  const updatedClaims = state.claims.map(c =>
    c.id === claimId ? { ...c, yesStake: newY, noStake: newN } : c
  );

  const existingPositions = state.positions.filter(p => p.claimId !== claimId);
  const newPosition: Position = { claimId, yesShares: newYesShares, noShares: newNoShares };
  const updatedPositions = [...existingPositions, newPosition];

  const pricePoint: PricePoint = {
    timestamp,
    yesPrice: priceYes(newY, newN),
    noPrice: priceNo(newY, newN),
  };
  const existingHistory = state.priceHistory[claimId] ?? [];
  const updatedHistory = {
    ...state.priceHistory,
    [claimId]: [...existingHistory, pricePoint],
  };

  return {
    ...state,
    user: { ...state.user, balance: newBalance },
    claims: updatedClaims,
    transactions: [...state.transactions, tx],
    positions: updatedPositions,
    priceHistory: updatedHistory,
  };
}

export { createInitialState };
