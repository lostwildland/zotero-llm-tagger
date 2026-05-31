pref("provider", "openai");
pref("baseURL", "https://api.openai.com/v1");
pref("apiKey", "");
pref("model", "gpt-4o-mini");
pref("azureEndpoint", "");
pref("azureDeployment", "gpt-4.1-mini");
pref("azureApiVersion", "2024-12-01-preview");

pref("tagPolicy", "existing_only");
pref("applyMode", "preview_then_apply");
pref("customTagList", "");
pref("maxSuggestedTags", 8);
pref("temperature", "0.1");
pref("maxTokens", 1000);

pref("maxConcurrency", 3);
pref("minRequestIntervalMs", 800);
pref("maxRetries", 3);

pref(
  "prompt",
  "Analyze the provided document context and suggest concise, accurate tags.",
);
