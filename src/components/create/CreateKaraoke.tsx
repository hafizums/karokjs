"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useProcessingJob } from "@/hooks/useProcessingJob";
import { formatDuration } from "@/lib/processing/file-validation";
import { STAGE_LABELS, type ActiveProcessingStage } from "@/lib/processing/types";
import { AudioDropzone } from "./AudioDropzone";
import { ProcessingProgress } from "./ProcessingProgress";

export function CreateKaraoke() {
  const {
    state,
    config,
    requireProviderConsent,
    realModeUnavailable,
    formattedSize,
    canStart,
    isActive,
    selectFile,
    removeFile,
    setRightsConfirmed,
    setProviderConsentConfirmed,
    startProcessing,
    cancelProcessing,
    retryProcessing,
    chooseAnotherFile,
  } = useProcessingJob();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const w = window as Window & {
      __karoksSelectFile?: (file: File | null) => void;
      __karoksStart?: () => void;
      __karoksCancel?: () => void;
    };
    w.__karoksSelectFile = (file) => {
      void selectFile(file);
    };
    w.__karoksStart = () => startProcessing();
    w.__karoksCancel = () => cancelProcessing();
    return () => {
      delete w.__karoksSelectFile;
      delete w.__karoksStart;
      delete w.__karoksCancel;
    };
  }, [cancelProcessing, selectFile, startProcessing]);

  const validationError =
    state.status === "idle" && state.failure?.stage === "validating"
      ? state.failure.message
      : null;

  const showReadyControls =
    state.status === "ready" ||
    state.status === "idle" ||
    state.status === "validating";

  const showProgress =
    isActive || state.status === "failed" || state.status === "cancelled";

  const isRealResult =
    state.status === "completed" && state.result?.mode === "real";

  const disclosure =
    config.mode === "real" && config.realConfigured
      ? "Your audio will be sent to WaveSpeed for vocal separation. The isolated vocal track will then be sent to ElevenLabs for transcription."
      : "Phase 3A uses a simulated processor. Your audio stays on this device.";

  return (
    <div className="create-shell">
      <header className="create-header">
        <div>
          <p className="editor-brand">Karoks</p>
          <h1 className="create-title">Create karaoke</h1>
        </div>
        <Link className="editor-link-btn" href="/karaoke/demo">
          Open demo player
        </Link>
      </header>

      <p className="create-disclosure" role="note">
        {disclosure}
      </p>

      {realModeUnavailable ? (
        <p className="field-error" role="alert">
          Real processing is not configured. Set server environment variables
          before enabling real mode.
        </p>
      ) : null}

      {state.status === "completed" && state.result ? (
        <section className="create-complete" aria-live="polite">
          <h2 className="create-complete-title">
            {isRealResult ? "Karaoke ready" : "Sample result ready"}
          </h2>
          <p className="create-complete-copy">
            {isRealResult
              ? "Processing finished. Open the generated editor to play and edit your karaoke."
              : "Processing finished. This preview uses the prepared demo assets and was not generated from your uploaded file."}
          </p>
          <ul className="create-complete-meta">
            <li>
              <span>File</span> {state.result.filename}
            </li>
            <li>
              <span>Duration</span>{" "}
              {formatDuration(state.result.durationSeconds)}
            </li>
          </ul>
          <div className="create-complete-stages">
            <p className="editor-label">Completed stages</p>
            <ul>
              {state.result.completedStages.map(
                (stage: ActiveProcessingStage) => (
                  <li key={stage}>{STAGE_LABELS[stage]}</li>
                ),
              )}
            </ul>
          </div>
          <p className="create-mock-note">
            {isRealResult
              ? state.result.realResult?.disclosure
              : state.result.mockResult?.disclosure}
          </p>
          <div className="create-actions">
            <Link
              className="home-cta"
              href={
                isRealResult
                  ? state.result.realResult?.editorPath ??
                    "/karaoke/result/edit"
                  : "/karaoke/demo/edit"
              }
            >
              {isRealResult ? "Open generated result" : "Open sample result"}
            </Link>
            <button
              type="button"
              className="editor-btn"
              onClick={chooseAnotherFile}
            >
              Process another file
            </button>
          </div>
        </section>
      ) : (
        <>
          <AudioDropzone
            disabled={isActive || state.status === "validating"}
            hasFile={Boolean(state.selected)}
            filename={state.selected?.name}
            fileSizeLabel={formattedSize}
            durationLabel={
              state.selected
                ? formatDuration(state.selected.durationSeconds)
                : null
            }
            formatLabel={state.selected?.format ?? null}
            errorMessage={validationError}
            onFileSelected={(file) => {
              void selectFile(file);
            }}
            onRemove={removeFile}
          />

          {showReadyControls && state.selected ? (
            <div className="create-ready">
              <label className="rights-check">
                <input
                  type="checkbox"
                  checked={state.rightsConfirmed}
                  disabled={isActive}
                  onChange={(event) =>
                    setRightsConfirmed(event.target.checked)
                  }
                />
                <span>
                  I own this audio or have permission to process it.
                </span>
              </label>

              {requireProviderConsent ? (
                <label className="rights-check">
                  <input
                    type="checkbox"
                    checked={state.providerConsentConfirmed}
                    disabled={isActive}
                    onChange={(event) =>
                      setProviderConsentConfirmed(event.target.checked)
                    }
                  />
                  <span>
                    I consent to sending this audio to the named processing
                    providers.
                  </span>
                </label>
              ) : null}

              <button
                type="button"
                className="home-cta create-start"
                disabled={!canStart}
                onClick={startProcessing}
              >
                Start processing
              </button>
            </div>
          ) : null}

          {showProgress ? (
            <>
              <ProcessingProgress
                status={state.status}
                progress={state.progress}
                failure={state.failure}
              />

              <div className="create-actions">
                {isActive ? (
                  <button
                    type="button"
                    className="editor-btn editor-btn-danger"
                    onClick={cancelProcessing}
                  >
                    Cancel
                  </button>
                ) : null}

                {state.status === "failed" && state.failure?.retryable ? (
                  <button
                    type="button"
                    className="home-cta"
                    onClick={retryProcessing}
                    disabled={
                      !state.rightsConfirmed ||
                      (requireProviderConsent &&
                        !state.providerConsentConfirmed)
                    }
                  >
                    Retry
                  </button>
                ) : null}

                {(state.status === "failed" ||
                  state.status === "cancelled") && (
                  <button
                    type="button"
                    className="editor-btn"
                    onClick={chooseAnotherFile}
                  >
                    Choose another file
                  </button>
                )}
              </div>

              {state.status === "failed" && state.failure ? (
                <p className="field-error" role="alert" aria-live="polite">
                  {state.failure.message}
                </p>
              ) : null}

              {state.status === "cancelled" ? (
                <p className="create-status" role="status" aria-live="polite">
                  Processing was cancelled.
                  {requireProviderConsent
                    ? " Cancellation may not reverse provider usage already incurred."
                    : " Choose another file or start again after selecting audio."}
                </p>
              ) : null}
            </>
          ) : null}

          {state.status === "validating" ? (
            <p className="create-status" role="status" aria-live="polite">
              Reading audio details…
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
