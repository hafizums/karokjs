import { describe, expect, it, vi } from "vitest";
import { createMockProcessingProvider, MOCK_DEMO_RESULT_REFS } from "./mock-provider";
import type { SelectedAudioMeta } from "./types";

const selected: SelectedAudioMeta = {
  name: "clip.wav",
  sizeBytes: 4096,
  durationSeconds: 30,
  format: "WAV",
  mimeType: "audio/wav",
};

function immediateWait(_ms: number, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return Promise.resolve();
}

describe("mock processing provider", () => {
  it("emits ordered successful progress and demo refs only", async () => {
    const stages: string[] = [];
    const progresses: number[] = [];
    let completed = false;

    const provider = createMockProcessingProvider({
      wait: immediateWait,
      totalDurationMs: 100,
    });

    const file = new File([new Uint8Array([1, 2, 3])], "clip.wav", {
      type: "audio/wav",
    });

    await provider.startJob({
      selected,
      file,
      signal: new AbortController().signal,
      handlers: {
        onProgress: ({ stage, progress }) => {
          stages.push(stage);
          progresses.push(progress);
        },
        onCompleted: (result) => {
          completed = true;
          expect(result.mode).toBe("mock");
          expect(result.mockResult).toEqual(MOCK_DEMO_RESULT_REFS);
          expect(result.mockResult?.audioUrl).toBe("/demo/instrumental.wav");
        },
        onFailed: () => {
          throw new Error("should not fail");
        },
      },
    });

    expect(completed).toBe(true);
    expect(stages[0]).toBe("uploading");
    expect(stages.includes("separating")).toBe(true);
    expect(stages.includes("transcribing")).toBe(true);
    expect(stages.at(-1)).toBe("assembling");
    for (let i = 1; i < progresses.length; i += 1) {
      expect(progresses[i]).toBeGreaterThanOrEqual(progresses[i - 1]);
    }
  });

  it.each([
    "uploading",
    "separating",
    "transcribing",
    "assembling",
  ] as const)("fails deterministically during %s", async (mode) => {
    const provider = createMockProcessingProvider({
      wait: immediateWait,
      failureMode: mode,
    });
    const file = new File([new Uint8Array([1])], "clip.wav");
    let failureStage: string | null = null;

    await provider.startJob({
      selected,
      file,
      signal: new AbortController().signal,
      handlers: {
        onProgress: () => undefined,
        onCompleted: () => {
          throw new Error("should not complete");
        },
        onFailed: (failure) => {
          failureStage = failure.stage;
          expect(failure.retryable).toBe(true);
          expect(failure.message).not.toMatch(/stack|secret|exception/i);
        },
      },
    });

    expect(failureStage).toBe(mode);
  });

  it("cancellation prevents completion", async () => {
    const controller = new AbortController();
    let waits = 0;
    const provider = createMockProcessingProvider({
      wait: async (_ms, signal) => {
        waits += 1;
        if (waits === 2) controller.abort();
        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
      },
    });

    const onCompleted = vi.fn();
    const onFailed = vi.fn();

    await provider.startJob({
      selected,
      file: new File([new Uint8Array([1])], "clip.wav"),
      signal: controller.signal,
      handlers: {
        onProgress: () => undefined,
        onCompleted,
        onFailed,
      },
    });

    expect(onCompleted).not.toHaveBeenCalled();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("does not perform network uploads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    const provider = createMockProcessingProvider({ wait: immediateWait });
    await provider.startJob({
      selected,
      file: new File([new Uint8Array([9, 9, 9])], "clip.wav"),
      signal: new AbortController().signal,
      handlers: {
        onProgress: () => undefined,
        onCompleted: () => undefined,
        onFailed: () => undefined,
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
