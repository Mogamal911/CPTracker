// src/pages/AnalyticsPage.tsx
// Fully rebuilt Analytics page using Recharts and dark mode tokens.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import type { SolveLog } from '../types';

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  if (t instanceof Date) return t.getTime();
  return new Date(t).getTime();
}

function formatDate(t: any): string {
  const ms = getMillis(t);
  if (ms === 0) return 'N/A';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, isGuest } = useAuth();

  const [solves, setSolves] = useState<SolveLog[]>([]);
  const [range, setRange]   = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSolve, setSelectedSolve] = useState<SolveLog | null>(null);

  const ITEMS_PER_PAGE = 20;

  // Real-time solves subscription
  useEffect(() => {
    if (!user) { setSolves([]); return; }
    const q = query(collection(db, 'solves'), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setSolves(snap.docs.map(d => d.data() as SolveLog));
    }, err => console.error('Error fetching solves:', err));
  }, [user]);

  const cutoffMs = () => {
    if (range === 'all') return 0;
    const map = { '7d': 7, '30d': 30, '90d': 90 };
    return Date.now() - map[range] * 24 * 3600 * 1000;
  };

  const filteredSolves = range === 'all'
    ? solves
    : solves.filter(s => getMillis(s.solvedAt) >= cutoffMs());

  const acceptedSolves = filteredSolves.filter(s => s.accepted);

  // ── SECTION 1: Key Metrics ────────────────────────────────────────────────
  const totalSolves = acceptedSolves.length;
  
  const firstAcSolves = acceptedSolves.filter(s => (s.wrongAnswers ?? s.wa ?? 0) === 0).length;
  const firstAcRate = acceptedSolves.length > 0 ? Math.round((firstAcSolves / acceptedSolves.length) * 100) : 0;
  
  const totalXP = filteredSolves.reduce((sum, s) => sum + (s.xpEarned ?? 0), 0);
  const totalMinutes = filteredSolves.reduce((sum, s) => sum + (s.totalTime ?? 0), 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  // ── SECTION 2: Daily hours bar chart data ─────────────────────────────────
  const barData = (() => {
    const numDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 30;
    let daysToGenerate = numDays;
    
    if (range === 'all' && solves.length > 0) {
      const oldestMs = Math.min(...solves.map(s => getMillis(s.solvedAt)));
      const diffMs = Date.now() - oldestMs;
      daysToGenerate = Math.max(7, Math.ceil(diffMs / (24 * 3600 * 1000)));
      if (daysToGenerate > 180) daysToGenerate = 180; // Cap to avoid visualization clutter
    }

    const now = new Date();
    return Array.from({ length: daysToGenerate }, (_, i) => {
      const d = new Date(now.getTime() - (daysToGenerate - 1 - i) * 24 * 3600 * 1000);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const daySolves = solves.filter(s => {
        const sd = new Date(getMillis(s.solvedAt));
        const skey = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
        return skey === key;
      });

      const codingMins = daySolves.filter(s => s.accepted).reduce((sum, s) => sum + s.totalTime, 0);
      const thinkingMins = daySolves.filter(s => !s.accepted).reduce((sum, s) => sum + s.totalTime, 0);
      
      const codingHours = Math.round((codingMins / 60) * 10) / 10;
      const thinkingHours = Math.round((thinkingMins / 60) * 10) / 10;
      const totalHours = Math.round(((codingMins + thinkingMins) / 60) * 10) / 10;

      return {
        date: dateStr,
        codingHours,
        thinkingHours,
        totalHours,
      };
    });
  })();

  // Custom Tooltip for Stacked Bar Chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          color: 'var(--text-primary)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{data.date}</div>
          <div style={{ color: '#1D9E75', marginBottom: 2 }}>Coding: {data.codingHours.toFixed(1)}h</div>
          <div style={{ color: 'var(--text-secondary)' }}>Total: {data.totalHours.toFixed(1)}h</div>
        </div>
      );
    }
    return null;
  };

  // ── SECTION 3: Difficulty breakdown avg solve times ───────────────────────
  const avgTime = (diff: string) => {
    const s = acceptedSolves.filter(s => s.difficulty === diff);
    if (!s.length) return '—';
    return `${Math.round(s.reduce((sum, x) => sum + x.totalTime, 0) / s.length)}m`;
  };

  // ── SECTION 4: Platform Donut Chart ───────────────────────────────────────
  const platformData = (() => {
    const cf = acceptedSolves.filter(s => s.platform === 'codeforces').length;
    const ac = acceptedSolves.filter(s => s.platform === 'atcoder').length;
    const lc = acceptedSolves.filter(s => s.platform === 'leetcode').length;

    return [
      { name: 'Codeforces', value: cf, color: '#378ADD' },
      { name: 'AtCoder',    value: ac, color: '#EF9F27' },
      { name: 'LeetCode',   value: lc, color: '#1D9E75' },
    ].filter(p => p.value > 0);
  })();

  const totalPlatformProblems = platformData.reduce((sum, p) => sum + p.value, 0);

  // ── SECTION 5: Solve history table pagination ─────────────────────────────
  const sortedSolves = [...filteredSolves].sort((a, b) => getMillis(b.solvedAt) - getMillis(a.solvedAt));
  const totalPages   = Math.ceil(sortedSolves.length / ITEMS_PER_PAGE) || 1;
  const paginated    = sortedSolves.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (isGuest) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', padding: '1rem' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 400, alignItems: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Sign in to see your analytics</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
            Your solve history, training charts, platform distributions, and detailed problem insights are stored securely on your account.
          </p>
          <button
            onClick={loginWithGoogle}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700 }}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      {/* Ambient backgrounds */}
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.03)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1024, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header */}
        <header className="cp-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Analytics</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Detailed performance stats & solve logs</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 2 }}>
              {(['7d', '30d', '90d', 'all'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setCurrentPage(1); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    background: range === r ? 'var(--accent)' : 'transparent',
                    color: range === r ? 'white' : 'var(--text-secondary)',
                    border: 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => navigate('/')}
              className="cp-btn-secondary"
              style={{ padding: '8px 14px', fontSize: 12 }}
            >
              ← Dashboard
            </button>
          </div>
        </header>

        {/* SECTION 1: Key Metrics */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'Total Solves', value: totalSolves, suffix: 'problems', icon: 'ti-chart-bar' },
            { label: 'First-AC Rate', value: `${firstAcRate}%`, suffix: 'no WRs', icon: 'ti-activity' },
            { label: 'Total XP Earned', value: totalXP, suffix: 'points', icon: 'ti-trophy' },
            { label: 'Time Logged', value: `${totalHours}h`, suffix: 'total time', icon: 'ti-clock' }
          ].map(card => (
            <div key={card.label} className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <i className={`ti ${card.icon}`} style={{ fontSize: 13 }} />
                {card.label}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {card.value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{card.suffix}</div>
            </div>
          ))}
        </section>

        {/* Main analytical grid */}
        <div className="analytics-main-grid">
          <style>{`
            .analytics-main-grid {
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
            }
            .breakdowns-grid {
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
            }
            @media (min-width: 768px) {
              .breakdowns-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1.5rem;
              }
            }
          `}</style>
          
          {/* SECTION 2: Daily Hours Bar Chart */}
          <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>Daily Training Hours</h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>hours spent</span>
            </div>

            {solves.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
                No solve data recorded yet.
              </div>
            ) : (
              <div style={{ height: 260, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }} style={{ backgroundColor: 'transparent' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" stroke="#8B949E" tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis stroke="#8B949E" tick={{ fill: '#8B949E', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    
                    {/* Coding hours (teal) */}
                    <Bar dataKey="codingHours" stackId="a" fill="#1D9E75" />
                    
                    {/* Thinking time (muted outline style) */}
                    <Bar dataKey="thinkingHours" stackId="a" fill="#21262D" stroke="#8B949E" strokeWidth={1} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Platform breakdowns & difficulty breakdown */}
          <div className="breakdowns-grid">
            
            {/* SECTION 4: Platform Donut Chart */}
            <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 330 }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>Platform Split</h3>
              
              {platformData.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
                  No solved problems in this range.
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ position: 'relative', height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={platformData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {platformData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none'
                    }}>
                      <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{totalPlatformProblems}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solved</div>
                    </div>
                  </div>

                  {/* Custom legend below */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' }}>
                    {platformData.map(p => {
                      const pct = totalPlatformProblems > 0 ? Math.round((p.value / totalPlatformProblems) * 100) : 0;
                      return (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color }} />
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.value} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: Difficulty breakdown */}
            <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>Difficulty Breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '8px' }}>
                {[
                  { label: 'Easy Avg Time', value: avgTime('easy'), bg: 'rgba(57,211,83,0.08)', text: 'var(--success)' },
                  { label: 'Medium Avg Time', value: avgTime('medium'), bg: 'rgba(239,159,39,0.08)', text: 'var(--warning)' },
                  { label: 'Hard Avg Time', value: avgTime('hard'), bg: 'rgba(226,75,74,0.08)', text: 'var(--danger)' }
                ].map(card => (
                  <div key={card.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: card.bg, borderRadius: '10px',
                    border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{card.label}</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, fontFamily: 'monospace', color: card.text }}>{card.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 'auto', fontStyle: 'italic' }}>
                Only accepted solves are counted.
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 5: Solve History Table */}
        <section className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Solve History</h3>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Page {currentPage} of {totalPages}</span>
          </div>

          <div style={{ overflowX: 'auto', margin: '0 -24px', padding: '0 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 12px' }}>Date</th>
                  <th style={{ padding: '10px 12px' }}>Platform</th>
                  <th style={{ padding: '10px 12px' }}>Problem Name</th>
                  <th style={{ padding: '10px 12px' }}>Difficulty</th>
                  <th style={{ padding: '10px 12px' }}>Time</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Accepted</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>XP</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(solve => (
                  <tr
                    key={solve.solveId}
                    onClick={() => setSelectedSolve(solve)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseOver={e => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-2)'; }}
                    onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {formatDate(solve.solvedAt)}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                      {solve.platform || 'Other'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {solve.problemLink ? (
                        <a
                          href={solve.problemLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                          onMouseOver={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                          onMouseOut={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                        >
                          {solve.problemName} <i className="ti ti-external-link" style={{ fontSize: 10, marginLeft: 2 }} />
                        </a>
                      ) : (
                        solve.problemName
                      )}
                    </td>
                    <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: solve.difficulty === 'easy' ? 'rgba(57,211,83,0.1)' : solve.difficulty === 'medium' ? 'rgba(239,159,39,0.1)' : 'rgba(226,75,74,0.1)',
                        color: solve.difficulty === 'easy' ? 'var(--success)' : solve.difficulty === 'medium' ? 'var(--warning)' : 'var(--danger)',
                      }}>
                        {solve.difficulty || 'medium'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {formatDuration(solve.totalTime)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {solve.accepted ? (
                        <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: 14 }}>✓</span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 'bold', fontSize: 14 }}>✗</span>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: solve.accepted ? 'var(--success)' : 'var(--text-secondary)' }}>
                      {solve.accepted ? `+${solve.xpEarned}` : '—'}
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      {solves.length === 0 ? 'No solves logged yet.' : 'No solves in this date range.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="cp-btn-secondary"
                style={{ padding: '6px 12px', fontSize: 11, opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="cp-btn-secondary"
                style={{ padding: '6px 12px', fontSize: 11, opacity: currentPage === totalPages ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
          )}
        </section>

      </div>

      {/* Selected solve details modal */}
      {selectedSolve && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '1rem'
        }}>
          <div className="cp-card" style={{
            position: 'relative', width: '100%', maxWidth: '440px', overflow: 'hidden', padding: 0
          }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />
            
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                    padding: '2px 6px', borderRadius: 4, backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-secondary)'
                  }}>
                    {selectedSolve.platform || 'Practice'}
                  </span>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px', marginBottom: '4px' }}>
                    {selectedSolve.problemName}
                  </h2>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {formatDate(selectedSolve.solvedAt)}
                  </span>
                </div>
                
                <button
                  onClick={() => setSelectedSolve(null)}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)'
                  }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px',
                background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '14px', fontSize: '11px', marginBottom: '16px'
              }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>Difficulty</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize', marginTop: 2 }}>{selectedSolve.difficulty || 'medium'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>Time Spent</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2 }}>{formatDuration(selectedSolve.totalTime)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>Status</div>
                  <div style={{ fontWeight: 700, color: selectedSolve.accepted ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>
                    {selectedSolve.accepted ? '✓ Accepted' : '✗ Not solved'}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>XP Earned</div>
                  <div style={{ fontWeight: 800, color: 'var(--success)', fontFamily: 'monospace', marginTop: 2 }}>+{selectedSolve.xpEarned} XP</div>
                </div>
              </div>

              {/* Error counters if present */}
              {(selectedSolve.wa !== 0 || selectedSolve.tle !== 0 || selectedSolve.re !== 0 || selectedSolve.ce !== 0) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '6px' }}>Submission Errors</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                    {[
                      { label: 'WA', val: selectedSolve.wa },
                      { label: 'TLE', val: selectedSolve.tle },
                      { label: 'RE', val: selectedSolve.re },
                      { label: 'CE', val: selectedSolve.ce }
                    ].map(err => (
                      <div key={err.label} style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '6px' }}>
                        <div style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{err.label}</div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: err.val ? 'var(--danger)' : 'var(--text-primary)' }}>{err.val ?? 0}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSolve.notes && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '6px' }}>Notes</div>
                  <div style={{
                    fontSize: '12px', color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px',
                    maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.5'
                  }}>
                    {selectedSolve.notes}
                  </div>
                </div>
              )}

              {selectedSolve.problemLink && (
                <a
                  href={selectedSolve.problemLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{
                    display: 'block', textAlign: 'center', padding: '10px', borderRadius: '10px',
                    fontWeight: 700, fontSize: '13px', textDecoration: 'none', color: 'white', marginBottom: '8px'
                  }}
                >
                  <i className="ti ti-external-link" /> Open Problem Website
                </a>
              )}

              <button
                onClick={() => setSelectedSolve(null)}
                className="cp-btn-secondary"
                style={{ width: '100%', padding: '10px', borderRadius: '10px', fontWeight: 600, fontSize: '13px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
