import { useEffect, useRef, useState } from 'react';
import { AppProvider, useAppContext } from './context';
import { SetupScreen } from './components/SetupScreen';
import { Dashboard } from './components/Dashboard';
import { ClaimList } from './components/ClaimList';
import { ClaimDetail } from './components/ClaimDetail';
import { CreateClaimForm } from './components/CreateClaimForm';
import { AccountSettings } from './components/AccountSettings';

type View = 'home' | 'claim';

function MainApp() {
  const { authStatus, currentAccountId, state } = useAppContext();
  const [view, setView] = useState<View>('home');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);

  // Reset navigation state whenever the active account changes so a new
  // user never lands on the previous user's page.
  useEffect(() => {
    setView('home');
    setSelectedClaimId(null);
    setShowCreate(false);
    setShowSettings(false);
    homeScrollYRef.current = 0;
    shouldRestoreHomeScrollRef.current = false;
  }, [currentAccountId]);

  useEffect(() => {
    if (view === 'claim' && selectedClaimId) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [view, selectedClaimId]);

  useEffect(() => {
    if (view !== 'home' || !shouldRestoreHomeScrollRef.current) {
      return;
    }

    shouldRestoreHomeScrollRef.current = false;
    requestAnimationFrame(() => {
      window.scrollTo({ top: homeScrollYRef.current, left: 0, behavior: 'auto' });
    });
  }, [view]);

  if (authStatus === 'loading' || (authStatus === 'signed-in' && !state)) {
    return <SetupScreen mode="loading" />;
  }

  if (authStatus === 'signed-out') {
    return <SetupScreen />;
  }

  const currentState = state;
  if (!currentState) {
    return <SetupScreen mode="loading" />;
  }

  function handleSelectClaim(id: string) {
    if (view === 'home') {
      homeScrollYRef.current = window.scrollY;
      shouldRestoreHomeScrollRef.current = true;
    }

    setSelectedClaimId(id);
    setView('claim');
  }

  function handleBack() {
    setView('home');
    setSelectedClaimId(null);
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
            <span className="balance-num">{currentState.user.balance.toFixed(4)}</span>
          </span>
          <span className="user-name">{currentState.user.name}</span>
          <button className="header-btn" onClick={() => setShowSettings(true)} type="button">
            Account
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
                claims={currentState.claims}
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

      {showSettings && (
        <AccountSettings onClose={() => setShowSettings(false)} />
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
