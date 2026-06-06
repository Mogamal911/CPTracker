import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { checkUsernameAvailable, validateUsername } from '../services/usernameService';

export const OnboardingModal = () => {
  const { needsOnboarding, completeOnboarding, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cfHandle, setCfHandle] = useState('');
  const [acHandle, setAcHandle] = useState('');
  const [lcHandle, setLcHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Username validation and availability check states
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Debounced real-time username checker
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
    }, 450); // 450ms debounce

    return () => clearTimeout(delay);
  }, [username]);

  if (!needsOnboarding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameValid) {
      setError('Please choose a valid and available username first.');
      return;
    }
    if (!displayName.trim()) {
      setError('Display Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await completeOnboarding(
        cfHandle.trim(),
        acHandle.trim(),
        lcHandle.trim(),
        displayName.trim(),
        username.trim()
      );
    } catch (err: any) {
      console.error('Onboarding failed:', err);
      setError(err.message || 'Failed to complete profile set up.');
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
            <h2 className="text-2xl font-bold tracking-tight text-white">Set Up Your Profile</h2>
            <p className="text-sm text-slate-400">
              Complete your profile setup to start tracking your competitive programming stats.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs px-3 py-2 rounded-lg font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input with Real-time Check */}
            <div className="space-y-1">
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  id="username"
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
              
              {/* Feedback text */}
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

            <div className="space-y-1">
              <label htmlFor="displayName" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Display Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Tourist"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition duration-150"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cfHandle" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Codeforces Handle
              </label>
              <input
                type="text"
                id="cfHandle"
                value={cfHandle}
                onChange={(e) => setCfHandle(e.target.value)}
                placeholder="e.g. tourist"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition duration-150"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="acHandle" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                AtCoder Handle
              </label>
              <input
                type="text"
                id="acHandle"
                value={acHandle}
                onChange={(e) => setAcHandle(e.target.value)}
                placeholder="e.g. chokudai"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition duration-150"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="lcHandle" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                LeetCode Handle
              </label>
              <input
                type="text"
                id="lcHandle"
                value={lcHandle}
                onChange={(e) => setLcHandle(e.target.value)}
                placeholder="e.g. neetcode"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition duration-150"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={logout}
                className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-sm font-semibold transition duration-150"
              >
                Cancel / Sign Out
              </button>
              <button
                type="submit"
                disabled={submitting || !usernameValid}
                className="flex-1 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-xl text-sm font-semibold transition duration-150 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/15"
              >
                {submitting ? 'Creating...' : 'Create Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
