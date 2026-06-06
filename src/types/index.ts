import type { Timestamp } from 'firebase/firestore';

export interface SolveLog {
  solveId: string;
  userId: string;
  teamId: string;          // first team or '' if no team
  platform?: 'codeforces' | 'atcoder' | 'leetcode' | null;
  problemName: string;
  problemLink?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  totalTime: number;       // in minutes
  accepted?: boolean | null;
  notes?: string | null;
  xpEarned: number;
  solvedAt: Timestamp;
  sourceType?: 'practice' | 'sheet' | 'contest' | null;
  wa?: number | null;
  tle?: number | null;
  re?: number | null;
  ce?: number | null;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  username?: string;        // unique, 3-20 chars, letters/numbers/underscores
  handle_cf?: string;
  handle_ac?: string;
  handle_lc?: string;
  teamId?: string;          // legacy — kept for backward compat, not used in new code
  teams: string[];          // array of teamIds (multi-group support)
  xp: number;
  rank: string;
  streak: number;
  lastSolveDate?: string;   // 'YYYY-MM-DD'
  totalSolves: number;
  totalHours: number;
  weeklyProblems: number;
  weeklyHours: number;
  badges: string[];
  streakFreezeUsedMonth?: string;  // 'YYYY-MM'
  pendingRankUp?: string;
  newlyUnlockedBadges?: string[];
}

export interface Team {
  teamId: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdBy: string;
  members: string[];        // array of uids
  createdAt: Timestamp;
}

/** Stored at usernames/{username} for O(1) uniqueness lookups and reverse search */
export interface UsernameDoc {
  uid: string;
}

/** Stored at friendships/{uid}/friends/{friendUid} */
export interface Friendship {
  friendUid: string;
  addedAt: Timestamp;
}

