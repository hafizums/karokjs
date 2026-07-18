import type {
  ActiveProcessingStage,
  ProcessingFailure,
  ProcessingJobResult,
  SelectedAudioMeta,
} from "./types";

export type ProcessingProgressUpdate = {
  stage: ActiveProcessingStage;
  progress: number;
};

export type ProcessingProviderHandlers = {
  onProgress: (update: ProcessingProgressUpdate) => void;
  onCompleted: (result: ProcessingJobResult) => void;
  onFailed: (failure: ProcessingFailure) => void;
};

export type StartProcessingInput = {
  selected: SelectedAudioMeta;
  /** Present for API compatibility; mock never uploads bytes. */
  file: File;
  signal: AbortSignal;
  handlers: ProcessingProviderHandlers;
};

/**
 * Provider-independent processing interface for Phase 3A/3B.
 * Implementations must honor AbortSignal and never call completion after abort.
 */
export type KaraokeProcessingProvider = {
  startJob: (input: StartProcessingInput) => Promise<void>;
};
