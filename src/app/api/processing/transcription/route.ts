import { normalizeElevenLabsTranscript } from "@/lib/processing/normalize-transcript";
import {
  ProcessingConfigError,
  requireRealProcessingConfig,
} from "@/lib/processing/server/env";
import { verifySeparationJobToken } from "@/lib/processing/server/job-token";
import {
  fetchHttpsAudioBytes,
  transcribeVocalsWithElevenLabs,
} from "@/lib/processing/server/elevenlabs";
import { jsonFailure, mapProviderError } from "@/lib/processing/server/provider-errors";
import { getCompletedWaveSpeedOutputs } from "@/lib/processing/server/wavespeed";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const config = requireRealProcessingConfig();
    const body = (await request.json()) as { job?: unknown };
    const job = typeof body.job === "string" ? body.job : null;
    if (!job) {
      return jsonFailure({
        stage: "transcribing",
        code: "INVALID_TOKEN",
        message: "A processing job token is required.",
        retryable: false,
      });
    }

    // Reject arbitrary client URLs — only signed job tokens are accepted.
    if ("vocalUrl" in (body as object) || "url" in (body as object)) {
      return jsonFailure({
        stage: "transcribing",
        code: "UNSUPPORTED_INPUT",
        message: "Arbitrary audio URLs are not accepted.",
        retryable: false,
      });
    }

    const verified = verifySeparationJobToken(job, config.jobSigningSecret);
    if (!verified.ok) {
      return jsonFailure(
        {
          stage: "transcribing",
          code: verified.code,
          message: verified.message,
          retryable: verified.code === "TOKEN_EXPIRED",
        },
        verified.code === "TOKEN_EXPIRED" ? 410 : 400,
      );
    }

    const outputs = await getCompletedWaveSpeedOutputs({
      apiKey: config.wavespeedApiKey,
      predictionId: verified.claims.predictionId,
      signal: request.signal,
    });

    const vocal = await fetchHttpsAudioBytes({
      url: outputs.vocalUrl,
      signal: request.signal,
    });

    const raw = await transcribeVocalsWithElevenLabs({
      apiKey: config.elevenLabsApiKey,
      vocalBytes: vocal.bytes,
      contentType: vocal.contentType,
      filename: "vocals.mp3",
      signal: request.signal,
    });

    const normalized = normalizeElevenLabsTranscript({
      filename: verified.claims.filename,
      durationSeconds: verified.claims.durationSeconds,
      response: raw as { words?: unknown },
    });

    if (!normalized.ok) {
      return jsonFailure(
        {
          stage: "transcribing",
          code: normalized.code,
          message: normalized.message,
          retryable: normalized.code === "NO_LYRICS_FOUND",
        },
        422,
      );
    }

    return Response.json({
      transcript: normalized.transcript,
      filename: verified.claims.filename,
      durationSeconds: verified.claims.durationSeconds,
    });
  } catch (error) {
    if (error instanceof ProcessingConfigError) {
      return jsonFailure(mapProviderError(error, "transcribing"), 503);
    }
    return jsonFailure(mapProviderError(error, "transcribing"), 502);
  }
}
