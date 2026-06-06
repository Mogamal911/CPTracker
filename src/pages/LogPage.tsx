import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSolveSubmit } from '../hooks/useSolveSubmit';
import { useAuth } from '../hooks/useAuth';

// ─── Google icon ─────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Sign-in prompt modal ─────────────────────────────────────────────────────
function GuestPrompt({ onSignIn, onClose }: { onSignIn: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-5 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500" />
        <div className="text-4xl">🔐</div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Sign in to save your progress</h2>
          <p className="text-sm text-slate-400">Your solves, XP, and streaks are tied to your account.</p>
        </div>
        <button
          onClick={onSignIn}
          className="w-full inline-flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-xl shadow-lg transition"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-400 transition">
          Cancel — continue browsing
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const LogPage = () => {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();
  const { submitSolve, submitting } = useSolveSubmit();

  // Form state
  const [platform,     setPlatform]     = useState<'codeforces' | 'atcoder' | 'leetcode'>('codeforces');
  const [problemName,  setProblemName]  = useState('');
  const [problemLink,  setProblemLink]  = useState('');
  const [hours,        setHours]        = useState(0);
  const [minutes,      setMinutes]      = useState(0);
  const [accepted,     setAccepted]     = useState<boolean | null>(null);
  const [difficulty,   setDifficulty]   = useState<'easy' | 'medium' | 'hard'>('medium');
  const [notes,        setNotes]        = useState('');

  // UI state
  const [toast,          setToast]          = useState<{ message: string; type: 'success' | 'neutral' } | null>(null);
  const [formError,      setFormError]      = useState<string | null>(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const totalMinutes = hours * 60 + minutes;

  const showToast = (message: string, type: 'success' | 'neutral') => {
    setToast({ message, type });
    setTimeout(() => { setToast(null); navigate('/'); }, 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!user) { setShowGuestPrompt(true); return; }
    if (!problemName.trim()) { setFormError('Problem name is required.'); return; }
    if (accepted === null) { setFormError('Please select Accepted or Not solved.'); return; }

    try {
      const result = await submitSolve({
        platform,
        problemName: problemName.trim(),
        problemLink: problemLink.trim(),
        difficulty,
        totalTime: totalMinutes,
        accepted,
        notes: notes.trim(),
      });

      if (result?.success) {
        if (result.accepted) {
          showToast(`+${result.xpEarned} XP · Problem logged ✓`, 'success');
        } else {
          showToast('Logged · keep going 💪', 'neutral');
        }
        // Reset form
        setProblemName(''); setProblemLink('');
        setHours(0); setMinutes(0);
        setAccepted(null); setDifficulty('medium'); setNotes('');
      }
    } catch (err: any) {
      setFormError(err.message || 'Error saving solve log');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 relative">

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 font-semibold py-3 px-6 rounded-2xl shadow-2xl flex items-center gap-2 border transition-all ${
          toast.type === 'success'
            ? 'bg-emerald-600/90 text-white border-emerald-400'
            : 'bg-slate-700/90 text-slate-100 border-slate-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Guest prompt */}
      {showGuestPrompt && (
        <GuestPrompt
          onSignIn={() => { setShowGuestPrompt(false); loginWithGoogle(); }}
          onClose={() => setShowGuestPrompt(false)}
        />
      )}

      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Log a Solve</h1>
            <p className="text-sm text-slate-400 mt-1">Record your training session</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            ← Dashboard
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 md:p-8">

          {/* Platform */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Platform</label>
            <div className="grid grid-cols-3 gap-3">
              {(['codeforces', 'atcoder', 'leetcode'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`py-3 px-4 rounded-xl font-bold text-sm transition border ${
                    platform === p
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/5'
                      : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800/50 text-slate-400'
                  }`}
                >
                  {p === 'codeforces' ? 'Codeforces' : p === 'atcoder' ? 'AtCoder' : 'LeetCode'}
                </button>
              ))}
            </div>
          </div>

          {/* Problem Name */}
          <input
            type="text"
            placeholder="Problem name"
            value={problemName}
            onChange={e => setProblemName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-base text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
          />

          {/* Problem Link */}
          <input
            type="url"
            placeholder="Problem link (e.g. https://codeforces.com/problemset/problem/...)"
            value={problemLink}
            onChange={e => setProblemLink(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition font-mono"
          />

          {/* Time spent */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Time spent</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  placeholder="0"
                  value={hours || ''}
                  onChange={e => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-center text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono"
                />
                <span className="text-slate-400 text-sm font-semibold">hr</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="0"
                  value={minutes || ''}
                  onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-center text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition font-mono"
                />
                <span className="text-slate-400 text-sm font-semibold">min</span>
              </div>
            </div>
          </div>

          {/* Outcome — large toggle */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Outcome</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccepted(true)}
                className={`py-5 rounded-2xl font-extrabold text-lg transition border-2 ${
                  accepted === true
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/40 border-slate-800 hover:border-emerald-500/50 text-slate-500 hover:text-emerald-400'
                }`}
              >
                ✓ Accepted
              </button>
              <button
                type="button"
                onClick={() => setAccepted(false)}
                className={`py-5 rounded-2xl font-extrabold text-lg transition border-2 ${
                  accepted === false
                    ? 'bg-rose-500/15 border-rose-500 text-rose-300 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-950/40 border-slate-800 hover:border-rose-500/50 text-slate-500 hover:text-rose-400'
                }`}
              >
                ✗ Not solved
              </button>
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Difficulty</label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'medium', 'hard'] as const).map(d => {
                const colors = {
                  easy:   { on: 'bg-emerald-500/10 border-emerald-500 text-emerald-300', off: 'text-slate-400' },
                  medium: { on: 'bg-amber-500/10 border-amber-500 text-amber-300',       off: 'text-slate-400' },
                  hard:   { on: 'bg-rose-500/10 border-rose-500 text-rose-300',          off: 'text-slate-400' },
                }[d];
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={`py-2 px-3 rounded-lg font-semibold text-xs capitalize transition border ${
                      difficulty === d
                        ? colors.on
                        : `bg-slate-950/40 border-slate-800 hover:bg-slate-800/30 ${colors.off}`
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <textarea
            rows={3}
            placeholder="Notes — approach, key insight, what tripped you up... (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition resize-none placeholder-slate-600"
          />

          {/* Error */}
          {formError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm font-medium">
              {formError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-2xl font-bold text-base transition duration-200 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              'Log Solve'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
export default LogPage;
