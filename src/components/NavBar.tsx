import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AUTH_NAV_LINKS = [
  { to: '/',            label: 'Dashboard',  icon: '⬡' },
  { to: '/log',         label: 'Log Solve',  icon: '✍' },
  { to: '/leaderboard', label: 'Board',      icon: '🏆' },
  { to: '/groups',      label: 'Groups',     icon: '🛡️' },
  { to: '/friends',     label: 'Friends',    icon: '👥' },
  { to: '/analytics',   label: 'Analytics',  icon: '📊' },
];

const GUEST_NAV_LINKS = [
  { to: '/',            label: 'Home',       icon: '⬡' },
  { to: '/leaderboard', label: 'Board',      icon: '🏆' },
];

export default function NavBar() {
  const { user, isGuest, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const links = user ? AUTH_NAV_LINKS : GUEST_NAV_LINKS;

  // Hide nav entirely during initial auth loading (user is null and isGuest is false)
  if (!user && !isGuest) return null;

  return (
    <nav className="navbar">
      {/* Logo */}
      <button onClick={() => navigate('/')} className="navbar__logo">
        <span className="navbar__logo-icon">⬡</span>
        <span>CPTracker</span>
      </button>

      {/* Links */}
      <div className="navbar__links">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `navbar__link ${isActive ? 'navbar__link--active' : ''}`
            }
          >
            <span className="navbar__link-icon">{icon}</span>
            <span className="navbar__link-label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Right side */}
      <div className="navbar__right">
        {user ? (
          <button onClick={logout} className="navbar__sign-out">
            Sign Out
          </button>
        ) : (
          <button
            onClick={loginWithGoogle}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Sign In
          </button>
        )}
      </div>
    </nav>
  );
}
