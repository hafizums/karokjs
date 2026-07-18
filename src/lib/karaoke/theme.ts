export const BACKGROUND_PRESETS = [
  "noir-gold",
  "midnight-blue",
  "neon-berry",
] as const;

export const LYRIC_SIZES = ["small", "medium", "large"] as const;

export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];
export type LyricSize = (typeof LYRIC_SIZES)[number];

export type KaraokeTheme = {
  backgroundPreset: BackgroundPreset;
  lyricSize: LyricSize;
  baseColor: string;
  highlightColor: string;
};

export const DEFAULT_THEME: KaraokeTheme = {
  backgroundPreset: "noir-gold",
  lyricSize: "medium",
  baseColor: "#f4f0e6",
  highlightColor: "#f0c14b",
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isBackgroundPreset(value: unknown): value is BackgroundPreset {
  return (
    typeof value === "string" &&
    (BACKGROUND_PRESETS as readonly string[]).includes(value)
  );
}

export function isLyricSize(value: unknown): value is LyricSize {
  return (
    typeof value === "string" &&
    (LYRIC_SIZES as readonly string[]).includes(value)
  );
}

/** Normalize and validate a six-digit hex color. Returns null if invalid. */
export function sanitizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function cloneDefaultTheme(): KaraokeTheme {
  return { ...DEFAULT_THEME };
}

/**
 * Parse a theme object. Invalid fields fall back to defaults without throwing.
 */
export function parseTheme(input: unknown): KaraokeTheme {
  const defaults = cloneDefaultTheme();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const raw = input as Record<string, unknown>;
  const baseColor = sanitizeHexColor(raw.baseColor) ?? defaults.baseColor;
  const highlightColor =
    sanitizeHexColor(raw.highlightColor) ?? defaults.highlightColor;

  return {
    backgroundPreset: isBackgroundPreset(raw.backgroundPreset)
      ? raw.backgroundPreset
      : defaults.backgroundPreset,
    lyricSize: isLyricSize(raw.lyricSize) ? raw.lyricSize : defaults.lyricSize,
    baseColor,
    highlightColor,
  };
}

/** Theme CSS custom properties for the karaoke stage. */
export function themeToCssVars(theme: KaraokeTheme): Record<string, string> {
  return {
    "--lyric-base": theme.baseColor,
    "--lyric-highlight": theme.highlightColor,
    "--lyric-highlight-glow": `${theme.highlightColor}47`,
  };
}
