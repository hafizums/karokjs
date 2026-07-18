"use client";

import { useId, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS } from "@/lib/processing/types";

type AudioDropzoneProps = {
  disabled?: boolean;
  hasFile: boolean;
  filename?: string | null;
  fileSizeLabel?: string | null;
  durationLabel?: string | null;
  formatLabel?: string | null;
  errorMessage?: string | null;
  onFileSelected: (file: File | null) => void;
  onRemove: () => void;
};

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

export function AudioDropzone({
  disabled = false,
  hasFile,
  filename,
  fileSizeLabel,
  durationLabel,
  formatLabel,
  errorMessage,
  onFileSelected,
  onRemove,
}: AudioDropzoneProps) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div className="dropzone-block">
      <label className="editor-label" htmlFor={inputId}>
        Audio file
      </label>

      <div
        className={`dropzone${dragging ? " is-dragging" : ""}${disabled ? " is-disabled" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (disabled) return;
          const file = event.dataTransfer.files?.[0] ?? null;
          if (file) onFileSelected(file);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onFileSelected(file);
            event.target.value = "";
          }}
        />

        {!hasFile ? (
          <div className="dropzone-empty">
            <p className="dropzone-title">Drop audio here or browse</p>
            <p className="dropzone-hint">MP3, WAV, M4A, or FLAC · up to 50 MB · max 12 minutes</p>
          </div>
        ) : (
          <div className="dropzone-selected" onClick={(event) => event.stopPropagation()}>
            <p className="dropzone-filename">{filename}</p>
            <ul className="dropzone-meta">
              {fileSizeLabel ? <li>{fileSizeLabel}</li> : null}
              {durationLabel ? <li>{durationLabel}</li> : null}
              {formatLabel ? <li>{formatLabel}</li> : null}
            </ul>
            <div className="dropzone-actions">
              <button
                type="button"
                className="editor-btn"
                disabled={disabled}
                onClick={openPicker}
              >
                Replace file
              </button>
              <button
                type="button"
                className="editor-btn editor-btn-danger"
                disabled={disabled}
                onClick={onRemove}
              >
                Remove file
              </button>
            </div>
          </div>
        )}
      </div>

      {errorMessage ? (
        <p id={errorId} className="field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
