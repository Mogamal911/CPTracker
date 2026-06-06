
export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

/** Only 3 badges remain after removing contest/sheet features */
export const BADGES: Badge[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    icon: '🩸',
    description: 'Log your very first solved problem.',
    color: 'from-rose-500/20 to-rose-600/10 border-rose-500/30 text-rose-300',
  },
  {
    id: 'century',
    name: 'Century',
    icon: '💯',
    description: 'Solve 100 problems in total.',
    color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-300',
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    icon: '🔥',
    description: 'Maintain a 7-day solve streak.',
    color: 'from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-300',
  },
];

export const BADGE_MAP: Record<string, Badge> = Object.fromEntries(
  BADGES.map(b => [b.id, b])
);

export function evaluateBadges(
  currentBadges: string[],
  stats: { totalSolves: number; streak: number }
): { newlyUnlocked: string[]; allUnlocked: string[] } {
  const conditions: Record<string, boolean> = {
    first_blood: stats.totalSolves >= 1,
    century:     stats.totalSolves >= 100,
    on_fire:     stats.streak >= 7,
  };

  const allUnlocked = [...currentBadges];
  const newlyUnlocked: string[] = [];

  for (const badge of BADGES) {
    if (conditions[badge.id] && !allUnlocked.includes(badge.id)) {
      allUnlocked.push(badge.id);
      newlyUnlocked.push(badge.id);
    }
  }

  return { newlyUnlocked, allUnlocked };
}

export function getBadge(id: string): Badge {
  return BADGE_MAP[id] ?? {
    id,
    name: id,
    icon: '🏅',
    description: '',
    color: 'from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300',
  };
}
