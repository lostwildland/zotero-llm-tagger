import { assert } from "chai";
import {
  decodeTagColumnData,
  encodeTagColumnData,
  formatTagColumnTooltip,
  normalizeDisplayTags,
} from "../src/core/tagDisplay";

describe("tagDisplay", function () {
  it("filters internal and empty tags, deduplicates, and sorts", function () {
    const tags = normalizeDisplayTags([
      { tag: "AIInfrastructure/Dataset/CommonCrawl" },
      { tag: "_hidden" },
      { tag: "  " },
      { tag: "AIEthics/Safety" },
      { tag: "AIInfrastructure/Dataset/CommonCrawl" },
    ]);

    assert.deepEqual(tags, [
      "AIEthics/Safety",
      "AIInfrastructure/Dataset/CommonCrawl",
    ]);
  });

  it("round-trips tag column data without comma splitting", function () {
    const encoded = encodeTagColumnData([
      "AI Governance, Openness",
      "AIInfrastructure/Dataset/CommonCrawl",
    ]);

    assert.deepEqual(decodeTagColumnData(encoded), [
      "AI Governance, Openness",
      "AIInfrastructure/Dataset/CommonCrawl",
    ]);
  });

  it("formats a full tooltip for visible tags", function () {
    assert.equal(
      formatTagColumnTooltip(["Syllabus", "AITechnology"]),
      "AITechnology, Syllabus",
    );
  });
});
