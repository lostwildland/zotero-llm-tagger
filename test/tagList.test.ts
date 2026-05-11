import { assert } from "chai";
import { parseCommaSeparatedTags } from "../src/core/tagList";

describe("tagList", function () {
  it("deduplicates tags and supports common separators", function () {
    const tags = parseCommaSeparatedTags(
      "NLP, RAG；Knowledge Graph\nNLP，STS; Agent",
    );

    assert.deepEqual(tags, ["NLP", "RAG", "Knowledge Graph", "STS", "Agent"]);
  });
});
