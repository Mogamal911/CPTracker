import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupByInviteCode, joinGroupByCode } from '../services/groupService';
import { useAuth } from '../hooks/useAuth';
import type { Team } from '../types';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export const JoinPage = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam]       = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if current user is already a member
  const isAlreadyMember = !!(user && team?.members.includes(user.uid));

  useEffect(() => {
    if (!inviteCode) { setLoading(false); return; }
    setLoading(true);
    getGroupByInviteCode(inviteCode)
      .then(found => {
        setTeam(found);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to look up this invite link.');
        setLoading(false);
      });
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!user) {
      // Prompt sign in — after login the page will re-render with user set
      await loginWithGoogle();
      return;
    }
    if (!inviteCode || !team) return;

    setJoining(true);
    setError(null);
    try {
      await joinGroupByCode(inviteCode, user.uid);
      setSuccess(true);
      setTimeout(() => navigate('/groups'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-slate-400 font-mono text-sm">Looking up invite…</p>
          </div>
        ) : !team ? (
          <div className="bg-slate-900/40 border border-rose-500/20 rounded-2xl p-8 text-center space-y-3">
            <div className="text-4xl">😕</div>
            <h2 className="text-lg font-bold text-white">Invalid Invite Link</h2>
            <p className="text-sm text-slate-400">This invite code doesn't match any group.</p>
            <button onClick={() => navigate('/')} className="text-indigo-400 text-sm hover:underline font-semibold">
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-8 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />

            {success ? (
              <div className="text-center space-y-4 py-6">
                <div className="text-5xl">🎉</div>
                <h2 className="text-xl font-bold text-white">You're in!</h2>
                <p className="text-sm text-slate-400">Redirecting to your groups…</p>
              </div>
            ) : (
              <>
                {/* Group info */}
                <div className="space-y-2 text-center">
                  <div className="w-16 h-16 mx-auto bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl">🛡️</div>
                  <h2 className="text-2xl font-extrabold text-white">{team.name}</h2>
                  {team.description && (
                    <p className="text-sm text-slate-400">{team.description}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
                    <span>Invite code:</span>
                    <span className="text-indigo-400 font-bold tracking-wider">{team.inviteCode}</span>
                  </div>
                </div>

                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 grid grid-cols-2 gap-4 text-center text-sm">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Members</div>
                    <div className="text-white font-bold font-mono text-xl mt-0.5">{team.members.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Invite Code</div>
                    <div className="text-indigo-400 font-bold font-mono text-xl mt-0.5 tracking-widest">{team.inviteCode}</div>
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm font-medium text-center">
                    {error}
                  </div>
                )}

                {isAlreadyMember ? (
                  <div className="text-center space-y-3">
                    <p className="text-sm text-emerald-400 font-semibold">✓ You're already a member of this group!</p>
                    <button onClick={() => navigate('/groups')} className="text-indigo-400 hover:underline text-sm font-semibold">
                      Go to My Groups
                    </button>
                  </div>
                ) : !user ? (
                  /* Guest: show sign-in to join */
                  <div className="space-y-3 text-center">
                    <p className="text-sm text-slate-400">Sign in with Google to join <strong className="text-white">{team.name}</strong></p>
                    <button
                      onClick={handleJoin}
                      className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl shadow-lg transition cursor-pointer"
                    >
                      <GoogleIcon />
                      Sign in to Join
                    </button>
                  </div>
                ) : (
                  /* Signed in: join directly */
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-2xl font-bold transition duration-200 transform hover:scale-[1.01] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20 cursor-pointer"
                  >
                    {joining ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Joining…
                      </span>
                    ) : (
                      `Join ${team.name}`
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default JoinPage;
