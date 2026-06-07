// src/pages/PublicProfilePage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { getRank } from '../lib/xp';
import RankBadge from '../components/RankBadge';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { BadgeShelf } from '../components/BadgeShelf';
import {
  getUserByUsername,
  checkFollowing,
  checkFriendship,
  checkPendingRequest,
  followUser,
  unfollowUser,
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  denyFriendRequest,
  removeFriend
} from '../services/friendService';
import type { UserProfile, SolveLog } from '../types';

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile, loginWithGoogle } = useAuth();

  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [solves, setSolves] = useState<SolveLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Relations state
  const [following, setFollowing] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [updatingRelation, setUpdatingRelation] = useState(false);

  // Guest Auth Intercept Modal
  const [showGuestAuth, setShowGuestAuth] = useState(false);

  // Fetch target user by username
  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    getUserByUsername(username)
      .then((resUser) => {
        if (!resUser) {
          setError('User not found.');
          setLoading(false);
          return;
        }
        setTargetUser(resUser);
        
        // Fetch their solves
        const q = query(collection(db, 'solves'), where('userId', '==', resUser.uid));
        const unsubSolves = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => d.data() as SolveLog);
          list.sort((a, b) => getMillis(b.solvedAt) - getMillis(a.solvedAt));
          setSolves(list);
          setLoading(false);
        }, (err) => {
          console.error(err);
          setLoading(false);
        });

        return () => unsubSolves();
      })
      .catch((err) => {
        console.error(err);
        setError('Error loading profile.');
        setLoading(false);
      });
  }, [username]);

  // Fetch relations if logged in
  useEffect(() => {
    if (!user || !targetUser) return;

    const checkRelations = async () => {
      try {
        const isFollow = await checkFollowing(user.uid, targetUser.uid);
        const isFr = await checkFriendship(user.uid, targetUser.uid);
        const req = await checkPendingRequest(user.uid, targetUser.uid);

        setFollowing(isFollow);
        setIsFriend(isFr);
        setRequest(req);
      } catch (err) {
        console.error('Error checking relations:', err);
      }
    };

    checkRelations();
  }, [user, targetUser]);

  const handleFollowAction = async () => {
    if (!user) {
      setShowGuestAuth(true);
      return;
    }
    if (!targetUser || updatingRelation) return;
    setUpdatingRelation(true);
    try {
      if (following) {
        await unfollowUser(user.uid, targetUser.uid);
        setFollowing(false);
      } else {
        await followUser(user.uid, targetUser.uid);
        setFollowing(true);
      }
    } catch (err: any) {
      alert(err.message || 'Error updating follow');
    } finally {
      setUpdatingRelation(false);
    }
  };

  const handleFriendAction = async () => {
    if (!user) {
      setShowGuestAuth(true);
      return;
    }
    if (!targetUser || !currentUserProfile || updatingRelation) return;
    setUpdatingRelation(true);
    try {
      const meName = currentUserProfile.username || currentUserProfile.displayName || user.displayName || 'User';
      const mePhoto = currentUserProfile.photoURL || '';

      if (isFriend) {
        if (window.confirm(`Unfriend ${targetUser.username || targetUser.displayName}?`)) {
          await removeFriend(user.uid, targetUser.uid);
          setIsFriend(false);
        }
      } else if (request?.isPending) {
        if (request.fromMe) {
          // Cancel request
          await cancelFriendRequest(request.requestId, targetUser.uid);
          setRequest(null);
        } else {
          // Accept request from targetUser
          await acceptFriendRequest(request.requestId, user.uid, targetUser.uid);
          setIsFriend(true);
          setRequest(null);
        }
      } else {
        // Send request
        await sendFriendRequest(user.uid, targetUser.uid, meName, mePhoto);
        const req = await checkPendingRequest(user.uid, targetUser.uid);
        setRequest(req);
      }
    } catch (err: any) {
      alert(err.message || 'Error updating friend status');
    } finally {
      setUpdatingRelation(false);
    }
  };

  const handleDenyRequest = async () => {
    if (!user || !targetUser || updatingRelation) return;
    setUpdatingRelation(true);
    try {
      if (request?.isPending && !request.fromMe) {
        await denyFriendRequest(request.requestId, user.uid);
        setRequest(null);
      }
    } catch (err: any) {
      alert(err.message || 'Error denying request');
    } finally {
      setUpdatingRelation(false);
    }
  };

  const getMillis = (t: any): number => {
    if (!t) return 0;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (t.seconds) return t.seconds * 1000;
    return new Date(t).getTime();
  };

  const formatDate = (t: any): string => {
    const ms = getMillis(t);
    if (ms === 0) return 'N/A';
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="page-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      </div>
    );
  }

  if (error || !targetUser) {
    return (
      <div className="page-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <div style={{ fontSize: 48 }}>👤</div>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{error || 'User not found.'}</h2>
        <button className="btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  const isSelf = user?.uid === targetUser.uid;
  const currentRank = getRank(targetUser.xp ?? 0);
  const solvesCount = targetUser.totalSolves ?? 0;
  const hoursCount = Math.round((targetUser.totalHours ?? 0) * 10) / 10;

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1024, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Header/Hero Profile card */}
        <div className="hero-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {targetUser.photoURL ? (
              <img
                src={targetUser.photoURL}
                alt={targetUser.displayName}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
              />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-surface-2)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👤</div>
            )}
            <RankBadge rank={currentRank} size="sm" />
          </div>

          <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              {targetUser.username || targetUser.displayName}
            </h2>
            {targetUser.bio && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.4, maxWidth: '540px' }}>
                {targetUser.bio}
              </p>
            )}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
              <div>🔥 <strong style={{ color: 'var(--text-primary)' }}>{targetUser.streak ?? 0}</strong> day streak</div>
              <div>⭐ <strong style={{ color: 'var(--text-primary)' }}>{targetUser.xp ?? 0}</strong> total XP</div>
            </div>
          </div>

          {!isSelf && (
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
              <button
                onClick={handleFollowAction}
                disabled={updatingRelation}
                className={following ? 'btn-secondary' : 'btn-primary'}
                style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
              >
                {following ? 'Following' : 'Follow'}
              </button>

              {isFriend ? (
                <button
                  onClick={handleFriendAction}
                  disabled={updatingRelation}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--danger)', borderColor: 'rgba(226,75,74,0.1)' }}
                >
                  Unfriend
                </button>
              ) : request?.isPending ? (
                request.fromMe ? (
                  <button
                    onClick={handleFriendAction}
                    disabled={updatingRelation}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
                  >
                    Requested
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={handleFriendAction}
                      disabled={updatingRelation}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={handleDenyRequest}
                      disabled={updatingRelation}
                      className="btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
                    >
                      Deny
                    </button>
                  </div>
                )
              ) : (
                <button
                  onClick={handleFriendAction}
                  disabled={updatingRelation}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
                >
                  Add Friend
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Total Problems', value: solvesCount, icon: 'ti-chart-bar' },
            { label: 'Total Hours Worked', value: hoursCount, icon: 'ti-clock' }
          ].map(({ label, value, icon }) => (
            <div key={label} className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <i className={`ti ${icon}`} style={{ fontSize: 14 }} />
                {label}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {value}
              </div>
            </div>
          ))}
        </section>

        {/* Heatmap Section */}
        <section className="cp-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
            Activity Heatmap
          </h3>
          <ActivityHeatmap solves={solves} />
        </section>

        {/* Badge Shelf */}
        <section className="cp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <BadgeShelf unlockedIds={targetUser.badges ?? []} />
        </section>

        {/* Recent Solves Feed */}
        <section className="cp-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', marginTop: 0 }}>
            Solve History
          </h3>
          {solves.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>
              No solves logged by this coder.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {solves.slice(0, 10).map(solve => (
                <div
                  key={solve.solveId}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{
                      flexShrink: 0, fontSize: 11, padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase',
                      background: solve.platform === 'codeforces' ? 'rgba(88,101,242,0.12)' : solve.platform === 'atcoder' ? 'rgba(29,158,117,0.12)' : 'rgba(239,159,39,0.12)',
                      color: solve.platform === 'codeforces' ? '#5865F2' : solve.platform === 'atcoder' ? 'var(--accent)' : 'var(--warning)',
                    }}>
                      {solve.platform === 'codeforces' ? 'CF' : solve.platform === 'atcoder' ? 'AC' : 'LC'}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      {solve.problemLink ? (
                        <a href={solve.problemLink} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {solve.problemName}
                        </a>
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{solve.problemName}</div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: 2 }}>{formatDate(solve.solvedAt)}</div>
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
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Guest Auth Warning Modal */}
      {showGuestAuth && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', padding: '1rem', pointerEvents: 'all'
        }}>
          <div className="cp-card" style={{
            position: 'relative', width: '100%', maxWidth: '380px', overflow: 'hidden', padding: 0
          }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, var(--accent), var(--success))' }} />
            <div style={{ padding: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '40px' }}>🔐</div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Sign in required</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Sign in with Google to follow this user, send friend requests, or track training together.
              </p>
              <button
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                    setShowGuestAuth(false);
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', border: 'none', cursor: 'pointer' }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="white">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign In with Google
              </button>
              <button
                onClick={() => setShowGuestAuth(false)}
                className="btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
