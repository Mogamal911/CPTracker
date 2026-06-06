import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { getRank, getNextRankXP, RANKS } from '../lib/xp';
import { BadgeShelf } from '../components/BadgeShelf';
import type { SolveLog } from '../types';
import EditUsernameModal from '../components/EditUsernameModal';
import UsernameSetupModal from '../components/UsernameSetupModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Google sign-in button ────────────────────────────────────────────────────
function GoogleSignInBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl shadow-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
    >
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Sign In with Google
    </button>
  );
}

// ─── Landing (not signed in, not guest) ──────────────────────────────────────
function LandingPage({ onGuest, onSignIn }: { onGuest: () => void; onSignIn: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="relative z-10 text-center space-y-8 max-w-2xl px-4">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full text-indigo-400 text-xs font-semibold uppercase tracking-wider font-mono">
          CP XP Tracker v2.0
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">
          Level Up Your <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Competitive Programming
          </span>
        </h1>

        <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
          Track Codeforces, AtCoder, and LeetCode solves. Earn XP, climb ranks, build streaks, and compete with your training group.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <GoogleSignInBtn onClick={onSignIn} />
          <button
            onClick={onGuest}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold rounded-xl transition duration-200 cursor-pointer"
          >
            Continue as guest →
          </button>
        </div>

        <p className="text-xs text-slate-600">
          Guests can browse freely — sign in to save progress, log solves, and join groups.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard (signed in or guest) ──────────────────────────────────────────
export const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, profile, loginWithGoogle, logout } = useAuth();
  const { groups } = useGroups();
  const [copied, setCopied] = useState<string | null>(null); // teamId being copied
  const [showEditUsername, setShowEditUsername] = useState(false);

  const [solves, setSolves] = useState<SolveLog[]>([]);
  const [guestMode, setGuestMode] = useState(false); // tracks "Continue as guest" choice

  // If auth resolved, no user, and guest mode not chosen → show landing
  const showLanding = !user && !guestMode;

  // Real-time Solves Listener (only for signed-in users)
  useEffect(() => {
    if (!user) { setSolves([]); return; }
    const q = query(collection(db, 'solves'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => doc.data() as SolveLog);
      list.sort((a, b) => getMillis(b.solvedAt) - getMillis(a.solvedAt));
      setSolves(list);
    }, (err) => console.error('Error listing solves:', err));
    return () => unsub();
  }, [user]);

  if (showLanding) {
    return <LandingPage onGuest={() => setGuestMode(true)} onSignIn={loginWithGoogle} />;
  }

  // ── XP progress ────────────────────────────────────────────────────────────
  const currentXP        = profile?.xp ?? 0;
  const currentRank      = getRank(currentXP);
  const nextRankXP       = getNextRankXP(currentXP);
  const currentRankObj   = RANKS.find(r => r.name === currentRank);
  const currentMinXP     = currentRankObj ? currentRankObj.minXP : 0;
  const nextRankObj      = RANKS.find(r => r.minXP === nextRankXP);
  const nextRankName     = nextRankObj ? nextRankObj.name : 'Max';
  const xpForNextRank    = nextRankXP === -1 ? 0 : nextRankXP - currentMinXP;
  const userXPInRank     = nextRankXP === -1 ? 1 : currentXP - currentMinXP;
  const xpPercentage     = nextRankXP === -1 ? 100 : Math.min(100, Math.max(0, (userXPInRank / xpForNextRank) * 100));

  // ── Platform counts ────────────────────────────────────────────────────────
  const cfSolves = solves.filter(s => s.platform === 'codeforces' && s.accepted).length;
  const acSolves = solves.filter(s => s.platform === 'atcoder'    && s.accepted).length;
  const lcSolves = solves.filter(s => s.platform === 'leetcode'   && s.accepted).length;

  const handleCopyLink = (inviteCode: string, teamId: string) => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(teamId);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 relative">
      {/* Glow effects */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">

        {/* Guest banner */}
        {!user && (
          <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-3.5 gap-4">
            <p className="text-sm text-indigo-300 font-medium">
              ⚡ You're browsing as a guest — sign in to save your progress and join groups.
            </p>
            <button
              onClick={loginWithGoogle}
              className="shrink-0 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Sign in
            </button>
          </div>
        )}

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 gap-4">
          <div className="flex items-center space-x-4">
            {user ? (
              <img
                src={profile?.photoURL || user.photoURL || 'https://via.placeholder.com/64'}
                alt={profile?.displayName}
                className="w-16 h-16 rounded-2xl border-2 border-indigo-500/20 object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl">
                👤
              </div>
            )}
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                {user ? (profile?.username || profile?.displayName || user.displayName || 'Unnamed') : 'Guest'}
                {user && (
                  <button
                    onClick={() => setShowEditUsername(true)}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition text-[10px]"
                    title="Edit Username"
                  >
                    ✏️
                  </button>
                )}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono font-semibold">
                  {user ? (profile?.rank || 'Newbie') : 'Guest'}
                </span>
              </h2>
              {user && (
                <p className="text-xs text-slate-400 font-mono">
                  UID: <span className="text-slate-500">{user.uid}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/log')}
              className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-sm font-semibold rounded-xl transition duration-150 shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              + Log a Solve
            </button>
            {user ? (
              <button
                onClick={logout}
                className="px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="px-4 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* XP Progress */}
        <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
            <span>Rank: <strong className="text-indigo-300 font-bold">{currentRank}</strong></span>
            <span>XP: <strong className="text-white font-mono">{currentXP}</strong>{nextRankXP !== -1 && ` / ${nextRankXP}`}</span>
          </div>
          <div className="w-full bg-slate-950 h-3.5 rounded-full border border-slate-800/80 overflow-hidden">
            <div
              style={{ width: `${xpPercentage}%` }}
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-500"
            />
          </div>
          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-500">
            <span>{currentRank} ({currentMinXP} XP)</span>
            <span>{nextRankXP === -1 ? 'Max Rank Reached' : `${nextRankName} (${nextRankXP} XP)`}</span>
          </div>
        </section>

        {/* Streak */}
        <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center text-2xl">🔥</div>
              <div>
                <h3 className="text-base font-bold text-white">{profile?.streak ?? 0}-day streak</h3>
                <p className="text-xs text-slate-400">Keep solving daily to maintain momentum!</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Last Solve</span>
              <span className="text-sm font-semibold text-slate-200 font-mono mt-0.5 block">
                {profile?.lastSolveDate || 'No solves yet'}
              </span>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total problems', value: profile?.totalSolves ?? 0 },
            { label: 'Total hours',    value: Math.round((profile?.totalHours ?? 0) * 10) / 10 },
            { label: 'Weekly problems', value: profile?.weeklyProblems ?? 0 },
            { label: 'Weekly hours',   value: Math.round((profile?.weeklyHours ?? 0) * 10) / 10 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 space-y-1">
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{label}</div>
              <div className="text-3xl font-extrabold font-mono text-white">{value}</div>
            </div>
          ))}
        </section>

        {/* Groups */}
        {user && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">My Groups</h3>
              <button
                onClick={() => navigate('/groups')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition"
              >
                Manage Groups →
              </button>
            </div>
            {groups.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 text-center text-sm text-slate-500 italic">
                Not in any group yet.{' '}
                <button onClick={() => navigate('/groups')} className="text-indigo-400 hover:underline font-semibold">
                  Create or join one
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map(group => (
                  <div key={group.teamId} className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center text-lg">🛡️</div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{group.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {group.members.length} members · <span className="text-indigo-400">{group.inviteCode}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(group.inviteCode, group.teamId)}
                        className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        {copied === group.teamId ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button
                        onClick={() => navigate(`/groups/${group.teamId}`)}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Platform Splits */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Codeforces', value: cfSolves, tag: 'CF', color: 'text-indigo-400' },
            { label: 'AtCoder',    value: acSolves, tag: 'AC', color: 'text-emerald-400' },
            { label: 'LeetCode',   value: lcSolves, tag: 'LC', color: 'text-amber-500' },
          ].map(({ label, value, tag, color }) => (
            <div key={tag} className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label} Solves</span>
                <div className="text-2xl font-bold font-mono text-white mt-1">{value}</div>
              </div>
              <div className={`${color} font-mono text-lg font-bold`}>{tag}</div>
            </div>
          ))}
        </section>

        {/* Badge Shelf */}
        {user && (
          <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl overflow-hidden">
            <BadgeShelf unlockedIds={profile?.badges ?? []} />
          </section>
        )}

        {/* Recent Solves */}
        <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Recent Solves</h3>
          {solves.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 italic">
              {user ? 'No solves logged yet. Get started by logging your first solve!' : 'Sign in to view your solve history.'}
            </div>
          ) : (
            <div className="space-y-3">
              {solves.slice(0, 8).map(solve => (
                <div
                  key={solve.solveId}
                  className="p-4 bg-slate-950/40 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center justify-between transition duration-150"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-lg font-mono font-bold uppercase tracking-wider ${
                      solve.platform === 'codeforces' ? 'bg-indigo-500/10 text-indigo-300' :
                      solve.platform === 'atcoder'    ? 'bg-emerald-500/10 text-emerald-300' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {solve.platform === 'codeforces' ? 'CF' : solve.platform === 'atcoder' ? 'AC' : 'LC'}
                    </span>
                    <div className="min-w-0">
                      {/* Problem name as clickable link */}
                      {solve.problemLink ? (
                        <a
                          href={solve.problemLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-white hover:text-indigo-300 hover:underline transition truncate block"
                          onClick={e => e.stopPropagation()}
                        >
                          {solve.problemName}
                        </a>
                      ) : (
                        <div className="text-sm font-semibold text-white truncate">{solve.problemName}</div>
                      )}
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{formatDate(solve.solvedAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      solve.difficulty === 'easy'   ? 'bg-emerald-500/10 text-emerald-400' :
                      solve.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-rose-500/10 text-rose-400'
                    }`}>
                      {solve.difficulty}
                    </span>
                    <span className={`text-xs font-bold font-mono ${solve.accepted ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {solve.accepted ? `+${solve.xpEarned} XP` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showEditUsername && <EditUsernameModal onClose={() => setShowEditUsername(false)} />}
        <UsernameSetupModal />

      </div>
    </div>
  );
};
export default DashboardPage;
