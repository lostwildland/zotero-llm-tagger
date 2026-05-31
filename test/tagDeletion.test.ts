import { assert } from "chai";
import { collectTagUsage, deleteTagFromItems } from "../src/core/tagDeletion";

function createMockItem(id: number, tags: string[], failSave = false) {
  const currentTags = tags.map((tag) => ({ tag }));
  let saveCount = 0;

  return {
    id,
    getTags: () => currentTags,
    removeTag: (tag: string) => {
      const index = currentTags.findIndex((entry) => entry.tag === tag);
      if (index < 0) return false;
      currentTags.splice(index, 1);
      return true;
    },
    saveTx: async () => {
      saveCount += 1;
      if (failSave) {
        throw new Error("save failed");
      }
    },
    getSaveCount: () => saveCount,
  } as unknown as Zotero.Item & { getSaveCount: () => number };
}

describe("tagDeletion", function () {
  it("collects the selected item tag union with per-tag counts", function () {
    const usage = collectTagUsage([
      createMockItem(1, ["AI", "Syllabus", "_hidden"]),
      createMockItem(2, ["AI", "Dataset"]),
    ]);

    assert.deepEqual(usage, [
      { tag: "AI", count: 2 },
      { tag: "Dataset", count: 1 },
      { tag: "Syllabus", count: 1 },
    ]);
  });

  it("deletes only the requested tag and saves changed items", async function () {
    const first = createMockItem(1, ["AI", "Dataset"]);
    const second = createMockItem(2, ["Dataset"]);
    const third = createMockItem(3, ["AI"]);

    const result = await deleteTagFromItems([first, second, third], "AI");

    assert.deepInclude(result, {
      selected: 3,
      matched: 2,
      saved: 2,
      failed: 0,
    });
    assert.deepEqual(
      first.getTags().map((entry) => entry.tag),
      ["Dataset"],
    );
    assert.deepEqual(
      second.getTags().map((entry) => entry.tag),
      ["Dataset"],
    );
    assert.deepEqual(third.getTags(), []);
    assert.equal(first.getSaveCount(), 1);
    assert.equal(second.getSaveCount(), 0);
    assert.equal(third.getSaveCount(), 1);
  });

  it("does not delete internal tags", async function () {
    const item = createMockItem(1, ["_hidden"]);
    const result = await deleteTagFromItems([item], "_hidden");

    assert.equal(result.matched, 0);
    assert.equal(item.getSaveCount(), 0);
    assert.deepEqual(item.getTags(), [{ tag: "_hidden" }]);
  });
});
