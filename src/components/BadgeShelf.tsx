import { BADGES } from '../lib/badges';

interface Props {
  unlockedIds: string[];
  /** Per-badge unlock timestamps (optional, displayed if provided) */
  unlockDates?: Record<string, string>;
}

/**
 * BadgeShelf — displays every badge in the registry.
 * Unlocked badges glow with their accent color; locked ones are desaturated.
 */
export function BadgeShelf({ unlockedIds, unlockDates = {} }: Props) {
  const unlockedSet = new Set(unlockedIds);

  return (
    <div className="badge-shelf">
      <h3 className="badge-shelf__title">Badges</h3>
      <div className="badge-shelf__grid">
        {BADGES.map(badge => {
          const unlocked = unlockedSet.has(badge.id);
          const date     = unlockDates[badge.id];

          return (
            <div
              key={badge.id}
              className={`badge-card ${unlocked ? 'badge-card--unlocked' : 'badge-card--locked'}`}
              title={unlocked ? badge.description : `Locked — ${badge.description}`}
            >
              <div className="badge-card__icon">{badge.icon}</div>
              <div className="badge-card__name">{badge.name}</div>
              {unlocked && date && (
                <div className="badge-card__date">{date}</div>
              )}
              {!unlocked && (
                <div className="badge-card__locked-label">Locked</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
