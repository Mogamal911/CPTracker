// src/components/RankUpOverlay.tsx
import React, { useEffect, useState } from 'react';
import { RankBadge } from './RankBadge';

interface Props {
  oldRank: string;
  newRank: string;
  onDismiss: () => void;
}

/**
 * RankUpOverlay — full-screen moment when rank increases.
 * Pure CSS confetti using 40 pseudo-elements so no external lib is needed.
 */
export function RankUpOverlay({ oldRank, newRank, onDismiss }: Props) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('exit'), 4000);
    const t3 = setTimeout(() => onDismiss(), 4600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div
      className={`rankup-overlay rankup-overlay--${phase}`}
      onClick={onDismiss}
      role="dialog"
      aria-label={`Rank up to ${newRank}`}
    >
      {/* CSS confetti particles */}
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <span
            key={i}
            className="confetti__piece"
            style={{
              '--i':   i,
              '--col': `hsl(${(i * 37) % 360}, 80%, 60%)`,
              '--x':   `${Math.random() * 100}vw`,
              '--dur': `${0.8 + Math.random() * 1.2}s`,
              '--del': `${Math.random() * 0.6}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="rankup-card" onClick={e => e.stopPropagation()}>
        <h2 className="rankup-card__headline">🎉 Rank Up!</h2>

        <div className="rankup-card__rank-row">
          <RankBadge rank={oldRank} size="lg" />
          <div className="rankup-card__arrow">→</div>
          <RankBadge rank={newRank} size="lg" />
        </div>

        <p className="rankup-card__sub">
          You've reached&nbsp;<strong>{newRank}</strong>!
          Keep grinding!
        </p>
        <button className="rankup-card__btn" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
}
