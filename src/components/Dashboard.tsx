import { useAppContext } from '../context';
import { priceYes, priceNo } from '../math';

interface Props {
  onSelectClaim: (id: string) => void;
}

export function Dashboard({ onSelectClaim }: Props) {
  const { state } = useAppContext();
  if (!state) return null;

  const { user, positions, claims } = state;

  const activePositions = positions.filter(
    p => p.yesShares > 0 || p.noShares > 0
  );

  return (
    <div className="dashboard">
      <div className="balance-card">
        <div className="card-balance-label">Your Balance</div>
        <div className="balance-value">{user.balance.toFixed(6)}</div>
        <div className="balance-unit">units</div>
      </div>

      <div className="portfolio-section">
        <h3 className="section-title">Portfolio</h3>
        {activePositions.length === 0 ? (
          <p className="muted-text">No positions yet. Stake on a claim below.</p>
        ) : (
          <div className="portfolio-list">
            {activePositions.map(pos => {
              const claim = claims.find(c => c.id === pos.claimId);
              if (!claim) return null;
              const pYes = priceYes(claim.yesStake, claim.noStake);
              const pNo = priceNo(claim.yesStake, claim.noStake);
              const valueYes = pos.yesShares * pYes;
              const valueNo = pos.noShares * pNo;
              const totalValue = valueYes + valueNo;

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
