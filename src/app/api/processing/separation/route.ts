import {
  ProcessingConfigError,
  requireRealProcessingConfig,
} from "@/lib/processing/server/env";
import { signSeparationJobToken, verifySeparationJobToken } from "@/lib/processing/server/job-token";
import { jsonFailure, mapProviderError } from "@/lib/processing/server/provider-errors";
import { validateServerAudioUpload } from "@/lib/processing/server/server-file-validation";
import {
  fetchWaveSpeedPrediction,
  sanitizeSeparationStatus,
  submitVocalIsolation,
  uploadAudioToWaveSpeed,
} from "@/lib/processing/server/wavespeed";

export const runtime = "nodejs";

function parseDuration(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function POST(request: Request) {
  try {
    const config = requireRealProcessingConfig();
    const form = await request.formData();
    const fileEntry = form.get("file");
    if (!(fileEntry instanceof File)) {
      return jsonFailure({
        stage: "uploading",
        code: "MISSING_FILE",
        message: "An audio file is required.",
        retryable: false,
      });
    }

    const durationSeconds = parseDuration(form.get("durationSeconds"));
    if (durationSeconds === null) {
      return jsonFailure({
        stage: "validating",
        code: "INVALID_DURATION",
        message: "A valid audio duration is required.",
        retryable: false,
      });
    }

    const validation = validateServerAudioUpload({
      filename: fileEntry.name,
      size: fileEntry.size,
      type: fileEntry.type,
    });
    if (!validation.ok) {
      return jsonFailure(validation.failure);
    }

    const uploadedUrl = await uploadAudioToWaveSpeed({
      apiKey: config.wavespeedApiKey,
      file: fileEntry,
      filename: validation.filename,
      contentType: validation.mimeType,
      signal: request.signal,
    });

    const { predictionId } = await submitVocalIsolation({
      apiKey: config.wavespeedApiKey,
      audioUrl: uploadedUrl,
      signal: request.signal,
    });

    const job = signSeparationJobToken(
      {
        predictionId,
        filename: validation.filename,
        durationSeconds,
      },
      config.jobSigningSecret,
    );

    return Response.json({ job });
  } catch (error) {
    if (error instanceof ProcessingConfigError) {
      return jsonFailure(mapProviderError(error, "uploading"), 503);
    }
    const failure = mapProviderError(error, "uploading");
    const status =
      failure.code === "PROVIDER_AUTH_FAILED"
        ? 502
        : failure.code === "RATE_LIMITED"
          ? 429
          : 502;
    return jsonFailure(failure, status);
  }
}

export async function GET(request: Request) {
  try {
    const config = requireRealProcessingConfig();
    const job = new URL(request.url).searchParams.get("job");
    if (!job) {
      return jsonFailure({
        stage: "separating",
        code: "INVALID_TOKEN",
        message: "A processing job token is required.",
        retryable: false,
      });
    }

    const verified = verifySeparationJobToken(job, config.jobSigningSecret);
    if (!verified.ok) {
      return jsonFailure(
        {
          stage: "separating",
          code: verified.code,
          message: verified.message,
          retryable: verified.code === "TOKEN_EXPIRED",
        },
        verified.code === "TOKEN_EXPIRED" ? 410 : 400,
      );
    }

    const prediction = await fetchWaveSpeedPrediction({
      apiKey: config.wavespeedApiKey,
      predictionId: verified.claims.predictionId,
      signal: request.signal,
    });

    const sanitized = sanitizeSeparationStatus({
      status: prediction.status,
      outputs: prediction.outputs,
    });

    return Response.json({
      status: sanitized.status,
      ...(sanitized.status === "failed" ||
      sanitized.status === "cancelled" ||
      sanitized.status === "timeout"
        ? { code: sanitized.code, message: sanitized.message }
        : {}),
    });
  } catch (error) {
    if (error instanceof ProcessingConfigError) {
      return jsonFailure(mapProviderError(error, "separating"), 503);
    }
    return jsonFailure(mapProviderError(error, "separating"), 502);
  }
}
