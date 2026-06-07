// src/pages/DashboardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, limit, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SolveLog, UserProfile } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────
function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  if (t instanceof Date) return t.getTime();
  return new Date(t).getTime();
}

function getRelativeTime(solvedAt: any): string {
  const ms = getMillis(solvedAt);
  if (ms === 0) return 'unknown time';
  const diff = Date.now() - ms;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const DashboardPage = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recentSolves, setRecentSolves] = useState<SolveLog[]>([]);
  const [solves30Days, setSolves30Days] = useState<SolveLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all users to compute global metrics & resolve user mapping
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
    }, (err) => console.error('Error fetching users:', err));
    return () => unsub();
  }, []);

  // Fetch recent global solves (limit 15)
  useEffect(() => {
    const q = query(collection(db, 'solves'), orderBy('solvedAt', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      setRecentSolves(snap.docs.map(d => d.data() as SolveLog));
      setLoading(false);
    }, (err) => {
      console.error('Error fetching recent global solves:', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch solves logged in the last 30 days for platform splits
  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const q = query(collection(db, 'solves'), where('solvedAt', '>=', Timestamp.fromDate(cutoff)));
    const unsub = onSnapshot(q, (snap) => {
      setSolves30Days(snap.docs.map(d => d.data() as SolveLog));
    }, (err) => console.error('Error fetching 30-day solves:', err));
    return () => unsub();
  }, []);

  // Map users list into O(1) lookup map
  const userMap = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    users.forEach(u => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  // Compute global platform aggregates
  const globalStats = useMemo(() => {
    let totalSolves = 0;
    let totalHours = 0;
    let totalXP = 0;
    users.forEach(u => {
      totalSolves += u.totalSolves || 0;
      totalHours += u.totalHours || 0;
      totalXP += u.xp || 0;
    });
    return {
      totalUsers: users.length,
      totalSolves,
      totalHours: Math.round(totalHours * 10) / 10,
      totalXP,
    };
  }, [users]);

  // Compute platform splits (30 days)
  const splits = useMemo(() => {
    let cf = 0, ac = 0, lc = 0;
    solves30Days.forEach(s => {
      if (s.platform === 'codeforces') cf++;
      else if (s.platform === 'atcoder') ac++;
      else if (s.platform === 'leetcode') lc++;
    });
    const total = cf + ac + lc;
    const cfPct = total > 0 ? (cf / total) * 100 : 0;
    const acPct = total > 0 ? (ac / total) * 100 : 0;
    const lcPct = total > 0 ? (lc / total) * 100 : 0;
    return { cf, ac, lc, total, cfPct, acPct, lcPct };
  }, [solves30Days]);

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      {/* Dynamic Visual Glows */}
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 40, right: 40, width: 384, height: 384, background: 'rgba(57,211,83,0.03)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1024, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Header Block */}
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Global Activity Hub
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Real-time platform metrics, trends, and recent solves from coders around the world.
          </p>
        </div>

        {/* Global Metrics Cards Grid */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {[
            { label: 'Registered Coders', value: globalStats.totalUsers, icon: 'ti-users', color: 'var(--accent)' },
            { label: 'Total Solves Logged', value: globalStats.totalSolves, icon: 'ti-check', color: 'var(--success)' },
            { label: 'Hours Coded Globally', value: globalStats.totalHours, icon: 'ti-clock', color: 'var(--warning)' },
            { label: 'Accumulated Platform XP', value: globalStats.totalXP, icon: 'ti-award', color: '#5865F2' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="cp-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '1.25rem 1.5rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${icon}`} style={{ fontSize: '1.25rem', color }} />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                  {value}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {label}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Platform Splits (30 Days) */}
        <section className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              🎯 Platform Solves (Last 30 Days)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
              Distribution of {splits.total} solves logged globally on major competitive programming engines.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Codeforces', count: splits.cf, pct: splits.cfPct, color: '#5865F2' },
              { label: 'AtCoder', count: splits.ac, pct: splits.acPct, color: 'var(--accent)' },
              { label: 'LeetCode', count: splits.lc, pct: splits.lcPct, color: 'var(--warning)' },
            ].map(p => (
              <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {p.count} solves ({Math.round(p.pct)}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-surface-2)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: '4px', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Global Recent Solves Feed */}
        <section className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            ⚡ Live Global Solves Feed
          </h3>

          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 12px' }} />
              Loading global activity feed...
            </div>
          ) : recentSolves.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem' }}>
              No solves have been logged on the platform yet. Be the first to start training!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentSolves.map(solve => {
                const solver = userMap[solve.userId];
                const displayName = solver?.username || solver?.displayName || 'A guest';
                const avatar = solver?.photoURL;

                return (
                  <div
                    key={solve.solveId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.875rem 1.25rem',
                      background: 'var(--bg-surface-2)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      transition: 'border-color 0.15s, transform 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={displayName}
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-page)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                          👤
                        </div>
                      )}

                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span
                            onClick={() => {
                              if (solver?.username) {
                                navigate(`/users/${solver.username}`);
                              } else if (solver?.uid) {
                                navigate(`/users/${solver.uid}`);
                              }
                            }}
                            style={{ fontWeight: 700, cursor: solver ? 'pointer' : 'default', textDecoration: solver ? 'underline' : 'none' }}
                          >
                            {displayName}
                          </span>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>solved</span>
                          {solve.problemLink ? (
                            <a
                              href={solve.problemLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                            >
                              {solve.problemName}
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{solve.problemName}</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase',
                            background: solve.platform === 'codeforces' ? 'rgba(88,101,242,0.12)' : solve.platform === 'atcoder' ? 'rgba(29,158,117,0.12)' : 'rgba(239,159,39,0.12)',
                            color: solve.platform === 'codeforces' ? '#5865F2' : solve.platform === 'atcoder' ? 'var(--accent)' : 'var(--warning)',
                          }}>
                            {solve.platform === 'codeforces' ? 'CF' : solve.platform === 'atcoder' ? 'AC' : 'LC'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Spent {solve.totalTime} min
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {getRelativeTime(solve.solvedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 4,
                        background: solve.difficulty === 'easy' ? 'rgba(57,211,83,0.1)' : solve.difficulty === 'medium' ? 'rgba(239,159,39,0.1)' : 'rgba(226,75,74,0.1)',
                        color: solve.difficulty === 'easy' ? 'var(--success)' : solve.difficulty === 'medium' ? 'var(--warning)' : 'var(--danger)',
                      }}>
                        {solve.difficulty || 'med'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: solve.accepted ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {solve.accepted ? `+${solve.xpEarned} XP` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default DashboardPage;
