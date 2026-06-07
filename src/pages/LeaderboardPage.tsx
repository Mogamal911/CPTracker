// src/pages/LeaderboardPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';
import { useFriends } from '../hooks/useFriends';
import { searchUsersByUsername } from '../services/friendService';
import { getRank } from '../lib/xp';
import { RankBadge } from '../components/RankBadge';
import type { UserProfile, SolveLog } from '../types';

// ─── Types ────────────────────────────────────────────────────────
type Period = 'today' | 'week' | 'month' | 'year' | 'all';
type Mode   = 'global' | 'friends' | 'group';

interface LeaderboardRow {
  profile:      UserProfile;
  periodXP:     number;
  periodSolves: number;
  periodHours:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────
function getCutoff(period: Period): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  const copy = new Date(now);
  if (period === 'today')  { copy.setHours(0, 0, 0, 0); }
  else if (period === 'week')  { copy.setDate(now.getDate() - 7); }
  else if (period === 'month') { copy.setMonth(now.getMonth() - 1); }
  else if (period === 'year')  { copy.setFullYear(now.getFullYear() - 1); }
  return copy;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year', all: 'All Time',
};

// ── Rank snapshot helpers ─────────────────────────────────────────
function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadYesterdaySnapshot(period: Period, mode: Mode): Record<string, number> | null {
  try {
    const key = `lbSnapshot_${getYesterdayKey()}_${period}_${mode}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveTodaySnapshot(rows: LeaderboardRow[], period: Period, mode: Mode) {
  try {
    const key = `lbSnapshot_${getTodayKey()}_${period}_${mode}`;
    const data: Record<string, number> = {};
    rows.forEach((r, i) => { data[r.profile.uid] = i + 1; });
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore */ }
}

// ── Podium section ────────────────────────────────────────────────
function PodiumSection({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length < 3) return null;

  const second = rows[1];
  const first  = rows[0];
  const third  = rows[2];

  const PodiumEntry = ({
    row, rank, avatarSize, nameSize, blockClass, borderColor
  }: {
    row: LeaderboardRow; rank: 1|2|3; avatarSize: number; nameSize: number; blockClass: string; borderColor: string;
  }) => (
    <div className="podium-entry">
      {rank === 1 && (
        <div className="podium-entry__crown">
          <i className="ti ti-crown" style={{ color: 'var(--warning)', fontSize: '1.25rem' }} />
        </div>
      )}
      <img
        src={row.profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.profile.username || row.profile.displayName)}&background=21262D&color=E6EDF3`}
        alt={row.profile.username || row.profile.displayName}
        className="podium-entry__avatar"
        style={{ width: avatarSize, height: avatarSize, borderColor }}
      />
      <div className="podium-entry__name" style={{ fontSize: nameSize }}>{row.profile.username || row.profile.displayName}</div>
      <div className="podium-entry__xp">{row.periodXP} XP</div>
      <div className={`podium-block ${blockClass}`}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(0,0,0,0.35)' }}>#{rank}</span>
      </div>
    </div>
  );

  return (
    <div className="podium-section">
      <PodiumEntry row={second} rank={2} avatarSize={40} nameSize={12} blockClass="podium-block--2" borderColor="#888780" />
      <PodiumEntry row={first}  rank={1} avatarSize={44} nameSize={13} blockClass="podium-block--1" borderColor="#EF9F27" />
      <PodiumEntry row={third}  rank={3} avatarSize={36} nameSize={12} blockClass="podium-block--3" borderColor="#1D9E75" />
    </div>
  );
}

// ── Rank change indicator ─────────────────────────────────────────
function RankChange({ current, yesterday }: { current: number; yesterday: number | undefined }) {
  if (yesterday === undefined) return <span className="rank-change rank-change--same"><i className="ti ti-minus" /></span>;
  if (current < yesterday) return <span className="rank-change rank-change--up"><i className="ti ti-arrow-up" /></span>;
  if (current > yesterday) return <span className="rank-change rank-change--down"><i className="ti ti-arrow-down" /></span>;
  return <span className="rank-change rank-change--same"><i className="ti ti-minus" /></span>;
}

// ─── Component ────────────────────────────────────────────────────
export const LeaderboardPage = () => {
  const { user, isGuest, loginWithGoogle } = useAuth();
  const { groups } = useGroups();
  const { friendUids, addFriend, removeFriend } = useFriends();

  const [mode,            setMode]            = useState<Mode>('global');
  const [period,          setPeriod]          = useState<Period>('week');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const [allUsers,      setAllUsers]      = useState<UserProfile[]>([]);
  const [periodSolves,  setPeriodSolves]  = useState<SolveLog[]>([]);
  const [loadingUsers,  setLoadingUsers]  = useState(true);
  const [loadingSolves, setLoadingSolves] = useState(false);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching,     setSearching]     = useState(false);

  // Yesterday snapshot for rank change indicators
  const [yesterdaySnapshot, setYesterdaySnapshot] = useState<Record<string, number> | null>(null);

  const [guestSolves, setGuestSolves] = useState<SolveLog[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cptracker_guest_solves');
      if (raw) {
        setGuestSolves(JSON.parse(raw));
      }
    } catch (e) {
      console.error('Error loading guest solves on Leaderboard:', e);
    }
  }, []);

  const guestProfile = useMemo(() => {
    if (user) return null;
    let totalXP = 0;
    let solvesCount = 0;
    let hoursCount = 0;
    guestSolves.forEach(s => {
      totalXP += s.xpEarned || 0;
      if (s.accepted) solvesCount++;
      hoursCount += s.totalTime / 60;
    });

    const prof: UserProfile = {
      uid: 'guest',
      displayName: 'Guest (You)',
      username: 'guest_you',
      photoURL: '',
      xp: totalXP,
      totalSolves: solvesCount,
      totalHours: hoursCount,
      rank: 'Newbie',
      teams: [],
      streak: 0,
      weeklyProblems: 0,
      weeklyHours: 0,
      badges: [],
    };
    return prof;
  }, [user, guestSolves]);

  useEffect(() => {
    if (mode === 'group' && !selectedGroupId && groups.length > 0) {
      setSelectedGroupId(groups[0].teamId);
    }
  }, [mode, groups, selectedGroupId]);

  useEffect(() => {
    setLoadingUsers(true);
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => d.data() as UserProfile));
      setLoadingUsers(false);
    }, (err) => { console.error('Error loading users:', err); setLoadingUsers(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (period === 'all' || (!user && !isGuest)) { setPeriodSolves([]); return; }
    const cutoff = getCutoff(period);
    if (!cutoff) { setPeriodSolves([]); return; }
    setLoadingSolves(true);
    const q = query(collection(db, 'solves'), where('solvedAt', '>=', Timestamp.fromDate(cutoff)));
    const unsub = onSnapshot(q, (snap) => {
      setPeriodSolves(snap.docs.map(d => d.data() as SolveLog));
      setLoadingSolves(false);
    }, (err) => { console.error('Error loading period solves:', err); setLoadingSolves(false); });
    return () => unsub();
  }, [period, user, isGuest]);

  useEffect(() => {
    setYesterdaySnapshot(loadYesterdaySnapshot(period, mode));
  }, [period, mode]);

  // Debounced friend search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery);
        setSearchResults(results.filter(r => r.uid !== user?.uid));
      } catch (err) { console.error('Search error:', err); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(delay);
  }, [searchQuery, user?.uid]);

  const handleAddFriend    = async (uid: string) => { try { await addFriend(uid); } catch (err: any) { alert(err.message || 'Failed'); } };
  const handleRemoveFriend = async (uid: string) => { try { await removeFriend(uid); } catch (err: any) { alert(err.message || 'Failed'); } };

  // ── Build rows ───────────────────────────────────────────────────
  const rows: LeaderboardRow[] = useMemo(() => {
    let filteredUsers = allUsers;
    if (mode === 'group' && selectedGroupId) {
      const group = groups.find(g => g.teamId === selectedGroupId);
      if (group) filteredUsers = allUsers.filter(u => group.members.includes(u.uid));
    } else if (mode === 'friends') {
      filteredUsers = allUsers.filter(u => u.uid === user?.uid || friendUids.includes(u.uid));
    }
    
    if (guestProfile && mode === 'global') {
      filteredUsers = [...filteredUsers, guestProfile];
    }
    
    if (filteredUsers.length === 0) return [];

    if (period === 'all') {
      return filteredUsers
        .sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0))
        .map(p => ({ profile: p, periodXP: p.xp ?? 0, periodSolves: p.totalSolves ?? 0, periodHours: Math.round((p.totalHours ?? 0) * 10) / 10 }));
    }

    const statsMap: Record<string, { xp: number; solves: number; hours: number }> = {};
    
    // Add guest solves stats
    if (guestProfile) {
      const cutoff = getCutoff(period);
      const cutoffMs = cutoff ? cutoff.getTime() : 0;
      
      guestSolves.forEach(s => {
        let ms = 0;
        if (s.solvedAt && (s.solvedAt as any).seconds) {
          ms = (s.solvedAt as any).seconds * 1000;
        } else {
          ms = new Date(s.solvedAt as any).getTime();
        }
        if (ms >= cutoffMs) {
          if (!statsMap['guest']) statsMap['guest'] = { xp: 0, solves: 0, hours: 0 };
          statsMap['guest'].xp += s.xpEarned ?? 0;
          if (s.accepted) statsMap['guest'].solves += 1;
          statsMap['guest'].hours += (s.totalTime ?? 0) / 60;
        }
      });
    }

    periodSolves.forEach(s => {
      if (!statsMap[s.userId]) statsMap[s.userId] = { xp: 0, solves: 0, hours: 0 };
      statsMap[s.userId].xp += s.xpEarned ?? 0;
      if (s.accepted ?? (s as any).solved ?? false) statsMap[s.userId].solves += 1;
      statsMap[s.userId].hours += (s.totalTime ?? 0) / 60;
    });

    return filteredUsers
      .filter(p => statsMap[p.uid] !== undefined)
      .map(p => ({
        profile: p,
        periodXP:     statsMap[p.uid]?.xp ?? 0,
        periodSolves: statsMap[p.uid]?.solves ?? 0,
        periodHours:  Math.round((statsMap[p.uid]?.hours ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.periodXP - a.periodXP);
  }, [allUsers, periodSolves, mode, selectedGroupId, period, friendUids, user?.uid, groups, guestProfile, guestSolves]);

  // Save today's snapshot whenever rows change
  useEffect(() => {
    if (rows.length > 0) saveTodaySnapshot(rows, period, mode);
  }, [rows, period, mode]);

  const loading = loadingUsers || loadingSolves;
  const currentUserIdx = rows.findIndex(r => r.profile.uid === (user?.uid || 'guest'));
  const GUEST_VISIBLE = 3;

  // rows.length >= 3 shows the podium above the table

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 896, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div className="cp-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>Leaderboard</h1>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Rankings by XP earned in the selected period</p>
              </div>

              {/* Mode toggle */}
              <div style={{ display: 'flex', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, gap: 2 }}>
                {(['global', 'friends', 'group'] as Mode[]).map(m => (
                  <button key={m}
                    onClick={() => { if (m !== 'global' && !user) { loginWithGoogle(); return; } setMode(m); }}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: mode === m ? 'var(--accent)' : 'transparent',
                      color: mode === m ? 'white' : 'var(--text-secondary)',
                      transition: 'all 0.15s', textTransform: 'capitalize',
                    }}
                  >
                    {m === 'global' ? '🌐 Global' : m === 'friends' ? '👥 Friends' : '🏢 Group'}
                  </button>
                ))}
              </div>
            </div>

            {/* Group selector */}
            {mode === 'group' && user && groups.length > 0 && (
              <select
                value={selectedGroupId ?? ''}
                onChange={e => setSelectedGroupId(e.target.value)}
                className="cp-input" style={{ maxWidth: 280 }}
              >
                {groups.map(g => <option key={g.teamId} value={g.teamId}>{g.name}</option>)}
              </select>
            )}

            {/* Friend search */}
            {user && (
              <div style={{ position: 'relative', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <input
                  type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search users by username to add them..."
                  className="cp-input"
                />
                {searchQuery.trim() && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, zIndex: 30, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                    {searching ? (
                      <div style={{ textAlign: 'center', padding: '1rem', fontSize: 12, color: 'var(--text-secondary)' }}>Searching…</div>
                    ) : searchResults.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1rem', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No users found</div>
                    ) : searchResults.map(u => {
                      const isFriend = friendUids.includes(u.uid);
                      return (
                        <div key={u.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderRadius: 8, gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <img src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username || u.displayName)}`}
                              alt={u.username || u.displayName}
                              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username || u.displayName}</p>
                              <p style={{ fontSize: 10, color: 'var(--text-secondary)', margin: '2px 0 0', fontFamily: 'monospace' }}>{getRank(u.xp ?? 0)} · {u.totalSolves ?? 0} solves</p>
                            </div>
                          </div>
                          {isFriend ? (
                            <button onClick={() => handleRemoveFriend(u.uid)} style={{ padding: '3px 10px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--danger)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
                          ) : (
                            <button onClick={() => handleAddFriend(u.uid)} style={{ padding: '3px 10px', background: 'var(--accent)', color: 'white', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Period tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                <button key={p}
                  onClick={() => { if (p !== 'all' && !user) { loginWithGoogle(); return; } setPeriod(p); }}
                  style={{
                    padding: '6px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: period === p ? 'rgba(29,158,117,0.1)' : 'transparent',
                    border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
                    color: period === p ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                    opacity: p !== 'all' && !user ? 0.5 : 1,
                  }}
                >
                  {PERIOD_LABELS[p]}
                  {p !== 'all' && !user && <span style={{ marginLeft: 4, fontSize: 9 }}>🔒</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Empty states */}
        {mode === 'group' && user && groups.length === 0 && (
          <div className="cp-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏢</div>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>You're not in any groups yet.</p>
            <a href="/groups" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>Create or join a group →</a>
          </div>
        )}

        {mode === 'friends' && user && friendUids.length === 0 && (
          <div className="cp-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👥</div>
            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>You haven't added any friends yet.</p>
            <a href="/friends" style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 600 }}>Go to Friends Page →</a>
          </div>
        )}

        {/* Podium */}
        {!(mode === 'group' && user && groups.length === 0) &&
         !(mode === 'friends' && user && friendUids.length === 0) &&
         !loading && <PodiumSection rows={rows} />}

        {/* Table */}
        {!(mode === 'group' && user && groups.length === 0) &&
         !(mode === 'friends' && user && friendUids.length === 0) && (
          <div className="cp-card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>

            {/* Column headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 110px 70px 70px 70px', gap: '0.75rem', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
              <span>#</span><span>Participant</span><span style={{ textAlign: 'right' }}>Rank</span>
              <span style={{ textAlign: 'right' }}>Solves</span><span style={{ textAlign: 'right' }}>Hours</span><span style={{ textAlign: 'right' }}>XP</span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '5rem 0', color: 'var(--text-secondary)' }}>
                <div style={{ width: 40, height: 40, border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 14, fontFamily: 'monospace' }}>Loading rankings…</span>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>
                {period !== 'all' ? 'No activity in this time period.' : 'No users yet.'}
              </div>
            ) : (
              <div style={{ borderTop: 'none' }}>
                {/* Top 3 rows (shown inline when no podium, or always show all to not confuse) */}
                {rows.map((row, idx) => {
                  const isCurrentUser = row.profile.uid === user?.uid;
                  const blurForGuest  = isGuest && idx >= GUEST_VISIBLE;
                  const rank          = getRank(row.profile.xp ?? 0);
                  const currentPos    = idx + 1;
                  const yestPos       = yesterdaySnapshot?.[row.profile.uid];

                  return (
                    <div
                      key={row.profile.uid}
                      style={{
                        display: 'grid', gridTemplateColumns: '48px 1fr 110px 70px 70px 70px',
                        gap: '0.75rem', alignItems: 'center', padding: '14px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: isCurrentUser ? 'rgba(29,158,117,0.04)' : 'transparent',
                        borderLeft: isCurrentUser ? '3px solid var(--accent)' : '3px solid transparent',
                        filter: blurForGuest ? 'blur(4px)' : 'none',
                        userSelect: blurForGuest ? 'none' : 'auto',
                        pointerEvents: blurForGuest ? 'none' : 'auto',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Position + rank change */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 800, fontSize: 13 }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (
                          <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12 }}>{idx + 1}</span>
                        )}
                        <RankChange current={currentPos} yesterday={yestPos} />
                      </div>

                      {/* Avatar + Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <img
                          src={row.profile.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.profile.username || row.profile.displayName)}&background=21262D&color=94a3b8`}
                          alt={row.profile.username || row.profile.displayName}
                          style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isCurrentUser ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {row.profile.username || row.profile.displayName}
                            {isCurrentUser && (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(29,158,117,0.15)', color: 'var(--accent)', border: '1px solid rgba(29,158,117,0.3)', fontWeight: 700, textTransform: 'uppercase' }}>You</span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 1 }}>
                            {row.profile.streak ?? 0}🔥 streak
                          </div>
                        </div>
                      </div>

                      {/* Rank badge */}
                      <div style={{ textAlign: 'right' }}>
                        <RankBadge rank={rank} size="sm" />
                      </div>

                      {/* Solves */}
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{row.periodSolves}</div>

                      {/* Hours */}
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{row.periodHours}h</div>

                      {/* XP */}
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>{row.periodXP}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Guest blur overlay */}
            {isGuest && rows.length > GUEST_VISIBLE && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 192, background: 'linear-gradient(to top, var(--bg-page), transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 24, gap: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Sign in to see the full leaderboard</p>
                <button onClick={loginWithGoogle} style={{ padding: '10px 24px', background: 'white', color: '#1C2128', fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                  Sign in with Google
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current user rank indicator */}
        {user && currentUserIdx >= 10 && rows.length > 0 && (
          <div style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>
              Your rank: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>#{currentUserIdx + 1}</strong> this period
            </span>
            <span style={{ fontSize: 14, fontFamily: 'monospace', color: 'var(--success)', fontWeight: 700 }}>
              {rows[currentUserIdx]?.periodXP ?? 0} XP
            </span>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default LeaderboardPage;
