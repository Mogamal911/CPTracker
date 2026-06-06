import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NavBar              from './components/NavBar';
import OnboardingModal     from './components/OnboardingModal';
import { GamificationLayer } from './components/GamificationLayer';
import DashboardPage   from './pages/DashboardPage';
import JoinPage        from './pages/JoinPage';
import LogPage         from './pages/LogPage';
import LeaderboardPage from './pages/LeaderboardPage';
import GroupsPage      from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import AnalyticsPage   from './pages/AnalyticsPage';
import FriendsPage     from './pages/FriendsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
          <NavBar />

          <Routes>
            <Route path="/"                element={<DashboardPage />} />
            <Route path="/log"             element={<LogPage />} />
            <Route path="/leaderboard"     element={<LeaderboardPage />} />
            <Route path="/groups"          element={<GroupsPage />} />
            <Route path="/groups/:teamId"  element={<GroupDetailPage />} />
            <Route path="/friends"         element={<FriendsPage />} />
            <Route path="/analytics"       element={<AnalyticsPage />} />
            <Route path="/join/:inviteCode" element={<JoinPage />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>

          {/* Global overlays */}
          <OnboardingModal />
          <GamificationLayer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
