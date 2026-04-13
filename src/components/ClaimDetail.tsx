import { useAppContext } from '../context';
import type { Claim } from '../types';
import { priceYes, priceNo, cost } from '../math';
import { PriceChart } from './PriceChart';
import { TradeForm } from './TradeForm';

interface Props {
  claimId: string;
  onBack: () => void;
}

export function ClaimDetail({ claimId, onBack }: Props) {
  const { state } = useAppContext();
  if (!state) return null;

  const claim: Claim | undefined = state.claims.find(c => c.id === claimId);
  if (!claim) {
    return (
      <div className="claim-detail">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <p>Claim not found.</p>
      </div>
    );
  }

  const y = claim.yesStake;
  const n = claim.noStake;
  const pYes = priceYes(y, n);
  const pNo = priceNo(y, n);
  const currentCost = cost(y, n);
  const history = state.priceHistory[claimId] ?? [];

  const transactions = state.transactions
    .filter(tx => tx.claimId === claimId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function tradeLabel(type: string) {
    switch (type) {
      case 'BUY_YES': return 'Bought YES';
      case 'BUY_NO': return 'Bought NO';
      case 'SELL_YES': return 'Sold YES';
      case 'SELL_NO': return 'Sold NO';
      case 'CREATE_CLAIM': return 'Created';
      default: return type;
    }
  }

  return (
    <div className="claim-detail">
      <button className="back-btn" onClick={onBack} type="button">
        ← Back to claims
      </button>

      <div className="claim-detail-header">
        <h2 className="claim-detail-title">{claim.title}</h2>
        {claim.description && (
          <p className="claim-detail-desc">{claim.description}</p>
        )}
        <div className="claim-meta">
          <span className="meta-item">Created {formatDate(claim.createdAt)}</span>
          <span className="meta-item perpetual-badge">Perpetual · No resolution</span>
        </div>
      </div>

      <div className="claim-detail-body">
        <div className="claim-detail-left">
          {/* Price meters */}
          <div className="price-meters">
            <div className="price-meter yes-meter">
              <div className="meter-label">YES</div>
              <div className="meter-bar">
                <div className="meter-fill yes-fill" style={{ width: `${pYes * 100}%` }} />
              </div>
              <div className="meter-value yes-value">{(pYes * 100).toFixed(2)}%</div>
            </div>
            <div className="price-meter no-meter">
              <div className="meter-label">NO</div>
              <div className="meter-bar">
                <div className="meter-fill no-fill" style={{ width: `${pNo * 100}%` }} />
              </div>
              <div className="meter-value no-value">{(pNo * 100).toFixed(2)}%</div>
            </div>
          </div>

          {/* Market stats */}
          <div className="market-stats">
            <div className="stat-item">
              <div className="stat-label">YES stake</div>
              <div className="stat-val yes-val">{y.toFixed(4)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">NO stake</div>
              <div className="stat-val no-val">{n.toFixed(4)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Cost C(y,n)</div>
              <div className="stat-val">{currentCost.toFixed(6)}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Total staked</div>
              <div className="stat-val">{(y + n).toFixed(4)}</div>
            </div>
          </div>

          {/* Price chart */}
          <div className="chart-section">
            <h4 className="section-title">Price History</h4>
            <PriceChart history={history} />
          </div>

          {/* Transaction log */}
          {transactions.length > 0 && (
            <div className="tx-log">
              <h4 className="section-title">Recent Activity</h4>
              <table className="tx-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Shares</th>
                    <th>Cost</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td className={`tx-type ${tx.type.toLowerCase().replace('_', '-')}`}>
                        {tradeLabel(tx.type)}
                      </td>
                      <td>{tx.shares > 0 ? tx.shares.toFixed(4) : '—'}</td>
                      <td className={tx.cost < 0 ? 'receive' : ''}>
                        {tx.cost < 0
                          ? `+${Math.abs(tx.cost).toFixed(4)}`
                          : tx.cost.toFixed(4)}
                      </td>
                      <td className="tx-time">{formatDate(tx.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="claim-detail-right">
          <TradeForm claim={claim} />

          <div className="math-note">
            <h4>Cost Function</h4>
            <code>C(y,n) = log₂(2ʸ + 2ⁿ) − 1</code>
            <p>
              P<sub>YES</sub> = 2<sup>y</sup> / (2<sup>y</sup> + 2<sup>n</sup>)<br />
              P<sub>NO</sub> = 2<sup>n</sup> / (2<sup>y</sup> + 2<sup>n</sup>)
            </p>
            <p className="math-explanation">
              Prices reflect collective belief strength. No oracle. No resolution.
              The system runs perpetually.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
