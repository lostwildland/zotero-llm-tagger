import { DEFAULT_PROMPT_TEXT } from "./defaults";
import { PromptConfig, PromptProfile } from "./types";
import { getPref } from "../utils/prefs";

export const DEFAULT_PROMPT_PROFILE_ID = "default";

export const DEFAULT_PROMPT_PROFILE: PromptProfile = {
  id: DEFAULT_PROMPT_PROFILE_ID,
  name: "Default",
  prompt: DEFAULT_PROMPT_TEXT,
  builtIn: true,
};

export function getPromptProfiles(): PromptProfile[] {
  return [DEFAULT_PROMPT_PROFILE, ...parseStoredPromptProfiles(getPref("promptProfiles"))];
}

export function getPromptProfile(profileId?: string): PromptProfile {
  return (
    getPromptProfiles().find((profile) => profile.id === profileId) ||
    DEFAULT_PROMPT_PROFILE
  );
}

export function toPromptConfig(profile: PromptProfile): PromptConfig {
  return {
    prompt: profile.prompt,
  };
}

export function parseStoredPromptProfiles(value: unknown): PromptProfile[] {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const seenIds = new Set<string>([DEFAULT_PROMPT_PROFILE_ID]);
    const profiles: PromptProfile[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const profile = entry as Record<string, unknown>;
      const id = typeof profile.id === "string" ? profile.id.trim() : "";
      const name =
        typeof profile.name === "string" ? profile.name.trim() : "";
      const prompt =
        typeof profile.prompt === "string" ? profile.prompt : "";
      if (!id || seenIds.has(id) || !name) continue;
      seenIds.add(id);
      profiles.push({ id, name, prompt });
    }
    return profiles;
  } catch (_error) {
    return [];
  }
}

export function serializeStoredPromptProfiles(
  profiles: PromptProfile[],
): string {
  return JSON.stringify(
    profiles
      .filter((profile) => !profile.builtIn && profile.id !== DEFAULT_PROMPT_PROFILE_ID)
      .map((profile) => ({
        id: profile.id,
        name: profile.name.trim(),
        prompt: profile.prompt,
      })),
  );
}

export function createPromptProfile(name: string, prompt = ""): PromptProfile {
  return {
    id: `profile-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    name: name.trim(),
    prompt,
  };
}

export function validatePromptProfile(profile: PromptProfile): string[] {
  const errors: string[] = [];
  if (!profile.name.trim()) {
    errors.push("Prompt profile name is required.");
  }
  if (!profile.prompt.trim() || profile.prompt.trim().length < 10) {
    errors.push("Prompt is too short.");
  }
  return errors;
}

export function isDefaultPromptProfile(profile: PromptProfile): boolean {
  return profile.id === DEFAULT_PROMPT_PROFILE_ID || Boolean(profile.builtIn);
}
