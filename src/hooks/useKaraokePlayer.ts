"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  formatTime,
  getActiveWordState,
  getLyricWindow,
} from "@/lib/karaoke/timing";
import type {
  ActiveWordState,
  KaraokeTranscript,
  LyricWindow,
} from "@/lib/karaoke/types";

type UseKaraokePlayerOptions = {
  transcript: KaraokeTranscript;
  stageRef: RefObject<HTMLElement | null>;
};

export type KaraokePlayerState = {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  audioReady: boolean;
  audioMissing: boolean;
  lyricWindow: LyricWindow;
  activeWord: ActiveWordState;
  formattedCurrentTime: string;
  formattedDuration: string;
};

export type KaraokePlayerControls = {
  audioRef: RefObject<HTMLAudioElement | null>;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  skip: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
};

function transcriptDuration(transcript: KaraokeTranscript): number {
  if (transcript.lines.length === 0) return 0;
  return transcript.lines[transcript.lines.length - 1].end;
}

/** True when shortcuts should yield to the focused control's native behavior. */
function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  const interactive = target.closest(
    'input, textarea, select, button, a[href], [contenteditable=""], [contenteditable="true"], [role="button"], [role="radio"], [role="tab"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="slider"], [role="textbox"], [role="combobox"], [role="listbox"]',
  );

  return interactive !== null;
}

function deriveView(transcript: KaraokeTranscript, currentTime: number) {
  return {
    lyricWindow: getLyricWindow(transcript.lines, currentTime),
    activeWord: getActiveWordState(transcript.lines, currentTime),
  };
}

export function useKaraokePlayer({
  transcript,
  stageRef,
}: UseKaraokePlayerOptions): KaraokePlayerState & KaraokePlayerControls {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const volumeBeforeMute = useRef(0.85);
  const currentTimeRef = useRef(0);
  const fallbackDuration = transcriptDuration(transcript);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioMissing, setAudioMissing] = useState(false);
  const [lyricWindow, setLyricWindow] = useState<LyricWindow>(
    () => deriveView(transcript, 0).lyricWindow,
  );
  const [activeWord, setActiveWord] = useState<ActiveWordState>(
    () => deriveView(transcript, 0).activeWord,
  );

  const applyTime = useCallback(
    (time: number, nextDuration?: number) => {
      const view = deriveView(transcript, time);
      currentTimeRef.current = time;
      setCurrentTime(time);
      if (typeof nextDuration === "number" && Number.isFinite(nextDuration)) {
        setDuration(nextDuration);
      }
      setLyricWindow(view.lyricWindow);
      setActiveWord(view.activeWord);
    },
    [transcript],
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startRaf = useCallback(() => {
    stopRaf();
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const mediaDuration = Number.isFinite(audio.duration)
        ? audio.duration
        : fallbackDuration;
      applyTime(audio.currentTime || 0, mediaDuration);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyTime, fallbackDuration, stopRaf]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = isMuted ? 0 : volume;

    const onLoaded = () => {
      setAudioReady(true);
      setAudioMissing(false);
      const mediaDuration = Number.isFinite(audio.duration)
        ? audio.duration
        : fallbackDuration;
      applyTime(audio.currentTime || 0, mediaDuration);
    };

    const onError = () => {
      setAudioReady(false);
      setAudioMissing(true);
      setIsPlaying(false);
      stopRaf();
      setDuration(fallbackDuration);
    };

    const onPlay = () => {
      setIsPlaying(true);
      startRaf();
    };

    const onPause = () => {
      setIsPlaying(false);
      stopRaf();
      applyTime(
        audio.currentTime || 0,
        Number.isFinite(audio.duration) ? audio.duration : fallbackDuration,
      );
    };

    const onEnded = () => {
      setIsPlaying(false);
      stopRaf();
      applyTime(
        audio.currentTime || 0,
        Number.isFinite(audio.duration) ? audio.duration : fallbackDuration,
      );
    };

    const onSeeked = () => {
      applyTime(
        audio.currentTime || 0,
        Number.isFinite(audio.duration) ? audio.duration : fallbackDuration,
      );
    };

    const onDurationChange = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("canplay", onLoaded);
    audio.addEventListener("error", onError);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("seeked", onSeeked);
    audio.addEventListener("durationchange", onDurationChange);

    if (audio.readyState >= 1) {
      onLoaded();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("canplay", onLoaded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("seeked", onSeeked);
      audio.removeEventListener("durationchange", onDurationChange);
      stopRaf();
    };
  }, [
    applyTime,
    fallbackDuration,
    isMuted,
    startRaf,
    stopRaf,
    transcript.audioUrl,
    volume,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const el = stageRef.current;
      setIsFullscreen(Boolean(el && document.fullscreenElement === el));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [stageRef]);

  // Re-derive lyric window when transcript text/meta changes (editor live preview).
  useEffect(() => {
    const audio = audioRef.current;
    const time = audio?.currentTime ?? currentTimeRef.current;
    const mediaDuration =
      audio && Number.isFinite(audio.duration)
        ? audio.duration
        : fallbackDuration;
    applyTime(time, mediaDuration);
  }, [transcript, applyTime, fallbackDuration]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioMissing) return;
    void audio.play().catch(() => {
      setIsPlaying(false);
      stopRaf();
    });
  }, [audioMissing, stopRaf]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      const max = duration > 0 ? duration : fallbackDuration;
      const next = Math.min(Math.max(time, 0), max);

      if (audio && !audioMissing && audio.readyState >= 1) {
        audio.currentTime = next;
      }

      applyTime(next, max);
    },
    [applyTime, audioMissing, duration, fallbackDuration],
  );

  const skip = useCallback(
    (delta: number) => {
      seek(currentTime + delta);
    },
    [currentTime, seek],
  );

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 0), 1);
    setVolumeState(clamped);
    if (clamped > 0) {
      volumeBeforeMute.current = clamped;
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = clamped;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted || volume === 0) {
      const restored = volumeBeforeMute.current || 0.85;
      setIsMuted(false);
      setVolumeState(restored);
      if (audioRef.current) audioRef.current.volume = restored;
    } else {
      volumeBeforeMute.current = volume;
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by the browser; ignore.
    }
  }, [stageRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveKeyboardTarget(event.target)) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        skip(-10);
        return;
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        skip(10);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [skip, togglePlay]);

  return {
    audioRef,
    currentTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    isFullscreen,
    audioReady,
    audioMissing,
    lyricWindow,
    activeWord,
    formattedCurrentTime: formatTime(currentTime),
    formattedDuration: formatTime(duration),
    togglePlay,
    play,
    pause,
    seek,
    skip,
    setVolume,
    toggleMute,
    toggleFullscreen,
  };
}
