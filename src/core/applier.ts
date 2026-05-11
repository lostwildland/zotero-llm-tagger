import { ApplyMode, SuggestionResult, TagPolicy } from "./types";

export function selectTagsForImmediateApply(
  currentTags: string[],
  suggestedExistingTags: string[],
  suggestedNewTags: string[],
  applyMode: ApplyMode,
  tagPolicy: TagPolicy,
): { immediateTags: string[]; deferredTags: string[] } {
  const current = new Set(currentTags);
  const existingCandidates = suggestedExistingTags.filter(
    (tag) => !current.has(tag),
  );
  const newCandidates = suggestedNewTags.filter((tag) => !current.has(tag));

  if (applyMode === "preview_then_apply") {
    return {
      immediateTags: [],
      deferredTags: [...existingCandidates, ...newCandidates],
    };
  }

  if (tagPolicy === "allow_new") {
    return {
      immediateTags: existingCandidates,
      deferredTags: newCandidates,
    };
  }

  return {
    immediateTags: existingCandidates,
    deferredTags: [],
  };
}

export async function applyTagsToItem(
  item: Zotero.Item,
  tags: string[],
): Promise<string[]> {
  const current = new Set(
    item
      .getTags()
      .map((tag) => tag.tag)
      .filter((tag): tag is string => Boolean(tag)),
  );
  const unique = [
    ...new Set(
      tags.map((tag) => tag.trim()).filter((tag) => tag && !current.has(tag)),
    ),
  ];
  if (unique.length === 0) {
    return [];
  }

  let applied = 0;
  for (const tag of unique) {
    item.addTag(tag);
    applied += 1;
  }

  if (applied > 0) {
    await item.saveTx();
  }

  return unique;
}

export function summarizeResultStats(results: SuggestionResult[]) {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let appliedTags = 0;

  for (const result of results) {
    if (result.status === "success") success += 1;
    if (result.status === "failed") failed += 1;
    if (result.status === "skipped") skipped += 1;
    appliedTags += result.appliedTags.length;
  }

  return {
    success,
    failed,
    skipped,
    appliedTags,
    total: results.length,
  };
}
