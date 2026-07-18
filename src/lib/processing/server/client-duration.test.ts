import { describe, expect, it } from "vitest";
import { MAX_DURATION_SECONDS } from "../types";
import { parseClientDurationSeconds } from "./client-duration";

describe("parseClientDurationSeconds", () => {
  it("accepts finite positive durations within the product limit", () => {
    const ok = parseClientDurationSeconds("120");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.durationSeconds).toBe(120);
  });

  it("rejects missing, non-positive, and over-limit durations", () => {
    expect(parseClientDurationSeconds(null).ok).toBe(false);
    expect(parseClientDurationSeconds("0").ok).toBe(false);
    expect(parseClientDurationSeconds("-1").ok).toBe(false);
    expect(parseClientDurationSeconds("abc").ok).toBe(false);

    const tooLong = parseClientDurationSeconds(String(MAX_DURATION_SECONDS + 1));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.failure.code).toBe("DURATION_TOO_LONG");
    }
  });
});
