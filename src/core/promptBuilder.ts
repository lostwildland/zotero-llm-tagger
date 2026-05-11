import { PromptConfig, TaggingConfig } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildDocumentContext(
  item: Zotero.Item,
  availableTags: string[],
  taggingConfig: TaggingConfig,
  attachmentText = "",
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
    attachmentText,
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
    "4) attachmentText may be an excerpt; prefer stable topic/method tags over one-off details",
  ].join("\n");
}

export function buildChatMessages(
  prompt: PromptConfig,
  item: Zotero.Item,
  availableTags: string[],
  taggingConfig: TaggingConfig,
  attachmentText = "",
): ChatMessage[] {
  const context = buildDocumentContext(
    item,
    availableTags,
    taggingConfig,
    attachmentText,
  );

  return [
    {
      role: "system",
      content: prompt.systemPrompt,
    },
    {
      role: "user",
      content: prompt.userPrompt,
    },
    {
      role: "user",
      content: context,
    },
  ];
}
