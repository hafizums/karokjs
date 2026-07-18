import { describe, expect, it } from "vitest";
import { readServerProcessingEnv } from "./env";

describe("processing env", () => {
  it("defaults to mock and reports missing-key real mode", () => {
    expect(
      readServerProcessingEnv({
        KAROKS_PROCESSING_MODE: "mock",
        WAVESPEED_API_KEY: "ws",
        ELEVENLABS_API_KEY: "el",
        KAROKS_JOB_SIGNING_SECRET: "secret",
      }),
    ).toMatchObject({ mode: "mock", realConfigured: true });

    expect(
      readServerProcessingEnv({
        KAROKS_PROCESSING_MODE: "real",
        WAVESPEED_API_KEY: "",
        ELEVENLABS_API_KEY: "el",
        KAROKS_JOB_SIGNING_SECRET: "secret",
      }),
    ).toMatchObject({ mode: "real", realConfigured: false });
  });
});
