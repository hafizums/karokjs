"use client";

import Link from "next/link";
import { useRef, type CSSProperties } from "react";
import { useKaraokePlayer } from "@/hooks/useKaraokePlayer";
import {
  DEFAULT_THEME,
  themeToCssVars,
  type KaraokeTheme,
} from "@/lib/karaoke/theme";
import type { KaraokeTranscript } from "@/lib/karaoke/types";
import { KaraokeControls } from "./KaraokeControls";
import { LyricLineView } from "./LyricLine";

type KaraokePlayerProps = {
  transcript: KaraokeTranscript;
  theme?: KaraokeTheme;
  /** Show link to the editor (player route). */
  showEditLink?: boolean;
  /** Compact stage for live editor preview. */
  compact?: boolean;
};

export function KaraokePlayer({
  transcript,
  theme = DEFAULT_THEME,
  showEditLink = false,
  compact = false,
}: KaraokePlayerProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const {
    audioRef,
    currentTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    isFullscreen,
    audioMissing,
    lyricWindow,
    activeWord,
    formattedCurrentTime,
    formattedDuration,
    togglePlay,
    seek,
    skip,
    setVolume,
    toggleMute,
    toggleFullscreen,
  } = useKaraokePlayer({ transcript, stageRef });

  const stageStyle = themeToCssVars(theme) as CSSProperties;

  return (
    <section
      ref={stageRef}
      className={`karaoke-stage${compact ? " is-compact" : ""}`}
      data-bg={theme.backgroundPreset}
      data-lyric-size={theme.lyricSize}
      style={stageStyle}
      aria-label={`${transcript.title} karaoke stage`}
    >
      <audio
        ref={audioRef}
        src={transcript.audioUrl}
        preload="metadata"
        playsInline
      />

      <header className="stage-header">
        <div className="stage-header-row">
          <p className="brand">Karoks</p>
          {showEditLink ? (
            <Link className="stage-nav-link" href="/karaoke/demo/edit">
              Edit karaoke
            </Link>
          ) : null}
        </div>
        <div className="track-meta">
          <h1 className="track-title">{transcript.title}</h1>
          <p className="track-artist">{transcript.artist}</p>
        </div>
      </header>

      <div className="lyric-stage" aria-label="Lyric display">
        <LyricLineView
          line={lyricWindow.previous}
          variant="previous"
          activeWordId={null}
          activeProgress={0}
          currentTime={currentTime}
        />
        <LyricLineView
          line={lyricWindow.current}
          variant="current"
          activeWordId={activeWord.word?.id ?? null}
          activeProgress={activeWord.progress}
          currentTime={currentTime}
        />
        <LyricLineView
          line={lyricWindow.next}
          variant="next"
          activeWordId={null}
          activeProgress={0}
          currentTime={currentTime}
        />
      </div>

      <KaraokeControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        formattedCurrentTime={formattedCurrentTime}
        formattedDuration={formattedDuration}
        volume={volume}
        isMuted={isMuted}
        isFullscreen={isFullscreen}
        audioMissing={audioMissing}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onSkip={skip}
        onVolume={setVolume}
        onToggleMute={toggleMute}
        onToggleFullscreen={toggleFullscreen}
      />
    </section>
  );
}
