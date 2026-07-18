import { describe, expect, it } from "vitest";
import { normalizeElevenLabsTranscript } from "./normalize-transcript";

describe("normalizeElevenLabsTranscript", () => {
  it("keeps word entries and drops spacing/audio events", () => {
    const result = normalizeElevenLabsTranscript({
      filename: "song.mp3",
      durationSeconds: 20,
      response: {
        words: [
          { type: "word", text: "Hello", start: 0.1, end: 0.4 },
          { type: "spacing", text: " ", start: 0.4, end: 0.5 },
          { type: "audio_event", text: "(laughs)", start: 0.5, end: 0.8 },
          { type: "word", text: "world", start: 0.9, end: 1.2 },
        ],
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.title).toBe("song");
    expect(result.transcript.artist).toBe("Unknown Artist");
    expect(result.transcript.lines[0]?.words.map((w) => w.text)).toEqual([
      "Hello",
      "world",
    ]);
  });

  it("rejects malformed words and empty transcripts", () => {
    const malformed = normalizeElevenLabsTranscript({
      filename: "a.wav",
      durationSeconds: 10,
      response: {
        words: [
          { type: "word", text: "", start: 0, end: 1 },
          { type: "word", text: "Hi", start: Number.NaN, end: 1 },
          { type: "word", text: "Yo", start: 2, end: 1 },
          { type: "word", text: "Late", start: 9, end: 12 },
        ],
      },
    });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) {
      expect(malformed.code).toBe("NO_LYRICS_FOUND");
    }
  });

  it("breaks lines on long silence gaps", () => {
    const result = normalizeElevenLabsTranscript({
      filename: "gap.mp3",
      durationSeconds: 30,
      response: {
        words: [
          { type: "word", text: "One", start: 0.0, end: 0.3 },
          { type: "word", text: "Two", start: 0.4, end: 0.7 },
          { type: "word", text: "Three", start: 2.5, end: 2.9 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.lines.length).toBe(2);
  });

  it("breaks lines after sentence punctuation when the line is long enough", () => {
    const result = normalizeElevenLabsTranscript({
      filename: "punct.mp3",
      durationSeconds: 30,
      response: {
        words: [
          { type: "word", text: "This", start: 0.0, end: 0.2 },
          { type: "word", text: "is", start: 0.25, end: 0.4 },
          { type: "word", text: "done.", start: 0.45, end: 0.7 },
          { type: "word", text: "Next", start: 0.8, end: 1.0 },
        ],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.transcript.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.transcript.lines[0]?.words.at(-1)?.text).toBe("done.");
  });
});
