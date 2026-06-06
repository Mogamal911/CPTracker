import { useGamification } from '../hooks/useGamification';
import { RankUpOverlay }   from './RankUpOverlay';
import { BadgeToast }      from './BadgeToast';

/**
 * GamificationLayer — mounts globally in App.tsx.
 * Reads pending events from Firestore via useGamification and renders:
 *   • RankUpOverlay (full-screen, highest z-index)
 *   • BadgeToast    (bottom-right toast, shown after rank overlay clears)
 */
export function GamificationLayer() {
  const {
    pendingRankUp,
    newlyUnlockedBadges,
    dismissRankUp,
    dismissBadges,
  } = useGamification();

  return (
    <>
      {pendingRankUp && (
        <RankUpOverlay
          oldRank={pendingRankUp.oldRank}
          newRank={pendingRankUp.newRank}
          onDismiss={dismissRankUp}
        />
      )}

      {newlyUnlockedBadges.length > 0 && !pendingRankUp && (
        <BadgeToast
          badgeIds={newlyUnlockedBadges}
          onDismiss={dismissBadges}
        />
      )}
    </>
  );
}
