// src/pages/LogPage.tsx
// Renders the SolveWizard inside the standard page layout, accessible to both logged-in and guest users.

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import SolveWizard from '../components/SolveWizard';

export const LogPage = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      {/* Background glow */}
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.03)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Guest Warning Banner */}
        {!user && (
          <div style={{
            background: 'rgba(239, 159, 39, 0.1)',
            border: '1px solid rgba(239, 159, 39, 0.25)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--warning)' }}>
              ⚠️ You are in Guest Mode. Sign in to permanently save this solve to your history and earn XP!
            </span>
            <button
              onClick={loginWithGoogle}
              style={{
                background: 'var(--warning)',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 159, 39, 0.3)',
                transition: 'all 0.15s'
              }}
            >
              Sign In
            </button>
          </div>
        )}

        <header className="cp-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Log a Solve</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Record your training session</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="cp-btn-secondary"
            style={{ padding: '8px 14px', fontSize: 12 }}
          >
            ← Dashboard
          </button>
        </header>

        <div className="cp-card" style={{ padding: '1rem 0' }}>
          <SolveWizard onSuccess={() => navigate('/dashboard')} />
        </div>
      </div>
    </div>
  );
};

export default LogPage;
