import { describe, expect, it } from "vitest";
import { extractWaveSpeedUploadUrl } from "./wavespeed";

describe("WaveSpeed upload URL extraction", () => {
  it("reads download_url from current WaveSpeed upload responses", () => {
    expect(
      extractWaveSpeedUploadUrl({
        code: 200,
        data: {
          type: "audio",
          download_url: "https://cdn.example.com/a.wav",
          filename: "a.wav",
          size: 12,
        },
      }),
    ).toBe("https://cdn.example.com/a.wav");
  });

  it("falls back to legacy url field", () => {
    expect(
      extractWaveSpeedUploadUrl({
        data: { url: "https://cdn.example.com/legacy.wav" },
      }),
    ).toBe("https://cdn.example.com/legacy.wav");
  });
});
