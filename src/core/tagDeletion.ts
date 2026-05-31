import { normalizeDisplayTags } from "./tagDisplay";

export interface TagUsage {
  tag: string;
  count: number;
}

export interface DeleteTagResult {
  selected: number;
  matched: number;
  saved: number;
  failed: number;
  errors: string[];
}

export function collectTagUsage(items: Zotero.Item[]): TagUsage[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const tag of normalizeDisplayTags(item.getTags())) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export async function deleteTagFromItems(
  items: Zotero.Item[],
  targetTag: string,
): Promise<DeleteTagResult> {
  const tag = targetTag.trim();
  const result: DeleteTagResult = {
    selected: items.length,
    matched: 0,
    saved: 0,
    failed: 0,
    errors: [],
  };

  if (!tag || tag.startsWith("_")) {
    return result;
  }

  for (const item of items) {
    const currentTags = normalizeDisplayTags(item.getTags());
    if (!currentTags.includes(tag)) continue;

    result.matched += 1;

    try {
      if (!item.removeTag(tag)) continue;
      await item.saveTx();
      result.saved += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(toErrorMessage(error));
    }
  }

  return result;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
