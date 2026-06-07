// src/pages/ProfilePage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { updateProfile } from 'firebase/auth';
import { useGroups } from '../hooks/useGroups';
import { useFriends } from '../hooks/useFriends';
import { getRank, getNextRankXP, RANKS } from '../lib/xp';
import { BadgeShelf } from '../components/BadgeShelf';
import RankBadge from '../components/RankBadge';
import ActivityHeatmap from '../components/ActivityHeatmap';
import DailyGoalCard from '../components/DailyGoalCard';
import UsernameSetupModal from '../components/UsernameSetupModal';
import {
  checkUsernameAvailable,
  validateUsername,
  claimUsername
} from '../services/usernameService';
import {
  searchUsersByUsername,
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

// Modals copied from GroupsPage for Tab 2
function CreateGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, desc: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required.'); return; }
    setLoading(true); setError(null);
    try { await onCreate(name.trim(), desc.trim()); onClose(); }
    catch (err: any) { setError(err.message || 'Failed to create group'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create a Group</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>An invite link will be generated automatically.</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text" placeholder="Group name *" value={name}
            onChange={e => setName(e.target.value)} autoFocus
            className="form-input"
          />
          <textarea
            rows={2} placeholder="Description (optional)" value={desc}
            onChange={e => setDesc(e.target.value)}
            className="form-input" style={{ resize: 'none', fontFamily: 'var(--font)' }}
          />
          {error && <div className="cp-error">{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinGroupModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Enter an invite code.'); return; }
    setLoading(true); setError(null);
    try { await onJoin(code.trim().toUpperCase()); onClose(); }
    catch (err: any) { setError(err.message || 'Failed to join group'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Join a Group</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Enter the 6-character invite code.</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text" placeholder="e.g. A1B2C3" value={code} autoFocus
            onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
            className="form-input"
            style={{ textAlign: 'center', fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' }}
          />
          {error && <div className="cp-error">{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 1 }}>
              {loading ? 'Joining…' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helpers for dates
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


export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const setTab = (tabId: string) => setSearchParams({ tab: tabId });

  const { user, profile, loginWithGoogle, logout } = useAuth();
  const { groups, createGroup, joinGroup, leaveGroup } = useGroups();
  const { friendUids } = useFriends();

  // ─── OVERVIEW TAB STATE ───────────────────────────────────────────
  const [solves, setSolves] = useState<SolveLog[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

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

  // ─── FRIENDS & GROUPS TAB STATE ───────────────────────────────────
  const [friendsProfiles, setFriendsProfiles] = useState<UserProfile[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [relations, setRelations] = useState<Record<string, { following: boolean; friendship: boolean; request: any }>>({});
  
  // Group Modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState<string | null>(null);

  // Load friends profile details
  useEffect(() => {
    if (!user || friendUids.length === 0) {
      setFriendsProfiles([]);
      return;
    }
    setLoadingFriends(true);
    const q = query(collection(db, 'users'), where('uid', 'in', friendUids.slice(0, 30)));
    const unsub = onSnapshot(q, (snap) => {
      setFriendsProfiles(snap.docs.map(d => d.data() as UserProfile));
      setLoadingFriends(false);
    }, (err) => {
      console.error('Error loading friends:', err);
      setLoadingFriends(false);
    });
    return () => unsub();
  }, [user, friendUids]);

  // Handle relations checks for search results
  const updateRelationsForResults = async (results: UserProfile[]) => {
    if (!user) return;
    const mapping: Record<string, { following: boolean; friendship: boolean; request: any }> = {};
    await Promise.all(results.map(async (res) => {
      const following = await checkFollowing(user.uid, res.uid);
      const friendship = await checkFriendship(user.uid, res.uid);
      const request = await checkPendingRequest(user.uid, res.uid);
      mapping[res.uid] = { following, friendship, request };
    }));
    setRelations(prev => ({ ...prev, ...mapping }));
  };

  // Search effect
  useEffect(() => {
    if (!searchQuery.trim() || !user) { setSearchResults([]); return; }
    setSearching(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(searchQuery);
        const filtered = results.filter(r => r.uid !== user.uid);
        setSearchResults(filtered);
        await updateRelationsForResults(filtered);
      } catch (err) {
        console.error('Search users error:', err);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(delay);
  }, [searchQuery, user]);

  const handleFollow = async (targetUid: string) => {
    if (!user) return;
    try {
      const activeRelation = relations[targetUid];
      if (activeRelation?.following) {
        await unfollowUser(user.uid, targetUid);
        setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], following: false } }));
      } else {
        await followUser(user.uid, targetUid);
        setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], following: true } }));
      }
    } catch (err: any) {
      alert(err.message || 'Error updating follow');
    }
  };

  const handleFriendAction = async (targetUid: string) => {
    if (!user || !profile) return;
    try {
      const activeRelation = relations[targetUid];
      const meName = profile.username || profile.displayName || user.displayName || 'User';
      const mePhoto = profile.photoURL || '';

      if (activeRelation?.friendship) {
        if (window.confirm('Remove friend? This ends your mutual friendship.')) {
          await removeFriend(user.uid, targetUid);
          setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], friendship: false } }));
        }
      } else if (activeRelation?.request?.isPending) {
        const req = activeRelation.request;
        if (req.fromMe) {
          // Cancel pending request
          await cancelFriendRequest(req.requestId, targetUid);
          setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], request: null } }));
        } else {
          // Accept pending request from them
          await acceptFriendRequest(req.requestId, user.uid, targetUid);
          setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], friendship: true, request: null } }));
        }
      } else {
        // Send request
        await sendFriendRequest(user.uid, targetUid, meName, mePhoto);
        // Instantly reload relations
        const requestState = await checkPendingRequest(user.uid, targetUid);
        setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], request: requestState } }));
      }
    } catch (err: any) {
      alert(err.message || 'Error updating friend state');
    }
  };

  const handleDenyFriend = async (targetUid: string) => {
    if (!user) return;
    try {
      const activeRelation = relations[targetUid];
      if (activeRelation?.request?.isPending && !activeRelation.request.fromMe) {
        await denyFriendRequest(activeRelation.request.requestId, user.uid);
        setRelations(prev => ({ ...prev, [targetUid]: { ...prev[targetUid], request: null } }));
      }
    } catch (err: any) {
      alert(err.message || 'Error denying request');
    }
  };

  const handleRemoveFriendList = async (friendUid: string) => {
    if (!user || !window.confirm('Remove friend? This ends your mutual friendship.')) return;
    try {
      await removeFriend(user.uid, friendUid);
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend');
    }
  };

  const handleCopyLink = (inviteCode: string, teamId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
    setCopied(teamId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLeaveGroup = async (teamId: string, name: string) => {
    if (!window.confirm(`Leave "${name}"?`)) return;
    setLeavingGroup(teamId);
    try { await leaveGroup(teamId); }
    catch (err: any) { alert(err.message || 'Failed to leave group'); }
    finally { setLeavingGroup(null); }
  };


  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getInitials = () => {
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    if (profile?.displayName) {
      return profile.displayName.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return 'CP';
  };
  const [usernameInput, setUsernameInput] = useState(profile?.username || '');
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [bioInput, setBioInput] = useState(profile?.bio || '');
  const [savingBio, setSavingBio] = useState(false);

  const [handleCf, setHandleCf] = useState(profile?.handle_cf || '');
  const [handleAc, setHandleAc] = useState(profile?.handle_ac || '');
  const [handleLc, setHandleLc] = useState(profile?.handle_lc || '');
  const [savingHandles, setSavingHandles] = useState(false);

  const [goalProblems, setGoalProblems] = useState(profile?.dailyGoalProblems ?? 2);
  const [goalHours, setGoalHours] = useState(profile?.dailyGoalHours ?? 1);
  const [savingGoals, setSavingGoals] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Keep setting values synced with profile updates
  useEffect(() => {
    if (profile) {
      setUsernameInput(profile.username || '');
      setBioInput(profile.bio || '');
      setHandleCf(profile.handle_cf || '');
      setHandleAc(profile.handle_ac || '');
      setHandleLc(profile.handle_lc || '');
      setGoalProblems(profile.dailyGoalProblems ?? 2);
      setGoalHours(profile.dailyGoalHours ?? 1);
    }
  }, [profile]);

  // Username validation effect
  useEffect(() => {
    if (!user) return;
    if (usernameInput.trim() === (profile?.username || '')) {
      setUsernameError(null);
      setUsernameValid(true);
      setUsernameChecking(false);
      return;
    }
    if (!usernameInput.trim()) {
      setUsernameError(null);
      setUsernameValid(false);
      setUsernameChecking(false);
      return;
    }
    const formatError = validateUsername(usernameInput);
    if (formatError) {
      setUsernameError(formatError);
      setUsernameValid(false);
      setUsernameChecking(false);
      return;
    }
    setUsernameChecking(true);
    setUsernameError(null);
    setUsernameValid(false);

    const delay = setTimeout(async () => {
      try {
        const isAvailable = await checkUsernameAvailable(usernameInput);
        if (isAvailable) {
          setUsernameValid(true);
          setUsernameError(null);
        } else {
          setUsernameError('Username is already taken.');
          setUsernameValid(false);
        }
      } catch (err) {
        setUsernameError('Error checking availability.');
        setUsernameValid(false);
      } finally {
        setUsernameChecking(false);
      }
    }, 450);

    return () => clearTimeout(delay);
  }, [usernameInput, profile?.username, user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error');
      return;
    }
    
    const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
    if (!imgbbApiKey) {
      showToast('Upload failed, try again', 'error');
      console.error('ImgBB API key is missing. Please set VITE_IMGBB_API_KEY in your environment.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('key', imgbbApiKey);

      const res = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        throw new Error(`ImgBB API returned status ${res.status}`);
      }
      
      const data = await res.json();
      const imageUrl = data?.data?.url;
      
      if (!imageUrl) {
        throw new Error('No image URL returned by ImgBB API');
      }

      await updateDoc(doc(db, 'users', user.uid), { photoURL: imageUrl });
      await updateProfile(user, { photoURL: imageUrl });
      
      showToast('Photo updated', 'success');
    } catch (error: any) {
      console.error('Upload error:', error);
      showToast('Upload failed, try again', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (usernameInput.trim() === (profile?.username || '')) return;
    if (!usernameValid) return;
    setUsernameSubmitting(true);
    try {
      await claimUsername(user.uid, usernameInput.trim(), profile?.username);
      alert('Username updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to claim username.');
    } finally {
      setUsernameSubmitting(false);
    }
  };

  const handleSaveBio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingBio(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { bio: bioInput.trim() });
      alert('Bio updated!');
    } catch (err) {
      alert('Failed to save bio.');
    } finally {
      setSavingBio(false);
    }
  };

  const handleSaveHandles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingHandles(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        handle_cf: handleCf.trim(),
        handle_ac: handleAc.trim(),
        handle_lc: handleLc.trim()
      });
      alert('Handles updated!');
    } catch (err) {
      alert('Failed to save handles.');
    } finally {
      setSavingHandles(false);
    }
  };

  const handleSaveGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingGoals(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        dailyGoalProblems: goalProblems,
        dailyGoalHours: goalHours
      });
      alert('Daily goals updated!');
    } catch (err) {
      alert('Failed to save goals.');
    } finally {
      setSavingGoals(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      if (profile?.username) {
        await deleteDoc(doc(db, 'usernames', profile.username.toLowerCase()));
      }
      await deleteDoc(doc(db, 'users', user.uid));
      await logout();
      try {
        await user.delete();
      } catch (authErr) {
        console.warn('Auth credential delete deferred; user signed out.', authErr);
      }
      navigate('/');
    } catch (err) {
      console.error('Account delete error:', err);
      alert('Failed to delete account.');
    } finally {
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  // ─── RENDERS ──────────────────────────────────────────────────────
  
  // Overview Tab
  const renderOverview = () => {
    const currentXP      = profile?.xp ?? 0;
    const currentRank    = getRank(currentXP);
    const nextRankXP     = getNextRankXP(currentXP);
    const currentRankObj = RANKS.find(r => r.name === currentRank);
    const currentMinXP   = currentRankObj ? currentRankObj.minXP : 0;
    const nextRankObj    = RANKS.find(r => r.minXP === nextRankXP);
    const nextRankName   = nextRankObj ? nextRankObj.name : 'Max';
    const xpForNextRank  = nextRankXP === -1 ? 0 : nextRankXP - currentMinXP;
    const userXPInRank   = nextRankXP === -1 ? 1 : currentXP - currentMinXP;
    const xpPercentage   = nextRankXP === -1 ? 100 : Math.min(100, Math.max(0, (userXPInRank / xpForNextRank) * 100));
    const nearRankUp = nextRankXP !== -1 && (nextRankXP - currentXP) <= 100;

    const cfSolves = solves.filter(s => s.platform === 'codeforces' && s.accepted).length;
    const acSolves = solves.filter(s => s.platform === 'atcoder'    && s.accepted).length;
    const lcSolves = solves.filter(s => s.platform === 'leetcode'   && s.accepted).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Guest Banner */}
        {!user && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 16, padding: '12px 20px', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 500, margin: 0 }}>
              ⚡ You're browsing as a guest — sign in to save progress and unlock features.
            </p>
            <button onClick={loginWithGoogle} style={{ flexShrink: 0, padding: '6px 16px', background: 'var(--accent)', color: 'white', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Sign In
            </button>
          </div>
        )}

        {/* Daily Goal Card */}
        {user && <DailyGoalCard solves={solves} />}

        {/* Hero Card */}
        {user && (
          <div className="hero-card">
            <div className="hero-card__rank-wrap">
              <div className={nearRankUp ? 'hero-card__rank-pulse' : ''} style={{ borderRadius: 12 }}>
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '2px solid var(--border)', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--bg-surface-2)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
                )}
              </div>
              <RankBadge rank={currentRank} size="md" />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span className="hero-card__username">
                  {profile?.username || profile?.displayName || user.displayName || 'Unnamed'}
                </span>
                <button
                  onClick={() => setTab('settings')}
                  style={{ background: 'var(--bg-surface-2)', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '2px 6px', color: 'var(--text-secondary)', fontSize: 11 }}
                  title="Edit Profile"
                >✏️</button>
              </div>
              {profile?.bio && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.4, maxWidth: '500px' }}>{profile.bio}</p>
              )}
              <div className="hero-card__xp-bar-wrap">
                <div className="hero-card__xp-bar-fill" style={{ width: `${xpPercentage}%` }} />
              </div>
              <div className="hero-card__rank-names">
                <span>{currentRank} ({currentMinXP} XP)</span>
                <span>{nextRankXP === -1 ? 'Max Rank' : `${nextRankName} ({nextRankXP} XP)`}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {currentXP} XP total
                {nextRankXP !== -1 && <> · <strong style={{ color: 'var(--accent)' }}>{nextRankXP - currentXP} XP</strong> to next rank</>}
              </div>
            </div>

            <div className="hero-card__right">
              <div className="stat-pill">
                <i className="ti ti-flame" style={{ color: 'var(--warning)' }} />
                <strong>{profile?.streak ?? 0}</strong>
                <span>day streak</span>
              </div>
              <div className="stat-pill">
                <i className="ti ti-check" style={{ color: 'var(--success)' }} />
                <strong>{profile?.totalSolves ?? 0}</strong>
                <span>solves</span>
              </div>
              <div className="stat-pill">
                <i className="ti ti-clock" />
                <strong>{Math.round((profile?.totalHours ?? 0) * 10) / 10}</strong>
                <span>hours</span>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Total Problems', value: user ? (profile?.totalSolves ?? 0) : 0, icon: 'ti-chart-bar' },
            { label: 'Total Hours',    value: user ? (Math.round((profile?.totalHours ?? 0) * 10) / 10) : 0, icon: 'ti-clock' },
            { label: 'Weekly Problems',value: user ? (profile?.weeklyProblems ?? 0) : 0, icon: 'ti-calendar' },
            { label: 'Weekly Hours',   value: user ? (Math.round((profile?.weeklyHours ?? 0) * 10) / 10) : 0, icon: 'ti-calendar-stats' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <i className={`ti ${icon}`} style={{ fontSize: 14 }} />
                {label}
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </div>
            </div>
          ))}
        </section>

        {/* Activity Heatmap */}
        {user && <ActivityHeatmap solves={solves} />}

        {/* Platform Splits */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: 'Codeforces', value: cfSolves, tag: 'CF', color: '#5865F2' },
            { label: 'AtCoder',    value: acSolves, tag: 'AC', color: '#1D9E75' },
            { label: 'LeetCode',   value: lcSolves, tag: 'LC', color: '#EF9F27' },
          ].map(({ label, value, tag, color }) => (
            <div key={tag} className="cp-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 800, color }}>{tag}</div>
            </div>
          ))}
        </section>

        {/* Badge Shelf */}
        {user && (
          <section className="cp-card" style={{ padding: 0, overflow: 'hidden' }}>
            <BadgeShelf unlockedIds={profile?.badges ?? []} />
          </section>
        )}

        {/* Recent Solves */}
        <section className="cp-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', marginTop: 0 }}>Recent Solves</h3>
          {solves.length === 0 ? (
            <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>
              {user ? 'No solves logged yet.' : 'Sign in to see your solves.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {solves.slice(0, 8).map(solve => (
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
    );
  };

  // Friends & Groups Tab
  const renderFriendsAndGroups = () => {
    if (!user) {
      return (
        <div className="cp-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Friends & Groups are for signed-in users</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Sign in with Google to search friends and join training groups.</p>
          <button onClick={loginWithGoogle} className="btn-primary">Sign in with Google</button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {showCreateGroup && (
          <CreateGroupModal
            onClose={() => setShowCreateGroup(false)}
            onCreate={(name, desc) => createGroup(name, desc).then(() => {})}
          />
        )}
        {showJoinGroup && (
          <JoinGroupModal
            onClose={() => setShowJoinGroup(false)}
            onJoin={(code) => joinGroup(code).then(() => {})}
          />
        )}

        {/* Search Bar */}
        <section className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>🔍 Find Users</h3>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ width: '100%' }}
            />
            {searching && (
              <div style={{ position: 'absolute', right: 12, top: 10 }}>
                <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {searchResults.map((userRes) => {
                const relation = relations[userRes.uid];
                const following = relation?.following ?? false;
                const isFriend = relation?.friendship ?? false;
                const request = relation?.request;

                return (
                  <div key={userRes.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-surface-2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div onClick={() => navigate(`/users/${userRes.username || userRes.uid}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                      <img
                        src={userRes.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userRes.username || userRes.displayName)}&background=0D1117&color=E6EDF3`}
                        alt={userRes.username || userRes.displayName}
                        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {userRes.username || userRes.displayName}
                          {isFriend && <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: 800 }}>• Friend</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <RankBadge rank={userRes.rank} size="sm" />
                          <span>· {userRes.totalSolves ?? 0} solves</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleFollow(userRes.uid)}
                        className={following ? 'btn-secondary' : 'btn-primary'}
                        style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                      >
                        {following ? 'Following' : 'Follow'}
                      </button>

                      {isFriend ? (
                        <button
                          onClick={() => handleFriendAction(userRes.uid)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--danger)', borderColor: 'rgba(226,75,74,0.2)' }}
                        >
                          Remove Friend
                        </button>
                      ) : request?.isPending ? (
                        request.fromMe ? (
                          <button
                            onClick={() => handleFriendAction(userRes.uid)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                          >
                            Requested
                          </button>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => handleFriendAction(userRes.uid)}
                              className="btn-primary"
                              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleDenyFriend(userRes.uid)}
                              className="btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                            >
                              Deny
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          onClick={() => handleFriendAction(userRes.uid)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                        >
                          Add Friend
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Mutual Friends List */}
        <section className="cp-card">
          <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '1rem', marginTop: 0 }}>
            Friends ({friendUids.length})
          </h3>
          {loadingFriends ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading friends...</div>
          ) : friendsProfiles.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, fontStyle: 'italic' }}>
              No mutual friends yet. Search above to add them!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {friendsProfiles.map(f => (
                <div key={f.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-surface-2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div onClick={() => navigate(`/users/${f.username || f.uid}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <img
                      src={f.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.username || f.displayName)}&background=0D1117&color=E6EDF3`}
                      alt={f.username || f.displayName}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{f.username || f.displayName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <RankBadge rank={f.rank} size="sm" />
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>· {f.totalSolves ?? 0} solves</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveFriendList(f.uid)}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: 'rgba(226,75,74,0.1)' }}
                  >
                    Unfriend
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Groups Card List */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>
              Groups ({groups.length})
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setShowJoinGroup(true)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <i className="ti ti-login" /> Join
              </button>
              <button onClick={() => setShowCreateGroup(true)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                <i className="ti ti-plus" /> Create
              </button>
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="cp-card" style={{ textAlign: 'center', padding: '2rem 1.5rem', fontStyle: 'italic', fontSize: 13, color: 'var(--text-secondary)' }}>
              You are not in any training groups. Create or join one to compete!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {groups.map(group => (
                <div key={group.teamId} className="cp-card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛡️</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{group.members.length} members</div>
                    </div>
                  </div>

                  {group.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{group.description}</p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--accent)' }}>CODE: {group.inviteCode}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleCopyLink(group.inviteCode, group.teamId)}
                        className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                        {copied === group.teamId ? 'Copied ✓' : 'Copy Link'}
                      </button>
                      <button onClick={() => navigate(`/groups/${group.teamId}`)}
                        className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                        Open
                      </button>
                      <button
                        onClick={() => handleLeaveGroup(group.teamId, group.name)}
                        disabled={leavingGroup === group.teamId}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(226,75,74,0.1)' }}
                      >
                        Leave
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  };

  // Settings Tab
  const renderSettings = () => {
    if (!user) {
      return (
        <div className="cp-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Settings are for signed-in users</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Sign in with Google to customize your profile settings.</p>
          <button onClick={loginWithGoogle} className="btn-primary">Sign in with Google</button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '640px', margin: '0 auto' }}>
        
        {/* Avatar Settings */}
        <section className="cp-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div 
            onClick={() => { if (!uploading) document.getElementById('avatar-file-input')?.click(); }}
            style={{ 
              position: 'relative', 
              width: 80, 
              height: 80, 
              borderRadius: '50%', 
              overflow: 'hidden', 
              border: '2px solid var(--border)', 
              cursor: uploading ? 'not-allowed' : 'pointer',
              background: 'var(--bg-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {getInitials()}
              </div>
            )}
            
            {/* Hover overlay with Camera Icon */}
            {!uploading && (
              <div 
                style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  background: 'rgba(0,0,0,0.5)', 
                  color: 'white', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  opacity: 0, 
                  transition: 'opacity 0.2s',
                }} 
                className="avatar-hover-overlay"
              >
                <i className="ti ti-camera" style={{ fontSize: '24px' }} />
              </div>
            )}

            {/* Simple loading spinner over the avatar while uploading */}
            {uploading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                zIndex: 10
              }}>
                <div style={{
                  width: 24,
                  height: 24,
                  border: '2px solid var(--accent)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
              </div>
            )}
          </div>
          
          <input 
            id="avatar-file-input"
            type="file" 
            accept="image/*" 
            onChange={handleAvatarChange} 
            disabled={uploading} 
            style={{ display: 'none' }} 
          />

          <div>
            <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800 }}>Profile Photo</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>Click photo to upload a new one. Max file size: 5MB.</p>
          </div>
        </section>

        {/* Username settings */}
        <section className="cp-card">
          <form onSubmit={handleSaveUsername} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Username</h4>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="Choose a username..."
                  className="form-input"
                  style={{
                    width: '100%',
                    borderColor: usernameValid && usernameInput.trim() !== (profile?.username || '') ? 'var(--success)' : usernameError ? 'var(--danger)' : 'var(--border)'
                  }}
                />
                <div style={{ position: 'absolute', right: 12, top: 10, fontSize: 12 }}>
                  {usernameChecking && <div style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                  {!usernameChecking && usernameValid && usernameInput.trim() !== (profile?.username || '') && <span style={{ color: 'var(--success)' }}>✔</span>}
                  {!usernameChecking && usernameError && <span style={{ color: 'var(--danger)' }}>✘</span>}
                </div>
              </div>
              <button
                type="submit"
                disabled={usernameSubmitting || !usernameValid || usernameInput.trim() === (profile?.username || '')}
                className="btn-primary"
                style={{ padding: '10px 18px', flexShrink: 0 }}
              >
                {usernameSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
            {usernameChecking && <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Checking availability...</p>}
            {!usernameChecking && usernameError && <p style={{ fontSize: 11, color: 'var(--danger)', margin: 0 }}>{usernameError}</p>}
            {!usernameChecking && usernameValid && usernameInput.trim() !== (profile?.username || '') && <p style={{ fontSize: 11, color: 'var(--success)', margin: 0 }}>Username is available</p>}
          </form>
        </section>

        {/* Bio settings */}
        <section className="cp-card">
          <form onSubmit={handleSaveBio} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Profile Bio</h4>
              <span style={{ fontSize: 11, color: bioInput.length > 160 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {bioInput.length} / 160
              </span>
            </div>
            <textarea
              rows={3}
              value={bioInput}
              onChange={e => setBioInput(e.target.value.slice(0, 200))} // permit slight overflow, but keep validation at save
              placeholder="Tell other coders about yourself..."
              className="form-input"
              style={{ resize: 'none', lineHeight: 1.5 }}
            />
            <button
              type="submit"
              disabled={savingBio || bioInput.length > 160}
              className="btn-primary"
              style={{ alignSelf: 'flex-end', padding: '8px 16px' }}
            >
              {savingBio ? 'Saving...' : 'Save Bio'}
            </button>
          </form>
        </section>

        {/* Platform handles settings */}
        <section className="cp-card">
          <form onSubmit={handleSaveHandles} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Platform Handles</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Codeforces Handle</label>
                <input type="text" value={handleCf} onChange={e => setHandleCf(e.target.value)} placeholder="e.g. tourist" className="form-input" style={{ width: '100%' }} />
              </div>
              
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>AtCoder Handle</label>
                <input type="text" value={handleAc} onChange={e => setHandleAc(e.target.value)} placeholder="e.g. chokudai" className="form-input" style={{ width: '100%' }} />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: 11 }}>LeetCode Username</label>
                <input type="text" value={handleLc} onChange={e => setHandleLc(e.target.value)} placeholder="e.g. luffy" className="form-input" style={{ width: '100%' }} />
              </div>
            </div>

            <button type="submit" disabled={savingHandles} className="btn-primary" style={{ alignSelf: 'flex-end', padding: '8px 16px', marginTop: 4 }}>
              {savingHandles ? 'Saving...' : 'Save Handles'}
            </button>
          </form>
        </section>

        {/* Training goals settings */}
        <section className="cp-card">
          <form onSubmit={handleSaveGoals} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Daily Training Goals</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Target Solves / Day</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" className="counter-btn" onClick={() => setGoalProblems(Math.max(1, goalProblems - 1))}>−</button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{goalProblems}</span>
                  <button type="button" className="counter-btn" onClick={() => setGoalProblems(goalProblems + 1)}>+</button>
                </div>
              </div>
              
              <div>
                <label className="form-label" style={{ fontSize: 11 }}>Target Hours / Day</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button type="button" className="counter-btn" onClick={() => setGoalHours(Math.max(1, goalHours - 1))}>−</button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{goalHours}</span>
                  <button type="button" className="counter-btn" onClick={() => setGoalHours(goalHours + 1)}>+</button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={savingGoals} className="btn-primary" style={{ alignSelf: 'flex-end', padding: '8px 16px', marginTop: 4 }}>
              {savingGoals ? 'Saving...' : 'Save Goals'}
            </button>
          </form>
        </section>

        {/* Danger zone account deletion */}
        <section className="cp-card" style={{ borderColor: 'rgba(226,75,74,0.3)', background: 'rgba(226,75,74,0.02)' }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: 'var(--danger)' }}>Danger Zone</h4>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-secondary)' }}>Deleting your account is permanent. It clears your user profile, logs, achievements, and releases your username.</p>
          <button type="button" onClick={() => setShowDeleteModal(true)} className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'rgba(226,75,74,0.2)' }}>
            Delete Account...
          </button>
        </section>

        {showDeleteModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', padding: '1rem' }}>
            <div className="cp-card" style={{ width: '100%', maxWidth: 400, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--danger)' }}>Confirm Permanent Deletion</h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                This action is irreversible. Type <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>DELETE</strong> below to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE..."
                className="form-input"
                style={{ width: '100%', textAlign: 'center' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                  onClick={handleDeleteAccount}
                  className="btn-primary"
                  style={{ flex: 1, background: 'var(--danger)' }}
                >
                  {deletingAccount ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inject CSS style for avatar hover */}
        <style>{`
          .avatar-hover-overlay:hover {
            opacity: 1 !important;
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1024, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          {[
            { id: 'overview', label: 'Overview', icon: 'ti-home' },
            { id: 'friends', label: 'Friends & Groups', icon: 'ti-users' },
            { id: 'settings', label: 'Settings', icon: 'ti-settings' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600, color: currentTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: currentTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all 0.15s',
                marginBottom: '-9px'
              }}
            >
              <i className={`ti ${tab.icon}`} style={{ fontSize: '14px' }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Render Active Tab */}
        <div style={{ minHeight: '400px' }}>
          {currentTab === 'overview' ? renderOverview() :
           currentTab === 'friends' ? renderFriendsAndGroups() :
           renderSettings()}
        </div>

      </div>

      <UsernameSetupModal />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: toast.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: 600
        }}>
          {toast.type === 'success' ? '✓' : '⚠️'} {toast.message}
        </div>
      )}
    </div>
  );
}
