// src/pages/GroupDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { leaveGroup } from '../services/groupService';
import { getRank } from '../lib/xp';
import { RankBadge } from '../components/RankBadge';
import type { Team, UserProfile } from '../types';

export const GroupDetailPage = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team,    setTeam]    = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    const ref = doc(db, 'teams', teamId);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) { setTeam(snap.data() as Team); }
      else { setTeam(null); setLoading(false); }
    }, err => { console.error('Error loading team:', err); setLoading(false); });
  }, [teamId]);

  // Redirect non-members to join page
  useEffect(() => {
    if (loading || !team) return;
    if (user && !team.members.includes(user.uid)) {
      navigate(`/join/${team.inviteCode}`);
    }
  }, [team, user, loading, navigate]);

  useEffect(() => {
    if (!team) return;
    if (team.members.length === 0) { setMembers([]); setLoading(false); return; }
    const chunks: string[][] = [];
    for (let i = 0; i < team.members.length; i += 30) chunks.push(team.members.slice(i, i + 30));
    Promise.all(chunks.map(chunk => getDocs(query(collection(db, 'users'), where('uid', 'in', chunk))).then(s => s.docs.map(d => d.data() as UserProfile))))
      .then(results => {
        const flat = results.flat();
        flat.sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
        setMembers(flat);
        setLoading(false);
      })
      .catch(err => { console.error('Error fetching members:', err); setMembers([]); setLoading(false); });
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
    try { await leaveGroup(team.teamId, user.uid); navigate('/groups'); }
    catch (err: any) { alert(err.message || 'Failed to leave group'); setLeaving(false); }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
      <div style={{ width: 48, height: 48, border: '4px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!team) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>😕</div>
        <p style={{ fontSize: 18, fontWeight: 700 }}>Group not found</p>
        <button onClick={() => navigate('/groups')} style={{ color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>Back to Groups</button>
      </div>
    </div>
  );

  const isCreator = user?.uid === team.createdBy;
  const isMember  = user ? team.members.includes(user.uid) : false;

  return (
    <div className="page-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 40, left: 40, width: 384, height: 384, background: 'rgba(29,158,117,0.04)', borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 896, margin: '0 auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Header */}
        <div className="cp-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 64, height: 64, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🛡️</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{team.name}</h1>
                    {isCreator && (
                      <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,159,39,0.1)', color: 'var(--warning)', border: '1px solid rgba(239,159,39,0.2)' }}>Owner</span>
                    )}
                  </div>
                  {team.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px' }}>{team.description}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ fontFamily: 'monospace' }}>{team.members.length} members</span>
                    <span>·</span>
                    <span>Invite code: <strong style={{ color: 'var(--accent)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{team.inviteCode}</strong></span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={handleCopyLink} style={{ padding: '8px 16px', background: 'var(--accent)', color: 'white', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {copied ? '✓ Copied!' : '🔗 Copy Invite Link'}
                </button>
                <button onClick={() => navigate('/groups')} style={{ padding: '8px 16px', background: 'var(--bg-surface-2)', color: 'var(--text-secondary)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ← Back
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Members */}
        <section className="cp-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', margin: 0 }}>Members</h2>
          </div>

          {members.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 14 }}>No members in this group yet.</div>
          ) : (
            <div>
              {members.map((member, idx) => {
                const isCurrentUser = user?.uid === member.uid;
                const rank = getRank(member.xp ?? 0);
                return (
                  <div
                    key={member.uid}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 20px', borderBottom: '1px solid var(--border)',
                      background: isCurrentUser ? 'rgba(29,158,117,0.04)' : 'transparent',
                      borderLeft: isCurrentUser ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-secondary)', fontFamily: 'monospace', width: 24, textAlign: 'center', flexShrink: 0 }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </span>
                      <img
                        src={member.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.username || member.displayName)}
                        alt={member.username || member.displayName}
                        style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          {member.username || member.displayName}
                          {isCurrentUser && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 10, background: 'rgba(29,158,117,0.15)', color: 'var(--accent)', border: '1px solid rgba(29,158,117,0.3)', fontWeight: 700, textTransform: 'uppercase' }}>You</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <RankBadge rank={rank} size="sm" />
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {member.totalSolves ?? 0} solves · {member.streak ?? 0}🔥
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: 'var(--success)' }}>{member.xp ?? 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>XP</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Leave group */}
        {isMember && !isCreator && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleLeave} disabled={leaving}
              style={{ padding: '10px 24px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', opacity: leaving ? 0.4 : 1 }}
              onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(226,75,74,0.3)'; }}
              onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
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
