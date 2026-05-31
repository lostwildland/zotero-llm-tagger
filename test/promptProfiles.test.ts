import { assert } from "chai";
import {
  DEFAULT_PROMPT_PROFILE,
  createPromptProfile,
  isDefaultPromptProfile,
  parseStoredPromptProfiles,
  serializeStoredPromptProfiles,
  validatePromptProfile,
} from "../src/core/promptProfiles";

describe("promptProfiles", function () {
  it("parses valid stored user profiles and ignores the built-in default id", function () {
    const profiles = parseStoredPromptProfiles(
      JSON.stringify([
        { id: "default", name: "Default", prompt: "ignored" },
        { id: "p1", name: "Scenario A", prompt: "Classify AI papers." },
        { id: "", name: "Broken", prompt: "ignored" },
      ]),
    );

    assert.deepEqual(profiles, [
      { id: "p1", name: "Scenario A", prompt: "Classify AI papers." },
    ]);
  });

  it("serializes user profiles without the built-in default profile", function () {
    const custom = createPromptProfile("Scenario B", "Suggest concise tags.");
    const serialized = serializeStoredPromptProfiles([
      DEFAULT_PROMPT_PROFILE,
      custom,
    ]);

    assert.deepEqual(JSON.parse(serialized), [
      { id: custom.id, name: "Scenario B", prompt: "Suggest concise tags." },
    ]);
  });

  it("protects the built-in default and validates editable prompts", function () {
    assert.isTrue(isDefaultPromptProfile(DEFAULT_PROMPT_PROFILE));
    assert.deepEqual(validatePromptProfile(createPromptProfile("", "short")), [
      "Prompt profile name is required.",
      "Prompt is too short.",
    ]);
  });
});
