// src/pages/FriendsPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFriends } from '../hooks/useFriends';
import { searchUsersByUsername } from '../services/friendService';
import { getRank } from '../lib/xp';
import { RankBadge } from '../components/RankBadge';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

export const FriendsPage = () => {
  const { user } = useAuth();
  const { friendUids, loading: friendsLoading, addFriend, removeFriend } = useFriends();

  const [friendsProfiles, setFriendsProfiles] = useState<UserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching,     setSearching]     = useState(false);

  useEffect(() => {
    if (friendUids.length === 0) { setFriendsProfiles([]); return; }
    setLoadingProfiles(true);
    const usersRef = collection(db, 'users');
    const chunks: string[][] = [];
    for (let i = 0; i < friendUids.length; i += 30) chunks.push(friendUids.slice(i, i + 30));

    Promise.all(chunks.map(chunk => getDocs(query(usersRef, where('uid', 'in', chunk))).then(s => s.docs.map(d => d.data() as UserProfile))))
      .then(results => {
        const flat = results.flat();
        flat.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        setFriendsProfiles(flat);
      })
      .catch(err => console.error('Error fetching friends profiles:', err))
      .finally(() => setLoadingProfiles(false));
  }, [friendUids]);

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

  const handleAdd    = async (uid: string) => { try { await addFriend(uid); } catch (err: any) { alert(err.message || 'Failed to add friend'); } };
  const handleRemove = async (uid: string) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try { await removeFriend(uid); } catch (err: any) { alert(err.message || 'Failed to remove friend'); }
  };

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', maxWidth: 400 }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '12px 0 8px' }}>Sign In Required</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>Sign in to search for programmers and build your friends list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1024, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div className="cp-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            <i className="ti ti-users" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Friends &amp; Connections</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Follow programmers to compare progress and view their solves on your custom friends leaderboard.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>

            {/* Friends list */}
            <div className="cp-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>
                  Your Friends ({friendsProfiles.length})
                </h2>
              </div>

              {friendsLoading || loadingProfiles ? (
                <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>Loading…</div>
              ) : friendsProfiles.length === 0 ? (
                <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
                  <p style={{ fontSize: 14, margin: 0 }}>Search for friends by username to add them</p>
                </div>
              ) : (
                <div>
                  {friendsProfiles.map(friend => {
                    const rank = getRank(friend.xp ?? 0);
                    return (
                      <div key={friend.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <img
                            src={friend.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(friend.username || friend.displayName)}
                            alt={friend.username || friend.displayName}
                            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              {friend.username || friend.displayName}
                              <RankBadge rank={rank} size="sm" />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {friend.totalSolves ?? 0} solves · {friend.streak ?? 0}🔥 streak · {friend.xp ?? 0} XP
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(friend.uid)}
                          style={{ padding: '6px 14px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                          onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(226,75,74,0.3)'; }}
                          onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search panel */}
            <div className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>Find Friends</h2>

              <input
                type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Enter username prefix..."
                className="cp-input"
              />

              {searching ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Searching…</div>
              ) : searchResults.length === 0 && searchQuery.trim() ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No users match "{searchQuery}"</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchResults.map(userResult => {
                    const isFriend = friendUids.includes(userResult.uid);
                    const rank = getRank(userResult.xp ?? 0);
                    return (
                      <div key={userResult.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: 10, gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <img
                            src={userResult.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userResult.username || userResult.displayName)}
                            alt={userResult.username || userResult.displayName}
                            style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {userResult.username || userResult.displayName}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <RankBadge rank={rank} size="sm" />
                              <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{userResult.totalSolves ?? 0} solves</span>
                            </div>
                          </div>
                        </div>
                        {isFriend ? (
                          <button onClick={() => handleRemove(userResult.uid)} style={{ padding: '4px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--danger)', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Remove</button>
                        ) : (
                          <button onClick={() => handleAdd(userResult.uid)} style={{ padding: '4px 10px', background: 'var(--accent)', color: 'white', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Add Friend</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
