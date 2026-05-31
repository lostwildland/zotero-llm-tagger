import {
  DEFAULT_PROMPT_TEXT,
  LEGACY_DEFAULT_SYSTEM_PROMPT,
  LEGACY_DEFAULT_USER_PROMPT,
} from "./defaults";
import { getPref, getRawPref, setPref } from "../utils/prefs";

function prefString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function legacyPromptText(): string {
  const legacySystemPrompt = prefString(getRawPref("systemPrompt")).trim();
  const legacyUserPrompt = prefString(getRawPref("userPrompt")).trim();
  const parts: string[] = [];

  if (
    legacySystemPrompt &&
    legacySystemPrompt !== LEGACY_DEFAULT_SYSTEM_PROMPT
  ) {
    parts.push(legacySystemPrompt);
  }
  if (legacyUserPrompt && legacyUserPrompt !== LEGACY_DEFAULT_USER_PROMPT) {
    parts.push(legacyUserPrompt);
  }

  return parts.join("\n\n");
}

export function getEffectivePromptText(): string {
  const currentPrompt = prefString(getPref("prompt")).trim();
  const migratedPrompt = legacyPromptText();

  if (
    migratedPrompt &&
    (!currentPrompt || currentPrompt === DEFAULT_PROMPT_TEXT)
  ) {
    return migratedPrompt;
  }

  return currentPrompt || DEFAULT_PROMPT_TEXT;
}

export function migratePromptPreference(): string {
  const prompt = getEffectivePromptText();

  if (prefString(getPref("prompt")) !== prompt) {
    setPref("prompt", prompt);
  }

  return prompt;
}
