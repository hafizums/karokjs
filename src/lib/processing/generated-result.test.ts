import { describe, expect, it } from "vitest";
import {
  parseStoredGeneratedResult,
  serializeGeneratedResultForTest,
  type StoredGeneratedResult,
} from "./generated-result";

describe("generated result serialization", () => {
  it("parses versioned stored results and rejects corrupt payloads", () => {
    const stored: StoredGeneratedResult = {
      version: 1,
      createdAt: 123,
      filename: "song.mp3",
      durationSeconds: 20,
      transcript: {
        title: "song",
        artist: "Unknown Artist",
        audioUrl: "idb:generated-instrumental",
        lines: [
          {
            id: "line-1",
            start: 0,
            end: 1,
            words: [{ id: "word-1-1", text: "Hi", start: 0, end: 1 }],
          },
        ],
      },
      theme: {
        backgroundPreset: "noir-gold",
        lyricSize: "medium",
        baseColor: "#f4f0e6",
        highlightColor: "#f0c14b",
      },
      instrumentalBlob: new Blob([new Uint8Array([1, 2, 3])], {
        type: "audio/mpeg",
      }),
    };

    const parsed = parseStoredGeneratedResult(stored);
    expect(parsed?.filename).toBe("song.mp3");
    expect(serializeGeneratedResultForTest(stored).instrumentalByteLength).toBe(
      3,
    );

    expect(parseStoredGeneratedResult({ ...stored, version: 99 })).toBe(null);
    expect(
      parseStoredGeneratedResult({
        ...stored,
        instrumentalBlob: new Blob([]),
      }),
    ).toBe(null);
  });
});
