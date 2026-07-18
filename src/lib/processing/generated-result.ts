import { DEFAULT_THEME, parseTheme, type KaraokeTheme } from "@/lib/karaoke/theme";
import { parseTranscript } from "@/lib/karaoke/transcript-edit";
import type { KaraokeTranscript } from "@/lib/karaoke/types";

export const GENERATED_RESULT_DB = "karoks-generated-result";
export const GENERATED_RESULT_STORE = "results";
export const GENERATED_RESULT_KEY = "latest";
export const GENERATED_RESULT_VERSION = 1 as const;
/** Placeholder audioUrl persisted in IndexedDB (never a remote URL). */
export const GENERATED_AUDIO_PLACEHOLDER = "idb:generated-instrumental";

export type StoredGeneratedResult = {
  version: typeof GENERATED_RESULT_VERSION;
  createdAt: number;
  filename: string;
  durationSeconds: number;
  transcript: KaraokeTranscript;
  theme: KaraokeTheme;
  instrumentalBlob: Blob;
};

export type GeneratedResultRecord = StoredGeneratedResult;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(GENERATED_RESULT_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(GENERATED_RESULT_STORE)) {
        db.createObjectStore(GENERATED_RESULT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB open failed"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB request failed"));
  });
}

export function serializeGeneratedResultForTest(result: StoredGeneratedResult): {
  version: number;
  createdAt: number;
  filename: string;
  durationSeconds: number;
  transcript: KaraokeTranscript;
  theme: KaraokeTheme;
  instrumentalByteLength: number;
  instrumentalType: string;
} {
  return {
    version: result.version,
    createdAt: result.createdAt,
    filename: result.filename,
    durationSeconds: result.durationSeconds,
    transcript: result.transcript,
    theme: result.theme,
    instrumentalByteLength: result.instrumentalBlob.size,
    instrumentalType: result.instrumentalBlob.type || "application/octet-stream",
  };
}

export function parseStoredGeneratedResult(
  input: unknown,
): StoredGeneratedResult | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (raw.version !== GENERATED_RESULT_VERSION) return null;
  if (typeof raw.createdAt !== "number" || !Number.isFinite(raw.createdAt)) {
    return null;
  }
  if (typeof raw.filename !== "string" || !raw.filename) return null;
  if (
    typeof raw.durationSeconds !== "number" ||
    !Number.isFinite(raw.durationSeconds)
  ) {
    return null;
  }

  const transcript = parseTranscript(raw.transcript);
  if (!transcript) return null;

  const theme = parseTheme(raw.theme);
  const blob = raw.instrumentalBlob;
  if (!(blob instanceof Blob) || blob.size <= 0) return null;

  return {
    version: GENERATED_RESULT_VERSION,
    createdAt: raw.createdAt,
    filename: raw.filename,
    durationSeconds: raw.durationSeconds,
    transcript,
    theme,
    instrumentalBlob: blob,
  };
}

export async function saveGeneratedResult(
  result: Omit<StoredGeneratedResult, "version" | "createdAt"> & {
    createdAt?: number;
  },
): Promise<StoredGeneratedResult> {
  const record: StoredGeneratedResult = {
    version: GENERATED_RESULT_VERSION,
    createdAt: result.createdAt ?? Date.now(),
    filename: result.filename,
    durationSeconds: result.durationSeconds,
    transcript: {
      ...result.transcript,
      // Persist without runtime object URLs.
      audioUrl: GENERATED_AUDIO_PLACEHOLDER,
    },
    theme: result.theme ?? { ...DEFAULT_THEME },
    instrumentalBlob: result.instrumentalBlob,
  };

  const db = await openDb();
  try {
    const tx = db.transaction(GENERATED_RESULT_STORE, "readwrite");
    await requestToPromise(
      tx.objectStore(GENERATED_RESULT_STORE).put(record, GENERATED_RESULT_KEY),
    );
  } finally {
    db.close();
  }
  return record;
}

export async function loadGeneratedResult(): Promise<StoredGeneratedResult | null> {
  const db = await openDb();
  try {
    const tx = db.transaction(GENERATED_RESULT_STORE, "readonly");
    const value = await requestToPromise(
      tx.objectStore(GENERATED_RESULT_STORE).get(GENERATED_RESULT_KEY),
    );
    return parseStoredGeneratedResult(value);
  } finally {
    db.close();
  }
}

export async function clearGeneratedResult(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(GENERATED_RESULT_STORE, "readwrite");
    await requestToPromise(
      tx.objectStore(GENERATED_RESULT_STORE).delete(GENERATED_RESULT_KEY),
    );
  } finally {
    db.close();
  }
}
