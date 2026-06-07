// src/components/RankBadge.tsx

const RANK_COLORS: Record<string, { text: string; bg: string }> = {
  'Newbie':           { text: '#5F5E5A', bg: '#F1EFE8' },
  'Pupil':            { text: '#3B6D11', bg: '#EAF3DE' },
  'Specialist':       { text: '#0F6E56', bg: '#E1F5EE' },
  'Expert':           { text: '#185FA5', bg: '#E6F1FB' },
  'Candidate Master': { text: '#534AB7', bg: '#EEEDFE' },
  'Master':           { text: '#854F0B', bg: '#FAEEDA' },
};

interface RankBadgeProps {
  rank: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const colors = RANK_COLORS[rank] ?? { text: '#8B949E', bg: '#21262D' };
  return (
    <span
      className={`rank-badge rank-badge--${size}`}
      style={{ color: colors.text, background: colors.bg }}
    >
      {rank}
    </span>
  );
}

export default RankBadge;
