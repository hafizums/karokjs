import type { KaraokeLine } from "@/lib/karaoke/types";

type LyricLineProps = {
  line: KaraokeLine | null;
  variant: "previous" | "current" | "next";
  activeWordId: string | null;
  activeProgress: number;
  currentTime: number;
};

function WordHighlight({
  text,
  progress,
  isActive,
  isPast,
}: {
  text: string;
  progress: number;
  isActive: boolean;
  isPast: boolean;
}) {
  if (isPast) {
    return <span className="karaoke-word is-past">{text}</span>;
  }

  if (!isActive) {
    return <span className="karaoke-word">{text}</span>;
  }

  const pct = Math.round(progress * 100);

  return (
    <span
      className="karaoke-word is-active"
      style={{ ["--word-progress" as string]: `${pct}%` }}
    >
      <span className="karaoke-word-base" aria-hidden="true">
        {text}
      </span>
      <span className="karaoke-word-fill" aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

export function LyricLineView({
  line,
  variant,
  activeWordId,
  activeProgress,
  currentTime,
}: LyricLineProps) {
  if (!line) {
    return (
      <p className={`lyric-line lyric-${variant} is-empty`} aria-hidden="true">
        &nbsp;
      </p>
    );
  }

  if (variant !== "current") {
    return (
      <p className={`lyric-line lyric-${variant}`}>
        {line.words.map((word, index) => (
          <span key={word.id}>
            {index > 0 ? " " : null}
            {word.text}
          </span>
        ))}
      </p>
    );
  }

  return (
    <p className={`lyric-line lyric-${variant}`} aria-live="polite">
      {line.words.map((word, index) => {
        const isActive = word.id === activeWordId;
        const isPast = !isActive && currentTime >= word.end;

        return (
          <span key={word.id}>
            {index > 0 ? " " : null}
            <WordHighlight
              text={word.text}
              progress={isActive ? activeProgress : 0}
              isActive={isActive}
              isPast={isPast}
            />
          </span>
        );
      })}
    </p>
  );
}
