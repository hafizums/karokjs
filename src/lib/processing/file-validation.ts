import {
  ACCEPTED_EXTENSIONS,
  MAX_DURATION_SECONDS,
  MAX_FILE_BYTES,
  type AcceptedExtension,
  type ProcessingFailure,
  type SelectedAudioMeta,
} from "./types";

const EXTENSION_MIME: Record<AcceptedExtension, string[]> = {
  ".mp3": ["audio/mpeg", "audio/mp3", "audio/x-mpeg"],
  ".wav": ["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"],
  ".m4a": ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac"],
  ".flac": ["audio/flac", "audio/x-flac"],
};

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatLabel(ext: string): string {
  return ext.replace(".", "").toUpperCase();
}

function validationFailure(
  code: string,
  message: string,
): { ok: false; failure: ProcessingFailure } {
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

export type FileValidationInput = {
  name: string;
  size: number;
  type?: string | null;
  durationSeconds: number | null;
};

export type FileValidationResult =
  | { ok: true; selected: SelectedAudioMeta }
  | { ok: false; failure: ProcessingFailure };

/**
 * Pure file validation. Duration must already be extracted by the caller.
 */
export function validateAudioFile(input: FileValidationInput): FileValidationResult {
  const name = input.name?.trim() ?? "";
  if (!name) {
    return validationFailure("EMPTY_FILENAME", "Please choose an audio file.");
  }

  if (!Number.isFinite(input.size) || input.size <= 0) {
    return validationFailure(
      "EMPTY_FILE",
      "This file is empty. Choose a valid audio file.",
    );
  }

  if (input.size > MAX_FILE_BYTES) {
    return validationFailure(
      "FILE_TOO_LARGE",
      "This file is larger than 50 MB. Choose a smaller track.",
    );
  }

  const ext = getExtension(name);
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    return validationFailure(
      "UNSUPPORTED_EXTENSION",
      "Use an MP3, WAV, M4A, or FLAC file.",
    );
  }

  const acceptedExt = ext as AcceptedExtension;
  const mime = (input.type ?? "").trim().toLowerCase() || null;
  if (mime) {
    const allowed = EXTENSION_MIME[acceptedExt];
    const isOctet = mime === "application/octet-stream";
    const listed = allowed.includes(mime);
    // Empty MIME is already handled. Allow generic octet-stream. Reject known
    // MIME values that are not in the extension allowlist (including other
    // audio/* types that belong to a different format).
    if (!isOctet && !listed) {
      return validationFailure(
        "MIME_MISMATCH",
        "This file type does not look like supported audio.",
      );
    }
  }

  if (input.durationSeconds === null || !Number.isFinite(input.durationSeconds)) {
    return validationFailure(
      "INVALID_DURATION",
      "We could not read this audio file. It may be corrupt or unreadable.",
    );
  }

  if (input.durationSeconds <= 0) {
    return validationFailure(
      "INVALID_DURATION",
      "We could not read a valid duration for this audio file.",
    );
  }

  if (input.durationSeconds > MAX_DURATION_SECONDS) {
    return validationFailure(
      "DURATION_TOO_LONG",
      "This track is longer than 12 minutes. Choose a shorter clip.",
    );
  }

  return {
    ok: true,
    selected: {
      name,
      sizeBytes: input.size,
      durationSeconds: input.durationSeconds,
      format: formatLabel(acceptedExt),
      mimeType: mime,
    },
  };
}

/**
 * Read duration via HTMLAudioElement + temporary object URL.
 * Revokes the URL on every failure/abort path. On success the caller must
 * revoke the returned objectUrl (and on unmount/replace).
 */
export function readAudioDuration(
  file: File,
  options?: { signal?: AbortSignal },
): Promise<{ durationSeconds: number; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);

  if (options?.signal?.aborted) {
    URL.revokeObjectURL(objectUrl);
    return Promise.reject(new Error("ABORTED"));
  }

  return new Promise((resolve, reject) => {
    const audio = new Audio();
    let settled = false;

    const cleanupListeners = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      options?.signal?.removeEventListener("abort", onAbort);
      audio.removeAttribute("src");
      audio.load();
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanupListeners();
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    const onLoaded = () => {
      if (settled) return;
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        fail(new Error("INVALID_DURATION"));
        return;
      }
      settled = true;
      cleanupListeners();
      resolve({ durationSeconds: duration, objectUrl });
    };

    const onError = () => {
      fail(new Error("UNREADABLE_AUDIO"));
    };

    const onAbort = () => {
      fail(new Error("ABORTED"));
    };

    options?.signal?.addEventListener("abort", onAbort);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    audio.src = objectUrl;
  });
}
