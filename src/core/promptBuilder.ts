import { PromptConfig, TaggingConfig } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_INSTRUCTIONS =
  "You are a research librarian helping categorize academic documents.";

export function buildDocumentContext(
  item: Zotero.Item,
  availableTags: string[],
  taggingConfig: TaggingConfig,
): string {
  const currentTags = item
    .getTags()
    .map((tag) => tag.tag)
    .filter(Boolean);
  const payload = {
    title: item.getField("title") || "",
    abstract: item.getField("abstractNote") || "",
    publicationTitle: item.getField("publicationTitle") || "",
    currentTags,
    availableTags,
    maxSuggestedTags: taggingConfig.maxSuggestedTags,
    tagPolicy: taggingConfig.tagPolicy,
  };

  return [
    "DOCUMENT_CONTEXT_JSON:",
    JSON.stringify(payload),
    "RESPONSE_RULES:",
    '1) Return strict JSON with shape: {"tags": string[], "reasoning": string}',
    "2) Never include fields other than tags and reasoning",
    "3) tags must contain unique strings only",
  ].join("\n");
}

export function buildChatMessages(
  prompt: PromptConfig,
  item: Zotero.Item,
  availableTags: string[],
  taggingConfig: TaggingConfig,
): ChatMessage[] {
  const context = buildDocumentContext(item, availableTags, taggingConfig);

  return [
    {
      role: "system",
      content: SYSTEM_INSTRUCTIONS,
    },
    {
      role: "user",
      content: prompt.prompt,
    },
    {
      role: "user",
      content: context,
    },
  ];
}
