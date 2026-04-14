import { useState } from 'react';
import { useAppContext } from '../context';
import { priceYes, priceNo } from '../math';

interface Props {
  onSelectClaim: (id: string) => void;
}

type PortfolioSort = 'value-desc' | 'newest-action' | 'oldest-action' | 'title-asc';

export function Dashboard({ onSelectClaim }: Props) {
  const { state } = useAppContext();
  const [portfolioSort, setPortfolioSort] = useState<PortfolioSort>('value-desc');
  if (!state) return null;

  const { user, positions, claims, transactions } = state;

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
    </div>
  );
}
