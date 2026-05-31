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
import { getEffectivePromptText } from "./promptMigration";

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
      prompt: getEffectivePromptText() || DEFAULT_PROMPT.prompt,
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

  if (!prompt.prompt || prompt.prompt.trim().length < 10) {
    errors.push("Prompt is too short.");
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
