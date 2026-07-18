import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DURATION_SECONDS } from "@/lib/processing/types";

const uploadAudioToWaveSpeed = vi.fn();
const submitVocalIsolation = vi.fn();
const fetchWaveSpeedPrediction = vi.fn();
const requireRealProcessingConfig = vi.fn(() => ({
  wavespeedApiKey: "ws-test",
  elevenLabsApiKey: "el-test",
  jobSigningSecret: "sign-test-secret",
}));

vi.mock("@/lib/processing/server/wavespeed", () => ({
  uploadAudioToWaveSpeed: (...args: unknown[]) =>
    uploadAudioToWaveSpeed(...args),
  submitVocalIsolation: (...args: unknown[]) => submitVocalIsolation(...args),
  fetchWaveSpeedPrediction: (...args: unknown[]) =>
    fetchWaveSpeedPrediction(...args),
  sanitizeSeparationStatus: (input: { status: string }) => ({
    status: input.status,
  }),
}));

vi.mock("@/lib/processing/server/env", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/processing/server/env")
  >("@/lib/processing/server/env");
  return {
    ...actual,
    requireRealProcessingConfig: () => requireRealProcessingConfig(),
  };
});

describe("POST /api/processing/separation duration gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadAudioToWaveSpeed.mockResolvedValue("https://cdn.example.com/in.wav");
    submitVocalIsolation.mockResolvedValue({ predictionId: "pred_1" });
  });

  it("rejects durations over 12 minutes before any WaveSpeed call", async () => {
    const { POST } = await import("./route");

    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([1, 2, 3])], "long.mp3", {
        type: "audio/mpeg",
      }),
    );
    form.append("durationSeconds", String(MAX_DURATION_SECONDS + 1));

    const response = await POST(
      new Request("http://localhost/api/processing/separation", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error?: { code?: string };
    };
    expect(body.error?.code).toBe("DURATION_TOO_LONG");
    expect(uploadAudioToWaveSpeed).not.toHaveBeenCalled();
    expect(submitVocalIsolation).not.toHaveBeenCalled();
  });
});
