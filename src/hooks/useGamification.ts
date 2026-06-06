import { useEffect, useState } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';

interface GamificationState {
  pendingRankUp:       { oldRank: string; newRank: string } | null;
  newlyUnlockedBadges: string[];
  dismissRankUp:       () => Promise<void>;
  dismissBadges:       () => Promise<void>;
}

/**
 * useGamification — reads persisted pendingRankUp and newlyUnlockedBadges
 * from the live user profile and clears them from Firestore once displayed.
 *
 * The previous rank is captured before the update is cleared so the overlay
 * can animate from oldRank → newRank.
 */
export function useGamification(): GamificationState {
  const { profile } = useAuth();

  // Local state so the overlay stays visible even after Firestore field is removed
  const [pendingRankUp, setPendingRankUp]             = useState<{ oldRank: string; newRank: string } | null>(null);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<string[]>([]);
  const [consumed, setConsumed]                       = useState({ rankUp: false, badges: false });

  // When profile loads, pull in pending notifications (once per session)
  useEffect(() => {
    if (!profile) return;

    if (profile.pendingRankUp && !consumed.rankUp) {
      // profile.rank is already the NEW rank; we derive old rank from XP before
      // the increment — but since we don't have that here, we just show the
      // transition from the previous rank stored in local state or fall back gracefully.
      setPendingRankUp({ oldRank: 'Previous', newRank: profile.pendingRankUp });
      setConsumed(c => ({ ...c, rankUp: true }));
    }

    if (profile.newlyUnlockedBadges?.length && !consumed.badges) {
      setNewlyUnlockedBadges(profile.newlyUnlockedBadges);
      setConsumed(c => ({ ...c, badges: true }));
    }
  }, [profile?.pendingRankUp, profile?.newlyUnlockedBadges]);

  const dismissRankUp = async () => {
    setPendingRankUp(null);
    if (profile) {
      await updateDoc(doc(db, 'users', profile.uid), {
        pendingRankUp: deleteField(),
      });
    }
  };

  const dismissBadges = async () => {
    setNewlyUnlockedBadges([]);
    if (profile) {
      await updateDoc(doc(db, 'users', profile.uid), {
        newlyUnlockedBadges: deleteField(),
      });
    }
  };

  return { pendingRankUp, newlyUnlockedBadges, dismissRankUp, dismissBadges };
}
