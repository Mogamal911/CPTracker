import { useState } from 'react';
import { doc, collection, writeBatch, Timestamp, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { calculateXP, getRank } from '../lib/xp';
import { evaluateBadges } from '../lib/badges';
import type { SolveLog, UserProfile } from '../types';

export function useSolveSubmit() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const submitSolve = async (
    solveData: Omit<SolveLog, 'solveId' | 'userId' | 'teamId' | 'xpEarned' | 'solvedAt'>
  ) => {
    if (!user) throw new Error('You must be signed in to log a solve.');

    setSubmitting(true);
    setError(null);

    try {
      const solveRef = doc(collection(db, 'solves'));
      const userRef  = doc(db, 'users', user.uid);

      // Determine XP using the centralized formula
      let xpEarned = 0;
      if (solveData.accepted) {
        const xpCalc = calculateXP({
          difficulty: solveData.difficulty,
          totalTime: solveData.totalTime,
          accepted: true,
          wa: solveData.wa,
          tle: solveData.tle,
          sourceType: solveData.sourceType,
        });
        xpEarned = xpCalc.xp;
      }

      const sanitizedSolveData = {
        platform:     solveData.platform ?? null,
        problemName:  solveData.problemName,
        problemLink:  solveData.problemLink ?? null,
        difficulty:   solveData.difficulty ?? null,
        totalTime:    solveData.totalTime,
        accepted:     solveData.accepted ?? null,
        notes:        solveData.notes ?? null,
        sourceType:   solveData.sourceType ?? null,
        wa:           solveData.wa ?? null,
        tle:          solveData.tle ?? null,
        re:           solveData.re ?? null,
        ce:           solveData.ce ?? null,
        wrongAnswers: solveData.wrongAnswers ?? solveData.wa ?? null,
      };

      const finalSolve: SolveLog = {
        ...sanitizedSolveData,
        solveId:  solveRef.id,
        userId:   user.uid,
        teamId:   '', // placeholder or set teamId if needed, we'll keep it simple
        xpEarned,
        solvedAt: Timestamp.now(),
      };

      // ── 1. Run the primary atomic batched write ──
      const batch = writeBatch(db);
      batch.set(solveRef, finalSolve);

      // totalTime is in minutes, so hours = totalTime / 60
      const hoursIncrement = solveData.totalTime / 60;

      if (solveData.accepted) {
        batch.update(userRef, {
          xp:          increment(xpEarned),
          totalSolves: increment(1),
          totalHours:  increment(hoursIncrement),
        });
      } else {
        batch.update(userRef, {
          totalHours:  increment(hoursIncrement),
        });
      }

      await batch.commit();

      // ── 2. Read the new fresh profile state after the write ──
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        throw new Error('User profile does not exist.');
      }
      const freshProfile = userSnap.data() as UserProfile;

      // ── 3. Update Rank ──
      const newRank = getRank(freshProfile.xp);

      // ── 4. Update Streak ──
      const today = new Date().toISOString().split('T')[0];
      const dYesterday = new Date();
      dYesterday.setDate(dYesterday.getDate() - 1);
      const yesterday = dYesterday.toISOString().split('T')[0];

      const lastSolveDate = freshProfile.lastSolveDate;
      let nextStreak = freshProfile.streak || 0;

      if (!lastSolveDate) {
        nextStreak = 1;
      } else if (lastSolveDate === yesterday) {
        nextStreak += 1;
      } else if (lastSolveDate === today) {
        // Unchanged
      } else if (lastSolveDate < yesterday) {
        nextStreak = 1;
      }

      // ── 5. Check Badge Conditions ──
      const { newlyUnlocked, allUnlocked } = evaluateBadges(
        freshProfile.badges || [],
        { totalSolves: freshProfile.totalSolves, streak: nextStreak }
      );

      // ── 6. Save updates back to Firestore doc ──
      const userUpdates: any = {
        rank:          newRank,
        streak:        nextStreak,
        lastSolveDate: today,
        badges:        allUnlocked,
      };

      if (newlyUnlocked.length > 0) {
        userUpdates.newlyUnlockedBadges = newlyUnlocked;
      }
      if (freshProfile.rank !== newRank) {
        userUpdates.pendingRankUp = newRank;
      }

      await updateDoc(userRef, userUpdates);

      return {
        success:   true,
        xpEarned,
        accepted:  solveData.accepted,
        rankUp:    freshProfile.rank !== newRank,
        newRank:   freshProfile.rank !== newRank ? newRank : undefined,
        newBadges: newlyUnlocked,
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
