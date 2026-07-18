import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  type AcceptedExtension,
  type ProcessingFailure,
} from "../types";
import { getExtension } from "../file-validation";

const EXTENSION_MIME: Record<AcceptedExtension, string[]> = {
  ".mp3": ["audio/mpeg", "audio/mp3", "audio/x-mpeg"],
  ".wav": ["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"],
  ".m4a": ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac"],
  ".flac": ["audio/flac", "audio/x-flac"],
};

export type ServerFileValidationResult =
  | {
      ok: true;
      filename: string;
      size: number;
      mimeType: string | null;
      extension: AcceptedExtension;
    }
  | { ok: false; failure: ProcessingFailure };

function failure(code: string, message: string): ServerFileValidationResult {
  return {
    ok: false,
    failure: {
      stage: "validating",
      code,
      message,
      retryable: false,
    },
  };
}

/**
 * Server-side upload validation (extension, MIME, size). No duration probe.
 */
export function validateServerAudioUpload(input: {
  filename: string;
  size: number;
  type?: string | null;
}): ServerFileValidationResult {
  const filename = input.filename?.trim() ?? "";
  if (!filename) {
    return failure("EMPTY_FILENAME", "Please choose an audio file.");
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return failure("EMPTY_FILE", "This file is empty. Choose a valid audio file.");
  }

  if (input.size > MAX_FILE_BYTES) {
    return failure(
      "FILE_TOO_LARGE",
      "This file is larger than 50 MB. Choose a smaller track.",
    );
  }

  const ext = getExtension(filename);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return failure(
      "UNSUPPORTED_EXTENSION",
      "Use an MP3, WAV, M4A, or FLAC file.",
    );
  }

  const acceptedExt = ext as AcceptedExtension;
  const mime = (input.type ?? "").trim().toLowerCase() || null;
  if (mime) {
    const allowed = EXTENSION_MIME[acceptedExt];
    const isOctet = mime === "application/octet-stream";
    if (!isOctet && !allowed.includes(mime)) {
      return failure(
        "MIME_MISMATCH",
        "This file type does not look like supported audio.",
      );
    }
  }

  return {
    ok: true,
    filename,
    size: input.size,
    mimeType: mime,
    extension: acceptedExt,
  };
}
