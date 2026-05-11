export async function getAvailableLibraryTags(
  libraryID: number,
): Promise<string[]> {
  let allTagsData: Array<{ tag: string }> = [];

  try {
    allTagsData = (await Zotero.Tags.getAll(libraryID)) as Array<{
      tag: string;
    }>;
  } catch (_error) {
    const allItems = await Zotero.Items.getAll(libraryID, true);
    const tagSet = new Set<string>();
    for (const item of allItems) {
      if (!item.isRegularItem()) continue;
      for (const tag of item.getTags()) {
        if (tag.tag) {
          tagSet.add(tag.tag);
        }
      }
    }
    allTagsData = [...tagSet].map((tag) => ({ tag }));
  }

  return allTagsData
    .map((tagObj) => tagObj.tag)
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    .filter((tag) => !tag.startsWith("_"))
    .sort((a, b) => a.localeCompare(b));
}
