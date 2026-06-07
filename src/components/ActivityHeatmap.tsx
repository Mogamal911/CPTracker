// src/components/ActivityHeatmap.tsx
// GitHub-style activity heatmap — 52 weeks × 7 days

import { useMemo } from 'react';
import type { SolveLog } from '../types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SHOW_DAYS  = new Set([1, 3, 5]); // Mon, Wed, Fri (0 = Sun)

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Color level based on solve count
function getLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function getMillis(t: any): number {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (t.seconds) return t.seconds * 1000;
  if (t instanceof Date) return t.getTime();
  return new Date(t).getTime();
}

interface Props {
  solves: SolveLog[];
}

export default function ActivityHeatmap({ solves }: Props) {
  const { weeks, monthLabels } = useMemo(() => {
    // Build a map of date → count
    const countMap: Record<string, number> = {};
    for (const solve of solves) {
      const ms = getMillis(solve.solvedAt);
      if (!ms) continue;
      const d = new Date(ms);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      countMap[key] = (countMap[key] || 0) + 1;
    }

    // Build 52 weeks ending today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the last Sunday on or before today
    const todayDow = today.getDay(); // 0=Sun
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - todayDow);

    // Go back 51 weeks from lastSunday
    const startDate = new Date(lastSunday);
    startDate.setDate(lastSunday.getDate() - 51 * 7);

    // Build weeks array (52 cols × 7 rows)
    const weeks: Array<Array<{ date: string; count: number; level: number }>> = [];
    const monthLabelMap: Map<number, string> = new Map(); // column index → month label

    let prevMonth = -1;
    let currentDate = new Date(startDate);

    for (let week = 0; week < 52; week++) {
      const col: Array<{ date: string; count: number; level: number }> = [];
      // Check if the first day of this week starts a new month
      const firstDayOfWeek = new Date(currentDate);
      if (firstDayOfWeek.getMonth() !== prevMonth) {
        monthLabelMap.set(week, MONTH_NAMES[firstDayOfWeek.getMonth()]);
        prevMonth = firstDayOfWeek.getMonth();
      }

      for (let day = 0; day < 7; day++) {
        const d = new Date(currentDate);
        d.setDate(currentDate.getDate() + day);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const count = countMap[key] || 0;
        col.push({ date: key, count, level: getLevel(count) });
      }
      weeks.push(col);
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Build month labels array aligned with columns
    const monthLabels: Array<{ col: number; label: string; width: number }> = [];
    const entries = [...monthLabelMap.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < entries.length; i++) {
      const [col, label] = entries[i];
      const nextCol = i + 1 < entries.length ? entries[i + 1][0] : 52;
      const width = (nextCol - col) * 12; // 10px cell + 2px gap
      monthLabels.push({ col, label, width });
    }

    return { weeks, monthLabels };
  }, [solves]);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-title">Activity</div>
      <div className="heatmap-inner">
        {/* Month labels */}
        <div className="heatmap-months" style={{ marginLeft: 30 }}>
          {monthLabels.map(({ col, label, width }) => (
            <div
              key={col}
              className="heatmap-month-label"
              style={{ width, minWidth: width, flexShrink: 0 }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="heatmap-body">
          {/* Day labels */}
          <div className="heatmap-day-labels">
            {DAY_LABELS.map((label, i) => (
              <div key={label} className="heatmap-day-label">
                {SHOW_DAYS.has(i) ? label : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="heatmap-grid">
            {weeks.map((col, wi) => (
              <div key={wi} className="heatmap-col">
                {col.map((cell, di) => {
                  const [yyyy, mm, dd] = cell.date.split('-');
                  const dateLabel = `${MONTH_NAMES[parseInt(mm) - 1]} ${parseInt(dd)}, ${yyyy}`;
                  const tooltip = cell.count === 0
                    ? `No activity on ${dateLabel}`
                    : `${cell.count} problem${cell.count > 1 ? 's' : ''} on ${dateLabel}`;
                  return (
                    <div
                      key={di}
                      className={`heatmap-cell heatmap-${cell.level}`}
                      data-tooltip={tooltip}
                      aria-label={tooltip}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="heatmap-legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map(l => (
            <div key={l} className={`heatmap-legend-cell heatmap-${l}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
