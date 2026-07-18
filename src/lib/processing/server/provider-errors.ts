import type { ActiveProcessingStage, ProcessingFailure } from "../types";
import { ProcessingConfigError } from "./env";

export class ProviderHttpError extends Error {
  readonly status: number;
  readonly provider: "wavespeed" | "elevenlabs";

  constructor(
    provider: "wavespeed" | "elevenlabs",
    status: number,
    message = "Provider request failed",
  ) {
    super(message);
    this.name = "ProviderHttpError";
    this.provider = provider;
    this.status = status;
  }
}

export function mapProviderError(
  error: unknown,
  stage: ActiveProcessingStage | "validating",
): ProcessingFailure {
  if (error instanceof ProcessingConfigError) {
    return {
      stage,
      code: error.code,
      message: error.message,
      retryable: false,
    };
  }

  if (error instanceof ProviderHttpError) {
    if (error.status === 401 || error.status === 403) {
      return {
        stage,
        code: "PROVIDER_AUTH_FAILED",
        message: "Processing providers rejected authentication.",
        retryable: false,
      };
    }
    if (error.status === 402) {
      return {
        stage,
        code: "INSUFFICIENT_CREDIT",
        message: "Processing credits are insufficient. Try again later.",
        retryable: true,
      };
    }
    if (error.status === 429) {
      return {
        stage,
        code: "RATE_LIMITED",
        message: "Providers are rate-limiting requests. Wait a moment and retry.",
        retryable: true,
      };
    }
    if (error.status === 400 || error.status === 415 || error.status === 422) {
      return {
        stage,
        code: "INVALID_AUDIO",
        message: "The audio could not be processed. Try a different file.",
        retryable: false,
      };
    }
    return {
      stage,
      code: "PROVIDER_FAILED",
      message: "A processing provider failed. You can retry this step.",
      retryable: true,
    };
  }

  if (error instanceof Error && error.name === "AbortError") {
    return {
      stage,
      code: "CANCELLED",
      message: "Processing was cancelled.",
      retryable: false,
    };
  }

  if (error instanceof Error && error.message === "POLL_TIMEOUT") {
    return {
      stage,
      code: "PROVIDER_TIMEOUT",
      message: "Separation took too long. Retry or try a shorter track.",
      retryable: true,
    };
  }

  return {
    stage,
    code: "PROVIDER_FAILED",
    message: "Something went wrong while processing this track.",
    retryable: true,
  };
}

export function jsonFailure(
  failure: ProcessingFailure,
  status = 400,
): Response {
  return Response.json(
    {
      error: {
        code: failure.code,
        message: failure.message,
        stage: failure.stage,
        retryable: failure.retryable,
      },
    },
    { status },
  );
}
