import { describe, expect, it } from "vitest";
import { ProcessingConfigError } from "./env";
import { ProviderHttpError, mapProviderError } from "./provider-errors";

describe("provider error mapping", () => {
  it("maps auth, credit, rate-limit, invalid-audio and timeout safely", () => {
    expect(mapProviderError(new ProviderHttpError("wavespeed", 401), "uploading").code).toBe(
      "PROVIDER_AUTH_FAILED",
    );
    expect(mapProviderError(new ProviderHttpError("elevenlabs", 402), "transcribing").code).toBe(
      "INSUFFICIENT_CREDIT",
    );
    expect(mapProviderError(new ProviderHttpError("wavespeed", 429), "separating").code).toBe(
      "RATE_LIMITED",
    );
    expect(mapProviderError(new ProviderHttpError("wavespeed", 422), "uploading").code).toBe(
      "INVALID_AUDIO",
    );
    expect(
      mapProviderError(new Error("POLL_TIMEOUT"), "separating").code,
    ).toBe("PROVIDER_TIMEOUT");
    expect(
      mapProviderError(
        new ProcessingConfigError("REAL_NOT_CONFIGURED", "Real processing is not configured."),
        "uploading",
      ).message,
    ).toBe("Real processing is not configured.");
  });

  it("never exposes stack traces or secrets", () => {
    const failure = mapProviderError(
      new ProviderHttpError("elevenlabs", 500, "secret-key-xyz stack"),
      "transcribing",
    );
    expect(failure.message).not.toMatch(/secret-key|stack/i);
  });
});
