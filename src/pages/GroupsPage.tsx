// src/pages/GroupsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGroups } from '../hooks/useGroups';

// ─── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, desc: string) => Promise<void>;
}) {
  const [name,    setName]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

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
            className="cp-input"
          />
          <textarea
            rows={2} placeholder="Description (optional)" value={desc}
            onChange={e => setDesc(e.target.value)}
            className="cp-input" style={{ resize: 'none', fontFamily: 'var(--font)' }}
          />
          {error && <div className="cp-error">{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} className="cp-btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="cp-btn-primary" style={{ flex: 1 }}>
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Join Group Modal ──────────────────────────────────────────────────────────
function JoinGroupModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

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
            className="cp-input"
            style={{ textAlign: 'center', fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase' }}
          />
          {error && <div className="cp-error">{error}</div>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} className="cp-btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={loading} className="cp-btn-primary" style={{ flex: 1 }}>
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
  const [copied,     setCopied]     = useState<string | null>(null);
  const [leaving,    setLeaving]    = useState<string | null>(null);

  const handleCopyLink = (inviteCode: string, teamId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${inviteCode}`);
    setCopied(teamId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleLeave = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Leave "${teamName}"?`)) return;
    setLeaving(teamId);
    try { await leaveGroup(teamId); }
    catch (err: any) { alert(err.message || 'Failed to leave group'); }
    finally { setLeaving(null); }
  };

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

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

      <div style={{ maxWidth: 896, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>My Groups</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>Create or join training groups to compete on the leaderboard</p>
          </div>
          {user && (
            <div style={{ display: 'flex', gap: '0.625rem' }}>
              <button onClick={() => setShowJoin(true)} className="cp-btn-secondary">
                <i className="ti ti-login" /> Join Group
              </button>
              <button onClick={() => setShowCreate(true)} className="cp-btn-primary">
                <i className="ti ti-plus" /> Create Group
              </button>
            </div>
          )}
        </div>

        {/* Guest prompt */}
        {isGuest && (
          <div className="cp-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>Groups are for signed-in users</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>Sign in with Google to create or join training groups.</p>
            <button onClick={loginWithGoogle} className="cp-btn-primary">Sign in with Google</button>
          </div>
        )}

        {/* Groups list */}
        {user && (
          <>
            {groups.length === 0 ? (
              <div className="cp-card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>No groups yet</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                  You're not in any groups yet. Create one or join with an invite code.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button onClick={() => setShowJoin(true)} className="cp-btn-secondary">
                    <i className="ti ti-login" /> Join Group
                  </button>
                  <button onClick={() => setShowCreate(true)} className="cp-btn-primary">
                    <i className="ti ti-plus" /> Create Group
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groups.map(group => (
                  <div key={group.teamId} className="cp-card" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                      <div style={{ width: 52, height: 52, background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🛡️</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>{group.name}</div>
                        {group.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{group.description}</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                          <span><i className="ti ti-users" style={{ fontSize: 11 }} /> {group.members.length} members</span>
                          <span>·</span>
                          <span>Code: <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{group.inviteCode}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleCopyLink(group.inviteCode, group.teamId)}
                        style={{ padding: '6px 12px', background: 'var(--accent)', color: 'white', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {copied === group.teamId ? '✓ Copied!' : '🔗 Copy Invite'}
                      </button>
                      <button
                        onClick={() => navigate(`/groups/${group.teamId}`)}
                        style={{ padding: '6px 12px', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => handleLeave(group.teamId, group.name)}
                        disabled={leaving === group.teamId}
                        style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: leaving === group.teamId ? 0.4 : 1 }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
                      >
                        {leaving === group.teamId ? '…' : 'Leave'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Always-visible join input at bottom */}
            <div className="cp-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <i className="ti ti-link" style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>Have an invite code?</span>
              <button onClick={() => setShowJoin(true)} className="cp-btn-secondary">
                Join with invite code
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
