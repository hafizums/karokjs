import { ProviderHttpError } from "./provider-errors";

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";

export async function transcribeVocalsWithElevenLabs(input: {
  apiKey: string;
  vocalBytes: ArrayBuffer;
  filename?: string;
  contentType?: string | null;
  signal?: AbortSignal;
}): Promise<unknown> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.vocalBytes)], {
    type: input.contentType || "audio/mpeg",
  });
  form.append("file", blob, input.filename || "vocals.mp3");
  form.append("model_id", "scribe_v2");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: {
      "xi-api-key": input.apiKey,
    },
    body: form,
    signal: input.signal,
  });

  if (!response.ok) {
    throw new ProviderHttpError("elevenlabs", response.status);
  }

  return response.json();
}

export async function fetchHttpsAudioBytes(input: {
  url: string;
  signal?: AbortSignal;
}): Promise<{ bytes: ArrayBuffer; contentType: string | null }> {
  // Only allow https URLs already validated by parseWaveSpeedOutputs.
  const parsed = new URL(input.url);
  if (parsed.protocol !== "https:") {
    throw new ProviderHttpError("wavespeed", 400, "Invalid audio URL");
  }

  const response = await fetch(input.url, {
    method: "GET",
    signal: input.signal,
    redirect: "follow",
  });

  if (!response.ok) {
    throw new ProviderHttpError("wavespeed", response.status);
  }

  const bytes = await response.arrayBuffer();
  return {
    bytes,
    contentType: response.headers.get("content-type"),
  };
}
