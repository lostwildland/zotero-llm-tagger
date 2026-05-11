export function parseCommaSeparatedTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const token of input.split(/[,;，；\n]+/)) {
    const tag = token.trim();
    if (!tag) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }

  return tags;
}
