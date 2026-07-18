import type { KaraokeLine, KaraokeTranscript, KaraokeWord } from "./types";

export function cloneTranscript(
  transcript: KaraokeTranscript,
): KaraokeTranscript {
  return structuredClone(transcript);
}

/**
 * Update a single word's text immutably.
 * Preserves word IDs, timing, and line structure. Returns the same reference
 * if the word is missing or the text is unchanged.
 */
export function updateWordText(
  transcript: KaraokeTranscript,
  wordId: string,
  text: string,
): KaraokeTranscript {
  let changed = false;

  const lines = transcript.lines.map((line) => {
    let lineChanged = false;
    const words = line.words.map((word) => {
      if (word.id !== wordId) return word;
      if (word.text === text) return word;
      lineChanged = true;
      changed = true;
      return { ...word, text };
    });
    return lineChanged ? { ...line, words } : line;
  });

  return changed ? { ...transcript, lines } : transcript;
}

export function updateTranscriptMeta(
  transcript: KaraokeTranscript,
  meta: { title?: string; artist?: string },
): KaraokeTranscript {
  const title =
    typeof meta.title === "string" ? meta.title : transcript.title;
  const artist =
    typeof meta.artist === "string" ? meta.artist : transcript.artist;

  if (title === transcript.title && artist === transcript.artist) {
    return transcript;
  }

  return { ...transcript, title, artist };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isWord(value: unknown): value is KaraokeWord {
  if (!value || typeof value !== "object") return false;
  const word = value as Record<string, unknown>;
  return (
    typeof word.id === "string" &&
    word.id.length > 0 &&
    typeof word.text === "string" &&
    isFiniteNumber(word.start) &&
    isFiniteNumber(word.end) &&
    word.end >= word.start
  );
}

function isLine(value: unknown): value is KaraokeLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.id === "string" &&
    line.id.length > 0 &&
    isFiniteNumber(line.start) &&
    isFiniteNumber(line.end) &&
    line.end >= line.start &&
    Array.isArray(line.words) &&
    line.words.length > 0 &&
    line.words.every(isWord)
  );
}

/** Validate a transcript against the Phase 1 contract. */
export function parseTranscript(input: unknown): KaraokeTranscript | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw.title !== "string") return null;
  if (typeof raw.artist !== "string") return null;
  if (typeof raw.audioUrl !== "string" || raw.audioUrl.length === 0) {
    return null;
  }
  if (!Array.isArray(raw.lines) || raw.lines.length === 0) return null;
  if (!raw.lines.every(isLine)) return null;

  // Deep-clone validated data so callers never share mutable refs.
  return cloneTranscript({
    title: raw.title,
    artist: raw.artist,
    audioUrl: raw.audioUrl,
    lines: raw.lines as KaraokeLine[],
  });
}
