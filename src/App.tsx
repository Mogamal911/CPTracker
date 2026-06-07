// src/App.tsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import NavBar              from './components/NavBar';
import BottomTabBar        from './components/BottomTabBar';
import LogFAB              from './components/LogFAB';
import OnboardingModal     from './components/OnboardingModal';
import { GamificationLayer } from './components/GamificationLayer';
import LandingPage     from './pages/LandingPage';
import ProfilePage     from './pages/ProfilePage';
import DashboardPage   from './pages/DashboardPage';
import PublicProfilePage from './pages/PublicProfilePage';
import JoinPage        from './pages/JoinPage';
import LogPage         from './pages/LogPage';
import LeaderboardPage from './pages/LeaderboardPage';
import GroupDetailPage from './pages/GroupDetailPage';
import AnalyticsPage   from './pages/AnalyticsPage';

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';

function AppShell() {
  const { user, loginWithGoogle } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });

  // Listen for sidebar collapse events dispatched by NavBar
  useEffect(() => {
    const handler = (e: Event) => {
      setSidebarCollapsed((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('sidebarCollapsed', handler);
    return () => window.removeEventListener('sidebarCollapsed', handler);
  }, []);

  // Mobile log tab state
  const [mobileLogOpen, setMobileLogOpen] = useState(false);

  const showBanner = !user && location.pathname !== '/';

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <NavBar />

      {/* Main content area */}
      <main
        className={`app-main ${sidebarCollapsed ? 'app-main--collapsed' : ''}`}
        style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}
      >
        {showBanner && (
          <div style={{
            background: 'linear-gradient(90deg, rgba(29, 158, 117, 0.15), rgba(57, 211, 83, 0.15))',
            borderBottom: '1px solid var(--border)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            textAlign: 'center',
            flexWrap: 'wrap',
            zIndex: 100,
            position: 'sticky',
            top: 0,
            backdropFilter: 'blur(8px)',
            width: '100%',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              💡 You are browsing in Guest Mode. Sign in with Google to save your progress and join groups permanently!
            </span>
            <button
              onClick={loginWithGoogle}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 12px',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(29, 158, 117, 0.3)',
                transition: 'all 0.15s'
              }}
            >
              Sign In
            </button>
          </div>
        )}

        <Routes>
          <Route path="/"                element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
          <Route path="/profile"         element={<ProfilePage />} />
          <Route path="/dashboard"       element={<DashboardPage />} />
          <Route path="/users/:username" element={<PublicProfilePage />} />
          <Route path="/log"             element={<LogPage />} />
          <Route path="/leaderboard"     element={<LeaderboardPage />} />
          <Route path="/groups/:teamId"  element={<GroupDetailPage />} />
          <Route path="/analytics"       element={<AnalyticsPage />} />
          <Route path="/join/:inviteCode" element={<JoinPage />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global overlays */}
        <OnboardingModal />
        <GamificationLayer />

        {/* FAB — global, works on all pages */}
        <LogFAB
          externalOpen={mobileLogOpen}
          onExternalOpenHandled={() => setMobileLogOpen(false)}
        />
      </main>

      {/* Mobile bottom tab bar */}
      <BottomTabBar onLogTabPress={() => setMobileLogOpen(true)} />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
