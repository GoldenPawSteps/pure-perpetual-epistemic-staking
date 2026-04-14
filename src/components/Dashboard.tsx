import { useState } from 'react';
import { useAppContext } from '../context';
import { priceYes, priceNo } from '../math';
import type { TradeType } from '../types';

interface Props {
  onSelectClaim: (id: string) => void;
}

type PortfolioSort = 'value-desc' | 'newest-action' | 'oldest-action' | 'title-asc';

export function Dashboard({ onSelectClaim }: Props) {
  const { state } = useAppContext();
  const [portfolioSort, setPortfolioSort] = useState<PortfolioSort>('value-desc');
  if (!state) return null;

  const { user, positions, claims, transactions } = state;

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function tradeLabel(type: TradeType | 'CREATE_CLAIM') {
    switch (type) {
      case 'BUY_YES':    return 'Bought YES';
      case 'BUY_NO':     return 'Bought NO';
      case 'SELL_YES':   return 'Sold YES';
      case 'SELL_NO':    return 'Sold NO';
      case 'CREATE_CLAIM': return 'Created';
      default:           return type;
    }
  }

  const activePositions = positions.filter(
    p => p.yesShares > 0 || p.noShares > 0
  );

  const actionTimestampByClaim = new Map<string, number>();
  for (const tx of transactions) {
    const prev = actionTimestampByClaim.get(tx.claimId) ?? Number.NEGATIVE_INFINITY;
    if (tx.timestamp > prev) {
      actionTimestampByClaim.set(tx.claimId, tx.timestamp);
    }
  }

  const portfolioEntries = activePositions
    .map(pos => {
      const claim = claims.find(c => c.id === pos.claimId);
      if (!claim) return null;
      const pYes = priceYes(claim.yesStake, claim.noStake);
      const pNo = priceNo(claim.yesStake, claim.noStake);
      const valueYes = pos.yesShares * pYes;
      const valueNo = pos.noShares * pNo;
      const totalValue = valueYes + valueNo;
      const actionTimestamp = actionTimestampByClaim.get(pos.claimId) ?? claim.createdAt;
      return { pos, claim, totalValue, actionTimestamp };
    })
    .filter((entry): entry is { pos: typeof activePositions[number]; claim: typeof claims[number]; totalValue: number; actionTimestamp: number } => entry !== null)
    .sort((a, b) => {
      switch (portfolioSort) {
        case 'newest-action':
          return b.actionTimestamp - a.actionTimestamp;
        case 'oldest-action':
          return a.actionTimestamp - b.actionTimestamp;
        case 'title-asc':
          return a.claim.title.localeCompare(b.claim.title);
        case 'value-desc':
        default:
          return b.totalValue - a.totalValue;
      }
    });

  return (
    <div className="dashboard">
      <div className="balance-card">
        <div className="card-balance-label">Your Balance</div>
        <div className="balance-value">{user.balance.toFixed(6)}</div>
        <div className="balance-unit">units</div>
      </div>

      <div className="portfolio-section">
        <div className="portfolio-header">
          <h3 className="section-title">Portfolio</h3>
          {portfolioEntries.length > 1 && (
            <select
              className="portfolio-sort-select"
              value={portfolioSort}
              onChange={(e) => setPortfolioSort(e.target.value as PortfolioSort)}
              aria-label="Sort portfolio"
            >
              <option value="value-desc">Value (high to low)</option>
              <option value="newest-action">Newest (action)</option>
              <option value="oldest-action">Oldest (action)</option>
              <option value="title-asc">Title (A-Z)</option>
            </select>
          )}
        </div>
        {portfolioEntries.length === 0 ? (
          <p className="muted-text">No positions yet. Stake on a claim below.</p>
        ) : (
          <div className="portfolio-list">
            {portfolioEntries.map(({ pos, claim, totalValue }) => {

              return (
                <button
                  key={pos.claimId}
                  className="portfolio-item"
                  onClick={() => onSelectClaim(pos.claimId)}
                >
                  <div className="portfolio-claim-title">{claim.title}</div>
                  <div className="portfolio-details">
                    {pos.yesShares > 0 && (
                      <span className="pos-chip yes-chip">
                        YES {pos.yesShares.toFixed(4)}
                      </span>
                    )}
                    {pos.noShares > 0 && (
                      <span className="pos-chip no-chip">
                        NO {pos.noShares.toFixed(4)}
                      </span>
                    )}
                    <span className="pos-value">
                      ≈ {totalValue.toFixed(4)} units
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ActivitySection
        transactions={transactions}
        claims={claims}
        onSelectClaim={onSelectClaim}
        formatDate={formatDate}
        tradeLabel={tradeLabel}
      />
    </div>
  );
}

interface ActivityProps {
  transactions: import('../types').Transaction[];
  claims: import('../types').Claim[];
  onSelectClaim: (id: string) => void;
  formatDate: (ts: number) => string;
  tradeLabel: (type: import('../types').TradeType | 'CREATE_CLAIM') => string;
}

function ActivitySection({ transactions, claims, onSelectClaim, formatDate, tradeLabel }: ActivityProps) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
  const visible = expanded ? sorted : sorted.slice(0, 10);

  return (
    <div className="activity-section">
      <h3 className="section-title">Recent Activity</h3>
      {sorted.length === 0 ? (
        <p className="muted-text">No activity yet.</p>
      ) : (
        <>
          <div className="activity-list">
            {visible.map(tx => {
              const claim = claims.find(c => c.id === tx.claimId);
              const received = tx.cost < 0;
              return (
                <button
                  key={tx.id}
                  className="activity-item"
                  onClick={() => onSelectClaim(tx.claimId)}
                  type="button"
                >
                  <div className="activity-row activity-row-top">
                    <span className={`activity-type tx-type ${tx.type.toLowerCase().replace(/_/g, '-')}`}>
                      {tradeLabel(tx.type)}
                    </span>
                    <span className={`activity-cost${received ? ' receive' : ''}`}>
                      {received
                        ? `+${Math.abs(tx.cost).toFixed(4)}`
                        : tx.type === 'CREATE_CLAIM'
                          ? '—'
                          : `-${tx.cost.toFixed(4)}`}
                    </span>
                  </div>
                  <div className="activity-row activity-row-bottom">
                    <span className="activity-claim">{claim?.title ?? tx.claimId}</span>
                    <span className="activity-time">{formatDate(tx.timestamp)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {sorted.length > 10 && (
            <button
              className="activity-show-more"
              onClick={() => setExpanded(e => !e)}
              type="button"
            >
              {expanded ? 'Show less' : `Show all ${sorted.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
