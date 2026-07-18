import {
  STAGE_ORDER,
  type ActiveProcessingStage,
  type ProcessingJobEvent,
  type ProcessingJobState,
  type ProcessingStage,
} from "./types";

export function createInitialJobState(): ProcessingJobState {
  return {
    status: "idle",
    progress: 0,
    selected: null,
    rightsConfirmed: false,
    providerConsentConfirmed: false,
    failure: null,
    result: null,
    illegalTransitionError: null,
  };
}

const ACTIVE = new Set<ProcessingStage>([
  "uploading",
  "separating",
  "transcribing",
  "assembling",
]);

const TERMINAL = new Set<ProcessingStage>(["completed", "failed", "cancelled"]);

function stageIndex(stage: ActiveProcessingStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function illegal(
  state: ProcessingJobState,
  message: string,
): ProcessingJobState {
  return {
    ...state,
    illegalTransitionError: message,
  };
}

function clearIllegal(state: ProcessingJobState): ProcessingJobState {
  if (!state.illegalTransitionError) return state;
  return { ...state, illegalTransitionError: null };
}

export function reduceProcessingJob(
  state: ProcessingJobState,
  event: ProcessingJobEvent,
): ProcessingJobState {
  switch (event.type) {
    case "CLEAR_ILLEGAL_ERROR":
      return clearIllegal(state);

    case "RESET":
      return createInitialJobState();

    case "VALIDATION_STARTED": {
      if (ACTIVE.has(state.status)) {
        return illegal(state, "Cannot validate while a job is running.");
      }
      return {
        ...createInitialJobState(),
        status: "validating",
      };
    }

    case "VALIDATION_SUCCEEDED": {
      if (state.status !== "validating") {
        return illegal(state, "Validation success is not allowed now.");
      }
      return {
        ...state,
        status: "ready",
        progress: 0,
        selected: event.selected,
        rightsConfirmed: false,
        providerConsentConfirmed: false,
        failure: null,
        result: null,
        illegalTransitionError: null,
      };
    }

    case "VALIDATION_FAILED": {
      if (state.status !== "validating") {
        return illegal(state, "Validation failure is not allowed now.");
      }
      return {
        ...createInitialJobState(),
        status: "idle",
        failure: event.failure,
      };
    }

    case "RIGHTS_CHANGED": {
      if (ACTIVE.has(state.status)) {
        return illegal(state, "Cannot change rights while processing.");
      }
      return {
        ...clearIllegal(state),
        rightsConfirmed: event.confirmed,
      };
    }

    case "PROVIDER_CONSENT_CHANGED": {
      if (ACTIVE.has(state.status)) {
        return illegal(state, "Cannot change provider consent while processing.");
      }
      return {
        ...clearIllegal(state),
        providerConsentConfirmed: event.confirmed,
      };
    }

    case "START_REQUESTED": {
      if (state.status !== "ready") {
        return illegal(state, "Start is only allowed from the ready state.");
      }
      if (!state.selected) {
        return illegal(state, "A validated file is required to start.");
      }
      if (!state.rightsConfirmed) {
        return illegal(state, "Rights confirmation is required to start.");
      }
      return {
        ...state,
        status: "uploading",
        progress: 0,
        failure: null,
        result: null,
        illegalTransitionError: null,
      };
    }

    case "PROGRESS": {
      if (TERMINAL.has(state.status)) {
        return illegal(state, "Terminal states ignore progress updates.");
      }
      if (!ACTIVE.has(state.status)) {
        return illegal(state, "Progress is only allowed during active stages.");
      }

      const currentIdx = stageIndex(state.status as ActiveProcessingStage);
      const nextIdx = stageIndex(event.stage);
      if (nextIdx < currentIdx) {
        return illegal(state, "Processing stage cannot move backward.");
      }

      const nextProgress = Math.min(100, Math.max(0, event.progress));
      if (nextProgress < state.progress) {
        return illegal(state, "Progress cannot move backward.");
      }

      return {
        ...state,
        status: event.stage,
        progress: nextProgress,
        illegalTransitionError: null,
      };
    }

    case "COMPLETED": {
      if (state.status !== "assembling") {
        return illegal(state, "Completion is only allowed after assembling.");
      }
      return {
        ...state,
        status: "completed",
        progress: 100,
        failure: null,
        result: event.result,
        illegalTransitionError: null,
      };
    }

    case "FAILED": {
      if (TERMINAL.has(state.status)) {
        return illegal(state, "Failure is not allowed from a terminal state.");
      }
      if (!ACTIVE.has(state.status) && state.status !== "validating") {
        return illegal(state, "Failure is not allowed from this state.");
      }
      return {
        ...state,
        status: "failed",
        failure: event.failure,
        result: null,
        illegalTransitionError: null,
      };
    }

    case "CANCEL_REQUESTED": {
      if (!ACTIVE.has(state.status)) {
        return illegal(state, "Cancel is only allowed during active processing.");
      }
      return {
        ...state,
        status: "cancelled",
        failure: null,
        result: null,
        illegalTransitionError: null,
      };
    }

    case "RETRY_REQUESTED": {
      if (state.status !== "failed") {
        return illegal(state, "Retry is only allowed after a failure.");
      }
      if (!state.failure?.retryable) {
        return illegal(state, "This failure is not retryable.");
      }
      if (!state.selected || !state.rightsConfirmed) {
        return illegal(
          state,
          "Retry requires the same validated file and rights.",
        );
      }
      return {
        ...state,
        status: "uploading",
        progress: 0,
        failure: null,
        result: null,
        illegalTransitionError: null,
      };
    }

    default:
      return state;
  }
}

export function canStartProcessing(
  state: ProcessingJobState,
  options?: { requireProviderConsent?: boolean },
): boolean {
  if (
    state.status !== "ready" ||
    state.selected === null ||
    !state.rightsConfirmed
  ) {
    return false;
  }
  if (options?.requireProviderConsent && !state.providerConsentConfirmed) {
    return false;
  }
  return true;
}

export function isJobActive(state: ProcessingJobState): boolean {
  return ACTIVE.has(state.status);
}
