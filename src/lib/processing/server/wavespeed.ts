import { ProviderHttpError } from "./provider-errors";

const WAVESPEED_UPLOAD_URL =
  "https://api.wavespeed.ai/api/v3/media/upload/binary";
const WAVESPEED_ISOLATOR_URL =
  "https://api.wavespeed.ai/api/v3/wavespeed-ai/audio-vocal-isolator";
const WAVESPEED_RESULT_URL = (predictionId: string) =>
  `https://api.wavespeed.ai/api/v3/predictions/${encodeURIComponent(predictionId)}/result`;

export type WaveSpeedStatus =
  | "created"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export type WaveSpeedOutputs = {
  vocalUrl: string;
  instrumentalUrl: string;
};

export type SanitizedSeparationStatus =
  | { status: "created" | "processing" }
  | { status: "completed" }
  | { status: "failed" | "cancelled" | "timeout"; code: string; message: string };

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

function unwrapData(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const root = body as Record<string, unknown>;
  if (root.data && typeof root.data === "object") {
    return root.data as Record<string, unknown>;
  }
  return root;
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate completed WaveSpeed isolator outputs.
 * outputs[0] = vocals, outputs[1] = instrumental.
 */
export function parseWaveSpeedOutputs(outputs: unknown): WaveSpeedOutputs | null {
  if (!Array.isArray(outputs) || outputs.length !== 2) return null;
  const [vocalUrl, instrumentalUrl] = outputs;
  if (!isHttpsUrl(vocalUrl) || !isHttpsUrl(instrumentalUrl)) return null;
  return { vocalUrl, instrumentalUrl };
}

export async function uploadAudioToWaveSpeed(input: {
  apiKey: string;
  file: Blob;
  filename: string;
  contentType?: string | null;
  signal?: AbortSignal;
}): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    input.file,
    input.filename || "audio.bin",
  );

  const response = await fetch(WAVESPEED_UPLOAD_URL, {
    method: "POST",
    headers: authHeaders(input.apiKey),
    body: form,
    signal: input.signal,
  });

  if (!response.ok) {
    throw new ProviderHttpError("wavespeed", response.status);
  }

  const body = (await response.json()) as unknown;
  const data = unwrapData(body);
  const url = data.url;
  if (!isHttpsUrl(url)) {
    throw new ProviderHttpError("wavespeed", 502, "Upload response missing URL");
  }
  return url;
}

export async function submitVocalIsolation(input: {
  apiKey: string;
  audioUrl: string;
  signal?: AbortSignal;
}): Promise<{ predictionId: string }> {
  const response = await fetch(WAVESPEED_ISOLATOR_URL, {
    method: "POST",
    headers: {
      ...authHeaders(input.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ audio: input.audioUrl }),
    signal: input.signal,
  });

  if (!response.ok) {
    throw new ProviderHttpError("wavespeed", response.status);
  }

  const body = (await response.json()) as unknown;
  const data = unwrapData(body);
  const predictionId =
    typeof data.id === "string" && data.id.length > 0 ? data.id : null;
  if (!predictionId) {
    throw new ProviderHttpError("wavespeed", 502, "Missing prediction id");
  }
  return { predictionId };
}

export async function fetchWaveSpeedPrediction(input: {
  apiKey: string;
  predictionId: string;
  signal?: AbortSignal;
}): Promise<{
  status: WaveSpeedStatus;
  outputs: unknown;
  error?: string;
}> {
  const response = await fetch(WAVESPEED_RESULT_URL(input.predictionId), {
    method: "GET",
    headers: authHeaders(input.apiKey),
    signal: input.signal,
  });

  if (!response.ok) {
    throw new ProviderHttpError("wavespeed", response.status);
  }

  const body = (await response.json()) as unknown;
  const data = unwrapData(body);
  const statusRaw = typeof data.status === "string" ? data.status : "";
  const allowed: WaveSpeedStatus[] = [
    "created",
    "processing",
    "completed",
    "failed",
    "cancelled",
    "timeout",
  ];
  if (!allowed.includes(statusRaw as WaveSpeedStatus)) {
    throw new ProviderHttpError("wavespeed", 502, "Unexpected status");
  }

  return {
    status: statusRaw as WaveSpeedStatus,
    outputs: data.outputs,
    error: typeof data.error === "string" ? data.error : undefined,
  };
}

export function sanitizeSeparationStatus(input: {
  status: WaveSpeedStatus;
  outputs?: unknown;
}): SanitizedSeparationStatus {
  switch (input.status) {
    case "created":
    case "processing":
      return { status: input.status };
    case "completed": {
      const parsed = parseWaveSpeedOutputs(input.outputs);
      if (!parsed) {
        return {
          status: "failed",
          code: "INVALID_SEPARATION_OUTPUT",
          message: "Separation finished without usable audio stems.",
        };
      }
      return { status: "completed" };
    }
    case "failed":
      return {
        status: "failed",
        code: "SEPARATION_FAILED",
        message: "We could not separate this track.",
      };
    case "cancelled":
      return {
        status: "cancelled",
        code: "SEPARATION_CANCELLED",
        message: "Separation was cancelled by the provider.",
      };
    case "timeout":
      return {
        status: "timeout",
        code: "SEPARATION_TIMEOUT",
        message: "Separation timed out. Retry with a shorter track.",
      };
    default:
      return {
        status: "failed",
        code: "SEPARATION_FAILED",
        message: "We could not separate this track.",
      };
  }
}

export async function getCompletedWaveSpeedOutputs(input: {
  apiKey: string;
  predictionId: string;
  signal?: AbortSignal;
}): Promise<WaveSpeedOutputs> {
  const result = await fetchWaveSpeedPrediction(input);
  if (result.status !== "completed") {
    throw new ProviderHttpError("wavespeed", 409, "Separation is not complete");
  }
  const parsed = parseWaveSpeedOutputs(result.outputs);
  if (!parsed) {
    throw new ProviderHttpError("wavespeed", 502, "Invalid separation outputs");
  }
  return parsed;
}
