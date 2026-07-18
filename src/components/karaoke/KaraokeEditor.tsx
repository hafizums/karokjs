"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemoDraft } from "@/hooks/useDemoDraft";
import { downloadDraftJson } from "@/lib/karaoke/export-draft";
import {
  BACKGROUND_PRESETS,
  LYRIC_SIZES,
  sanitizeHexColor,
  type BackgroundPreset,
  type LyricSize,
} from "@/lib/karaoke/theme";
import { KaraokePlayer } from "./KaraokePlayer";

type EditorTab = "edit" | "preview";

const PRESET_LABELS: Record<BackgroundPreset, string> = {
  "noir-gold": "Noir gold",
  "midnight-blue": "Midnight blue",
  "neon-berry": "Neon berry",
};

const SIZE_LABELS: Record<LyricSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function KaraokeEditor() {
  const {
    draft,
    ready,
    setTitle,
    setArtist,
    setWordText,
    setTheme,
    resetDraft,
  } = useDemoDraft();
  const [tab, setTab] = useState<EditorTab>("edit");
  const [confirmReset, setConfirmReset] = useState(false);
  const [baseColorDraft, setBaseColorDraft] = useState<string | null>(null);
  const [highlightColorDraft, setHighlightColorDraft] = useState<string | null>(
    null,
  );

  const baseColorInput = baseColorDraft ?? draft.theme.baseColor;
  const highlightColorInput =
    highlightColorDraft ?? draft.theme.highlightColor;

  const commitColor = (
    field: "baseColor" | "highlightColor",
    value: string,
  ) => {
    const sanitized = sanitizeHexColor(value);
    if (!sanitized) {
      if (field === "baseColor") setBaseColorDraft(null);
      else setHighlightColorDraft(null);
      return;
    }
    setTheme({ [field]: sanitized });
    if (field === "baseColor") setBaseColorDraft(null);
    else setHighlightColorDraft(null);
  };

  const handleReset = () => {
    resetDraft();
    setConfirmReset(false);
    setBaseColorDraft(null);
    setHighlightColorDraft(null);
  };

  return (
    <div className="editor-shell" data-bg={draft.theme.backgroundPreset}>
      <header className="editor-topbar">
        <div className="editor-topbar-main">
          <p className="editor-brand">Karoks</p>
          <h1 className="editor-heading">Edit karaoke</h1>
        </div>
        <nav className="editor-actions" aria-label="Editor actions">
          <Link className="editor-link-btn" href="/karaoke/demo">
            Back to player
          </Link>
          <button
            type="button"
            className="editor-btn"
            onClick={() => downloadDraftJson(draft)}
          >
            Export JSON
          </button>
          {!confirmReset ? (
            <button
              type="button"
              className="editor-btn editor-btn-danger"
              onClick={() => setConfirmReset(true)}
            >
              Reset demo
            </button>
          ) : (
            <div className="reset-confirm" role="group" aria-label="Confirm reset">
              <p className="reset-confirm-copy">Reset to original demo?</p>
              <button
                type="button"
                className="editor-btn editor-btn-danger"
                onClick={handleReset}
              >
                Confirm reset
              </button>
              <button
                type="button"
                className="editor-btn"
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </nav>
      </header>

      <div className="editor-tabs" role="tablist" aria-label="Editor views">
        <button
          type="button"
          role="tab"
          id="tab-edit"
          aria-controls="panel-edit"
          aria-selected={tab === "edit"}
          className={`editor-tab${tab === "edit" ? " is-selected" : ""}`}
          onClick={() => setTab("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          role="tab"
          id="tab-preview"
          aria-controls="panel-preview"
          aria-selected={tab === "preview"}
          className={`editor-tab${tab === "preview" ? " is-selected" : ""}`}
          onClick={() => setTab("preview")}
        >
          Preview
        </button>
      </div>

      <div className="editor-layout">
        <section
          id="panel-edit"
          role="tabpanel"
          aria-labelledby="tab-edit"
          className={`editor-panel${tab === "edit" ? " is-active" : ""}`}
        >
          {!ready ? (
            <p className="editor-status" role="status">
              Loading local draft…
            </p>
          ) : null}

          <fieldset className="editor-fieldset">
            <legend>Song details</legend>
            <label className="editor-field">
              <span className="editor-label">Title</span>
              <input
                type="text"
                value={draft.transcript.title}
                onChange={(event) => setTitle(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="editor-field">
              <span className="editor-label">Artist</span>
              <input
                type="text"
                value={draft.transcript.artist}
                onChange={(event) => setArtist(event.target.value)}
                autoComplete="off"
              />
            </label>
          </fieldset>

          <fieldset className="editor-fieldset">
            <legend>Appearance</legend>

            <div className="editor-field">
              <span className="editor-label" id="bg-preset-label">
                Background preset
              </span>
              <div
                className="preset-row"
                role="radiogroup"
                aria-labelledby="bg-preset-label"
              >
                {BACKGROUND_PRESETS.map((preset) => {
                  const selected = draft.theme.backgroundPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`preset-chip${selected ? " is-selected" : ""}`}
                      onClick={() => setTheme({ backgroundPreset: preset })}
                    >
                      {PRESET_LABELS[preset]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="editor-field">
              <span className="editor-label" id="lyric-size-label">
                Lyric size
              </span>
              <div
                className="preset-row"
                role="radiogroup"
                aria-labelledby="lyric-size-label"
              >
                {LYRIC_SIZES.map((size) => {
                  const selected = draft.theme.lyricSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`preset-chip${selected ? " is-selected" : ""}`}
                      onClick={() => setTheme({ lyricSize: size })}
                    >
                      {SIZE_LABELS[size]}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="editor-field">
              <span className="editor-label">Base lyric color</span>
              <div className="color-row">
                <input
                  type="color"
                  aria-label="Base lyric color picker"
                  value={draft.theme.baseColor}
                  onChange={(event) =>
                    setTheme({ baseColor: event.target.value.toLowerCase() })
                  }
                />
                <input
                  type="text"
                  spellCheck={false}
                  aria-label="Base lyric color hex"
                  value={baseColorInput}
                  onChange={(event) => setBaseColorDraft(event.target.value)}
                  onBlur={() => commitColor("baseColor", baseColorInput)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </label>

            <label className="editor-field">
              <span className="editor-label">Highlight color</span>
              <div className="color-row">
                <input
                  type="color"
                  aria-label="Highlight color picker"
                  value={draft.theme.highlightColor}
                  onChange={(event) =>
                    setTheme({
                      highlightColor: event.target.value.toLowerCase(),
                    })
                  }
                />
                <input
                  type="text"
                  spellCheck={false}
                  aria-label="Highlight color hex"
                  value={highlightColorInput}
                  onChange={(event) =>
                    setHighlightColorDraft(event.target.value)
                  }
                  onBlur={() =>
                    commitColor("highlightColor", highlightColorInput)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                />
              </div>
            </label>
          </fieldset>

          <fieldset className="editor-fieldset">
            <legend>Word text</legend>
            <p className="editor-hint">
              Timing and word IDs stay fixed. Only the displayed text can change.
            </p>
            <div className="word-edit-list">
              {draft.transcript.lines.map((line) => (
                <div key={line.id} className="word-edit-line">
                  <p className="word-edit-line-label">
                    Line {line.id.replace("line-", "")}
                    <span className="word-edit-timing">
                      {line.start.toFixed(1)}s – {line.end.toFixed(1)}s
                    </span>
                  </p>
                  <div className="word-edit-words">
                    {line.words.map((word) => (
                      <label key={word.id} className="word-edit-field">
                        <span className="sr-only">
                          Word {word.id}, {word.start.toFixed(1)} to{" "}
                          {word.end.toFixed(1)} seconds
                        </span>
                        <input
                          type="text"
                          value={word.text}
                          onChange={(event) =>
                            setWordText(word.id, event.target.value)
                          }
                          aria-label={`Edit word ${word.id}`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </section>

        <section
          id="panel-preview"
          role="tabpanel"
          aria-labelledby="tab-preview"
          className={`editor-preview${tab === "preview" ? " is-active" : ""}`}
        >
          <p className="editor-preview-label">Live preview</p>
          <div className="editor-preview-frame" data-bg={draft.theme.backgroundPreset}>
            <KaraokePlayer
              transcript={draft.transcript}
              theme={draft.theme}
              compact
            />
          </div>
        </section>
      </div>
    </div>
  );
}
