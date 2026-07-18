import { describe, expect, it } from "vitest";
import {
  clearDraftFromStorage,
  createDefaultDraft,
  DRAFT_STORAGE_KEY,
  parseDraft,
  parseDraftJson,
  readDraftFromStorage,
  serializeDraft,
  writeDraftToStorage,
} from "./draft";
import {
  draftToExportPayload,
  safeExportFilename,
  serializeExportJson,
} from "./export-draft";
import { DEFAULT_THEME, parseTheme, sanitizeHexColor } from "./theme";
import {
  cloneTranscript,
  updateTranscriptMeta,
  updateWordText,
} from "./transcript-edit";
import type { KaraokeTranscript } from "./types";

const sampleTranscript: KaraokeTranscript = {
  title: "Demo Song",
  artist: "Demo Artist",
  audioUrl: "/demo/instrumental.wav",
  lines: [
    {
      id: "line-1",
      start: 0.5,
      end: 2,
      words: [
        { id: "word-1", text: "Hello", start: 0.5, end: 1.0 },
        { id: "word-2", text: "world", start: 1.0, end: 2.0 },
      ],
    },
  ],
};

describe("immutable word-text editing", () => {
  it("updates text while preserving ids and timing", () => {
    const original = cloneTranscript(sampleTranscript);
    const next = updateWordText(original, "word-1", "Hi");

    expect(next).not.toBe(original);
    expect(next.lines[0].words[0].text).toBe("Hi");
    expect(next.lines[0].words[0].id).toBe("word-1");
    expect(next.lines[0].words[0].start).toBe(0.5);
    expect(next.lines[0].words[0].end).toBe(1.0);
    expect(original.lines[0].words[0].text).toBe("Hello");
  });

  it("leaves unrelated words untouched and returns same ref when unchanged", () => {
    const original = cloneTranscript(sampleTranscript);
    const same = updateWordText(original, "word-1", "Hello");
    expect(same).toBe(original);

    const next = updateWordText(original, "missing", "x");
    expect(next).toBe(original);
  });

  it("updates title/artist without mutating the source", () => {
    const original = cloneTranscript(sampleTranscript);
    const next = updateTranscriptMeta(original, {
      title: "New Title",
      artist: "New Artist",
    });
    expect(next.title).toBe("New Title");
    expect(next.artist).toBe("New Artist");
    expect(original.title).toBe("Demo Song");
  });
});

describe("draft parsing and fallbacks", () => {
  it("parses a successful draft", () => {
    const draft = createDefaultDraft();
    draft.transcript = updateWordText(draft.transcript, "word-1", "Singing");
    draft.theme.highlightColor = "#ffcc00";

    const parsed = parseDraftJson(serializeDraft(draft));
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(1);
    expect(parsed?.transcript.lines[0].words[0].text).toBe("Singing");
    expect(parsed?.theme.highlightColor).toBe("#ffcc00");
  });

  it("falls back on malformed JSON", () => {
    expect(parseDraftJson("{not-json")).toBeNull();
    const storage = {
      getItem: () => "{not-json",
    };
    const draft = readDraftFromStorage(storage);
    expect(draft.transcript.title).toBe(createDefaultDraft().transcript.title);
    expect(draft.theme).toEqual(DEFAULT_THEME);
  });

  it("rejects unsupported draft versions", () => {
    expect(
      parseDraft({
        version: 99,
        transcript: sampleTranscript,
        theme: DEFAULT_THEME,
      }),
    ).toBeNull();
  });

  it("rejects invalid transcripts", () => {
    expect(
      parseDraft({
        version: 1,
        transcript: { title: "x" },
        theme: DEFAULT_THEME,
      }),
    ).toBeNull();

    expect(
      parseDraft({
        version: 1,
        transcript: {
          ...sampleTranscript,
          lines: [{ id: "line-1", start: 0, end: 1, words: [] }],
        },
        theme: DEFAULT_THEME,
      }),
    ).toBeNull();
  });

  it("falls back invalid theme presets while keeping valid transcript", () => {
    const parsed = parseDraft({
      version: 1,
      transcript: sampleTranscript,
      theme: {
        backgroundPreset: "hot-pink-void",
        lyricSize: "enormous",
        baseColor: "#abcdef",
        highlightColor: "#123456",
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.theme.backgroundPreset).toBe("noir-gold");
    expect(parsed?.theme.lyricSize).toBe("medium");
    expect(parsed?.theme.baseColor).toBe("#abcdef");
    expect(parsed?.theme.highlightColor).toBe("#123456");
  });
});

describe("color sanitization", () => {
  it("accepts six-digit hex and rejects invalid values", () => {
    expect(sanitizeHexColor("#FfAa00")).toBe("#ffaa00");
    expect(sanitizeHexColor("#fff")).toBeNull();
    expect(sanitizeHexColor("red")).toBeNull();
    expect(sanitizeHexColor(null)).toBeNull();
  });

  it("parseTheme falls back invalid colors to defaults", () => {
    const theme = parseTheme({
      backgroundPreset: "midnight-blue",
      lyricSize: "large",
      baseColor: "nope",
      highlightColor: "#12",
    });
    expect(theme.backgroundPreset).toBe("midnight-blue");
    expect(theme.lyricSize).toBe("large");
    expect(theme.baseColor).toBe(DEFAULT_THEME.baseColor);
    expect(theme.highlightColor).toBe(DEFAULT_THEME.highlightColor);
  });
});

describe("safe export filename generation", () => {
  it("slugifies titles and provides a fallback", () => {
    expect(safeExportFilename("Demo Song!")).toBe(
      "demo-song-karoks-draft.json",
    );
    expect(safeExportFilename("  ")).toBe("karaoke-draft-karoks-draft.json");
    expect(safeExportFilename("@@@")).toBe("karaoke-draft-karoks-draft.json");
  });
});

describe("export serialization", () => {
  it("includes edited title, word text, and theme values", () => {
    const draft = createDefaultDraft();
    draft.transcript = updateTranscriptMeta(draft.transcript, {
      title: "Export Check",
    });
    draft.transcript = updateWordText(draft.transcript, "word-1", "Exported");
    draft.theme = {
      backgroundPreset: "neon-berry",
      lyricSize: "large",
      baseColor: "#112233",
      highlightColor: "#abcdef",
    };

    const json = serializeExportJson(draft);
    const parsed = JSON.parse(json) as ReturnType<typeof draftToExportPayload>;

    expect(parsed.version).toBe(1);
    expect(parsed.transcript.title).toBe("Export Check");
    expect(parsed.transcript.lines[0].words[0].text).toBe("Exported");
    expect(parsed.theme.backgroundPreset).toBe("neon-berry");
    expect(parsed.theme.lyricSize).toBe("large");
    expect(parsed.theme.baseColor).toBe("#112233");
    expect(parsed.theme.highlightColor).toBe("#abcdef");
  });
});

describe("reset/default cloning without shared mutations", () => {
  it("creates independent default drafts", () => {
    const a = createDefaultDraft();
    const b = createDefaultDraft();
    a.transcript.title = "Mutated";
    a.transcript.lines[0].words[0].text = "Changed";
    a.theme.lyricSize = "large";

    expect(b.transcript.title).not.toBe("Mutated");
    expect(b.transcript.lines[0].words[0].text).not.toBe("Changed");
    expect(b.theme.lyricSize).toBe("medium");
  });

  it("clears storage and restores defaults on reset path", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };

    const edited = createDefaultDraft();
    edited.transcript = updateWordText(edited.transcript, "word-1", "Edited");
    writeDraftToStorage(storage, edited);
    expect(memory.has(DRAFT_STORAGE_KEY)).toBe(true);

    clearDraftFromStorage(storage);
    expect(memory.has(DRAFT_STORAGE_KEY)).toBe(false);

    const restored = readDraftFromStorage(storage);
    expect(restored.transcript.lines[0].words[0].text).toBe(
      createDefaultDraft().transcript.lines[0].words[0].text,
    );
  });
});
