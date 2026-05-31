import { assert } from "chai";
import {
  applyTagsToItem,
  selectTagsForImmediateApply,
} from "../src/core/applier";
import { buildChatMessages } from "../src/core/promptBuilder";
import { parseSuggestionResponse } from "../src/core/responseParser";
import { PromptConfig, TaggingConfig } from "../src/core/types";

function createMockItem() {
  const tags = [{ tag: "NLP" }];
  return {
    id: 1,
    libraryID: 1,
    getTags: () => tags,
    getField: (field: string) => {
      const fields: Record<string, string> = {
        title: "Retrieval augmented generation for archives",
        abstractNote: "A paper about RAG systems in archival research.",
        publicationTitle: "Journal of Test Fixtures",
      };
      return fields[field] || "";
    },
    getDisplayTitle: () => "Retrieval augmented generation for archives",
    addTag: (tag: string) => {
      tags.push({ tag });
    },
    saveTx: async () => undefined,
  } as unknown as Zotero.Item;
}

describe("tag suggestion workflow", function () {
  it("builds context, parses provider JSON, and applies only immediate tags", async function () {
    const item = createMockItem();
    const prompt: PromptConfig = {
      prompt: "Suggest tags.",
    };
    const tagging: TaggingConfig = {
      tagPolicy: "allow_new",
      applyMode: "auto_apply",
      customTagList: "",
      maxSuggestedTags: 4,
      temperature: 0.1,
      maxTokens: 200,
    };

    const messages = buildChatMessages(prompt, item, ["NLP", "RAG"], tagging);
    assert.equal(messages[1].content, "Suggest tags.");
    assert.include(messages[2].content, "Retrieval augmented generation");
    assert.include(messages[2].content, "Return strict JSON");

    const parsed = parseSuggestionResponse(
      JSON.stringify({ tags: ["NLP", "RAG", "new-topic"], reasoning: "ok" }),
      ["NLP", "RAG"],
      "allow_new",
      4,
    );
    const selection = selectTagsForImmediateApply(
      ["NLP"],
      parsed.existingTags,
      parsed.newTags,
      "auto_apply",
      "allow_new",
    );

    assert.deepEqual(selection.immediateTags, ["RAG"]);
    assert.deepEqual(selection.deferredTags, ["new-topic"]);

    const applied = await applyTagsToItem(item, selection.immediateTags);
    assert.deepEqual(applied, ["RAG"]);
    assert.deepEqual(
      item.getTags().map((tag) => tag.tag),
      ["NLP", "RAG"],
    );
  });
});
