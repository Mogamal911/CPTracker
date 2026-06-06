import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, isGuest } = useAuth();

  const [solves, setSolves] = useState<SolveLog[]>([]);
  const [range, setRange]   = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [sortField, setSortField] = useState<'date' | 'difficulty' | 'totalTime' | 'xpEarned' | 'platform'>('date');
  const [sortAsc, setSortAsc]     = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSolve, setSelectedSolve] = useState<SolveLog | null>(null);
  const ITEMS_PER_PAGE = 5;

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

  const acceptedSolves = filteredSolves.filter(s => s.accepted ?? (s as any).solved);

  // ── 1. Daily training hours bar chart ─────────────────────────────────────
  const barData = (() => {
    const numDays = range === '7d' ? 7 : range === '30d' ? 14 : 14;
    const now     = new Date();
    return Array.from({ length: numDays }, (_, i) => {
      const d      = new Date(now.getTime() - (numDays - 1 - i) * 24 * 3600 * 1000);
      const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const key     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const daySolves = solves.filter(s => {
        const sd  = new Date(getMillis(s.solvedAt));
        const skey = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
        return skey === key;
      });
      const hours = Math.round(daySolves.reduce((sum, s) => sum + s.totalTime, 0) / 60 * 100) / 100;
      return { date: dateStr, hours };
    });
  })();

  // ── 2. Platform donut ─────────────────────────────────────────────────────
  const platformData = [
    { name: 'Codeforces', value: acceptedSolves.filter(s => s.platform === 'codeforces').length, color: '#6366f1' },
    { name: 'AtCoder',    value: acceptedSolves.filter(s => s.platform === 'atcoder').length,    color: '#10b981' },
    { name: 'LeetCode',   value: acceptedSolves.filter(s => s.platform === 'leetcode').length,   color: '#f59e0b' },
  ].filter(p => p.value > 0);

  // ── 3. Avg solve times ───────────────────────────────────────────────────
  const avgTime = (diff: string) => {
    const s = acceptedSolves.filter(s => s.difficulty === diff);
    if (!s.length) return '—';
    return `${Math.round(s.reduce((sum, x) => sum + x.totalTime, 0) / s.length)}m`;
  };

  // ── 4. History table ─────────────────────────────────────────────────────
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const sorted = [...filteredSolves].sort((a, b) => {
    let va: any, vb: any;
    if (sortField === 'date')       { va = getMillis(a.solvedAt); vb = getMillis(b.solvedAt); }
    else if (sortField === 'totalTime') { va = a.totalTime; vb = b.totalTime; }
    else if (sortField === 'xpEarned') { va = a.xpEarned; vb = b.xpEarned; }
    else if (sortField === 'difficulty') { va = a.difficulty; vb = b.difficulty; }
    else { va = a.platform; vb = b.platform; }
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    return sortAsc ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
  });
  const totalPages    = Math.ceil(sorted.length / ITEMS_PER_PAGE) || 1;
  const paginated     = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Guest / no user state ──────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">📊</div>
          <h2 className="text-xl font-bold text-white">Sign in to see your analytics</h2>
          <p className="text-sm text-slate-400">Your solve history, timing charts, and platform breakdowns appear here.</p>
          <button
            onClick={loginWithGoogle}
            className="px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl shadow-lg transition cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 relative">
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics</h1>
            <p className="text-xs text-slate-400 mt-0.5">Solve performance metrics and history</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              {(['7d', '30d', '90d', 'all'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setRange(r); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-lg uppercase tracking-wider font-semibold transition ${range === r ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              ← Dashboard
            </button>
          </div>
        </header>

        {/* Stats cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Avg (Easy)',   value: avgTime('easy'),   color: 'text-emerald-400' },
            { label: 'Avg (Medium)', value: avgTime('medium'), color: 'text-amber-400' },
            { label: 'Avg (Hard)',   value: avgTime('hard'),   color: 'text-rose-400' },
            { label: 'Solved',       value: acceptedSolves.length, color: 'text-indigo-300' },
          ].map(c => (
            <div key={c.label} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{c.label}</span>
              <div className={`text-xl font-bold font-mono mt-1 ${c.color}`}>{c.value}</div>
            </div>
          ))}
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Daily hours bar chart (2 cols) */}
          <div className="md:col-span-2 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Daily Training Hours</h3>
            {solves.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-600 italic text-xs">Log some solves to see your chart</div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }} />
                    <Bar dataKey="hours" name="Training Hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Platform donut (1 col) */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Platform Split</h3>
            {platformData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-600 italic text-xs">No solves in range</div>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={platformData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                      {platformData.map((entry, i) => (
                        <Cell key={`c-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="text-[10px] text-center text-slate-500 font-mono">Total: {acceptedSolves.length} solved</div>
          </div>
        </section>

        {/* Solve history table */}
        <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Solve History</h3>
            <span className="text-[10px] text-slate-500 font-mono">Page {currentPage} of {totalPages}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                  {[
                    { key: 'date',       label: 'Date' },
                    { key: 'platform',   label: 'Platform' },
                    { key: null,         label: 'Problem' },
                    { key: 'difficulty', label: 'Difficulty' },
                    { key: 'totalTime',  label: 'Time' },
                    { key: null,         label: 'AC' },
                    { key: 'xpEarned',  label: 'XP' },
                  ].map(col => (
                    <th
                      key={col.label}
                      className={`py-2.5 px-3 ${col.key ? 'cursor-pointer select-none hover:text-slate-200' : ''}`}
                      onClick={() => col.key && handleSort(col.key as typeof sortField)}
                    >
                      {col.label}
                      {col.key && sortField === col.key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {paginated.map(solve => (
                  <tr
                    key={solve.solveId}
                    onClick={() => setSelectedSolve(solve)}
                    className="hover:bg-slate-900/20 cursor-pointer transition"
                  >
                    <td className="py-3 px-3 font-mono">{formatDate(solve.solvedAt)}</td>
                    <td className="py-3 px-3 capitalize font-semibold">{solve.platform}</td>
                    <td className="py-3 px-3 font-medium text-white max-w-[160px] truncate">
                      {solve.problemLink
                        ? <a href={solve.problemLink} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-300 hover:underline" onClick={e => e.stopPropagation()}>{solve.problemName}</a>
                        : solve.problemName
                      }
                    </td>
                    <td className="py-3 px-3 capitalize">{solve.difficulty}</td>
                    <td className="py-3 px-3 font-mono">{solve.totalTime}m</td>
                    <td className="py-3 px-3 text-center">{solve.accepted ?? (solve as any).solved ? '✓' : '✗'}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold">+{solve.xpEarned}</td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 italic">
                      {solves.length === 0 ? 'No solves logged yet.' : 'No solves in this date range.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition text-xs">Prev</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition text-xs">Next</button>
            </div>
          )}
        </section>

      </div>

      {/* Detail modal */}
      {selectedSolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded font-mono bg-indigo-500/10 text-indigo-300">
                    {selectedSolve.platform}
                  </span>
                  {selectedSolve.problemLink ? (
                    <a href={selectedSolve.problemLink} target="_blank" rel="noopener noreferrer" className="block text-xl font-bold text-white mt-1 hover:text-indigo-300 hover:underline">
                      {selectedSolve.problemName}
                    </a>
                  ) : (
                    <h2 className="text-xl font-bold text-white mt-1">{selectedSolve.problemName}</h2>
                  )}
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{formatDate(selectedSolve.solvedAt)}</p>
                </div>
                <button onClick={() => setSelectedSolve(null)} className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-xs">
                {[
                  { label: 'Difficulty', value: selectedSolve.difficulty, cls: 'capitalize' },
                  { label: 'Time Spent', value: `${selectedSolve.totalTime}m`, cls: 'font-mono' },
                  { label: 'Outcome', value: (selectedSolve.accepted ?? (selectedSolve as any).solved) ? '✅ Accepted' : '❌ Not solved', cls: '' },
                  { label: 'XP Earned', value: `+${selectedSolve.xpEarned}`, cls: 'text-emerald-400 font-mono font-bold' },
                ].map(({ label, value, cls }) => (
                  <div key={label}>
                    <span className="text-slate-500 uppercase font-bold tracking-wider text-[9px]">{label}</span>
                    <div className={`text-slate-200 font-semibold mt-0.5 ${cls}`}>{value}</div>
                  </div>
                ))}
              </div>

              {selectedSolve.notes && (
                <div className="space-y-1.5">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">Notes</h4>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedSolve.notes}</div>
                </div>
              )}

              <button onClick={() => setSelectedSolve(null)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-semibold transition cursor-pointer">
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
