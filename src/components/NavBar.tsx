// src/components/NavBar.tsx — Desktop collapsible sidebar
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { acceptFriendRequest, denyFriendRequest } from '../services/friendService';

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';
const THEME_KEY = 'theme';

interface NavItem {
  to: string;
  label: string;
  icon: string;   // Tabler icon class
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',         label: 'Dashboard',   icon: 'ti-home' },
  { to: '/log',               label: 'Log Solve',   icon: 'ti-edit' },
  { to: '/leaderboard',       label: 'Leaderboard', icon: 'ti-trophy' },
  { to: '/analytics',         label: 'Analytics',   icon: 'ti-chart-bar' },
  { to: '/profile',           label: 'Profile',     icon: 'ti-user' },
];

export default function NavBar() {
  const { user, isGuest, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; }
    catch { return false; }
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark'; }
    catch { return 'dark'; }
  });

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showPopup, setShowPopup] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    window.dispatchEvent(new CustomEvent('sidebarCollapsed', { detail: collapsed }));
  }, [collapsed]);

  // Sync theme
  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  // Real-time friend requests
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications', user.uid, 'items'),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(doc => doc.data()));
    }, (err) => console.error(err));
    return () => unsub();
  }, [user]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  if (!user && !isGuest) return null;

  const items = NAV_ITEMS;

  const isActiveItem = (to: string) => {
    return location.pathname === to;
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>

      {/* Header / Logo */}
      <div className="sidebar__header" style={{ position: 'relative', justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '8px 0' : '1rem' }}>
        {!collapsed && (
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden' }}
          >
            <i className="ti ti-code sidebar__logo-icon" />
            <span className="sidebar__logo-text">CPTracker</span>
          </button>
        )}

        {/* Notifications Bell */}
        {user && !collapsed && (
          <button
            onClick={() => setShowPopup(!showPopup)}
            style={{
              background: 'none', border: 'none', color: notifications.length > 0 ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', padding: '4px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: 'auto'
            }}
            title="Notifications"
          >
            <i className="ti ti-bell" style={{ fontSize: '18px' }} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute', top: '-2px', right: '-2px', background: 'var(--danger)', color: 'white',
                borderRadius: '50%', width: '12px', height: '12px', fontSize: '8px', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {notifications.length}
              </span>
            )}
          </button>
        )}

        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ marginLeft: collapsed ? '0' : '8px' }}
        >
          <i className={`ti ${collapsed ? 'ti-menu-2' : 'ti-chevron-left'}`} style={{ fontSize: '1rem' }} />
        </button>
      </div>

      {/* Notifications Dropdown Popup */}
      {showPopup && !collapsed && (
        <div style={{
          position: 'absolute', top: '60px', left: '10px', width: '220px',
          background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '12px',
          padding: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex',
          flexDirection: 'column', gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>Friend Requests</span>
            <button onClick={() => setShowPopup(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}>Close</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>No pending requests</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {notifications.map((notif) => (
                <div key={notif.requestId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', background: 'var(--bg-page)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <img src={notif.fromPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.fromUsername)}&background=21262D&color=E6EDF3`} alt="User" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.fromUsername}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      disabled={processingId === notif.requestId}
                      onClick={async () => {
                        setProcessingId(notif.requestId);
                        try {
                          if (user) {
                            await acceptFriendRequest(notif.requestId, user.uid, notif.fromUid);
                          }
                        } catch (err: any) {
                          console.error('Accept request failed:', err);
                          setToastMessage(err.message || 'Failed to accept friend request');
                          setTimeout(() => setToastMessage(null), 5000);
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                      style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 700, cursor: 'pointer', opacity: processingId === notif.requestId ? 0.7 : 1 }}
                    >
                      {processingId === notif.requestId ? 'Accepting...' : 'Accept'}
                    </button>
                    <button
                      disabled={processingId === notif.requestId}
                      onClick={async () => {
                        setProcessingId(notif.requestId);
                        try {
                          if (user) {
                            await denyFriendRequest(notif.requestId, user.uid);
                          }
                        } catch (err: any) {
                          console.error('Deny request failed:', err);
                          setToastMessage(err.message || 'Failed to deny friend request');
                          setTimeout(() => setToastMessage(null), 5000);
                        } finally {
                          setProcessingId(null);
                        }
                      }}
                      style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', opacity: processingId === notif.requestId ? 0.7 : 1 }}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation items */}
      <nav className="sidebar__nav">
        {items.map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={`sidebar__item ${isActiveItem(item.to) ? 'sidebar__item--active' : ''}`}
            data-tooltip={item.label}
          >
            <i className={`ti ${item.icon} sidebar__item-icon`} />
            <span className="sidebar__item-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer: theme toggle + sign out */}
      <div className="sidebar__footer">
        <button className="sidebar__theme-btn" onClick={toggleTheme} data-tooltip="Toggle theme">
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} style={{ fontSize: '1rem', flexShrink: 0 }} />
          <span className="sidebar__item-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        {user ? (
          <button className="sidebar__sign-out" onClick={logout} data-tooltip="Sign out">
            <i className="ti ti-logout" style={{ fontSize: '1rem', flexShrink: 0 }} />
            <span className="sidebar__item-label">Sign Out</span>
          </button>
        ) : (
          <button className="sidebar__sign-out" onClick={loginWithGoogle} data-tooltip="Sign in">
            <i className="ti ti-login" style={{ fontSize: '1rem', flexShrink: 0 }} />
            <span className="sidebar__item-label">Sign In</span>
          </button>
        )}
      </div>

      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20,
          background: '#ff4d4d', color: 'white', padding: '12px 20px',
          borderRadius: 8, fontWeight: 600, fontSize: '12px', zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span>⚠️ {toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 800, paddingLeft: '8px' }}>×</button>
        </div>
      )}
    </aside>
  );
}
