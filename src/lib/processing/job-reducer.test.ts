import { describe, expect, it } from "vitest";
import {
  createInitialJobState,
  reduceProcessingJob,
} from "./job-reducer";
import type { ProcessingJobResult, SelectedAudioMeta } from "./types";

const selected: SelectedAudioMeta = {
  name: "demo.mp3",
  sizeBytes: 2048,
  durationSeconds: 90,
  format: "MP3",
  mimeType: "audio/mpeg",
};

const result: ProcessingJobResult = {
  filename: "demo.mp3",
  durationSeconds: 90,
  completedStages: ["uploading", "separating", "transcribing", "assembling"],
  mode: "mock",
  mockResult: {
    transcriptPath: "src/data/demo-transcript.json",
    audioUrl: "/demo/instrumental.wav",
    disclosure: "mock",
  },
};

function readyState() {
  let state = createInitialJobState();
  state = reduceProcessingJob(state, { type: "VALIDATION_STARTED" });
  state = reduceProcessingJob(state, {
    type: "VALIDATION_SUCCEEDED",
    selected,
  });
  state = reduceProcessingJob(state, {
    type: "RIGHTS_CHANGED",
    confirmed: true,
  });
  return state;
}

describe("processing job reducer", () => {
  it("runs the full successful sequence", () => {
    let state = readyState();
    state = reduceProcessingJob(state, { type: "START_REQUESTED" });
    expect(state.status).toBe("uploading");

    state = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "separating",
      progress: 40,
    });
    state = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "transcribing",
      progress: 70,
    });
    state = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "assembling",
      progress: 95,
    });
    state = reduceProcessingJob(state, { type: "COMPLETED", result });
    expect(state.status).toBe("completed");
    expect(state.progress).toBe(100);
    expect(state.result?.filename).toBe("demo.mp3");
  });

  it("rejects illegal transitions and preserves state", () => {
    const idle = createInitialJobState();
    const next = reduceProcessingJob(idle, { type: "START_REQUESTED" });
    expect(next.status).toBe("idle");
    expect(next.illegalTransitionError).toBeTruthy();
  });

  it("prevents progress from moving backward", () => {
    let state = readyState();
    state = reduceProcessingJob(state, { type: "START_REQUESTED" });
    state = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "separating",
      progress: 50,
    });
    const blocked = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "separating",
      progress: 40,
    });
    expect(blocked.progress).toBe(50);
    expect(blocked.illegalTransitionError).toMatch(/backward/i);

    const stageBack = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "uploading",
      progress: 55,
    });
    expect(stageBack.status).toBe("separating");
    expect(stageBack.illegalTransitionError).toMatch(/backward/i);
  });

  it.each([
    "uploading",
    "separating",
    "transcribing",
    "assembling",
  ] as const)("handles failure during %s", (stage) => {
    let state = readyState();
    state = reduceProcessingJob(state, { type: "START_REQUESTED" });
    if (stage !== "uploading") {
      state = reduceProcessingJob(state, {
        type: "PROGRESS",
        stage,
        progress: 20,
      });
    }
    state = reduceProcessingJob(state, {
      type: "FAILED",
      failure: {
        stage,
        code: "MOCK_FAIL",
        message: "failed",
        retryable: true,
      },
    });
    expect(state.status).toBe("failed");
    expect(state.failure?.stage).toBe(stage);
  });

  it("supports cancellation", () => {
    let state = readyState();
    state = reduceProcessingJob(state, { type: "START_REQUESTED" });
    state = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "separating",
      progress: 30,
    });
    state = reduceProcessingJob(state, { type: "CANCEL_REQUESTED" });
    expect(state.status).toBe("cancelled");

    const ignored = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "transcribing",
      progress: 80,
    });
    expect(ignored.status).toBe("cancelled");
    expect(ignored.illegalTransitionError).toBeTruthy();
  });

  it("allows retry for retryable failures and rejects non-retryable", () => {
    let state = readyState();
    state = reduceProcessingJob(state, { type: "START_REQUESTED" });
    state = reduceProcessingJob(state, {
      type: "FAILED",
      failure: {
        stage: "separating",
        code: "X",
        message: "fail",
        retryable: true,
      },
    });
    state = reduceProcessingJob(state, { type: "RETRY_REQUESTED" });
    expect(state.status).toBe("uploading");
    expect(state.failure).toBeNull();
    expect(state.progress).toBe(0);

    let hard = readyState();
    hard = reduceProcessingJob(hard, { type: "START_REQUESTED" });
    hard = reduceProcessingJob(hard, {
      type: "FAILED",
      failure: {
        stage: "uploading",
        code: "HARD",
        message: "no",
        retryable: false,
      },
    });
    const rejected = reduceProcessingJob(hard, { type: "RETRY_REQUESTED" });
    expect(rejected.status).toBe("failed");
    expect(rejected.illegalTransitionError).toMatch(/not retryable/i);
  });

  it("terminal completed ignores later progress", () => {
    let state = readyState();
    state = reduceProcessingJob(state, { type: "START_REQUESTED" });
    state = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "assembling",
      progress: 99,
    });
    state = reduceProcessingJob(state, { type: "COMPLETED", result });
    const next = reduceProcessingJob(state, {
      type: "PROGRESS",
      stage: "assembling",
      progress: 100,
    });
    expect(next.status).toBe("completed");
    expect(next.illegalTransitionError).toBeTruthy();
  });
});
