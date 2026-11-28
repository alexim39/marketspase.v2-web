export const MAX_PROFILE_TAGS = 10;
export const MAX_PROFILE_TAG_LENGTH = 40;

/** Accept legacy strings and arrays; trim, dedupe, cap for the API contract. */
export function normalizeProfileTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    for (const part of String(entry ?? '').split(',')) {
      const tag = part.replace(/\s+/g, ' ').trim().slice(0, MAX_PROFILE_TAG_LENGTH);
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= MAX_PROFILE_TAGS) return tags;
    }
  }
  return tags;
}
