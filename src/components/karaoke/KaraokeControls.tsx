"use client";

type KaraokeControlsProps = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  formattedCurrentTime: string;
  formattedDuration: string;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  audioMissing: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (delta: number) => void;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
};

export function KaraokeControls({
  isPlaying,
  currentTime,
  duration,
  formattedCurrentTime,
  formattedDuration,
  volume,
  isMuted,
  isFullscreen,
  audioMissing,
  onTogglePlay,
  onSeek,
  onSkip,
  onVolume,
  onToggleMute,
  onToggleFullscreen,
}: KaraokeControlsProps) {
  const max = duration > 0 ? duration : 0;

  return (
    <div className="karaoke-controls">
      {audioMissing ? (
        <p className="audio-status" role="status">
          Audio file missing — add an authorized file at{" "}
          <code>public/demo/instrumental.wav</code> (see{" "}
          <code>public/demo/README.md</code>). Lyrics remain inspectable.
        </p>
      ) : null}

      <div className="seek-row">
        <span className="time-label" aria-label="Elapsed time">
          {formattedCurrentTime}
        </span>
        <input
          className="seek-slider"
          type="range"
          min={0}
          max={max || 1}
          step={0.01}
          value={Math.min(currentTime, max || currentTime)}
          disabled={audioMissing && max === 0}
          aria-label="Seek"
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span className="time-label" aria-label="Duration">
          {formattedDuration}
        </span>
      </div>

      <div className="control-row">
        <div className="control-group">
          <button
            type="button"
            className="icon-btn"
            aria-label="Skip backward 10 seconds"
            onClick={() => onSkip(-10)}
          >
            <SkipBackIcon />
          </button>
          <button
            type="button"
            className="icon-btn play-btn"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onTogglePlay}
            disabled={audioMissing}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Skip forward 10 seconds"
            onClick={() => onSkip(10)}
          >
            <SkipForwardIcon />
          </button>
        </div>

        <div className="control-group volume-group">
          <button
            type="button"
            className="icon-btn"
            aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
            onClick={onToggleMute}
          >
            {isMuted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
          </button>
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            aria-label="Volume"
            onChange={(event) => onVolume(Number(event.target.value))}
          />
        </div>

        <button
          type="button"
          className="icon-btn"
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M11 18V6l-8.5 6L11 18zm1-6 8.5 6V6L12 12z" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 10v4h4l5 5V5L7 10H3zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zm2.5 0c0 2.9-1.6 5.4-4 6.7v2.1A8.99 8.99 0 0 0 22 12a8.99 8.99 0 0 0-7-8.8v2.1c2.4 1.3 4 3.8 4 6.7z"
      />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.5 12a4.5 4.5 0 0 0-2.5-4v2.2l2.5 2.5V12zm2.5 0c0 .9-.2 1.7-.5 2.5l1.5 1.5c.6-1.2 1-2.5 1-4 0-3.5-2.3-6.4-5.5-7.4v2.1c2.1 1 3.5 3 3.5 5.3zM4.3 3 3 4.3 7.7 9H3v4h4l5 5v-6.7l4.2 4.2c-.7.5-1.4.9-2.2 1.1v2.1c1.2-.3 2.3-.9 3.2-1.7L19.7 21 21 19.7 4.3 3zM12 4 9.9 6.1 12 8.2V4z"
      />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
      />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
      />
    </svg>
  );
}
