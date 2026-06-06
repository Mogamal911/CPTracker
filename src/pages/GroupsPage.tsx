import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';

// ─── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, desc: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Group name is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      await onCreate(name.trim(), desc.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-5 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />
        <div>
          <h2 className="text-xl font-bold text-white">Create a Group</h2>
          <p className="text-sm text-slate-400 mt-1">An invite link will be generated automatically.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Group name"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />
          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition resize-none"
          />
          {error && (
            <div className="text-rose-300 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">{error}</div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 cursor-pointer">
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Join Group Modal ─────────────────────────────────────────────────────────
function JoinGroupModal({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Enter an invite code.'); return; }
    setLoading(true);
    setError(null);
    try {
      await onJoin(code.trim().toUpperCase());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to join group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-5 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />
        <div>
          <h2 className="text-xl font-bold text-white">Join a Group</h2>
          <p className="text-sm text-slate-400 mt-1">Enter the 6-character invite code.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="e.g. A1B2C3"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoFocus
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-base font-mono font-bold text-indigo-300 placeholder-slate-600 text-center uppercase tracking-[0.3em] focus:outline-none focus:border-indigo-500 transition"
          />
          {error && (
            <div className="text-rose-300 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">{error}</div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-sm font-bold transition disabled:opacity-50 cursor-pointer">
              {loading ? 'Joining…' : 'Join Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const GroupsPage = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle, isGuest } = useAuth();
  const { groups, createGroup, joinGroup, leaveGroup } = useGroups();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin,   setShowJoin]   = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);

  const handleCopyLink = (inviteCode: string, teamId: string) => {
    const link = `${window.location.origin}/join/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopied(teamId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLeave = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Leave "${teamName}"?`)) return;
    setLeaving(teamId);
    try {
      await leaveGroup(teamId);
    } catch (err: any) {
      alert(err.message || 'Failed to leave group');
    } finally {
      setLeaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8 relative">
      <div className="absolute top-10 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreate={(name, desc) => createGroup(name, desc).then(() => {})}
        />
      )}
      {showJoin && (
        <JoinGroupModal
          onClose={() => setShowJoin(false)}
          onJoin={(code) => joinGroup(code).then(() => {})}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">My Groups</h1>
            <p className="text-sm text-slate-400 mt-1">Create or join training groups to compete on the leaderboard</p>
          </div>
          {user && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowJoin(true)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                + Join Group
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                + Create Group
              </button>
            </div>
          )}
        </header>

        {/* Guest sign-in prompt */}
        {isGuest && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="text-4xl">🛡️</div>
            <div>
              <h2 className="text-lg font-bold text-white">Groups are for signed-in users</h2>
              <p className="text-sm text-slate-400 mt-1">Sign in with Google to create or join training groups.</p>
            </div>
            <button
              onClick={loginWithGoogle}
              className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl shadow-lg transition cursor-pointer"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {/* Groups list */}
        {user && (
          <>
            {groups.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-12 text-center space-y-4">
                <div className="text-5xl">🤝</div>
                <div>
                  <h2 className="text-lg font-bold text-white">No groups yet</h2>
                  <p className="text-sm text-slate-400 mt-1">Create a group and invite your training partners.</p>
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button onClick={() => setShowJoin(true)} className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer">Join Group</button>
                  <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition cursor-pointer">Create Group</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map(group => (
                  <div key={group.teamId} className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center text-2xl shrink-0">🛡️</div>
                        <div>
                          <h3 className="font-extrabold text-white text-lg">{group.name}</h3>
                          {group.description && <p className="text-sm text-slate-400 mt-0.5">{group.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span className="font-mono">{group.members.length} members</span>
                            <span>·</span>
                            <span>Code: <strong className="text-indigo-400 font-mono tracking-wider">{group.inviteCode}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopyLink(group.inviteCode, group.teamId)}
                          className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          {copied === group.teamId ? '✓ Copied!' : '🔗 Copy Invite'}
                        </button>
                        <button
                          onClick={() => navigate(`/groups/${group.teamId}`)}
                          className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleLeave(group.teamId, group.name)}
                          disabled={leaving === group.teamId}
                          className="px-3 py-2 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                        >
                          {leaving === group.teamId ? '…' : 'Leave'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
export default GroupsPage;
