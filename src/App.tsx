import { useState } from 'react';
import { AppProvider, useAppContext } from './context';
import { SetupScreen } from './components/SetupScreen';
import { Dashboard } from './components/Dashboard';
import { ClaimList } from './components/ClaimList';
import { ClaimDetail } from './components/ClaimDetail';
import { CreateClaimForm } from './components/CreateClaimForm';
import { clearStorage } from './store';

type View = 'home' | 'claim';

function MainApp() {
  const { state } = useAppContext();
  const [view, setView] = useState<View>('home');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (!state) {
    return <SetupScreen />;
  }

  function handleSelectClaim(id: string) {
    setSelectedClaimId(id);
    setView('claim');
  }

  function handleBack() {
    setView('home');
    setSelectedClaimId(null);
  }

  function handleReset() {
    if (window.confirm('Reset all data and start over?')) {
      clearStorage();
      window.location.reload();
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <button className="logo-btn" onClick={handleBack} type="button">
          <span className="logo-text">PPES</span>
          <span className="logo-sub">Pure Perpetual Epistemic Staking</span>
        </button>
        <div className="header-right">
          <span className="user-balance">
            <span className="balance-label">Balance</span>
            <span className="balance-num">{state.user.balance.toFixed(4)}</span>
          </span>
          <span className="user-name">{state.user.name}</span>
          <button className="reset-btn" onClick={handleReset} title="Reset all data" type="button">
            ↺
          </button>
        </div>
      </header>

      <main className="app-main">
        {view === 'home' && (
          <div className="home-layout">
            <aside className="home-sidebar">
              <Dashboard onSelectClaim={handleSelectClaim} />
            </aside>
            <section className="home-content">
              <div className="claims-header">
                <h2 className="page-title">Claims</h2>
                <button
                  className="btn-primary new-claim-btn"
                  onClick={() => setShowCreate(true)}
                  type="button"
                >
                  + New Claim
                </button>
              </div>
              <ClaimList
                claims={state.claims}
                onSelectClaim={handleSelectClaim}
              />
            </section>
          </div>
        )}

        {view === 'claim' && selectedClaimId && (
          <ClaimDetail claimId={selectedClaimId} onBack={handleBack} />
        )}
      </main>

      {showCreate && (
        <CreateClaimForm
          onCreated={(id) => {
            setShowCreate(false);
            handleSelectClaim(id);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
