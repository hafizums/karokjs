import { MAX_DURATION_SECONDS, type ProcessingFailure } from "../types";

export type ClientDurationParseResult =
  | { ok: true; durationSeconds: number }
  | { ok: false; failure: ProcessingFailure };

/**
 * Parse a client-claimed duration. Treated as untrusted input.
 * Rejects non-positive values and anything above the product limit.
 */
export function parseClientDurationSeconds(
  value: FormDataEntryValue | null | undefined,
): ClientDurationParseResult {
  if (typeof value !== "string") {
    return {
      ok: false,
      failure: {
        stage: "validating",
        code: "INVALID_DURATION",
        message: "A valid audio duration is required.",
        retryable: false,
      },
    };
  }

  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      ok: false,
      failure: {
        stage: "validating",
        code: "INVALID_DURATION",
        message: "A valid audio duration is required.",
        retryable: false,
      },
    };
  }

  if (n > MAX_DURATION_SECONDS) {
    return {
      ok: false,
      failure: {
        stage: "validating",
        code: "DURATION_TOO_LONG",
        message: "This track is longer than 12 minutes. Choose a shorter clip.",
        retryable: false,
      },
    };
  }

  return { ok: true, durationSeconds: n };
}
