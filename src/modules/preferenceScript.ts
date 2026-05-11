import { config } from "../../package.json";
import { getRuntimeConfig, validateRuntimeConfig } from "../core/config";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../core/defaults";
import { buildChatMessages } from "../core/promptBuilder";
import { callProviderChat } from "../core/providerClient";
import { parseSuggestionResponse } from "../core/responseParser";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

const boundWindows = new WeakSet<Window>();
type CheckedElement = HTMLElement & { checked?: boolean };

export function registerPreferencePane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/logo.svg`,
  });
}

export async function registerPrefsScripts(window: Window) {
  addon.data.prefs = {
    window,
  };

  if (!boundWindows.has(window)) {
    bindPrefEvents(window);
    boundWindows.add(window);
  } else {
    updateProviderSectionVisibility(window);
    updateTagPolicySectionVisibility(window);
    updateContextSectionVisibility(window);
  }
}

function bindPrefEvents(window: Window) {
  const doc = window.document;
  const providerInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-provider`,
  ) as HTMLSelectElement | null;
  const tagPolicyInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-tagPolicy`,
  ) as HTMLSelectElement | null;
  const includeAttachmentTextInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-includeAttachmentText`,
  ) as CheckedElement | null;

  providerInput?.addEventListener("change", () => {
    updateProviderSectionVisibility(window);
  });
  tagPolicyInput?.addEventListener("change", () => {
    updateTagPolicySectionVisibility(window);
  });
  includeAttachmentTextInput?.addEventListener("change", () => {
    updateContextSectionVisibility(window);
  });
  includeAttachmentTextInput?.addEventListener("command", () => {
    updateContextSectionVisibility(window);
  });

  doc
    .querySelector(`#${config.addonRef}-test-connection`)
    ?.addEventListener("click", () => {
      testProviderConnection(window).catch((error) => {
        Services.prompt.alert(
          window as any,
          addon.data.config.addonName,
          `${getString("provider-test-failed")}: ${toErrorMessage(error)}`,
        );
      });
    });

  doc
    .querySelector(`#${config.addonRef}-restore-prompts`)
    ?.addEventListener("click", () => {
      setPref("systemPrompt", DEFAULT_SYSTEM_PROMPT);
      setPref("userPrompt", DEFAULT_USER_PROMPT);

      const systemPromptInput = doc.querySelector(
        `#zotero-prefpane-${config.addonRef}-systemPrompt`,
      ) as HTMLTextAreaElement | null;
      const userPromptInput = doc.querySelector(
        `#zotero-prefpane-${config.addonRef}-userPrompt`,
      ) as HTMLTextAreaElement | null;

      if (systemPromptInput) {
        systemPromptInput.value = DEFAULT_SYSTEM_PROMPT;
      }
      if (userPromptInput) {
        userPromptInput.value = DEFAULT_USER_PROMPT;
      }

      Services.prompt.alert(
        window as any,
        addon.data.config.addonName,
        getString("prompt-restored"),
      );
    });

  updateProviderSectionVisibility(window);
  updateTagPolicySectionVisibility(window);
  updateContextSectionVisibility(window);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function testProviderConnection(window: Window) {
  const runtimeConfig = getRuntimeConfig();
  const errors = validateRuntimeConfig(runtimeConfig);
  if (errors.length > 0) {
    Services.prompt.alert(
      window as any,
      addon.data.config.addonName,
      errors.join("\n"),
    );
    return;
  }

  const messages = buildChatMessages(
    runtimeConfig.prompt,
    {
      getTags: () => [],
      getField: (field: string) =>
        field === "title" ? "Provider connectivity test" : "",
    } as unknown as Zotero.Item,
    ["connection-test"],
    {
      ...runtimeConfig.tagging,
      tagPolicy: "allow_new",
      maxSuggestedTags: 1,
      maxTokens: 100,
      temperature: 0,
      includeAttachmentText: false,
      maxAttachmentChars: 0,
    },
  );

  const content = await callProviderChat(
    runtimeConfig.provider,
    messages,
    {
      ...runtimeConfig.tagging,
      tagPolicy: "allow_new",
      maxSuggestedTags: 1,
      maxTokens: 100,
      temperature: 0,
    },
    ["connection-test"],
  );
  parseSuggestionResponse(content, ["connection-test"], "allow_new", 1);

  Services.prompt.alert(
    window as any,
    addon.data.config.addonName,
    getString("provider-test-success"),
  );
}

function updateProviderSectionVisibility(window: Window) {
  const doc = window.document;
  const providerInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-provider`,
  ) as HTMLSelectElement | null;
  const azureSection = doc.querySelector(
    `#${config.addonRef}-provider-azure`,
  ) as HTMLElement | null;
  const openaiSection = doc.querySelector(
    `#${config.addonRef}-provider-openai`,
  ) as HTMLElement | null;

  const provider = providerInput?.value || "openai";
  const isAzure = provider === "azure";

  if (azureSection) {
    azureSection.style.display = isAzure ? "block" : "none";
  }
  if (openaiSection) {
    openaiSection.style.display = isAzure ? "none" : "block";
  }
}

function updateTagPolicySectionVisibility(window: Window) {
  const doc = window.document;
  const tagPolicyInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-tagPolicy`,
  ) as HTMLSelectElement | null;
  const customListRow = doc.querySelector(
    `#${config.addonRef}-custom-tag-list-row`,
  ) as HTMLElement | null;

  const tagPolicy =
    tagPolicyInput?.value ||
    (getPref("tagPolicy") as string) ||
    "existing_only";
  const showCustomList = tagPolicy === "custom_list";

  if (customListRow) {
    customListRow.style.display = showCustomList ? "flex" : "none";
  }

  // Preference binding may apply value after onload; run one extra tick.
  window.setTimeout(() => {
    const latePolicy =
      (tagPolicyInput?.value as string) ||
      (getPref("tagPolicy") as string) ||
      "existing_only";
    if (customListRow) {
      customListRow.style.display =
        latePolicy === "custom_list" ? "flex" : "none";
    }
  }, 0);
}

function updateContextSectionVisibility(window: Window) {
  const doc = window.document;
  const includeAttachmentTextInput = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-includeAttachmentText`,
  ) as CheckedElement | null;
  const maxAttachmentCharsRow = doc.querySelector(
    `#${config.addonRef}-max-attachment-chars-row`,
  ) as HTMLElement | null;

  const includeAttachmentText =
    includeAttachmentTextInput == null
      ? Boolean(getPref("includeAttachmentText"))
      : Boolean(includeAttachmentTextInput.checked);

  if (maxAttachmentCharsRow) {
    maxAttachmentCharsRow.style.display = includeAttachmentText
      ? "flex"
      : "none";
  }

  window.setTimeout(() => {
    const lateInclude =
      includeAttachmentTextInput == null
        ? Boolean(getPref("includeAttachmentText"))
        : Boolean(includeAttachmentTextInput.checked);
    if (maxAttachmentCharsRow) {
      maxAttachmentCharsRow.style.display = lateInclude ? "flex" : "none";
    }
  }, 0);
}
