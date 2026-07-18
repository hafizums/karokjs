export type ProcessingStage =
  | "idle"
  | "validating"
  | "ready"
  | "uploading"
  | "separating"
  | "transcribing"
  | "assembling"
  | "completed"
  | "failed"
  | "cancelled";

export type ActiveProcessingStage =
  | "uploading"
  | "separating"
  | "transcribing"
  | "assembling";

export type ProcessingFailure = {
  stage: ActiveProcessingStage | "validating";
  code: string;
  message: string;
  retryable: boolean;
};

export type SelectedAudioMeta = {
  name: string;
  sizeBytes: number;
  durationSeconds: number;
  format: string;
  mimeType: string | null;
};

export type MockResultRefs = {
  transcriptPath: string;
  audioUrl: string;
  disclosure: string;
};

export type RealResultRefs = {
  editorPath: string;
  disclosure: string;
};

export type ProcessingJobResult = {
  filename: string;
  durationSeconds: number;
  completedStages: ActiveProcessingStage[];
  mode: "mock" | "real";
  mockResult?: MockResultRefs;
  realResult?: RealResultRefs;
};

export type ProcessingJobState = {
  status: ProcessingStage;
  progress: number;
  selected: SelectedAudioMeta | null;
  rightsConfirmed: boolean;
  providerConsentConfirmed: boolean;
  failure: ProcessingFailure | null;
  result: ProcessingJobResult | null;
  illegalTransitionError: string | null;
};

export type ProcessingJobEvent =
  | { type: "VALIDATION_STARTED" }
  | { type: "VALIDATION_SUCCEEDED"; selected: SelectedAudioMeta }
  | { type: "VALIDATION_FAILED"; failure: ProcessingFailure }
  | { type: "RIGHTS_CHANGED"; confirmed: boolean }
  | { type: "PROVIDER_CONSENT_CHANGED"; confirmed: boolean }
  | { type: "START_REQUESTED" }
  | {
      type: "PROGRESS";
      stage: ActiveProcessingStage;
      progress: number;
    }
  | { type: "COMPLETED"; result: ProcessingJobResult }
  | { type: "FAILED"; failure: ProcessingFailure }
  | { type: "CANCEL_REQUESTED" }
  | { type: "RETRY_REQUESTED" }
  | { type: "RESET" }
  | { type: "CLEAR_ILLEGAL_ERROR" };

export const STAGE_LABELS: Record<ActiveProcessingStage, string> = {
  uploading: "Preparing your track",
  separating: "Separating vocals and instrumental",
  transcribing: "Finding the lyrics and timing",
  assembling: "Preparing your karaoke player",
};

export const STAGE_ORDER: ActiveProcessingStage[] = [
  "uploading",
  "separating",
  "transcribing",
  "assembling",
];

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 12 * 60;

export const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".flac"] as const;

export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

export type ProcessingMode = "mock" | "real";

export type ClientProcessingConfig = {
  mode: ProcessingMode;
  realConfigured: boolean;
};
