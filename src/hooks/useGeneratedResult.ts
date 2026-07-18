"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GENERATED_AUDIO_PLACEHOLDER,
  clearGeneratedResult,
  loadGeneratedResult,
  saveGeneratedResult,
  type StoredGeneratedResult,
} from "@/lib/processing/generated-result";
import type { KaraokeDraft } from "@/lib/karaoke/draft";
import type { KaraokeTheme } from "@/lib/karaoke/theme";
import { cloneTranscript } from "@/lib/karaoke/transcript-edit";

export type GeneratedResultStatus = "loading" | "ready" | "missing";

export type GeneratedResultController = {
  status: GeneratedResultStatus;
  draft: KaraokeDraft | null;
  filename: string | null;
  durationSeconds: number | null;
  objectUrl: string | null;
  setTitle: (title: string) => void;
  setArtist: (artist: string) => void;
  setWordText: (wordId: string, text: string) => void;
  setTheme: (patch: Partial<KaraokeTheme>) => void;
  clearResult: () => Promise<void>;
};

function toDraft(
  stored: StoredGeneratedResult,
  objectUrl: string,
): KaraokeDraft {
  return {
    version: 1,
    transcript: {
      ...cloneTranscript(stored.transcript),
      audioUrl: objectUrl,
    },
    theme: { ...stored.theme },
  };
}

export function useGeneratedResult(): GeneratedResultController {
  const [status, setStatus] = useState<GeneratedResultStatus>("loading");
  const [stored, setStored] = useState<StoredGeneratedResult | null>(null);
  const [draft, setDraft] = useState<KaraokeDraft | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    void (async () => {
      try {
        const result = await loadGeneratedResult();
        if (cancelled) return;
        if (!result) {
          setStatus("missing");
          return;
        }
        url = URL.createObjectURL(result.instrumentalBlob);
        setStored(result);
        setObjectUrl(url);
        setDraft(toDraft(result, url));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("missing");
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const persist = useCallback(
    async (nextDraft: KaraokeDraft, currentStored: StoredGeneratedResult) => {
      await saveGeneratedResult({
        filename: currentStored.filename,
        durationSeconds: currentStored.durationSeconds,
        transcript: {
          ...nextDraft.transcript,
          audioUrl: GENERATED_AUDIO_PLACEHOLDER,
        },
        theme: nextDraft.theme,
        instrumentalBlob: currentStored.instrumentalBlob,
        createdAt: currentStored.createdAt,
      });
    },
    [],
  );

  const setTitle = useCallback(
    (title: string) => {
      if (!draft || !stored) return;
      const next = {
        ...draft,
        transcript: { ...draft.transcript, title },
      };
      setDraft(next);
      void persist(next, stored);
    },
    [draft, persist, stored],
  );

  const setArtist = useCallback(
    (artist: string) => {
      if (!draft || !stored) return;
      const next = {
        ...draft,
        transcript: { ...draft.transcript, artist },
      };
      setDraft(next);
      void persist(next, stored);
    },
    [draft, persist, stored],
  );

  const setWordText = useCallback(
    (wordId: string, text: string) => {
      if (!draft || !stored) return;
      const next = {
        ...draft,
        transcript: {
          ...draft.transcript,
          lines: draft.transcript.lines.map((line) => ({
            ...line,
            words: line.words.map((word) =>
              word.id === wordId ? { ...word, text } : word,
            ),
          })),
        },
      };
      setDraft(next);
      void persist(next, stored);
    },
    [draft, persist, stored],
  );

  const setTheme = useCallback(
    (patch: Partial<KaraokeTheme>) => {
      if (!draft || !stored) return;
      const next = {
        ...draft,
        theme: { ...draft.theme, ...patch },
      };
      setDraft(next);
      void persist(next, stored);
    },
    [draft, persist, stored],
  );

  const clearResult = useCallback(async () => {
    await clearGeneratedResult();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    setObjectUrl(null);
    setStored(null);
    setDraft(null);
    setStatus("missing");
  }, [objectUrl]);

  return {
    status,
    draft,
    filename: stored?.filename ?? null,
    durationSeconds: stored?.durationSeconds ?? null,
    objectUrl,
    setTitle,
    setArtist,
    setWordText,
    setTheme,
    clearResult,
  };
}
