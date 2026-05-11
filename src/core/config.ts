import {
  DEFAULT_APPLY_MODE,
  DEFAULT_PROMPT,
  DEFAULT_PROVIDER,
  DEFAULT_QUEUE,
  DEFAULT_TAG_POLICY,
  DEFAULT_TAGGING,
} from "./defaults";
import { ApplyMode, ProviderType, RuntimeConfig, TagPolicy } from "./types";
import { getPref } from "../utils/prefs";
import { parseCommaSeparatedTags } from "./tagList";

function toInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return Math.max(min, Math.min(max, rounded));
}

function toFloat(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function toBool(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return fallback;
}

export function getRuntimeConfig(): RuntimeConfig {
  const provider = (getPref("provider") ||
    DEFAULT_PROVIDER.provider) as ProviderType;
  const tagPolicy = (getPref("tagPolicy") || DEFAULT_TAG_POLICY) as TagPolicy;
  const applyMode = (getPref("applyMode") || DEFAULT_APPLY_MODE) as ApplyMode;

  return {
    provider: {
      provider,
      apiMode: "chat",
      baseURL: (getPref("baseURL") || DEFAULT_PROVIDER.baseURL).trim(),
      apiKey: (getPref("apiKey") || DEFAULT_PROVIDER.apiKey).trim(),
      model: (getPref("model") || DEFAULT_PROVIDER.model).trim(),
      azureEndpoint: (
        getPref("azureEndpoint") || DEFAULT_PROVIDER.azureEndpoint
      ).trim(),
      azureDeployment: (
        getPref("azureDeployment") || DEFAULT_PROVIDER.azureDeployment
      ).trim(),
      azureApiVersion: (
        getPref("azureApiVersion") || DEFAULT_PROVIDER.azureApiVersion
      ).trim(),
    },
    prompt: {
      systemPrompt: getPref("systemPrompt") || DEFAULT_PROMPT.systemPrompt,
      userPrompt: getPref("userPrompt") || DEFAULT_PROMPT.userPrompt,
    },
    tagging: {
      tagPolicy,
      applyMode,
      customTagList: (
        getPref("customTagList") || DEFAULT_TAGGING.customTagList
      ).trim(),
      maxSuggestedTags: toInt(
        getPref("maxSuggestedTags"),
        DEFAULT_TAGGING.maxSuggestedTags,
        1,
        32,
      ),
      temperature: toFloat(
        getPref("temperature"),
        DEFAULT_TAGGING.temperature,
        0,
        2,
      ),
      maxTokens: toInt(
        getPref("maxTokens"),
        DEFAULT_TAGGING.maxTokens,
        64,
        4096,
      ),
      includeAttachmentText: toBool(
        getPref("includeAttachmentText"),
        DEFAULT_TAGGING.includeAttachmentText,
      ),
      maxAttachmentChars: toInt(
        getPref("maxAttachmentChars"),
        DEFAULT_TAGGING.maxAttachmentChars,
        0,
        50000,
      ),
    },
    queue: {
      maxConcurrency: toInt(
        getPref("maxConcurrency"),
        DEFAULT_QUEUE.maxConcurrency,
        1,
        16,
      ),
      minRequestIntervalMs: toInt(
        getPref("minRequestIntervalMs"),
        DEFAULT_QUEUE.minRequestIntervalMs,
        0,
        30000,
      ),
      maxRetries: toInt(getPref("maxRetries"), DEFAULT_QUEUE.maxRetries, 0, 8),
    },
  };
}

export function validateRuntimeConfig(config: RuntimeConfig): string[] {
  const errors: string[] = [];
  const { provider, prompt } = config;

  if (!prompt.systemPrompt || prompt.systemPrompt.trim().length < 10) {
    errors.push("System prompt is too short.");
  }
  if (!prompt.userPrompt || prompt.userPrompt.trim().length < 10) {
    errors.push("User prompt is too short.");
  }

  if (!provider.apiKey) {
    errors.push("API key is required.");
  }

  if (provider.provider === "azure") {
    if (!provider.azureEndpoint) {
      errors.push("Azure endpoint is required.");
    }
    if (!provider.azureDeployment) {
      errors.push("Azure deployment is required.");
    }
    if (!provider.azureApiVersion) {
      errors.push("Azure API version is required.");
    }
  } else {
    if (!provider.baseURL) {
      errors.push("Base URL is required.");
    }
    if (!provider.model) {
      errors.push("Model is required.");
    }
  }

  if (
    config.tagging.tagPolicy === "custom_list" &&
    parseCommaSeparatedTags(config.tagging.customTagList).length === 0
  ) {
    errors.push("Custom tag list is empty.");
  }

  return errors;
}
