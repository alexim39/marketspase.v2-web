/**
 * Small fuzzy matcher for search dead-ends. It normalises case and common
 * separators, then returns the closest real values by edit distance.
 */
export function suggestClosest(query: string, candidates: string[], limit = 3): string[] {
  const needle = normalise(query);
  if (!needle) return [];
  const threshold = Math.max(2, Math.ceil(needle.length * 0.5));
  return [...new Set(candidates)]
    .map((value) => {
      const haystack = normalise(value);
      const words = haystack.split(' ');
      const score = Math.min(
        distance(needle, haystack),
        ...words.map((word) => distance(needle, word)),
        haystack.startsWith(needle) ? 0 : Number.POSITIVE_INFINITY,
      );
      return { value, distance: score };
    })
    .filter((entry) => entry.distance <= threshold)
    .sort((a, b) => a.distance - b.distance || a.value.localeCompare(b.value))
    .slice(0, limit)
    .map((entry) => entry.value);
}

function normalise(value: string): string {
  return String(value ?? '').trim().toLowerCase().replace(/[\s._-]+/g, ' ');
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const row = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = row[j];
  }
  return prev[b.length];
}
