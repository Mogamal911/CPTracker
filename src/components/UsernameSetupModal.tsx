import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { checkUsernameAvailable, validateUsername, claimUsername } from '../services/usernameService';

export const UsernameSetupModal = () => {
  const { user, needsUsername, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    if (!username.trim()) {
      setUsernameError(null);
      setUsernameValid(false);
      setUsernameChecking(false);
      return;
    }

    const formatError = validateUsername(username);
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
        const isAvailable = await checkUsernameAvailable(username);
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
  }, [username]);

  if (!needsUsername || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameValid) {
      setError('Please choose a valid and available username.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await claimUsername(user.uid, username.trim());
    } catch (err: any) {
      console.error('Username claim failed:', err);
      setError(err.message || 'Failed to claim username.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      {/* Background glow behind modal */}
      <div className="absolute w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        <div className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white">Choose Your Username</h2>
            <p className="text-sm text-slate-400">
              We now require all members to have a unique username. Choose yours below to continue.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-3 py-2 rounded-lg font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="setup-username" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="setup-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. tourist_123"
                  required
                  className={`w-full bg-slate-950 border rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition duration-150 ${
                    usernameValid
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : usernameError
                      ? 'border-rose-500/50 focus:border-rose-500'
                      : 'border-slate-800 focus:border-indigo-500'
                  }`}
                />
                <div className="absolute right-3 text-xs flex items-center">
                  {usernameChecking && (
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {!usernameChecking && usernameValid && <span className="text-emerald-400">✔</span>}
                  {!usernameChecking && usernameError && <span className="text-rose-400">✘</span>}
                </div>
              </div>
              
              {usernameChecking && (
                <p className="text-[11px] text-slate-500">Checking availability...</p>
              )}
              {!usernameChecking && usernameValid && (
                <p className="text-[11px] text-emerald-400">Username is available</p>
              )}
              {!usernameChecking && usernameError && (
                <p className="text-[11px] text-rose-400 font-medium">{usernameError}</p>
              )}
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={logout}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-sm font-semibold transition duration-150"
              >
                Sign Out
              </button>
              <button
                type="submit"
                disabled={submitting || !usernameValid}
                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-sm font-semibold transition duration-150 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/15"
              >
                {submitting ? 'Saving...' : 'Set Username'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UsernameSetupModal;
