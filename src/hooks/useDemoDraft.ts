"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  clearDraftFromStorage,
  createDefaultDraft,
  DRAFT_STORAGE_KEY,
  parseDraftJson,
  readDraftFromStorage,
  writeDraftToStorage,
  type KaraokeDraft,
} from "@/lib/karaoke/draft";
import type { KaraokeTheme } from "@/lib/karaoke/theme";
import {
  updateTranscriptMeta,
  updateWordText,
} from "@/lib/karaoke/transcript-edit";

const listeners = new Set<() => void>();

function emitDraftChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === DRAFT_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getClientSnapshot(): string {
  try {
    return window.localStorage.getItem(DRAFT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

function commitDraft(draft: KaraokeDraft) {
  writeDraftToStorage(getBrowserStorage(), draft);
  emitDraftChange();
}

/** Always base writes on the latest persisted draft to avoid stale closures. */
function commitWithLatest(
  updater: (current: KaraokeDraft) => KaraokeDraft,
) {
  const current = readDraftFromStorage(getBrowserStorage());
  commitDraft(updater(current));
}

export function useDemoDraft() {
  const raw = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const draft = useMemo(() => {
    if (!raw) return createDefaultDraft();
    return parseDraftJson(raw) ?? createDefaultDraft();
  }, [raw]);

  const setTitle = useCallback((title: string) => {
    commitWithLatest((current) => ({
      ...current,
      transcript: updateTranscriptMeta(current.transcript, { title }),
    }));
  }, []);

  const setArtist = useCallback((artist: string) => {
    commitWithLatest((current) => ({
      ...current,
      transcript: updateTranscriptMeta(current.transcript, { artist }),
    }));
  }, []);

  const setWordText = useCallback((wordId: string, text: string) => {
    commitWithLatest((current) => ({
      ...current,
      transcript: updateWordText(current.transcript, wordId, text),
    }));
  }, []);

  const setTheme = useCallback((patch: Partial<KaraokeTheme>) => {
    commitWithLatest((current) => ({
      ...current,
      theme: { ...current.theme, ...patch },
    }));
  }, []);

  const resetDraft = useCallback(() => {
    clearDraftFromStorage(getBrowserStorage());
    emitDraftChange();
  }, []);

  return {
    draft,
    ready: true,
    setTitle,
    setArtist,
    setWordText,
    setTheme,
    resetDraft,
  };
}
