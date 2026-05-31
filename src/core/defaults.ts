import {
  ApplyMode,
  PromptConfig,
  ProviderConfig,
  QueueConfig,
  TagPolicy,
  TaggingConfig,
} from "./types";

export const DEFAULT_PROMPT_TEXT =
  "Analyze the provided document context and suggest concise, accurate tags.";

export const LEGACY_DEFAULT_SYSTEM_PROMPT =
  "You are a research librarian helping categorize academic documents. Return strict JSON only.";

export const LEGACY_DEFAULT_USER_PROMPT = DEFAULT_PROMPT_TEXT;

export const DEFAULT_PROVIDER: ProviderConfig = {
  provider: "openai",
  apiMode: "chat",
  baseURL: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o-mini",
  azureEndpoint: "",
  azureDeployment: "gpt-4.1-mini",
  azureApiVersion: "2024-12-01-preview",
};

export const DEFAULT_PROMPT: PromptConfig = {
  prompt: DEFAULT_PROMPT_TEXT,
};

export const DEFAULT_TAG_POLICY: TagPolicy = "existing_only";
export const DEFAULT_APPLY_MODE: ApplyMode = "preview_then_apply";

export const DEFAULT_TAGGING: TaggingConfig = {
  tagPolicy: DEFAULT_TAG_POLICY,
  applyMode: DEFAULT_APPLY_MODE,
  customTagList: "",
  maxSuggestedTags: 8,
  temperature: 0.1,
  maxTokens: 1000,
};

export const DEFAULT_QUEUE: QueueConfig = {
  maxConcurrency: 3,
  minRequestIntervalMs: 800,
  maxRetries: 3,
};
