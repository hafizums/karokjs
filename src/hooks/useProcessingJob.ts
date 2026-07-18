"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  formatFileSize,
  getExtension,
  readAudioDuration,
  validateAudioFile,
} from "@/lib/processing/file-validation";
import {
  canStartProcessing,
  createInitialJobState,
  isJobActive,
  reduceProcessingJob,
} from "@/lib/processing/job-reducer";
import { createMockProcessingProvider } from "@/lib/processing/mock-provider";
import type { KaraokeProcessingProvider } from "@/lib/processing/provider";
import {
  createRealProcessingProvider,
  fetchClientProcessingConfig,
} from "@/lib/processing/real-provider";
import {
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  type ClientProcessingConfig,
  type ProcessingConfigStatus,
  type ProcessingFailure,
  type SelectedAudioMeta,
} from "@/lib/processing/types";

type UseProcessingJobOptions = {
  provider?: KaraokeProcessingProvider;
};

function revokeUrl(url: string | null) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore.
  }
}

type RealProvider = ReturnType<typeof createRealProcessingProvider>;

export function useProcessingJob(options: UseProcessingJobOptions = {}) {
  const mockProviderRef = useRef(createMockProcessingProvider());
  const realProviderRef = useRef<RealProvider>(createRealProcessingProvider());
  const injectedProviderRef = useRef(options.provider);

  const [configStatus, setConfigStatus] =
    useState<ProcessingConfigStatus>("loading");
  const [config, setConfig] = useState<ClientProcessingConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [state, dispatch] = useReducer(
    reduceProcessingJob,
    undefined,
    createInitialJobState,
  );
  const stateRef = useRef(state);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fileRef.current = file;
  }, [file]);

  useEffect(() => {
    injectedProviderRef.current = options.provider;
  }, [options.provider]);

  useEffect(() => {
    let cancelled = false;

    void fetchClientProcessingConfig().then((result) => {
      if (cancelled) return;
      if (result.status === "ready") {
        setConfig(result.config);
        setConfigError(null);
        setConfigStatus("ready");
        return;
      }
      setConfig(null);
      setConfigError(result.message);
      setConfigStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const validationAbortRef = useRef<AbortController | null>(null);
  const jobGenerationRef = useRef(0);

  useEffect(() => {
    return () => {
      validationAbortRef.current?.abort();
      abortRef.current?.abort();
      revokeUrl(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  const clearObjectUrl = useCallback(() => {
    revokeUrl(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const bumpJobGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    jobGenerationRef.current += 1;
  }, []);

  const configReady = configStatus === "ready" && config !== null;
  const requireProviderConsent =
    configReady && config.mode === "real" && config.realConfigured;
  const realModeUnavailable =
    configReady && config.mode === "real" && !config.realConfigured;
  const processingEnabled =
    configReady &&
    ((config.mode === "mock") ||
      (config.mode === "real" && config.realConfigured));

  const getProvider = useCallback((): KaraokeProcessingProvider | null => {
    if (injectedProviderRef.current) return injectedProviderRef.current;
    if (!configReady || !config) return null;
    // Only an explicit server mock mode enables the mock provider.
    if (config.mode === "mock") return mockProviderRef.current;
    if (config.mode === "real" && config.realConfigured) {
      return realProviderRef.current;
    }
    return null;
  }, [config, configReady]);

  const runProviderJob = useCallback(
    (selected: SelectedAudioMeta, nextFile: File) => {
      const provider = getProvider();
      if (!provider) return;

      const controller = new AbortController();
      abortRef.current = controller;
      const generation = jobGenerationRef.current;

      void provider.startJob({
        selected,
        file: nextFile,
        signal: controller.signal,
        handlers: {
          onProgress: (update) => {
            if (generation !== jobGenerationRef.current) return;
            if (controller.signal.aborted) return;
            dispatch({
              type: "PROGRESS",
              stage: update.stage,
              progress: update.progress,
            });
          },
          onCompleted: (result) => {
            if (generation !== jobGenerationRef.current) return;
            if (controller.signal.aborted) return;
            dispatch({ type: "COMPLETED", result });
          },
          onFailed: (failure) => {
            if (generation !== jobGenerationRef.current) return;
            if (controller.signal.aborted) return;
            dispatch({ type: "FAILED", failure });
          },
        },
      });
    },
    [getProvider],
  );

  const selectFile = useCallback(
    async (next: File | null) => {
      validationAbortRef.current?.abort();
      bumpJobGeneration();
      clearObjectUrl();
      setFile(null);
      realProviderRef.current.resetCheckpoints();

      if (!next) {
        dispatch({ type: "RESET" });
        return;
      }

      dispatch({ type: "VALIDATION_STARTED" });
      const controller = new AbortController();
      validationAbortRef.current = controller;

      const ext = getExtension(next.name);
      const structural = validateAudioFile({
        name: next.name,
        size: next.size,
        type: next.type,
        durationSeconds: null,
      });

      if (
        next.size <= 0 ||
        next.size > MAX_FILE_BYTES ||
        !(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)
      ) {
        if (!structural.ok) {
          dispatch({ type: "VALIDATION_FAILED", failure: structural.failure });
        } else {
          dispatch({
            type: "VALIDATION_FAILED",
            failure: {
              stage: "validating",
              code: "UNSUPPORTED_EXTENSION",
              message: "Use an MP3, WAV, M4A, or FLAC file.",
              retryable: false,
            },
          });
        }
        return;
      }

      try {
        const { durationSeconds, objectUrl } = await readAudioDuration(next, {
          signal: controller.signal,
        });
        objectUrlRef.current = objectUrl;

        const result = validateAudioFile({
          name: next.name,
          size: next.size,
          type: next.type,
          durationSeconds,
        });

        clearObjectUrl();

        if (controller.signal.aborted) return;

        if (!result.ok) {
          dispatch({ type: "VALIDATION_FAILED", failure: result.failure });
          return;
        }

        setFile(next);
        dispatch({ type: "VALIDATION_SUCCEEDED", selected: result.selected });
      } catch {
        clearObjectUrl();
        if (controller.signal.aborted) return;
        const failure: ProcessingFailure = {
          stage: "validating",
          code: "UNREADABLE_AUDIO",
          message:
            "We could not read this audio file. It may be corrupt or unreadable.",
          retryable: false,
        };
        dispatch({ type: "VALIDATION_FAILED", failure });
      } finally {
        if (validationAbortRef.current === controller) {
          validationAbortRef.current = null;
        }
      }
    },
    [bumpJobGeneration, clearObjectUrl],
  );

  const setRightsConfirmed = useCallback((confirmed: boolean) => {
    dispatch({ type: "RIGHTS_CHANGED", confirmed });
  }, []);

  const setProviderConsentConfirmed = useCallback((confirmed: boolean) => {
    dispatch({ type: "PROVIDER_CONSENT_CHANGED", confirmed });
  }, []);

  const startProcessing = useCallback(() => {
    const current = stateRef.current;
    const currentFile = fileRef.current;

    if (!processingEnabled || realModeUnavailable) {
      return;
    }

    if (
      !currentFile ||
      !canStartProcessing(current, { requireProviderConsent }) ||
      !current.selected
    ) {
      return;
    }

    if (!getProvider()) {
      return;
    }

    const next = reduceProcessingJob(current, { type: "START_REQUESTED" });
    if (next.status !== "uploading" || !next.selected) {
      dispatch({ type: "START_REQUESTED" });
      return;
    }

    dispatch({ type: "START_REQUESTED" });
    bumpJobGeneration();
    runProviderJob(next.selected, currentFile);
  }, [
    bumpJobGeneration,
    getProvider,
    processingEnabled,
    realModeUnavailable,
    requireProviderConsent,
    runProviderJob,
  ]);

  const cancelProcessing = useCallback(() => {
    if (!isJobActive(stateRef.current)) return;
    dispatch({ type: "CANCEL_REQUESTED" });
    bumpJobGeneration();
  }, [bumpJobGeneration]);

  const retryProcessing = useCallback(() => {
    const current = stateRef.current;
    const currentFile = fileRef.current;
    if (
      !processingEnabled ||
      current.status !== "failed" ||
      !current.failure?.retryable ||
      !currentFile ||
      !current.selected ||
      !current.rightsConfirmed ||
      (requireProviderConsent && !current.providerConsentConfirmed)
    ) {
      return;
    }

    if (realModeUnavailable || !getProvider()) {
      return;
    }

    const next = reduceProcessingJob(current, { type: "RETRY_REQUESTED" });
    if (next.status !== "uploading" || !next.selected) {
      dispatch({ type: "RETRY_REQUESTED" });
      return;
    }

    dispatch({ type: "RETRY_REQUESTED" });
    bumpJobGeneration();
    runProviderJob(next.selected, currentFile);
  }, [
    bumpJobGeneration,
    getProvider,
    processingEnabled,
    realModeUnavailable,
    requireProviderConsent,
    runProviderJob,
  ]);

  const chooseAnotherFile = useCallback(() => {
    validationAbortRef.current?.abort();
    bumpJobGeneration();
    clearObjectUrl();
    setFile(null);
    realProviderRef.current.resetCheckpoints();
    dispatch({ type: "RESET" });
  }, [bumpJobGeneration, clearObjectUrl]);

  const removeFile = useCallback(() => {
    void selectFile(null);
  }, [selectFile]);

  const reloadConfig = useCallback(() => {
    setConfigStatus("loading");
    setConfig(null);
    setConfigError(null);
    void fetchClientProcessingConfig().then((result) => {
      if (result.status === "ready") {
        setConfig(result.config);
        setConfigError(null);
        setConfigStatus("ready");
        return;
      }
      setConfig(null);
      setConfigError(result.message);
      setConfigStatus("error");
    });
  }, []);

  return {
    state,
    file,
    config,
    configStatus,
    configError,
    configReady,
    requireProviderConsent,
    realModeUnavailable,
    processingEnabled,
    formattedSize: state.selected
      ? formatFileSize(state.selected.sizeBytes)
      : null,
    canStart:
      processingEnabled &&
      canStartProcessing(state, { requireProviderConsent }) &&
      Boolean(file) &&
      !realModeUnavailable,
    isActive: isJobActive(state),
    selectFile,
    removeFile,
    setRightsConfirmed,
    setProviderConsentConfirmed,
    startProcessing,
    cancelProcessing,
    retryProcessing,
    chooseAnotherFile,
    reloadConfig,
  };
}
