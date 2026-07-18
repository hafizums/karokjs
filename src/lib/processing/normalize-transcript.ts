import type { KaraokeLine, KaraokeTranscript, KaraokeWord } from "@/lib/karaoke/types";

export type ElevenLabsWordLike = {
  text?: unknown;
  type?: unknown;
  start?: unknown;
  end?: unknown;
};

export type ElevenLabsTranscriptLike = {
  words?: unknown;
  text?: unknown;
};

export type NormalizeTranscriptInput = {
  filename: string;
  durationSeconds: number;
  response: ElevenLabsTranscriptLike;
};

export type NormalizeTranscriptResult =
  | { ok: true; transcript: KaraokeTranscript }
  | { ok: false; code: "NO_LYRICS_FOUND" | "INVALID_TRANSCRIPT"; message: string };

const MAX_WORDS_PER_LINE = 8;
const MAX_CHARS_PER_LINE = 48;
const SILENCE_GAP_SECONDS = 1.2;
const MIN_WORDS_FOR_SENTENCE_BREAK = 3;

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").trim();
  return base.length > 0 ? base : "Untitled";
}

function isSentenceEnding(text: string): boolean {
  return /[.!?…]["')\]]*$/u.test(text.trim());
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Convert ElevenLabs Scribe word timestamps into KaraokeTranscript.
 */
export function normalizeElevenLabsTranscript(
  input: NormalizeTranscriptInput,
): NormalizeTranscriptResult {
  const duration = input.durationSeconds;
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      ok: false,
      code: "INVALID_TRANSCRIPT",
      message: "Audio duration is invalid.",
    };
  }

  const rawWords = Array.isArray(input.response.words) ? input.response.words : [];
  const words: KaraokeWord[] = [];

  for (const entry of rawWords) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as ElevenLabsWordLike;
    if (item.type !== "word") continue;

    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;

    const start = asFiniteNumber(item.start);
    const end = asFiniteNumber(item.end);
    if (start === null || end === null) continue;
    if (!(start >= 0 && start < end && end <= duration + 0.05)) continue;

    const clampedEnd = Math.min(end, duration);
    if (!(start < clampedEnd)) continue;

    words.push({
      id: `word-${words.length + 1}`,
      text,
      start,
      end: clampedEnd,
    });
  }

  words.sort((a, b) => a.start - b.start || a.end - b.end);

  if (words.length === 0) {
    return {
      ok: false,
      code: "NO_LYRICS_FOUND",
      message: "No lyrics were found in this track.",
    };
  }

  // Re-id after sort for stable deterministic IDs.
  const ordered = words.map((word, index) => ({
    ...word,
    id: `word-${index + 1}`,
  }));

  const lines: KaraokeLine[] = [];
  let current: KaraokeWord[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const lineIndex = lines.length + 1;
    lines.push({
      id: `line-${lineIndex}`,
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current.map((word, index) => ({
        ...word,
        id: `word-${lineIndex}-${index + 1}`,
      })),
    });
    current = [];
  };

  for (const word of ordered) {
    if (current.length === 0) {
      current.push(word);
      continue;
    }

    const prev = current[current.length - 1];
    const gap = word.start - prev.end;
    const nextChars =
      current.reduce((sum, item) => sum + item.text.length, 0) +
      word.text.length +
      current.length; // spaces between words

    const breakForGap = gap > SILENCE_GAP_SECONDS;
    const breakForCount = current.length >= MAX_WORDS_PER_LINE;
    const breakForChars = nextChars > MAX_CHARS_PER_LINE && current.length > 0;
    const breakForSentence =
      current.length >= MIN_WORDS_FOR_SENTENCE_BREAK &&
      isSentenceEnding(prev.text);

    if (breakForGap || breakForCount || breakForChars || breakForSentence) {
      flush();
    }

    current.push(word);
  }
  flush();

  return {
    ok: true,
    transcript: {
      title: titleFromFilename(input.filename),
      artist: "Unknown Artist",
      audioUrl: "",
      lines,
    },
  };
}
