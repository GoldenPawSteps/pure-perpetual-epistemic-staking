import type { AppState } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function isValidAppState(value: unknown): value is AppState {
  if (!isRecord(value)) return false;

  const user = value.user;
  if (!isRecord(user)) return false;
  if (typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.balance !== 'number') {
    return false;
  }

  if (!Array.isArray(value.claims)) return false;
  if (!Array.isArray(value.transactions)) return false;
  if (!Array.isArray(value.positions)) return false;
  if (!isRecord(value.priceHistory)) return false;

  return true;
}