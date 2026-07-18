export type KaraokeWord = {
  id: string;
  text: string;
  start: number;
  end: number;
};

export type KaraokeLine = {
  id: string;
  start: number;
  end: number;
  words: KaraokeWord[];
};

export type KaraokeTranscript = {
  title: string;
  artist: string;
  audioUrl: string;
  lines: KaraokeLine[];
};

export type ActiveWordState = {
  word: KaraokeWord | null;
  progress: number;
};

export type LyricWindow = {
  previous: KaraokeLine | null;
  current: KaraokeLine | null;
  next: KaraokeLine | null;
};
