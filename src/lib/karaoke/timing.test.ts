import { describe, expect, it } from "vitest";
import {
  clampProgress,
  formatTime,
  getActiveLine,
  getActiveWord,
  getActiveWordState,
  getLyricWindow,
  getWordProgress,
} from "./timing";
import type { KaraokeLine } from "./types";

const lines: KaraokeLine[] = [
  {
    id: "line-1",
    start: 0.5,
    end: 4.0,
    words: [
      { id: "word-1", text: "Hello", start: 0.5, end: 1.2 },
      { id: "word-2", text: "world", start: 1.2, end: 2.5 },
      { id: "word-3", text: "again", start: 2.8, end: 4.0 },
    ],
  },
  {
    id: "line-2",
    start: 5.0,
    end: 8.0,
    words: [
      { id: "word-4", text: "Next", start: 5.0, end: 5.8 },
      { id: "word-5", text: "line", start: 5.8, end: 8.0 },
    ],
  },
  {
    id: "line-3",
    start: 9.0,
    end: 12.0,
    words: [
      { id: "word-6", text: "Final", start: 9.0, end: 10.0 },
      { id: "word-7", text: "words", start: 10.0, end: 12.0 },
    ],
  },
];

describe("clampProgress", () => {
  it("clamps below 0 and above 1", () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(0.4)).toBe(0.4);
    expect(clampProgress(1)).toBe(1);
    expect(clampProgress(1.7)).toBe(1);
  });

  it("treats non-finite values as 0", () => {
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("getActiveLine", () => {
  it("returns null before the first line and during gaps", () => {
    expect(getActiveLine(lines, 0)).toBeNull();
    expect(getActiveLine(lines, 4.5)).toBeNull();
  });

  it("selects the containing line", () => {
    expect(getActiveLine(lines, 1.0)?.id).toBe("line-1");
    expect(getActiveLine(lines, 5.5)?.id).toBe("line-2");
  });

  it("keeps the final line visible at its exact end boundary", () => {
    expect(getActiveLine(lines, 12)?.id).toBe("line-3");
  });

  it("returns null after the song ends", () => {
    expect(getActiveLine(lines, 12.01)).toBeNull();
  });
});

describe("getActiveWord", () => {
  const words = lines[0].words;

  it("returns null in word gaps and before the first word", () => {
    expect(getActiveWord(words, 0.2)).toBeNull();
    expect(getActiveWord(words, 2.6)).toBeNull();
  });

  it("selects the containing word", () => {
    expect(getActiveWord(words, 0.8)?.id).toBe("word-1");
    expect(getActiveWord(words, 1.5)?.id).toBe("word-2");
  });

  it("includes the final word end boundary", () => {
    expect(getActiveWord(words, 4)?.id).toBe("word-3");
  });
});

describe("getWordProgress", () => {
  const word = lines[0].words[0];

  it("computes and clamps progress", () => {
    expect(getWordProgress(word, 0.2)).toBe(0);
    expect(getWordProgress(word, 0.5)).toBe(0);
    expect(getWordProgress(word, 0.85)).toBeCloseTo(0.5, 5);
    expect(getWordProgress(word, 1.2)).toBe(1);
    expect(getWordProgress(word, 2)).toBe(1);
  });

  it("handles zero-duration words without dividing by zero", () => {
    const zero = { id: "z", text: "x", start: 1, end: 1 };
    expect(getWordProgress(zero, 0.9)).toBe(0);
    expect(getWordProgress(zero, 1)).toBe(1);
  });
});

describe("getActiveWordState", () => {
  it("returns empty state when no word is active", () => {
    expect(getActiveWordState(lines, 0)).toEqual({ word: null, progress: 0 });
    expect(getActiveWordState(lines, 2.6)).toEqual({ word: null, progress: 0 });
  });

  it("returns the active word with clamped progress", () => {
    const state = getActiveWordState(lines, 0.85);
    expect(state.word?.id).toBe("word-1");
    expect(state.progress).toBeCloseTo(0.5, 5);
  });
});

describe("getLyricWindow", () => {
  it("exposes previous, current, and next around the active line", () => {
    const window = getLyricWindow(lines, 6);
    expect(window.previous?.id).toBe("line-1");
    expect(window.current?.id).toBe("line-2");
    expect(window.next?.id).toBe("line-3");
  });

  it("handles beginning, gaps, and end gracefully", () => {
    expect(getLyricWindow(lines, 0)).toEqual({
      previous: null,
      current: null,
      next: lines[0],
    });

    const gap = getLyricWindow(lines, 4.5);
    expect(gap.previous?.id).toBe("line-1");
    expect(gap.current).toBeNull();
    expect(gap.next?.id).toBe("line-2");

    const after = getLyricWindow(lines, 13);
    expect(after.previous?.id).toBe("line-3");
    expect(after.current).toBeNull();
    expect(after.next).toBeNull();
  });
});

describe("formatTime", () => {
  it("formats as m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(-1)).toBe("0:00");
  });
});
