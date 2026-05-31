export type ProviderType = "openai" | "azure" | "compatible";

export type ApiMode = "chat";

export type TagPolicy = "existing_only" | "allow_new" | "custom_list";

export type ApplyMode = "auto_apply" | "preview_then_apply";

export interface PromptConfig {
  prompt: string;
}

export interface ProviderConfig {
  provider: ProviderType;
  apiMode: ApiMode;
  baseURL: string;
  apiKey: string;
  model: string;
  azureEndpoint: string;
  azureDeployment: string;
  azureApiVersion: string;
}

export interface TaggingConfig {
  tagPolicy: TagPolicy;
  applyMode: ApplyMode;
  customTagList: string;
  maxSuggestedTags: number;
  temperature: number;
  maxTokens: number;
}

export interface QueueConfig {
  maxConcurrency: number;
  minRequestIntervalMs: number;
  maxRetries: number;
}

export interface RuntimeConfig {
  provider: ProviderConfig;
  prompt: PromptConfig;
  tagging: TaggingConfig;
  queue: QueueConfig;
}

export interface ItemContext {
  item: Zotero.Item;
  targetItem: Zotero.Item;
  availableTags: string[];
  currentTags: string[];
}

export interface ParsedSuggestion {
  tags: string[];
  existingTags: string[];
  newTags: string[];
  reasoning: string;
}

export interface SuggestionResult {
  itemID: number;
  title: string;
  existingTags: string[];
  newTags: string[];
  reasoning: string;
  status: "success" | "failed" | "skipped";
  appliedTags: string[];
  deferredTags: string[];
  error?: string;
}

export interface RetryableError extends Error {
  status?: number;
  shouldRetry?: boolean;
}
