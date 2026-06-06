import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFriends } from '../hooks/useFriends';
import { searchUsersByUsername } from '../services/friendService';
import { getRank } from '../lib/xp';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

export const FriendsPage = () => {
  const { user } = useAuth();
  const { friendUids, loading: friendsLoading, addFriend, removeFriend } = useFriends();

  const [friendsProfiles, setFriendsProfiles] = useState<UserProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  // Fetch profiles for the friendUids list
  useEffect(() => {
    if (friendUids.length === 0) {
      setFriendsProfiles([]);
      return;
    }

    setLoadingProfiles(true);
    const usersRef = collection(db, 'users');
    const chunkSize = 30;
    const chunks: string[][] = [];
    for (let i = 0; i < friendUids.length; i += chunkSize) {
      chunks.push(friendUids.slice(i, i + chunkSize));
    }

    Promise.all(
      chunks.map(chunk =>
        getDocs(query(usersRef, where('uid', 'in', chunk)))
          .then(snap => snap.docs.map(doc => doc.data() as UserProfile))
      )
    )
      .then(results => {
        const flat = results.flat();
        flat.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        setFriendsProfiles(flat);
        setLoadingProfiles(false);
      })
      .catch(err => {
        console.error('Error fetching friends profiles:', err);
        setLoadingProfiles(false);
      })
      .finally(() => {
        setLoadingProfiles(false);
      });
  }, [friendUids]);

  // Handle prefix search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery);
        // Exclude current user from search results
        const filtered = results.filter(r => r.uid !== user?.uid);
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [searchQuery, user?.uid]);

  const handleAdd = async (uid: string) => {
    try {
      await addFriend(uid);
    } catch (err: any) {
      alert(err.message || 'Failed to add friend');
    }
  };

  const handleRemove = async (uid: string) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    try {
      await removeFriend(uid);
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md space-y-4">
          <span className="text-4xl">🔒</span>
          <h2 className="text-lg font-bold text-white">Sign In Required</h2>
          <p className="text-slate-400 text-sm">
            Sign in to search for programmers and build your friends list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 relative">
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <header className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Friends & Connections</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Follow programmers to compare progress and view their solves on your custom friends leaderboard.
              </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main List */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800/80 flex justify-between items-center">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Your Friends ({friendsProfiles.length})
                </h2>
              </div>

              {friendsLoading || loadingProfiles ? (
                <div className="py-20 text-center text-slate-500 italic text-sm">
                  Loading friends list...
                </div>
              ) : friendsProfiles.length === 0 ? (
                <div className="py-20 text-center text-slate-500 space-y-2">
                  <div className="text-3xl">👋</div>
                  <p className="text-sm">Search for friends by username to add them</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/40">
                  {friendsProfiles.map((friend) => {
                    const rank = getRank(friend.xp ?? 0);
                    return (
                      <div
                        key={friend.uid}
                        className="flex items-center justify-between px-6 py-4 hover:bg-slate-900/20 transition"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={friend.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(friend.username || friend.displayName)}
                            alt={friend.username || friend.displayName}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                          />
                          <div>
                            <div className="font-semibold text-white text-sm flex items-center gap-2">
                              {friend.username || friend.displayName}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold font-mono">
                                {rank}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {friend.totalSolves ?? 0} solves · {friend.streak ?? 0}🔥 streak · {friend.xp ?? 0} XP
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemove(friend.uid)}
                          className="px-3.5 py-1.5 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Search Side Panel */}
          <div className="space-y-6">
            <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Find Friends
              </h2>

              <div className="space-y-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter username prefix..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition duration-150"
                />
              </div>

              {searching ? (
                <div className="py-8 text-center text-slate-500 text-xs font-mono">
                  Searching...
                </div>
              ) : searchResults.length === 0 && searchQuery.trim() ? (
                <div className="py-8 text-center text-slate-600 text-xs italic">
                  No users match "{searchQuery}"
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((userResult) => {
                    const isFriend = friendUids.includes(userResult.uid);
                    const rank = getRank(userResult.xp ?? 0);
                    return (
                      <div
                        key={userResult.uid}
                        className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800/80 rounded-xl gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={userResult.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userResult.username || userResult.displayName)}
                            alt={userResult.username || userResult.displayName}
                            className="w-8 h-8 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {userResult.username || userResult.displayName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                              {rank} · {userResult.totalSolves ?? 0} solves
                            </p>
                          </div>
                        </div>

                        {isFriend ? (
                          <button
                            onClick={() => handleRemove(userResult.uid)}
                            className="shrink-0 px-2.5 py-1 bg-slate-900 border border-slate-800 text-rose-400 hover:bg-rose-500/10 rounded-lg text-[10px] font-bold transition cursor-pointer"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAdd(userResult.uid)}
                            className="shrink-0 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                          >
                            Add Friend
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

        </div>
      </div>
    </div>
  );
};

export default FriendsPage;
