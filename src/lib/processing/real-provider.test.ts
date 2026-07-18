import { describe, expect, it, vi } from "vitest";
import { createRealProcessingProvider } from "./real-provider";
import type { SelectedAudioMeta } from "./types";

const selected: SelectedAudioMeta = {
  name: "live.mp3",
  sizeBytes: 2048,
  durationSeconds: 12,
  format: "MP3",
  mimeType: "audio/mpeg",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("real processing provider", () => {
  it("polls separation, cancels without late completion, and checkpoints retries", async () => {
    let separationPosts = 0;
    let transcriptionPosts = 0;
    let pollCount = 0;

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/processing/separation" && init?.method === "POST") {
        separationPosts += 1;
        return jsonResponse({ job: "signed-job-token" });
      }
      if (url.startsWith("/api/processing/separation?job=")) {
        pollCount += 1;
        if (pollCount < 2) {
          return jsonResponse({ status: "processing" });
        }
        return jsonResponse({ status: "completed" });
      }
      if (url === "/api/processing/transcription") {
        transcriptionPosts += 1;
        if (transcriptionPosts === 1) {
          return jsonResponse(
            {
              error: {
                code: "PROVIDER_FAILED",
                message: "temporary",
                retryable: true,
              },
            },
            502,
          );
        }
        return jsonResponse({
          transcript: {
            title: "live",
            artist: "Unknown Artist",
            audioUrl: "",
            lines: [
              {
                id: "line-1",
                start: 0,
                end: 1,
                words: [{ id: "word-1-1", text: "Hi", start: 0, end: 1 }],
              },
            ],
          },
        });
      }
      if (url.startsWith("/api/processing/instrumental?job=")) {
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const saveResult = vi.fn(async () => ({
      version: 1 as const,
      createdAt: 1,
      filename: selected.name,
      durationSeconds: selected.durationSeconds,
      transcript: {
        title: "live",
        artist: "Unknown Artist",
        audioUrl: "",
        lines: [],
      },
      theme: {
        backgroundPreset: "noir-gold" as const,
        lyricSize: "medium" as const,
        baseColor: "#f4f0e6",
        highlightColor: "#f0c14b",
      },
      instrumentalBlob: new Blob([new Uint8Array([1])]),
    }));

    const provider = createRealProcessingProvider({
      fetchImpl: fetchImpl as typeof fetch,
      saveResult: saveResult as never,
      pollInitialMs: 1,
      pollMaxMs: 1,
      pollTimeoutMs: 1000,
    });

    const file = new File([new Uint8Array([9])], "live.mp3", {
      type: "audio/mpeg",
    });

    let failed = false;
    await provider.startJob({
      selected,
      file,
      signal: new AbortController().signal,
      handlers: {
        onProgress: () => undefined,
        onCompleted: () => {
          throw new Error("should fail first");
        },
        onFailed: () => {
          failed = true;
        },
      },
    });
    expect(failed).toBe(true);
    expect(separationPosts).toBe(1);
    expect(provider.getCheckpointsForTests().jobToken).toBe("signed-job-token");

    // Retry transcription should not resubmit separation.
    let completed = false;
    await provider.startJob({
      selected,
      file,
      signal: new AbortController().signal,
      handlers: {
        onProgress: () => undefined,
        onCompleted: () => {
          completed = true;
        },
        onFailed: (failure) => {
          throw new Error(failure.message);
        },
      },
    });
    expect(completed).toBe(true);
    expect(separationPosts).toBe(1);
    expect(transcriptionPosts).toBe(2);
    expect(saveResult).toHaveBeenCalledTimes(1);
  });

  it("cancellation prevents late completion callbacks", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/processing/separation" && init?.method === "POST") {
        return jsonResponse({ job: "job-1" });
      }
      if (url.startsWith("/api/processing/separation?job=")) {
        controller.abort();
        return jsonResponse({ status: "processing" });
      }
      return jsonResponse({});
    });

    const provider = createRealProcessingProvider({
      fetchImpl: fetchImpl as typeof fetch,
      pollInitialMs: 1,
      pollMaxMs: 1,
      pollTimeoutMs: 1000,
      saveResult: vi.fn() as never,
    });

    const onCompleted = vi.fn();
    const onFailed = vi.fn();

    await provider.startJob({
      selected,
      file: new File([new Uint8Array([1])], "live.mp3"),
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

  it("rejects client-supplied remote URL usage by only calling job-token endpoints", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url === "/api/processing/separation") {
        return jsonResponse({ job: "token" });
      }
      if (url.startsWith("/api/processing/separation?job=")) {
        return jsonResponse({ status: "completed" });
      }
      if (url === "/api/processing/transcription") {
        return jsonResponse({
          transcript: {
            title: "t",
            artist: "a",
            audioUrl: "",
            lines: [
              {
                id: "line-1",
                start: 0,
                end: 1,
                words: [{ id: "w", text: "Hi", start: 0, end: 1 }],
              },
            ],
          },
        });
      }
      if (url.startsWith("/api/processing/instrumental?job=")) {
        return new Response(new Uint8Array([1]), { status: 200 });
      }
      throw new Error("unexpected");
    });

    const provider = createRealProcessingProvider({
      fetchImpl: fetchImpl as typeof fetch,
      pollInitialMs: 1,
      saveResult: vi.fn(async (input) => ({
        version: 1 as const,
        createdAt: 1,
        ...input,
        theme: input.theme,
      })) as never,
    });

    await provider.startJob({
      selected,
      file: new File([new Uint8Array([1])], "live.mp3"),
      signal: new AbortController().signal,
      handlers: {
        onProgress: () => undefined,
        onCompleted: () => undefined,
        onFailed: () => undefined,
      },
    });

    expect(urls.every((url) => url.startsWith("/api/processing/"))).toBe(true);
    expect(urls.some((url) => /https?:\/\/(?!localhost)/i.test(url))).toBe(
      false,
    );
  });
});
