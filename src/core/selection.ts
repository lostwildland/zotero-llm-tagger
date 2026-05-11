export function normalizeSelectedItems(items: Zotero.Item[]): Zotero.Item[] {
  const normalized = new Map<number, Zotero.Item>();

  for (const selected of items) {
    if (!selected) continue;

    let target: Zotero.Item | null = null;

    if (selected.isRegularItem() && selected.isTopLevelItem()) {
      target = selected;
    } else if (selected.isAttachment() && selected.parentID) {
      const parent = Zotero.Items.get(selected.parentID);
      if (parent && parent.isRegularItem() && parent.isTopLevelItem()) {
        target = parent;
      }
    }

    if (target) {
      normalized.set(target.id, target);
    }
  }

  return [...normalized.values()];
}
