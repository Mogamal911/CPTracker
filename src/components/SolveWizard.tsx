// src/components/SolveWizard.tsx
// Quick/Detailed mode wizard for logging a solve.

import { useState, useEffect, useRef } from 'react';
import { useSolveSubmit } from '../hooks/useSolveSubmit';
import { useAuth } from '../hooks/useAuth';

type Platform = 'codeforces' | 'atcoder' | 'leetcode' | null;
type Difficulty = 'easy' | 'medium' | 'hard' | null;
type SourceType = 'practice' | 'sheet' | 'contest' | null;
type LogMode = 'quick' | 'detailed';

const LOG_MODE_KEY = 'logMode';

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// ── Counter control ────────────────────────────────────────────────
function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="counter-cell">
      <span className="counter-label">{label}</span>
      <div className="counter-controls">
        <button type="button" className="counter-btn" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <span className="counter-val">{value}</span>
        <button type="button" className="counter-btn" onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

// ── Step dot indicator ─────────────────────────────────────────────
function StepDots({ current, total, completedSteps }: { current: number; total: number; completedSteps: Set<number> }) {
  return (
    <div className="wizard-dots">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isDone = completedSteps.has(step) && step < current;
        const isActive = step === current;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div className={`wizard-dot ${isActive ? 'wizard-dot--active' : isDone ? 'wizard-dot--done' : ''}`}>
              {isDone ? <i className="ti ti-check" style={{ fontSize: '0.7rem' }} /> : step}
            </div>
            {step < total && (
              <div className={`wizard-dot-line ${isDone ? 'wizard-dot-line--done' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function SolveWizard({ onSuccess, onCancel: _onCancel }: Props) {
  const { user, loginWithGoogle } = useAuth();
  const { submitSolve, submitting } = useSolveSubmit();
  const [showGuestAuth, setShowGuestAuth] = useState(false);

  // ── Mode ────────────────────────────────────────────────────────
  const [logMode, setLogMode] = useState<LogMode>(() => {
    try { return (localStorage.getItem(LOG_MODE_KEY) as LogMode) || 'quick'; }
    catch { return 'quick'; }
  });

  useEffect(() => { localStorage.setItem(LOG_MODE_KEY, logMode); }, [logMode]);

  // ── Form state ──────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const [platform,   setPlatform]   = useState<Platform>(null);
  const [problemName, setProblemName] = useState('');
  const [problemLink, setProblemLink] = useState('');
  const [hours,      setHours]      = useState(0);
  const [minutes,    setMinutes]    = useState(0);
  const [accepted,   setAccepted]   = useState<boolean | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(null);
  const [sourceType, setSourceType] = useState<SourceType>(null);
  const [wa,  setWa]  = useState(0);
  const [tle, setTle] = useState(0);
  const [re,  setRe]  = useState(0);
  const [ce,  setCe]  = useState(0);
  const [notes, setNotes] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus problem name on open
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 100); }, []);

  const totalMinutes = hours * 60 + minutes;

  const resetForm = () => {
    setPlatform(null); setProblemName(''); setProblemLink('');
    setHours(0); setMinutes(0); setAccepted(null); setDifficulty(null);
    setSourceType(null); setWa(0); setTle(0); setRe(0); setCe(0);
    setNotes(''); setStep(1); setCompletedSteps(new Set());
    setFormError(null);
  };

  const handleSubmit = async (bypassGuestCheck = false) => {
    setFormError(null);
    if (!user && !bypassGuestCheck) { setShowGuestAuth(true); return; }
    if (!problemName.trim()) { setFormError('Problem name is required.'); return; }

    try {
      const result = await submitSolve({
        platform,
        problemName: problemName.trim(),
        problemLink: problemLink.trim(),
        difficulty: logMode === 'quick' ? 'medium' : difficulty,
        totalTime: totalMinutes,
        accepted,
        notes: notes.trim(),
        sourceType: logMode === 'quick' ? 'practice' : sourceType,
        wa, tle, re, ce,
        wrongAnswers: wa,  // for first-AC rate in analytics
      });

      if (result?.success) {
        const msg = result.accepted ? `+${result.xpEarned} XP — Logged ✓` : 'Logged · keep going 💪';
        setToast(msg);
        resetForm();
        setTimeout(() => { setToast(null); onSuccess?.(); }, 1600);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error saving solve log');
    }
  };

  const goNext = () => {
    if (step === 1 && !problemName.trim()) { setFormError('Problem name is required.'); return; }
    setFormError(null);
    setCompletedSteps(prev => new Set([...prev, step]));
    setStep(s => s + 1);
  };

  const goBack = () => { setStep(s => s - 1); setFormError(null); };

  // ── Quick mode ──────────────────────────────────────────────────
  const renderQuick = () => (
    <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div>
        <label className="form-label">Problem Name</label>
        <input
          ref={nameRef}
          type="text"
          placeholder="e.g. Two Sum"
          value={problemName}
          onChange={e => setProblemName(e.target.value)}
          className="form-input"
          autoComplete="off"
        />
      </div>

      <div>
        <label className="form-label">Time Spent</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="number" min={0} max={99} placeholder="0" value={hours || ''}
            onChange={e => setHours(Math.max(0, parseInt(e.target.value) || 0))}
            className="form-input" style={{ width: 72, textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>hr</span>
          <input
            type="number" min={0} max={59} placeholder="0" value={minutes || ''}
            onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
            className="form-input" style={{ width: 72, textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>min</span>
        </div>
      </div>

      <div>
        <label className="form-label">Outcome</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button type="button"
            className={`outcome-btn ${accepted === true ? 'outcome-btn--accepted' : ''}`}
            onClick={() => setAccepted(v => v === true ? null : true)}
          >✓ Accepted</button>
          <button type="button"
            className={`outcome-btn ${accepted === false ? 'outcome-btn--rejected' : ''}`}
            onClick={() => setAccepted(v => v === false ? null : false)}
          >✗ Not solved</button>
        </div>
      </div>

      {formError && <p className="cp-error" style={{ margin: 0 }}>{formError}</p>}

      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%' }}
        onClick={() => handleSubmit()}
        disabled={submitting}
      >
        {submitting
          ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Saving…</>
          : 'Log Solve'}
      </button>
    </div>
  );

  // ── Step 1: Problem details ─────────────────────────────────────
  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div>
        <label className="form-label">Platform</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          {(['codeforces', 'atcoder', 'leetcode'] as const).map(p => (
            <button key={p} type="button"
              className={`platform-btn ${platform === p ? 'platform-btn--active' : ''}`}
              onClick={() => setPlatform(curr => curr === p ? null : p)}
            >
              {p === 'codeforces' ? 'Codeforces' : p === 'atcoder' ? 'AtCoder' : 'LeetCode'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">Problem Name *</label>
        <input
          ref={nameRef}
          type="text" placeholder="e.g. Two Sum"
          value={problemName} onChange={e => setProblemName(e.target.value)}
          className="form-input" autoComplete="off"
        />
      </div>

      <div>
        <label className="form-label">Problem Link</label>
        <input
          type="url" placeholder="https://codeforces.com/..."
          value={problemLink} onChange={e => setProblemLink(e.target.value)}
          className="form-input"
        />
      </div>
    </div>
  );

  // ── Step 2: Result ──────────────────────────────────────────────
  const renderStep2 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div>
        <label className="form-label">Outcome</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button type="button"
            className={`outcome-btn ${accepted === true ? 'outcome-btn--accepted' : ''}`}
            onClick={() => setAccepted(v => v === true ? null : true)}
          >✓ Accepted</button>
          <button type="button"
            className={`outcome-btn ${accepted === false ? 'outcome-btn--rejected' : ''}`}
            onClick={() => setAccepted(v => v === false ? null : false)}
          >✗ Not solved</button>
        </div>
      </div>

      <div>
        <label className="form-label">Time Spent</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input type="number" min={0} max={99} placeholder="0" value={hours || ''}
            onChange={e => setHours(Math.max(0, parseInt(e.target.value) || 0))}
            className="form-input" style={{ width: 72, textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>hr</span>
          <input type="number" min={0} max={59} placeholder="0" value={minutes || ''}
            onChange={e => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
            className="form-input" style={{ width: 72, textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>min</span>
        </div>
      </div>

      <div>
        <label className="form-label">Difficulty</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          {(['easy', 'medium', 'hard'] as const).map(d => (
            <button key={d} type="button"
              className={`diff-btn diff-btn--${d} ${difficulty === d ? 'diff-btn--active' : ''}`}
              onClick={() => setDifficulty(curr => curr === d ? null : d)}
              style={{ textTransform: 'capitalize' }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Step 3: Details ─────────────────────────────────────────────
  const renderStep3 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div>
        <label className="form-label">Source</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          {(['practice', 'sheet', 'contest'] as const).map(s => (
            <button key={s} type="button"
              className={`source-btn ${sourceType === s ? 'source-btn--active' : ''}`}
              onClick={() => setSourceType(curr => curr === s ? null : s)}
              style={{ textTransform: 'capitalize' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">Submission Errors</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <Counter label="WA" value={wa} onChange={setWa} />
          <Counter label="TLE" value={tle} onChange={setTle} />
          <Counter label="RE" value={re} onChange={setRe} />
          <Counter label="CE" value={ce} onChange={setCe} />
        </div>
      </div>

      <div>
        <label className="form-label">Notes</label>
        <textarea
          rows={3} placeholder="Approach, key insight, what tripped you up... (optional)"
          value={notes} onChange={e => setNotes(e.target.value)}
          className="form-input" style={{ resize: 'none', lineHeight: '1.5' }}
        />
      </div>

      {formError && <p className="cp-error" style={{ margin: 0 }}>{formError}</p>}

      <button
        type="button" className="btn-primary" style={{ width: '100%' }}
        onClick={() => handleSubmit()} disabled={submitting}
      >
        {submitting
          ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Saving…</>
          : 'Log Solve'}
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Success toast */}
      {toast && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: 'white', padding: '8px 18px',
          borderRadius: 20, fontWeight: 700, fontSize: '0.85rem', zIndex: 10,
          whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(29,158,117,0.4)',
        }}>
          {toast}
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ padding: '0.75rem 1rem 0', flexShrink: 0 }}>
        <div className="wizard-mode-toggle">
          <button
            className={`wizard-mode-toggle__btn ${logMode === 'quick' ? 'wizard-mode-toggle__btn--active' : ''}`}
            onClick={() => { setLogMode('quick'); setStep(1); }}
          >Quick</button>
          <button
            className={`wizard-mode-toggle__btn ${logMode === 'detailed' ? 'wizard-mode-toggle__btn--active' : ''}`}
            onClick={() => setLogMode('detailed')}
          >Detailed</button>
        </div>
      </div>

      {/* Step dots (detailed only) */}
      {logMode === 'detailed' && (
        <div style={{ padding: '0.5rem 1rem 0', flexShrink: 0 }}>
          <StepDots current={step} total={3} completedSteps={completedSteps} />
        </div>
      )}

      {/* Form content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 0' }}>
        <div className="wizard-body">
          {logMode === 'quick'
            ? renderQuick()
            : step === 1 ? renderStep1()
            : step === 2 ? renderStep2()
            : renderStep3()
          }

          {/* Error display for non-submit steps */}
          {logMode === 'detailed' && step < 3 && formError && (
            <p className="cp-error" style={{ marginTop: '0.75rem' }}>{formError}</p>
          )}
        </div>
      </div>

      {/* Navigation (detailed only) */}
      {logMode === 'detailed' && (
        <div className="wizard-nav">
          <div>
            {step > 1 && (
              <button type="button" className="btn-secondary" onClick={goBack}>
                <i className="ti ti-arrow-left" /> Back
              </button>
            )}
          </div>
          <div>
            {step < 3 && (
              <button
                type="button" className="btn-primary" onClick={goNext}
                disabled={step === 1 && !problemName.trim()}
              >
                Next <i className="ti ti-arrow-right" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spin animation for submit button */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Guest Auth Modal */}
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
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Sign in to save your solve</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Sign in with Google to log this solve, earn XP, unlock achievements, and build your training streak.
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
                onClick={() => {
                  setShowGuestAuth(false);
                  handleSubmit(true);
                }}
                className="cp-btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '13px' }}
              >
                Save Locally as Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
