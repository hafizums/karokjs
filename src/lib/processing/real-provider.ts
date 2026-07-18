import { DEFAULT_THEME } from "@/lib/karaoke/theme";
import type { KaraokeTranscript } from "@/lib/karaoke/types";
import { saveGeneratedResult } from "./generated-result";
import type {
  KaraokeProcessingProvider,
  ProcessingProviderHandlers,
  StartProcessingInput,
} from "./provider";
import type {
  ActiveProcessingStage,
  ClientProcessingConfig,
  ProcessingFailure,
  ProcessingJobResult,
} from "./types";
import { STAGE_ORDER } from "./types";

const REAL_DISCLOSURE =
  "Your audio was processed with WaveSpeed vocal separation and ElevenLabs transcription. Only the instrumental and normalized lyrics were saved on this device.";

const POLL_INITIAL_MS = 2000;
const POLL_MAX_MS = 10000;
const POLL_OVERALL_TIMEOUT_MS = 10 * 60 * 1000;

type Checkpoint = {
  jobToken: string | null;
  transcript: KaraokeTranscript | null;
  filename: string;
  durationSeconds: number;
};

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    stage?: string;
    retryable?: boolean;
  };
};

export type RealProviderOptions = {
  fetchImpl?: typeof fetch;
  pollInitialMs?: number;
  pollMaxMs?: number;
  pollTimeoutMs?: number;
  saveResult?: typeof saveGeneratedResult;
};

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

async function readApiError(
  response: Response,
  fallbackStage: ActiveProcessingStage,
): Promise<ProcessingFailure> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = null;
  }

  const code = body?.error?.code;
  const message = body?.error?.message;
  const retryable = body?.error?.retryable;

  if (response.status === 503 || code === "REAL_NOT_CONFIGURED") {
    return {
      stage: fallbackStage,
      code: "REAL_NOT_CONFIGURED",
      message: "Real processing is not configured.",
      retryable: false,
    };
  }

  return {
    stage: fallbackStage,
    code: code || "PROVIDER_FAILED",
    message:
      message || "Something went wrong while processing this track.",
    retryable: typeof retryable === "boolean" ? retryable : true,
  };
}

function emitStage(
  handlers: ProcessingProviderHandlers,
  stage: ActiveProcessingStage,
  progress: number,
  signal: AbortSignal,
) {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  handlers.onProgress({ stage, progress });
}

/**
 * Real karaoke processing provider.
 * Browser talks only to same-origin /api/processing/* endpoints.
 */
export function createRealProcessingProvider(
  options: RealProviderOptions = {},
): KaraokeProcessingProvider & {
  resetCheckpoints: () => void;
  getCheckpointsForTests: () => Checkpoint;
} {
  const fetchImpl = options.fetchImpl ?? fetch;
  const saveResult = options.saveResult ?? saveGeneratedResult;
  const pollInitialMs = options.pollInitialMs ?? POLL_INITIAL_MS;
  const pollMaxMs = options.pollMaxMs ?? POLL_MAX_MS;
  const pollTimeoutMs = options.pollTimeoutMs ?? POLL_OVERALL_TIMEOUT_MS;

  let running = false;
  let checkpoint: Checkpoint = {
    jobToken: null,
    transcript: null,
    filename: "",
    durationSeconds: 0,
  };

  const resetCheckpoints = () => {
    checkpoint = {
      jobToken: null,
      transcript: null,
      filename: "",
      durationSeconds: 0,
    };
  };

  async function uploadAndSeparate(
    input: StartProcessingInput,
  ): Promise<string> {
    emitStage(input.handlers, "uploading", 5, input.signal);

    const form = new FormData();
    form.append("file", input.file, input.selected.name);
    form.append("durationSeconds", String(input.selected.durationSeconds));

    const response = await fetchImpl("/api/processing/separation", {
      method: "POST",
      body: form,
      signal: input.signal,
    });

    if (!response.ok) {
      throw await readApiError(response, "uploading");
    }

    const body = (await response.json()) as { job?: string };
    if (typeof body.job !== "string" || !body.job) {
      throw {
        stage: "uploading",
        code: "INVALID_JOB_TOKEN",
        message: "Processing did not return a valid job token.",
        retryable: true,
      } satisfies ProcessingFailure;
    }

    emitStage(input.handlers, "uploading", 20, input.signal);
    emitStage(input.handlers, "separating", 25, input.signal);

    const jobToken = body.job;
    const started = Date.now();
    let delay = pollInitialMs;

    while (true) {
      if (input.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (Date.now() - started > pollTimeoutMs) {
        throw {
          stage: "separating",
          code: "PROVIDER_TIMEOUT",
          message: "Separation took too long. Retry or try a shorter track.",
          retryable: true,
        } satisfies ProcessingFailure;
      }

      const pollUrl = `/api/processing/separation?job=${encodeURIComponent(jobToken)}`;
      const pollResponse = await fetchImpl(pollUrl, {
        method: "GET",
        signal: input.signal,
      });

      if (!pollResponse.ok) {
        throw await readApiError(pollResponse, "separating");
      }

      const statusBody = (await pollResponse.json()) as {
        status?: string;
        code?: string;
        message?: string;
      };

      if (statusBody.status === "completed") {
        emitStage(input.handlers, "separating", 50, input.signal);
        return jobToken;
      }

      if (
        statusBody.status === "failed" ||
        statusBody.status === "cancelled" ||
        statusBody.status === "timeout"
      ) {
        throw {
          stage: "separating",
          code: statusBody.code || "SEPARATION_FAILED",
          message:
            statusBody.message || "We could not separate this track.",
          retryable: statusBody.status !== "cancelled",
        } satisfies ProcessingFailure;
      }

      emitStage(input.handlers, "separating", 35, input.signal);
      await sleep(delay, input.signal);
      delay = Math.min(pollMaxMs, delay + 1000);
    }
  }

  async function transcribe(
    input: StartProcessingInput,
    jobToken: string,
  ): Promise<KaraokeTranscript> {
    emitStage(input.handlers, "transcribing", 55, input.signal);

    const response = await fetchImpl("/api/processing/transcription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job: jobToken }),
      signal: input.signal,
    });

    if (!response.ok) {
      throw await readApiError(response, "transcribing");
    }

    const body = (await response.json()) as {
      transcript?: KaraokeTranscript;
    };
    if (!body.transcript || !Array.isArray(body.transcript.lines)) {
      throw {
        stage: "transcribing",
        code: "INVALID_TRANSCRIPT",
        message: "Transcription returned unusable lyrics.",
        retryable: true,
      } satisfies ProcessingFailure;
    }

    emitStage(input.handlers, "transcribing", 75, input.signal);
    return body.transcript;
  }

  async function assemble(
    input: StartProcessingInput,
    jobToken: string,
    transcript: KaraokeTranscript,
  ): Promise<ProcessingJobResult> {
    emitStage(input.handlers, "assembling", 80, input.signal);

    const response = await fetchImpl(
      `/api/processing/instrumental?job=${encodeURIComponent(jobToken)}`,
      {
        method: "GET",
        signal: input.signal,
      },
    );

    if (!response.ok) {
      throw await readApiError(response, "assembling");
    }

    const blob = await response.blob();
    if (blob.size <= 0) {
      throw {
        stage: "assembling",
        code: "INSTRUMENTAL_EMPTY",
        message: "The instrumental track was empty.",
        retryable: true,
      } satisfies ProcessingFailure;
    }

    emitStage(input.handlers, "assembling", 90, input.signal);

    await saveResult({
      filename: input.selected.name,
      durationSeconds: input.selected.durationSeconds,
      transcript,
      theme: { ...DEFAULT_THEME },
      instrumentalBlob: blob,
    });

    emitStage(input.handlers, "assembling", 100, input.signal);

    return {
      filename: input.selected.name,
      durationSeconds: input.selected.durationSeconds,
      completedStages: [...STAGE_ORDER],
      mode: "real",
      realResult: {
        editorPath: "/karaoke/result/edit",
        disclosure: REAL_DISCLOSURE,
      },
    };
  }

  return {
    resetCheckpoints,
    getCheckpointsForTests: () => ({ ...checkpoint }),

    async startJob(input: StartProcessingInput): Promise<void> {
      if (running) {
        input.handlers.onFailed({
          stage: "uploading",
          code: "JOB_ALREADY_RUNNING",
          message: "Another job is already running.",
          retryable: false,
        });
        return;
      }

      running = true;
      const { signal, handlers, selected } = input;

      try {
        checkpoint.filename = selected.name;
        checkpoint.durationSeconds = selected.durationSeconds;

        let jobToken = checkpoint.jobToken;
        let transcript = checkpoint.transcript;

        if (!jobToken) {
          jobToken = await uploadAndSeparate(input);
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          checkpoint.jobToken = jobToken;
        } else {
          // Fast-forward UI stages without re-paying for separation.
          emitStage(handlers, "uploading", 20, signal);
          emitStage(handlers, "separating", 50, signal);
        }

        if (!transcript) {
          transcript = await transcribe(input, jobToken);
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          checkpoint.transcript = transcript;
        } else {
          emitStage(handlers, "transcribing", 75, signal);
        }

        const result = await assemble(input, jobToken, transcript);
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        // Successful completion clears checkpoints for the next file.
        resetCheckpoints();
        handlers.onCompleted(result);
      } catch (error) {
        if (signal.aborted || isAbortError(error)) {
          // Cancellation stops polling and prevents late completion.
          return;
        }

        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          "message" in error &&
          "retryable" in error
        ) {
          handlers.onFailed(error as ProcessingFailure);
          return;
        }

        handlers.onFailed({
          stage: "assembling",
          code: "PROVIDER_FAILED",
          message: "Something went wrong while processing this track.",
          retryable: true,
        });
      } finally {
        running = false;
      }
    },
  };
}

export async function fetchClientProcessingConfig(
  fetchImpl: typeof fetch = fetch,
): Promise<ClientProcessingConfig> {
  try {
    const response = await fetchImpl("/api/processing/config", {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      return { mode: "mock", realConfigured: false };
    }
    const body = (await response.json()) as {
      mode?: string;
      realConfigured?: boolean;
    };
    return {
      mode: body.mode === "real" ? "real" : "mock",
      realConfigured: Boolean(body.realConfigured),
    };
  } catch {
    return { mode: "mock", realConfigured: false };
  }
}

export const REAL_RESULT_DISCLOSURE = REAL_DISCLOSURE;
