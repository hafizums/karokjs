import type { KaraokeProcessingProvider, StartProcessingInput } from "./provider";
import {
  STAGE_ORDER,
  type ActiveProcessingStage,
  type ProcessingFailure,
} from "./types";

export type MockFailureMode =
  | "none"
  | "uploading"
  | "separating"
  | "transcribing"
  | "assembling";

export type MockProviderOptions = {
  /** Total successful runtime target in ms (default ~6500). */
  totalDurationMs?: number;
  /** Injected failure for tests. Not exposed in production UI. */
  failureMode?: MockFailureMode;
  /** Override timers for deterministic tests. */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
};

const MOCK_RESULT = {
  transcriptPath: "src/data/demo-transcript.json",
  audioUrl: "/demo/instrumental.wav",
  disclosure:
    "This sample result uses the prepared demo assets. It was not generated from your uploaded file.",
} as const;

const STAGE_FAILURE_CODES: Record<ActiveProcessingStage, string> = {
  uploading: "MOCK_UPLOAD_FAILED",
  separating: "MOCK_SEPARATION_FAILED",
  transcribing: "MOCK_TRANSCRIPTION_FAILED",
  assembling: "MOCK_ASSEMBLE_FAILED",
};

const STAGE_FAILURE_MESSAGES: Record<ActiveProcessingStage, string> = {
  uploading: "We could not prepare this track.",
  separating: "We could not separate this track.",
  transcribing: "We could not find lyrics for this track.",
  assembling: "We could not prepare your karaoke player.",
};

function defaultWait(ms: number, signal: AbortSignal): Promise<void> {
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

function failureFor(stage: ActiveProcessingStage): ProcessingFailure {
  return {
    stage,
    code: STAGE_FAILURE_CODES[stage],
    message: STAGE_FAILURE_MESSAGES[stage],
    retryable: true,
  };
}

/**
 * Deterministic in-browser mock processor.
 * Never reads file bytes or makes network requests with the audio.
 */
export function createMockProcessingProvider(
  options: MockProviderOptions = {},
): KaraokeProcessingProvider {
  const totalDurationMs = options.totalDurationMs ?? 6500;
  const failureMode = options.failureMode ?? "none";
  const wait = options.wait ?? defaultWait;
  let running = false;

  const sliceMs = Math.floor(totalDurationMs / (STAGE_ORDER.length * 2));

  return {
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

      // Intentionally ignore file bytes — mock never uploads audio.
      void input.file.name;

      try {
        for (let i = 0; i < STAGE_ORDER.length; i += 1) {
          if (signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          const stage = STAGE_ORDER[i];
          const startProgress = Math.round((i / STAGE_ORDER.length) * 100);
          const midProgress = Math.round(((i + 0.5) / STAGE_ORDER.length) * 100);
          const endProgress = Math.round(((i + 1) / STAGE_ORDER.length) * 100);

          handlers.onProgress({ stage, progress: startProgress });
          await wait(sliceMs, signal);

          if (failureMode === stage) {
            handlers.onFailed(failureFor(stage));
            return;
          }

          handlers.onProgress({ stage, progress: midProgress });
          await wait(sliceMs, signal);
          handlers.onProgress({ stage, progress: endProgress });
        }

        if (signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }

        handlers.onCompleted({
          filename: selected.name,
          durationSeconds: selected.durationSeconds,
          completedStages: [...STAGE_ORDER],
          mode: "mock",
          mockResult: { ...MOCK_RESULT },
        });
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          // Cancellation: no completion, no failure callback.
          return;
        }
        handlers.onFailed({
          stage: "assembling",
          code: "MOCK_UNEXPECTED_FAILURE",
          message: "Something went wrong while preparing karaoke.",
          retryable: true,
        });
      } finally {
        running = false;
      }
    },
  };
}

export const MOCK_DEMO_RESULT_REFS = MOCK_RESULT;
