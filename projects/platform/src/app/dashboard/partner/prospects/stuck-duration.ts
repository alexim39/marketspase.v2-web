/**
 * Humanize a day count as year/month/week/day parts for stuck badges.
 * Calendar-approximate (365/30/7) — attention display, not accounting.
 * Zero and nonzero parts omitted: 1 → `1d`, 10 → `1w 3d`,
 * 40 → `1m 1w 3d`, 405 → `1y 1m 1w 3d`.
 */
export function formatStuckDuration(totalDays: number): string {
  const total = Math.max(0, Math.floor(Number(totalDays) || 0));
  if (total === 0) return 'today';
  let rem = total;
  const years = Math.floor(rem / 365);
  rem -= years * 365;
  const months = Math.floor(rem / 30);
  rem -= months * 30;
  const weeks = Math.floor(rem / 7);
  rem -= weeks * 7;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}m`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (rem > 0) parts.push(`${rem}d`);
  return parts.join(' ');
}
