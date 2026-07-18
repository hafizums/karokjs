import { demoTranscript } from "@/data/demo-transcript";
import {
  cloneDefaultTheme,
  parseTheme,
  type KaraokeTheme,
} from "./theme";
import { cloneTranscript, parseTranscript } from "./transcript-edit";
import type { KaraokeTranscript } from "./types";

export const DRAFT_STORAGE_KEY = "karoks:demo-draft:v1";
export const DRAFT_VERSION = 1 as const;

export type KaraokeDraft = {
  version: typeof DRAFT_VERSION;
  transcript: KaraokeTranscript;
  theme: KaraokeTheme;
};

export function createDefaultDraft(): KaraokeDraft {
  return {
    version: DRAFT_VERSION,
    transcript: cloneTranscript(demoTranscript),
    theme: cloneDefaultTheme(),
  };
}

/**
 * Parse a draft from unknown JSON.
 * Returns null for unsupported versions or invalid structure so callers
 * can fall back to defaults.
 */
export function parseDraft(input: unknown): KaraokeDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  if (raw.version !== DRAFT_VERSION) return null;

  const transcript = parseTranscript(raw.transcript);
  if (!transcript) return null;

  // Theme fields are sanitized with defaults; invalid presets/colors fall back.
  const theme = parseTheme(raw.theme);

  return {
    version: DRAFT_VERSION,
    transcript,
    theme,
  };
}

export function parseDraftJson(json: string): KaraokeDraft | null {
  try {
    return parseDraft(JSON.parse(json) as unknown);
  } catch {
    return null;
  }
}

export function serializeDraft(draft: KaraokeDraft): string {
  return JSON.stringify({
    version: DRAFT_VERSION,
    transcript: draft.transcript,
    theme: draft.theme,
  });
}

export function readDraftFromStorage(
  storage: Pick<Storage, "getItem"> | null | undefined,
): KaraokeDraft {
  if (!storage) return createDefaultDraft();

  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return createDefaultDraft();
    return parseDraftJson(raw) ?? createDefaultDraft();
  } catch {
    return createDefaultDraft();
  }
}

export function writeDraftToStorage(
  storage: Pick<Storage, "setItem"> | null | undefined,
  draft: KaraokeDraft,
): void {
  if (!storage) return;
  try {
    storage.setItem(DRAFT_STORAGE_KEY, serializeDraft(draft));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearDraftFromStorage(
  storage: Pick<Storage, "removeItem"> | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
