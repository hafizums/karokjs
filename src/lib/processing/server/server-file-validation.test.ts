import { describe, expect, it } from "vitest";
import { validateServerAudioUpload } from "./server-file-validation";
import { MAX_FILE_BYTES } from "../types";

describe("server-side file validation", () => {
  it("accepts valid uploads and rejects size/extension/MIME issues", () => {
    expect(
      validateServerAudioUpload({
        filename: "ok.mp3",
        size: 1024,
        type: "audio/mpeg",
      }).ok,
    ).toBe(true);

    const oversized = validateServerAudioUpload({
      filename: "big.mp3",
      size: MAX_FILE_BYTES + 1,
      type: "audio/mpeg",
    });
    expect(oversized.ok).toBe(false);

    const badExt = validateServerAudioUpload({
      filename: "notes.txt",
      size: 10,
      type: "text/plain",
    });
    expect(badExt.ok).toBe(false);

    const mismatch = validateServerAudioUpload({
      filename: "song.mp3",
      size: 10,
      type: "audio/wav",
    });
    expect(mismatch.ok).toBe(false);
  });
});
