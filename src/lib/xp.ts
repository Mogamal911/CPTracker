/** Simplified XP formula — no source bonus, no hint penalty, no WA penalty */
export function calculateXP(solve: {
  difficulty: 'easy' | 'medium' | 'hard';
  totalTime: number;  // in minutes
  accepted: boolean;
}): { xp: number } {
  if (!solve.accepted) return { xp: 0 };

  const base       = { easy: 10, medium: 25, hard: 60 }[solve.difficulty];
  const expectedMin = { easy: 20, medium: 40, hard: 90 }[solve.difficulty];
  const speedBonus = solve.totalTime < expectedMin ? 5 : 0;
  const xp         = Math.max(base + speedBonus, 3);

  return { xp };
}

export const RANKS = [
  { name: 'Newbie',           minXP: 0    },
  { name: 'Pupil',            minXP: 300  },
  { name: 'Specialist',       minXP: 800  },
  { name: 'Expert',           minXP: 1500 },
  { name: 'Candidate Master', minXP: 2500 },
  { name: 'Master',           minXP: 4000 },
];

export function getRank(xp: number): string {
  let currentRank = RANKS[0].name;
  for (const rank of RANKS) {
    if (xp >= rank.minXP) currentRank = rank.name;
  }
  return currentRank;
}

export function getNextRankXP(xp: number): number {
  for (const rank of RANKS) {
    if (rank.minXP > xp) return rank.minXP;
  }
  return -1; // Max rank reached
}
