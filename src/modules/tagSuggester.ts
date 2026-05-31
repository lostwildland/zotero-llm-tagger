import { getRuntimeConfig, validateRuntimeConfig } from "../core/config";
import {
  applyTagsToItem,
  selectTagsForImmediateApply,
  summarizeResultStats,
} from "../core/applier";
import { buildChatMessages } from "../core/promptBuilder";
import { getPromptProfiles } from "../core/promptProfiles";
import { callProviderChat } from "../core/providerClient";
import { runConcurrentQueue } from "../core/queueRunner";
import { parseSuggestionResponse } from "../core/responseParser";
import { normalizeSelectedItems } from "../core/selection";
import { collectTagUsage, deleteTagFromItems } from "../core/tagDeletion";
import { parseCommaSeparatedTags } from "../core/tagList";
import { getAvailableLibraryTags } from "../core/tagRepository";
import { RuntimeConfig, SuggestionResult } from "../core/types";
import { getString } from "../utils/locale";
import { refreshTagsColumn } from "./tagColumn";

function itemTitle(item: Zotero.Item) {
  return item.getField("title") || item.getDisplayTitle() || `#${item.id}`;
}

function promptConfirm(title: string, text: string): boolean {
  return Services.prompt.confirm(Zotero.getMainWindow() as any, title, text);
}

function buildDeferredSummary(results: SuggestionResult[]): string {
  const lines: string[] = [];
  for (const result of results) {
    if (result.deferredTags.length === 0) continue;
    lines.push(`${result.title}\n  - ${result.deferredTags.join(", ")}`);
    if (lines.length >= 20) {
      lines.push("...");
      break;
    }
  }
  return lines.join("\n");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function processSingleItem(
  item: Zotero.Item,
  config: RuntimeConfig,
  libraryTagCache: Map<number, string[]>,
  waitForRateLimit: () => Promise<void>,
): Promise<SuggestionResult> {
  const title = itemTitle(item);
  const libraryID = item.libraryID;

  let availableTags: string[] = [];
  if (config.tagging.tagPolicy === "custom_list") {
    availableTags = parseCommaSeparatedTags(config.tagging.customTagList);
    if (availableTags.length === 0) {
      return {
        itemID: item.id,
        title,
        existingTags: [],
        newTags: [],
        reasoning: "",
        status: "skipped",
        appliedTags: [],
        deferredTags: [],
        error: getString("error-custom-tag-list-empty"),
      };
    }
  } else {
    if (!libraryTagCache.has(libraryID)) {
      const tags = await getAvailableLibraryTags(libraryID);
      libraryTagCache.set(libraryID, tags);
    }

    availableTags = libraryTagCache.get(libraryID) || [];
    if (availableTags.length === 0) {
      return {
        itemID: item.id,
        title,
        existingTags: [],
        newTags: [],
        reasoning: "",
        status: "skipped",
        appliedTags: [],
        deferredTags: [],
        error: getString("error-no-available-tags"),
      };
    }
  }

  const messages = buildChatMessages(
    config.prompt,
    item,
    availableTags,
    config.tagging,
  );

  await waitForRateLimit();
  const rawContent = await callProviderChat(
    config.provider,
    messages,
    config.tagging,
    availableTags,
  );
  const parsed = parseSuggestionResponse(
    rawContent,
    availableTags,
    config.tagging.tagPolicy,
    config.tagging.maxSuggestedTags,
  );

  if (parsed.tags.length === 0) {
    return {
      itemID: item.id,
      title,
      existingTags: [],
      newTags: [],
      reasoning: parsed.reasoning,
      status: "skipped",
      appliedTags: [],
      deferredTags: [],
    };
  }

  const currentTags = item
    .getTags()
    .map((tag) => tag.tag)
    .filter((tag): tag is string => Boolean(tag));

  const { immediateTags, deferredTags } = selectTagsForImmediateApply(
    currentTags,
    parsed.existingTags,
    parsed.newTags,
    config.tagging.applyMode,
    config.tagging.tagPolicy,
  );

  const appliedTags = await applyTagsToItem(item, immediateTags);

  return {
    itemID: item.id,
    title,
    existingTags: parsed.existingTags,
    newTags: parsed.newTags,
    reasoning: parsed.reasoning,
    status: "success",
    appliedTags,
    deferredTags,
  };
}

async function applyDeferredResults(results: SuggestionResult[]) {
  for (const result of results) {
    if (result.deferredTags.length === 0) continue;
    const item = Zotero.Items.get(result.itemID);
    if (!item) continue;
    const applied = await applyTagsToItem(item, result.deferredTags);
    result.appliedTags.push(...applied);
    result.deferredTags = [];
  }
}

export async function runTagSuggestionForSelectedItems(promptProfileId: string) {
  const config = getRuntimeConfig(promptProfileId);
  const configErrors = validateRuntimeConfig(config);

  if (configErrors.length > 0) {
    Zotero.alert(
      Zotero.getMainWindow(),
      addon.data.config.addonName,
      configErrors.join("\n"),
    );
    return;
  }

  const selectedItems = ztoolkit.getGlobal("ZoteroPane").getSelectedItems();
  const items = normalizeSelectedItems(selectedItems);

  if (items.length === 0) {
    Zotero.alert(
      Zotero.getMainWindow(),
      addon.data.config.addonName,
      getString("error-no-supported-item"),
    );
    return;
  }

  const progressWindow = new ztoolkit.ProgressWindow(
    addon.data.config.addonName,
    {
      closeOnClick: true,
      closeTime: -1,
    },
  )
    .createLine({
      text: getString("progress-start", { args: { count: items.length } }),
      type: "default",
      progress: 0,
    })
    .show();

  const libraryTagCache = new Map<number, string[]>();

  const queueResults = await runConcurrentQueue(
    items,
    {
      maxConcurrency: config.queue.maxConcurrency,
      minRequestIntervalMs: config.queue.minRequestIntervalMs,
      maxRetries: config.queue.maxRetries,
    },
    async (item, context) => {
      return processSingleItem(
        item,
        config,
        libraryTagCache,
        context.waitForRateLimit,
      );
    },
    ({ completed, total, success, failed }) => {
      const progress = total > 0 ? Math.round((completed / total) * 100) : 100;
      progressWindow.changeLine({
        progress,
        text: getString("progress-running", {
          args: { completed, total, success, failed },
        }),
      });
    },
  );

  const results: SuggestionResult[] = queueResults.map((entry, index) => {
    if (entry.ok) {
      return entry.value;
    }
    const failedItem = items[index];
    return {
      itemID: failedItem?.id || -1,
      title: failedItem ? itemTitle(failedItem) : `#${index}`,
      existingTags: [],
      newTags: [],
      reasoning: "",
      status: "failed",
      appliedTags: [],
      deferredTags: [],
      error: toErrorMessage(entry.error),
    };
  });

  const pending = results.filter((result) => result.deferredTags.length > 0);
  if (pending.length > 0) {
    const summary = buildDeferredSummary(pending);
    const confirmed = promptConfirm(
      addon.data.config.addonName,
      `${getString("preview-confirm-desc", { args: { count: pending.length } })}\n\n${summary}`,
    );
    if (confirmed) {
      await applyDeferredResults(pending);
    }
  }

  const stats = summarizeResultStats(results);

  progressWindow.changeLine({
    progress: 100,
    text: getString("progress-finish", {
      args: {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        skipped: stats.skipped,
        applied: stats.appliedTags,
      },
    }),
    type: stats.failed > 0 ? "warning" : "success",
  });
  progressWindow.startCloseTimer(8000);
}

export function registerTagSuggesterMenu() {
  const popupId = `zotero-itemmenu-${addon.data.config.addonRef}-suggest-tags-popup`;

  ztoolkit.Menu.register("item", {
    tag: "menu",
    id: `zotero-itemmenu-${addon.data.config.addonRef}-suggest-tags`,
    popupId,
    label: getString("menuitem-suggest-tags"),
    children: [
      {
        tag: "menuitem",
        id: `zotero-itemmenu-${addon.data.config.addonRef}-suggest-tags-default`,
        label: getString("prompt-profile-default-name"),
      },
    ],
  });

  const popup = ztoolkit.getGlobal("document").querySelector(`#${popupId}`);
  popup?.addEventListener("popupshowing", () => {
    populatePromptProfileMenu(popup as XUL.MenuPopup);
  });

  registerBatchTagDeletionMenu();
}

function populatePromptProfileMenu(popup: XUL.MenuPopup) {
  const doc = popup.ownerDocument || ztoolkit.getGlobal("document");
  popup.replaceChildren();

  for (const profile of getPromptProfiles()) {
    const menuItem = createMenuItem(
      doc,
      profile.builtIn ? getString("prompt-profile-default-name") : profile.name,
      false,
    );
    menuItem.addEventListener("command", () => {
      runTagSuggestionForSelectedItems(profile.id).catch((error) => {
        Zotero.alert(
          Zotero.getMainWindow(),
          addon.data.config.addonName,
          `${getString("error-run-failed")}: ${toErrorMessage(error)}`,
        );
      });
    });
    popup.append(menuItem);
  }
}

function registerBatchTagDeletionMenu() {
  const popupId = `zotero-itemmenu-${addon.data.config.addonRef}-delete-tags-popup`;

  ztoolkit.Menu.register("item", {
    tag: "menu",
    id: `zotero-itemmenu-${addon.data.config.addonRef}-delete-tags`,
    popupId,
    label: getString("menuitem-delete-tags"),
    children: [
      {
        tag: "menuitem",
        id: `zotero-itemmenu-${addon.data.config.addonRef}-delete-tags-empty`,
        label: getString("menuitem-delete-tags-empty"),
        disabled: true,
      },
    ],
  });

  const popup = ztoolkit.getGlobal("document").querySelector(`#${popupId}`);
  popup?.addEventListener("popupshowing", () => {
    populateBatchTagDeletionMenu(popup as XUL.MenuPopup);
  });
}

function populateBatchTagDeletionMenu(popup: XUL.MenuPopup) {
  const doc = popup.ownerDocument || ztoolkit.getGlobal("document");
  popup.replaceChildren();

  const items = normalizeSelectedItems(
    ztoolkit.getGlobal("ZoteroPane").getSelectedItems(),
  );
  const tagUsage = collectTagUsage(items);

  if (tagUsage.length === 0) {
    popup.append(
      createMenuItem(
        doc,
        getString("menuitem-delete-tags-empty"),
        true,
      ),
    );
    return;
  }

  for (const usage of tagUsage) {
    const menuItem = createMenuItem(
      doc,
      `${usage.tag} (${usage.count})`,
      false,
    );
    menuItem.addEventListener("command", () => {
      runBatchTagDeletion(usage.tag).catch((error) => {
        Zotero.alert(
          Zotero.getMainWindow(),
          addon.data.config.addonName,
          `${getString("error-run-failed")}: ${toErrorMessage(error)}`,
        );
      });
    });
    popup.append(menuItem);
  }
}

function createMenuItem(
  doc: Document,
  label: string,
  disabled: boolean,
) {
  const xulDocument = doc as Document & {
    createXULElement?: (tagName: string) => Element;
  };
  const menuItem = (xulDocument.createXULElement
    ? xulDocument.createXULElement("menuitem")
    : doc.createElement("menuitem")) as Element;
  menuItem.setAttribute("label", label);
  if (disabled) {
    menuItem.setAttribute("disabled", "true");
  }
  return menuItem as XUL.MenuItem;
}

async function runBatchTagDeletion(tag: string) {
  const items = normalizeSelectedItems(
    ztoolkit.getGlobal("ZoteroPane").getSelectedItems(),
  );
  const matched = collectTagUsage(items).find((usage) => usage.tag === tag);

  if (!matched) return;

  const confirmed = promptConfirm(
    addon.data.config.addonName,
    getString("delete-tags-confirm", {
      args: {
        tag,
        selected: items.length,
        matched: matched.count,
      },
    }),
  );
  if (!confirmed) return;

  const result = await deleteTagFromItems(items, tag);
  refreshTagsColumn();

  Zotero.alert(
    Zotero.getMainWindow(),
    addon.data.config.addonName,
    getString("delete-tags-finish", {
      args: {
        tag,
        saved: result.saved,
        failed: result.failed,
      },
    }),
  );
}
