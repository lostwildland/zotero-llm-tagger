import { config } from "../../package.json";
import {
  getRuntimeConfig,
  validateProviderConfig,
  validateRuntimeConfig,
} from "../core/config";
import { buildChatMessages } from "../core/promptBuilder";
import {
  createPromptProfile,
  DEFAULT_PROMPT_PROFILE_ID,
  getPromptProfile,
  getPromptProfiles,
  isDefaultPromptProfile,
  serializeStoredPromptProfiles,
} from "../core/promptProfiles";
import { callProviderChat } from "../core/providerClient";
import { parseSuggestionResponse } from "../core/responseParser";
import { parseCommaSeparatedTags } from "../core/tagList";
import { PromptProfile } from "../core/types";
import { refreshTagsColumn } from "./tagColumn";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

const boundWindows = new WeakSet<Window>();
const htmlNS = "http://www.w3.org/1999/xhtml";

interface CustomTagListState {
  selectedTags: Set<string>;
  lastSelectedIndex: number | null;
  draggedTags: string[];
}

const customTagListStates = new WeakMap<Window, CustomTagListState>();

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
    syncCustomTagListEditor(window);
    syncPromptProfileEditor(window);
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
  const tagColumnColorInputs = [
    `#zotero-prefpane-${config.addonRef}-tagColumnBackgroundColor`,
    `#zotero-prefpane-${config.addonRef}-tagColumnTextColor`,
  ]
    .map((selector) => doc.querySelector(selector) as HTMLInputElement | null)
    .filter((input): input is HTMLInputElement => Boolean(input));

  providerInput?.addEventListener("change", () => {
    updateProviderSectionVisibility(window);
  });
  tagPolicyInput?.addEventListener("change", () => {
    updateTagPolicySectionVisibility(window);
  });
  for (const colorInput of tagColumnColorInputs) {
    colorInput.addEventListener("change", () => refreshTagsColumn());
    colorInput.addEventListener("input", () => refreshTagsColumn());
  }

  bindCustomTagListEditor(window);
  bindPromptProfileEditor(window);

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

  updateProviderSectionVisibility(window);
  updateTagPolicySectionVisibility(window);
  syncCustomTagListEditor(window);
  syncPromptProfileEditor(window);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function testProviderConnection(window: Window) {
  const runtimeConfig = getRuntimeConfig(DEFAULT_PROMPT_PROFILE_ID);
  const errors = validateProviderConfig(runtimeConfig.provider);
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
  syncCustomTagListEditor(window);

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
    syncCustomTagListEditor(window);
  }, 0);
}

function bindPromptProfileEditor(window: Window) {
  const doc = window.document;
  const select = getPromptProfileSelect(window);
  const promptInput = getPromptProfilePromptInput(window);

  select?.addEventListener("change", () => {
    syncPromptProfileEditor(window, select.value);
  });
  promptInput?.addEventListener("input", () => {
    persistCurrentPromptProfileText(window);
  });

  doc
    .querySelector(`#${config.addonRef}-prompt-profile-new`)
    ?.addEventListener("click", () => createPromptProfileFromInput(window));
  doc
    .querySelector(`#${config.addonRef}-prompt-profile-rename`)
    ?.addEventListener("click", () => renameCurrentPromptProfile(window));
  doc
    .querySelector(`#${config.addonRef}-prompt-profile-duplicate`)
    ?.addEventListener("click", () => duplicateCurrentPromptProfile(window));
  doc
    .querySelector(`#${config.addonRef}-prompt-profile-delete`)
    ?.addEventListener("click", () => deleteCurrentPromptProfile(window));

  syncPromptProfileEditor(window);
}

function syncPromptProfileEditor(window: Window, selectedProfileId?: string) {
  const select = getPromptProfileSelect(window);
  const promptInput = getPromptProfilePromptInput(window);
  if (!select || !promptInput) return;

  const profiles = getPromptProfiles();
  const nextSelectedId =
    selectedProfileId ||
    select.value ||
    profiles[0]?.id ||
    DEFAULT_PROMPT_PROFILE_ID;
  const selectedProfile =
    profiles.find((profile) => profile.id === nextSelectedId) || profiles[0];

  select.replaceChildren(
    ...profiles.map((profile) => {
      const option = window.document.createElementNS(
        htmlNS,
        "option",
      ) as HTMLOptionElement;
      option.value = profile.id;
      option.textContent = profile.builtIn
        ? getString("prompt-profile-default-name")
        : profile.name;
      return option;
    }),
  );

  if (selectedProfile) {
    select.value = selectedProfile.id;
    promptInput.value = selectedProfile.prompt;
    promptInput.disabled = isDefaultPromptProfile(selectedProfile);
  }

  updatePromptProfileButtons(window, selectedProfile);
  syncPromptProfilesHiddenInput(window, profiles);
}

function persistCurrentPromptProfileText(window: Window) {
  const select = getPromptProfileSelect(window);
  const promptInput = getPromptProfilePromptInput(window);
  if (!select || !promptInput) return;

  const profiles = getPromptProfiles();
  const profile = profiles.find((entry) => entry.id === select.value);
  if (!profile || isDefaultPromptProfile(profile)) return;

  profile.prompt = promptInput.value;
  persistPromptProfiles(window, profiles, profile.id);
}

function createPromptProfileFromInput(window: Window) {
  const name = promptForProfileName(
    window,
    getString("prompt-profile-new-prompt"),
    "",
  );
  if (!name) return;

  const profiles = getPromptProfiles();
  if (hasPromptProfileName(profiles, name)) {
    alertPromptProfileNameExists(window);
    return;
  }

  const profile = createPromptProfile(name);
  profiles.push(profile);
  persistPromptProfiles(window, profiles, profile.id);
}

function renameCurrentPromptProfile(window: Window) {
  const profile = getCurrentPromptProfile(window);
  if (!profile || isDefaultPromptProfile(profile)) return;

  const name = promptForProfileName(
    window,
    getString("prompt-profile-rename-prompt"),
    profile.name,
  );
  if (!name || name === profile.name) return;

  const profiles = getPromptProfiles();
  if (hasPromptProfileName(profiles, name, profile.id)) {
    alertPromptProfileNameExists(window);
    return;
  }

  const target = profiles.find((entry) => entry.id === profile.id);
  if (!target) return;
  target.name = name;
  persistPromptProfiles(window, profiles, target.id);
}

function duplicateCurrentPromptProfile(window: Window) {
  const profile = getCurrentPromptProfile(window);
  if (!profile) return;

  const name = promptForProfileName(
    window,
    getString("prompt-profile-duplicate-prompt"),
    `${profile.name} Copy`,
  );
  if (!name) return;

  const profiles = getPromptProfiles();
  if (hasPromptProfileName(profiles, name)) {
    alertPromptProfileNameExists(window);
    return;
  }

  const duplicate = createPromptProfile(name, profile.prompt);
  profiles.push(duplicate);
  persistPromptProfiles(window, profiles, duplicate.id);
}

function deleteCurrentPromptProfile(window: Window) {
  const profile = getCurrentPromptProfile(window);
  if (!profile || isDefaultPromptProfile(profile)) return;

  const confirmed = Services.prompt.confirm(
    window as any,
    addon.data.config.addonName,
    getString("prompt-profile-delete-confirm", {
      args: { name: profile.name },
    }),
  );
  if (!confirmed) return;

  const profiles = getPromptProfiles().filter(
    (entry) => entry.id !== profile.id,
  );
  persistPromptProfiles(window, profiles, DEFAULT_PROMPT_PROFILE_ID);
}

function persistPromptProfiles(
  window: Window,
  profiles: PromptProfile[],
  selectedProfileId: string,
) {
  setPref("promptProfiles", serializeStoredPromptProfiles(profiles));
  syncPromptProfileEditor(window, selectedProfileId);
}

function syncPromptProfilesHiddenInput(
  window: Window,
  profiles: PromptProfile[],
) {
  const hiddenInput = getPromptProfilesHiddenInput(window);
  if (!hiddenInput) return;

  const value = serializeStoredPromptProfiles(profiles);
  if (hiddenInput.value === value) return;
  hiddenInput.value = value;
  hiddenInput.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function getCurrentPromptProfile(window: Window) {
  const select = getPromptProfileSelect(window);
  if (!select) return null;
  return getPromptProfile(select.value);
}

function promptForProfileName(
  window: Window,
  message: string,
  initialValue: string,
): string {
  const input = { value: initialValue };
  const accepted = (Services.prompt as any).prompt(
    window as any,
    addon.data.config.addonName,
    message,
    input,
    null,
    {},
  );
  return accepted ? input.value.trim() : "";
}

function hasPromptProfileName(
  profiles: PromptProfile[],
  name: string,
  ignoredProfileId?: string,
) {
  const normalizedName = name.trim().toLocaleLowerCase();
  return profiles.some(
    (profile) =>
      profile.id !== ignoredProfileId &&
      profile.name.trim().toLocaleLowerCase() === normalizedName,
  );
}

function alertPromptProfileNameExists(window: Window) {
  Services.prompt.alert(
    window as any,
    addon.data.config.addonName,
    getString("prompt-profile-name-exists"),
  );
}

function updatePromptProfileButtons(
  window: Window,
  profile: PromptProfile | undefined,
) {
  const isBuiltIn = !profile || isDefaultPromptProfile(profile);
  const renameButton = window.document.querySelector(
    `#${config.addonRef}-prompt-profile-rename`,
  ) as HTMLButtonElement | null;
  const duplicateButton = window.document.querySelector(
    `#${config.addonRef}-prompt-profile-duplicate`,
  ) as HTMLButtonElement | null;
  const deleteButton = window.document.querySelector(
    `#${config.addonRef}-prompt-profile-delete`,
  ) as HTMLButtonElement | null;

  if (renameButton) renameButton.disabled = isBuiltIn;
  if (duplicateButton) duplicateButton.disabled = !profile;
  if (deleteButton) deleteButton.disabled = isBuiltIn;
}

function getPromptProfileSelect(window: Window) {
  return window.document.querySelector(
    `#${config.addonRef}-prompt-profile-select`,
  ) as HTMLSelectElement | null;
}

function getPromptProfilePromptInput(window: Window) {
  return window.document.querySelector(
    `#${config.addonRef}-prompt-profile-prompt`,
  ) as HTMLTextAreaElement | null;
}

function getPromptProfilesHiddenInput(window: Window) {
  return window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-promptProfiles`,
  ) as HTMLTextAreaElement | null;
}

function bindCustomTagListEditor(window: Window) {
  const doc = window.document;
  const tagList = getCustomTagListElement(window);
  const addButton = doc.querySelector(
    `#${config.addonRef}-custom-tag-add`,
  ) as HTMLButtonElement | null;
  const deleteButton = doc.querySelector(
    `#${config.addonRef}-custom-tag-delete`,
  ) as HTMLButtonElement | null;

  tagList?.addEventListener("click", (event) => {
    handleCustomTagListClick(window, event as MouseEvent);
  });
  tagList?.addEventListener("dragstart", (event) => {
    handleCustomTagDragStart(window, event as DragEvent);
  });
  tagList?.addEventListener("dragover", (event) => {
    handleCustomTagDragOver(window, event as DragEvent);
  });
  tagList?.addEventListener("drop", (event) => {
    handleCustomTagDrop(window, event as DragEvent);
  });
  tagList?.addEventListener("dragend", () => {
    getCustomTagListState(window).draggedTags = [];
  });

  addButton?.addEventListener("click", () => {
    const tags = getCustomTagListEditorTags(window);
    const input = { value: "" };
    const accepted = (Services.prompt as any).prompt(
      window as any,
      addon.data.config.addonName,
      getString("pref-custom-tag-add-prompt"),
      input,
      null,
      {},
    );

    if (!accepted) return;

    const newTags = parseCommaSeparatedTags(input.value);
    if (newTags.length === 0) return;

    const nextTags = [...tags];
    for (const tag of newTags) {
      if (!nextTags.includes(tag)) {
        nextTags.push(tag);
      }
    }
    if (nextTags.length === tags.length) return;

    persistCustomTagListEditorTags(window, nextTags);
  });

  deleteButton?.addEventListener("click", () => {
    const state = getCustomTagListState(window);
    const selectedTags = new Set(state.selectedTags);
    if (selectedTags.size === 0) return;

    state.selectedTags.clear();
    persistCustomTagListEditorTags(
      window,
      getCustomTagListEditorTags(window).filter(
        (tag) => !selectedTags.has(tag),
      ),
    );
  });
}

function syncCustomTagListEditor(window: Window) {
  const hiddenInput = getCustomTagListHiddenInput(window);
  const storedValue =
    hiddenInput?.value || (getPref("customTagList") as string) || "";

  renderCustomTagListEditor(window, parseCommaSeparatedTags(storedValue));
}

function getCustomTagListEditorTags(window: Window): string[] {
  const tagList = getCustomTagListElement(window);

  if (!tagList) {
    return parseCommaSeparatedTags((getPref("customTagList") as string) || "");
  }

  return Array.from(
    tagList.children,
    (row) => (row as HTMLElement).dataset.customTag || "",
  ).filter(Boolean);
}

function getCustomTagListElement(window: Window) {
  return window.document.querySelector(
    `#${config.addonRef}-custom-tag-list`,
  ) as HTMLDivElement | null;
}

function getCustomTagListState(window: Window): CustomTagListState {
  let state = customTagListStates.get(window);
  if (!state) {
    state = {
      selectedTags: new Set<string>(),
      lastSelectedIndex: null,
      draggedTags: [],
    };
    customTagListStates.set(window, state);
  }
  return state;
}

function handleCustomTagListClick(window: Window, event: MouseEvent) {
  const row = findCustomTagRow(window, event.target);
  if (!row) return;

  const tag = row.dataset.customTag || "";
  const tags = getCustomTagListEditorTags(window);
  const index = tags.indexOf(tag);
  if (index < 0) return;

  const state = getCustomTagListState(window);
  const selectedTags = state.selectedTags;
  const extendSelection = event.metaKey || event.ctrlKey;

  if (event.shiftKey && state.lastSelectedIndex != null) {
    if (!extendSelection) {
      selectedTags.clear();
    }
    const start = Math.min(state.lastSelectedIndex, index);
    const end = Math.max(state.lastSelectedIndex, index);
    for (const selectedTag of tags.slice(start, end + 1)) {
      selectedTags.add(selectedTag);
    }
  } else if (extendSelection) {
    if (selectedTags.has(tag)) {
      selectedTags.delete(tag);
    } else {
      selectedTags.add(tag);
    }
    state.lastSelectedIndex = index;
  } else {
    selectedTags.clear();
    selectedTags.add(tag);
    state.lastSelectedIndex = index;
  }

  applyCustomTagSelection(window);
}

function handleCustomTagDragStart(window: Window, event: DragEvent) {
  const row = findCustomTagRow(window, event.target);
  if (!row) return;

  const tag = row.dataset.customTag || "";
  const state = getCustomTagListState(window);
  if (!state.selectedTags.has(tag)) {
    state.selectedTags.clear();
    state.selectedTags.add(tag);
    state.lastSelectedIndex = getCustomTagListEditorTags(window).indexOf(tag);
    applyCustomTagSelection(window);
  }

  state.draggedTags = getCustomTagListEditorTags(window).filter((item) =>
    state.selectedTags.has(item),
  );

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", state.draggedTags.join("\n"));
  }
}

function handleCustomTagDragOver(window: Window, event: DragEvent) {
  if (getCustomTagListState(window).draggedTags.length === 0) return;

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function handleCustomTagDrop(window: Window, event: DragEvent) {
  const state = getCustomTagListState(window);
  const draggedTags = state.draggedTags;
  if (draggedTags.length === 0) return;

  event.preventDefault();

  const targetRow = findCustomTagRow(window, event.target);
  const targetTag = targetRow?.dataset.customTag || "";
  if (targetTag && draggedTags.includes(targetTag)) {
    return;
  }

  const tags = getCustomTagListEditorTags(window);
  const remainingTags = tags.filter((tag) => !draggedTags.includes(tag));
  let insertIndex = remainingTags.length;

  if (targetRow && targetTag) {
    const targetIndex = remainingTags.indexOf(targetTag);
    if (targetIndex >= 0) {
      const rect = targetRow.getBoundingClientRect();
      const dropAfter = event.clientY > rect.top + rect.height / 2;
      insertIndex = targetIndex + (dropAfter ? 1 : 0);
    }
  }

  state.selectedTags = new Set(draggedTags);
  state.draggedTags = [];
  persistCustomTagListEditorTags(window, [
    ...remainingTags.slice(0, insertIndex),
    ...draggedTags,
    ...remainingTags.slice(insertIndex),
  ]);
}

function findCustomTagRow(
  window: Window,
  target: EventTarget | null,
): HTMLElement | null {
  const tagList = getCustomTagListElement(window);
  let node = target as Node | null;

  while (node && node !== tagList) {
    const element = node as HTMLElement;
    if (element.dataset?.customTag != null) {
      return element;
    }
    node = node.parentNode;
  }

  return null;
}

function applyCustomTagSelection(window: Window) {
  const tagList = getCustomTagListElement(window);
  if (!tagList) return;

  const selectedTags = getCustomTagListState(window).selectedTags;
  for (const row of Array.from(tagList.children)) {
    const element = row as HTMLElement;
    const selected = selectedTags.has(element.dataset.customTag || "");
    element.setAttribute("aria-selected", selected ? "true" : "false");
  }

  updateCustomTagDeleteButton(window);
}

function createCustomTagRow(window: Window, tag: string) {
  const row = window.document.createElementNS(htmlNS, "div") as HTMLDivElement;
  row.dataset.customTag = tag;
  row.className = "aitagger-custom-tag-row";
  row.draggable = true;
  row.textContent = tag;
  row.title = tag;
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", "false");
  return row;
}

function reconcileCustomTagSelection(window: Window, tags: string[]) {
  const state = getCustomTagListState(window);
  state.selectedTags = new Set(
    Array.from(state.selectedTags).filter((tag) => tags.includes(tag)),
  );
  if (
    state.lastSelectedIndex != null &&
    state.lastSelectedIndex >= tags.length
  ) {
    state.lastSelectedIndex = null;
  }
}

function persistCustomTagListEditorTags(window: Window, tags: string[]) {
  const normalizedTags = parseCommaSeparatedTags(tags.join("\n"));
  const value = normalizedTags.join(", ");
  const hiddenInput = getCustomTagListHiddenInput(window);

  setPref("customTagList", value);
  if (hiddenInput) {
    hiddenInput.value = value;
    hiddenInput.dispatchEvent(new window.Event("change", { bubbles: true }));
  }

  renderCustomTagListEditor(window, normalizedTags);
}

function renderCustomTagListEditor(window: Window, tags: string[]) {
  const tagList = getCustomTagListElement(window);

  if (!tagList) return;

  reconcileCustomTagSelection(window, tags);
  tagList.replaceChildren(
    ...tags.map((tag) => createCustomTagRow(window, tag)),
  );
  applyCustomTagSelection(window);
}

function updateCustomTagDeleteButton(window: Window) {
  const doc = window.document;
  const deleteButton = doc.querySelector(
    `#${config.addonRef}-custom-tag-delete`,
  ) as HTMLButtonElement | null;

  if (deleteButton) {
    deleteButton.disabled =
      getCustomTagListState(window).selectedTags.size === 0;
  }
}

function getCustomTagListHiddenInput(window: Window) {
  return window.document.querySelector(
    `#zotero-prefpane-${config.addonRef}-customTagList`,
  ) as HTMLTextAreaElement | null;
}
