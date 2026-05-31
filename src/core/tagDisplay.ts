export interface ItemTagLike {
  tag?: string;
}

export function normalizeDisplayTags(
  tags: Array<ItemTagLike | string>,
): string[] {
  const unique = new Set<string>();

  for (const tagLike of tags) {
    const tag = (typeof tagLike === "string" ? tagLike : tagLike.tag || "")
      .trim();
    if (!tag || tag.startsWith("_")) continue;
    unique.add(tag);
  }

  return [...unique].sort((a, b) => a.localeCompare(b));
}

export function encodeTagColumnData(tags: string[]): string {
  return JSON.stringify(normalizeDisplayTags(tags));
}

export function decodeTagColumnData(data: string): string[] {
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return normalizeDisplayTags(
      parsed.filter((tag): tag is string => typeof tag === "string"),
    );
  } catch (_error) {
    return [];
  }
}

export function formatTagColumnTooltip(tags: string[]): string {
  return normalizeDisplayTags(tags).join(", ");
}
