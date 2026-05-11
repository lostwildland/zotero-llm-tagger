import { ParsedSuggestion, TagPolicy } from "./types";

function parseJSON(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("The model response is not valid JSON.");
    }
    return JSON.parse(match[0]);
  }
}

function normalizeTag(tag: unknown): string {
  if (typeof tag !== "string") return "";
  return tag.trim();
}

export function parseSuggestionResponse(
  content: string,
  availableTags: string[],
  tagPolicy: TagPolicy,
  maxSuggestedTags: number,
): ParsedSuggestion {
  const parsed = parseJSON(content);
  const reasoning =
    typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";
  const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];

  const availableSet = new Set(availableTags);
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of rawTags) {
    const tag = normalizeTag(rawTag);
    if (!tag || seen.has(tag)) continue;
    if (tagPolicy !== "allow_new" && !availableSet.has(tag)) continue;
    seen.add(tag);
    deduped.push(tag);
    if (deduped.length >= maxSuggestedTags) break;
  }

  const existingTags = deduped.filter((tag) => availableSet.has(tag));
  const newTags = deduped.filter((tag) => !availableSet.has(tag));

  return {
    tags: deduped,
    existingTags,
    newTags,
    reasoning,
  };
}
