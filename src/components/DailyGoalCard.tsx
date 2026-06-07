// src/components/DailyGoalCard.tsx
// Daily goal progress card with SVG ring indicators

import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import type { SolveLog } from '../types';

const DEFAULT_GOAL_PROBLEMS = 2;
const DEFAULT_GOAL_HOURS = 1;

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  if (t instanceof Date) return t.getTime();
  return new Date(t).getTime();
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── SVG Progress Ring ──────────────────────────────────────────────
interface RingProps {
  value: number;     // 0–100
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  sublabel: string;
}

function ProgressRing({ value, size = 80, strokeWidth = 7, color, label, sublabel }: RingProps) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const offset = circ - (pct / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="daily-goal-ring-wrap">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--bg-surface-2)" strokeWidth={strokeWidth} />
        {/* Fill */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Percentage text — needs counter-rotation */}
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cy}px`,
            fill: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
            fontFamily: 'var(--font)' }}
        >
          {Math.round(pct)}%
        </text>
      </svg>
      <div className="daily-goal-ring-label">{label}</div>
      <div className="daily-goal-ring-label" style={{ fontSize: 10, marginTop: -2 }}>{sublabel}</div>
    </div>
  );
}

interface Props {
  solves: SolveLog[];
}

export default function DailyGoalCard({ solves }: Props) {
  const { user, profile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editProblems, setEditProblems] = useState('');
  const [editHours, setEditHours] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user || !profile) return null;

  const goalProblems = profile.dailyGoalProblems ?? DEFAULT_GOAL_PROBLEMS;
  const goalHours    = profile.dailyGoalHours    ?? DEFAULT_GOAL_HOURS;

  // Today's solves
  const todayKey = getTodayKey();
  const todaySolves = solves.filter(s => {
    const ms = getMillis(s.solvedAt);
    if (!ms) return false;
    const d = new Date(ms);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === todayKey && s.accepted;
  });

  const todayProblems = todaySolves.length;
  const todayHours    = todaySolves.reduce((acc, s) => acc + (s.totalTime ?? 0) / 60, 0);

  const problemsPct = goalProblems > 0 ? (todayProblems / goalProblems) * 100 : 0;
  const hoursPct    = goalHours > 0    ? (todayHours    / goalHours)    * 100 : 0;

  const bothDone = problemsPct >= 100 && hoursPct >= 100;

  const getRingColor = (pct: number) => {
    if (pct >= 100) return 'var(--success)';
    if (pct >= 80)  return 'var(--warning)';
    return 'var(--accent)';
  };

  const saveGoals = async () => {
    const p = parseInt(editProblems);
    const h = parseFloat(editHours);
    if (isNaN(p) || isNaN(h) || p < 1 || h < 0.25) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        dailyGoalProblems: p,
        dailyGoalHours: h,
      });
      setEditing(false);
    } catch (err) {
      console.error('Failed to save goals:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="daily-goal-card">
      {bothDone ? (
        <div className="daily-goal-banner">
          <i className="ti ti-circle-check" style={{ fontSize: '1.25rem' }} />
          Goal reached today! ✓
        </div>
      ) : (
        <>
          <ProgressRing
            value={problemsPct}
            color={getRingColor(problemsPct)}
            label={`${todayProblems} / ${goalProblems} problems`}
            sublabel="Today"
          />
          <ProgressRing
            value={hoursPct}
            color={getRingColor(hoursPct)}
            label={`${todayHours.toFixed(1)} / ${goalHours} hrs`}
            sublabel="Today"
          />
        </>
      )}

      {/* Edit goal */}
      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Problems/day</label>
              <input type="number" min={1} max={50} value={editProblems}
                onChange={e => setEditProblems(e.target.value)}
                className="form-input" style={{ width: 60, textAlign: 'center', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Hours/day</label>
              <input type="number" min={0.25} max={24} step={0.25} value={editHours}
                onChange={e => setEditHours(e.target.value)}
                className="form-input" style={{ width: 60, textAlign: 'center', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={saveGoals} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="cp-btn-ghost"
            style={{ fontSize: 11 }}
            onClick={() => { setEditProblems(String(goalProblems)); setEditHours(String(goalHours)); setEditing(true); }}
          >
            <i className="ti ti-settings" style={{ fontSize: 12 }} /> Edit goals
          </button>
        )}
      </div>
    </div>
  );
}
