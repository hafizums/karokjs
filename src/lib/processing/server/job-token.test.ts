import { describe, expect, it } from "vitest";
import {
  signSeparationJobToken,
  verifySeparationJobToken,
} from "./job-token";

describe("separation job tokens", () => {
  const secret = "test-signing-secret-value";

  it("signs and verifies a valid token", () => {
    const token = signSeparationJobToken(
      {
        predictionId: "pred_123",
        filename: "track.mp3",
        durationSeconds: 42,
        nowSeconds: 1_000,
        ttlSeconds: 60,
      },
      secret,
    );

    const verified = verifySeparationJobToken(token, secret, {
      nowSeconds: 1_010,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.claims.predictionId).toBe("pred_123");
    expect(verified.claims.filename).toBe("track.mp3");
  });

  it("rejects expired tokens", () => {
    const token = signSeparationJobToken(
      {
        predictionId: "pred_123",
        filename: "track.mp3",
        durationSeconds: 42,
        nowSeconds: 1_000,
        ttlSeconds: 10,
      },
      secret,
    );

    const verified = verifySeparationJobToken(token, secret, {
      nowSeconds: 1_020,
    });
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.code).toBe("TOKEN_EXPIRED");
    }
  });

  it("rejects tampered tokens", () => {
    const token = signSeparationJobToken(
      {
        predictionId: "pred_123",
        filename: "track.mp3",
        durationSeconds: 42,
      },
      secret,
    );
    const [payload, signature] = token.split(".");
    const tampered = `${payload}.${signature?.slice(0, -2)}aa`;
    const verified = verifySeparationJobToken(tampered, secret);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.code).toBe("INVALID_TOKEN");
    }
  });
});
