// src/components/BottomTabBar.tsx — Mobile-only bottom navigation
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface TabItem {
  to: string;
  label: string;
  icon: string;
  isLog?: boolean;
}

const TABS: TabItem[] = [
  { to: '/dashboard',         label: 'Dashboard',   icon: 'ti-home' },
  { to: '/log',               label: 'Log',         icon: 'ti-plus', isLog: true },
  { to: '/leaderboard',       label: 'Leaderboard', icon: 'ti-trophy' },
  { to: '/analytics',         label: 'Analytics',   icon: 'ti-chart-bar' },
  { to: '/profile',           label: 'Profile',     icon: 'ti-user' },
];

interface Props {
  onLogTabPress?: () => void;
}

export default function BottomTabBar({ onLogTabPress }: Props) {
  const { user, isGuest } = useAuth();
  const location = useLocation();

  if (!user && !isGuest) return null;

  const isActiveTab = (to: string) => {
    return location.pathname === to;
  };

  return (
    <nav className="bottom-tab-bar" role="navigation" aria-label="Main navigation">
      {TABS.map(tab => {
        if (tab.isLog) {
          return (
            <button
              key={tab.to}
              className="bottom-tab-bar__tab"
              onClick={onLogTabPress}
              aria-label="Log a solve"
            >
              <i className={`ti ${tab.icon}`} />
              <span>{tab.label}</span>
            </button>
          );
        }

        const active = isActiveTab(tab.to);

        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`bottom-tab-bar__tab ${active ? 'bottom-tab-bar__tab--active' : ''}`}
            aria-label={tab.label}
          >
            <i className={`ti ${tab.icon}`} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
