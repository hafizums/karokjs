import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDuration,
  formatFileSize,
  readAudioDuration,
  validateAudioFile,
} from "./file-validation";

describe("validateAudioFile", () => {
  const base = {
    name: "track.mp3",
    size: 1024,
    type: "audio/mpeg",
    durationSeconds: 120,
  };

  it("accepts supported extensions", () => {
    const cases: Array<{ name: string; type: string }> = [
      { name: "a.mp3", type: "audio/mpeg" },
      { name: "b.wav", type: "audio/wav" },
      { name: "c.m4a", type: "audio/mp4" },
      { name: "d.flac", type: "audio/flac" },
    ];
    for (const item of cases) {
      const result = validateAudioFile({ ...base, ...item });
      expect(result.ok).toBe(true);
    }
    // Extension alone is enough when MIME is empty.
    expect(validateAudioFile({ ...base, name: "b.wav", type: "" }).ok).toBe(
      true,
    );
  });

  it("rejects unsupported extensions", () => {
    const result = validateAudioFile({ ...base, name: "song.aac" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("UNSUPPORTED_EXTENSION");
    }
  });

  it("rejects empty files", () => {
    const result = validateAudioFile({ ...base, size: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("EMPTY_FILE");
    }
  });

  it("rejects oversized files", () => {
    const result = validateAudioFile({
      ...base,
      size: 50 * 1024 * 1024 + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("FILE_TOO_LARGE");
    }
  });

  it("rejects duration over 12 minutes", () => {
    const result = validateAudioFile({
      ...base,
      durationSeconds: 12 * 60 + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe("DURATION_TOO_LONG");
    }
  });

  it("rejects invalid duration", () => {
    const missing = validateAudioFile({ ...base, durationSeconds: null });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.failure.code).toBe("INVALID_DURATION");
    }

    const zero = validateAudioFile({ ...base, durationSeconds: 0 });
    expect(zero.ok).toBe(false);
  });

  it("tolerates empty MIME and octet-stream", () => {
    expect(validateAudioFile({ ...base, type: "" }).ok).toBe(true);
    expect(validateAudioFile({ ...base, type: null }).ok).toBe(true);
    expect(
      validateAudioFile({ ...base, type: "application/octet-stream" }).ok,
    ).toBe(true);
    expect(validateAudioFile({ ...base, type: "audio/mp3" }).ok).toBe(true);
  });

  it("rejects non-audio MIME types", () => {
    const bad = validateAudioFile({ ...base, type: "image/png" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.failure.code).toBe("MIME_MISMATCH");
    }
  });

  it("rejects known extension/MIME mismatches", () => {
    const wavAsMp3 = validateAudioFile({
      ...base,
      name: "track.mp3",
      type: "audio/wav",
    });
    expect(wavAsMp3.ok).toBe(false);
    if (!wavAsMp3.ok) {
      expect(wavAsMp3.failure.code).toBe("MIME_MISMATCH");
    }

    const mp3AsWav = validateAudioFile({
      ...base,
      name: "track.wav",
      type: "audio/mpeg",
    });
    expect(mp3AsWav.ok).toBe(false);
    if (!mp3AsWav.ok) {
      expect(mp3AsWav.failure.code).toBe("MIME_MISMATCH");
    }

    const webmAsFlac = validateAudioFile({
      ...base,
      name: "track.flac",
      type: "audio/webm",
    });
    expect(webmAsFlac.ok).toBe(false);
    if (!webmAsFlac.ok) {
      expect(webmAsFlac.failure.code).toBe("MIME_MISMATCH");
    }
  });

  it("accepts extension-specific MIME aliases", () => {
    expect(
      validateAudioFile({
        ...base,
        name: "a.wav",
        type: "audio/x-wav",
      }).ok,
    ).toBe(true);
    expect(
      validateAudioFile({
        ...base,
        name: "a.m4a",
        type: "audio/mp4",
      }).ok,
    ).toBe(true);
    expect(
      validateAudioFile({
        ...base,
        name: "a.flac",
        type: "audio/x-flac",
      }).ok,
    ).toBe(true);
  });
});

describe("format helpers", () => {
  it("formats size and duration", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatDuration(65)).toBe("1:05");
  });
});

describe("readAudioDuration object URL cleanup", () => {
  const created = new Set<string>();
  const revoked = new Set<string>();

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    created.clear();
    revoked.clear();
  });

  function stubUrlAndAudio(options: {
    duration?: number;
    emitError?: boolean;
    emitNever?: boolean;
  }) {
    let seq = 0;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => {
        const url = `blob:test-${++seq}`;
        created.add(url);
        return url;
      }),
      revokeObjectURL: vi.fn((url: string) => {
        revoked.add(url);
      }),
    });

    class FakeAudio {
      preload = "";
      duration = options.duration ?? 12;
      private _src = "";
      private listeners = new Map<string, Set<() => void>>();

      addEventListener(type: string, listener: () => void) {
        const set = this.listeners.get(type) ?? new Set();
        set.add(listener);
        this.listeners.set(type, set);
      }

      removeEventListener(type: string, listener: () => void) {
        this.listeners.get(type)?.delete(listener);
      }

      removeAttribute() {
        this._src = "";
      }

      load() {
        // no-op
      }

      set src(value: string) {
        this._src = value;
        if (options.emitNever) return;
        queueMicrotask(() => {
          if (options.emitError) {
            this.listeners.get("error")?.forEach((fn) => fn());
            return;
          }
          this.listeners.get("loadedmetadata")?.forEach((fn) => fn());
        });
      }

      get src() {
        return this._src;
      }
    }

    vi.stubGlobal("Audio", FakeAudio);
  }

  it("does not revoke on success (caller owns the URL)", async () => {
    stubUrlAndAudio({ duration: 30 });
    const file = new File([new Uint8Array([1, 2, 3])], "ok.wav", {
      type: "audio/wav",
    });

    const result = await readAudioDuration(file);
    expect(result.durationSeconds).toBe(30);
    expect(created.has(result.objectUrl)).toBe(true);
    expect(revoked.has(result.objectUrl)).toBe(false);

    URL.revokeObjectURL(result.objectUrl);
    expect(revoked.has(result.objectUrl)).toBe(true);
  });

  it("revokes the object URL when metadata loading fails", async () => {
    stubUrlAndAudio({ emitError: true });
    const file = new File([new Uint8Array([1, 2, 3])], "bad.wav", {
      type: "audio/wav",
    });

    await expect(readAudioDuration(file)).rejects.toThrow("UNREADABLE_AUDIO");
    expect(created.size).toBe(1);
    const [url] = [...created];
    expect(revoked.has(url)).toBe(true);
  });

  it("revokes the object URL when aborted before metadata loads", async () => {
    stubUrlAndAudio({ emitNever: true });
    const file = new File([new Uint8Array([1, 2, 3])], "slow.wav", {
      type: "audio/wav",
    });
    const controller = new AbortController();

    const pending = readAudioDuration(file, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toThrow("ABORTED");
    expect(created.size).toBe(1);
    const [url] = [...created];
    expect(revoked.has(url)).toBe(true);
  });

  it("revokes immediately when the signal is already aborted", async () => {
    stubUrlAndAudio({ emitNever: true });
    const file = new File([new Uint8Array([1, 2, 3])], "pre.wav", {
      type: "audio/wav",
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      readAudioDuration(file, { signal: controller.signal }),
    ).rejects.toThrow("ABORTED");
    expect(created.size).toBe(1);
    const [url] = [...created];
    expect(revoked.has(url)).toBe(true);
  });

  it("revokes when duration metadata is invalid", async () => {
    stubUrlAndAudio({ duration: Number.NaN });
    const file = new File([new Uint8Array([1, 2, 3])], "nan.wav", {
      type: "audio/wav",
    });

    await expect(readAudioDuration(file)).rejects.toThrow("INVALID_DURATION");
    expect(created.size).toBe(1);
    const [url] = [...created];
    expect(revoked.has(url)).toBe(true);
  });
});
