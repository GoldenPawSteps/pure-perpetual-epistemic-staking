import { useEffect, useRef, useState } from 'react';
import { AppProvider, useAppContext } from './context';
import { cost } from './math';
import { SetupScreen } from './components/SetupScreen';
import { Dashboard } from './components/Dashboard';
import { ClaimList } from './components/ClaimList';
import { ClaimDetail } from './components/ClaimDetail';
import { CreateClaimForm } from './components/CreateClaimForm';
import { AccountSettings } from './components/AccountSettings';

type View = 'home' | 'claim';
type ClaimSort = 'cost-desc' | 'newest' | 'oldest' | 'title-asc';

function MainApp() {
  const { authStatus, currentAccountId, state } = useAppContext();
  const [view, setView] = useState<View>('home');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [claimSort, setClaimSort] = useState<ClaimSort>('cost-desc');
  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);
  const pendingNavigationFrameRef = useRef<number | null>(null);

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
    return () => {
      if (pendingNavigationFrameRef.current !== null) {
        cancelAnimationFrame(pendingNavigationFrameRef.current);
      }
    };
  }, []);

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

  const sortedClaims = [...currentState.claims].sort((a, b) => {
    switch (claimSort) {
      case 'newest':
        return b.createdAt - a.createdAt;
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'cost-desc':
      default:
        return cost(b.yesStake, b.noStake) - cost(a.yesStake, a.noStake);
    }
  });

  function handleSelectClaim(id: string) {
    if (view === 'home') {
      homeScrollYRef.current = window.scrollY;
      shouldRestoreHomeScrollRef.current = true;
    }

    if (pendingNavigationFrameRef.current !== null) {
      cancelAnimationFrame(pendingNavigationFrameRef.current);
    }

    pendingNavigationFrameRef.current = requestAnimationFrame(() => {
      pendingNavigationFrameRef.current = null;
      setSelectedClaimId(id);
      setView('claim');
    });
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
                <div className="claims-actions">
                  <label className="claim-sort-label" htmlFor="claim-sort">
                    Sort
                  </label>
                  <select
                    id="claim-sort"
                    className="claim-sort-select"
                    value={claimSort}
                    onChange={(e) => setClaimSort(e.target.value as ClaimSort)}
                  >
                    <option value="cost-desc">Cost (high to low)</option>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="title-asc">Title (A-Z)</option>
                  </select>
                  <button
                    className="btn-primary new-claim-btn"
                    onClick={() => setShowCreate(true)}
                    type="button"
                  >
                    + New Claim
                  </button>
                </div>
              </div>
              <ClaimList
                claims={sortedClaims}
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
