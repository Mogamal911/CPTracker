import { useEffect, useState } from 'react';
import { getBadge } from '../lib/badges';

interface Props {
  badgeIds: string[];
  onDismiss: () => void;
}

/**
 * BadgeToast — slides in from the right for each newly unlocked badge,
 * stays for 3 seconds, then fades out. Supports a queue.
 */
export function BadgeToast({ badgeIds, onDismiss }: Props) {
  const [_queue, setQueue] = useState<string[]>(badgeIds);
  const [current, setCurrent]   = useState<string | null>(badgeIds[0] ?? null);
  const [visible, setVisible]   = useState(true);

  useEffect(() => {
    if (!current) return;

    // Auto-dismiss after 3 s
    const show  = setTimeout(() => setVisible(false), 3000);
    const clear = setTimeout(() => {
      setQueue(q => {
        const next = q.slice(1);
        setCurrent(next[0] ?? null);
        if (next.length === 0) onDismiss();
        return next;
      });
      setVisible(true);
    }, 3500);

    return () => { clearTimeout(show); clearTimeout(clear); };
  }, [current]);

  if (!current) return null;

  const badge = getBadge(current);

  return (
    <div
      className={`badge-toast ${visible ? 'badge-toast--in' : 'badge-toast--out'}`}
      role="status"
      aria-live="polite"
    >
      <div className="badge-toast__icon">{badge.icon}</div>
      <div className="badge-toast__body">
        <div className="badge-toast__label">New badge unlocked!</div>
        <div className="badge-toast__name">{badge.name}</div>
      </div>
      <button
        className="badge-toast__close"
        onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
