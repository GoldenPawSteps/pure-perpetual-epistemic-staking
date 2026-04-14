export function formatAmountInput(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }

  return value.toString();
}