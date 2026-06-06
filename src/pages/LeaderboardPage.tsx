import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useFriends } from '../hooks/useFriends';
import { searchUsersByUsername } from '../services/friendService';
import { getRank } from '../lib/xp';
import type { UserProfile, SolveLog } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────
type Period  = 'today' | 'week' | 'month' | 'year' | 'all';
type Mode    = 'global' | 'friends' | 'group';

interface LeaderboardRow {
  profile:      UserProfile;
  periodXP:     number;
  periodSolves: number;
  periodHours:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCutoff(period: Period): Date | null {
  if (period === 'all') return null;
  const now  = new Date();
  const copy = new Date(now);
  if (period === 'today') { copy.setHours(0, 0, 0, 0); }
  else if (period === 'week') { copy.setDate(now.getDate() - 7); }
  else if (period === 'month') { copy.setMonth(now.getMonth() - 1); }
  else if (period === 'year') { copy.setFullYear(now.getFullYear() - 1); }
  return copy;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  week:  'This Week',
  month: 'This Month',
  year:  'This Year',
  all:   'All Time',
};

// ─── Component ────────────────────────────────────────────────────────────────
export const LeaderboardPage = () => {
  const { user, isGuest, loginWithGoogle } = useAuth();
  const { groups } = useGroups();
  const { friendUids, addFriend, removeFriend } = useFriends();

  const [mode,            setMode]            = useState<Mode>('global');
  const [period,          setPeriod]          = useState<Period>('week');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [allUsers, setAllUsers]     = useState<UserProfile[]>([]);
  const [periodSolves, setPeriodSolves] = useState<SolveLog[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSolves, setLoadingSolves] = useState(false);

  // Quick friend search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  // Auto-select first group in group mode
  useEffect(() => {
    if (mode === 'group' && !selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].teamId);
    }
  }, [mode, groups, selectedGroupId]);

  // Subscribe to all users (public read)
  useEffect(() => {
    setLoadingUsers(true);
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setAllUsers(snap.docs.map(d => d.data() as UserProfile));
        setLoadingUsers(false);
      },
      (err) => {
        console.error('Error loading users:', err);
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, []);

  // Subscribe to period solves (auth required)
  useEffect(() => {
    if (period === 'all' || !user) {
      setPeriodSolves([]);
      return;
    }

    const cutoff = getCutoff(period);
    if (!cutoff) { setPeriodSolves([]); return; }

    setLoadingSolves(true);
    const q = query(
      collection(db, 'solves'),
      where('solvedAt', '>=', Timestamp.fromDate(cutoff))
    );

    const unsub = onSnapshot(q, (snap) => {
      setPeriodSolves(snap.docs.map(d => d.data() as SolveLog));
      setLoadingSolves(false);
    }, (err) => {
      console.error('Error loading period solves:', err);
      setLoadingSolves(false);
    });
    return () => unsub();
  }, [period, user]);

  // Debounced friend search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery);
        // Exclude current user from quick add results
        setSearchResults(results.filter(r => r.uid !== user?.uid));
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [searchQuery, user?.uid]);

  const handleAddFriend = async (uid: string) => {
    try {
      await addFriend(uid);
    } catch (err: any) {
      alert(err.message || 'Failed to add friend');
    }
  };

  const handleRemoveFriend = async (uid: string) => {
    try {
      await removeFriend(uid);
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend');
    }
  };

  // ── Build leaderboard rows ──────────────────────────────────────────────────
  const buildRows = (): LeaderboardRow[] => {
    // Determine which users to include
    let filteredUsers = allUsers;

    if (mode === 'group' && selectedGroupId) {
      const group = groups.find(g => g.teamId === selectedGroupId);
      if (group) {
        filteredUsers = allUsers.filter(u => group.members.includes(u.uid));
      }
    } else if (mode === 'friends') {
      filteredUsers = allUsers.filter(u => u.uid === user?.uid || friendUids.includes(u.uid));
    }

    if (filteredUsers.length === 0) return [];

    if (period === 'all') {
      return filteredUsers
        .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
        .map(p => ({
          profile:      p,
          periodXP:     p.xp ?? 0,
          periodSolves: p.totalSolves ?? 0,
          periodHours:  Math.round((p.totalHours ?? 0) * 10) / 10,
        }));
    }

    // Period-based: aggregate from periodSolves
    const statsMap: Record<string, { xp: number; solves: number; hours: number }> = {};
    periodSolves.forEach(s => {
      if (!statsMap[s.userId]) statsMap[s.userId] = { xp: 0, solves: 0, hours: 0 };
      statsMap[s.userId].xp     += s.xpEarned ?? 0;
      const isAccepted = s.accepted ?? (s as any).solved ?? false;
      if (isAccepted) statsMap[s.userId].solves += 1;
      statsMap[s.userId].hours  += (s.totalTime ?? 0) / 60;
    });

    const rows: LeaderboardRow[] = filteredUsers
      .filter(p => statsMap[p.uid] !== undefined) // Only include users with activity in period
      .map(p => ({
        profile:      p,
        periodXP:     statsMap[p.uid]?.xp ?? 0,
        periodSolves: statsMap[p.uid]?.solves ?? 0,
        periodHours:  Math.round((statsMap[p.uid]?.hours ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.periodXP - a.periodXP);

    return rows;
  };

  const rows    = buildRows();
  const loading = loadingUsers || loadingSolves;
  const currentUserIdx = rows.findIndex(r => r.profile.uid === user?.uid);

  // Guest sees top 3 clearly, rest blurred
  const GUEST_VISIBLE = 3;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 relative">
      <div className="absolute top-10 left-10  w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <header className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
              <p className="text-xs text-slate-400 mt-0.5">Rankings by XP earned in the selected period</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Mode toggle */}
              <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
                <button
                  onClick={() => setMode('global')}
                  className={`px-4 py-1.5 rounded-lg font-bold transition ${mode === 'global' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  🌐 Global
                </button>
                <button
                  onClick={() => { if (!user) { loginWithGoogle(); return; } setMode('friends'); }}
                  className={`px-4 py-1.5 rounded-lg font-bold transition ${mode === 'friends' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  👥 Friends
                </button>
                <button
                  onClick={() => { if (!user) { loginWithGoogle(); return; } setMode('group'); }}
                  className={`px-4 py-1.5 rounded-lg font-bold transition ${mode === 'group' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  🏢 Group
                </button>
              </div>

              {/* Group selector */}
              {mode === 'group' && user && groups.length > 0 && (
                <select
                  value={selectedGroupId ?? ''}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  {groups.map(g => (
                    <option key={g.teamId} value={g.teamId}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Quick Friend Search Bar */}
          {user && (
            <div className="relative mt-4 pt-4 border-t border-slate-800/40">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search users by username to add them..."
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
              />
              
              {/* Quick Results Dropdown */}
              {searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-30 space-y-2 max-h-60 overflow-y-auto backdrop-blur-md">
                  {searching ? (
                    <div className="text-center py-4 text-xs text-slate-500 font-mono">Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-600 italic">No users found</div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.map((userResult) => {
                        const isFriend = friendUids.includes(userResult.uid);
                        const rank = getRank(userResult.xp ?? 0);
                        return (
                          <div key={userResult.uid} className="flex items-center justify-between p-2 bg-slate-950 rounded-lg text-xs gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={userResult.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userResult.username || userResult.displayName)}`}
                                alt={userResult.username || userResult.displayName}
                                className="w-7 h-7 rounded-lg object-cover shrink-0"
                              />
                              <div className="truncate min-w-0">
                                <p className="font-bold text-white truncate">{userResult.username || userResult.displayName}</p>
                                <p className="text-[9px] text-slate-500 font-mono mt-0.5">{rank} · {userResult.totalSolves ?? 0} solves</p>
                              </div>
                            </div>
                            {isFriend ? (
                              <button
                                onClick={() => handleRemoveFriend(userResult.uid)}
                                className="shrink-0 px-2.5 py-1 bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 rounded-lg text-[9px] font-bold transition cursor-pointer"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAddFriend(userResult.uid)}
                                className="shrink-0 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[9px] font-bold transition cursor-pointer"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Period tabs */}
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-800/80">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => {
                  if (p !== 'all' && !user) { loginWithGoogle(); return; }
                  setPeriod(p);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                  period === p
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                    : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                } ${p !== 'all' && !user ? 'opacity-50' : ''}`}
              >
                {PERIOD_LABELS[p]}
                {p !== 'all' && !user && <span className="ml-1 text-[9px]">🔒</span>}
              </button>
            ))}
          </div>
        </header>

        {/* Group mode with no groups */}
        {mode === 'group' && user && groups.length === 0 && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-10 text-center space-y-3">
            <div className="text-4xl">🏢</div>
            <p className="text-white font-bold">You're not in any groups yet.</p>
            <a href="/groups" className="text-indigo-400 hover:underline text-sm font-semibold">Create or join a group →</a>
          </div>
        )}

        {/* Friends mode with no friends */}
        {mode === 'friends' && user && friendUids.length === 0 && (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-10 text-center space-y-3">
            <div className="text-4xl">👥</div>
            <p className="text-white font-bold">You haven't added any friends yet.</p>
            <p className="text-xs text-slate-400">Search for users using the quick bar above or go to the dedicated Friends page.</p>
            <a href="/friends" className="inline-block text-indigo-400 hover:underline text-sm font-semibold">Go to Friends Page →</a>
          </div>
        )}

        {/* Table */}
        {!(mode === 'group' && user && groups.length === 0) && !(mode === 'friends' && user && friendUids.length === 0) && (
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl overflow-hidden relative">

            {/* Column headers */}
            <div className="grid grid-cols-[40px_1fr_100px_80px_80px_80px] gap-3 items-center px-5 py-3.5 border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>#</span>
              <span>Participant</span>
              <span className="text-right">Rank</span>
              <span className="text-right">Solves</span>
              <span className="text-right">Hours</span>
              <span className="text-right">XP</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center gap-3 py-20 text-slate-500">
                <div className="w-10 h-10 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-sm font-mono">Loading rankings…</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-16 text-center text-slate-500 italic text-sm">
                {period !== 'all' ? 'No activity in this time period.' : 'No users yet.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-800/30">
                {rows.map((row, idx) => {
                  const isCurrentUser  = row.profile.uid === user?.uid;
                  const blurForGuest   = isGuest && idx >= GUEST_VISIBLE;
                  const rank           = getRank(row.profile.xp ?? 0);

                  return (
                    <div
                      key={row.profile.uid}
                      className={`grid grid-cols-[40px_1fr_100px_80px_80px_80px] gap-3 items-center px-5 py-4 transition ${
                        isCurrentUser ? 'bg-indigo-500/5 border-l-4 border-l-indigo-500' : 'hover:bg-slate-900/20'
                      } ${blurForGuest ? 'blur-sm select-none pointer-events-none' : ''}`}
                    >
                      {/* Rank number */}
                      <div className="font-extrabold text-center text-base">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (
                          <span className="text-slate-500 font-mono text-xs">{idx + 1}</span>
                        )}
                      </div>

                      {/* Avatar + Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={row.profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.profile.username || row.profile.displayName)}&background=1e293b&color=94a3b8`}
                          alt={row.profile.username || row.profile.displayName}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-800 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className={`text-sm font-bold truncate ${isCurrentUser ? 'text-indigo-300' : 'text-white'}`}>
                            {row.profile.username || row.profile.displayName}
                            {isCurrentUser && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-bold uppercase">You</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{row.profile.streak ?? 0}🔥 streak</div>
                        </div>
                      </div>

                      {/* Rank badge */}
                      <div className="text-right">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                          {rank}
                        </span>
                      </div>

                      {/* Solves */}
                      <div className="text-right font-mono text-sm text-slate-200 font-bold">{row.periodSolves}</div>

                      {/* Hours */}
                      <div className="text-right font-mono text-sm text-slate-400">{row.periodHours}h</div>

                      {/* XP */}
                      <div className="text-right font-mono text-lg font-extrabold text-emerald-400">
                        {row.periodXP}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Guest blur overlay */}
            {isGuest && rows.length > GUEST_VISIBLE && (
              <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-950 to-transparent flex flex-col items-center justify-end pb-6 gap-3">
                <p className="text-sm font-semibold text-slate-300">Sign in to see the full leaderboard</p>
                <button
                  onClick={loginWithGoogle}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl shadow-lg transition text-sm cursor-pointer"
                >
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current user rank indicator (if signed in and off top) */}
        {user && currentUserIdx >= 10 && rows.length > 0 && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl px-5 py-4 flex items-center justify-between">
            <span className="text-sm text-indigo-300 font-semibold">
              Your rank: <strong className="font-mono text-white">#{currentUserIdx + 1}</strong> this period
            </span>
            <span className="text-sm font-mono text-emerald-400 font-bold">
              {rows[currentUserIdx]?.periodXP ?? 0} XP
            </span>
          </div>
        )}

      </div>
    </div>
  );
};

export default LeaderboardPage;
