import type { KaraokeDraft } from "./draft";
import { DRAFT_VERSION } from "./draft";

/** Build a safe download filename from a song title. */
export function safeExportFilename(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const base = slug.length > 0 ? slug : "karaoke-draft";
  return `${base}-karoks-draft.json`;
}

export function draftToExportPayload(draft: KaraokeDraft): {
  version: typeof DRAFT_VERSION;
  transcript: KaraokeDraft["transcript"];
  theme: KaraokeDraft["theme"];
} {
  return {
    version: DRAFT_VERSION,
    transcript: draft.transcript,
    theme: draft.theme,
  };
}

/** Serialize a draft to UTF-8 JSON for download or tests. */
export function serializeExportJson(draft: KaraokeDraft): string {
  return `${JSON.stringify(draftToExportPayload(draft), null, 2)}\n`;
}

/**
 * Trigger a browser download of the draft as UTF-8 JSON.
 * Anchor cleanup and object URL revocation are deferred so the browser
 * can begin the download before the URL is invalidated.
 */
export function downloadDraftJson(draft: KaraokeDraft): void {
  const json = serializeExportJson(draft);
  const filename = safeExportFilename(draft.transcript.title);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}
