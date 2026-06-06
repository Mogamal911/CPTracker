import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { leaveGroup } from '../services/groupService';
import { getRank } from '../lib/xp';
import type { Team, UserProfile } from '../types';

export const GroupDetailPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam]       = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Subscribe to team document
  useEffect(() => {
    if (!teamId) return;
    const ref = doc(db, 'teams', teamId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setTeam(snap.data() as Team);
      } else {
        setTeam(null);
        setLoading(false);
      }
    }, err => {
      console.error('Error loading team:', err);
      setLoading(false);
    });
  }, [teamId]);

  // Fetch member profiles whenever team.members changes
  useEffect(() => {
    if (!team) return;
    if (team.members.length === 0) {
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      const chunkSize = 30;
      const chunks: string[][] = [];
      for (let i = 0; i < team.members.length; i += chunkSize) {
        chunks.push(team.members.slice(i, i + chunkSize));
      }

      Promise.all(
        chunks.map(chunk =>
          getDocs(query(collection(db, 'users'), where('uid', 'in', chunk)))
            .then(snap => snap.docs.map(d => d.data() as UserProfile))
        )
      ).then(results => {
        const flat = results.flat();
        // Sort by xp descending
        flat.sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
        setMembers(flat);
        setLoading(false);
      }).catch(err => {
        console.error('Error fetching members:', err);
        setMembers([]);
        setLoading(false);
      });
    } catch (err) {
      console.error('Catch block error in member fetch:', err);
      setMembers([]);
      setLoading(false);
    }
  }, [team?.members.join(',')]);

  const handleCopyLink = () => {
    if (!team) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${team.inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!team || !user || !window.confirm(`Leave "${team.name}"?`)) return;
    setLeaving(true);
    try {
      await leaveGroup(team.teamId, user.uid);
      navigate('/groups');
    } catch (err: any) {
      alert(err.message || 'Failed to leave group');
      setLeaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (!team) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <div className="text-center space-y-3">
        <div className="text-4xl">😕</div>
        <p className="text-lg font-bold">Group not found</p>
        <button onClick={() => navigate('/groups')} className="text-indigo-400 hover:underline text-sm font-semibold">
          Back to Groups
        </button>
      </div>
    </div>
  );

  const isCreator = user?.uid === team.createdBy;
  const isMember  = user ? team.members.includes(user.uid) : false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 relative">
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">

        {/* Header */}
        <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl shrink-0">🛡️</div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold text-white">{team.name}</h1>
                  {isCreator && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Owner</span>
                  )}
                </div>
                {team.description && <p className="text-sm text-slate-400 mt-0.5">{team.description}</p>}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                  <span className="font-mono">{team.members.length} members</span>
                  <span>·</span>
                  <span>Invite code: <strong className="text-indigo-400 font-mono tracking-widest">{team.inviteCode}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
              </button>
              <button
                onClick={() => navigate('/groups')}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>

        {/* Members leaderboard */}
        <section className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800/80">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Members</h2>
          </div>

          {members.length === 0 ? (
            <div className="py-10 text-center text-slate-500 italic text-sm">No members in this group yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/40">
              {members.map((member, idx) => {
                const isCurrentUser = user?.uid === member.uid;
                const rank = getRank(member.xp ?? 0);
                return (
                  <div
                    key={member.uid}
                    className={`flex items-center justify-between px-6 py-4 transition ${
                      isCurrentUser ? 'bg-indigo-500/5 border-l-2 border-l-indigo-500' : 'hover:bg-slate-900/20'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-extrabold text-slate-500 font-mono w-6 text-center">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </span>
                      <img
                        src={member.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.username || member.displayName)}
                        alt={member.username || member.displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-800"
                      />
                      <div>
                        <div className="font-semibold text-white text-sm flex items-center gap-2">
                          {member.username || member.displayName}
                          {isCurrentUser && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider">You</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {rank} · {member.totalSolves ?? 0} solves · {member.streak ?? 0}🔥
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold font-mono text-emerald-400">{member.xp ?? 0}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">XP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Leave group button (for members, not shown to non-members) */}
        {isMember && !isCreator && (
          <div className="flex justify-center">
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="px-6 py-3 bg-slate-900 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-40"
            >
              {leaving ? 'Leaving…' : 'Leave Group'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
export default GroupDetailPage;
