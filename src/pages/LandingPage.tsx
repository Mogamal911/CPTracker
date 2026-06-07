// src/pages/LandingPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { UserProfile, SolveLog } from '../types';
import RankBadge from '../components/RankBadge';

// Helper to count animation
function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const startValue = current;
    const endValue = value;

    if (startValue === endValue) return;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const val = Math.floor(progress * (endValue - startValue) + startValue);
      setCurrent(val);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span>{current.toLocaleString()}</span>;
}

export default function LandingPage() {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [solves, setSolves] = useState<SolveLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
    });
    return () => unsub();
  }, []);

  // Fetch solves in the last 7 days for the leaderboard preview
  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const q = query(collection(db, 'solves'), where('solvedAt', '>=', Timestamp.fromDate(cutoff)));
    const unsub = onSnapshot(q, (snap) => {
      setSolves(snap.docs.map(d => d.data() as SolveLog));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Sum up stats
  const totalSolves = useMemo(() => {
    return users.reduce((acc, u) => acc + (u.totalSolves ?? 0), 0);
  }, [users]);

  const totalHours = useMemo(() => {
    return Math.round(users.reduce((acc, u) => acc + (u.totalHours ?? 0), 0));
  }, [users]);

  // Compute top 5 users of this week's XP
  const topUsers = useMemo(() => {
    const statsMap: Record<string, number> = {};
    solves.forEach(s => {
      statsMap[s.userId] = (statsMap[s.userId] || 0) + (s.xpEarned ?? 0);
    });

    return users
      .map(u => ({
        profile: u,
        weeklyXP: statsMap[u.uid] || 0,
      }))
      .filter(item => item.weeklyXP > 0)
      .sort((a, b) => b.weeklyXP - a.weeklyXP)
      .slice(0, 5);
  }, [users, solves]);

  const handleGetStarted = async () => {
    if (user) {
      navigate('/dashboard');
    } else {
      try {
        await loginWithGoogle();
        navigate('/dashboard');
      } catch (err) {
        console.error('Login failed:', err);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)', overflowX: 'hidden', position: 'relative' }}>
      {/* Background radial glow */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', height: 600, background: 'radial-gradient(circle, rgba(29,158,117,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Main hero section */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%', padding: '80px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '60px', alignItems: 'center' }}>
          {/* Hero Left / Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'inline-flex', alignSelf: 'center', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '30px', background: 'rgba(29, 158, 117, 0.1)', border: '1px solid rgba(29, 158, 117, 0.2)', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              <i className="ti ti-flame" style={{ fontSize: '1rem' }} /> Competitive Programming Companion
            </div>
            
            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
              Level Up Your <span style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--success) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Competitive Programming</span>
            </h1>
            
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 auto', maxWidth: '640px' }}>
              Log problems, track your training streak, climb the global rankings, and compete with friends. Built for Codeforces, AtCoder, and LeetCode.
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '12px' }}>
              <button onClick={handleGetStarted} className="btn-primary" style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(29, 158, 117, 0.3)' }}>
                <i className="ti ti-bolt" /> Get Started Now
              </button>
              <button onClick={() => navigate('/leaderboard')} className="btn-secondary" style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-trophy" /> View Leaderboard
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn-secondary" style={{ padding: '14px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', borderColor: 'var(--border)' }}>
                <i className="ti ti-eye" /> Browse as Guest →
              </button>
            </div>
          </div>

          {/* Stats section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
            <div className="cp-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '72px', opacity: 0.03, fontWeight: 900 }}>✓</div>
              <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                <AnimatedNumber value={totalSolves} />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Problems Solved</div>
            </div>
            
            <div className="cp-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '72px', opacity: 0.03, fontWeight: 900 }}>⌛</div>
              <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--success)', fontFamily: 'monospace' }}>
                <AnimatedNumber value={totalHours} />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hours Trained</div>
            </div>

            <div className="cp-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', padding: '32px 24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, right: -10, fontSize: '72px', opacity: 0.03, fontWeight: 900 }}>👥</div>
              <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--warning)', fontFamily: 'monospace' }}>
                <AnimatedNumber value={users.length} />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Coders</div>
            </div>
          </div>

          {/* Leaderboard Preview & Features Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', width: '100%', marginTop: '20px' }}>
            {/* Leaderboard Preview */}
            <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '360px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  ⚡ Weekly Leaders Preview
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Live Update</span>
              </div>

              {loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  Loading rankings...
                </div>
              ) : topUsers.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '12px', padding: '40px 0' }}>
                  <i className="ti ti-mood-empty" style={{ fontSize: '2rem', opacity: 0.5 }} />
                  <span style={{ fontSize: '0.85rem' }}>No solves logged this week yet.</span>
                  <button onClick={handleGetStarted} className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>Be the first!</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topUsers.map((item, idx) => (
                    <div key={item.profile.uid} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', width: '20px', color: idx === 0 ? '#EF9F27' : idx === 1 ? '#888780' : idx === 2 ? '#1D9E75' : 'var(--text-secondary)' }}>
                        #{idx + 1}
                      </span>
                      <img
                        src={item.profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.profile.username || item.profile.displayName)}&background=0D1117&color=E6EDF3`}
                        alt={item.profile.username || item.profile.displayName}
                        style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--border)', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.profile.username || item.profile.displayName}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          <RankBadge rank={item.profile.rank} size="sm" />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {item.weeklyXP} XP
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Platform Feature Matrix */}
            <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>🎯 Training Engine Features</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(55,138,221,0.1)', border: '1px solid rgba(55,138,221,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-flame" style={{ color: '#378ADD', fontSize: '1.1rem' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 4px' }}>Automated Streak Calculations</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Maintain consistency with automatic daily checkins and streak preservation logic.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-trophy" style={{ color: 'var(--accent)', fontSize: '1.1rem' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 4px' }}>Interactive Badges & Ranks</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Rank up from Newbie to Master and unlock digital badges for solve milestones.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(239,159,39,0.1)', border: '1px solid rgba(239,159,39,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="ti ti-users" style={{ color: '#EF9F27', fontSize: '1.1rem' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 4px' }}>Social & Mutual Friendships</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Follow any user instantly, or request a mutual approved friendship to filter rankings.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center', position: 'relative', zIndex: 1, marginTop: 'auto' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          © {new Date().getFullYear()} CPTracker. Designed for maximum visual excellence.
        </p>
      </footer>
    </div>
  );
}
