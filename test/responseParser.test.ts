import { assert } from "chai";
import { parseSuggestionResponse } from "../src/core/responseParser";

describe("responseParser", function () {
  it("filters tags to existing list when tagPolicy is existing_only", function () {
    const parsed = parseSuggestionResponse(
      JSON.stringify({ tags: ["NLP", "new-tag", "NLP"], reasoning: "ok" }),
      ["NLP", "LLM"],
      "existing_only",
      8,
    );

    assert.deepEqual(parsed.tags, ["NLP"]);
    assert.deepEqual(parsed.existingTags, ["NLP"]);
    assert.deepEqual(parsed.newTags, []);
  });

  it("keeps new tags when tagPolicy is allow_new", function () {
    const parsed = parseSuggestionResponse(
      JSON.stringify({ tags: ["LLM", "new-tag"], reasoning: "ok" }),
      ["LLM"],
      "allow_new",
      8,
    );

    assert.deepEqual(parsed.tags, ["LLM", "new-tag"]);
    assert.deepEqual(parsed.existingTags, ["LLM"]);
    assert.deepEqual(parsed.newTags, ["new-tag"]);
  });

  it("filters to custom list when tagPolicy is custom_list", function () {
    const parsed = parseSuggestionResponse(
      JSON.stringify({ tags: ["RAG", "foo"], reasoning: "ok" }),
      ["RAG", "Knowledge Graph"],
      "custom_list",
      8,
    );

    assert.deepEqual(parsed.tags, ["RAG"]);
    assert.deepEqual(parsed.existingTags, ["RAG"]);
    assert.deepEqual(parsed.newTags, []);
  });
});
