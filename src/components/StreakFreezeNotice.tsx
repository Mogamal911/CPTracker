

interface Props {
  message?: string;
}

/**
 * StreakFreezeNotice — shows briefly after a streak is protected by a freeze.
 */
export function StreakFreezeNotice({ message = 'Streak protected! ❄️' }: Props) {
  return (
    <div className="streak-freeze-notice" role="status" aria-live="polite">
      <span className="streak-freeze-notice__icon">❄️</span>
      <div>
        <div className="streak-freeze-notice__title">Streak Freeze Used</div>
        <div className="streak-freeze-notice__body">{message}</div>
      </div>
    </div>
  );
}
