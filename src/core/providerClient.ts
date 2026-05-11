import { ChatMessage } from "./promptBuilder";
import { ProviderConfig, TagPolicy, TaggingConfig } from "./types";

export class ProviderRequestError extends Error {
  status?: number;
  shouldRetry?: boolean;

  constructor(
    message: string,
    options: { status?: number; shouldRetry?: boolean } = {},
  ) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = options.status;
    this.shouldRetry = options.shouldRetry;
  }
}

type ResponseFormatMode = "json_schema" | "json_object" | "none";

function normalizeChatEndpoint(baseURL: string): string {
  const normalized = baseURL.trim().replace(/\/+$/, "");
  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }
  return `${normalized}/chat/completions`;
}

function buildJSONSchema(
  availableTags: string[],
  tagPolicy: TagPolicy,
  maxSuggestedTags: number,
) {
  const itemSchema: Record<string, unknown> =
    tagPolicy !== "allow_new"
      ? {
          type: "string",
          enum: availableTags,
        }
      : {
          type: "string",
        };

  return {
    type: "json_schema",
    json_schema: {
      name: "tag_suggestions",
      strict: true,
      schema: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: itemSchema,
            maxItems: maxSuggestedTags,
          },
          reasoning: {
            type: "string",
          },
        },
        required: ["tags", "reasoning"],
        additionalProperties: false,
      },
    },
  };
}

function buildRequestPayload(
  provider: ProviderConfig,
  messages: ChatMessage[],
  tagging: TaggingConfig,
  availableTags: string[],
  mode: ResponseFormatMode,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages,
    max_tokens: tagging.maxTokens,
    temperature: tagging.temperature,
  };

  if (provider.provider !== "azure") {
    payload.model = provider.model;
  }

  if (mode === "json_schema") {
    payload.response_format = buildJSONSchema(
      availableTags,
      tagging.tagPolicy,
      tagging.maxSuggestedTags,
    );
  } else if (mode === "json_object") {
    payload.response_format = { type: "json_object" };
  }

  return payload;
}

function buildRequestInfo(provider: ProviderConfig): {
  url: string;
  headers: Record<string, string>;
} {
  if (provider.provider === "azure") {
    const endpoint = provider.azureEndpoint.trim().replace(/\/+$/, "");
    const deployment = encodeURIComponent(provider.azureDeployment.trim());
    const apiVersion = encodeURIComponent(provider.azureApiVersion.trim());
    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    return {
      url,
      headers: {
        "Content-Type": "application/json",
        "api-key": provider.apiKey,
      },
    };
  }

  const url = normalizeChatEndpoint(provider.baseURL);
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
  };
}

function extractContent(result: any): string {
  const content = result?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const joined = content
      .map((entry: any) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.text === "string") return entry.text;
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }

  const parsed = result?.choices?.[0]?.message?.parsed;
  if (parsed && typeof parsed === "object") {
    return JSON.stringify(parsed);
  }

  throw new ProviderRequestError(
    "Provider response does not contain message content.",
  );
}

function isRetryableStatus(status?: number): boolean {
  if (!status) return true;
  if (status === 408 || status === 409 || status === 429) return true;
  return status >= 500;
}

function shouldFallbackResponseFormat(error: unknown): boolean {
  if (!(error instanceof ProviderRequestError)) return false;
  if (error.status !== 400) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("response_format") ||
    message.includes("json_schema") ||
    message.includes("json_object") ||
    message.includes("unsupported")
  );
}

async function callChatOnce(
  provider: ProviderConfig,
  messages: ChatMessage[],
  tagging: TaggingConfig,
  availableTags: string[],
  mode: ResponseFormatMode,
): Promise<string> {
  const { url, headers } = buildRequestInfo(provider);
  const payload = buildRequestPayload(
    provider,
    messages,
    tagging,
    availableTags,
    mode,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ProviderRequestError(`Request failed: ${String(error)}`, {
      shouldRetry: true,
    });
  }

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as any;
      detail = data?.error?.message || data?.detail || "";
    } catch (_error) {
      detail = await response.text();
    }

    throw new ProviderRequestError(
      `HTTP ${response.status}: ${response.statusText}${detail ? ` - ${detail}` : ""}`,
      {
        status: response.status,
        shouldRetry: isRetryableStatus(response.status),
      },
    );
  }

  const result = await response.json();
  return extractContent(result);
}

export async function callProviderChat(
  provider: ProviderConfig,
  messages: ChatMessage[],
  tagging: TaggingConfig,
  availableTags: string[],
): Promise<string> {
  const modes: ResponseFormatMode[] = ["json_schema", "json_object", "none"];

  let lastError: unknown;
  for (const mode of modes) {
    try {
      return await callChatOnce(
        provider,
        messages,
        tagging,
        availableTags,
        mode,
      );
    } catch (error) {
      lastError = error;
      if (!shouldFallbackResponseFormat(error) || mode === "none") {
        throw error;
      }
    }
  }

  throw lastError;
}
