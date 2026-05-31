import { config } from "../../package.json";
import {
  decodeTagColumnData,
  encodeTagColumnData,
  formatTagColumnTooltip,
  normalizeDisplayTags,
} from "../core/tagDisplay";
import { getPref } from "../utils/prefs";

const TAG_COLUMN_DATA_KEY = "tags";
const DEFAULT_TAG_BACKGROUND_COLOR = "#2f3f48";
const DEFAULT_TAG_TEXT_COLOR = "#7aa7b8";

let registeredDataKey: string | false | null = null;

export function registerTagsColumn() {
  if (registeredDataKey || !Zotero.ItemTreeManager?.registerColumn) return;

  registeredDataKey = Zotero.ItemTreeManager.registerColumn({
    dataKey: TAG_COLUMN_DATA_KEY,
    label: "Tags",
    pluginID: config.addonID,
    enabledTreeIDs: ["main"],
    showInColumnPicker: true,
    columnPickerSubMenu: true,
    width: "220",
    minWidth: 80,
    dataProvider: (item) => {
      return encodeTagColumnData(normalizeDisplayTags(item.getTags()));
    },
    renderCell: (_index, data, column, _isFirstColumn, doc) => {
      return renderTagsCell(doc, data, column.className);
    },
    zoteroPersist: ["width", "hidden", "sortDirection"],
  });
}

export function unregisterTagsColumn() {
  if (!registeredDataKey || !Zotero.ItemTreeManager?.unregisterColumn) return;
  Zotero.ItemTreeManager.unregisterColumn(registeredDataKey);
  registeredDataKey = null;
}

export function refreshTagsColumn() {
  Zotero.ItemTreeManager?.refreshColumns?.();
}

function renderTagsCell(
  doc: Document,
  data: string,
  className: string,
): HTMLElement {
  const tags = decodeTagColumnData(data);
  const cell = doc.createElement("span");
  cell.className = `cell ${className}`;
  cell.title = formatTagColumnTooltip(tags);
  cell.style.display = "block";
  cell.style.overflow = "hidden";
  cell.style.textOverflow = "ellipsis";
  cell.style.whiteSpace = "nowrap";

  if (tags.length === 0) {
    return cell;
  }

  const wrapper = doc.createElement("span");
  wrapper.style.alignItems = "center";
  wrapper.style.display = "flex";
  wrapper.style.gap = "4px";
  wrapper.style.minWidth = "0";
  wrapper.style.overflow = "hidden";
  wrapper.style.whiteSpace = "nowrap";

  const { backgroundColor, textColor } = getTagColumnColors();
  for (const tag of tags) {
    const pill = doc.createElement("span");
    pill.textContent = tag;
    pill.title = tag;
    pill.style.backgroundColor = backgroundColor;
    pill.style.borderRadius = "4px";
    pill.style.boxSizing = "border-box";
    pill.style.color = textColor;
    pill.style.display = "inline-block";
    pill.style.flex = "0 1 auto";
    pill.style.lineHeight = "1.35";
    pill.style.maxWidth = "100%";
    pill.style.minWidth = "0";
    pill.style.overflow = "hidden";
    pill.style.padding = "1px 6px";
    pill.style.textOverflow = "ellipsis";
    pill.style.whiteSpace = "nowrap";
    wrapper.append(pill);
  }

  cell.append(wrapper);
  return cell;
}

function getTagColumnColors() {
  return {
    backgroundColor: normalizeHexColor(
      getPref("tagColumnBackgroundColor"),
      DEFAULT_TAG_BACKGROUND_COLOR,
    ),
    textColor: normalizeHexColor(
      getPref("tagColumnTextColor"),
      DEFAULT_TAG_TEXT_COLOR,
    ),
  };
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return fallback;
}
