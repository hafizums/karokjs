import { describe, expect, it } from "vitest";
import {
  parseWaveSpeedOutputs,
  sanitizeSeparationStatus,
} from "./wavespeed";

describe("WaveSpeed output validation", () => {
  it("requires exactly two https outputs in vocal/instrumental order", () => {
    expect(
      parseWaveSpeedOutputs([
        "https://cdn.example.com/vocals.wav",
        "https://cdn.example.com/instrumental.wav",
      ]),
    ).toEqual({
      vocalUrl: "https://cdn.example.com/vocals.wav",
      instrumentalUrl: "https://cdn.example.com/instrumental.wav",
    });

    expect(parseWaveSpeedOutputs(["https://cdn.example.com/only-one.wav"])).toBe(
      null,
    );
    expect(
      parseWaveSpeedOutputs([
        "http://insecure.example.com/a.wav",
        "https://cdn.example.com/b.wav",
      ]),
    ).toBe(null);
    expect(
      parseWaveSpeedOutputs([
        "https://cdn.example.com/a.wav",
        "https://cdn.example.com/b.wav",
        "https://cdn.example.com/c.wav",
      ]),
    ).toBe(null);
  });

  it("sanitizes completed status when outputs are invalid", () => {
    const bad = sanitizeSeparationStatus({
      status: "completed",
      outputs: ["https://cdn.example.com/only.wav"],
    });
    expect(bad.status).toBe("failed");
  });
});
