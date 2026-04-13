import type { Claim } from '../types';
import { priceYes, priceNo } from '../math';
import { useAppContext } from '../context';

interface Props {
  claims: Claim[];
  onSelectClaim: (id: string) => void;
}

export function ClaimList({ claims, onSelectClaim }: Props) {
  const { state } = useAppContext();

  if (claims.length === 0) {
    return (
      <div className="empty-state">
        <p>No claims yet. Create the first one!</p>
      </div>
    );
  }

  return (
    <div className="claim-list">
      {claims.map(claim => {
        const y = claim.yesStake;
        const n = claim.noStake;
        const pYes = priceYes(y, n);
        const pNo = priceNo(y, n);
        const position = state?.positions.find(p => p.claimId === claim.id);
        const hasPosition = position && (position.yesShares > 0 || position.noShares > 0);

        return (
          <button
            key={claim.id}
            className="claim-card"
            onClick={() => onSelectClaim(claim.id)}
          >
            <div className="claim-card-header">
              <span className="claim-title">{claim.title}</span>
              {hasPosition && <span className="position-badge">Staked</span>}
            </div>
            <div className="claim-card-footer">
              <div className="price-bar-wrapper">
                <div
                  className="price-bar-yes"
                  style={{ width: `${pYes * 100}%` }}
                />
                <div
                  className="price-bar-no"
                  style={{ width: `${pNo * 100}%` }}
                />
              </div>
              <div className="claim-stats">
                <span className="stat yes-stat">
                  YES {(pYes * 100).toFixed(1)}%
                </span>
                <span className="stat no-stat">
                  NO {(pNo * 100).toFixed(1)}%
                </span>
                <span className="stat stake-stat">
                  Staked: {(y + n).toFixed(2)}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
