"use client";

import {
  STAGE_LABELS,
  STAGE_ORDER,
  type ActiveProcessingStage,
  type ProcessingFailure,
  type ProcessingStage,
} from "@/lib/processing/types";

type ProcessingProgressProps = {
  status: ProcessingStage;
  progress: number;
  failure: ProcessingFailure | null;
};

function isActiveStage(status: ProcessingStage): status is ActiveProcessingStage {
  return (
    status === "uploading" ||
    status === "separating" ||
    status === "transcribing" ||
    status === "assembling"
  );
}

export function ProcessingProgress({
  status,
  progress,
  failure,
}: ProcessingProgressProps) {
  const currentLabel = isActiveStage(status)
    ? STAGE_LABELS[status]
    : status === "failed" && failure
      ? failure.message
      : status === "cancelled"
        ? "Processing cancelled"
        : status === "completed"
          ? "Processing complete"
          : null;

  return (
    <section className="processing-panel" aria-label="Processing status">
      <div className="processing-head">
        <p className="processing-stage-label" aria-live="polite">
          {currentLabel ?? "Ready"}
        </p>
        <p className="processing-percent" aria-hidden="true">
          {Math.round(progress)}%
        </p>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Overall processing progress"
      >
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>

      <ol className="stage-list">
        {STAGE_ORDER.map((stage) => {
          const idx = STAGE_ORDER.indexOf(stage);
          const currentIdx = isActiveStage(status)
            ? STAGE_ORDER.indexOf(status)
            : status === "completed"
              ? STAGE_ORDER.length
              : -1;
          const done =
            status === "completed" ||
            (currentIdx > idx && status !== "failed" && status !== "cancelled");
          const current = isActiveStage(status) && status === stage;
          const failedHere = failure?.stage === stage && status === "failed";

          return (
            <li
              key={stage}
              className={`stage-item${done ? " is-done" : ""}${current ? " is-current" : ""}${failedHere ? " is-failed" : ""}`}
            >
              <span className="stage-item-name">{STAGE_LABELS[stage]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
