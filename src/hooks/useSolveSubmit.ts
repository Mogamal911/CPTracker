import { useState } from 'react';
import { doc, collection, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { calculateXP, getRank } from '../lib/xp';
import { evaluateBadges } from '../lib/badges';
import type { SolveLog, UserProfile } from '../types';

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function diffDays(dateStrA: string, dateStrB: string): number {
  const msA = new Date(dateStrA).getTime();
  const msB = new Date(dateStrB).getTime();
  return Math.round((msA - msB) / (1000 * 60 * 60 * 24));
}

export function useSolveSubmit() {
  const { user, profile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const submitSolve = async (
    solveData: Omit<SolveLog, 'solveId' | 'userId' | 'teamId' | 'xpEarned' | 'solvedAt'>
  ) => {
    if (!user) throw new Error('You must be signed in to log a solve.');

    // Fallback stub if Firestore profile hasn't loaded yet
    let effectiveProfile: UserProfile = profile ?? {
      uid:           user.uid,
      displayName:   user.displayName ?? 'Unknown',
      photoURL:      user.photoURL ?? '',
      teams:         [],
      xp:            0,
      rank:          'Newbie',
      streak:        0,
      totalSolves:   0,
      totalHours:    0,
      weeklyProblems: 0,
      weeklyHours:   0,
      badges:        [],
    };

    setSubmitting(true);
    setError(null);

    try {
      // ── 1. Build the solve document ──────────────────────────────────────
      const solveRef = doc(collection(db, 'solves'));
      const teamId   = (effectiveProfile.teams ?? [])[0] ?? '';

      const { xp } = calculateXP(solveData);

      const finalSolve: SolveLog = {
        ...solveData,
        solveId:  solveRef.id,
        userId:   effectiveProfile.uid,
        teamId,
        xpEarned: xp,
        solvedAt: Timestamp.now(),
      };

      // ── 2. Profile stat projections ──────────────────────────────────────
      const nextSolves = effectiveProfile.totalSolves + (solveData.accepted ? 1 : 0);
      const nextXP     = effectiveProfile.xp + xp;
      const nextHours  = effectiveProfile.totalHours + solveData.totalTime / 60;
      const newRank    = getRank(nextXP);

      // ── 3. Streak logic with one-per-month freeze ────────────────────────
      const todayStr              = getTodayString();
      const monthStr              = getMonthString();
      let newStreak               = effectiveProfile.streak;
      let newStreakFreezeMonth: string | null = effectiveProfile.streakFreezeUsedMonth ?? null;
      let streakFroze             = false;

      if (!effectiveProfile.lastSolveDate) {
        newStreak = 1;
      } else if (effectiveProfile.lastSolveDate !== todayStr) {
        const gap = diffDays(todayStr, effectiveProfile.lastSolveDate);
        if (gap === 1) {
          newStreak = effectiveProfile.streak + 1;
        } else if (gap === 2 && effectiveProfile.streak >= 7 && newStreakFreezeMonth !== monthStr) {
          newStreakFreezeMonth  = monthStr;
          streakFroze           = true;
        } else {
          newStreak = 1;
        }
      }

      // ── 4. Badge evaluation ──────────────────────────────────────────────
      const { newlyUnlocked, allUnlocked } = evaluateBadges(
        effectiveProfile.badges ?? [],
        { totalSolves: nextSolves, streak: newStreak }
      );

      // ── 5. Rank-up detection ─────────────────────────────────────────────
      const rankChanged   = effectiveProfile.rank !== newRank;
      const pendingRankUp = rankChanged ? newRank : null;

      // ── 6. Batched Firestore write ───────────────────────────────────────
      const batch   = writeBatch(db);
      const userRef = doc(db, 'users', effectiveProfile.uid);

      batch.set(solveRef, finalSolve);

      const userUpdates: Record<string, any> = {
        totalSolves:           nextSolves ?? 0,
        totalHours:            nextHours ?? 0,
        xp:                    nextXP ?? 0,
        rank:                  newRank ?? 'Newbie',
        streak:                newStreak ?? 0,
        lastSolveDate:         todayStr ?? null,
        badges:                allUnlocked ?? [],
        streakFreezeUsedMonth: newStreakFreezeMonth ?? effectiveProfile?.streakFreezeUsedMonth ?? null,
      };

      if (newlyUnlocked.length > 0) {
        userUpdates.newlyUnlockedBadges = newlyUnlocked;
      }
      if (pendingRankUp) {
        userUpdates.pendingRankUp = pendingRankUp;
      }

      batch.update(userRef, userUpdates);

      await batch.commit();

      return {
        success:   true,
        xpEarned:  xp,
        accepted:  solveData.accepted,
        rankUp:    rankChanged,
        newRank:   rankChanged ? newRank : undefined,
        newBadges: newlyUnlocked,
        streakFroze,
      };

    } catch (err: any) {
      console.error('Error submitting solve:', err);
      const msg = err.message || 'Failed to submit solve';
      setError(msg);
      throw new Error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return { submitSolve, submitting, error };
}
