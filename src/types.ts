/**
 * Core data types for the Pure Perpetual Epistemic Staking system.
 */

export interface User {
  id: string;
  name: string;
  balance: number;
}

export interface Claim {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  createdAt: number;
  yesStake: number; // total YES stake (y)
  noStake: number;  // total NO stake (n)
}

export type TradeType = 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO';

export interface Transaction {
  id: string;
  userId: string;
  claimId: string;
  type: TradeType | 'CREATE_CLAIM';
  shares: number;   // absolute shares traded (always positive)
  cost: number;     // positive = user paid, negative = user received
  timestamp: number;
  yesStakeAfter: number;
  noStakeAfter: number;
  balanceAfter: number;
}

export interface Position {
  claimId: string;
  yesShares: number;
  noShares: number;
}

export interface PricePoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
}

export interface AppState {
  user: User;
  claims: Claim[];
  transactions: Transaction[];
  positions: Position[]; // user's positions across claims
  priceHistory: Record<string, PricePoint[]>; // claimId -> price history
}

export type AppAction =
  | { type: 'SET_USERNAME'; name: string }
  | { type: 'CREATE_CLAIM'; id: string; title: string; description: string }
  | { type: 'TRADE'; claimId: string; tradeType: TradeType; shares: number }
  | { type: 'LOAD_STATE'; state: AppState | null };
