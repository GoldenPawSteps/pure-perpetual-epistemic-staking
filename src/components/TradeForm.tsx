import React, { useState } from 'react';
import { useAppContext } from '../context';
import type { Claim, TradeType } from '../types';
import {
  priceYes,
  priceNo,
  costToBuyYes,
  costToBuyNo,
  maxYesForBudget,
  maxNoForBudget,
} from '../math';
import { formatAmountInput } from '../number';

interface Props {
  claim: Claim;
}

type Side = 'YES' | 'NO';
type Action = 'BUY' | 'SELL';

export function TradeForm({ claim }: Props) {
  const { state, dispatch } = useAppContext();
  const [side, setSide] = useState<Side>('YES');
  const [action, setAction] = useState<Action>('BUY');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!state) return null;

  const appState = state;

  const position = appState.positions.find(p => p.claimId === claim.id);
  const yesHeld = position?.yesShares ?? 0;
  const noHeld = position?.noShares ?? 0;

  const y = claim.yesStake;
  const n = claim.noStake;
  const pYes = priceYes(y, n);
  const pNo = priceNo(y, n);

  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  function getTradePreview(): { cost: number; shares: number } | null {
    if (!isValid) return null;
    if (action === 'BUY') {
      if (side === 'YES') {
        const shares = maxYesForBudget(y, n, parsedAmount);
        return { cost: parsedAmount, shares };
      } else {
        const shares = maxNoForBudget(y, n, parsedAmount);
        return { cost: parsedAmount, shares };
      }
    } else {
      // Selling: parsedAmount = number of shares to sell
      const shares = parsedAmount;
      if (side === 'YES') {
        const c = costToBuyYes(y, n, -shares);
        return { cost: c, shares }; // c is negative (receive)
      } else {
        const c = costToBuyNo(y, n, -shares);
        return { cost: c, shares };
      }
    }
  }

  const preview = getTradePreview();

  function handleMaxClick() {
    if (action === 'BUY') {
      setAmount(formatAmountInput(appState.user.balance));
    } else {
      const maxShares = side === 'YES' ? yesHeld : noHeld;
      setAmount(formatAmountInput(maxShares));
    }
    setError('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!isValid) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (action === 'BUY') {
      const shares = side === 'YES'
        ? maxYesForBudget(y, n, parsedAmount)
        : maxNoForBudget(y, n, parsedAmount);

      if (parsedAmount > appState.user.balance + 1e-12) {
        setError('Insufficient balance.');
        return;
      }
      if (shares <= 0) {
        setError('Amount too small.');
        return;
      }

      const tradeType: TradeType = side === 'YES' ? 'BUY_YES' : 'BUY_NO';
      dispatch({ type: 'TRADE', claimId: claim.id, tradeType, shares });
    } else {
      const maxShares = side === 'YES' ? yesHeld : noHeld;
      if (parsedAmount > maxShares + 1e-12) {
        setError(`You only hold ${maxShares.toFixed(6)} ${side} shares.`);
        return;
      }
      const shares = Math.min(parsedAmount, maxShares);
      const tradeType: TradeType = side === 'YES' ? 'SELL_YES' : 'SELL_NO';
      dispatch({ type: 'TRADE', claimId: claim.id, tradeType, shares });
    }

    setAmount('');
  }

  const buyingLabel = action === 'BUY' ? 'Spend (balance units)' : 'Shares to sell';

  return (
    <div className="trade-form">
      <div className="trade-tabs">
        <button
          className={`tab-btn ${action === 'BUY' ? 'active' : ''}`}
          onClick={() => { setAction('BUY'); setAmount(''); setError(''); }}
          type="button"
        >
          Buy
        </button>
        <button
          className={`tab-btn ${action === 'SELL' ? 'active' : ''}`}
          onClick={() => { setAction('SELL'); setAmount(''); setError(''); }}
          type="button"
        >
          Sell
        </button>
      </div>

      <div className="side-selector">
        <button
          className={`side-btn yes-btn ${side === 'YES' ? 'active' : ''}`}
          onClick={() => { setSide('YES'); setAmount(''); setError(''); }}
          type="button"
        >
          YES <span className="price-tag">{(pYes * 100).toFixed(1)}%</span>
        </button>
        <button
          className={`side-btn no-btn ${side === 'NO' ? 'active' : ''}`}
          onClick={() => { setSide('NO'); setAmount(''); setError(''); }}
          type="button"
        >
          NO <span className="price-tag">{(pNo * 100).toFixed(1)}%</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="trade-inputs">
        <div className="input-row">
          <label htmlFor="amount">{buyingLabel}</label>
          <div className="input-with-max">
            <input
              id="amount"
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError(''); }}
            />
            <button type="button" className="max-btn" onClick={handleMaxClick}>
              MAX
            </button>
          </div>
        </div>

        {preview && (
          <div className="trade-preview">
            {action === 'BUY' ? (
              <>
                <div className="preview-row">
                  <span>Shares received</span>
                  <span className="preview-val">{preview.shares.toFixed(6)}</span>
                </div>
                <div className="preview-row">
                  <span>Cost</span>
                  <span className="preview-val">{preview.cost.toFixed(6)}</span>
                </div>
                <div className="preview-row">
                  <span>Avg price</span>
                  <span className="preview-val">
                    {preview.shares > 0
                      ? (preview.cost / preview.shares).toFixed(4)
                      : '—'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="preview-row">
                  <span>Shares sold</span>
                  <span className="preview-val">{preview.shares.toFixed(6)}</span>
                </div>
                <div className="preview-row">
                  <span>Receive</span>
                  <span className="preview-val receive">
                    +{Math.abs(preview.cost).toFixed(6)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {error && <div className="trade-error">{error}</div>}

        <button
          type="submit"
          className={`submit-btn ${side === 'YES' ? 'yes-submit' : 'no-submit'}`}
          disabled={!isValid}
        >
          {action} {side}
        </button>
      </form>

      {(yesHeld > 0 || noHeld > 0) && (
        <div className="holdings-summary">
          <span className="holdings-label">Your holdings:</span>
          {yesHeld > 0 && (
            <span className="holding yes">
              YES: {yesHeld.toFixed(4)}
            </span>
          )}
          {noHeld > 0 && (
            <span className="holding no">
              NO: {noHeld.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
