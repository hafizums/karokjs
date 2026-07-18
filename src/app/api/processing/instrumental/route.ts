import {
  ProcessingConfigError,
  requireRealProcessingConfig,
} from "@/lib/processing/server/env";
import { verifySeparationJobToken } from "@/lib/processing/server/job-token";
import { jsonFailure, mapProviderError } from "@/lib/processing/server/provider-errors";
import { getCompletedWaveSpeedOutputs } from "@/lib/processing/server/wavespeed";

export const runtime = "nodejs";

function safeAudioContentType(contentType: string | null): string {
  if (!contentType) return "audio/mpeg";
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base.startsWith("audio/")) return base;
  return "audio/mpeg";
}

export async function GET(request: Request) {
  try {
    const config = requireRealProcessingConfig();
    const url = new URL(request.url);
    const job = url.searchParams.get("job");
    const remote = url.searchParams.get("url");

    if (remote) {
      return jsonFailure({
        stage: "assembling",
        code: "UNSUPPORTED_INPUT",
        message: "Arbitrary audio URLs are not accepted.",
        retryable: false,
      });
    }

    if (!job) {
      return jsonFailure({
        stage: "assembling",
        code: "INVALID_TOKEN",
        message: "A processing job token is required.",
        retryable: false,
      });
    }

    const verified = verifySeparationJobToken(job, config.jobSigningSecret);
    if (!verified.ok) {
      return jsonFailure(
        {
          stage: "assembling",
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

    const upstream = await fetch(outputs.instrumentalUrl, {
      method: "GET",
      signal: request.signal,
      redirect: "follow",
    });

    if (!upstream.ok || !upstream.body) {
      return jsonFailure(
        {
          stage: "assembling",
          code: "INSTRUMENTAL_FETCH_FAILED",
          message: "We could not download the instrumental track.",
          retryable: true,
        },
        502,
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      safeAudioContentType(upstream.headers.get("content-type")),
    );
    headers.set("Cache-Control", "no-store");
    const length = upstream.headers.get("content-length");
    if (length) headers.set("Content-Length", length);

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof ProcessingConfigError) {
      return jsonFailure(mapProviderError(error, "assembling"), 503);
    }
    return jsonFailure(mapProviderError(error, "assembling"), 502);
  }
}
